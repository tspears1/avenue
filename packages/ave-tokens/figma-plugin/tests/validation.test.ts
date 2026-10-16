import assert from "node:assert/strict";
import test from "node:test";
import {
  AVENUE_FIGMA_FORMAT,
  SUPPORTED_SCHEMA_VERSION,
  ArtifactValidationError,
  assertValidArtifact,
  validateArtifact,
  type AvenueFigmaArtifact,
} from "../src/core/index.ts";

function fixture(): AvenueFigmaArtifact {
  return {
    $schemaVersion: SUPPORTED_SCHEMA_VERSION,
    format: AVENUE_FIGMA_FORMAT,
    collections: [
      {
        name: "Synthetic",
        modes: [{ name: "Light" }, { name: "Dark" }],
        variables: [
          {
            name: "color/base",
            sourcePath: "color.base",
            resolvedType: "COLOR",
            scopes: ["ALL_SCOPES"],
            valuesByMode: { Light: "#ffffff", Dark: "#000000ff" },
          },
          {
            name: "color/alias",
            sourcePath: "color.alias",
            resolvedType: "COLOR",
            scopes: ["ALL_SCOPES"],
            valuesByMode: { Light: "#ffffff", Dark: "#000000ff" },
            aliasOf: "color.base",
          },
          {
            name: "size/base",
            sourcePath: "size.base",
            resolvedType: "FLOAT",
            scopes: ["WIDTH_HEIGHT"],
            valuesByMode: { Light: 8, Dark: 8 },
          },
          {
            name: "font/family",
            sourcePath: "font.family",
            resolvedType: "STRING",
            scopes: ["FONT_FAMILY"],
            valuesByMode: { Light: "Inter", Dark: "Inter" },
          },
          {
            name: "feature/enabled",
            sourcePath: "feature.enabled",
            resolvedType: "BOOLEAN",
            scopes: [],
            valuesByMode: { Light: true, Dark: false },
          },
        ],
      },
    ],
  };
}

function mutableFixture(): Record<string, any> {
  return structuredClone(fixture()) as Record<string, any>;
}

function codes(input: unknown): string[] {
  const result = validateArtifact(input);
  assert.equal(result.ok, false);
  return result.issues.map((item) => item.code);
}

test("accepts the supported artifact shape and all four scalar types", () => {
  const artifact = fixture();
  const result = validateArtifact(artifact);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.artifact, artifact);
});

test("accepts optional effect styles and strictly validates their shape", () => {
  const artifact = mutableFixture();
  artifact.styles = {
    effects: [{
      name: "Elevation/Low",
      sourcePath: "shadow.low",
      effects: [{
        type: "DROP_SHADOW",
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 2 },
        radius: 4,
        spread: 0,
        visible: true,
        blendMode: "NORMAL",
      }],
    }],
  };
  assert.equal(validateArtifact(artifact).ok, true);

  artifact.styles.effects[0].effects[0].color.r = 2;
  artifact.styles.effects[0].effects[0].visible = false;
  artifact.styles.effects[0].effects[0].extra = true;
  const resultCodes = codes(artifact);
  assert.ok(resultCodes.includes("INVALID_VALUE"));
  assert.ok(resultCodes.includes("INVALID_SHAPE"));
});

test("requires unique effect style names and sourcePaths", () => {
  const artifact = mutableFixture();
  const style = {
    name: "Elevation/Low",
    sourcePath: "shadow.low",
    effects: [],
  };
  artifact.styles = { effects: [style, structuredClone(style)] };
  const resultCodes = codes(artifact);
  assert.ok(resultCodes.includes("DUPLICATE_EFFECT_STYLE_NAME"));
  assert.ok(resultCodes.includes("DUPLICATE_SOURCE_PATH"));
});

test("requires generatedAt to be a strict, real ISO-8601 date-time with timezone", () => {
  for (const generatedAt of [
    "2025-01-02",
    "January 2, 2025",
    "2025-01-02T03:04:05",
    "2025-02-30T03:04:05Z",
    "2025-01-02t03:04:05z",
    "2025-01-02T24:00:00Z",
    "2025-01-02T03:04:05+14:01",
  ]) {
    const artifact = mutableFixture();
    artifact.generatedAt = generatedAt;
    assert.ok(codes(artifact).includes("INVALID_SHAPE"), generatedAt);
  }

  for (const generatedAt of [
    "2024-02-29T03:04:05Z",
    "2025-01-02T03:04:05.123Z",
    "2025-01-02T03:04:05-05:00",
  ]) {
    const artifact = mutableFixture();
    artifact.generatedAt = generatedAt;
    assert.equal(validateArtifact(artifact).ok, true, generatedAt);
  }
});

test("rejects unsupported format and schema version", () => {
  const artifact = mutableFixture();
  artifact.format = "other";
  artifact.$schemaVersion = "9.0.0";
  assert.deepEqual(codes(artifact), ["UNSUPPORTED_FORMAT", "UNSUPPORTED_VERSION"]);
});

test("requires unique collection, mode, variable name, and global sourcePath identities", () => {
  const artifact = mutableFixture();
  artifact.collections.push(structuredClone(artifact.collections[0]));
  artifact.collections[0].modes.push({ name: "Light" });
  artifact.collections[0].variables[1].name = "color/base";
  artifact.collections[0].variables[1].sourcePath = "color.base";
  const resultCodes = codes(artifact);
  for (const expected of [
    "DUPLICATE_COLLECTION",
    "DUPLICATE_MODE",
    "DUPLICATE_VARIABLE_NAME",
    "DUPLICATE_SOURCE_PATH",
  ]) assert.ok(resultCodes.includes(expected), `missing ${expected}`);
});

test("requires values for exactly every collection mode", () => {
  const artifact = mutableFixture();
  delete artifact.collections[0].variables[0].valuesByMode.Dark;
  artifact.collections[0].variables[0].valuesByMode.Print = "#ffffff";
  assert.ok(codes(artifact).includes("MODE_VALUES_MISMATCH"));
});

test("validates COLOR hex, finite FLOAT, STRING, and BOOLEAN values", () => {
  const artifact = mutableFixture();
  artifact.collections[0].variables[0].valuesByMode.Light = "red";
  artifact.collections[0].variables[2].valuesByMode.Light = Infinity;
  artifact.collections[0].variables[3].valuesByMode.Light = 12;
  artifact.collections[0].variables[4].valuesByMode.Light = "true";
  assert.equal(codes(artifact).filter((code) => code === "INVALID_VALUE").length, 4);
});

test("rejects scopes not supported by the Figma Variables API", () => {
  const artifact = mutableFixture();
  artifact.collections[0].variables[0].scopes = ["NOT_A_FIGMA_SCOPE"];
  assert.ok(codes(artifact).includes("INVALID_SCOPE"));
});

test("validates alias targets, matching types, and cycles", async (t) => {
  await t.test("missing target", () => {
    const artifact = mutableFixture();
    artifact.collections[0].variables[1].aliasOf = "missing.path";
    assert.ok(codes(artifact).includes("MISSING_ALIAS_TARGET"));
  });

  await t.test("different target type", () => {
    const artifact = mutableFixture();
    artifact.collections[0].variables[1].aliasOf = "size.base";
    assert.ok(codes(artifact).includes("ALIAS_TYPE_MISMATCH"));
  });

  await t.test("cycle", () => {
    const artifact = mutableFixture();
    artifact.collections[0].variables[0].aliasOf = "color.alias";
    assert.ok(codes(artifact).includes("ALIAS_CYCLE"));
  });
});

test("assertValidArtifact throws structured issues", () => {
  assert.throws(
    () => assertValidArtifact({}),
    (error: unknown) => error instanceof ArtifactValidationError && error.issues.length > 0,
  );
});
