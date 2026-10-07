// Source-only executable contract specimen. No runtime imports or I/O adapters.
import assert from 'node:assert/strict';

const canonical = value => JSON.stringify(value, function (_key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
    : item;
});

function applyObservation(previous, observation) {
  assert.ok(['present', 'absent', 'unavailable'].includes(observation.kind));
  assert.equal(observation.source.system, 'shopify');
  assert.ok(observation.source.storeKey);
  assert.match(observation.source.draftGid, /^gid:\/\/shopify\/DraftOrder\/\d+$/);
  if (previous) assert.deepEqual(observation.source, previous.source);
  // Uncertain transport/completeness never changes source lifecycle or watermark.
  if (observation.kind === 'unavailable') return previous;
  assert.equal(observation.authorized, true);
  assert.equal(observation.success, true);
  assert.equal(observation.complete, true);
  assert.ok(observation.observationId);
  const time = Date.parse(observation.observedAt);
  assert.ok(Number.isFinite(time));
  const fingerprint = canonical(observation);
  if (previous) {
    const priorTime = Date.parse(previous.observedAt);
    if (time < priorTime) return previous;
    if (time === priorTime) {
      assert.equal(fingerprint, previous.fingerprint, 'conflicting source observation');
      return previous;
    }
  }
  if (observation.kind === 'present') assert.ok(observation.snapshot);
  else assert.ok(previous, 'absence cannot fabricate a never-observed request');
  return {
    source: structuredClone(observation.source),
    observedAt: observation.observedAt,
    observationId: observation.observationId,
    fingerprint,
    lifecycle: observation.kind === 'present' ? 'observed' : 'source_unavailable',
    demandEligible: observation.kind === 'present',
    firstAbsentAt: observation.kind === 'present' ? null
      : previous.firstAbsentAt ?? observation.observedAt,
    snapshot: structuredClone(observation.kind === 'present'
      ? observation.snapshot : previous.snapshot)
    // Deliberately no expiresAt, purge action or inferred fulfilled/paid state.
  };
}

const source = { system: 'shopify', storeKey: 'synthetic-store',
  draftGid: 'gid://shopify/DraftOrder/100' };
const snapshot = {
  customer: { id: 'synthetic-customer', name: 'Synthetic Fixture',
    email: 'customer@fixture.invalid', phone: 'synthetic-phone' },
  items: [{ kind: 'custom', title: 'Synthetic custom request', quantity: 2, price: '12.00' }],
  notes: 'Synthetic full request context', noteAttributes: [{ name: 'fixture', value: 'only' }],
  tags: ['order-request', 'pending']
};
const event = (kind, day, extra = {}) => ({ source, kind,
  observationId: `fixture-${kind}-${day}`, observedAt: `2026-01-${String(day).padStart(2, '0')}T00:00:00Z`,
  authorized: true, success: true, complete: true, ...extra });

const first = event('present', 1, { snapshot });
const observed = applyObservation(null, first);
assert.deepEqual(observed.snapshot, snapshot);
assert.equal(observed.firstAbsentAt, null);
assert.equal(observed.demandEligible, true);
assert.equal(applyObservation(observed, structuredClone(first)), observed);
assert.throws(() => applyObservation(observed, event('absent', 1)), /conflicting/);

for (const failure of [
  event('unavailable', 5, { authorized: false, success: false }),
  event('unavailable', 5, { complete: false })
]) {
  assert.equal(applyObservation(observed, failure), observed);
  assert.equal(observed.firstAbsentAt, null);
}
assert.throws(() => applyObservation(observed, event('absent', 2, { complete: false })));
assert.throws(() => applyObservation(observed, event('absent', 2, { authorized: false })));
assert.throws(() => applyObservation(null, event('absent', 2)), /never-observed/);

const absent = applyObservation(observed, event('absent', 2));
assert.equal(absent.lifecycle, 'source_unavailable');
assert.equal(absent.demandEligible, false);
assert.equal(absent.firstAbsentAt, '2026-01-02T00:00:00Z');
assert.deepEqual(absent.snapshot, snapshot);
assert.equal(applyObservation(absent, event('present', 1, { snapshot })), absent);
const repeated = applyObservation(absent, event('absent', 3));
assert.equal(repeated.firstAbsentAt, absent.firstAbsentAt);
assert.equal(applyObservation(repeated, event('unavailable', 5)), repeated);

const updatedSnapshot = { ...snapshot, notes: 'Synthetic updated full context' };
const restored = applyObservation(repeated, event('present', 4, { snapshot: updatedSnapshot }));
assert.equal(restored.lifecycle, 'observed');
assert.equal(restored.firstAbsentAt, null);
assert.equal(restored.demandEligible, true);
assert.deepEqual(restored.snapshot, updatedSnapshot);
const missingAgain = applyObservation(restored, event('absent', 6));
assert.equal(missingAgain.firstAbsentAt, '2026-01-06T00:00:00Z');
assert.throws(() => applyObservation(restored, event('absent', 6, {
  source: { ...source, draftGid: 'gid://shopify/DraftOrder/101' }
})));
for (const state of [observed, absent, repeated, restored, missingAgain]) {
  assert.equal('expiresAt' in state, false);
  assert.equal('purge' in state, false);
  assert.equal('fulfilled' in state, false);
  assert.equal('paid' in state, false);
}
assert.deepEqual(observed.snapshot, snapshot, 'later transitions never mutate prior context');
console.log('PASS: synthetic observation lifecycle, completeness, replay, identity and no-expiry invariants');
