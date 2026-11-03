import test from 'node:test';
import assert from 'node:assert/strict';
import { planRestSync, verifyRestSync } from '../src/figma-rest.ts';

const empty = () => ({ variableCollections: {}, variables: {} });
const variable = (overrides = {}) => ({
  name: 'spacing/base', sourcePath: 'spacing.base', resolvedType: 'FLOAT',
  scopes: ['ALL_SCOPES'], valuesByMode: { Light: 8 }, ...overrides,
});
const artifact = (variables = [variable()], modes = ['Light']) => ({
  format: 'avenue-figma-variables', $schemaVersion: '0.3.0',
  collections: [{ name: 'Tokens', modes: modes.map((name) => ({ name })), variables }],
});
const marker = (path) => `[avenue:sourcePath=${encodeURIComponent(path)}]`;
const collection = (overrides = {}) => ({
  id: 'c1', name: 'Tokens', remote: false, defaultModeId: 'm1',
  modes: [{ modeId: 'm1', name: 'Light' }], ...overrides,
});
const existingVariable = (overrides = {}) => ({
  id: 'v1', variableCollectionId: 'c1', name: 'spacing/base', remote: false,
  resolvedType: 'FLOAT', description: marker('spacing.base'), scopes: ['ALL_SCOPES'],
  valuesByMode: { m1: 8 }, ...overrides,
});
const state = (vars = [existingVariable()], collections = [collection()]) => ({
  variableCollections: Object.fromEntries(collections.map((item) => [item.id, item])),
  variables: Object.fromEntries(vars.map((item) => [item.id, item])),
});

// Model the REST transaction, including server-created default modes and temp ID
// resolution. IDs in the resulting GET snapshot are never the request temp IDs.
function apply(meta, payload) {
  const result = structuredClone(meta);
  const ids = new Map();
  let sequence = Object.keys(result.variables).length + Object.keys(result.variableCollections).length;
  const resolve = (id) => ids.get(id) ?? id;
  const allocate = (id, prefix) => {
    const actual = `${prefix}:server:${++sequence}`;
    ids.set(id, actual);
    return actual;
  };
  for (const mutation of payload.variableCollections) {
    assert.equal(mutation.action, 'CREATE');
    const id = allocate(mutation.id, 'collection');
    const modeId = allocate(mutation.initialModeId, 'mode');
    result.variableCollections[id] = collection({ id, name: mutation.name, defaultModeId: modeId, modes: [{ modeId, name: 'Mode 1' }] });
  }
  for (const mutation of payload.variableModes) {
    const owner = result.variableCollections[resolve(mutation.variableCollectionId)];
    if (mutation.action === 'CREATE') owner.modes.push({ modeId: allocate(mutation.id, 'mode'), name: mutation.name });
    else {
      assert.equal(mutation.action, 'UPDATE');
      const mode = owner.modes.find((entry) => entry.modeId === resolve(mutation.id));
      assert.ok(mode, 'UPDATE must reuse a mode that already exists');
      mode.name = mutation.name;
    }
  }
  for (const mutation of payload.variables) {
    const { action, id: temp, ...fields } = mutation;
    if (action === 'CREATE') {
      const id = allocate(temp, 'variable');
      result.variables[id] = { ...fields, id, variableCollectionId: resolve(fields.variableCollectionId), remote: false, valuesByMode: {} };
    } else {
      assert.equal(action, 'UPDATE');
      Object.assign(result.variables[resolve(temp)], fields);
    }
  }
  for (const mutation of payload.variableModeValues) {
    const value = mutation.value?.type === 'VARIABLE_ALIAS'
      ? { ...mutation.value, id: resolve(mutation.value.id) } : mutation.value;
    result.variables[resolve(mutation.variableId)].valuesByMode[resolve(mutation.modeId)] = value;
  }
  return result;
}

const writes = (payload) => Object.values(payload).flat();

test('empty create reuses initial default mode and round-trips idempotently', () => {
  const input = artifact([variable({ valuesByMode: { Light: 8, Dark: 16 } })], ['Light', 'Dark']);
  const before = structuredClone(input);
  const { plan, payload, ignoredEffectStyles } = planRestSync(input, empty());
  assert.equal(ignoredEffectStyles, 0);
  assert.equal(plan.counts.variables.create, 1);
  assert.equal(payload.variableCollections.length, 1);
  assert.deepEqual(payload.variableModes.map((mode) => mode.action), ['UPDATE', 'CREATE']);
  assert.equal(payload.variableCollections[0].initialModeId, payload.variableModes[0].id);
  assert.equal(payload.variables[0].description, marker('spacing.base'));
  assert.deepEqual(input, before);
  const after = apply(empty(), payload);
  assert.equal(Object.values(after.variableCollections)[0].modes.length, 2);
  assert.equal(writes(planRestSync(input, after).payload).length, 0);
  assert.equal(verifyRestSync(input, { status: 200, error: false, meta: after }).matches, true);
  assert.equal(verifyRestSync(input, empty()).matches, false);
});

test('RGBA and aliases use temp targets, preserve alpha, and round-trip', () => {
  const input = artifact([
    variable({ name: 'color/base', sourcePath: 'color.base', resolvedType: 'COLOR', valuesByMode: { Light: '#12ab3480' } }),
    variable({ name: 'color/alias', sourcePath: 'color.alias', resolvedType: 'COLOR', aliasOf: 'color.base', valuesByMode: { Light: '#12ab3480' } }),
    variable({ name: 'color/opaque', sourcePath: 'color.opaque', resolvedType: 'COLOR', valuesByMode: { Light: '#ffffff' } }),
    variable({ name: 'text', sourcePath: 'text', resolvedType: 'STRING', valuesByMode: { Light: 'Hello' } }),
    variable({ name: 'flag', sourcePath: 'flag', resolvedType: 'BOOLEAN', valuesByMode: { Light: true } }),
  ]);
  const { payload } = planRestSync(input, empty());
  const base = payload.variables.find((entry) => entry.name === 'color/base');
  assert.deepEqual(payload.variableModeValues.find((entry) => entry.variableId === base.id).value, { r: 18 / 255, g: 171 / 255, b: 52 / 255, a: 128 / 255 });
  assert.deepEqual(payload.variableModeValues.at(-1).value, { type: 'VARIABLE_ALIAS', id: base.id });
  const after = apply(empty(), payload);
  assert.equal(verifyRestSync(input, after).matches, true);
  const color = Object.values(after.variables).find((entry) => entry.name === 'color/base');
  color.valuesByMode[Object.keys(color.valuesByMode)[0]].r += 0.00001;
  assert.equal(verifyRestSync(input, after).matches, false, 'non-byte colors must not round to a false match');
});

test('float32 color storage round-trips every byte including alpha without broad quantization', () => {
  const input = artifact(Array.from({ length: 256 }, (_, byte) => {
    const hex = byte.toString(16).padStart(2, '0');
    return variable({ name: `color/${byte}`, sourcePath: `color.${byte}`, resolvedType: 'COLOR', valuesByMode: { Light: `#${hex}${hex}${hex}${hex}` } });
  }));
  const after = apply(empty(), planRestSync(input, empty()).payload);
  for (const entry of Object.values(after.variables)) {
    for (const value of Object.values(entry.valuesByMode)) {
      for (const channel of ['r', 'g', 'b', 'a']) value[channel] = Math.fround(value[channel]);
    }
  }
  assert.equal(verifyRestSync(input, after).matches, true);
  const first = Object.values(after.variables)[1];
  first.valuesByMode[Object.keys(first.valuesByMode)[0]].a += 1e-9;
  assert.equal(verifyRestSync(input, after).matches, false, 'even a tiny non-float32-equivalent change must be detected');
});

test('float32 dimensions from Figma compare unchanged while authored payload precision is preserved', () => {
  const values = [81.45, 104.73, 71.27, 91.64, 61.09, 78.55, 48.73, 60.36, 43.64, -1.23, 0.01];
  const input = artifact(values.map((value, index) => variable({ name: `size/${index}`, sourcePath: `size.${index}`, valuesByMode: { Light: value } })));
  const { payload } = planRestSync(input, empty());
  assert.deepEqual(payload.variableModeValues.map((entry) => entry.value), values);
  const after = apply(empty(), payload);
  for (const entry of Object.values(after.variables)) {
    for (const [mode, value] of Object.entries(entry.valuesByMode)) entry.valuesByMode[mode] = Math.fround(value);
  }
  const original = structuredClone(after);
  assert.equal(verifyRestSync(input, after).matches, true);
  assert.deepEqual(after, original, 'comparison must not mutate the caller snapshot');
  const first = Object.values(after.variables)[0];
  first.valuesByMode[Object.keys(first.valuesByMode)[0]] += 1e-9;
  const remaining = planRestSync(input, after);
  assert.equal(remaining.payload.variableModeValues.length, 1);
  assert.equal(remaining.payload.variableModeValues[0].value, 81.45);
});

test('float32 equivalence does not hide metadata differences', () => {
  const input = artifact([variable({ valuesByMode: { Light: 81.45 }, scopes: ['FONT_WEIGHT'] })]);
  const after = state([existingVariable({ valuesByMode: { m1: Math.fround(81.45) }, description: '', scopes: ['FONT_STYLE'] })]);
  const { plan, payload } = planRestSync(input, after);
  assert.equal(plan.operations.length, 1);
  assert.equal(payload.variableModeValues.length, 0);
  assert.deepEqual(payload.variables[0].scopes, ['FONT_WEIGHT']);
  assert.equal(payload.variables[0].description, marker('spacing.base'));
});

test('updates keep IDs, marker supports variable name changes and preserves artifact description', () => {
  const meta = state();
  const before = structuredClone(meta);
  const input = artifact([variable({ name: 'space/renamed', description: 'Human description\nwith lines', valuesByMode: { Light: 12 } })]);
  const { payload, plan } = planRestSync(input, meta);
  assert.equal(plan.identities['spacing.base'].id, 'v1');
  assert.deepEqual(payload.variables, [{ action: 'UPDATE', id: 'v1', name: 'space/renamed', description: `Human description\nwith lines\n\n${marker('spacing.base')}` }]);
  assert.deepEqual(payload.variableModeValues, [{ variableId: 'v1', modeId: 'm1', value: 12 }]);
  assert.equal(verifyRestSync(input, apply(meta, payload)).matches, true);
  assert.deepEqual(meta, before);
});

test('unmarked name adoption adds durable marker and unicode paths are encoded', () => {
  const input = artifact([variable({ sourcePath: 'sp ace.🌈[x]', description: 'Keep me' })]);
  const { payload } = planRestSync(input, state([existingVariable({ description: 'Old description' })]));
  assert.equal(payload.variables[0].id, 'v1');
  assert.equal(payload.variables[0].description, `Keep me\n\n${marker('sp ace.🌈[x]')}`);
  assert.equal(verifyRestSync(input, apply(state(), payload)).matches, true);
});

test('sourcePath rename is not silently adopted; removed paths still protect identity', () => {
  assert.throws(() => planRestSync(artifact([variable({ sourcePath: 'spacing.renamed' })]), state()), /sourcePath rename is not supported/);
  const input = artifact([variable({ sourcePath: 'new.path', name: 'new/name' })]);
  const { payload } = planRestSync(input, state());
  assert.equal(payload.variables[0].action, 'CREATE');
  const after = apply(state(), payload);
  assert.deepEqual(after.variables.v1, state().variables.v1);
  assert.equal(verifyRestSync(input, after).matches, true);
});

test('duplicate identities are rejected even when absent from artifact', () => {
  const meta = state([
    existingVariable({ description: marker('removed.path') }),
    existingVariable({ id: 'v2', name: 'other', description: marker('removed.path') }),
  ]);
  assert.throws(() => planRestSync(artifact(), meta), /Duplicate sourcePath identity.*removed.path/);
  for (const description of [`${marker('x')} ${marker('y')}`, '[avenue:sourcePath=%zz]', '[avenue:sourcePath=]', '[avenue:sourcePath=x']) {
    assert.throws(() => planRestSync(artifact(), state([existingVariable({ description })])), /marker/);
  }
  assert.throws(() => planRestSync(artifact([variable({ description: marker('x') })]), empty()), /reserved identity marker/);
});

test('type, collection, and occupied-name conflicts block all writes', () => {
  assert.throws(() => planRestSync(artifact(), state([existingVariable({ resolvedType: 'STRING', valuesByMode: { m1: '8' } })])), /RESOLVED_TYPE_MISMATCH.*STRING.*FLOAT/);
  assert.throws(() => planRestSync(artifact(), state([existingVariable({ variableCollectionId: 'c2', valuesByMode: { m2: 8 } })], [collection(), collection({ id: 'c2', name: 'Other', defaultModeId: 'm2', modes: [{ modeId: 'm2', name: 'Light' }] })])), /COLLECTION_MISMATCH/);
  assert.throws(() => planRestSync(artifact([variable({ name: 'occupied' })]), state([existingVariable(), existingVariable({ id: 'v2', name: 'occupied', description: '' })])), /NAME_OCCUPIED/);
});

test('collection, mode and variable name ambiguity is rejected', () => {
  assert.throws(() => planRestSync(artifact(), state([], [collection(), collection({ id: 'c2', defaultModeId: 'm2', modes: [{ modeId: 'm2', name: 'Light' }] })])), /ambiguous local collection/);
  assert.throws(() => planRestSync(artifact(), state([], [collection({ modes: [{ modeId: 'm1', name: 'Light' }, { modeId: 'm2', name: 'Light' }] })])), /ambiguous mode/);
  assert.throws(() => planRestSync(artifact(), state([existingVariable(), existingVariable({ id: 'v2', description: '' })])), /ambiguous variable/);
});

test('unrelated variables, removed tokens, remote collections and remote variables are preserved', () => {
  const remote = collection({ id: 'remoteC', remote: true, defaultModeId: 'remoteM', modes: [{ modeId: 'remoteM', name: 'Light' }] });
  const meta = state([
    existingVariable(),
    existingVariable({ id: 'unrelated', name: 'unrelated', description: '' }),
    existingVariable({ id: 'removed', name: 'removed', description: marker('removed') }),
    existingVariable({ id: 'remoteV', variableCollectionId: 'remoteC', remote: true, valuesByMode: { remoteM: 8 } }),
    existingVariable({ id: 'remoteInLocal', remote: true }),
  ], [collection(), remote]);
  assert.equal(writes(planRestSync(artifact(), meta).payload).length, 0);
  const changed = artifact([variable({ valuesByMode: { Light: 22 } })]);
  const after = apply(meta, planRestSync(changed, meta).payload);
  for (const id of ['unrelated', 'removed', 'remoteV', 'remoteInLocal']) assert.deepEqual(after.variables[id], meta.variables[id]);
  assert.deepEqual(after.variableCollections, meta.variableCollections);
  const remoteOnly = state([meta.variables.remoteV], [remote]);
  assert.equal(planRestSync(artifact(), remoteOnly).payload.variableCollections.length, 1, 'remote collection is not selected by name');
});

test('extended collections are rejected even when unrelated or remote', () => {
  for (const overrides of [{}, { name: 'Unrelated' }, { remote: true }]) {
    const meta = state([], [collection({ ...overrides, isExtension: true })]);
    assert.throws(() => planRestSync(artifact(), meta), /Extended collection.*is not supported/);
  }
});

test('deleted-but-referenced variables and collections are rejected before adoption or filtering', () => {
  for (const overrides of [{}, { name: 'unrelated', description: '' }, { remote: true }]) {
    const meta = state([existingVariable({ ...overrides, deletedButReferenced: true })]);
    assert.throws(() => planRestSync(artifact(), meta), /Variable "v1" is deleted but still referenced/);
  }
  const meta = state([], [collection({ deletedButReferenced: true })]);
  assert.throws(() => planRestSync(artifact(), meta), /Collection "Tokens" is deleted but still referenced/);
});

test('explicitly false extension and deleted flags do not block ordinary snapshots', () => {
  const meta = state(
    [existingVariable({ deletedButReferenced: false })],
    [collection({ isExtension: false, deletedButReferenced: false })],
  );
  assert.equal(writes(planRestSync(artifact(), meta).payload).length, 0);
  assert.equal(verifyRestSync(artifact(), meta).matches, true);
});

test('effect styles are validated, counted, and omitted from planner', () => {
  const input = artifact();
  input.styles = { effects: [{ name: 'shadow', sourcePath: 'shadow', effects: [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.5 }, offset: { x: 0, y: 2 }, radius: 4, spread: 0, visible: true, blendMode: 'NORMAL' }] }] };
  const result = planRestSync(input, empty());
  assert.equal(result.ignoredEffectStyles, 1);
  assert.equal(result.plan.counts.effectStyles.create, 0);
  assert.ok(result.plan.operations.every((operation) => !operation.kind.includes('EffectStyle')));
  input.styles.effects[0].effects[0].radius = 'bad';
  assert.throws(() => planRestSync(input, empty()), (error) => error.issues.some((issue) => issue.path.endsWith('.radius')));
});

test('invalid artifacts and oversized UTF-8 payloads are rejected', () => {
  assert.throws(() => planRestSync({}, empty()), /Invalid Avenue Figma artifact/);
  assert.throws(() => planRestSync(artifact([variable({ valuesByMode: { Light: NaN } })]), empty()), (error) => error.issues.some((issue) => issue.code === 'INVALID_VALUE'));
  assert.throws(() => planRestSync(artifact([variable({ aliasOf: 'missing' })]), empty()), (error) => error.issues.some((issue) => issue.code === 'MISSING_ALIAS_TARGET'));
  assert.throws(() => planRestSync(artifact([variable({ description: '🌈'.repeat(1024 * 1024) })]), empty()), /4 MB/);
});

test('API input validation fails closed', () => {
  const invalid = [null, {}, { variableCollections: [], variables: {} }, { status: 403, meta: empty() }, { error: true, meta: empty() }];
  for (const item of invalid) assert.throws(() => planRestSync(artifact(), item), /Figma REST sync/);
  const mutations = [
    (meta) => { delete meta.variables.v1.remote; },
    (meta) => { meta.variables.v1.id = 'wrong'; },
    (meta) => { meta.variables.v1.variableCollectionId = 'missing'; },
    (meta) => { meta.variables.v1.valuesByMode = { missing: 8 }; },
    (meta) => { meta.variables.v1.valuesByMode.m1 = Infinity; },
    (meta) => { meta.variables.v1.valuesByMode.m1 = { type: 'VARIABLE_ALIAS', id: 'missing' }; },
    (meta) => { meta.variables.v1.description = null; },
    (meta) => { meta.variables.v1.scopes = 'ALL_SCOPES'; },
    (meta) => { meta.variables.v1.resolvedType = 'EASING'; },
    (meta) => { meta.variableCollections.c1.defaultModeId = 'missing'; },
    (meta) => { meta.variableCollections.c1.modes = []; },
    (meta) => { meta.variableCollections.c1.remote = 'false'; },
  ];
  for (const mutate of mutations) {
    const meta = state();
    mutate(meta);
    assert.throws(() => planRestSync(artifact(), meta), /Figma REST sync/);
  }
  for (const channel of [-1, 2, NaN, undefined]) {
    const meta = state([existingVariable({ resolvedType: 'COLOR', valuesByMode: { m1: { r: channel, g: 0, b: 0, a: 1 } } })]);
    assert.throws(() => planRestSync(artifact(), meta), /must be in \[0, 1\]/);
  }
});

test('mode and variable capacity includes existing entries', () => {
  const modes = Array.from({ length: 40 }, (_, index) => ({ modeId: `m${index + 1}`, name: index === 0 ? 'Light' : `Mode ${index}` }));
  const meta = state([], [collection({ modes })]);
  const input = artifact([variable({ valuesByMode: { Light: 8, Extra: 16 } })], ['Light', 'Extra']);
  assert.throws(() => planRestSync(input, meta), /including existing modes/);
  assert.doesNotThrow(() => planRestSync(artifact(), meta));
  const vars = Array.from({ length: 5000 }, (_, index) => existingVariable({ id: `v${index}`, name: `existing/${index}`, description: '' }));
  assert.throws(() => planRestSync(artifact(), state(vars)), /including existing variables/);
  assert.doesNotThrow(() => planRestSync(artifact([variable({ name: 'existing/0' })]), state(vars)));
  const tooMany = artifact([variable({ valuesByMode: Object.fromEntries(Array.from({ length: 41 }, (_, index) => [`Mode ${index}`, 8])) })], Array.from({ length: 41 }, (_, index) => `Mode ${index}`));
  assert.throws(() => planRestSync(tooMany, empty()), /40 modes/);
});

test('new mode on an existing collection uses CREATE; aliases can target existing IDs', () => {
  const input = artifact([
    variable({ valuesByMode: { Light: 8, Dark: 16 } }),
    variable({ name: 'alias', sourcePath: 'alias', aliasOf: 'spacing.base', valuesByMode: { Light: 8, Dark: 16 } }),
  ], ['Light', 'Dark']);
  const { payload } = planRestSync(input, state());
  assert.equal(payload.variableCollections.length, 0);
  assert.equal(payload.variableModes[0].action, 'CREATE');
  assert.equal(payload.variableModes[0].variableCollectionId, 'c1');
  assert.deepEqual(payload.variableModeValues.at(-1).value, { type: 'VARIABLE_ALIAS', id: 'v1' });
  assert.equal(verifyRestSync(input, apply(state(), payload)).matches, true);
});
