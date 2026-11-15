// The widgets and the scene payloads on recorded data: what the core keeps
// (validateWidgetContent), the budget of a card, the limits of a scene event,
// exactly the declared variables and outputs, in every language.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { buildDangerWidget, buildFiresWidget, readDays } from '../src/widgets.js';
import { dangerEvent, fireEvent, burntEvent, dangerOutputs, TRIGGERS } from '../src/events.js';
import { buildPlaceStates, situationText } from '../src/device.js';
import { parseDanger, parseHotspots, parseBurntArea } from '../src/effis-api.js';
import { dangerOn } from '../src/danger.js';
import { clusterHotspots, within } from '../src/geo.js';
import { LANGUAGES } from '../src/i18n.js';
import { DANGER, HOTSPOTS_XML, BURNT, BARCELONA, PYRENEES } from './helpers/fixtures.js';

const TZ = 'Europe/Paris';
const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const declared = (key) =>
  [...manifest.scene_triggers, ...manifest.scene_actions].find((entry) => entry.key === key);
const gladys = {
  externalIds: (type, id) => ({
    device: `ext:t:${type}:${id}`,
    feature: (k) => `ext:t:${type}:${id}:${k}`,
  }),
};
const days = parseDanger(DANGER);
const TODAY = '2026-07-30';

/**
 * @description A snapshot like the watcher's, on recorded data.
 * @param {object} place - `{ lat, lon }`.
 * @param {object} [options] - `{ today, hotspots, areas }`.
 * @returns {object} The snapshot.
 */
function snapshotAt(
  place,
  { today = TODAY, hotspots = parseHotspots(HOTSPOTS_XML), areas = BURNT.results } = {},
) {
  return {
    place: { id: 'house-main', label: 'Casa', ...place },
    radius: 50,
    days,
    today: dangerOn(days, today),
    tomorrow: dangerOn(days, '2026-07-31'),
    fires: within(place, clusterHotspots(hotspots), 50),
    burntAreas: within(place, areas.map(parseBurntArea).filter(Boolean), 50),
  };
}

/**
 * @description Check a payload: flat, scalars, sizes, exactly the declared keys.
 * @param {object} data - The payload.
 * @param {string} key - The trigger or action.
 * @param {string[]} [extra] - Keys outside the declaration (the device filter).
 */
function checkPayload(data, key, extra = []) {
  const entry = declared(key);
  const expected = [...(entry.variables ?? entry.outputs).map((v) => v.key), ...extra].sort();
  assert.deepEqual(Object.keys(data).sort(), expected, key);
  assert.ok(Object.keys(data).length <= 30);
  for (const v of entry.variables ?? entry.outputs) {
    assert.equal(typeof data[v.key], v.type, `${key}.${v.key}`);
  }
  for (const value of Object.values(data)) {
    if (typeof value === 'string') assert.ok(value.length <= 1000);
    if (typeof value === 'number') assert.ok(Number.isFinite(value));
  }
}

test('the danger widget: valid every day of the recorded fortnight, in every language', () => {
  const snapshot = snapshotAt(BARCELONA);
  for (const language of LANGUAGES) {
    for (const entry of days) {
      for (const count of [3, 7, 9]) {
        const content = buildDangerWidget({
          snapshot,
          today: entry.day,
          language,
          settings: { days: count },
        });
        assert.deepEqual(validateWidgetContent(content), [], `${language} ${entry.day}`);
      }
    }
  }
  const content = buildDangerWidget({
    snapshot,
    today: TODAY,
    language: 'fr',
    settings: { days: 3 },
  });
  assert.equal(content.components[0].text, 'Danger : Très élevé');
  assert.deepEqual(
    content.components[2].items.map((item) => [item.label, item.value, item.color]),
    [
      ['Aujourd’hui', 'Très élevé · 44', 'danger'],
      ['Demain', 'Très élevé · 46', 'danger'],
      ['sam. 1 août', 'Très élevé · 41', 'danger'],
    ],
  );
  assert.equal(readDays('12'), 9);
  assert.equal(readDays(undefined), 7);
});

test('the fires widget: fires, then burnt areas; nothing nearby', () => {
  for (const language of LANGUAGES) {
    for (const place of [BARCELONA, PYRENEES, { lat: 60, lon: 25 }]) {
      const content = buildFiresWidget({ snapshot: snapshotAt(place), language, timezone: TZ });
      assert.deepEqual(validateWidgetContent(content), [], language);
    }
  }
  const pyrenees = buildFiresWidget({
    snapshot: snapshotAt(PYRENEES),
    language: 'fr',
    timezone: TZ,
  });
  const rows = pyrenees.components[2].items;
  assert.ok(rows.some((row) => row.icon === 'map' && /ha · \d+ km · \d+ nov\./.test(row.value)));
  const nothing = buildFiresWidget({
    snapshot: snapshotAt({ lat: 60, lon: 25 }),
    language: 'en',
    timezone: TZ,
  });
  assert.deepEqual(
    nothing.components.map((c) => c.text),
    ['No active fire', 'Within 50 km · Source: EFFIS (Copernicus)'],
  );
});

test('the scene events and the action: declared keys, limits, every language', () => {
  const snapshot = snapshotAt(BARCELONA);
  assert.ok(snapshot.fires.length > 0);
  for (const language of LANGUAGES) {
    const danger = dangerEvent(gladys, snapshot, { from: 1, to: 3 }, language);
    checkPayload(danger.data, TRIGGERS.DANGER_LEVEL_CHANGED, ['device']);
    for (const fire of snapshot.fires) {
      checkPayload(fireEvent(gladys, snapshot, fire, language, TZ).data, TRIGGERS.FIRE_DETECTED, [
        'device',
      ]);
    }
    const pyrenees = snapshotAt(PYRENEES);
    for (const area of pyrenees.burntAreas) {
      checkPayload(
        burntEvent(gladys, pyrenees, area, language, TZ).data,
        TRIGGERS.BURNT_AREA_MAPPED,
        ['device'],
      );
    }
    for (const day of ['today', 'tomorrow', 'day_after', 'nonsense']) {
      checkPayload(dangerOutputs(gladys, snapshot, { day }, language, TODAY), 'get_fire_danger');
    }
  }
  const fr = dangerEvent(gladys, snapshot, { from: 1, to: 3 }, 'fr').data;
  assert.equal(fr.summary, 'Le danger d’incendie monte à Casa : Très élevé (FWI 44).');
  const unknown = dangerOutputs(gladys, { ...snapshot, days: [] }, {}, 'en', TODAY);
  assert.deepEqual([unknown.fwi, unknown.level], [-1, '']);
});

test('the device states: five values, the situation in words', () => {
  const states = buildPlaceStates(gladys, snapshotAt(BARCELONA), 'en');
  assert.deepEqual(
    states.map((s) => s.device_feature_external_id.split(':').pop()),
    ['fwi', 'danger', 'danger_tomorrow', 'fires', 'situation'],
  );
  assert.deepEqual(
    states.slice(0, 3).map((s) => s.state),
    [44, 3, 3],
  );
  const quiet = situationText(snapshotAt({ lat: 60, lon: 25 }), 'de');
  assert.equal(
    quiet,
    'Waldbrandgefahr heute: Sehr hoch (FWI 44). Kein Brand per Satellit im Umkreis von 50 km in 24 h.',
  );
  const noData = buildPlaceStates(
    gladys,
    { ...snapshotAt(BARCELONA), today: null, tomorrow: null, fires: null },
    'en',
  );
  assert.deepEqual(
    noData.map((s) => s.device_feature_external_id.split(':').pop()),
    ['situation'],
    'unknown values are not sent',
  );
});
