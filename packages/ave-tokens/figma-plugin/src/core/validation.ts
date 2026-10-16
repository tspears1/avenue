import {
  AVENUE_FIGMA_FORMAT,
  SUPPORTED_SCHEMA_VERSION,
  type ArtifactCollection,
  type ArtifactVariable,
  type EffectStyleArtifact,
  type AvenueFigmaArtifact,
  type ResolvedType,
} from "./artifact.ts";

export type ValidationIssueCode =
  | "INVALID_SHAPE"
  | "UNSUPPORTED_FORMAT"
  | "UNSUPPORTED_VERSION"
  | "DUPLICATE_COLLECTION"
  | "DUPLICATE_MODE"
  | "DUPLICATE_VARIABLE_NAME"
  | "DUPLICATE_EFFECT_STYLE_NAME"
  | "DUPLICATE_SOURCE_PATH"
  | "MODE_VALUES_MISMATCH"
  | "INVALID_VALUE"
  | "INVALID_SCOPE"
  | "MISSING_ALIAS_TARGET"
  | "ALIAS_TYPE_MISMATCH"
  | "ALIAS_CYCLE";

export interface ValidationIssue {
  code: ValidationIssueCode;
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; artifact: AvenueFigmaArtifact; issues: [] }
  | { ok: false; issues: ValidationIssue[] };

export class ArtifactValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Invalid Avenue Figma artifact (${issues.length} issue${issues.length === 1 ? "" : "s"}).`);
    this.name = "ArtifactValidationError";
    this.issues = issues;
  }
}

const RESOLVED_TYPES = new Set<ResolvedType>([
  "COLOR",
  "FLOAT",
  "STRING",
  "BOOLEAN",
]);
const COLOR_PATTERN = /^#[\da-f]{6}(?:[\da-f]{2})?$/i;
const ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/;
const VARIABLE_SCOPES = new Set([
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  issues: ValidationIssue[],
): boolean {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  for (const key of extra) {
    issue(issues, "INVALID_SHAPE", `${path}.${key}`, `Unexpected field "${key}".`);
  }
  return extra.length === 0;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function issue(
  issues: ValidationIssue[],
  code: ValidationIssueCode,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function isStrictIsoDateTime(value: string): boolean {
  const match = ISO_DATE_TIME_PATTERN.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return (
    month >= 1 && month <= 12 &&
    day >= 1 && day <= daysInMonth &&
    hour <= 23 && minute <= 59 && second <= 59 &&
    offsetHour <= 14 && offsetMinute <= 59 &&
    (offsetHour < 14 || offsetMinute === 0) &&
    Number.isFinite(Date.parse(value))
  );
}

function validValue(value: unknown, resolvedType: ResolvedType): boolean {
  switch (resolvedType) {
    case "COLOR":
      return typeof value === "string" && COLOR_PATTERN.test(value);
    case "FLOAT":
      return typeof value === "number" && Number.isFinite(value);
    case "STRING":
      return typeof value === "string";
    case "BOOLEAN":
      return typeof value === "boolean";
  }
}

function validateVariableShape(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is ArtifactVariable {
  if (!isRecord(value)) {
    issue(issues, "INVALID_SHAPE", path, "Variable must be an object.");
    return false;
  }

  let valid = true;
  for (const field of ["name", "sourcePath"] as const) {
    if (!nonEmptyString(value[field])) {
      issue(issues, "INVALID_SHAPE", `${path}.${field}`, `${field} must be a non-empty string.`);
      valid = false;
    }
  }
  if (typeof value.resolvedType !== "string" || !RESOLVED_TYPES.has(value.resolvedType as ResolvedType)) {
    issue(issues, "INVALID_SHAPE", `${path}.resolvedType`, "resolvedType must be COLOR, FLOAT, STRING, or BOOLEAN.");
    valid = false;
  }
  if (!Array.isArray(value.scopes) || value.scopes.some((scope) => typeof scope !== "string")) {
    issue(issues, "INVALID_SHAPE", `${path}.scopes`, "scopes must be an array of strings.");
    valid = false;
  } else {
    value.scopes.forEach((scope, index) => {
      if (!VARIABLE_SCOPES.has(scope)) {
        issue(
          issues,
          "INVALID_SCOPE",
          `${path}.scopes[${index}]`,
          `Unsupported Figma variable scope "${scope}".`,
        );
        valid = false;
      }
    });
  }
  if (!isRecord(value.valuesByMode)) {
    issue(issues, "INVALID_SHAPE", `${path}.valuesByMode`, "valuesByMode must be an object.");
    valid = false;
  }
  if (value.description !== undefined && typeof value.description !== "string") {
    issue(issues, "INVALID_SHAPE", `${path}.description`, "description must be a string when provided.");
    valid = false;
  }
  if (value.aliasOf !== undefined && !nonEmptyString(value.aliasOf)) {
    issue(issues, "INVALID_SHAPE", `${path}.aliasOf`, "aliasOf must be a non-empty sourcePath when provided.");
    valid = false;
  }
  return valid;
}

function validateEffectStyleShape(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is EffectStyleArtifact {
  if (!isRecord(value)) {
    issue(issues, "INVALID_SHAPE", path, "Effect style must be an object.");
    return false;
  }

  let valid = hasOnlyKeys(value, ["name", "sourcePath", "effects"], path, issues);
  for (const field of ["name", "sourcePath"] as const) {
    if (!nonEmptyString(value[field])) {
      issue(issues, "INVALID_SHAPE", `${path}.${field}`, `${field} must be a non-empty string.`);
      valid = false;
    }
  }
  if (!Array.isArray(value.effects)) {
    issue(issues, "INVALID_SHAPE", `${path}.effects`, "effects must be an array.");
    return false;
  }

  value.effects.forEach((effect, index) => {
    const effectPath = `${path}.effects[${index}]`;
    if (!isRecord(effect)) {
      issue(issues, "INVALID_SHAPE", effectPath, "Effect must be an object.");
      valid = false;
      return;
    }
    if (!hasOnlyKeys(effect, ["type", "color", "offset", "radius", "spread", "visible", "blendMode"], effectPath, issues)) valid = false;
    if (effect.type !== "DROP_SHADOW") {
      issue(issues, "INVALID_SHAPE", `${effectPath}.type`, "type must be DROP_SHADOW.");
      valid = false;
    }
    if (effect.visible !== true) {
      issue(issues, "INVALID_SHAPE", `${effectPath}.visible`, "visible must be true.");
      valid = false;
    }
    if (effect.blendMode !== "NORMAL") {
      issue(issues, "INVALID_SHAPE", `${effectPath}.blendMode`, "blendMode must be NORMAL.");
      valid = false;
    }
    for (const field of ["radius", "spread"] as const) {
      if (!finiteNumber(effect[field]) || (field === "radius" && effect[field] < 0)) {
        issue(issues, "INVALID_VALUE", `${effectPath}.${field}`, `${field} must be ${field === "radius" ? "a non-negative " : "a "}finite number.`);
        valid = false;
      }
    }

    if (!isRecord(effect.color)) {
      issue(issues, "INVALID_SHAPE", `${effectPath}.color`, "color must be an object.");
      valid = false;
    } else {
      if (!hasOnlyKeys(effect.color, ["r", "g", "b", "a"], `${effectPath}.color`, issues)) valid = false;
      for (const channel of ["r", "g", "b", "a"] as const) {
        const channelValue = effect.color[channel];
        if (!finiteNumber(channelValue) || channelValue < 0 || channelValue > 1) {
          issue(issues, "INVALID_VALUE", `${effectPath}.color.${channel}`, `${channel} must be a finite number from 0 to 1.`);
          valid = false;
        }
      }
    }

    if (!isRecord(effect.offset)) {
      issue(issues, "INVALID_SHAPE", `${effectPath}.offset`, "offset must be an object.");
      valid = false;
    } else {
      if (!hasOnlyKeys(effect.offset, ["x", "y"], `${effectPath}.offset`, issues)) valid = false;
      for (const axis of ["x", "y"] as const) {
        if (!finiteNumber(effect.offset[axis])) {
          issue(issues, "INVALID_VALUE", `${effectPath}.offset.${axis}`, `${axis} must be a finite number.`);
          valid = false;
        }
      }
    }
  });

  return valid;
}

function validateCollectionShape(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is ArtifactCollection {
  if (!isRecord(value)) {
    issue(issues, "INVALID_SHAPE", path, "Collection must be an object.");
    return false;
  }
  let valid = true;
  if (!nonEmptyString(value.name)) {
    issue(issues, "INVALID_SHAPE", `${path}.name`, "Collection name must be a non-empty string.");
    valid = false;
  }
  if (!Array.isArray(value.modes) || value.modes.length === 0) {
    issue(issues, "INVALID_SHAPE", `${path}.modes`, "modes must be a non-empty array.");
    valid = false;
  } else {
    value.modes.forEach((mode, index) => {
      if (!isRecord(mode) || !nonEmptyString(mode.name)) {
        issue(issues, "INVALID_SHAPE", `${path}.modes[${index}].name`, "Mode name must be a non-empty string.");
        valid = false;
      }
    });
  }
  if (!Array.isArray(value.variables)) {
    issue(issues, "INVALID_SHAPE", `${path}.variables`, "variables must be an array.");
    valid = false;
  } else {
    value.variables.forEach((variable, index) => {
      if (!validateVariableShape(variable, `${path}.variables[${index}]`, issues)) valid = false;
    });
  }
  return valid;
}

/** Validates untrusted JSON and narrows it to the importer artifact contract. */
export function validateArtifact(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [{ code: "INVALID_SHAPE", path: "$", message: "Artifact must be an object." }],
    };
  }

  if (input.format !== AVENUE_FIGMA_FORMAT) {
    issue(issues, "UNSUPPORTED_FORMAT", "$.format", `Expected format ${AVENUE_FIGMA_FORMAT}.`);
  }
  if (input.$schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    issue(issues, "UNSUPPORTED_VERSION", "$.$schemaVersion", `Expected schema version ${SUPPORTED_SCHEMA_VERSION}.`);
  }
  if (input.generatedAt !== undefined && !nonEmptyString(input.generatedAt)) {
    issue(issues, "INVALID_SHAPE", "$.generatedAt", "generatedAt must be a non-empty ISO-8601 string when provided.");
  } else if (
    typeof input.generatedAt === "string" &&
    !isStrictIsoDateTime(input.generatedAt)
  ) {
    issue(issues, "INVALID_SHAPE", "$.generatedAt", "generatedAt must be a strict ISO-8601 date-time with a timezone.");
  }
  if (!Array.isArray(input.collections)) {
    issue(issues, "INVALID_SHAPE", "$.collections", "collections must be an array.");
    return { ok: false, issues };
  }

  let structurallyValid = true;
  input.collections.forEach((collection, index) => {
    if (!validateCollectionShape(collection, `$.collections[${index}]`, issues)) structurallyValid = false;
  });
  if (input.styles !== undefined) {
    if (!isRecord(input.styles)) {
      issue(issues, "INVALID_SHAPE", "$.styles", "styles must be an object when provided.");
      structurallyValid = false;
    } else {
      if (!hasOnlyKeys(input.styles, ["effects"], "$.styles", issues)) structurallyValid = false;
      if (!Array.isArray(input.styles.effects)) {
        issue(issues, "INVALID_SHAPE", "$.styles.effects", "styles.effects must be an array.");
        structurallyValid = false;
      } else {
        input.styles.effects.forEach((style, index) => {
          if (!validateEffectStyleShape(style, `$.styles.effects[${index}]`, issues)) structurallyValid = false;
        });
      }
    }
  }
  if (!structurallyValid) return { ok: false, issues };

  const collections = input.collections as unknown as ArtifactCollection[];
  const collectionNames = new Set<string>();
  const variablesByPath = new Map<string, { variable: ArtifactVariable; path: string }>();
  const effectStyleNames = new Set<string>();
  const effectStyleSourcePaths = new Set<string>();

  collections.forEach((collection, collectionIndex) => {
    const collectionPath = `$.collections[${collectionIndex}]`;
    if (collectionNames.has(collection.name)) {
      issue(issues, "DUPLICATE_COLLECTION", `${collectionPath}.name`, `Duplicate collection name "${collection.name}".`);
    }
    collectionNames.add(collection.name);

    const modeNames = collection.modes.map((mode) => mode.name);
    const seenModes = new Set<string>();
    modeNames.forEach((name, modeIndex) => {
      if (seenModes.has(name)) issue(issues, "DUPLICATE_MODE", `${collectionPath}.modes[${modeIndex}].name`, `Duplicate mode name "${name}".`);
      seenModes.add(name);
    });

    const seenVariableNames = new Set<string>();
    collection.variables.forEach((variable, variableIndex) => {
      const variablePath = `${collectionPath}.variables[${variableIndex}]`;
      if (seenVariableNames.has(variable.name)) issue(issues, "DUPLICATE_VARIABLE_NAME", `${variablePath}.name`, `Duplicate variable name "${variable.name}" in collection "${collection.name}".`);
      seenVariableNames.add(variable.name);
      if (variablesByPath.has(variable.sourcePath)) issue(issues, "DUPLICATE_SOURCE_PATH", `${variablePath}.sourcePath`, `Duplicate sourcePath "${variable.sourcePath}".`);
      else variablesByPath.set(variable.sourcePath, { variable, path: variablePath });

      const valueModes = Object.keys(variable.valuesByMode);
      const missing = modeNames.filter((name) => !Object.hasOwn(variable.valuesByMode, name));
      const extra = valueModes.filter((name) => !seenModes.has(name));
      if (missing.length > 0 || extra.length > 0) {
        issue(issues, "MODE_VALUES_MISMATCH", `${variablePath}.valuesByMode`, `Values must exactly match collection modes (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}).`);
      }
      for (const modeName of modeNames) {
        if (Object.hasOwn(variable.valuesByMode, modeName) && !validValue(variable.valuesByMode[modeName], variable.resolvedType)) {
          issue(issues, "INVALID_VALUE", `${variablePath}.valuesByMode.${modeName}`, `Value is not a valid ${variable.resolvedType}.`);
        }
      }
    });
  });

  const effectStyles = (input.styles as { effects: EffectStyleArtifact[] } | undefined)?.effects ?? [];
  effectStyles.forEach((style, index) => {
    const stylePath = `$.styles.effects[${index}]`;
    if (effectStyleNames.has(style.name)) {
      issue(issues, "DUPLICATE_EFFECT_STYLE_NAME", `${stylePath}.name`, `Duplicate effect style name "${style.name}".`);
    }
    effectStyleNames.add(style.name);
    if (effectStyleSourcePaths.has(style.sourcePath)) {
      issue(issues, "DUPLICATE_SOURCE_PATH", `${stylePath}.sourcePath`, `Duplicate effect style sourcePath "${style.sourcePath}".`);
    }
    effectStyleSourcePaths.add(style.sourcePath);
  });

  for (const [sourcePath, entry] of variablesByPath) {
    const targetPath = entry.variable.aliasOf;
    if (!targetPath) continue;
    const target = variablesByPath.get(targetPath);
    if (!target) {
      issue(issues, "MISSING_ALIAS_TARGET", `${entry.path}.aliasOf`, `Alias target "${targetPath}" does not exist.`);
    } else if (target.variable.resolvedType !== entry.variable.resolvedType) {
      issue(issues, "ALIAS_TYPE_MISMATCH", `${entry.path}.aliasOf`, `Alias target "${targetPath}" has a different resolvedType.`);
    }

    const chain: string[] = [];
    const positions = new Map<string, number>();
    let cursor: string | undefined = sourcePath;
    while (cursor) {
      const position = positions.get(cursor);
      if (position !== undefined) {
        const cycle = [...chain.slice(position), cursor];
        if (sourcePath === cycle[0]) issue(issues, "ALIAS_CYCLE", `${entry.path}.aliasOf`, `Alias cycle detected: ${cycle.join(" -> ")}.`);
        break;
      }
      positions.set(cursor, chain.length);
      chain.push(cursor);
      cursor = variablesByPath.get(cursor)?.variable.aliasOf;
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, artifact: input as unknown as AvenueFigmaArtifact, issues: [] };
}

export function assertValidArtifact(input: unknown): AvenueFigmaArtifact {
  const result = validateArtifact(input);
  if (!result.ok) throw new ArtifactValidationError(result.issues);
  return result.artifact;
}
