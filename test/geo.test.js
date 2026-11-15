// Places, distances, directions, hotspots grouped into fires; danger levels.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceKm,
  directionOf,
  boxAround,
  parseCoordinates,
  placeId,
  clusterHotspots,
  within,
} from '../src/geo.js';
import { levelOf, dangerOn, forecastFrom, LEVELS } from '../src/danger.js';
import { parseHotspots } from '../src/effis-api.js';
import { HOTSPOTS_XML, BARCELONA } from './helpers/fixtures.js';

test('distances and directions', () => {
  // Marseille -> Aix-en-Provence: about 25 km to the north.
  const marseille = { lat: 43.2965, lon: 5.3698 };
  const aix = { lat: 43.5297, lon: 5.4474 };
  assert.ok(Math.abs(distanceKm(marseille, aix) - 26.6) < 0.5);
  assert.equal(directionOf(marseille, aix), 'n');
  assert.equal(directionOf(marseille, { lat: 43.2965, lon: 6 }), 'e');
  assert.equal(directionOf(marseille, { lat: 43, lon: 5 }), 'sw');
  const box = boxAround(marseille, 25);
  assert.ok(box.south < 43.08 && box.north > 43.51 && box.west < 5.07 && box.east > 5.67);
});

test('coordinates typed by hand', () => {
  assert.deepEqual(parseCoordinates('43.2965, 5.3698'), { lat: 43.2965, lon: 5.3698 });
  assert.deepEqual(parseCoordinates('43.2965 5.3698'), { lat: 43.2965, lon: 5.3698 });
  assert.deepEqual(parseCoordinates('43,2965; 5,3698'), { lat: 43.2965, lon: 5.3698 });
  assert.deepEqual(parseCoordinates('-33.9, -70.6'), { lat: -33.9, lon: -70.6 });
  for (const wrong of ['', 'Marseille', '95, 5', '43.2, 190', '43.2']) {
    assert.equal(parseCoordinates(wrong), null, wrong);
  }
});

test('place ids: the house selector, or the coordinates to about 100 m', () => {
  assert.equal(placeId({ house: 'main-house', lat: 1, lon: 2 }), 'house-main-house');
  assert.equal(placeId({ house: null, lat: 43.29651, lon: 5.36982 }), 'point-n43297-e5370');
  assert.equal(placeId({ house: null, lat: -33.9, lon: -70.6 }), 'point-s33900-w70600');
});

test('hotspots closer than 2 km are one fire; nearest first', () => {
  const fires = clusterHotspots([
    { id: 'a', lat: 43, lon: 5, at: 1 },
    { id: 'b', lat: 43.01, lon: 5.01, at: 3 },
    { id: 'c', lat: 43.2, lon: 5, at: 2 },
  ]);
  assert.equal(fires.length, 2);
  assert.deepEqual(fires[0].ids, ['a', 'b']);
  assert.deepEqual([fires[0].first, fires[0].last, fires[0].count], [1, 3, 2]);
  const recorded = clusterHotspots(parseHotspots(HOTSPOTS_XML));
  assert.ok(recorded.length > 10 && recorded.length < 62);
  const near = within(BARCELONA, recorded, 25);
  assert.ok(near.length >= 1);
  assert.ok(near.every((fire, i) => i === 0 || near[i - 1].distance <= fire.distance));
  assert.ok(near.every((fire) => fire.distance <= 25 && typeof fire.direction === 'string'));
});

test('danger levels of the EFFIS legend', () => {
  assert.deepEqual(
    [0, 11.1, 11.2, 21.3, 37.9, 38, 50, 69.9, 70, 120].map(levelOf),
    [0, 0, 1, 2, 2, 3, 4, 4, 5, 5],
  );
  assert.equal(levelOf(null), null);
  assert.equal(LEVELS[levelOf(24)], 'high');
  const days = [
    { day: '2026-11-14', fwi: 3 },
    { day: '2026-11-15', fwi: 24.44 },
    { day: '2026-11-16', fwi: 55 },
    { day: '2026-11-17', fwi: null },
  ];
  assert.deepEqual(dangerOn(days, '2026-11-15'), { day: '2026-11-15', fwi: 24.4, level: 2 });
  assert.equal(dangerOn(days, '2026-11-17'), null);
  assert.deepEqual(
    forecastFrom(days, '2026-11-15', 5).map((d) => d.level),
    [2, 4],
  );
});
