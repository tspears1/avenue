import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { formatHex, formatHex8, toGamut } from "culori";
import {
  isUnsupportedConversion,
  unitRegistry,
} from "./rules/index.js";

const ALIAS_PATTERN = /^\{([^{}]+)\}$/;
const EXTENSION_NAMESPACE = "com.avenue.tokens";
const FIGMA_CONFIG_VERSION = "1.1.0";
const FIGMA_RESOLVED_TYPES = new Set(["BOOLEAN", "COLOR", "FLOAT", "STRING"]);
const FIGMA_SCOPES = new Set([
  "ALL_SCOPES",
  "TEXT_CONTENT",
  "CORNER_RADIUS",
  "WIDTH_HEIGHT",
  "GAP",
  "ALL_FILLS",
  "FRAME_FILL",
  "SHAPE_FILL",
  "TEXT_FILL",
  "STROKE_COLOR",
  "STROKE_FLOAT",
  "EFFECT_FLOAT",
  "EFFECT_COLOR",
  "OPACITY",
  "FONT_FAMILY",
  "FONT_STYLE",
  "FONT_WEIGHT",
  "FONT_SIZE",
  "LINE_HEIGHT",
  "LETTER_SPACING",
  "PARAGRAPH_SPACING",
  "PARAGRAPH_INDENT",
]);

export class TokenTransformError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "TokenTransformError";
    this.details = details;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertKnownFields(value, allowedFields, label) {
  if (!isObject(value)) {
    throw new TokenTransformError(`${label} must be an object.`);
  }

  const unknownFields = Object.keys(value).filter(
    (field) => !allowedFields.includes(field),
  );

  if (unknownFields.length > 0) {
    throw new TokenTransformError(
      `${label} contains unknown field${unknownFields.length === 1 ? "" : "s"}: ${unknownFields.join(", ")}.`,
    );
  }
}

function validateMatch(match, label) {
  assertKnownFields(
    match,
    ["paths", "types", "hasExtension", "withoutExtension"],
    label,
  );

  if (
    !Array.isArray(match.paths) ||
    match.paths.length === 0 ||
    match.paths.some((pattern) => typeof pattern !== "string" || pattern.trim() === "")
  ) {
    throw new TokenTransformError(`${label}.paths must contain non-empty patterns.`);
  }

  if (
    match.types !== undefined &&
    (!Array.isArray(match.types) ||
      match.types.length === 0 ||
      match.types.some((type) => typeof type !== "string" || type.trim() === ""))
  ) {
    throw new TokenTransformError(`${label}.types must contain non-empty token types.`);
  }

  for (const field of ["hasExtension", "withoutExtension"]) {
    if (
      match[field] !== undefined &&
      (typeof match[field] !== "string" || match[field].trim() === "")
    ) {
      throw new TokenTransformError(`${label}.${field} must be a non-empty string.`);
    }
  }
}

async function readJson(filePath) {
  let contents;

  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    throw new TokenTransformError(`Unable to read ${filePath}: ${error.message}`);
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new TokenTransformError(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

function flattenTokens(node, pathParts = [], inheritedType, tokens = []) {
  if (!isObject(node)) {
    return tokens;
  }

  const type = node.$type ?? inheritedType;

  if (Object.hasOwn(node, "$value")) {
    if (!type) {
      throw new TokenTransformError(
        `Token "${pathParts.join(".")}" does not define or inherit a $type.`,
      );
    }

    tokens.push({
      path: pathParts.join("."),
      pathParts,
      type,
      value: node.$value,
      description: node.$description,
      extensions: node.$extensions ?? {},
    });

    return tokens;
  }

  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$")) {
      continue;
    }

    flattenTokens(child, [...pathParts, key], type, tokens);
  }

  return tokens;
}

function matchSegments(pathParts, patternParts, pathIndex = 0, patternIndex = 0) {
  if (patternIndex === patternParts.length) {
    return pathIndex === pathParts.length;
  }

  const patternPart = patternParts[patternIndex];

  if (patternPart === "**") {
    return (
      matchSegments(pathParts, patternParts, pathIndex, patternIndex + 1) ||
      (pathIndex < pathParts.length &&
        matchSegments(pathParts, patternParts, pathIndex + 1, patternIndex))
    );
  }

  if (pathIndex >= pathParts.length) {
    return false;
  }

  if (patternPart !== "*" && patternPart !== pathParts[pathIndex]) {
    return false;
  }

  return matchSegments(pathParts, patternParts, pathIndex + 1, patternIndex + 1);
}

export function matchesPath(tokenPath, pattern) {
  return matchSegments(tokenPath.split("."), pattern.split("."));
}

function getExtension(extensions, extensionPath) {
  if (!isObject(extensions)) {
    return undefined;
  }

  const namespace = Object.keys(extensions)
    .filter((key) => extensionPath === key || extensionPath.startsWith(`${key}.`))
    .sort((left, right) => right.length - left.length)[0];

  if (!namespace) {
    return undefined;
  }

  const remainder = extensionPath.slice(namespace.length).replace(/^\./, "");
  let value = extensions[namespace];

  if (!remainder) {
    return value;
  }

  for (const segment of remainder.split(".")) {
    if (!isObject(value) || !Object.hasOwn(value, segment)) {
      return undefined;
    }

    value = value[segment];
  }

  return value;
}

function matchRule(token, match = {}) {
  const pathMatches = (match.paths ?? ["**"]).some((pattern) =>
    matchesPath(token.path, pattern),
  );
  const typeMatches = !match.types || match.types.includes(token.type);
  const extensionMatches =
    !match.hasExtension ||
    getExtension(token.extensions, match.hasExtension) !== undefined;
  const extensionAbsenceMatches =
    !match.withoutExtension ||
    getExtension(token.extensions, match.withoutExtension) === undefined;

  return pathMatches && typeMatches && extensionMatches && extensionAbsenceMatches;
}

function aliasTarget(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.match(ALIAS_PATTERN)?.[1];
}

function resolveToken(token, tokenByPath, stack = []) {
  const targetPath = aliasTarget(token.value);

  if (!targetPath) {
    return token;
  }

  if (stack.includes(token.path)) {
    throw new TokenTransformError(
      `Alias cycle detected: ${[...stack, token.path].join(" -> ")}`,
    );
  }

  const target = tokenByPath.get(targetPath);

  if (!target) {
    throw new TokenTransformError(
      `Token "${token.path}" references missing token "${targetPath}".`,
    );
  }

  const resolved = resolveToken(target, tokenByPath, [...stack, token.path]);

  if (token.type !== resolved.type) {
    throw new TokenTransformError(
      `Token "${token.path}" has type "${token.type}" but aliases "${targetPath}", which resolves to type "${resolved.type}".`,
    );
  }

  return resolved;
}

function assertDimension(value, tokenPath) {
  if (
    !isObject(value) ||
    typeof value.value !== "number" ||
    typeof value.unit !== "string"
  ) {
    throw new TokenTransformError(
      `Token "${tokenPath}" must contain a dimension with numeric value and unit.`,
    );
  }

  return value;
}

function rootFontSize(tokensDocument) {
  const defaults = getExtension(
    tokensDocument.$extensions,
    `${EXTENSION_NAMESPACE}.fluidDefaults`,
  );
  const value = defaults?.rootFontSize;

  if (!value || value.unit !== "px" || typeof value.value !== "number") {
    throw new TokenTransformError(
      "Fluid defaults must provide a numeric rootFontSize in px.",
    );
  }

  return value.value;
}

function dimensionToPixels(value, tokenPath, tokensDocument) {
  const dimension = assertDimension(value, tokenPath);
  const rule = unitRegistry.get(dimension.unit);

  if (!rule || rule.quantity !== "length") {
    throw new TokenTransformError(
      `Token "${tokenPath}" uses unknown or non-length unit "${dimension.unit}".`,
    );
  }

  const pxRequirements = rule.requirements.px ?? {};
  const context = Object.hasOwn(pxRequirements, "rootFontSize")
    ? { rootFontSize: rootFontSize(tokensDocument) }
    : {};
  const converted = unitRegistry.convert(
    dimension.value,
    rule.symbol,
    "px",
    context,
  );

  if (isUnsupportedConversion(converted)) {
    throw new TokenTransformError(
      `Token "${tokenPath}" cannot be converted to a Figma pixel value: ${converted.reason}`,
    );
  }

  return converted;
}

function round(value, precision) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function referencePath(reference, label) {
  const targetPath = aliasTarget(reference);

  if (!targetPath) {
    throw new TokenTransformError(`${label} must be a token reference.`);
  }

  return targetPath;
}

function resolveDimensionReference(reference, tokenByPath, tokensDocument, label) {
  const targetPath = referencePath(reference, label);
  const target = tokenByPath.get(targetPath);

  if (!target) {
    throw new TokenTransformError(`${label} references missing token "${targetPath}".`);
  }

  const resolved = resolveToken(target, tokenByPath);
  return dimensionToPixels(resolved.value, targetPath, tokensDocument);
}

export function interpolateFluidValue({
  minValue,
  maxValue,
  minViewport,
  maxViewport,
  viewport,
  precision = 2,
}) {
  if (maxViewport <= minViewport) {
    throw new TokenTransformError(
      "Fluid maxViewport must be greater than minViewport.",
    );
  }

  const progress = Math.min(
    1,
    Math.max(0, (viewport - minViewport) / (maxViewport - minViewport)),
  );

  return round(minValue + (maxValue - minValue) * progress, precision);
}

function fluidValues(token, config, tokenByPath, tokensDocument) {
  const defaults = getExtension(
    tokensDocument.$extensions,
    `${EXTENSION_NAMESPACE}.fluidDefaults`,
  );
  const overrides =
    getExtension(token.extensions, `${EXTENSION_NAMESPACE}.fluid`) ?? {};
  const strategy = overrides.strategy ?? defaults?.strategy;

  if (strategy !== "linear") {
    throw new TokenTransformError(
      `Token "${token.path}" uses unsupported fluid strategy "${strategy}".`,
    );
  }

  const minViewportReference = overrides.minViewport ?? defaults?.minViewport;
  const maxViewportReference = overrides.maxViewport ?? defaults?.maxViewport;

  const minViewport = resolveDimensionReference(
    minViewportReference,
    tokenByPath,
    tokensDocument,
    `Fluid minViewport for "${token.path}"`,
  );
  const maxViewport = resolveDimensionReference(
    maxViewportReference,
    tokenByPath,
    tokensDocument,
    `Fluid maxViewport for "${token.path}"`,
  );
  const minValue = dimensionToPixels(token.value, token.path, tokensDocument);
  const maxValue = dimensionToPixels(overrides.max, token.path, tokensDocument);

  return Object.fromEntries(
    config.fluid.modes.map((mode) => {
      const viewport = resolveDimensionReference(
        mode.breakpoint,
        tokenByPath,
        tokensDocument,
        `Fluid mode "${mode.name}"`,
      );

      return [
        mode.name,
        interpolateFluidValue({
          minValue,
          maxValue,
          minViewport,
          maxViewport,
          viewport,
          precision: config.fluid.precision,
        }),
      ];
    }),
  );
}

function colorToSrgb(value, tokenPath) {
  if (
    !isObject(value) ||
    value.colorSpace !== "oklch" ||
    !Array.isArray(value.components) ||
    value.components.length !== 3
  ) {
    throw new TokenTransformError(
      `Token "${tokenPath}" must contain an OKLCH color value.`,
    );
  }

  const [l, c, h] = value.components;
  const alpha = value.alpha ?? 1;

  if (![l, c, h, alpha].every((component) => typeof component === "number")) {
    throw new TokenTransformError(
      `Token "${tokenPath}" contains non-numeric OKLCH components.`,
    );
  }

  const toSrgbGamut = toGamut("rgb", "oklch");
  const rgb = toSrgbGamut({ mode: "oklch", l, c, h, alpha });

  if (!rgb) {
    throw new TokenTransformError(`Unable to convert color token "${tokenPath}".`);
  }

  return rgb;
}

function colorToHex(value, tokenPath) {
  const rgb = colorToSrgb(value, tokenPath);
  return (rgb.alpha ?? 1) < 1 ? formatHex8(rgb) : formatHex(rgb);
}

function colorToFigmaRgba(value, tokenPath) {
  const rgb = colorToSrgb(value, tokenPath);
  return {
    r: round(rgb.r, 4),
    g: round(rgb.g, 4),
    b: round(rgb.b, 4),
    a: round(rgb.alpha ?? 1, 4),
  };
}

function shadowEffects(token, tokenByPath, tokensDocument) {
  const resolved = resolveToken(token, tokenByPath);
  const layers = Array.isArray(resolved.value) ? resolved.value : [resolved.value];

  if (layers.length === 0) {
    throw new TokenTransformError(
      `Token "${token.path}" must contain at least one shadow layer.`,
    );
  }

  return layers.map((layer, index) => {
    const layerPath = `${token.path}[${index}]`;
    const fields = ["color", "offsetX", "offsetY", "blur", "spread"];

    if (
      !isObject(layer) ||
      fields.some((field) => !Object.hasOwn(layer, field))
    ) {
      throw new TokenTransformError(
        `Token "${layerPath}" must contain a complete shadow value.`,
      );
    }

    return {
      type: "DROP_SHADOW",
      color: colorToFigmaRgba(layer.color, `${layerPath}.color`),
      offset: {
        x: dimensionToPixels(layer.offsetX, `${layerPath}.offsetX`, tokensDocument),
        y: dimensionToPixels(layer.offsetY, `${layerPath}.offsetY`, tokensDocument),
      },
      radius: dimensionToPixels(layer.blur, `${layerPath}.blur`, tokensDocument),
      spread: dimensionToPixels(layer.spread, `${layerPath}.spread`, tokensDocument),
      visible: true,
      blendMode: "NORMAL",
    };
  });
}

function convertValue(token, rule, tokenByPath, tokensDocument) {
  const resolved = resolveToken(token, tokenByPath);
  const value = resolved.value;

  switch (rule.type) {
    case "COLOR":
      return colorToHex(value, token.path);
    case "FLOAT":
      if (token.type === "dimension") {
        return dimensionToPixels(value, token.path, tokensDocument);
      }

      if (typeof value !== "number") {
        throw new TokenTransformError(
          `Token "${token.path}" must resolve to a numeric Figma FLOAT value.`,
        );
      }

      return value;
    case "STRING":
      if (Array.isArray(value)) {
        if (typeof value[0] !== "string") {
          throw new TokenTransformError(
            `Token "${token.path}" has an invalid font-family stack.`,
          );
        }

        return value[0];
      }

      if (typeof value !== "string") {
        throw new TokenTransformError(
          `Token "${token.path}" must resolve to a string.`,
        );
      }

      return value;
    case "BOOLEAN":
      if (typeof value !== "boolean") {
        throw new TokenTransformError(
          `Token "${token.path}" must resolve to a boolean.`,
        );
      }

      return value;
    default:
      throw new TokenTransformError(
        `Rule for "${token.path}" has unsupported Figma type "${rule.type}".`,
      );
  }
}

function kebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function variableName(token, naming) {
  return token.pathParts.map(kebabCase).join(naming.separator);
}

function classifyTokens(tokens, config) {
  return tokens.map((token) => {
    const exclusion = config.exclusions.find((candidate) =>
      matchRule(token, candidate.match),
    );

    if (exclusion) {
      return { token, exclusion };
    }

    const matches = [];

    for (const collection of config.collections) {
      for (const rule of collection.rules) {
        if (matchRule(token, rule.match)) {
          matches.push({ kind: "variable", collection, rule });
        }
      }
    }

    for (const rule of config.styles?.effects ?? []) {
      if (matchRule(token, rule.match)) {
        matches.push({ kind: "effectStyle", rule });
      }
    }

    if (matches.length === 0) {
      throw new TokenTransformError(
        `Token "${token.path}" does not match a variable rule, style rule, or exclusion.`,
      );
    }

    if (matches.length > 1) {
      throw new TokenTransformError(
        `Token "${token.path}" matches multiple Figma routing rules.`,
      );
    }

    return { token, ...matches[0] };
  });
}

function validateAliases(tokens, tokenByPath) {
  for (const token of tokens) {
    if (aliasTarget(token.value)) {
      resolveToken(token, tokenByPath);
    }
  }
}

function validateConfig(config) {
  assertKnownFields(
    config,
    [
      "$schemaVersion",
      "$description",
      "source",
      "output",
      "artifact",
      "naming",
      "fluid",
      "collections",
      "styles",
      "exclusions",
    ],
    "Figma config",
  );

  if (config.$schemaVersion !== FIGMA_CONFIG_VERSION) {
    throw new TokenTransformError(
      `Unsupported Figma config version "${config.$schemaVersion}". Supported version: ${FIGMA_CONFIG_VERSION}.`,
    );
  }

  for (const field of ["source", "output"]) {
    if (typeof config[field] !== "string" || config[field].trim() === "") {
      throw new TokenTransformError(`Figma config ${field} must be a non-empty path.`);
    }
  }

  assertKnownFields(config.artifact, ["format", "version"], "Figma config artifact");
  for (const field of ["format", "version"]) {
    if (
      typeof config.artifact[field] !== "string" ||
      config.artifact[field].trim() === ""
    ) {
      throw new TokenTransformError(`Figma config artifact.${field} must be a non-empty string.`);
    }
  }

  assertKnownFields(config.naming, ["separator"], "Figma config naming");
  if (typeof config.naming.separator !== "string" || config.naming.separator === "") {
    throw new TokenTransformError("Figma config naming.separator must be a non-empty string.");
  }

  assertKnownFields(config.fluid, ["precision", "modes"], "Figma config fluid");
  if (!Number.isInteger(config.fluid.precision) || config.fluid.precision < 0) {
    throw new TokenTransformError("Figma config fluid.precision must be a non-negative integer.");
  }
  if (!Array.isArray(config.fluid.modes)) {
    throw new TokenTransformError("Figma config fluid.modes must be an array.");
  }

  const fluidModes = config.fluid.modes.map((mode, index) => {
    const label = `Figma config fluid.modes[${index}]`;
    assertKnownFields(mode, ["name", "breakpoint"], label);
    if (typeof mode.name !== "string" || mode.name.trim() === "") {
      throw new TokenTransformError("Fluid mode names must be non-empty strings.");
    }
    if (typeof mode.breakpoint !== "string" || !aliasTarget(mode.breakpoint)) {
      throw new TokenTransformError(`${label}.breakpoint must be a token reference.`);
    }
    return mode.name;
  });

  if (new Set(fluidModes).size !== fluidModes.length) {
    throw new TokenTransformError("Fluid mode names must be unique.");
  }

  if (!Array.isArray(config.collections) || config.collections.length === 0) {
    throw new TokenTransformError("Figma config must define at least one collection.");
  }

  const collectionNames = config.collections.map((collection) => collection?.name);
  if (collectionNames.some((name) => typeof name !== "string" || name.trim() === "")) {
    throw new TokenTransformError("Figma collection names must be non-empty strings.");
  }
  if (new Set(collectionNames).size !== collectionNames.length) {
    throw new TokenTransformError("Figma collection names must be unique.");
  }

  for (const [collectionIndex, collection] of config.collections.entries()) {
    const collectionLabel = `Figma config collections[${collectionIndex}]`;
    assertKnownFields(collection, ["name", "modes", "rules"], collectionLabel);

    if (
      !Array.isArray(collection.modes) ||
      collection.modes.length === 0 ||
      collection.modes.some((name) => typeof name !== "string" || name.trim() === "")
    ) {
      throw new TokenTransformError(
        `Collection "${collection.name}" modes must be non-empty strings.`,
      );
    }
    if (new Set(collection.modes).size !== collection.modes.length) {
      throw new TokenTransformError(
        `Collection "${collection.name}" contains duplicate modes.`,
      );
    }
    if (!Array.isArray(collection.rules) || collection.rules.length === 0) {
      throw new TokenTransformError(
        `Collection "${collection.name}" must define at least one rule.`,
      );
    }

    for (const [ruleIndex, rule] of collection.rules.entries()) {
      const ruleLabel = `${collectionLabel}.rules[${ruleIndex}]`;
      assertKnownFields(rule, ["match", "type", "scopes", "values"], ruleLabel);
      validateMatch(rule.match, `${ruleLabel}.match`);

      if (!FIGMA_RESOLVED_TYPES.has(rule.type)) {
        throw new TokenTransformError(
          `Collection "${collection.name}" has unsupported Figma type "${rule.type}".`,
        );
      }
      if (
        !Array.isArray(rule.scopes) ||
        rule.scopes.length === 0 ||
        rule.scopes.some((scope) => !FIGMA_SCOPES.has(scope))
      ) {
        throw new TokenTransformError(
          `Collection "${collection.name}" rule for ${rule.type} contains unsupported or empty scopes.`,
        );
      }
      if (rule.values !== undefined && !["duplicate", "fluid"].includes(rule.values)) {
        throw new TokenTransformError(
          `${ruleLabel}.values must be either "duplicate" or "fluid".`,
        );
      }
    }

    const hasFluidRule = collection.rules.some(({ values }) => values === "fluid");
    if (
      hasFluidRule &&
      JSON.stringify(collection.modes) !== JSON.stringify(fluidModes)
    ) {
      throw new TokenTransformError(
        `Collection "${collection.name}" modes must match the fluid mode configuration.`,
      );
    }
  }

  if (config.styles !== undefined) {
    assertKnownFields(config.styles, ["effects"], "Figma config styles");
    if (!Array.isArray(config.styles.effects) || config.styles.effects.length === 0) {
      throw new TokenTransformError(
        "Figma config styles.effects must contain at least one rule.",
      );
    }
    config.styles.effects.forEach((rule, index) => {
      const label = `Figma config styles.effects[${index}]`;
      assertKnownFields(rule, ["match"], label);
      validateMatch(rule.match, `${label}.match`);
    });
  }

  if (!Array.isArray(config.exclusions)) {
    throw new TokenTransformError("Figma config exclusions must be an array.");
  }
  config.exclusions.forEach((exclusion, index) => {
    const label = `Figma config exclusions[${index}]`;
    assertKnownFields(exclusion, ["match", "reason", "futureTarget"], label);
    validateMatch(exclusion.match, `${label}.match`);
    if (typeof exclusion.reason !== "string" || exclusion.reason.trim() === "") {
      throw new TokenTransformError(`${label}.reason must be a non-empty string.`);
    }
    if (
      exclusion.futureTarget !== undefined &&
      (typeof exclusion.futureTarget !== "string" || exclusion.futureTarget.trim() === "")
    ) {
      throw new TokenTransformError(`${label}.futureTarget must be a non-empty string.`);
    }
  });
}

function createArtifact(tokensDocument, config, sourcePath, outputPath) {
  const tokens = flattenTokens(tokensDocument);
  const tokenByPath = new Map(tokens.map((token) => [token.path, token]));

  if (tokenByPath.size !== tokens.length) {
    throw new TokenTransformError("Duplicate source token paths detected.");
  }

  validateAliases(tokens, tokenByPath);

  const classifications = classifyTokens(tokens, config);
  const includedPaths = new Set(
    classifications
      .filter(({ collection }) => collection)
      .map(({ token }) => token.path),
  );
  const collectionOutput = config.collections.map((collection) => ({
    name: collection.name,
    modes: collection.modes.map((name) => ({ name })),
    variables: [],
  }));
  const outputByCollection = new Map(
    collectionOutput.map((collection) => [collection.name, collection]),
  );

  for (const classification of classifications) {
    const { token, collection, rule } = classification;

    if (!collection) {
      continue;
    }

    const targetPath = aliasTarget(token.value);
    const preserveAlias = targetPath && includedPaths.has(targetPath);
    const valuesByMode =
      rule.values === "fluid"
        ? fluidValues(token, config, tokenByPath, tokensDocument)
        : Object.fromEntries(
            collection.modes.map((mode) => [
              mode,
              convertValue(token, rule, tokenByPath, tokensDocument),
            ]),
          );

    const variable = {
      name: variableName(token, config.naming),
      sourcePath: token.path,
      resolvedType: rule.type,
      scopes: rule.scopes,
      valuesByMode,
      source: {
        type: token.type,
      },
    };

    if (token.description) {
      variable.description = token.description;
    }

    if (preserveAlias) {
      variable.aliasOf = targetPath;
    }

    outputByCollection.get(collection.name).variables.push(variable);
  }

  const variableBySourcePath = new Map(
    collectionOutput.flatMap((collection) =>
      collection.variables.map((variable) => [variable.sourcePath, variable]),
    ),
  );
  const aliasDepth = (variable, stack = []) => {
    if (!variable.aliasOf) {
      return 0;
    }

    if (stack.includes(variable.sourcePath)) {
      throw new TokenTransformError(
        `Generated alias cycle detected: ${[...stack, variable.sourcePath].join(" -> ")}`,
      );
    }

    const target = variableBySourcePath.get(variable.aliasOf);
    return target ? 1 + aliasDepth(target, [...stack, variable.sourcePath]) : 1;
  };

  for (const collection of collectionOutput) {
    collection.variables.sort(
      (left, right) =>
        aliasDepth(left) - aliasDepth(right) || left.name.localeCompare(right.name),
    );

    const names = collection.variables.map(({ name }) => name);
    if (new Set(names).size !== names.length) {
      throw new TokenTransformError(
        `Collection "${collection.name}" contains duplicate variable names.`,
      );
    }
  }

  const effectStyles = classifications
    .filter(({ kind }) => kind === "effectStyle")
    .map(({ token }) => ({
      name: variableName(token, config.naming),
      sourcePath: token.path,
      effects: shadowEffects(token, tokenByPath, tokensDocument),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const effectStyleNames = effectStyles.map(({ name }) => name);

  if (new Set(effectStyleNames).size !== effectStyleNames.length) {
    throw new TokenTransformError("Generated Figma effect styles contain duplicate names.");
  }

  const excluded = classifications
    .filter(({ exclusion }) => exclusion)
    .map(({ token, exclusion }) => ({
      sourcePath: token.path,
      reason: exclusion.reason,
      ...(exclusion.futureTarget
        ? { futureTarget: exclusion.futureTarget }
        : {}),
    }))
    .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));

  const generatedAt = getExtension(
    tokensDocument.$extensions,
    `${EXTENSION_NAMESPACE}.generatedAt`,
  );

  return {
    $schemaVersion: config.artifact.version,
    format: config.artifact.format,
    ...(typeof generatedAt === "string" ? { generatedAt } : {}),
    source: path.relative(path.dirname(outputPath), sourcePath),
    collections: collectionOutput,
    styles: {
      effects: effectStyles,
    },
    excluded,
    summary: {
      sourceTokens: tokens.length,
      variables: collectionOutput.reduce(
        (total, collection) => total + collection.variables.length,
        0,
      ),
      effectStyles: effectStyles.length,
      excluded: excluded.length,
    },
  };
}

export async function transformFigmaTokens({
  configPath,
  sourcePath: sourceOverride,
  outputPath: outputOverride,
  write = true,
  check = false,
}) {
  const absoluteConfigPath = path.resolve(configPath);
  const config = await readJson(absoluteConfigPath);
  validateConfig(config);
  const configDirectory = path.dirname(absoluteConfigPath);
  const sourcePath = path.resolve(
    sourceOverride ?? path.resolve(configDirectory, config.source),
  );
  const outputPath = path.resolve(
    outputOverride ?? path.resolve(configDirectory, config.output),
  );
  const tokensDocument = await readJson(sourcePath);
  const artifact = createArtifact(
    tokensDocument,
    config,
    sourcePath,
    outputPath,
  );

  if (check) {
    let current;

    try {
      current = await readFile(outputPath, "utf8");
    } catch (error) {
      throw new TokenTransformError(
        `Figma token artifact is missing at ${outputPath}. Run the Figma build first.`,
      );
    }

    let currentArtifact;

    try {
      currentArtifact = JSON.parse(current);
    } catch (error) {
      throw new TokenTransformError(
        `Figma token artifact at ${outputPath} is invalid JSON: ${error.message}`,
      );
    }

    if (
      !isObject(currentArtifact) ||
      !isDeepStrictEqual(currentArtifact, artifact)
    ) {
      throw new TokenTransformError(
        `${outputPath} is stale. Rebuild the Figma token artifact.`,
      );
    }
  } else if (write) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  }

  return { artifact, config, sourcePath, outputPath };
}
