import type {
  ArtifactCollection,
  ArtifactValue,
  ArtifactVariable,
  AvenueFigmaArtifact,
  EffectStyleArtifact,
  EntityRef,
  ExistingVariablesSnapshot,
  PlanCounts,
  ReconciliationConflict,
  ReconciliationOperation,
  ReconciliationPlan,
  SnapshotCollection,
  SnapshotEffectStyle,
  SnapshotValue,
  SnapshotVariable,
  SourcePathIdentityMap,
} from "./artifact.ts";

interface DesiredVariable {
  collection: ArtifactCollection;
  variable: ArtifactVariable;
}

interface VariableMatch {
  desired: DesiredVariable;
  collectionRef: EntityRef;
  modeRefs: Map<string, EntityRef>;
  ref: EntityRef;
  existing?: SnapshotVariable;
  conflict?: ReconciliationConflict;
}

function emptyCounts(): PlanCounts {
  return { create: 0, update: 0, unchanged: 0, conflict: 0 };
}

function existingRef(id: string): EntityRef {
  return { kind: "existing", id };
}

function plannedRef(key: string): EntityRef {
  return { kind: "planned", key };
}


function sameArray(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

function normalizedHex(value: string): string {
  const normalized = value.toLowerCase();
  return normalized.length === 9 && normalized.endsWith("ff")
    ? normalized.slice(0, 7)
    : normalized;
}

function sameValue(left: SnapshotValue | undefined, right: ArtifactValue): boolean {
  if (
    typeof left === "string" &&
    typeof right === "string" &&
    /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(left) &&
    /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(right)
  ) {
    return normalizedHex(left) === normalizedHex(right);
  }

  return left === right;
}

function sortedBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...items].sort((left, right) => key(left).localeCompare(key(right)));
}

function firstById<T extends { id: string }>(items: readonly T[]): T | undefined {
  return sortedBy(items, (item) => item.id)[0];
}

function conflict(
  match: VariableMatch,
  reason: Extract<ReconciliationConflict, { kind: "variable" }>["reason"],
  message: string,
): void {
  match.conflict = {
    kind: "variable",
    sourcePath: match.desired.variable.sourcePath,
    reason,
    message,
    ...(match.existing ? { existingVariableId: match.existing.id } : {}),
  };
}

/**
 * Produces a side-effect-free, deterministic import plan. The artifact must
 * already have passed validateArtifact/assertValidArtifact.
 */
export function planReconciliation(
  artifact: AvenueFigmaArtifact,
  snapshot: ExistingVariablesSnapshot,
  persistedIdentities: SourcePathIdentityMap = {},
): ReconciliationPlan {
  const counts = {
    collections: emptyCounts(),
    modes: emptyCounts(),
    variables: emptyCounts(),
    effectStyles: emptyCounts(),
  };
  const structureOperations: ReconciliationOperation[] = [];
  const createOperations: ReconciliationOperation[] = [];
  const updateOperations: ReconciliationOperation[] = [];
  const valueOperations: ReconciliationOperation[] = [];
  const aliasOperations: ReconciliationOperation[] = [];
  const conflicts: ReconciliationConflict[] = [];
  const identities: Record<string, EntityRef> = {};

  const existingCollectionsByName = new Map<string, SnapshotCollection[]>();
  for (const collection of snapshot.collections) {
    const entries = existingCollectionsByName.get(collection.name) ?? [];
    entries.push(collection);
    existingCollectionsByName.set(collection.name, entries);
  }
  const variablesById = new Map(snapshot.variables.map((variable) => [variable.id, variable]));
  const collectionById = new Map(snapshot.collections.map((collection) => [collection.id, collection]));
  const variablesByCollectionAndName = new Map<string, SnapshotVariable[]>();
  for (const variable of snapshot.variables) {
    const key = `${variable.collectionId}\u0000${variable.name}`;
    const entries = variablesByCollectionAndName.get(key) ?? [];
    entries.push(variable);
    variablesByCollectionAndName.set(key, entries);
  }

  const collectionRefs = new Map<string, EntityRef>();
  const modeRefs = new Map<string, Map<string, EntityRef>>();
  const desiredCollections = artifact.collections;

  for (const desiredCollection of desiredCollections) {
    const existingCollection = firstById(existingCollectionsByName.get(desiredCollection.name) ?? []);
    const collectionRef = existingCollection
      ? existingRef(existingCollection.id)
      : plannedRef(`collection:${desiredCollection.name}`);
    collectionRefs.set(desiredCollection.name, collectionRef);
    if (existingCollection) counts.collections.unchanged += 1;
    else {
      counts.collections.create += 1;
      structureOperations.push({ kind: "createCollection", collection: collectionRef, name: desiredCollection.name });
    }

    const refs = new Map<string, EntityRef>();
    const desiredModes = desiredCollection.modes;
    for (const desiredMode of desiredModes) {
      const existingMode = existingCollection
        ? firstById(existingCollection.modes.filter((mode) => mode.name === desiredMode.name))
        : undefined;
      const modeRef = existingMode
        ? existingRef(existingMode.id)
        : plannedRef(`mode:${desiredCollection.name}/${desiredMode.name}`);
      refs.set(desiredMode.name, modeRef);
      if (existingMode) counts.modes.unchanged += 1;
      else {
        counts.modes.create += 1;
        structureOperations.push({ kind: "createMode", collection: collectionRef, mode: modeRef, name: desiredMode.name });
      }
    }
    modeRefs.set(desiredCollection.name, refs);
  }

  const desiredVariables: DesiredVariable[] = desiredCollections.flatMap((collection) =>
    collection.variables.map((variable) => ({ collection, variable })),
  );
  const matches = new Map<string, VariableMatch>();
  const identityPathsByVariableId = new Map<string, string[]>();
  for (const [sourcePath, variableId] of Object.entries(persistedIdentities)) {
    const paths = identityPathsByVariableId.get(variableId) ?? [];
    paths.push(sourcePath);
    identityPathsByVariableId.set(variableId, paths);
  }

  for (const desired of desiredVariables) {
    const { collection, variable } = desired;
    const collectionRef = collectionRefs.get(collection.name)!;
    const desiredModeRefs = modeRefs.get(collection.name)!;
    const identityId = persistedIdentities[variable.sourcePath];
    let existing = identityId ? variablesById.get(identityId) : undefined;
    if (!existing && collectionRef.kind === "existing") {
      existing = firstById(variablesByCollectionAndName.get(`${collectionRef.id}\u0000${variable.name}`) ?? []);
    }
    const ref = existing ? existingRef(existing.id) : plannedRef(`variable:${variable.sourcePath}`);
    const match: VariableMatch = { desired, collectionRef, modeRefs: desiredModeRefs, ref, existing };
    matches.set(variable.sourcePath, match);
    identities[variable.sourcePath] = ref;

    if (!existing) continue;
    const identityPaths = identityPathsByVariableId.get(existing.id) ?? [];
    if (identityId && identityPaths.length > 1) {
      conflict(
        match,
        "IDENTITY_MAP_COLLISION",
        `Stored identities ${identityPaths.map((path) => `"${path}"`).join(", ")} all point to the same existing variable "${existing.name}". Repair the identity mapping before importing.`,
      );
      continue;
    }
    if (existing.resolvedType !== variable.resolvedType) {
      conflict(match, "RESOLVED_TYPE_MISMATCH", `Existing variable "${existing.name}" is ${existing.resolvedType}; artifact requires ${variable.resolvedType}.`);
      continue;
    }
    if (collectionRef.kind !== "existing" || existing.collectionId !== collectionRef.id) {
      const existingCollectionName = collectionById.get(existing.collectionId)?.name ?? existing.collectionId;
      conflict(match, "COLLECTION_MISMATCH", `Stored identity is in collection "${existingCollectionName}"; artifact requires "${collection.name}".`);
      continue;
    }
    if (existing.name !== variable.name) {
      const occupant = firstById(variablesByCollectionAndName.get(`${existing.collectionId}\u0000${variable.name}`) ?? []);
      if (occupant && occupant.id !== existing.id) {
        conflict(match, "NAME_OCCUPIED", `Cannot rename to "${variable.name}" because that name is already occupied. Existing identity was preferred over name fallback.`);
      }
    }
  }

  // Never let two desired tokens mutate the same existing variable, whether
  // they arrived there through stored identity or name fallback.
  const claimsByVariableId = new Map<string, VariableMatch[]>();
  for (const match of matches.values()) {
    if (!match.existing) continue;
    const claims = claimsByVariableId.get(match.existing.id) ?? [];
    claims.push(match);
    claimsByVariableId.set(match.existing.id, claims);
  }
  for (const [variableId, claims] of claimsByVariableId) {
    if (claims.length < 2) continue;
    const sourcePaths = claims.map(({ desired }) => desired.variable.sourcePath);
    for (const match of claims) {
      if (match.conflict?.reason === "IDENTITY_MAP_COLLISION") continue;
      conflict(
        match,
        "EXISTING_VARIABLE_CLAIMED",
        `Existing variable "${match.existing!.name}" (${variableId}) is claimed by multiple desired tokens: ${sourcePaths.map((path) => `"${path}"`).join(", ")}.`,
      );
    }
  }

  // Propagate alias target conflicts to a fixed point so an entire alias chain
  // is blocked when any transitive target cannot be reconciled.
  let propagatedAliasConflict = true;
  while (propagatedAliasConflict) {
    propagatedAliasConflict = false;
    for (const match of matches.values()) {
      const targetPath = match.desired.variable.aliasOf;
      if (!match.conflict && targetPath && matches.get(targetPath)?.conflict) {
        conflict(match, "ALIAS_TARGET_CONFLICT", `Alias target "${targetPath}" has a reconciliation conflict.`);
        propagatedAliasConflict = true;
      }
    }
  }

  for (const match of matches.values()) {
    const { collection, variable } = match.desired;
    if (match.conflict) {
      counts.variables.conflict += 1;
      conflicts.push(match.conflict);
      continue;
    }

    if (!match.existing) {
      counts.variables.create += 1;
      createOperations.push({
        kind: "createVariable",
        variable: match.ref,
        collection: match.collectionRef,
        sourcePath: variable.sourcePath,
        name: variable.name,
        resolvedType: variable.resolvedType,
        scopes: [...variable.scopes],
        ...(variable.description !== undefined ? { description: variable.description } : {}),
      });
      if (!variable.aliasOf) {
        for (const mode of collection.modes) {
          valueOperations.push({ kind: "setValue", variable: match.ref, mode: match.modeRefs.get(mode.name)!, sourcePath: variable.sourcePath, value: variable.valuesByMode[mode.name] });
        }
      }
    } else {
      const existing = match.existing;
      const metadata: Extract<ReconciliationOperation, { kind: "updateVariable" }> = {
        kind: "updateVariable",
        variable: match.ref,
        sourcePath: variable.sourcePath,
      };
      let changed = false;
      if (existing.name !== variable.name) {
        metadata.name = variable.name;
        changed = true;
      }
      if (!sameArray(existing.scopes, variable.scopes)) {
        metadata.scopes = [...variable.scopes];
        changed = true;
      }
      if (variable.description !== undefined && existing.description !== variable.description) {
        metadata.description = variable.description;
        changed = true;
      }

      if (!variable.aliasOf) {
        for (const mode of collection.modes) {
          const modeRef = match.modeRefs.get(mode.name)!;
          const current = modeRef.kind === "existing" ? existing.valuesByMode[modeRef.id] : undefined;
          const desiredValue = variable.valuesByMode[mode.name];
          if (!sameValue(current, desiredValue)) {
            changed = true;
            valueOperations.push({ kind: "setValue", variable: match.ref, mode: modeRef, sourcePath: variable.sourcePath, value: desiredValue });
          }
        }
      } else {
        const target = matches.get(variable.aliasOf)!;
        for (const mode of collection.modes) {
          const modeRef = match.modeRefs.get(mode.name)!;
          const current = modeRef.kind === "existing" ? existing.valuesByMode[modeRef.id] : undefined;
          const alreadyAliased = current !== undefined && typeof current === "object" && current.kind === "alias" && target.ref.kind === "existing" && current.variableId === target.ref.id;
          if (!alreadyAliased) changed = true;
        }
      }

      if (Object.keys(metadata).length > 3) updateOperations.push(metadata);
      if (changed) counts.variables.update += 1;
      else counts.variables.unchanged += 1;
    }
  }

  // Alias operations are intentionally emitted last, after every variable create.
  for (const match of matches.values()) {
    const { collection, variable } = match.desired;
    if (match.conflict || !variable.aliasOf) continue;
    const target = matches.get(variable.aliasOf)!;
    for (const mode of collection.modes) {
      const modeRef = match.modeRefs.get(mode.name)!;
      const current = match.existing && modeRef.kind === "existing" ? match.existing.valuesByMode[modeRef.id] : undefined;
      const alreadyAliased = current !== undefined && typeof current === "object" && current.kind === "alias" && target.ref.kind === "existing" && current.variableId === target.ref.id;
      if (!alreadyAliased) aliasOperations.push({ kind: "setAlias", variable: match.ref, mode: modeRef, sourcePath: variable.sourcePath, target: target.ref, targetSourcePath: variable.aliasOf });
    }
  }

  const effectStyleOperations: ReconciliationOperation[] = [];
  const existingEffectStyles = snapshot.effectStyles ?? [];
  const effectStylesBySourcePath = new Map<string, SnapshotEffectStyle[]>();
  const effectStylesByName = new Map<string, SnapshotEffectStyle[]>();
  for (const style of existingEffectStyles) {
    if (style.sourcePath) {
      const sourceMatches = effectStylesBySourcePath.get(style.sourcePath) ?? [];
      sourceMatches.push(style);
      effectStylesBySourcePath.set(style.sourcePath, sourceMatches);
    }
    const nameMatches = effectStylesByName.get(style.name) ?? [];
    nameMatches.push(style);
    effectStylesByName.set(style.name, nameMatches);
  }

  interface EffectStyleMatch {
    desired: EffectStyleArtifact;
    ref: EntityRef;
    existing?: SnapshotEffectStyle;
    conflict?: Extract<ReconciliationConflict, { kind: "effectStyle" }>;
  }
  const effectStyleMatches: EffectStyleMatch[] = [];
  const setStyleConflict = (
    match: EffectStyleMatch,
    reason: Extract<ReconciliationConflict, { kind: "effectStyle" }>["reason"],
    message: string,
  ): void => {
    match.conflict = {
      kind: "effectStyle",
      sourcePath: match.desired.sourcePath,
      reason,
      message,
      ...(match.existing ? { existingStyleId: match.existing.id } : {}),
    };
  };

  for (const desired of artifact.styles?.effects ?? []) {
    const identityMatches = effectStylesBySourcePath.get(desired.sourcePath) ?? [];
    let existing: SnapshotEffectStyle | undefined;
    const match: EffectStyleMatch = {
      desired,
      ref: plannedRef(`effectStyle:${desired.sourcePath}`),
    };

    if (identityMatches.length > 1) {
      setStyleConflict(match, "IDENTITY_COLLISION", `Multiple local effect styles claim the Avenue source path "${desired.sourcePath}".`);
    } else if (identityMatches.length === 1) {
      existing = identityMatches[0];
    } else {
      const nameMatches = effectStylesByName.get(desired.name) ?? [];
      if (nameMatches.length > 1) {
        setStyleConflict(match, "NAME_OCCUPIED", `Multiple local effect styles are named "${desired.name}"; the importer cannot choose one safely.`);
      } else if (nameMatches.length === 1) {
        const candidate = nameMatches[0];
        if (candidate.sourcePath && candidate.sourcePath !== desired.sourcePath) {
          setStyleConflict(match, "NAME_OCCUPIED", `Effect style name "${desired.name}" belongs to Avenue source path "${candidate.sourcePath}" and will not be overwritten.`);
        } else {
          existing = candidate;
        }
      }
    }

    if (existing) {
      match.existing = existing;
      match.ref = existingRef(existing.id);
      if (existing.name !== desired.name) {
        const occupants = (effectStylesByName.get(desired.name) ?? []).filter(({ id }) => id !== existing!.id);
        if (occupants.length > 0) {
          setStyleConflict(match, "NAME_OCCUPIED", `Cannot rename effect style "${existing.name}" to "${desired.name}" because that name is already occupied.`);
        }
      }
    }
    effectStyleMatches.push(match);
  }

  const effectStyleClaims = new Map<string, EffectStyleMatch[]>();
  for (const match of effectStyleMatches) {
    if (!match.existing) continue;
    const claims = effectStyleClaims.get(match.existing.id) ?? [];
    claims.push(match);
    effectStyleClaims.set(match.existing.id, claims);
  }
  for (const [styleId, claims] of effectStyleClaims) {
    if (claims.length < 2) continue;
    for (const match of claims) {
      setStyleConflict(match, "EXISTING_STYLE_CLAIMED", `Existing effect style "${match.existing!.name}" (${styleId}) is claimed by multiple desired styles.`);
    }
  }

  for (const match of effectStyleMatches) {
    const { desired, existing } = match;
    if (match.conflict) {
      counts.effectStyles.conflict += 1;
      conflicts.push(match.conflict);
      continue;
    }
    const effects = desired.effects.map((effect) => ({
      ...effect,
      color: { ...effect.color },
      offset: { ...effect.offset },
    }));
    if (!existing) {
      counts.effectStyles.create += 1;
      effectStyleOperations.push({
        kind: "createEffectStyle",
        style: match.ref,
        sourcePath: desired.sourcePath,
        name: desired.name,
        effects,
      });
      continue;
    }

    const operation: Extract<ReconciliationOperation, { kind: "updateEffectStyle" }> = {
      kind: "updateEffectStyle",
      style: match.ref,
      sourcePath: desired.sourcePath,
    };
    if (existing.name !== desired.name) operation.name = desired.name;
    if (stableJson(existing.effects) !== stableJson(desired.effects)) operation.effects = effects;
    if (existing.sourcePath !== desired.sourcePath || operation.name !== undefined || operation.effects !== undefined) {
      counts.effectStyles.update += 1;
      effectStyleOperations.push(operation);
    } else {
      counts.effectStyles.unchanged += 1;
    }
  }

  return {
    counts,
    operations: [...structureOperations, ...createOperations, ...updateOperations, ...valueOperations, ...aliasOperations, ...effectStyleOperations],
    conflicts,
    identities,
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Stable preview/apply comparison that excludes non-operative identity metadata. */
export function reconciliationFingerprint(plan: ReconciliationPlan): string {
  return stableJson({
    counts: plan.counts,
    conflicts: plan.conflicts,
    operations: plan.operations,
  });
}
