import assert from "node:assert/strict";
import test from "node:test";
import {
  AVENUE_FIGMA_FORMAT,
  SUPPORTED_SCHEMA_VERSION,
  planReconciliation,
  reconciliationFingerprint,
  type AvenueFigmaArtifact,
  type ExistingVariablesSnapshot,
} from "../src/core/index.ts";

function artifact(): AvenueFigmaArtifact {
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
            valuesByMode: { Light: "#ffffff", Dark: "#111111" },
          },
          {
            name: "color/semantic",
            sourcePath: "color.semantic",
            resolvedType: "COLOR",
            scopes: ["ALL_SCOPES"],
            description: "Synthetic alias",
            valuesByMode: { Light: "#ffffff", Dark: "#111111" },
            aliasOf: "color.base",
          },
          {
            name: "text/label",
            sourcePath: "text.label",
            resolvedType: "STRING",
            scopes: [],
            valuesByMode: { Light: "Label", Dark: "Label" },
          },
          {
            name: "size/conflict",
            sourcePath: "size.conflict",
            resolvedType: "FLOAT",
            scopes: ["WIDTH_HEIGHT"],
            valuesByMode: { Light: 8, Dark: 8 },
          },
        ],
      },
    ],
  };
}

function snapshot(): ExistingVariablesSnapshot {
  return {
    collections: [
      {
        id: "collection-1",
        name: "Synthetic",
        modes: [
          { id: "mode-light", name: "Light" },
          { id: "mode-legacy", name: "Legacy (preserved)" },
        ],
      },
      {
        id: "collection-unmentioned",
        name: "Unmentioned (preserved)",
        modes: [{ id: "mode-other", name: "Default" }],
      },
    ],
    variables: [
      {
        id: "variable-base",
        collectionId: "collection-1",
        name: "color/base",
        resolvedType: "COLOR",
        scopes: ["ALL_SCOPES"],
        description: "Existing description is preserved",
        valuesByMode: { "mode-light": "#eeeeee", "mode-legacy": "#abcdef" },
      },
      {
        id: "variable-semantic",
        collectionId: "collection-1",
        name: "old/semantic-name",
        resolvedType: "COLOR",
        scopes: ["ALL_SCOPES"],
        valuesByMode: {
          "mode-light": { kind: "alias", variableId: "variable-base" },
        },
      },
      {
        id: "variable-conflict",
        collectionId: "collection-1",
        name: "size/conflict",
        resolvedType: "STRING",
        scopes: [],
        valuesByMode: { "mode-light": "8" },
      },
      {
        id: "variable-unmentioned",
        collectionId: "collection-1",
        name: "unmentioned/preserved",
        resolvedType: "BOOLEAN",
        scopes: [],
        valuesByMode: { "mode-light": true },
      },
    ],
  };
}

test("plans creates, updates, aliases, preservation, and type conflicts", () => {
  const plan = planReconciliation(artifact(), snapshot(), {
    "color.semantic": "variable-semantic",
  });

  assert.deepEqual(plan.counts, {
    collections: { create: 0, update: 0, unchanged: 1, conflict: 0 },
    modes: { create: 1, update: 0, unchanged: 1, conflict: 0 },
    variables: { create: 1, update: 2, unchanged: 0, conflict: 1 },
    effectStyles: { create: 0, update: 0, unchanged: 0, conflict: 0 },
  });
  assert.equal(plan.conflicts[0]?.reason, "RESOLVED_TYPE_MISMATCH");

  const kinds = plan.operations.map((operation) => operation.kind);
  assert.equal(kinds.includes("deleteCollection" as never), false);
  assert.equal(kinds.includes("deleteMode" as never), false);
  assert.equal(kinds.includes("deleteVariable" as never), false);
  assert.equal(plan.operations.some((operation) => JSON.stringify(operation).includes("mode-legacy")), false);
  assert.equal(plan.operations.some((operation) => JSON.stringify(operation).includes("variable-unmentioned")), false);

  const aliasIndex = kinds.indexOf("setAlias");
  const createVariableIndex = kinds.lastIndexOf("createVariable");
  assert.ok(aliasIndex > createVariableIndex, "aliases must be planned after variable creation");

  const semanticUpdate = plan.operations.find(
    (operation) => operation.kind === "updateVariable" && operation.sourcePath === "color.semantic",
  );
  assert.deepEqual(semanticUpdate, {
    kind: "updateVariable",
    variable: { kind: "existing", id: "variable-semantic" },
    sourcePath: "color.semantic",
    name: "color/semantic",
    description: "Synthetic alias",
  });

  const baseUpdate = plan.operations.find(
    (operation) => operation.kind === "updateVariable" && operation.sourcePath === "color.base",
  );
  assert.equal(baseUpdate, undefined, "an omitted artifact description must not clear the existing description");
  assert.deepEqual(plan.identities["text.label"], { kind: "planned", key: "variable:text.label" });
});

test("uses persisted sourcePath identity before exact collection and name fallback", () => {
  const input = artifact();
  input.collections[0].variables = [input.collections[0].variables[0]];
  const existing = snapshot();
  existing.variables.push({
    id: "fallback-name-match",
    collectionId: "collection-1",
    name: "color/base",
    resolvedType: "COLOR",
    scopes: ["ALL_SCOPES"],
    valuesByMode: { "mode-light": "#ffffff" },
  });

  const plan = planReconciliation(input, existing, { "color.base": "variable-base" });
  assert.deepEqual(plan.identities["color.base"], { kind: "existing", id: "variable-base" });
});

test("reports unchanged variables and does not rewrite omitted descriptions", () => {
  const input = artifact();
  input.collections[0].modes = [{ name: "Light" }];
  input.collections[0].variables = [input.collections[0].variables[0]];
  input.collections[0].variables[0].valuesByMode = { Light: "#eeeeee" };
  const plan = planReconciliation(input, snapshot());

  assert.equal(plan.counts.variables.unchanged, 1);
  assert.equal(plan.counts.variables.update, 0);
  assert.equal(plan.operations.length, 0);
});

test("treats equivalent opaque hex encodings as unchanged", () => {
  const input = artifact();
  input.collections[0].modes = [{ name: "Light" }];
  input.collections[0].variables = [input.collections[0].variables[0]];
  input.collections[0].variables[0].valuesByMode = { Light: "#eeeeeeff" };
  const plan = planReconciliation(input, snapshot());

  assert.equal(plan.counts.variables.unchanged, 1);
  assert.equal(plan.operations.length, 0);
});

test("preserves the artifact's declared mode order", () => {
  const input = artifact();
  input.collections[0].modes = [{ name: "Dark" }, { name: "Light" }];
  const plan = planReconciliation(input, snapshot(), {
    "color.semantic": "variable-semantic",
  });
  const baseValues = plan.operations.filter(
    (operation) =>
      operation.kind === "setValue" && operation.sourcePath === "color.base",
  );

  assert.deepEqual(
    baseValues.map((operation) =>
      operation.kind === "setValue" ? operation.value : undefined,
    ),
    ["#111111", "#ffffff"],
  );
});

test("detects inverse identity collisions and never lets desired tokens share an existing variable", async (t) => {
  await t.test("inverse persisted identity map", () => {
    const input = artifact();
    input.collections[0].variables = [
      input.collections[0].variables[0],
      input.collections[0].variables[2],
    ];
    const plan = planReconciliation(input, snapshot(), {
      "color.base": "variable-base",
      "text.label": "variable-base",
    });

    assert.equal(plan.counts.variables.conflict, 2);
    assert.deepEqual(
      plan.conflicts.map(({ reason }) => reason),
      ["IDENTITY_MAP_COLLISION", "IDENTITY_MAP_COLLISION"],
    );
    assert.equal(
      plan.operations.some(
        (operation) =>
          "sourcePath" in operation &&
          (operation.sourcePath === "color.base" || operation.sourcePath === "text.label"),
      ),
      false,
    );
  });

  await t.test("identity and name fallback claims", () => {
    const input = artifact();
    const duplicateClaim = structuredClone(input.collections[0].variables[0]);
    duplicateClaim.sourcePath = "color.other-source";
    input.collections[0].variables = [input.collections[0].variables[0], duplicateClaim];
    const plan = planReconciliation(input, snapshot(), {
      "color.base": "variable-base",
    });

    assert.deepEqual(
      plan.conflicts.map(({ reason }) => reason),
      ["EXISTING_VARIABLE_CLAIMED", "EXISTING_VARIABLE_CLAIMED"],
    );
  });
});

test("propagates alias target conflicts through the full chain", () => {
  const input = artifact();
  const base = input.collections[0].variables[3];
  const middle = {
    ...structuredClone(base),
    name: "size/middle",
    sourcePath: "size.middle",
    aliasOf: "size.conflict",
  };
  const outer = {
    ...structuredClone(base),
    name: "size/outer",
    sourcePath: "size.outer",
    aliasOf: "size.middle",
  };
  input.collections[0].variables = [outer, middle, base];

  const plan = planReconciliation(input, snapshot());
  assert.deepEqual(
    plan.conflicts.map(({ sourcePath, reason }) => ({ sourcePath, reason })),
    [
      { sourcePath: "size.outer", reason: "ALIAS_TARGET_CONFLICT" },
      { sourcePath: "size.middle", reason: "ALIAS_TARGET_CONFLICT" },
      { sourcePath: "size.conflict", reason: "RESOLVED_TYPE_MISMATCH" },
    ],
  );
  assert.equal(plan.operations.some((operation) => operation.kind === "setAlias"), false);
});

test("fingerprint is stable for object key order and sensitive to operation order", () => {
  const plan = planReconciliation(artifact(), snapshot(), {
    "color.semantic": "variable-semantic",
  });
  const reorderedCounts = {
    ...plan,
    counts: {
      variables: plan.counts.variables,
      modes: plan.counts.modes,
      collections: plan.counts.collections,
      effectStyles: plan.counts.effectStyles,
    },
  };
  assert.equal(reconciliationFingerprint(reorderedCounts), reconciliationFingerprint(plan));

  const reversed = { ...plan, operations: [...plan.operations].reverse() };
  assert.notEqual(reconciliationFingerprint(reversed), reconciliationFingerprint(plan));
});

test("reconciles effect styles by sourcePath without deleting unmentioned styles", () => {
  const input = artifact();
  const shadow = {
    type: "DROP_SHADOW" as const,
    color: { r: 0, g: 0, b: 0, a: 0.25 },
    offset: { x: 0, y: 4 },
    radius: 8,
    spread: 0,
    visible: true as const,
    blendMode: "NORMAL" as const,
  };
  input.styles = {
    effects: [
      { name: "Elevation/Low", sourcePath: "shadow.low", effects: [shadow] },
      { name: "Elevation/High", sourcePath: "shadow.high", effects: [{ ...shadow, radius: 16 }] },
      { name: "Elevation/New", sourcePath: "shadow.new", effects: [shadow] },
    ],
  };
  const existing = snapshot();
  existing.effectStyles = [
    { id: "low", name: "Elevation/Low", sourcePath: "shadow.low", effects: [shadow] },
    { id: "high", name: "Old High", sourcePath: "shadow.high", effects: [{ ...shadow, radius: 12 }] },
    { id: "preserved", name: "Unmentioned", effects: [] },
  ];

  const plan = planReconciliation(input, existing);
  assert.deepEqual(plan.counts.effectStyles, { create: 1, update: 1, unchanged: 1, conflict: 0 });
  assert.deepEqual(
    plan.operations.filter((operation) => operation.kind === "updateEffectStyle"),
    [{
      kind: "updateEffectStyle",
      style: { kind: "existing", id: "high" },
      sourcePath: "shadow.high",
      name: "Elevation/High",
      effects: [{ ...shadow, radius: 16 }],
    }],
  );
  assert.equal(plan.operations.some((operation) => JSON.stringify(operation).includes("preserved")), false);
  assert.equal(plan.operations.some((operation) => operation.kind === ("deleteEffectStyle" as never)), false);
});

test("claims an unowned style by name and blocks destructive effect style collisions", async (t) => {
  const shadow = {
    type: "DROP_SHADOW" as const,
    color: { r: 0, g: 0, b: 0, a: 0.2 },
    offset: { x: 0, y: 2 },
    radius: 4,
    spread: 0,
    visible: true as const,
    blendMode: "NORMAL" as const,
  };

  await t.test("safe name fallback establishes plugin-data identity", () => {
    const input = artifact();
    input.styles = { effects: [{ name: "Elevation/Low", sourcePath: "shadow.low", effects: [shadow] }] };
    const existing = snapshot();
    existing.effectStyles = [{ id: "low", name: "Elevation/Low", effects: [shadow] }];
    const plan = planReconciliation(input, existing);
    assert.equal(plan.counts.effectStyles.update, 1);
    assert.equal(plan.operations.at(-1)?.kind, "updateEffectStyle");
  });

  await t.test("a name owned by another sourcePath is preserved", () => {
    const input = artifact();
    input.styles = { effects: [{ name: "Elevation/Low", sourcePath: "shadow.low", effects: [shadow] }] };
    const existing = snapshot();
    existing.effectStyles = [{ id: "other", name: "Elevation/Low", sourcePath: "shadow.other", effects: [shadow] }];
    const plan = planReconciliation(input, existing);
    const styleConflict = plan.conflicts.find(({ kind }) => kind === "effectStyle");
    assert.equal(styleConflict?.kind, "effectStyle");
    assert.equal(styleConflict?.reason, "NAME_OCCUPIED");
    assert.equal(plan.operations.some((operation) => operation.kind === "updateEffectStyle"), false);
  });

  await t.test("sourcePath identity does not rename over an occupied name", () => {
    const input = artifact();
    input.styles = { effects: [{ name: "Elevation/Low", sourcePath: "shadow.low", effects: [shadow] }] };
    const existing = snapshot();
    existing.effectStyles = [
      { id: "identity", name: "Old Low", sourcePath: "shadow.low", effects: [shadow] },
      { id: "occupant", name: "Elevation/Low", effects: [] },
    ];
    const plan = planReconciliation(input, existing);
    assert.equal(plan.conflicts.find(({ kind }) => kind === "effectStyle")?.reason, "NAME_OCCUPIED");
  });
});

test("conflicts when a persisted identity moved collections or its desired name is occupied", async (t) => {
  await t.test("collection mismatch", () => {
    const input = artifact();
    input.collections[0].variables = [input.collections[0].variables[0]];
    const existing = snapshot();
    existing.variables[0].collectionId = "collection-unmentioned";
    const plan = planReconciliation(input, existing, { "color.base": "variable-base" });
    assert.equal(plan.conflicts[0]?.reason, "COLLECTION_MISMATCH");
  });

  await t.test("name occupied", () => {
    const input = artifact();
    input.collections[0].variables = [input.collections[0].variables[1]];
    delete input.collections[0].variables[0].aliasOf;
    const existing = snapshot();
    existing.variables.push({
      id: "occupant",
      collectionId: "collection-1",
      name: "color/semantic",
      resolvedType: "COLOR",
      scopes: [],
      valuesByMode: {},
    });
    const plan = planReconciliation(input, existing, { "color.semantic": "variable-semantic" });
    assert.equal(plan.conflicts[0]?.reason, "NAME_OCCUPIED");
  });
});
