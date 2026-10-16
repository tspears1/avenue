import assert from "node:assert/strict";
import test from "node:test";
import {
  AVENUE_FIGMA_FORMAT,
  SUPPORTED_SCHEMA_VERSION,
  type AvenueFigmaArtifact,
  type ExistingVariablesSnapshot,
  type ReconciliationPlan,
} from "../src/core/index.ts";
import {
  applyReconciliationPlan,
  assertUnambiguousTargets,
  readFigmaState,
} from "../src/figma-adapter.ts";

const artifact: AvenueFigmaArtifact = {
  $schemaVersion: SUPPORTED_SCHEMA_VERSION,
  format: AVENUE_FIGMA_FORMAT,
  collections: [
    {
      name: "Synthetic",
      modes: [{ name: "Light" }],
      variables: [],
    },
  ],
};

const snapshot: ExistingVariablesSnapshot = {
  collections: [
    {
      id: "collection-1",
      name: "Synthetic",
      modes: [
        { id: "mode-1", name: "Light" },
        { id: "mode-2", name: "Light" },
      ],
    },
  ],
  variables: [],
};

test("rejects duplicate existing mode names that match a desired mode", () => {
  assert.throws(
    () => assertUnambiguousTargets(artifact, snapshot),
    /Multiple modes in "Synthetic" are named "Light"/,
  );
});

test("snapshots local effect styles and their plugin-data sourcePath", async () => {
  const previousFigma = (globalThis as any).figma;
  (globalThis as any).figma = {
    variables: {
      getLocalVariableCollectionsAsync: async () => [],
      getLocalVariablesAsync: async () => [],
    },
    getLocalEffectStylesAsync: async () => [{
      id: "style-1",
      name: "Elevation/Low",
      effects: [{
        type: "DROP_SHADOW",
        color: { r: 0, g: 0, b: 0, a: 0.2 },
        offset: { x: 0, y: 2 },
        radius: 4,
        spread: 0,
        visible: true,
        blendMode: "NORMAL",
      }],
      getPluginData: () => "shadow.low",
    }],
    root: { getPluginData: () => "" },
  };

  try {
    const state = await readFigmaState();
    assert.equal(state.snapshot.effectStyles?.[0]?.sourcePath, "shadow.low");
    assert.equal((state.snapshot.effectStyles?.[0]?.effects[0] as any).radius, 4);
  } finally {
    (globalThis as any).figma = previousFigma;
  }
});

test("applies effect style creates and updates with plugin-data identity", async () => {
  const previousFigma = (globalThis as any).figma;
  const sourcePaths: string[] = [];
  const existing = {
    id: "style-existing",
    name: "Old",
    effects: [],
    setPluginData: (_key: string, value: string) => sourcePaths.push(value),
  };
  const created = {
    id: "style-created",
    name: "",
    effects: [],
    setPluginData: (_key: string, value: string) => sourcePaths.push(value),
  };
  (globalThis as any).figma = {
    variables: {
      getLocalVariableCollectionsAsync: async () => [],
      getLocalVariablesAsync: async () => [],
    },
    getLocalEffectStylesAsync: async () => [existing],
    createEffectStyle: () => created,
    root: { setPluginData: () => undefined },
  };
  const effect = {
    type: "DROP_SHADOW" as const,
    color: { r: 0, g: 0, b: 0, a: 0.2 },
    offset: { x: 0, y: 2 },
    radius: 4,
    spread: 0,
    visible: true as const,
    blendMode: "NORMAL" as const,
  };
  const plan: ReconciliationPlan = {
    counts: {
      collections: { create: 0, update: 0, unchanged: 0, conflict: 0 },
      modes: { create: 0, update: 0, unchanged: 0, conflict: 0 },
      variables: { create: 0, update: 0, unchanged: 0, conflict: 0 },
      effectStyles: { create: 1, update: 1, unchanged: 0, conflict: 0 },
    },
    conflicts: [],
    identities: {},
    operations: [
      { kind: "updateEffectStyle", style: { kind: "existing", id: "style-existing" }, sourcePath: "shadow.old", name: "Elevation/Old", effects: [effect] },
      { kind: "createEffectStyle", style: { kind: "planned", key: "effectStyle:shadow.new" }, sourcePath: "shadow.new", name: "Elevation/New", effects: [effect] },
    ],
  };

  try {
    assert.equal(await applyReconciliationPlan(plan, {}), 2);
    assert.equal(existing.name, "Elevation/Old");
    assert.equal(created.name, "Elevation/New");
    assert.deepEqual(sourcePaths, ["shadow.old", "shadow.new"]);
  } finally {
    (globalThis as any).figma = previousFigma;
  }
});
