// -----------------------------------------------------------------------------
// The EFFIS integration: every handler, registered on a Gladys client.
//
// Brings the European Forest Fire Information System (Copernicus Emergency
// Management Service) into Gladys, for up to three places (a house of Gladys
// or coordinates):
//   - a device per place: Fire Weather Index and danger level of today, danger
//     of tomorrow, fires seen by satellite nearby, the situation as a
//     sentence (device.js);
//   - scene triggers: danger level changed, fire detected nearby, burnt area
//     mapped nearby (tracker.js, events.js);
//   - a scene action: the fire danger of a place, today to the day after;
//   - two dashboard widgets: the danger of the next days, the fires nearby.
//
// EFFIS has no push: the integration reads it on its own clock (watcher.js).
// Transport: cloud only. Nothing is ever written anywhere.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK (test/app.test.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, readLanguage, INTERNAL_KEYS, AUTO_LANGUAGE } from './config.js';
import { createEffisClient } from './effis-api.js';
import { createWatcher } from './watcher.js';
import { createTracker } from './tracker.js';
import { placeId } from './geo.js';
import {
  idsOf,
  placeIdFromExternalId,
  situationText,
  buildPlaceDevice,
  buildPlaceStates,
} from './device.js';
import { SCENE_ACTIONS, dangerEvent, fireEvent, burntEvent, dangerOutputs } from './events.js';
import { WIDGETS, messageContent, buildDangerWidget, buildFiresWidget } from './widgets.js';
import { LANGUAGES, isLanguage, t, all } from './i18n.js';
import { resolveTimezone, localDay } from './time.js';

const { name, version, homepage } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

const ACTIONS = { CHECK_PLACES: 'check_places' };

/**
 * @description The message key and values of a failure.
 * @param {Error} err - An EffisError or a place problem.
 * @param {string} label - The place, as the user knows it.
 * @returns {{ key: string, values: object }} The message.
 */
function problemOf(err, label) {
  switch (err?.kind) {
    case 'house':
      return { key: 'statusHouseNotLocated', values: { house: label } };
    case 'coords':
      return { key: 'statusCoordsInvalid', values: { coords: label } };
    case 'unreachable':
      return { key: 'statusUnreachable', values: {} };
    case 'unavailable':
      return { key: 'statusUnavailable', values: {} };
    default:
      return { key: 'statusUnexpected', values: {} };
  }
}

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetchImpl] - fetch implementation (tests).
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {Function} [options.sleep] - `(ms) => Promise` between two requests (tests).
 * @param {string} [options.timezone] - IANA timezone (default: TZ).
 * @param {boolean} [options.clock] - Start the minute clock (false in tests).
 * @param {object} [options.logger] - Logger.
 * @returns {{ watcher: object, getConfig: Function, places: Function }} Handles for the tests.
 * @example
 * createApp(new GladysIntegration());
 */
function createApp(
  gladys,
  {
    fetchImpl = globalThis.fetch,
    now = () => Date.now(),
    sleep,
    timezone = resolveTimezone(),
    clock = true,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  let language = 'en';
  let createdDevices = new Set();
  let lastStatus = null;
  // The places of the configuration, resolved: `{ id, slot, label, lat, lon,
  // house }`, and the problems of the others.
  let places = [];
  let placeProblems = [];

  const effis = createEffisClient({
    fetch: fetchImpl,
    userAgent: `${name}/${version} (+${homepage})`,
  });
  const tracker = createTracker();
  const today = () => localDay(new Date(now()), timezone);
  const textLanguage = () => (config.language === AUTO_LANGUAGE ? language : config.language);

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (!isLanguage(next) || next === language) return;
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) return;
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  // --- Places ------------------------------------------------------------------------

  /**
   * @description Resolve the places of the configuration into coordinates.
   * @returns {Promise<void>}
   */
  async function resolvePlaces() {
    const resolved = [];
    const problems = [];
    let houses = null;
    for (const entry of config.places) {
      try {
        let place;
        if (entry.coordsText) {
          if (!entry.coords) {
            throw Object.assign(new Error(`Coordinates not understood: ${entry.coordsText}`), {
              kind: 'coords',
              label: entry.coordsText,
            });
          }
          const { lat, lon } = entry.coords;
          place = { lat, lon, house: null, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
        } else {
          if (houses === null) {
            houses = await gladys.getHouses().catch((err) => {
              logger.warn(`Unable to read the houses: ${err.message}`);
              return [];
            });
          }
          const house = houses.find((candidate) => candidate.selector === entry.house);
          const label = house?.name ?? entry.house;
          if (!house || typeof house.latitude !== 'number' || typeof house.longitude !== 'number') {
            throw Object.assign(new Error(`House without a position: ${label}`), {
              kind: 'house',
              label,
            });
          }
          place = { lat: house.latitude, lon: house.longitude, house: house.selector, label };
        }
        const resolvedPlace = { ...place, slot: entry.slot, id: placeId(place) };
        if (!resolved.some((other) => other.id === resolvedPlace.id)) resolved.push(resolvedPlace);
      } catch (err) {
        logger.warn(`Place ${entry.slot} not resolved: ${err.message}`);
        problems.push({ slot: entry.slot, label: err.label ?? String(entry.slot), error: err });
      }
    }
    const kept = new Set(resolved.map((place) => place.id));
    places.filter((place) => !kept.has(place.id)).forEach((place) => tracker.forget(place.id));
    places = resolved;
    placeProblems = problems;
    logger.info(
      `Places: ${resolved.map((place) => `${place.label} (${place.id})`).join('; ') || 'none'}`,
    );
  }

  // --- Devices and states --------------------------------------------------------------

  /** @description Refresh the list of the devices the user created. */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  const snapshots = () => places.map((place) => watcher.snapshot(place)).filter(Boolean);

  /** @description Publish the states of the created devices that changed. */
  async function publishStates() {
    const states = snapshots()
      .filter((snapshot) => createdDevices.has(idsOf(gladys, snapshot.place.id).device))
      .flatMap((snapshot) => buildPlaceStates(gladys, snapshot, textLanguage()));
    if (states.length === 0) return;
    try {
      await gladys.publishChangedStates(states);
    } catch (err) {
      logger.warn(`Unable to publish the states: ${err.message}`);
    }
  }

  /** @description Ask the dashboards to read the widgets again. */
  function refreshWidgets() {
    if (!gladys.connected) return;
    for (const key of Object.values(WIDGETS)) {
      try {
        gladys.requestWidgetRefresh(key);
      } catch (err) {
        logger.warn(`Unable to refresh the widget ${key}: ${err.message}`);
      }
    }
  }

  /**
   * @description Publish a scene event; a failure is only logged.
   * @param {{ key: string, data: object }} event - The event.
   */
  async function publishEvent({ key, data }) {
    logger.info(`${data.device_name}: ${key}`);
    try {
      await gladys.publishSceneEvent(key, data);
    } catch (err) {
      logger.warn(`Unable to publish the scene event ${key}: ${err.message}`);
    }
  }

  /** @description The connection status after a round. */
  async function reportRound() {
    if (config.places.length === 0) {
      await reportStatus(false, all('noPlace'));
      return;
    }
    const failures = [...placeProblems];
    let read = 0;
    let effisError = null;
    for (const place of places) {
      const snapshot = watcher.snapshot(place);
      const errors = watcher.errorsOf(place);
      effisError = effisError ?? errors[0] ?? null;
      if (snapshot && (snapshot.today || snapshot.fires)) read += 1;
      else failures.push({ label: place.label, error: errors[0] ?? { kind: 'unreachable' } });
    }
    if (failures.length === 0 && !effisError) {
      await reportStatus(true, all('statusConnected', { places: read }));
      return;
    }
    const first = failures[0] ?? { label: '', error: effisError };
    const { key, values } = problemOf(first.error, first.label);
    if (read === 0) {
      await reportStatus(false, all(key, values));
      return;
    }
    await reportStatus(
      true,
      all('statusPartial', (lang) => ({
        places: read,
        failed: Math.max(1, failures.length),
        problem: t(key, lang, values),
      })),
    );
  }

  // --- The watcher -----------------------------------------------------------------
  const watcher = createWatcher({
    effis,
    getPlaces: () => places,
    getRadius: () => config.radius,
    timezone,
    now,
    ...(sleep ? { sleep } : {}),
    logger,
    onRound: async (read) => {
      const lang = textLanguage();
      for (const place of places) {
        const snapshot = watcher.snapshot(place);
        if (!snapshot) continue;
        if (read.danger.includes(place.id)) {
          const change = tracker.danger(place.id, snapshot.today);
          if (change) await publishEvent(dangerEvent(gladys, snapshot, change, lang));
        }
        if (read.hotspots.includes(place.id) && snapshot.fires && !snapshot.errors.hotspots) {
          for (const fire of tracker.fires(place.id, snapshot.fires, now())) {
            await publishEvent(fireEvent(gladys, snapshot, fire, lang, timezone));
          }
        }
        if (read.burnt && snapshot.burntAreas && !snapshot.errors.burnt) {
          for (const area of tracker.burnt(place.id, snapshot.burntAreas)) {
            await publishEvent(burntEvent(gladys, snapshot, area, lang, timezone));
          }
        }
      }
      await publishStates();
      refreshWidgets();
      await reportRound();
    },
  });

  /** @description Offer every resolved place on the Discovery screen. */
  async function publishDiscoveredDevices() {
    const devices = places.map((place) => buildPlaceDevice(gladys, place, textLanguage()));
    await gladys.publishDiscoveredDevices(devices);
    return devices.length;
  }

  /**
   * @description The place a widget or a scene action targets: the chosen
   * device, or the first place.
   * @param {unknown} deviceExternalId - The `source: "devices"` value.
   * @returns {object|null} The place.
   */
  function targetPlace(deviceExternalId) {
    const id = placeIdFromExternalId(deviceExternalId);
    return (id && places.find((place) => place.id === id)) || places[0] || null;
  }

  /**
   * @description The content of a widget when there is nothing to show.
   * @param {object|null} place - The target place.
   * @param {string} lang - The language.
   * @returns {object|null} A message content, or null when there is data.
   */
  function emptyWidget(place, lang) {
    if (config.places.length === 0) return messageContent(t('noPlace', lang));
    if (!place) {
      const problem = placeProblems[0];
      const { key, values } = problemOf(problem?.error, problem?.label);
      return messageContent(t(key, lang, values));
    }
    if (!watcher.snapshot(place)) return messageContent(t('notReadYet', lang), 60);
    return null;
  }

  // --- Dashboard widgets -------------------------------------------------------------
  gladys.onWidgetGet(WIDGETS.DANGER, async ({ settings = {}, language: lang } = {}) => {
    rememberLanguage(lang);
    const lng = isLanguage(lang) ? lang : textLanguage();
    const place = targetPlace(settings.device);
    return (
      emptyWidget(place, lng) ??
      buildDangerWidget({
        snapshot: watcher.snapshot(place),
        today: today(),
        language: lng,
        settings,
      })
    );
  });

  gladys.onWidgetGet(WIDGETS.FIRES, async ({ settings = {}, language: lang } = {}) => {
    rememberLanguage(lang);
    const lng = isLanguage(lang) ? lang : textLanguage();
    const place = targetPlace(settings.device);
    return (
      emptyWidget(place, lng) ??
      buildFiresWidget({ snapshot: watcher.snapshot(place), language: lng, timezone })
    );
  });

  // --- Scene action ------------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.GET_FIRE_DANGER, async (fields = {}) => {
    const place = targetPlace(fields.device);
    if (!place) throw new Error('No place is configured, or none could be found');
    if (!watcher.snapshot(place)) await watcher.round();
    const snapshot = watcher.snapshot(place);
    if (!snapshot) throw new Error(`EFFIS could not be read for ${place.label}`);
    return dangerOutputs(gladys, snapshot, fields, textLanguage(), today());
  });

  // --- Device commands ---------------------------------------------------------------
  gladys.onSetValue(async (device, deviceFeature) => {
    throw new Error(`Read-only feature: ${deviceFeature.external_id}`);
  });

  // --- Configuration screen action ---------------------------------------------------
  gladys.onAction(ACTIONS.CHECK_PLACES, async () => {
    if (config.places.length === 0) return all('noPlace');
    await resolvePlaces();
    await watcher.round({ force: true });
    const lines = Object.fromEntries(LANGUAGES.map((lang) => [lang, []]));
    for (const place of places) {
      const snapshot = watcher.snapshot(place);
      for (const lang of LANGUAGES) {
        let situation;
        if (snapshot) {
          situation = situationText(snapshot, lang);
        } else {
          const { key, values } = problemOf({ kind: 'unreachable' }, place.label);
          situation = t(key, lang, values);
        }
        lines[lang].push(
          t('checkPlace', lang, {
            place: place.house
              ? `${place.label} (${place.lat.toFixed(4)}, ${place.lon.toFixed(4)})`
              : place.label,
            situation,
          }),
        );
      }
    }
    for (const problem of placeProblems) {
      const { key, values } = problemOf(problem.error, problem.label);
      for (const lang of LANGUAGES) lines[lang].push(t(key, lang, values));
    }
    await publishDiscoveredDevices().catch(() => {});
    return Object.fromEntries(LANGUAGES.map((lang) => [lang, lines[lang].join('\n')]));
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await resolvePlaces();
    await watcher.round();
    const count = await publishDiscoveredDevices();
    logger.info(`Scan: ${count} place(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the
    // SDK forgot what it sent for this device: send everything known again.
    await publishStates();
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) config = normalizeConfig(fallback);
      logger.error('Unable to read the configuration', err);
    }
  }

  /** @description Resolve the places, read EFFIS and offer the devices. */
  async function refreshAll() {
    await resolvePlaces();
    await watcher.round({ force: true });
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
    await reportRound();
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const radius = config.radius;
    await loadConfig(rawConfig);
    // Another radius: the fires already inside it are a new baseline.
    if (config.radius !== radius) places.forEach((place) => tracker.forget(place.id));
    logger.info(`Configuration updated: radius ${config.radius} km`);
    await refreshAll();
  });

  // --- Connection lifecycle ----------------------------------------------------------
  gladys.on('connected', async () => {
    await loadConfig();
    await refreshCreatedDevices();
    lastStatus = null;
    await refreshAll();
    if (clock) watcher.start();
  });

  gladys.handleShutdown((signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    watcher.stop();
  });

  return { watcher, getConfig: () => config, places: () => places };
}

export { createApp, ACTIONS, problemOf };
