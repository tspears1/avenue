export const AVENUE_FIGMA_FORMAT = "avenue-figma-variables" as const;
export const SUPPORTED_SCHEMA_VERSION = "0.3.0" as const;

export type ResolvedType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
export type ArtifactValue = string | number | boolean;

export interface ArtifactMode {
  name: string;
}

export interface ArtifactVariable {
  name: string;
  sourcePath: string;
  resolvedType: ResolvedType;
  scopes: string[];
  valuesByMode: Record<string, ArtifactValue>;
  description?: string;
  aliasOf?: string;
  source?: Readonly<Record<string, unknown>>;
}

export interface ArtifactCollection {
  name: string;
  modes: ArtifactMode[];
  variables: ArtifactVariable[];
}

export interface EffectStyleEffect {
  type: "DROP_SHADOW";
  color: { r: number; g: number; b: number; a: number };
  offset: { x: number; y: number };
  radius: number;
  spread: number;
  visible: true;
  blendMode: "NORMAL";
}

export interface EffectStyleArtifact {
  name: string;
  sourcePath: string;
  effects: EffectStyleEffect[];
}

export interface AvenueFigmaArtifact {
  $schemaVersion: typeof SUPPORTED_SCHEMA_VERSION;
  format: typeof AVENUE_FIGMA_FORMAT;
  generatedAt?: string;
  source?: string;
  collections: ArtifactCollection[];
  styles?: { effects: EffectStyleArtifact[] };
  excluded?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  summary?: Readonly<Record<string, unknown>>;
}

export interface SnapshotMode {
  id: string;
  name: string;
}

export interface SnapshotCollection {
  id: string;
  name: string;
  modes: SnapshotMode[];
}

/** A Figma-independent representation of a variable alias. */
export interface SnapshotAlias {
  kind: "alias";
  variableId: string;
}

export type SnapshotValue = ArtifactValue | SnapshotAlias;

export type ExistingResolvedType = ResolvedType | "EASING" | "TIMING";

export interface SnapshotVariable {
  id: string;
  collectionId: string;
  name: string;
  resolvedType: ExistingResolvedType;
  scopes: string[];
  description?: string;
  /** Keys are snapshot mode IDs, matching Figma's storage model. */
  valuesByMode: Record<string, SnapshotValue>;
}

export interface SnapshotEffectStyle {
  id: string;
  name: string;
  sourcePath?: string;
  effects: readonly unknown[];
}

export interface ExistingVariablesSnapshot {
  collections: SnapshotCollection[];
  variables: SnapshotVariable[];
  effectStyles?: SnapshotEffectStyle[];
}

/** Persisted artifact sourcePath -> existing variable ID. */
export type SourcePathIdentityMap = Readonly<Record<string, string>>;

export type EntityRef =
  | { kind: "existing"; id: string }
  | { kind: "planned"; key: string };

export interface PlanCounts {
  create: number;
  update: number;
  unchanged: number;
  conflict: number;
}

export interface ReconciliationCounts {
  collections: PlanCounts;
  modes: PlanCounts;
  variables: PlanCounts;
  effectStyles: PlanCounts;
}

export type ReconciliationConflict =
  | {
      kind: "variable";
      sourcePath: string;
      reason:
        | "RESOLVED_TYPE_MISMATCH"
        | "COLLECTION_MISMATCH"
        | "NAME_OCCUPIED"
        | "IDENTITY_MAP_COLLISION"
        | "EXISTING_VARIABLE_CLAIMED"
        | "ALIAS_TARGET_CONFLICT";
      message: string;
      existingVariableId?: string;
    }
  | {
      kind: "effectStyle";
      sourcePath: string;
      reason:
        | "NAME_OCCUPIED"
        | "IDENTITY_COLLISION"
        | "EXISTING_STYLE_CLAIMED";
      message: string;
      existingStyleId?: string;
    };

export type ReconciliationOperation =
  | {
      kind: "createCollection";
      collection: EntityRef;
      name: string;
    }
  | {
      kind: "createMode";
      collection: EntityRef;
      mode: EntityRef;
      name: string;
    }
  | {
      kind: "createVariable";
      variable: EntityRef;
      collection: EntityRef;
      sourcePath: string;
      name: string;
      resolvedType: ResolvedType;
      scopes: string[];
      description?: string;
    }
  | {
      kind: "updateVariable";
      variable: EntityRef;
      sourcePath: string;
      name?: string;
      scopes?: string[];
      description?: string;
    }
  | {
      kind: "setValue";
      variable: EntityRef;
      mode: EntityRef;
      sourcePath: string;
      value: ArtifactValue;
    }
  | {
      kind: "setAlias";
      variable: EntityRef;
      mode: EntityRef;
      sourcePath: string;
      target: EntityRef;
      targetSourcePath: string;
    }
  | {
      kind: "createEffectStyle";
      style: EntityRef;
      sourcePath: string;
      name: string;
      effects: EffectStyleEffect[];
    }
  | {
      kind: "updateEffectStyle";
      style: EntityRef;
      sourcePath: string;
      name?: string;
      effects?: EffectStyleEffect[];
    };

export interface ReconciliationPlan {
  counts: ReconciliationCounts;
  operations: ReconciliationOperation[];
  conflicts: ReconciliationConflict[];
  /** The identity map to persist after successfully applying the plan. */
  identities: Record<string, EntityRef>;
}

export type PlanApplicationStep =
  | ReconciliationOperation
  | { kind: "persistIdentities" };
