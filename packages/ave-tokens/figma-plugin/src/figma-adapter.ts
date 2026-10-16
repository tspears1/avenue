import type {
  ArtifactValue,
  AvenueFigmaArtifact,
  EntityRef,
  ExistingVariablesSnapshot,
  PlanApplicationStep,
  ReconciliationPlan,
  SnapshotValue,
  SourcePathIdentityMap,
} from "./core/index.ts";

const IDENTITY_KEY = "avenue-token-identities";
const SOURCE_PATH_KEY = "avenue-token-source-path";
const EFFECT_STYLE_SOURCE_PATH_KEY = "avenue-effect-style-source-path";

export class PlanApplicationError extends Error {
  readonly completedOperations: number;
  readonly failedOperation: PlanApplicationStep;
  readonly partial: boolean;

  constructor(
    message: string,
    completedOperations: number,
    failedOperation: PlanApplicationStep,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PlanApplicationError";
    this.completedOperations = completedOperations;
    this.failedOperation = failedOperation;
    // Figma mutations are not transactional; a throwing operation may itself
    // have made a partial change, even when no prior operation completed.
    this.partial = true;
  }
}

function refKey(ref: EntityRef): string {
  return ref.kind === "existing" ? `existing:${ref.id}` : `planned:${ref.key}`;
}

function byteToHex(value: number): string {
  return Math.round(Math.min(1, Math.max(0, value)) * 255)
    .toString(16)
    .padStart(2, "0");
}

function figmaColorToHex(value: RGB | RGBA): string {
  const alpha = "a" in value ? value.a : 1;
  const rgb = `#${byteToHex(value.r)}${byteToHex(value.g)}${byteToHex(value.b)}`;
  return alpha < 1 ? `${rgb}${byteToHex(alpha)}` : rgb;
}

function hexToFigmaColor(value: string): RGBA {
  const hex = value.slice(1);
  const hasAlpha = hex.length === 8;

  return {
    r: Number.parseInt(hex.slice(0, 2), 16) / 255,
    g: Number.parseInt(hex.slice(2, 4), 16) / 255,
    b: Number.parseInt(hex.slice(4, 6), 16) / 255,
    a: hasAlpha ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
}

function snapshotValue(value: VariableValue, resolvedType: VariableResolvedDataType): SnapshotValue | undefined {
  if (typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS") {
    return { kind: "alias", variableId: value.id };
  }

  if (resolvedType === "COLOR" && typeof value === "object" && value !== null && "r" in value) {
    return figmaColorToHex(value as RGB | RGBA);
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return undefined;
}

function effectStyleSourcePath(style: EffectStyle): string | undefined {
  const getPluginData = (style as unknown as { getPluginData?: (key: string) => string }).getPluginData;
  if (typeof getPluginData !== "function") return undefined;
  try {
    return getPluginData.call(style, EFFECT_STYLE_SOURCE_PATH_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function setEffectStyleSourcePath(style: EffectStyle, sourcePath: string): void {
  const setPluginData = (style as unknown as { setPluginData?: (key: string, value: string) => void }).setPluginData;
  if (typeof setPluginData === "function") {
    setPluginData.call(style, EFFECT_STYLE_SOURCE_PATH_KEY, sourcePath);
  }
}

function snapshotEffect(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const effect = value as Record<string, unknown>;
  if (effect.type !== "DROP_SHADOW") return { type: effect.type };
  const color = effect.color as Record<string, unknown> | undefined;
  const offset = effect.offset as Record<string, unknown> | undefined;
  return {
    type: effect.type,
    color: color ? { r: color.r, g: color.g, b: color.b, a: color.a } : effect.color,
    offset: offset ? { x: offset.x, y: offset.y } : effect.offset,
    radius: effect.radius,
    spread: effect.spread ?? 0,
    visible: effect.visible,
    blendMode: effect.blendMode,
  };
}

export async function readFigmaState(): Promise<{
  snapshot: ExistingVariablesSnapshot;
  identities: SourcePathIdentityMap;
}> {
  const [collections, variables, effectStyles] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync(),
    figma.getLocalEffectStylesAsync(),
  ]);
  const snapshot: ExistingVariablesSnapshot = {
    collections: collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      modes: collection.modes.map((mode) => ({ id: mode.modeId, name: mode.name })),
    })),
    variables: variables.map((variable) => {
      const valuesByMode: Record<string, SnapshotValue> = {};

      for (const [modeId, value] of Object.entries(variable.valuesByMode)) {
        const normalized = snapshotValue(value, variable.resolvedType);
        if (normalized !== undefined) {
          valuesByMode[modeId] = normalized;
        }
      }

      return {
        id: variable.id,
        collectionId: variable.variableCollectionId,
        name: variable.name,
        resolvedType: variable.resolvedType,
        scopes: [...variable.scopes],
        description: variable.description,
        valuesByMode,
      };
    }),
    effectStyles: effectStyles.map((style) => ({
      id: style.id,
      name: style.name,
      sourcePath: effectStyleSourcePath(style),
      effects: style.effects.map(snapshotEffect),
    })),
  };

  let identities: Record<string, string> = {};
  const stored = figma.root.getPluginData(IDENTITY_KEY);

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        identities = Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        );
      }
    } catch {
      identities = {};
    }
  }

  for (const variable of variables) {
    const sourcePath = variable.getPluginData(SOURCE_PATH_KEY);

    if (!sourcePath) {
      continue;
    }

    const existing = identities[sourcePath];
    if (existing && existing !== variable.id) {
      throw new Error(
        `Multiple local variables claim the Avenue source path "${sourcePath}".`,
      );
    }
    identities[sourcePath] = variable.id;
  }

  return { snapshot, identities };
}

export function assertUnambiguousTargets(
  artifact: AvenueFigmaArtifact,
  snapshot: ExistingVariablesSnapshot,
): void {
  for (const desiredCollection of artifact.collections) {
    const matchingCollections = snapshot.collections.filter(
      ({ name }) => name === desiredCollection.name,
    );

    if (matchingCollections.length > 1) {
      throw new Error(
        `Multiple local collections are named "${desiredCollection.name}". Rename duplicates before importing.`,
      );
    }

    const collection = matchingCollections[0];
    if (!collection) {
      continue;
    }

    for (const desiredMode of desiredCollection.modes) {
      const matches = collection.modes.filter(({ name }) => name === desiredMode.name);
      if (matches.length > 1) {
        throw new Error(
          `Multiple modes in "${desiredCollection.name}" are named "${desiredMode.name}". Rename duplicates before importing.`,
        );
      }
    }

    for (const desiredVariable of desiredCollection.variables) {
      const matches = snapshot.variables.filter(
        (variable) =>
          variable.collectionId === collection.id &&
          variable.name === desiredVariable.name,
      );

      if (matches.length > 1) {
        throw new Error(
          `Multiple variables in "${desiredCollection.name}" are named "${desiredVariable.name}". Rename duplicates before importing.`,
        );
      }
    }
  }
}

function artifactValueToFigma(value: ArtifactValue, variable: Variable): VariableValue {
  return variable.resolvedType === "COLOR"
    ? hexToFigmaColor(value as string)
    : value;
}

export async function applyReconciliationPlan(
  plan: ReconciliationPlan,
  existingIdentities: SourcePathIdentityMap,
): Promise<number> {
  if (plan.conflicts.length > 0) {
    throw new Error("Cannot apply a reconciliation plan that contains conflicts.");
  }

  const [localCollections, localVariables, localEffectStyles] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync(),
    figma.getLocalEffectStylesAsync(),
  ]);
  const collections = new Map<string, VariableCollection>();
  const modes = new Map<string, string>();
  const variables = new Map<string, Variable>();
  const effectStyles = new Map<string, EffectStyle>();
  const unclaimedDefaultModes = new Map<string, string>();

  for (const collection of localCollections) {
    collections.set(`existing:${collection.id}`, collection);
    for (const mode of collection.modes) {
      modes.set(`existing:${mode.modeId}`, mode.modeId);
    }
  }
  for (const variable of localVariables) {
    variables.set(`existing:${variable.id}`, variable);
  }
  for (const style of localEffectStyles) {
    effectStyles.set(`existing:${style.id}`, style);
  }

  const getCollection = (ref: EntityRef): VariableCollection => {
    const collection = collections.get(refKey(ref));
    if (!collection) throw new Error(`Unable to resolve collection ${refKey(ref)}.`);
    return collection;
  };
  const getMode = (ref: EntityRef): string => {
    const mode = modes.get(refKey(ref));
    if (!mode) throw new Error(`Unable to resolve mode ${refKey(ref)}.`);
    return mode;
  };
  const getVariable = (ref: EntityRef): Variable => {
    const variable = variables.get(refKey(ref));
    if (!variable) throw new Error(`Unable to resolve variable ${refKey(ref)}.`);
    return variable;
  };
  const getEffectStyle = (ref: EntityRef): EffectStyle => {
    const style = effectStyles.get(refKey(ref));
    if (!style) throw new Error(`Unable to resolve effect style ${refKey(ref)}.`);
    return style;
  };

  let completedOperations = 0;
  for (const operation of plan.operations) {
    try {
      switch (operation.kind) {
        case "createCollection": {
          const collection = figma.variables.createVariableCollection(operation.name);
          const key = refKey(operation.collection);
          collections.set(key, collection);
          unclaimedDefaultModes.set(key, collection.defaultModeId);
          break;
        }
        case "createMode": {
        const collection = getCollection(operation.collection);
        const collectionKey = refKey(operation.collection);
        const defaultModeId = unclaimedDefaultModes.get(collectionKey);
        let modeId: string;

        if (defaultModeId) {
          collection.renameMode(defaultModeId, operation.name);
          unclaimedDefaultModes.delete(collectionKey);
          modeId = defaultModeId;
        } else {
          modeId = collection.addMode(operation.name);
        }
        modes.set(refKey(operation.mode), modeId);
        break;
      }
        case "createVariable": {
          const collection = getCollection(operation.collection);
        const variable = figma.variables.createVariable(
          operation.name,
          collection,
          operation.resolvedType,
        );
        variable.scopes = operation.scopes as VariableScope[];
        if (operation.description !== undefined) {
          variable.description = operation.description;
        }
        variable.setPluginData(SOURCE_PATH_KEY, operation.sourcePath);
        variables.set(refKey(operation.variable), variable);
        break;
      }
        case "updateVariable": {
          const variable = getVariable(operation.variable);
        if (operation.name !== undefined) variable.name = operation.name;
        if (operation.scopes !== undefined) {
          variable.scopes = operation.scopes as VariableScope[];
        }
        if (operation.description !== undefined) {
          variable.description = operation.description;
        }
        variable.setPluginData(SOURCE_PATH_KEY, operation.sourcePath);
        break;
      }
        case "setValue": {
          const variable = getVariable(operation.variable);
        variable.setValueForMode(
          getMode(operation.mode),
          artifactValueToFigma(operation.value, variable),
        );
        break;
      }
        case "setAlias": {
          const variable = getVariable(operation.variable);
          const target = getVariable(operation.target);
          variable.setValueForMode(
            getMode(operation.mode),
            figma.variables.createVariableAlias(target),
          );
          break;
        }
        case "createEffectStyle": {
          const style = figma.createEffectStyle();
          style.name = operation.name;
          style.effects = operation.effects as Effect[];
          setEffectStyleSourcePath(style, operation.sourcePath);
          effectStyles.set(refKey(operation.style), style);
          break;
        }
        case "updateEffectStyle": {
          const style = getEffectStyle(operation.style);
          if (operation.name !== undefined) style.name = operation.name;
          if (operation.effects !== undefined) style.effects = operation.effects as Effect[];
          setEffectStyleSourcePath(style, operation.sourcePath);
          break;
        }
      }
      completedOperations += 1;
    } catch (cause) {
      throw new PlanApplicationError(
        `Failed while applying planned change ${completedOperations + 1} of ${plan.operations.length} (${operation.kind}).`,
        completedOperations,
        operation,
        { cause },
      );
    }
  }

  try {
    const resolvedIdentities: Record<string, string> = { ...existingIdentities };
    for (const [sourcePath, ref] of Object.entries(plan.identities)) {
      resolvedIdentities[sourcePath] = getVariable(ref).id;
    }
    figma.root.setPluginData(IDENTITY_KEY, JSON.stringify(resolvedIdentities));
  } catch (cause) {
    throw new PlanApplicationError(
      "Planned document changes were applied, but persisting token identities failed.",
      completedOperations,
      { kind: "persistIdentities" },
      { cause },
    );
  }

  return completedOperations;
}
