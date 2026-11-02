import test from 'node:test';
import assert from 'node:assert/strict';
import { syncFigma } from '../src/figma-sync.js';
import { planRestSync } from '../src/figma-rest.ts';

const FILE_KEY = 'SandboxFile_123-abc';
const TOKEN = 'figd_mock-secret-never-log';
const BASE = `https://api.figma.com/v1/files/${FILE_KEY}/variables`;
const options = (overrides = {}) => ({ artifact: artifact(), fileKey: FILE_KEY, token: TOKEN, ...overrides });
const artifact = () => ({
  format: 'avenue-figma-variables',
  $schemaVersion: '0.3.0',
  collections: [{
    name: 'Tokens', modes: [{ name: 'Light' }],
    variables: [{
      name: 'spacing/base', sourcePath: 'spacing.base', resolvedType: 'FLOAT',
      scopes: ['ALL_SCOPES'], valuesByMode: { Light: 16 },
    }],
  }],
});
const empty = () => ({ variableCollections: {}, variables: {} });
function state(value = 8) {
  return {
    variableCollections: {
      'VariableCollectionId:1:1': {
        id: 'VariableCollectionId:1:1', key: 'collection-key', name: 'Tokens',
        remote: false, defaultModeId: '1:0', modes: [{ modeId: '1:0', name: 'Light' }],
        variableIds: ['VariableID:1:2'], hiddenFromPublishing: false,
      },
    },
    variables: {
      'VariableID:1:2': {
        id: 'VariableID:1:2', key: 'variable-key', variableCollectionId: 'VariableCollectionId:1:1',
        name: 'spacing/base', remote: false, resolvedType: 'FLOAT',
        description: '[avenue:sourcePath=spacing.base]', scopes: ['ALL_SCOPES'],
        valuesByMode: { '1:0': value }, hiddenFromPublishing: false, codeSyntax: {},
      },
    },
  };
}
const envelope = (meta) => ({ status: 200, error: false, meta });
const json = (body, init) => Response.json(body, init);
const read = (meta) => ['GET', () => json(envelope(meta))];
const accepted = () => json(envelope({ tempIdToRealId: {} }));

// Every request must consume a scripted step. No fallback to native fetch exists.
function scriptedFetch(steps, events = []) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, ...init });
    events.push(init.method);
    const step = steps[calls.length - 1];
    assert.ok(step, `Unexpected request #${calls.length}: ${init.method}`);
    const [method, respond] = step;
    assert.equal(init.method, method);
    assert.equal(url, `${BASE}${method === 'GET' ? '/local' : ''}`);
    return respond({ url, ...init });
  };
  return {
    calls, fetchImpl,
    done() { assert.equal(calls.length, steps.length, 'all expected requests must have occurred'); },
  };
}
function assertRedacted(error) {
  const rendered = `${error}\n${error.stack}\n${JSON.stringify(error)}`;
  for (const secret of [TOKEN, 'private-server-body', 'private-request-body']) {
    assert.ok(!rendered.includes(secret), `error must not expose ${secret}`);
  }
  assert.equal(error.cause, undefined, 'raw network errors must not escape through cause');
}

test('default dry run reads and plans without POST or verification', async () => {
  const events = [];
  const initial = envelope(empty());
  const network = scriptedFetch([['GET', () => json(initial)]], events);
  let savedPlan;
  const result = await syncFigma(options({
    fetchImpl: network.fetchImpl,
    onSnapshot: async (snapshot) => {
      await Promise.resolve();
      assert.deepEqual(snapshot, initial);
      events.push('snapshot');
    },
    onPlan: async (plan) => {
      await Promise.resolve();
      savedPlan = plan;
      events.push('plan');
    },
  }));
  network.done();
  assert.deepEqual(events, ['GET', 'snapshot', 'plan']);
  assert.equal(result.applied, false);
  assert.equal(result.verified, false);
  assert.equal(result.plan.counts.variables.create, 1);
  assert.deepEqual(result.payload, savedPlan.payload);
  assert.equal(result.payload.variables[0].action, 'CREATE');
  assert.equal(result.ignoredEffectStyles, 0);
  const request = network.calls[0];
  assert.deepEqual(request.headers, { 'X-Figma-Token': TOKEN });
  assert.equal(request.body, undefined);
  assert.equal(request.redirect, 'error');
  assert.ok(request.signal instanceof AbortSignal);
});

test('apply awaits read/snapshot/plan/read/snapshot/POST/read and verifies real state', async () => {
  const events = [];
  const initial = state();
  const current = structuredClone(initial);
  let server = structuredClone(current);
  let savedPlan;
  const snapshots = [];
  const network = scriptedFetch([
    read(initial), read(current),
    ['POST', (request) => {
      assert.equal(request.headers['X-Figma-Token'], TOKEN);
      assert.equal(request.headers['Content-Type'], 'application/json');
      assert.equal(request.redirect, 'error');
      assert.ok(request.signal instanceof AbortSignal);
      const payload = JSON.parse(request.body);
      assert.deepEqual(payload, savedPlan.payload);
      assert.deepEqual(payload.variableModeValues, [{ variableId: 'VariableID:1:2', modeId: '1:0', value: 16 }]);
      assert.deepEqual(payload.variables, []);
      for (const mutation of payload.variableModeValues) {
        server.variables[mutation.variableId].valuesByMode[mutation.modeId] = mutation.value;
      }
      return accepted();
    }],
    ['GET', () => json(envelope(server))],
  ], events);
  const result = await syncFigma(options({
    apply: true, fetchImpl: network.fetchImpl,
    onSnapshot: async (snapshot) => {
      await Promise.resolve();
      snapshots.push(snapshot);
      events.push('snapshot');
    },
    onPlan: async (plan) => {
      await Promise.resolve();
      savedPlan = plan;
      events.push('plan');
    },
  }));
  network.done();
  assert.deepEqual(events, ['GET', 'snapshot', 'plan', 'GET', 'snapshot', 'POST', 'GET']);
  assert.deepEqual(snapshots, [envelope(initial), envelope(current)]);
  assert.equal(result.applied, true);
  assert.equal(result.verified, true);
  assert.equal(result.plan.counts.variables.update, 1);
  assert.deepEqual(result.payload, savedPlan.payload);
  assert.equal(initial.variables['VariableID:1:2'].valuesByMode['1:0'], 8);
});

test('apply no-op performs only the initial read and never POSTs', async () => {
  const network = scriptedFetch([read(state(16))]);
  const result = await syncFigma(options({ apply: true, fetchImpl: network.fetchImpl }));
  network.done();
  assert.equal(result.applied, false);
  assert.equal(result.verified, false);
  assert.equal(result.plan.operations.length, 0);
  assert.ok(Object.values(result.payload).every((entries) => entries.length === 0));
});

test('a changed pre-write plan aborts before POST', async () => {
  // Another writer has already set the desired value, changing our planned writes.
  const network = scriptedFetch([read(state(8)), read(state(16))]);
  await assert.rejects(syncFigma(options({ apply: true, fetchImpl: network.fetchImpl })), /changed during planning.*No write was sent/);
  network.done();
  assert.ok(network.calls.every((call) => call.method === 'GET'));
});

test('snapshot value changing from 8 to 9 aborts even though desired 16 produces the same payload', async () => {
  const initial = state(8);
  const current = state(9);
  const planned = planRestSync(artifact(), initial);
  assert.deepEqual(planned.payload.variableModeValues, [{ variableId: 'VariableID:1:2', modeId: '1:0', value: 16 }]);
  assert.deepEqual(planRestSync(artifact(), current).payload, planned.payload);
  const network = scriptedFetch([read(initial), read(current)]);
  await assert.rejects(syncFigma(options({ apply: true, fetchImpl: network.fetchImpl })), /changed during planning.*No write was sent/);
  network.done();
  assert.deepEqual(network.calls.map((call) => call.method), ['GET', 'GET']);
});

test('changes to snapshot metadata outside the planned payload also abort before POST', async () => {
  const initial = state();
  const current = structuredClone(initial);
  current.variables['VariableID:1:2'].codeSyntax.WEB = 'var(--changed-by-another-writer)';
  assert.deepEqual(planRestSync(artifact(), current).payload, planRestSync(artifact(), initial).payload);
  const network = scriptedFetch([read(initial), read(current)]);
  await assert.rejects(syncFigma(options({ apply: true, fetchImpl: network.fetchImpl })), /changed during planning.*No write was sent/);
  network.done();
  assert.deepEqual(network.calls.map((call) => call.method), ['GET', 'GET']);
});

test('object key reordering throughout the snapshot allows POST and successful verification', async () => {
  function reverseKeys(value) {
    if (Array.isArray(value)) return value.map(reverseKeys);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reverseKeys(entry)]));
    }
    return value;
  }
  const initial = envelope(state());
  const current = reverseKeys(initial);
  assert.deepEqual(current, initial);
  assert.notEqual(JSON.stringify(current), JSON.stringify(initial));
  assert.notDeepEqual(Object.keys(current.meta.variables['VariableID:1:2']), Object.keys(initial.meta.variables['VariableID:1:2']));
  const network = scriptedFetch([
    ['GET', () => json(initial)],
    ['GET', () => json(current)],
    ['POST', accepted],
    read(state(16)),
  ]);
  const result = await syncFigma(options({ apply: true, fetchImpl: network.fetchImpl }));
  network.done();
  assert.deepEqual(network.calls.map((call) => call.method), ['GET', 'GET', 'POST', 'GET']);
  assert.equal(result.applied, true);
  assert.equal(result.verified, true);
});

test('array reordering remains a snapshot change even when the write payload is unchanged', async () => {
  const initial = state();
  initial.variableCollections['VariableCollectionId:1:1'].modes.push({ modeId: '1:1', name: 'Dark' });
  const current = structuredClone(initial);
  current.variableCollections['VariableCollectionId:1:1'].modes.reverse();
  assert.deepEqual(planRestSync(artifact(), current).payload, planRestSync(artifact(), initial).payload);
  const network = scriptedFetch([read(initial), read(current)]);
  await assert.rejects(syncFigma(options({ apply: true, fetchImpl: network.fetchImpl })), /changed during planning.*No write was sent/);
  network.done();
  assert.deepEqual(network.calls.map((call) => call.method), ['GET', 'GET']);
});

test('accepted POST with remaining read-back changes fails verification without another write', async () => {
  const network = scriptedFetch([read(state()), read(state()), ['POST', accepted], read(state())]);
  await assert.rejects(syncFigma(options({ apply: true, fetchImpl: network.fetchImpl })), /accepted the write.*verification found remaining changes.*do not assume synchronization completed/);
  network.done();
  assert.equal(network.calls.filter((call) => call.method === 'POST').length, 1);
});

test('ambiguous POST network failure is redacted and never retried, even if committed', async () => {
  let committed = false;
  const network = scriptedFetch([
    read(state()), read(state()),
    ['POST', () => {
      committed = true;
      throw new TypeError(`Socket lost after commit: ${TOKEN} private-request-body`);
    }],
  ]);
  await assert.rejects(syncFigma(options({ apply: true, fetchImpl: network.fetchImpl })), (error) => {
    assert.match(error.message, /Figma POST request failed or timed out.*write outcome is unknown.*dry run before retrying/);
    assertRedacted(error);
    return true;
  });
  network.done();
  assert.equal(committed, true);
  assert.deepEqual(network.calls.map((call) => call.method), ['GET', 'GET', 'POST']);
});

test('POST timeout uses the abort signal and never retries an ambiguous write', async (t) => {
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    timeouts.push(milliseconds);
    // Deliver the timeout deterministically instead of waiting thirty seconds.
    return timeouts.length === 3
      ? AbortSignal.abort(new DOMException(`Timeout ${TOKEN}`, 'TimeoutError'))
      : new AbortController().signal;
  });
  const network = scriptedFetch([
    read(state()), read(state()),
    ['POST', ({ signal }) => {
      assert.equal(signal.aborted, true);
      signal.throwIfAborted();
    }],
  ]);
  await assert.rejects(syncFigma(options({ apply: true, fetchImpl: network.fetchImpl })), (error) => {
    assert.match(error.message, /POST request failed or timed out.*write outcome is unknown/);
    assertRedacted(error);
    return true;
  });
  network.done();
  assert.deepEqual(timeouts, [30_000, 30_000, 30_000]);
});

for (const status of [403, 429]) {
  for (const method of ['GET', 'POST']) {
    test(`HTTP ${status} on ${method} provides guidance, redacts body, and does not retry`, async () => {
      const response = json({ error: true, status, message: `${TOKEN} private-server-body private-request-body` }, {
        status, headers: status === 429 ? { 'Retry-After': '60' } : {},
      });
      const steps = method === 'GET' ? [] : [read(state()), read(state())];
      steps.push([method, () => response]);
      const network = scriptedFetch(steps);
      await assert.rejects(syncFigma(options({ apply: true, fetchImpl: network.fetchImpl })), (error) => {
        assert.match(error.message, new RegExp(`Figma ${method} returned HTTP ${status}`));
        assert.match(error.message, status === 403 ? /Enterprise eligibility, Full seat, token scopes, and file permissions/ : /Rate limited\. Retry after 60/);
        assertRedacted(error);
        return true;
      });
      network.done();
      assert.equal(response.bodyUsed, false, 'raw error bodies must not even be read');
      assert.equal(network.calls.filter((call) => call.method === 'POST').length, method === 'POST' ? 1 : 0);
    });
  }
}

test('429 without Retry-After uses safe fallback guidance', async () => {
  const network = scriptedFetch([['GET', () => json({ error: true }, { status: 429 })]]);
  await assert.rejects(syncFigma(options({ fetchImpl: network.fetchImpl })), /Retry after the server's requested interval/);
  network.done();
});

test('missing credentials and invalid file keys reject before any request or callback', async (t) => {
  const invalid = [
    ...[undefined, null, '', '  ', 123, {}].map((token) => ({ token, pattern: /FIGMA_ACCESS_TOKEN is required/ })),
    ...[undefined, null, '', ' ', 'https://www.figma.com/design/abc/File', '../abc', 'abc/def', 'abc?token=secret', 'abc#fragment', 'abc%2fdef', 'abc\n'].map((fileKey) => ({ fileKey, pattern: /FIGMA_FILE_KEY must be a file key, not a URL/ })),
  ];
  for (const [index, { pattern, ...overrides }] of invalid.entries()) {
    await t.test(`invalid input ${index + 1}`, async () => {
      const fetchImpl = t.mock.fn(() => { throw new Error('fetch must not be reached'); });
      const onSnapshot = t.mock.fn();
      const onPlan = t.mock.fn();
      await assert.rejects(syncFigma(options({ ...overrides, fetchImpl, onSnapshot, onPlan })), pattern);
      assert.equal(fetchImpl.mock.callCount(), 0);
      assert.equal(onSnapshot.mock.callCount(), 0);
      assert.equal(onPlan.mock.callCount(), 0);
    });
  }
});

test('GET network failure is redacted and stops before planning or writing', async () => {
  const network = scriptedFetch([['GET', () => { throw new Error(`Network ${TOKEN} private-server-body`); }]]);
  await assert.rejects(syncFigma(options({ apply: true, fetchImpl: network.fetchImpl })), (error) => {
    assert.match(error.message, /GET request failed or timed out.*Check network access and retry/);
    assertRedacted(error);
    return true;
  });
  network.done();
});

for (const stage of ['initial read', 'pre-write read', 'verification read']) {
  test(`network failure during ${stage} stops without retrying or reporting success`, async () => {
    const steps = stage === 'initial read' ? [] : [read(state())];
    if (stage === 'verification read') steps.push(read(state()), ['POST', accepted]);
    steps.push(['GET', () => { throw new Error('offline'); }]);
    const network = scriptedFetch(steps);
    await assert.rejects(syncFigma(options({ apply: true, fetchImpl: network.fetchImpl })), /GET request failed or timed out/);
    network.done();
    assert.equal(network.calls.filter((call) => call.method === 'POST').length, stage === 'verification read' ? 1 : 0);
  });
}

for (const method of ['GET', 'POST']) {
  test(`invalid JSON on ${method} is redacted and not retried`, async () => {
    const steps = method === 'GET' ? [] : [read(state()), read(state())];
    steps.push([method, () => new Response(`private-server-body ${TOKEN}`, { status: 200 })]);
    const network = scriptedFetch(steps);
    await assert.rejects(syncFigma(options({ apply: true, fetchImpl: network.fetchImpl })), (error) => {
      assert.match(error.message, new RegExp(`Figma ${method} returned invalid JSON.*dry run before retrying`));
      assertRedacted(error);
      return true;
    });
    network.done();
  });

  test(`API error inside HTTP 200 on ${method} is redacted and not retried`, async () => {
    const steps = method === 'GET' ? [] : [read(state()), read(state())];
    steps.push([method, () => json({ error: true, status: 400, message: `private-server-body ${TOKEN}` })]);
    const network = scriptedFetch(steps);
    await assert.rejects(syncFigma(options({ apply: true, fetchImpl: network.fetchImpl })), (error) => {
      assert.match(error.message, new RegExp(`Figma ${method} reported an API error`));
      assertRedacted(error);
      return true;
    });
    network.done();
  });
}

for (const hook of ['onSnapshot', 'onPlan']) {
  test(`failure to save ${hook} aborts before any write`, async () => {
    const network = scriptedFetch([read(state())]);
    await assert.rejects(syncFigma(options({
      apply: true, fetchImpl: network.fetchImpl,
      [hook]: async () => { throw new Error('Cannot save audit output'); },
    })), /Cannot save audit output/);
    network.done();
  });
}
