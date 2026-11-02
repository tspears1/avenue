import { assertValidArtifact, planReconciliation } from "../figma-plugin/src/core/index.ts";
import type {
  EntityRef, ExistingVariablesSnapshot, ReconciliationPlan, SnapshotValue,
} from "../figma-plugin/src/core/artifact.ts";

const MARKER = "[avenue:sourcePath=";
const MAX_BYTES = 4 * 1024 * 1024;
type RecordValue = Record<string, unknown>;
type Mutation = Record<string, unknown>;

export interface RestPayload {
  variableCollections: Mutation[];
  variableModes: Mutation[];
  variables: Mutation[];
  variableModeValues: Mutation[];
}

function fail(message: string): never {
  throw new Error(`Figma REST sync: ${message}`);
}
function record(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object.`);
  return value as RecordValue;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string.`);
  return value;
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
  return value;
}
function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) fail(`Duplicate/ambiguous ${label}.`);
}
function identity(description: string): string | undefined {
  if (!description.includes(MARKER)) return undefined;
  const matches = [...description.matchAll(/\[avenue:sourcePath=([^\]\r\n]+)\]/g)];
  if (matches.length !== 1 || description.split(MARKER).length !== 2) fail("Malformed or duplicate sourcePath markers in description.");
  try {
    const path = decodeURIComponent(matches[0][1]);
    text(path, "sourcePath marker");
    if (encodeURIComponent(path) !== matches[0][1]) fail("Non-canonical sourcePath marker.");
    return path;
  } catch {
    return fail("Invalid sourcePath marker encoding.");
  }
}
function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const bytes = hex.slice(1).match(/../g)!.map((byte) => parseInt(byte, 16) / 255);
  return { r: bytes[0], g: bytes[1], b: bytes[2], a: bytes[3] ?? 1 };
}
function readValue(value: unknown, type: string, label: string): SnapshotValue {
  if (value !== null && typeof value === "object") {
    const entry = record(value, label);
    if (entry.type === "VARIABLE_ALIAS") return { kind: "alias", variableId: text(entry.id, `${label}.id`) };
    if (type === "COLOR") {
      const channels = ["r", "g", "b", "a"].map((key) => {
        const channel = entry[key];
        if (typeof channel !== "number" || !Number.isFinite(channel) || channel < 0 || channel > 1) fail(`${label}.${key} must be in [0, 1].`);
        return channel;
      });
      // Do not quantize arbitrary API colors into a false unchanged match.
      if (channels.some((channel) => Math.abs(channel * 255 - Math.round(channel * 255)) > 1e-8)) {
        return `rgba(${channels.join(",")})`;
      }
      return `#${channels.map((channel) => Math.round(channel * 255).toString(16).padStart(2, "0")).join("")}`;
    }
  }
  if (type === "FLOAT" && typeof value === "number" && Number.isFinite(value)) return value;
  if (type === "STRING" && typeof value === "string") return value;
  if (type === "BOOLEAN" && typeof value === "boolean") return value;
  return fail(`${label} is not a valid ${type} value.`);
}

/** Accepts GET /variables/local's meta object (or its successful response envelope). */
function readSnapshot(input: unknown): {
  snapshot: ExistingVariablesSnapshot;
  identities: Record<string, string>;
  ids: Set<string>;
} {
  const outer = record(input, "REST snapshot");
  if (outer.error === true || (outer.status !== undefined && outer.status !== 200)) fail("REST snapshot is not a successful API response.");
  const meta = outer.meta === undefined ? outer : record(outer.meta, "meta");
  const collections = record(meta.variableCollections, "variableCollections");
  const variables = record(meta.variables, "variables");
  const ids = new Set<string>();
  const claim = (id: string) => {
    if (ids.has(id)) fail(`Duplicate API ID "${id}".`);
    ids.add(id);
  };
  const collectionInfo = new Map<string, { remote: boolean; modes: Set<string> }>();
  const snapshot: ExistingVariablesSnapshot = { collections: [], variables: [] };
  for (const [key, raw] of Object.entries(collections)) {
    const item = record(raw, `collection ${key}`);
    const id = text(item.id, "collection.id");
    if (key !== id) fail(`Collection key "${key}" does not match its ID.`);
    claim(id);
    const name = text(item.name, "collection.name");
    if (item.isExtension === true) fail(`Extended collection "${name}" is not supported by this sync.`);
    if (item.deletedButReferenced === true) fail(`Collection "${name}" is deleted but still referenced; resolve it before syncing.`);
    if (typeof item.remote !== "boolean") fail(`Collection ${id}.remote must be boolean.`);
    const modes = array(item.modes, `collection ${id}.modes`).map((rawMode) => {
      const mode = record(rawMode, "mode");
      const modeId = text(mode.modeId, "mode.modeId");
      claim(modeId);
      return { id: modeId, name: text(mode.name, "mode.name") };
    });
    if (!modes.length || modes.length > 40) fail(`Collection "${name}" must have 1–40 modes.`);
    unique(modes.map((mode) => mode.name), `mode names in "${name}"`);
    const modeIds = new Set(modes.map((mode) => mode.id));
    if (!modeIds.has(text(item.defaultModeId, "defaultModeId"))) fail(`Invalid defaultModeId in "${name}".`);
    collectionInfo.set(id, { remote: item.remote, modes: modeIds });
    if (!item.remote) snapshot.collections.push({ id, name, modes });
  }
  unique(snapshot.collections.map((collection) => collection.name), "local collection names");
  const allVariables = new Map<string, { type: string; values: Record<string, SnapshotValue> }>();
  const counts = new Map<string, number>();
  const identities: Record<string, string> = Object.create(null);
  for (const [key, raw] of Object.entries(variables)) {
    const item = record(raw, `variable ${key}`);
    const id = text(item.id, "variable.id");
    if (item.deletedButReferenced === true) fail(`Variable "${id}" is deleted but still referenced; resolve it before syncing.`);
    if (key !== id) fail(`Variable key "${key}" does not match its ID.`);
    claim(id);
    const collectionId = text(item.variableCollectionId, "variable.variableCollectionId");
    const collection = collectionInfo.get(collectionId);
    if (!collection) fail(`Variable ${id} references a missing collection.`);
    if (typeof item.remote !== "boolean") fail(`Variable ${id}.remote must be boolean.`);
    const name = text(item.name, "variable.name");
    const type = text(item.resolvedType, "variable.resolvedType");
    if (!["COLOR", "FLOAT", "STRING", "BOOLEAN"].includes(type)) fail(`Unsupported resolvedType "${type}" for ${id}.`);
    const scopes = array(item.scopes, `variable ${id}.scopes`).map((scope) => text(scope, "scope"));
    if (typeof item.description !== "string") fail(`Variable ${id}.description must be a string.`);
    const values: Record<string, SnapshotValue> = Object.create(null);
    for (const [modeId, value] of Object.entries(record(item.valuesByMode, `variable ${id}.valuesByMode`))) {
      if (!collection.modes.has(modeId)) fail(`Variable ${id} references unknown mode ${modeId}.`);
      values[modeId] = readValue(value, type, `variable ${id}.valuesByMode.${modeId}`);
    }
    allVariables.set(id, { type, values });
    if (item.remote || collection.remote) continue;
    counts.set(collectionId, (counts.get(collectionId) ?? 0) + 1);
    if (counts.get(collectionId)! > 5000) fail(`Collection ${collectionId} exceeds 5000 variables.`);
    const path = identity(item.description);
    if (path !== undefined) {
      if (Object.hasOwn(identities, path)) fail(`Duplicate sourcePath identity "${path}" (including removed tokens).`);
      identities[path] = id;
    }
    snapshot.variables.push({ id, collectionId, name, resolvedType: type as "COLOR" | "FLOAT" | "STRING" | "BOOLEAN", scopes, description: item.description, valuesByMode: values });
  }
  for (const [id, variable] of allVariables) {
    for (const value of Object.values(variable.values)) {
      if (typeof value !== "object") continue;
      const target = allVariables.get(value.variableId);
      if (!target || target.type !== variable.type) fail(`Variable ${id} has a missing or type-incompatible alias target.`);
    }
  }
  for (const collection of snapshot.collections) {
    unique(snapshot.variables.filter((variable) => variable.collectionId === collection.id).map((variable) => variable.name), `variable names in "${collection.name}"`);
  }
  return { snapshot, identities, ids };
}

/**
 * Pure, non-destructive REST adapter. No network calls and no DELETE actions.
 * Identity is an encoded [avenue:sourcePath=…] description marker. Variable name
 * changes preserve IDs; sourcePath renames are NOT supported. A changed path is
 * a new token (the old token remains); a same-name marked occupant blocks it.
 * Migrate identities explicitly outside this adapter if a path must be renamed.
 */
export function planRestSync(artifactInput: unknown, restMeta: unknown): {
  plan: ReconciliationPlan;
  payload: RestPayload;
  ignoredEffectStyles: number;
} {
  const artifact = assertValidArtifact(artifactInput);
  const { snapshot, identities, ids } = readSnapshot(restMeta);
  const { styles, ...withoutStyles } = artifact;
  const desired = {
    ...withoutStyles,
    collections: artifact.collections.map((collection) => ({
      ...collection,
      variables: collection.variables.map((variable) => {
        if (variable.description?.includes(MARKER)) fail(`Artifact description for "${variable.sourcePath}" contains a reserved identity marker.`);
        return { ...variable, description: `${variable.description ? `${variable.description}\n\n` : ""}${MARKER}${encodeURIComponent(variable.sourcePath)}]` };
      }),
    })),
  };
  for (const collection of desired.collections) {
    const existing = snapshot.collections.find((entry) => entry.name === collection.name);
    const modes = new Set([...(existing?.modes.map((mode) => mode.name) ?? []), ...collection.modes.map((mode) => mode.name)]);
    if (modes.size > 40) fail(`Collection "${collection.name}" would exceed 40 modes including existing modes.`);
    const current = snapshot.variables.filter((variable) => variable.collectionId === existing?.id);
    const additions = collection.variables.filter((variable) => !Object.hasOwn(identities, variable.sourcePath) && !current.some((entry) => entry.name === variable.name));
    if (current.length + additions.length > 5000) fail(`Collection "${collection.name}" would exceed 5000 variables including existing variables.`);
    for (const variable of collection.variables) {
      const occupant = current.find((entry) => entry.name === variable.name);
      const oldPath = occupant ? identity(occupant.description ?? "") : undefined;
      if (oldPath !== undefined && oldPath !== variable.sourcePath) fail(`Name "${variable.name}" belongs to sourcePath "${oldPath}", not "${variable.sourcePath}". sourcePath rename is not supported.`);
    }
  }
  const plan = planReconciliation(desired, snapshot, identities);
  if (plan.conflicts.length) fail(`Reconciliation blocked: ${plan.conflicts.map((conflict) => `${conflict.reason}: ${conflict.message}`).join("; ")}`);
  const payload: RestPayload = { variableCollections: [], variableModes: [], variables: [], variableModeValues: [] };
  const temps = new Map<string, string>();
  let sequence = 0;
  const fresh = () => {
    let id: string;
    do { id = `ave_temp_${++sequence}`; } while (ids.has(id));
    ids.add(id);
    return id;
  };
  const refId = (ref: EntityRef): string => {
    if (ref.kind === "existing") return ref.id;
    if (!temps.has(ref.key)) temps.set(ref.key, fresh());
    return temps.get(ref.key)!;
  };
  const initialModes = new Set<string>();
  const types = new Map(desired.collections.flatMap((collection) => collection.variables.map((variable) => [variable.sourcePath, variable.resolvedType] as const)));
  for (const operation of plan.operations) {
    switch (operation.kind) {
      case "createCollection": {
        const first = plan.operations.find((candidate) => candidate.kind === "createMode" && refId(candidate.collection) === refId(operation.collection));
        if (!first || first.kind !== "createMode") fail("New collection is missing its initial mode.");
        const modeId = refId(first.mode);
        initialModes.add(modeId);
        payload.variableCollections.push({ action: "CREATE", id: refId(operation.collection), name: operation.name, initialModeId: modeId });
        break;
      }
      case "createMode": {
        const id = refId(operation.mode);
        payload.variableModes.push({ action: initialModes.has(id) ? "UPDATE" : "CREATE", id, name: operation.name, variableCollectionId: refId(operation.collection) });
        break;
      }
      case "createVariable":
        payload.variables.push({ action: "CREATE", id: refId(operation.variable), variableCollectionId: refId(operation.collection), name: operation.name, resolvedType: operation.resolvedType, scopes: operation.scopes, description: operation.description });
        break;
      case "updateVariable": {
        const { name, scopes, description } = operation;
        payload.variables.push({ action: "UPDATE", id: refId(operation.variable), ...(name !== undefined ? { name } : {}), ...(scopes !== undefined ? { scopes } : {}), ...(description !== undefined ? { description } : {}) });
        break;
      }
      case "setValue":
        payload.variableModeValues.push({ variableId: refId(operation.variable), modeId: refId(operation.mode), value: types.get(operation.sourcePath) === "COLOR" ? hexToRgba(operation.value as string) : operation.value });
        break;
      case "setAlias":
        payload.variableModeValues.push({ variableId: refId(operation.variable), modeId: refId(operation.mode), value: { type: "VARIABLE_ALIAS", id: refId(operation.target) } });
        break;
      default:
        fail("Unexpected effect style operation in REST plan.");
    }
  }
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_BYTES) fail("REST payload exceeds the 4 MB limit.");
  return { plan, payload, ignoredEffectStyles: styles?.effects.length ?? 0 };
}

/** Re-read REST meta after applying a payload, then verify that no writes remain. */
export function verifyRestSync(artifact: unknown, restMeta: unknown): {
  matches: boolean;
  plan: ReconciliationPlan;
  ignoredEffectStyles: number;
} {
  const { plan, ignoredEffectStyles } = planRestSync(artifact, restMeta);
  return { matches: plan.operations.length === 0, plan, ignoredEffectStyles };
}
