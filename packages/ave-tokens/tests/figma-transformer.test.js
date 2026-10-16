import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  interpolateFluidValue,
  matchesPath,
  transformFigmaTokens,
} from "../src/figma-transformer.js";

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const configPath = path.join(
  packageDirectory,
  "schemas",
  "figma-transform.json",
);

function minimalConfig(overrides = {}) {
  return {
    $schemaVersion: "1.1.0",
    source: "tokens.json",
    output: "dist/figma-tokens.json",
    artifact: { version: "1.0.0", format: "test-figma-variables" },
    naming: { separator: "/" },
    fluid: { precision: 2, modes: [] },
    collections: [
      {
        name: "Numbers",
        modes: ["Default"],
        rules: [
          {
            match: { paths: ["**"] },
            type: "FLOAT",
            scopes: ["ALL_SCOPES"],
          },
        ],
      },
    ],
    exclusions: [],
    ...overrides,
  };
}

async function createFigmaFixture(context, config = minimalConfig(), tokens) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ave-figma-fixture-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = path.join(directory, "figma-transform.json");
  const sourcePath = path.join(directory, "tokens.json");
  const outputPath = path.join(directory, "dist", "figma-tokens.json");

  await Promise.all([
    writeFile(configPath, JSON.stringify(config), "utf8"),
    writeFile(
      sourcePath,
      JSON.stringify(
        tokens ?? {
          number: {
            $type: "number",
            one: { $value: 1 },
          },
        },
      ),
      "utf8",
    ),
  ]);

  return { configPath, directory, outputPath, sourcePath };
}

function assertFigmaValue(value, resolvedType) {
  switch (resolvedType) {
    case "COLOR":
      assert.match(value, /^#[\da-f]{6}(?:[\da-f]{2})?$/i);
      break;
    case "FLOAT":
      assert.equal(Number.isFinite(value), true);
      break;
    case "STRING":
      assert.equal(typeof value, "string");
      break;
    case "BOOLEAN":
      assert.equal(typeof value, "boolean");
      break;
    default:
      assert.fail(`Unexpected Figma resolved type: ${resolvedType}`);
  }
}

test("matches token path patterns", () => {
  assert.equal(matchesPath("color.neutral.500", "color.**"), true);
  assert.equal(matchesPath("size.1", "size.*"), true);
  assert.equal(matchesPath("size.deep.1", "size.*"), false);
  assert.equal(matchesPath("fontSize.display.1", "fontSize.**"), true);
});

test("interpolates and clamps fluid values", () => {
  const values = {
    minValue: 64,
    maxValue: 128,
    minViewport: 576,
    maxViewport: 1280,
    precision: 2,
  };

  assert.equal(interpolateFluidValue({ ...values, viewport: 360 }), 64);
  assert.equal(interpolateFluidValue({ ...values, viewport: 768 }), 81.45);
  assert.equal(interpolateFluidValue({ ...values, viewport: 1024 }), 104.73);
  assert.equal(interpolateFluidValue({ ...values, viewport: 1536 }), 128);
});

test("Figma checks compare output while write:false only transforms", async (context) => {
  const fixture = await createFigmaFixture(context);

  await assert.doesNotReject(
    transformFigmaTokens({
      configPath: fixture.configPath,
      outputPath: fixture.outputPath,
      write: false,
    }),
  );
  await assert.rejects(
    transformFigmaTokens({
      configPath: fixture.configPath,
      outputPath: fixture.outputPath,
      check: true,
      write: false,
    }),
    /artifact is missing/,
  );

  await transformFigmaTokens({
    configPath: fixture.configPath,
    outputPath: fixture.outputPath,
  });
  const { artifact } = await transformFigmaTokens({
    configPath: fixture.configPath,
    outputPath: fixture.outputPath,
    write: false,
  });
  const reorderedArtifact = Object.fromEntries(Object.entries(artifact).reverse());
  await writeFile(fixture.outputPath, JSON.stringify(reorderedArtifact), "utf8");
  await assert.doesNotReject(
    transformFigmaTokens({
      configPath: fixture.configPath,
      outputPath: fixture.outputPath,
      check: true,
      write: false,
    }),
  );

  await writeFile(fixture.outputPath, "{not json", "utf8");
  await assert.rejects(
    transformFigmaTokens({
      configPath: fixture.configPath,
      outputPath: fixture.outputPath,
      check: true,
      write: false,
    }),
    /invalid JSON/,
  );

  await writeFile(fixture.outputPath, JSON.stringify({ stale: true }), "utf8");
  await assert.rejects(
    transformFigmaTokens({
      configPath: fixture.configPath,
      outputPath: fixture.outputPath,
      check: true,
      write: false,
    }),
    /is stale/,
  );
});

test("validates Figma config structure before reading source tokens", async (context) => {
  const duplicateCollection = minimalConfig();
  duplicateCollection.collections.push(structuredClone(duplicateCollection.collections[0]));

  const invalidCases = [
    ["collection names must be non-empty", { collections: [{ name: "", modes: ["Default"], rules: minimalConfig().collections[0].rules }] }, /collection names must be non-empty/],
    ["collection names must be unique", duplicateCollection, /collection names must be unique/],
    ["collection modes must be non-empty", { collections: [{ ...minimalConfig().collections[0], modes: [] }] }, /modes must be non-empty/],
    ["collection modes must be unique", { collections: [{ ...minimalConfig().collections[0], modes: ["Same", "Same"] }] }, /duplicate modes/],
    ["rules must be non-empty", { collections: [{ ...minimalConfig().collections[0], rules: [] }] }, /at least one rule/],
    ["Figma types must be supported", { collections: [{ ...minimalConfig().collections[0], rules: [{ ...minimalConfig().collections[0].rules[0], type: "OBJECT" }] }] }, /unsupported Figma type/],
    ["scopes must be supported", { collections: [{ ...minimalConfig().collections[0], rules: [{ ...minimalConfig().collections[0].rules[0], scopes: ["UNKNOWN_SCOPE"] }] }] }, /unsupported or empty scopes/],
    ["fluid modes must not be duplicated", { fluid: { precision: 2, modes: [{ name: "sm", breakpoint: "{breakpoint.sm}" }, { name: "sm", breakpoint: "{breakpoint.md}" }] } }, /Fluid mode names must be unique/],
    ["effect style rules must not be empty", { styles: { effects: [] } }, /at least one rule/],
    ["effect style rules reject unknown fields", { styles: { effects: [{ match: { paths: ["elevation.*"] }, type: "DROP_SHADOW" }] } }, /unknown field: type/],
  ];

  for (const [name, override, expected] of invalidCases) {
    await context.test(name, async (subcontext) => {
      const config = minimalConfig(override);
      config.source = "missing-tokens.json";
      const fixture = await createFigmaFixture(subcontext, config);

      await assert.rejects(
        transformFigmaTokens({ configPath: fixture.configPath, write: false }),
        expected,
      );
    });
  }
});

test("Figma config rejects unsupported versions and unknown fields", async (context) => {
  const unsupported = await createFigmaFixture(context, {
    ...minimalConfig(),
    $schemaVersion: "0.2.0",
  });
  await assert.rejects(
    transformFigmaTokens({ configPath: unsupported.configPath, write: false }),
    /Unsupported Figma config version/,
  );

  const unknown = await createFigmaFixture(context, {
    ...minimalConfig(),
    platform: "figma",
  });
  await assert.rejects(
    transformFigmaTokens({ configPath: unknown.configPath, write: false }),
    /unknown field: platform/,
  );
});

test("simplified Figma config preserves generated artifact parity", async () => {
  const { artifact } = await transformFigmaTokens({
    configPath,
    write: false,
  });
  const committed = JSON.parse(
    await readFile(path.join(packageDirectory, "dist", "figma-tokens.json"), "utf8"),
  );

  assert.deepEqual(artifact, committed);
});

test("rejects aliases whose inherited source type differs from the target", async (context) => {
  const fixture = await createFigmaFixture(context, minimalConfig(), {
    size: {
      $type: "dimension",
      target: { $value: { value: 1, unit: "px" } },
    },
    ratio: {
      $type: "number",
      alias: { $value: "{size.target}" },
    },
  });

  await assert.rejects(
    transformFigmaTokens({ configPath: fixture.configPath, write: false }),
    /ratio\.alias.*type "number".*resolves to type "dimension"/,
  );
});

test("CLI parse failures are presented normally and -- ends option parsing", () => {
  for (const binary of ["build-figma.js", "compile-tokens.js"]) {
    const binaryPath = path.join(packageDirectory, "bin", binary);
    const unknown = spawnSync(process.execPath, [binaryPath, "--unknown"], {
      cwd: packageDirectory,
      encoding: "utf8",
    });
    const unknownOutput = `${unknown.stdout}${unknown.stderr}`;

    assert.equal(unknown.status, 1);
    assert.match(unknownOutput, /Unknown option "--unknown"/);
    assert.match(unknownOutput, /failed/i);
    assert.doesNotMatch(unknownOutput, /TokenTransformError:|at parseArguments/);

    const positional = spawnSync(
      process.execPath,
      [binaryPath, "--quiet", "--", "--check"],
      { cwd: packageDirectory, encoding: "utf8" },
    );
    const positionalOutput = `${positional.stdout}${positional.stderr}`;

    assert.equal(positional.status, 1);
    assert.match(positionalOutput, /Unexpected positional argument "--check"/);
    assert.doesNotMatch(positionalOutput, /TokenTransformError:|at parseArguments/);
  }
});

test("Figma CLI --check performs freshness checking without writing", async (context) => {
  const fixture = await createFigmaFixture(context);
  const result = spawnSync(
    process.execPath,
    [
      path.join(packageDirectory, "bin", "build-figma.js"),
      "--quiet",
      "--check",
      "--config",
      fixture.configPath,
      "--output",
      fixture.outputPath,
    ],
    { cwd: packageDirectory, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /artifact is missing/);
});

test("routes every source token to a valid variable, style, or exclusion", async () => {
  const { artifact } = await transformFigmaTokens({
    configPath,
    write: false,
  });

  assert.equal(artifact.format, "avenue-figma-variables");
  assert.match(
    artifact.generatedAt,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  );
  assert.ok(artifact.summary.sourceTokens > 0);
  assert.equal(
    artifact.summary.variables +
      artifact.summary.effectStyles +
      artifact.summary.excluded,
    artifact.summary.sourceTokens,
  );

  const variables = artifact.collections.flatMap(({ variables }) => variables);
  const effectStyles = artifact.styles.effects;
  const variablePaths = new Set(variables.map(({ sourcePath }) => sourcePath));
  const effectStylePaths = new Set(effectStyles.map(({ sourcePath }) => sourcePath));
  const excludedPaths = new Set(artifact.excluded.map(({ sourcePath }) => sourcePath));

  assert.equal(variablePaths.size, variables.length);
  assert.equal(effectStylePaths.size, effectStyles.length);
  assert.equal(excludedPaths.size, artifact.excluded.length);

  for (const sourcePath of [...variablePaths, ...effectStylePaths]) {
    assert.equal(excludedPaths.has(sourcePath), false);
    assert.equal(variablePaths.has(sourcePath) && effectStylePaths.has(sourcePath), false);
  }

  for (const style of effectStyles) {
    assert.ok(style.name.length > 0);
    assert.ok(style.sourcePath.length > 0);
    assert.ok(style.effects.length > 0);

    for (const effect of style.effects) {
      assert.equal(effect.type, "DROP_SHADOW");
      assert.equal(effect.blendMode, "NORMAL");
      assert.equal(effect.visible, true);
      assert.ok([effect.offset.x, effect.offset.y, effect.radius, effect.spread].every(Number.isFinite));
      assert.ok(
        [effect.color.r, effect.color.g, effect.color.b, effect.color.a].every(
          (channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1,
        ),
      );
    }
  }

  for (const collection of artifact.collections) {
    const modeNames = collection.modes.map(({ name }) => name);
    const variableNames = collection.variables.map(({ name }) => name);

    assert.ok(modeNames.length > 0);
    assert.equal(new Set(modeNames).size, modeNames.length);
    assert.equal(new Set(variableNames).size, variableNames.length);

    for (const variable of collection.variables) {
      assert.ok(variable.name.length > 0);
      assert.ok(variable.sourcePath.length > 0);
      assert.deepEqual(Object.keys(variable.valuesByMode), modeNames);

      for (const value of Object.values(variable.valuesByMode)) {
        assertFigmaValue(value, variable.resolvedType);
      }

      if (variable.aliasOf) {
        assert.equal(variablePaths.has(variable.aliasOf), true);
      }
    }
  }
});
