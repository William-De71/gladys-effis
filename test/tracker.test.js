// What counts as new: a level change, a fire, a burnt area; the first
// reading of a place is a baseline.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTracker, FIRE_MEMORY_MS } from '../src/tracker.js';

const fire = (ids, lat, lon = 5) => ({ ids, lat, lon, first: 0, last: 0, count: ids.length });

test('danger: baseline, then each change', () => {
  const tracker = createTracker();
  assert.equal(tracker.danger('p', { day: 'd1', level: 1 }), null, 'baseline');
  assert.equal(tracker.danger('p', { day: 'd1', level: 1 }), null);
  assert.deepEqual(tracker.danger('p', { day: 'd2', level: 3 }), { from: 1, to: 3 });
  assert.deepEqual(tracker.danger('p', { day: 'd2', level: 2 }), { from: 3, to: 2 });
  assert.equal(tracker.danger('p', null), null, 'an unknown day changes nothing');
  tracker.forget('p');
  assert.equal(tracker.danger('p', { day: 'd3', level: 5 }), null, 'baseline again');
});

test('fires: baseline, a new one, the same fire seen again', () => {
  const tracker = createTracker();
  const now = 1_000_000;
  assert.deepEqual(tracker.fires('p', [fire(['a'], 43)], now), [], 'baseline');
  // Same hotspot, or a new hotspot 1 km away (another satellite pass).
  assert.deepEqual(tracker.fires('p', [fire(['a', 'b'], 43)], now + 1), []);
  assert.deepEqual(tracker.fires('p', [fire(['c'], 43.01)], now + 2), []);
  // 20 km away: a new fire.
  const fresh = tracker.fires('p', [fire(['c'], 43.01), fire(['d'], 43.2)], now + 3);
  assert.deepEqual(
    fresh.map((f) => f.ids),
    [['d']],
  );
  // Two days later, the old fire is forgotten: a new hotspot there is new.
  const later = tracker.fires('p', [fire(['e'], 43)], now + FIRE_MEMORY_MS + 10);
  assert.deepEqual(
    later.map((f) => f.ids),
    [['e']],
  );
});

test('burnt areas: baseline, then the new ids', () => {
  const tracker = createTracker();
  assert.deepEqual(tracker.burnt('p', [{ id: '1' }]), []);
  assert.deepEqual(
    tracker.burnt('p', [{ id: '1' }, { id: '2' }]).map((a) => a.id),
    ['2'],
  );
  assert.deepEqual(tracker.burnt('q', [{ id: '2' }]), [], 'each place has its baseline');
});
