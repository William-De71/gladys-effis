// -----------------------------------------------------------------------------
// The readings of EFFIS, on the integration's own clock (one look a minute):
//
//   - fire danger   per place, every 3 hours and at each new local day (the
//                   forecast is computed once a day: more would add nothing);
//   - hotspots      per place, every 30 minutes (the satellites pass a few
//                   times a day; the layer covers the last 24 hours);
//   - burnt areas   for all the places, every hour: the last 7 days at the
//                   start, then only the areas updated since yesterday.
//
// Never two requests at once, 2 seconds between two, the integration named in
// the User-Agent. A failed reading keeps the last data: it is not "no fire".
// -----------------------------------------------------------------------------

import { addDays } from './dates.js';
import { localDay } from './time.js';
import { boxAround, clusterHotspots, within } from './geo.js';
import { dangerOn } from './danger.js';

const MINUTE = 60 * 1000;
const DANGER_EVERY_MS = 3 * 60 * MINUTE;
const HOTSPOTS_EVERY_MS = 30 * MINUTE;
const BURNT_EVERY_MS = 60 * MINUTE;
const BURNT_DAYS = 7;
const SPACING_MS = 2000;
const TICK_MS = MINUTE;

/**
 * @description Create the watcher.
 * @param {object} options - Options.
 * @param {object} options.effis - The EFFIS client.
 * @param {Function} options.getPlaces - `() => Array<place>`.
 * @param {Function} options.getRadius - `() => number` (km).
 * @param {string} options.timezone - IANA timezone of Gladys.
 * @param {Function} options.onRound - `(round) => Promise` after each round that read something.
 * @param {Function} [options.now] - `() => number` (ms).
 * @param {Function} [options.sleep] - `(ms) => Promise`.
 * @param {object} [options.logger] - Logger.
 * @returns {object} The watcher.
 */
function createWatcher({
  effis,
  getPlaces,
  getRadius,
  timezone,
  onRound,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms).unref?.()),
  logger = null,
}) {
  // place id -> { danger: { days, fetchedAt, day }, hotspots: { all, fetchedAt }, errors: {} }
  const data = new Map();
  const burnt = { areas: new Map(), fetchedAt: 0, error: null };
  let lastRequest = 0;
  let timer = null;
  let running = Promise.resolve();

  const entry = (id) => {
    if (!data.has(id)) data.set(id, { danger: null, hotspots: null, errors: {} });
    return data.get(id);
  };

  const spaced = async (call) => {
    const wait = lastRequest + SPACING_MS - now();
    if (wait > 0) await sleep(wait);
    lastRequest = now();
    return call();
  };

  /**
   * @description Read the fire danger of a place.
   * @param {object} place - The place.
   * @returns {Promise<void>}
   */
  async function readDanger(place) {
    const today = localDay(new Date(now()), timezone);
    const state = entry(place.id);
    try {
      const days = await spaced(() => effis.danger(place, addDays(today, -1), addDays(today, 9)));
      state.danger = { days, fetchedAt: now(), day: today };
      delete state.errors.danger;
    } catch (err) {
      state.errors.danger = err;
      logger?.warn(`EFFIS fire danger, ${place.label}: ${err.kind ?? ''} ${err.message}`);
    }
  }

  /**
   * @description Read the hotspots around a place.
   * @param {object} place - The place.
   * @returns {Promise<void>}
   */
  async function readHotspots(place) {
    const state = entry(place.id);
    try {
      const all = await spaced(() => effis.hotspots(boxAround(place, getRadius())));
      state.hotspots = { all, fetchedAt: now() };
      delete state.errors.hotspots;
    } catch (err) {
      state.errors.hotspots = err;
      logger?.warn(`EFFIS hotspots, ${place.label}: ${err.kind ?? ''} ${err.message}`);
    }
  }

  /**
   * @description Read the burnt areas: 7 days at first, then the updates.
   * @returns {Promise<void>}
   */
  async function readBurnt() {
    const today = localDay(new Date(now()), timezone);
    const first = burnt.fetchedAt === 0;
    try {
      const areas = await spaced(() =>
        first
          ? effis.burntAreas(addDays(today, -BURNT_DAYS))
          : effis.burntAreas(addDays(today, -1), { updated: true }),
      );
      for (const area of areas) burnt.areas.set(area.id, area);
      const oldest = now() - BURNT_DAYS * 24 * 3600 * 1000;
      for (const [id, area] of burnt.areas) {
        if (area.fireDate < oldest) burnt.areas.delete(id);
      }
      burnt.fetchedAt = now();
      burnt.error = null;
    } catch (err) {
      burnt.error = err;
      logger?.warn(`EFFIS burnt areas: ${err.kind ?? ''} ${err.message}`);
    }
  }

  /**
   * @description Read what is due, then call onRound with what was read.
   * @param {object} [options] - `{ force }`: read everything now.
   * @returns {Promise<void>}
   */
  async function roundNow({ force = false } = {}) {
    const places = getPlaces();
    const ids = new Set(places.map((place) => place.id));
    for (const id of [...data.keys()]) if (!ids.has(id)) data.delete(id);
    const today = localDay(new Date(now()), timezone);
    const read = { danger: [], hotspots: [], burnt: false };
    for (const place of places) {
      const state = entry(place.id);
      if (
        force ||
        !state.danger ||
        state.danger.day !== today ||
        now() - state.danger.fetchedAt >= DANGER_EVERY_MS
      ) {
        await readDanger(place);
        read.danger.push(place.id);
      }
      if (force || !state.hotspots || now() - state.hotspots.fetchedAt >= HOTSPOTS_EVERY_MS) {
        await readHotspots(place);
        read.hotspots.push(place.id);
      }
    }
    if (places.length > 0 && (force || now() - burnt.fetchedAt >= BURNT_EVERY_MS)) {
      await readBurnt();
      read.burnt = true;
    }
    if (read.danger.length || read.hotspots.length || read.burnt) {
      await onRound(read);
    }
  }

  /**
   * @description One round at a time.
   * @param {object} [options] - `{ force }`.
   * @returns {Promise<void>}
   */
  function round(options) {
    running = running
      .then(() => roundNow(options))
      .catch((err) => logger?.error('EFFIS round failed', err));
    return running;
  }

  /**
   * @description What is known of a place: today, the forecast, the fires.
   * @param {object} place - The place.
   * @returns {object|null} `{ place, days, today, fires, burntAreas, fetchedAt, errors }`.
   */
  function snapshot(place) {
    const state = data.get(place.id);
    if (!state || (!state.danger && !state.hotspots)) return null;
    const radius = getRadius();
    const today = localDay(new Date(now()), timezone);
    return {
      place,
      radius,
      today: dangerOn(state.danger?.days, today),
      tomorrow: dangerOn(state.danger?.days, addDays(today, 1)),
      days: state.danger?.days ?? [],
      fires: state.hotspots ? within(place, clusterHotspots(state.hotspots.all), radius) : null,
      burntAreas: burnt.fetchedAt ? within(place, [...burnt.areas.values()], radius) : null,
      dangerAt: state.danger?.fetchedAt ?? null,
      firesAt: state.hotspots?.fetchedAt ?? null,
      errors: { ...state.errors, ...(burnt.error ? { burnt: burnt.error } : {}) },
    };
  }

  return {
    round,
    snapshot,
    start() {
      if (timer === null) {
        timer = setInterval(() => round(), TICK_MS);
        timer.unref?.();
      }
    },
    stop() {
      if (timer !== null) clearInterval(timer);
      timer = null;
    },
    /**
     * @param {object} place - The place.
     * @returns {Array<Error>} The errors of its last readings.
     */
    errorsOf(place) {
      return [
        ...Object.values(data.get(place.id)?.errors ?? {}),
        ...(burnt.error ? [burnt.error] : []),
      ];
    },
    /** @returns {boolean} True once something was read. */
    hasData: () => [...data.values()].some((state) => state.danger || state.hotspots),
  };
}

export {
  DANGER_EVERY_MS,
  HOTSPOTS_EVERY_MS,
  BURNT_EVERY_MS,
  BURNT_DAYS,
  SPACING_MS,
  createWatcher,
};
