// The EFFIS client on recorded answers: what it reads, the error kinds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEffisClient, parseHotspots, parseBurntArea, parseDanger } from '../src/effis-api.js';
import { fakeFetch, HOTSPOTS_XML, BURNT, DANGER } from './helpers/fixtures.js';

test('fire danger: one entry a day, the FWI and its components', async () => {
  const fetch = fakeFetch();
  const client = createEffisClient({ fetch, userAgent: 'test' });
  const days = await client.danger({ lat: 43.2965, lon: 5.3698 }, '2026-11-14', '2026-11-24');
  assert.equal(days.length, 11);
  assert.deepEqual(Object.keys(days[0]), ['day', 'fwi', 'isi', 'bui', 'ffmc', 'dmc', 'dc']);
  assert.equal(days[0].day, '2026-11-14');
  assert.match(
    fetch.calls[0],
    /model=ecmwf&day_gte=2026-11-14&day_lte=2026-11-24&point=\(5\.3698%2043\.2965\)$/,
  );
  const raw = parseDanger(DANGER);
  assert.equal(raw[0].day, '2026-07-25');
  assert.ok(raw.every((day) => typeof day.fwi === 'number'));
  assert.throws(() => parseDanger({}), { kind: 'unexpected' });
});

test('hotspots: id, position and UTC time of the recorded GML', () => {
  const hotspots = parseHotspots(HOTSPOTS_XML);
  assert.equal(hotspots.length, 62);
  const first = hotspots[0];
  assert.deepEqual(Object.keys(first), ['id', 'lat', 'lon', 'at']);
  assert.ok(hotspots.every((h) => h.lat > 35 && h.lat < 45 && h.lon > -11 && h.lon < 5));
  const times = hotspots.map((h) => h.at).sort();
  assert.equal(new Date(times[0]).toISOString(), '2026-11-14T21:45:00.000Z');
  assert.throws(() => parseHotspots('<ows:ExceptionReport>'), { kind: 'unexpected' });
  assert.throws(() => parseHotspots('<html>'), { kind: 'unexpected' });
});

test('burnt areas: commune, area, fire date; N.A. is empty', () => {
  const areas = BURNT.results.map(parseBurntArea);
  assert.equal(areas.length, 20);
  assert.deepEqual([areas[0].commune, areas[0].country, areas[0].area], ['Béost', 'FR', 36]);
  assert.equal(
    parseBurntArea({
      id: 1,
      centroid: { coordinates: [5, 36] },
      firedate: '2026-11-12T11:34:00+01:00',
      commune: 'N.A.',
    }).commune,
    '',
  );
  assert.equal(parseBurntArea({ id: 2 }), null);
});

test('burnt areas: by fire date, or updated since a day', async () => {
  const fetch = fakeFetch();
  const client = createEffisClient({ fetch });
  await client.burntAreas('2026-11-08');
  await client.burntAreas('2026-11-14', { updated: true });
  assert.match(fetch.calls[0], /\?firedate__gte=2026-11-08&limit=100&offset=0$/);
  assert.match(fetch.calls[1], /\?lastupdate__gte=2026-11-14&limit=100&offset=0$/);
});

test('error kinds', async () => {
  const kind = async (fetch) => {
    try {
      await createEffisClient({ fetch }).danger({ lat: 1, lon: 2 }, '2026-11-14', '2026-11-15');
      return 'none';
    } catch (err) {
      return err.kind;
    }
  };
  assert.equal(await kind(fakeFetch({ status: () => 503 })), 'unavailable');
  assert.equal(await kind(fakeFetch({ status: () => 429 })), 'unavailable');
  assert.equal(await kind(fakeFetch({ status: () => 404 })), 'unexpected');
  assert.equal(
    await kind(async () => {
      throw new Error('ECONNRESET');
    }),
    'unreachable',
  );
  assert.equal(
    await kind(async () => ({ status: 200, ok: true, text: async () => '<html>' })),
    'unexpected',
  );
});
