import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { parse as parseColor } from "culori";
import { parseDocument } from "yaml";
import { TokenTransformError } from "./figma-transformer.js";
import { parseNumericUnit, unitRegistry } from "./rules/index.js";

const ALIAS_PATTERN = /^\{([^{}]+)\}$/;
const EXTENSION_NAMESPACE = "com.avenue.tokens";
const EXPRESSION_OPERATORS = new Set(["min", "max", "calc", "round", "mod"]);
const SOURCE_CONFIG_VERSION = "2.0.0";
const SOURCE_TOKEN_TYPES = new Set([
  "color",
  "dimension",
  "duration",
  "fontFamily",
  "fontWeight",
  "number",
  "shadow",
]);

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

function validateBehavior(behavior, label) {
  if (behavior === undefined) {
    return;
  }

  if (typeof behavior === "string") {
    if (behavior !== "fluidDimension") {
      throw new TokenTransformError(`${label} uses unsupported behavior "${behavior}".`);
    }
    return;
  }

  assertKnownFields(
    behavior,
    behavior?.name === "percentage"
      ? ["name", "responsive"]
      : ["name", "strategy", "available"],
    label,
  );

  if (behavior.name === "percentage") {
    if (typeof behavior.responsive !== "boolean") {
      throw new TokenTransformError(`${label}.responsive must be a boolean.`);
    }
    return;
  }

  if (
    behavior.name !== "responsiveDimension" ||
    typeof behavior.strategy !== "string" ||
    typeof behavior.available !== "string"
  ) {
    throw new TokenTransformError(
      `${label} must define a supported behavior and its required fields.`,
    );
  }
}

function validateSourceConfig(schema) {
  assertKnownFields(
    schema,
    ["$schemaVersion", "$description", "output", "settings", "sources"],
    "Source config",
  );

  if (schema.$schemaVersion !== SOURCE_CONFIG_VERSION) {
    throw new TokenTransformError(
      `Unsupported source config version "${schema.$schemaVersion}". Supported version: ${SOURCE_CONFIG_VERSION}.`,
    );
  }

  if (typeof schema.output !== "string" || schema.output.trim() === "") {
    throw new TokenTransformError("Source config output must be a non-empty path.");
  }

  assertKnownFields(schema.settings, ["source"], "Source config settings");
  if (typeof schema.settings.source !== "string" || schema.settings.source.trim() === "") {
    throw new TokenTransformError("Source config settings.source must be a non-empty path.");
  }

  if (!Array.isArray(schema.sources) || schema.sources.length === 0) {
    throw new TokenTransformError("Source config must define at least one source.");
  }

  schema.sources.forEach((source, sourceIndex) => {
    const sourceLabel = `Source config sources[${sourceIndex}]`;
    assertKnownFields(source, ["file", "mappings"], sourceLabel);

    if (typeof source.file !== "string" || source.file.trim() === "") {
      throw new TokenTransformError(`${sourceLabel}.file must be a non-empty path.`);
    }
    if (!Array.isArray(source.mappings) || source.mappings.length === 0) {
      throw new TokenTransformError(`${sourceLabel}.mappings must not be empty.`);
    }

    source.mappings.forEach((mapping, mappingIndex) => {
      const mappingLabel = `${sourceLabel}.mappings[${mappingIndex}]`;
      assertKnownFields(
        mapping,
        ["group", "namespace", "type", "behavior", "overrides"],
        mappingLabel,
      );

      for (const field of ["group", "namespace"]) {
        if (typeof mapping[field] !== "string" || mapping[field].trim() === "") {
          throw new TokenTransformError(`${mappingLabel}.${field} must be a non-empty string.`);
        }
      }
      if (!SOURCE_TOKEN_TYPES.has(mapping.type)) {
        throw new TokenTransformError(
          `${mappingLabel} uses unsupported token type "${mapping.type}".`,
        );
      }
      validateBehavior(mapping.behavior, `${mappingLabel}.behavior`);

      if (mapping.overrides !== undefined && !Array.isArray(mapping.overrides)) {
        throw new TokenTransformError(`${mappingLabel}.overrides must be an array.`);
      }
      mapping.overrides?.forEach((override, overrideIndex) => {
        const overrideLabel = `${mappingLabel}.overrides[${overrideIndex}]`;
        assertKnownFields(override, ["path", "type", "behavior"], overrideLabel);
        if (typeof override.path !== "string" || override.path.trim() === "") {
          throw new TokenTransformError(`${overrideLabel}.path must be a non-empty string.`);
        }
        if (!SOURCE_TOKEN_TYPES.has(override.type)) {
          throw new TokenTransformError(
            `${overrideLabel} uses unsupported token type "${override.type}".`,
          );
        }
        validateBehavior(override.behavior, `${overrideLabel}.behavior`);
      });
    });
  });
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new TokenTransformError(`Unable to read source schema ${filePath}: ${error.message}`);
  }
}

async function readYaml(filePath) {
  let contents;

  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    throw new TokenTransformError(`Unable to read ${filePath}: ${error.message}`);
  }

  const document = parseDocument(contents, {
    prettyErrors: true,
    strict: true,
    uniqueKeys: true,
  });

  if (document.errors.length > 0) {
    throw new TokenTransformError(
      `Invalid YAML in ${filePath}:\n${document.errors.map(({ message }) => message).join("\n")}`,
    );
  }

  const value = document.toJS();

  if (!isObject(value)) {
    throw new TokenTransformError(`${filePath} must contain a YAML object.`);
  }

  return value;
}

function parseRegisteredUnit(value, tokenPath, quantity, label, example) {
  if (typeof value !== "string") {
    throw new TokenTransformError(
      `${tokenPath} must be a ${label} such as ${example}.`,
    );
  }

  try {
    return parseNumericUnit(value, {
      registry: unitRegistry,
      expectedQuantity: quantity,
    });
  } catch (error) {
    const supported = unitRegistry
      .byQuantity(quantity)
      .map((rule) => [rule.symbol, ...rule.aliases].join("/"))
      .join(", ");
    throw new TokenTransformError(
      `${tokenPath} has invalid ${label} ${JSON.stringify(value)}. ${error.message} Supported units: ${supported}.`,
    );
  }
}

function parseDimension(value, tokenPath) {
  return parseRegisteredUnit(value, tokenPath, "length", "dimension", "1rem or 16px");
}

function parseDuration(value, tokenPath) {
  return parseRegisteredUnit(value, tokenPath, "time", "duration", "150ms or 1s");
}

function parseOklch(value, tokenPath) {
  if (typeof value !== "string") {
    throw new TokenTransformError(`${tokenPath} must be an oklch() color string.`);
  }

  const parsed = parseColor(value);

  if (!parsed || parsed.mode !== "oklch") {
    throw new TokenTransformError(
      `${tokenPath} has invalid color "${value}". Expected oklch(...).`,
    );
  }

  return {
    colorSpace: "oklch",
    components: [parsed.l, parsed.c, parsed.h ?? 0],
    alpha: parsed.alpha ?? 1,
  };
}

function isAlias(value) {
  return typeof value === "string" && ALIAS_PATTERN.test(value);
}

function isExpression(value) {
  return (
    isObject(value) &&
    typeof value.operator === "string" &&
    EXPRESSION_OPERATORS.has(value.operator)
  );
}

function assertNoExpression(value, tokenPath) {
  if (isExpression(value)) {
    throw new TokenTransformError(
      `${tokenPath} uses reserved expression operator "${value.operator}". Expression syntax is reserved but not implemented yet.`,
    );
  }
}

function compileShadowLayer(value, tokenPath) {
  const fields = ["color", "offsetX", "offsetY", "blur", "spread"];

  if (!isObject(value)) {
    throw new TokenTransformError(`${tokenPath} must be a shadow object.`);
  }

  const missing = fields.filter((field) => !Object.hasOwn(value, field));
  const additional = Object.keys(value).filter((field) => !fields.includes(field));

  if (missing.length > 0 || additional.length > 0) {
    throw new TokenTransformError(
      `${tokenPath} must define exactly color, offsetX, offsetY, blur, and spread.`,
    );
  }

  return {
    color: parseOklch(value.color, `${tokenPath}.color`),
    offsetX: parseDimension(value.offsetX, `${tokenPath}.offsetX`),
    offsetY: parseDimension(value.offsetY, `${tokenPath}.offsetY`),
    blur: parseDimension(value.blur, `${tokenPath}.blur`),
    spread: parseDimension(value.spread, `${tokenPath}.spread`),
  };
}

function compileShadow(value, tokenPath) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new TokenTransformError(`${tokenPath} must contain at least one shadow layer.`);
    }

    return value.map((layer, index) =>
      compileShadowLayer(layer, `${tokenPath}[${index}]`),
    );
  }

  return compileShadowLayer(value, tokenPath);
}

function compilePrimitive(value, tokenType, tokenPath) {
  assertNoExpression(value, tokenPath);

  if (isAlias(value)) {
    return value;
  }

  switch (tokenType) {
    case "dimension":
      return parseDimension(value, tokenPath);
    case "duration":
      return parseDuration(value, tokenPath);
    case "color":
      return parseOklch(value, tokenPath);
    case "number":
    case "fontWeight":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new TokenTransformError(`${tokenPath} must be a finite number.`);
      }
      return value;
    case "fontFamily":
      if (
        !Array.isArray(value) ||
        value.length === 0 ||
        !value.every((family) => typeof family === "string")
      ) {
        throw new TokenTransformError(
          `${tokenPath} must be a non-empty font-family list.`,
        );
      }
      return value;
    case "shadow":
      return compileShadow(value, tokenPath);
    default:
      throw new TokenTransformError(
        `${tokenPath} uses unsupported source token type "${tokenType}".`,
      );
  }
}

function relativePath(pathParts) {
  return pathParts.join(".");
}

function overrideFor(mapping, pathParts) {
  const currentPath = relativePath(pathParts);
  return mapping.overrides?.find(({ path: overridePath }) => overridePath === currentPath);
}

function addBehaviorExtensions(token, behavior) {
  if (behavior?.name !== "percentage") {
    return;
  }

  token.$extensions = {
    [EXTENSION_NAMESPACE]: {
      percentage: true,
      responsive: behavior.responsive,
    },
  };
}

export function compileAuthorValue(value, {
  tokenType,
  behavior,
  tokenPath,
  explicitType = false,
}) {
  assertNoExpression(value, tokenPath);

  const token = {};

  if (explicitType) {
    token.$type = tokenType;
  }

  if (behavior === "fluidDimension" && isObject(value)) {
    const hasMin = Object.hasOwn(value, "min");
    const hasMax = Object.hasOwn(value, "max");

    if (hasMin || hasMax) {
      const keys = Object.keys(value);

      if (!hasMin || !hasMax || keys.some((key) => !["min", "max"].includes(key))) {
        throw new TokenTransformError(
          `${tokenPath} must be a static dimension or a fluid object containing exactly min and max.`,
        );
      }

      token.$value = parseDimension(value.min, `${tokenPath}.min`);
      token.$extensions = {
        [EXTENSION_NAMESPACE]: {
          fluid: {
            max: parseDimension(value.max, `${tokenPath}.max`),
          },
        },
      };
      return token;
    }
  }

  token.$value = compilePrimitive(value, tokenType, tokenPath);
  addBehaviorExtensions(token, behavior);
  return token;
}

function isTokenLeaf(value, tokenType, behavior) {
  if (!isObject(value)) {
    return true;
  }

  if (isExpression(value)) {
    return true;
  }

  if (
    behavior === "fluidDimension" &&
    (Object.hasOwn(value, "min") || Object.hasOwn(value, "max"))
  ) {
    return true;
  }

  return tokenType === "shadow";
}

function validateAuthorPathSegment(segment, mapping, pathParts) {
  const fullPath = [mapping.namespace, ...pathParts, segment].join(".");

  if (
    segment.length === 0 ||
    segment.startsWith("$") ||
    /[.{}]/.test(segment)
  ) {
    throw new TokenTransformError(
      `Invalid author path segment ${JSON.stringify(segment)} in full path "${fullPath}". Segments must be non-empty, must not begin with $, and must not contain dots or braces.`,
    );
  }
}

function compileGroup(sourceGroup, mapping, pathParts = []) {
  if (!isObject(sourceGroup)) {
    throw new TokenTransformError(
      `${mapping.group} must contain a map of token names and values.`,
    );
  }

  const group = {};

  if (pathParts.length === 0) {
    group.$type = mapping.type;

    if (isObject(mapping.behavior) && mapping.behavior.name === "responsiveDimension") {
      group.$extensions = {
        [EXTENSION_NAMESPACE]: {
          responsive: {
            strategy: mapping.behavior.strategy,
            available: mapping.behavior.available,
          },
        },
      };
    }
  }

  for (const [name, value] of Object.entries(sourceGroup)) {
    validateAuthorPathSegment(name, mapping, pathParts);
    const childPathParts = [...pathParts, name];
    const tokenPath = `${mapping.namespace}.${relativePath(childPathParts)}`;
    const override = overrideFor(mapping, childPathParts);
    const tokenType = override?.type ?? mapping.type;
    const behavior = override?.behavior ?? mapping.behavior;

    if (isTokenLeaf(value, tokenType, behavior)) {
      group[name] = compileAuthorValue(value, {
        tokenType,
        behavior,
        tokenPath,
        explicitType: tokenType !== mapping.type,
      });
    } else {
      group[name] = compileGroup(value, mapping, childPathParts);
    }
  }

  return group;
}

function setFluidSettings(canonical, settings) {
  const rootFontSize = parseDimension(settings.rootFontSize, "settings.rootFontSize");
  const fluid = settings.fluid;

  if (
    !isObject(fluid) ||
    typeof fluid.strategy !== "string" ||
    !isAlias(fluid.minBreakpoint) ||
    !isAlias(fluid.maxBreakpoint)
  ) {
    throw new TokenTransformError(
      "settings.fluid must define strategy and aliased minBreakpoint/maxBreakpoint values.",
    );
  }

  canonical.$extensions = {
    [EXTENSION_NAMESPACE]: {
      generatedAt: new Date().toISOString(),
      fluidDefaults: {
        strategy: fluid.strategy,
        minViewport: fluid.minBreakpoint,
        maxViewport: fluid.maxBreakpoint,
        rootFontSize,
      },
    },
  };
}

function validateKnownGroups(document, knownGroups, filePath) {
  const unknown = Object.keys(document).filter((key) => !knownGroups.includes(key));

  if (unknown.length > 0) {
    throw new TokenTransformError(
      `${filePath} contains unmapped group${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`,
    );
  }
}

function flattenCanonical(node, pathParts = [], inheritedType, tokens = []) {
  if (!isObject(node)) {
    return tokens;
  }

  const type = node.$type ?? inheritedType;

  if (Object.hasOwn(node, "$value")) {
    tokens.push({ path: pathParts.join("."), type, value: node.$value });
    return tokens;
  }

  for (const [key, value] of Object.entries(node)) {
    if (!key.startsWith("$")) {
      flattenCanonical(value, [...pathParts, key], type, tokens);
    }
  }

  return tokens;
}

function validateGeneratedAt(canonical, outputPath) {
  const generatedAt = canonical?.$extensions?.[EXTENSION_NAMESPACE]?.generatedAt;
  const isoUtcPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  if (
    typeof generatedAt !== "string" ||
    !isoUtcPattern.test(generatedAt) ||
    Number.isNaN(Date.parse(generatedAt)) ||
    new Date(generatedAt).toISOString() !== generatedAt
  ) {
    throw new TokenTransformError(
      `Canonical token file at ${outputPath} must contain a generatedAt value in strict ISO UTC format.`,
    );
  }
}

function comparableCanonical(canonical) {
  const comparable = structuredClone(canonical);
  delete comparable.$extensions[EXTENSION_NAMESPACE].generatedAt;
  return comparable;
}

function validateCanonical(canonical) {
  const tokens = flattenCanonical(canonical);
  const byPath = new Map(tokens.map((token) => [token.path, token]));

  if (byPath.size !== tokens.length) {
    throw new TokenTransformError("Generated canonical tokens contain duplicate paths.");
  }

  const resolve = (token, stack = []) => {
    const targetPath =
      typeof token.value === "string" ? token.value.match(ALIAS_PATTERN)?.[1] : undefined;

    if (!targetPath) {
      return token;
    }

    if (stack.includes(token.path)) {
      throw new TokenTransformError(
        `Generated alias cycle: ${[...stack, token.path].join(" -> ")}.`,
      );
    }

    const target = byPath.get(targetPath);

    if (!target) {
      throw new TokenTransformError(
        `${token.path} references missing token ${targetPath}.`,
      );
    }

    const resolved = resolve(target, [...stack, token.path]);

    if (token.type !== resolved.type) {
      throw new TokenTransformError(
        `${token.path} has type "${token.type}" but aliases ${targetPath}, which resolves to type "${resolved.type}".`,
      );
    }

    return resolved;
  };

  tokens.forEach((token) => resolve(token));
  return tokens.length;
}

export async function compileSourceTokens({
  schemaPath,
  outputPath: outputOverride,
  write = true,
  check = false,
}) {
  const absoluteSchemaPath = path.resolve(schemaPath);
  const schema = await readJson(absoluteSchemaPath);
  validateSourceConfig(schema);
  const schemaDirectory = path.dirname(absoluteSchemaPath);
  const outputPath = path.resolve(
    outputOverride ?? path.resolve(schemaDirectory, schema.output),
  );
  const settingsPath = path.resolve(schemaDirectory, schema.settings.source);
  const settings = await readYaml(settingsPath);
  const canonical = {
    $description:
      "Avenue design tokens. Generated from designer-readable YAML sources.",
  };

  validateKnownGroups(settings, ["rootFontSize", "fluid"], settingsPath);
  setFluidSettings(canonical, settings);

  for (const source of schema.sources) {
    const sourcePath = path.resolve(schemaDirectory, source.file);
    const document = await readYaml(sourcePath);
    const groups = source.mappings.map(({ group }) => group);
    validateKnownGroups(document, groups, sourcePath);

    for (const mapping of source.mappings) {
      if (!Object.hasOwn(document, mapping.group)) {
        throw new TokenTransformError(
          `${sourcePath} is missing mapped group "${mapping.group}".`,
        );
      }

      if (Object.hasOwn(canonical, mapping.namespace)) {
        throw new TokenTransformError(
          `Canonical namespace "${mapping.namespace}" is mapped more than once.`,
        );
      }

      canonical[mapping.namespace] = compileGroup(
        document[mapping.group],
        mapping,
      );
    }
  }

  const tokenCount = validateCanonical(canonical);
  const output = `${JSON.stringify(canonical, null, 2)}\n`;

  if (check) {
    let current;

    try {
      current = await readFile(outputPath, "utf8");
    } catch (error) {
      throw new TokenTransformError(
        `Canonical token file is missing at ${outputPath}. Run the source build first.`,
      );
    }

    let currentCanonical;

    try {
      currentCanonical = JSON.parse(current);
    } catch (error) {
      throw new TokenTransformError(
        `Canonical token file at ${outputPath} is invalid JSON: ${error.message}`,
      );
    }

    validateGeneratedAt(currentCanonical, outputPath);

    if (
      !isDeepStrictEqual(
        comparableCanonical(currentCanonical),
        comparableCanonical(canonical),
      )
    ) {
      throw new TokenTransformError(
        `${outputPath} is stale. Rebuild it from the designer YAML sources.`,
      );
    }
  } else if (write) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf8");
  }

  return {
    canonical,
    output,
    outputPath,
    schemaPath: absoluteSchemaPath,
    tokenCount,
    sourceCount: schema.sources.length + 1,
  };
}
