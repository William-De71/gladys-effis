// The manifest, tied to the code: type, versions, permissions, store limits,
// and every key users store (they are forever: this test lists them on
// purpose, a change here needs a migration).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { TRIGGERS, SCENE_ACTIONS, DAYS } from '../src/events.js';
import { ACTIONS } from '../src/app.js';
import { WIDGETS, DAYS as WIDGET_DAYS } from '../src/widgets.js';
import { RADII, DEFAULT_RADIUS, AUTO_LANGUAGE, MAX_PLACES } from '../src/config.js';
import { LEVELS } from '../src/danger.js';
import { LANGUAGES } from '../src/i18n.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const keys = (list) => list.map((entry) => entry.key);

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'EFFIS');
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/william-de71/gladys-effis:${pkg.version}`);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/William-De71/gladys-effis/main/cover.jpg',
  );
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.deepEqual(manifest.categories, ['environment', 'security']);
  assert.equal(manifest.countries, undefined, 'the fire danger covers the world');
});

test('cloud only, the houses as only permission, EFFIS as only server', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.equal(manifest.location, true);
  for (const key of ['network_wake', 'containers', 'network_discovery', 'webhooks']) {
    assert.equal(manifest[key], undefined, key);
  }
  const api = source('../src/effis-api.js');
  assert.match(api, /https:\/\/api\.effis\.emergency\.copernicus\.eu/);
  assert.match(api, /https:\/\/maps\.effis\.emergency\.copernicus\.eu\/gwis/);
  for (const file of [
    'app',
    'watcher',
    'tracker',
    'device',
    'events',
    'widgets',
    'geo',
    'danger',
    'config',
  ]) {
    assert.doesNotMatch(source(`../src/${file}.js`), /fetch\(|https:\/\//, file);
  }
});

test('the keys users store', () => {
  assert.deepEqual(keys(manifest.config_schema), [
    'intro',
    'places',
    'house_1',
    'coords_1',
    'place_2_section',
    'house_2',
    'coords_2',
    'place_3_section',
    'house_3',
    'coords_3',
    'options',
    'radius',
    'language',
  ]);
  assert.equal(MAX_PLACES, 3);
  assert.deepEqual(keys(manifest.actions), Object.values(ACTIONS));
  assert.deepEqual(keys(manifest.widgets), Object.values(WIDGETS));
  assert.deepEqual(keys(manifest.scene_triggers), Object.values(TRIGGERS));
  assert.deepEqual(keys(manifest.scene_actions), Object.values(SCENE_ACTIONS));
  const triggers = byKey(manifest.scene_triggers);
  const fields = (key) => byKey(triggers.get(key).fields);
  const variables = (key) => keys(triggers.get(key).variables);
  assert.deepEqual([...fields('danger_level_changed').keys()], ['device', 'level', 'change']);
  assert.deepEqual(values(fields('danger_level_changed').get('level')), LEVELS);
  assert.deepEqual(values(fields('danger_level_changed').get('change')), ['up', 'down']);
  assert.deepEqual(variables('danger_level_changed'), [
    'device_name',
    'level',
    'level_label',
    'previous_level',
    'previous_level_label',
    'change',
    'fwi',
    'summary',
  ]);
  assert.deepEqual([...fields('fire_detected').keys()], ['device']);
  assert.deepEqual(variables('fire_detected'), [
    'device_name',
    'distance_km',
    'direction',
    'direction_label',
    'detected_at',
    'hotspots',
    'latitude',
    'longitude',
    'danger_level',
    'summary',
  ]);
  assert.deepEqual(variables('burnt_area_mapped'), [
    'device_name',
    'area_ha',
    'commune',
    'province',
    'country',
    'fire_date',
    'distance_km',
    'direction',
    'direction_label',
    'summary',
  ]);
  const action = manifest.scene_actions[0];
  assert.deepEqual(keys(action.fields), ['device', 'day']);
  assert.deepEqual(values(byKey(action.fields).get('day')), DAYS);
  assert.deepEqual(keys(action.outputs), [
    'device_name',
    'date',
    'fwi',
    'level',
    'level_label',
    'fires_nearby',
    'nearest_fire_km',
    'summary',
  ]);
  const app = source('../src/app.js');
  assert.match(app, /onWidgetGet\(WIDGETS\.DANGER/);
  assert.match(app, /onWidgetGet\(WIDGETS\.FIRES/);
  assert.match(app, /onSceneAction\(SCENE_ACTIONS\.GET_FIRE_DANGER/);
  assert.match(app, /onAction\(ACTIONS\.CHECK_PLACES/);
});

test('mirrors the bounds and values of the code', () => {
  const config = byKey(manifest.config_schema);
  assert.deepEqual(values(config.get('radius')).map(Number), RADII);
  assert.equal(Number(config.get('radius').default), DEFAULT_RADIUS);
  assert.deepEqual(values(config.get('language')), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.equal(config.get('house_1').source, 'houses');
  const days = byKey(byKey(manifest.widgets).get('danger').settings).get('days');
  assert.deepEqual(
    [days.min, days.max, days.default],
    [WIDGET_DAYS.min, WIDGET_DAYS.max, WIDGET_DAYS.default],
  );
});

test('limits of the store: sizes, timeouts, catalog fields', () => {
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  for (const action of [...manifest.scene_actions, ...manifest.actions]) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
  }
  for (const widget of manifest.widgets) {
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type), setting.key);
    }
  }
  assert.ok(manifest.keywords.length >= 1 && manifest.keywords.length <= 10);
  const normalized = manifest.keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.equal(new Set(normalized).size, normalized.length, 'keywords are unique');
  for (const keyword of normalized) assert.ok(keyword.length >= 2 && keyword.length <= 30, keyword);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
});
