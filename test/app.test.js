// The integration end to end, against the fake Gladys of the SDK (it checks
// the devices and the states like the host API does) and a fake of EFFIS
// serving recorded answers: places, devices and states, the reading rhythm,
// the scene triggers, the scene action, the widgets, the status.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createApp } from '../src/app.js';
import { TRIGGERS } from '../src/events.js';
import { WIDGETS } from '../src/widgets.js';
import {
  fakeFetch,
  silent,
  NOW,
  HOUR,
  BARCELONA,
  PYRENEES,
  EMPTY_HOTSPOTS_XML,
  HOTSPOTS_XML,
} from './helpers/fixtures.js';

const HOUSE = {
  selector: 'barcelona',
  name: 'Casa',
  latitude: BARCELONA.lat,
  longitude: BARCELONA.lon,
};
const DEVICE = 'ext:test-integration:place:house-barcelona';

/**
 * @description A started integration on a controllable clock.
 * @param {object} [options] - `{ config, houses, fetch }`.
 * @returns {Promise<object>} `{ gladys, app, fetch, clock }`.
 */
async function startApp({
  config = { house_1: 'barcelona', language: 'fr' },
  houses = [HOUSE],
  fetch = fakeFetch(),
} = {}) {
  const clock = { now: NOW };
  const gladys = createFakeGladys({ config, houses });
  const app = createApp(gladys, {
    fetchImpl: fetch,
    now: () => clock.now,
    sleep: async (ms) => {
      clock.now += ms;
    },
    timezone: 'Europe/Paris',
    clock: false,
    logger: silent,
  });
  await gladys.connect();
  return { gladys, app, fetch, clock };
}

const created = async (gladys, externalId = DEVICE) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  await gladys.fake.deviceCreated(device);
};
const eventsOf = (gladys, key) => gladys.fake.sceneEvents.filter((event) => event.key === key);
const content = async (gladys, key, options = {}) =>
  (await gladys.fake.widgetGet(key, options)).data.content;
const kinds = (fetch) =>
  fetch.calls.map((url) =>
    url.includes('/charts/') ? 'danger' : url.includes('/gwis?') ? 'hotspots' : 'burnt',
  );

test('a house becomes a device with five read-only features', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const [device] = gladys.fake.discoveredDevices;
  assert.deepEqual(
    [device.external_id, device.name, device.should_poll],
    [DEVICE, 'EFFIS Casa', false],
  );
  assert.deepEqual(
    device.features.map((f) => [
      f.external_id.split(':').pop(),
      f.category,
      f.type,
      f.min,
      f.max,
      f.read_only,
    ]),
    [
      ['fwi', 'risk', 'integer', 0, 200, true],
      ['danger', 'risk', 'integer', 0, 5, true],
      ['danger_tomorrow', 'risk', 'integer', 0, 5, true],
      ['fires', 'counter-sensor', 'integer', 0, 999, true],
      ['situation', 'text', 'text', 0, 0, true],
    ],
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(gladys.fake.connectionStatus.message.fr, /EFFIS lu pour 1 lieu/);
});

test('creating the device publishes its states', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys);
  // Today is the 2nd day served (from yesterday): FWI 18, moderate; tomorrow 25, high.
  assert.equal(gladys.fake.lastState(`${DEVICE}:fwi`), 18);
  assert.equal(gladys.fake.lastState(`${DEVICE}:danger`), 1);
  assert.equal(gladys.fake.lastState(`${DEVICE}:danger_tomorrow`), 2);
  assert.ok(gladys.fake.lastState(`${DEVICE}:fires`) >= 1);
  assert.match(
    gladys.fake.lastState(`${DEVICE}:situation`),
    /^Danger d’incendie aujourd’hui : Modéré \(FWI 18\)\. \d+ feu\(x\) vu\(s\) par satellite en 24 h, le plus proche à \d+ km /,
  );
});

test('reading rhythm: danger every 3 h, hotspots every 30 min, burnt areas every hour, 2 s apart', async (t) => {
  const { gladys, app, fetch, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(kinds(fetch), ['danger', 'hotspots', 'burnt']);
  assert.match(fetch.calls[2], /firedate__gte=2026-11-08/, 'the last 7 days at first');
  const started = clock.now;
  clock.now = started + 29 * 60000;
  await app.watcher.round();
  assert.equal(fetch.calls.length, 3, 'nothing due yet');
  clock.now = started + 31 * 60000;
  await app.watcher.round();
  assert.deepEqual(kinds(fetch).slice(3), ['hotspots']);
  clock.now = started + 61 * 60000;
  await app.watcher.round();
  assert.deepEqual(kinds(fetch).slice(4), ['hotspots', 'burnt']);
  assert.match(fetch.calls.at(-1), /lastupdate__gte=2026-11-14/, 'then only the updates');
  clock.now = started + 181 * 60000;
  await app.watcher.round();
  assert.ok(kinds(fetch).slice(6).includes('danger'));
});

test('danger level changed: a trigger with the new level, never at the first reading', async (t) => {
  let fwi = 18;
  const fetch = fakeFetch({ fwi: (index) => (index === 1 ? fwi : 5) });
  const { gladys, app, clock } = await startApp({ fetch });
  t.after(() => gladys.fake.shutdown());
  assert.equal(eventsOf(gladys, TRIGGERS.DANGER_LEVEL_CHANGED).length, 0, 'baseline');
  fwi = 41;
  clock.now += 3 * HOUR + 60000;
  await app.watcher.round();
  const [event] = eventsOf(gladys, TRIGGERS.DANGER_LEVEL_CHANGED);
  assert.deepEqual(
    [
      event.data.device,
      event.data.level,
      event.data.previous_level,
      event.data.change,
      event.data.fwi,
    ],
    [DEVICE, 'very_high', 'moderate', 'up', 41],
  );
  assert.equal(event.data.summary, 'Le danger d’incendie monte à Casa : Très élevé (FWI 41).');
});

test('fire detected: a new fire within the radius, once', async (t) => {
  let xml = EMPTY_HOTSPOTS_XML;
  const fetch = fakeFetch({ hotspots: () => xml });
  const { gladys, app, clock } = await startApp({ fetch });
  t.after(() => gladys.fake.shutdown());
  xml = HOTSPOTS_XML;
  clock.now += 31 * 60000;
  await app.watcher.round();
  const fires = eventsOf(gladys, TRIGGERS.FIRE_DETECTED);
  assert.ok(fires.length >= 1);
  const [first] = fires;
  assert.equal(first.data.device, DEVICE);
  assert.ok(first.data.distance_km <= 25);
  assert.match(first.data.detected_at, /^2026-11-1[45] \d{2}:\d{2}$/);
  assert.match(first.data.summary, /^Feu vu par satellite à \d+ km (au |à l’)/);
  clock.now += 31 * 60000;
  await app.watcher.round();
  assert.equal(eventsOf(gladys, TRIGGERS.FIRE_DETECTED).length, fires.length, 'not twice');
});

test('burnt area mapped: a new area within the radius', async (t) => {
  let results = [];
  const fetch = fakeFetch({ burnt: () => ({ count: results.length, next: null, results }) });
  const { gladys, app, clock } = await startApp({
    config: { coords_1: `${PYRENEES.lat}, ${PYRENEES.lon}`, language: 'fr' },
    fetch,
  });
  t.after(() => gladys.fake.shutdown());
  const { BURNT } = await import('./helpers/fixtures.js');
  results = BURNT.results.filter((area) => area.commune === 'Béost');
  clock.now += 61 * 60000;
  await app.watcher.round();
  const events = eventsOf(gladys, TRIGGERS.BURNT_AREA_MAPPED);
  assert.ok(events.length >= 1);
  assert.equal(events[0].data.commune, 'Béost');
  assert.equal(events[0].data.country, 'FR');
  assert.match(
    events[0].data.summary,
    /^EFFIS a cartographié une surface brûlée de \d+ ha à Béost/,
  );
});

test('the scene action: today, tomorrow, the day after', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const tomorrow = (await gladys.fake.sceneAction('get_fire_danger', { day: 'tomorrow' })).data
    .outputs;
  assert.deepEqual(
    [tomorrow.date, tomorrow.fwi, tomorrow.level, tomorrow.level_label],
    ['2026-11-16', 25.3, 'high', 'Élevé'],
  );
  assert.ok(tomorrow.fires_nearby >= 1 && tomorrow.nearest_fire_km > 0);
  assert.match(tomorrow.summary, /^Danger d’incendie demain à Casa : Élevé \(FWI 25\)\./);
  const outputs = (await gladys.fake.sceneAction('get_fire_danger', { device: DEVICE })).data
    .outputs;
  assert.equal(outputs.date, '2026-11-15');
});

test('the widgets: valid, the source credited', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const danger = await content(gladys, WIDGETS.DANGER, {
    language: 'fr',
    settings: { device: DEVICE, days: 5 },
  });
  assert.deepEqual(validateWidgetContent(danger), []);
  assert.equal(danger.components[0].text, 'Danger : Modéré');
  assert.match(danger.components[1].text, /Source : EFFIS \(Copernicus\)/);
  assert.equal(danger.components[2].items.length, 5);
  const fires = await content(gladys, WIDGETS.FIRES, { language: 'en' });
  assert.deepEqual(validateWidgetContent(fires), []);
  assert.match(fires.components[0].text, /active fire/);
  assert.match(fires.components[1].text, /Within 25 km · Source: EFFIS/);
});

test('places that cannot be used: a house without a position, wrong coordinates', async (t) => {
  const { gladys } = await startApp({
    config: { house_1: 'nowhere', coords_2: 'Marseille' },
    houses: [{ selector: 'nowhere', name: 'Chalet' }],
  });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.discoveredDevices.length, 0);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /The house “Chalet” has no position/);
  const answer = (await gladys.fake.action('check_places')).data.message.en;
  assert.match(answer, /Coordinates “Marseille” not understood/);
  const widget = await content(gladys, WIDGETS.DANGER, { language: 'en' });
  assert.match(widget.components[0].text, /has no position/);
});

test('EFFIS down: the status says so, the last data stays', async (t) => {
  let down = false;
  const fetch = fakeFetch({ status: () => (down ? 503 : 200) });
  const { gladys, app, clock } = await startApp({ fetch });
  t.after(() => gladys.fake.shutdown());
  down = true;
  clock.now += 3 * HOUR + 60000;
  await app.watcher.round();
  assert.match(gladys.fake.connectionStatus.message.en, /does not answer for now/);
  const widget = await content(gladys, WIDGETS.DANGER, { language: 'en' });
  assert.equal(widget.components[0].text, 'Danger: Moderate');
});

test('no place: the status asks for one', async (t) => {
  const { gladys } = await startApp({ config: {} });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /Aucun lieu/);
});
