import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { transformFigmaTokens } from "../src/figma-transformer.js";
import {
  compileAuthorValue,
  compileSourceTokens,
} from "../src/source-compiler.js";

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceSchemaPath = path.join(
  packageDirectory,
  "schemas",
  "source-transform.json",
);
const figmaSchemaPath = path.join(
  packageDirectory,
  "schemas",
  "figma-transform.json",
);

async function createSourceFixture(context, document, mappings) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ave-source-fixture-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  const schemaPath = path.join(directory, "source-transform.json");
  const outputPath = path.join(directory, "tokens.json");
  const schema = {
    $schemaVersion: "2.0.0",
    output: "tokens.json",
    settings: { source: "settings.yaml" },
    sources: [
      {
        file: "source.yaml",
        mappings: mappings ?? [
          { group: "dimensions", namespace: "size", type: "dimension" },
        ],
      },
    ],
  };

  await Promise.all([
    writeFile(schemaPath, JSON.stringify(schema), "utf8"),
    writeFile(
      path.join(directory, "settings.yaml"),
      JSON.stringify({
        rootFontSize: "16px",
        fluid: {
          strategy: "linear",
          minBreakpoint: "{size.min}",
          maxBreakpoint: "{size.max}",
        },
      }),
      "utf8",
    ),
    writeFile(path.join(directory, "source.yaml"), JSON.stringify(document), "utf8"),
  ]);

  return { directory, outputPath, schemaPath };
}

function countTokenLeaves(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return 0;
  }

  if (Object.hasOwn(value, "$value")) {
    return 1;
  }

  return Object.entries(value).reduce(
    (count, [key, child]) =>
      key.startsWith("$") ? count : count + countTokenLeaves(child),
    0,
  );
}

test("compiles the designer catalog into valid canonical tokens", async () => {
  const { canonical, output, tokenCount } = await compileSourceTokens({
    schemaPath: sourceSchemaPath,
    write: false,
  });

  assert.ok(tokenCount > 0);
  assert.equal(tokenCount, countTokenLeaves(canonical));
  assert.deepEqual(JSON.parse(output), canonical);
  assert.match(
    canonical.$extensions["com.avenue.tokens"].generatedAt,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  );
});

test("simplified source config preserves canonical output parity", async () => {
  const { canonical } = await compileSourceTokens({
    schemaPath: sourceSchemaPath,
    write: false,
  });
  const committed = JSON.parse(
    await readFile(path.join(packageDirectory, "tokens.json"), "utf8"),
  );

  delete canonical.$extensions["com.avenue.tokens"].generatedAt;
  delete committed.$extensions["com.avenue.tokens"].generatedAt;
  assert.deepEqual(canonical, committed);
});

test("source config rejects unsupported versions and unknown fields", async (context) => {
  const fixture = await createSourceFixture(context, {
    dimensions: { min: "20rem", max: "80rem" },
  });
  const schema = JSON.parse(await readFile(fixture.schemaPath, "utf8"));

  await writeFile(
    fixture.schemaPath,
    JSON.stringify({ ...schema, $schemaVersion: "1.0.0" }),
    "utf8",
  );
  await assert.rejects(
    compileSourceTokens({ schemaPath: fixture.schemaPath, write: false }),
    /Unsupported source config version/,
  );

  await writeFile(
    fixture.schemaPath,
    JSON.stringify({ ...schema, outputFormat: "DTCG" }),
    "utf8",
  );
  await assert.rejects(
    compileSourceTokens({ schemaPath: fixture.schemaPath, write: false }),
    /unknown field: outputFormat/,
  );
});

test("accepts a static value in a fluid-capable group", () => {
  assert.deepEqual(
    compileAuthorValue("1.25rem", {
      tokenType: "dimension",
      behavior: "fluidDimension",
      tokenPath: "fontSize.synthetic.static",
    }),
    {
      $value: { value: 1.25, unit: "rem" },
    },
  );
});

test("accepts single and multi-layer shadow values", () => {
  const layer = {
    color: "oklch(0% 0 0 / 12%)",
    offsetX: "0px",
    offsetY: "4px",
    blur: "12px",
    spread: "0px",
  };
  const single = compileAuthorValue(layer, {
    tokenType: "shadow",
    tokenPath: "elevation.single",
  });
  const multiple = compileAuthorValue([layer, { ...layer, offsetY: "8px" }], {
    tokenType: "shadow",
    tokenPath: "elevation.multiple",
  });

  assert.equal(Array.isArray(single.$value), false);
  assert.equal(multiple.$value.length, 2);
  assert.deepEqual(multiple.$value[0], single.$value);
  assert.equal(multiple.$value[1].offsetY.value, 8);

  assert.throws(
    () =>
      compileAuthorValue([], {
        tokenType: "shadow",
        tokenPath: "elevation.empty",
      }),
    /at least one shadow layer/,
  );
  assert.throws(
    () =>
      compileAuthorValue([layer, { ...layer, blur: undefined }], {
        tokenType: "shadow",
        tokenPath: "elevation.invalid",
      }),
    /must be a dimension/,
  );
});

test("rejects malformed fluid and reserved expression values", () => {
  assert.throws(
    () =>
      compileAuthorValue(
        { min: "1rem" },
        {
          tokenType: "dimension",
          behavior: "fluidDimension",
          tokenPath: "fontSize.synthetic.invalid",
        },
      ),
    /exactly min and max/,
  );
  assert.throws(
    () =>
      compileAuthorValue(
        { operator: "calc", operands: ["1rem", "2vw"] },
        {
          tokenType: "dimension",
          tokenPath: "size.synthetic",
        },
      ),
    /reserved expression operator/,
  );
});

test("source output checks require strict generatedAt but ignore its value", async (context) => {
  const fixture = await createSourceFixture(context, {
    dimensions: { min: "20rem", max: "80rem", spacing: "1rem" },
  });

  await compileSourceTokens({ schemaPath: fixture.schemaPath });
  const canonical = JSON.parse(await readFile(fixture.outputPath, "utf8"));
  canonical.$extensions["com.avenue.tokens"].generatedAt =
    "2000-01-01T00:00:00.000Z";
  await writeFile(fixture.outputPath, JSON.stringify(canonical), "utf8");

  await assert.doesNotReject(
    compileSourceTokens({
      schemaPath: fixture.schemaPath,
      check: true,
      write: false,
    }),
  );

  for (const generatedAt of [
    undefined,
    "2000-01-01T00:00:00Z",
    "2000-01-01T00:00:00.000+00:00",
    "2000-02-30T00:00:00.000Z",
  ]) {
    const malformed = structuredClone(canonical);

    if (generatedAt === undefined) {
      delete malformed.$extensions["com.avenue.tokens"].generatedAt;
    } else {
      malformed.$extensions["com.avenue.tokens"].generatedAt = generatedAt;
    }

    await writeFile(fixture.outputPath, JSON.stringify(malformed), "utf8");
    await assert.rejects(
      compileSourceTokens({
        schemaPath: fixture.schemaPath,
        check: true,
        write: false,
      }),
      /generatedAt value in strict ISO UTC format/,
    );
  }

  const stale = structuredClone(canonical);
  stale.size.spacing.$value.value = 2;
  await writeFile(fixture.outputPath, JSON.stringify(stale), "utf8");
  await assert.rejects(
    compileSourceTokens({
      schemaPath: fixture.schemaPath,
      check: true,
      write: false,
    }),
    /is stale/,
  );
});

test("source compilation creates the output parent directory", async (context) => {
  const fixture = await createSourceFixture(context, {
    dimensions: { min: "20rem", max: "80rem" },
  });
  const outputPath = path.join(fixture.directory, "nested", "output", "tokens.json");

  await compileSourceTokens({ schemaPath: fixture.schemaPath, outputPath });
  assert.equal(JSON.parse(await readFile(outputPath, "utf8")).size.$type, "dimension");
});

test("rejects unsafe author path segments and reports the full path", async (context) => {
  for (const segment of ["", "$private", "bad.name", "bad{name", "bad}name"]) {
    await context.test(JSON.stringify(segment), async (subcontext) => {
      const fixture = await createSourceFixture(subcontext, {
        dimensions: { parent: { [segment]: "1rem" } },
      });

      await assert.rejects(
        compileSourceTokens({ schemaPath: fixture.schemaPath, write: false }),
        (error) => {
          assert.match(error.message, /Invalid author path segment/);
          assert.match(error.message, /size\.parent/);
          assert.match(error.message, new RegExp(JSON.stringify(segment).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
          return true;
        },
      );
    });
  }
});

test("canonical alias validation uses inherited types and preserves graph errors", async (context) => {
  const mappings = [
    { group: "dimensions", namespace: "size", type: "dimension" },
    { group: "numbers", namespace: "ratio", type: "number" },
  ];
  const mismatch = await createSourceFixture(
    context,
    {
      dimensions: { target: "1rem" },
      numbers: { alias: "{size.target}" },
    },
    mappings,
  );

  await assert.rejects(
    compileSourceTokens({ schemaPath: mismatch.schemaPath, write: false }),
    /ratio\.alias has type "number".*resolves to type "dimension"/,
  );

  const missing = await createSourceFixture(context, {
    dimensions: { alias: "{size.missing}" },
  });
  await assert.rejects(
    compileSourceTokens({ schemaPath: missing.schemaPath, write: false }),
    /references missing token size\.missing/,
  );

  const cycle = await createSourceFixture(context, {
    dimensions: { one: "{size.two}", two: "{size.one}" },
  });
  await assert.rejects(
    compileSourceTokens({ schemaPath: cycle.schemaPath, write: false }),
    /Generated alias cycle/,
  );
});

test("duplicates a synthetic static font size across configured modes", async (context) => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "ave-tokens-source-"),
  );
  context.after(() => rm(temporaryDirectory, { recursive: true, force: true }));

  const { canonical } = await compileSourceTokens({
    schemaPath: sourceSchemaPath,
    write: false,
  });
  canonical.fontSize.synthetic = {
    $type: "dimension",
    static: compileAuthorValue("1.25rem", {
      tokenType: "dimension",
      behavior: "fluidDimension",
      tokenPath: "fontSize.synthetic.static",
    }),
  };

  const sourcePath = path.join(temporaryDirectory, "tokens.json");
  await writeFile(sourcePath, `${JSON.stringify(canonical, null, 2)}\n`, "utf8");

  const { artifact } = await transformFigmaTokens({
    configPath: figmaSchemaPath,
    sourcePath,
    outputPath: path.join(temporaryDirectory, "figma-tokens.json"),
    write: false,
  });
  const collection = artifact.collections.find(({ variables }) =>
    variables.some(
      ({ sourcePath: tokenPath }) => tokenPath === "fontSize.synthetic.static",
    ),
  );
  const variable = collection.variables.find(
    ({ sourcePath: tokenPath }) => tokenPath === "fontSize.synthetic.static",
  );
  const modeNames = collection.modes.map(({ name }) => name);

  assert.deepEqual(Object.keys(variable.valuesByMode), modeNames);
  assert.ok(
    Object.values(variable.valuesByMode).every((value) => value === 20),
  );
});
