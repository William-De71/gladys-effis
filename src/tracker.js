// -----------------------------------------------------------------------------
// What changed between two readings, per place (pure logic, memory only):
//
//   - `danger_level_changed`  the danger level of today is not the one of the
//                             last reading (a new forecast, or a new day);
//   - `fire_detected`         a fire (a group of hotspots) within the radius
//                             that was not seen before: none of its hotspots
//                             is known, and no fire known in the last 48 hours
//                             lies within 4 km of it (the same fire seen
//                             again by another satellite pass);
//   - `burnt_area_mapped`     a burnt area EFFIS mapped within the radius,
//                             not seen before.
//
// The first reading of a place is a baseline: no event replays a fire or a
// level already there when the integration starts or a place is added. The
// rootfs is read-only and nothing is stored: a restart is a new baseline.
// -----------------------------------------------------------------------------

import { distanceKm } from './geo.js';

const SAME_FIRE_KM = 4;
const FIRE_MEMORY_MS = 48 * 3600 * 1000;

/**
 * @description Create the tracker.
 * @returns {object} The tracker.
 */
function createTracker() {
  // place id -> { level, day }
  const levels = new Map();
  // place id -> { ids: Set, fires: [{ lat, lon, at }] }
  const fires = new Map();
  // place id -> Set of burnt area ids (null: no baseline yet)
  const burnt = new Map();

  return {
    /**
     * @param {string} placeId - The place.
     * @param {{ day: string, level: number }|null} today - The danger of today.
     * @returns {{ from: number, to: number }|null} The change, null when none.
     */
    danger(placeId, today) {
      if (!today) return null;
      const before = levels.get(placeId);
      levels.set(placeId, { level: today.level, day: today.day });
      if (!before || before.level === today.level) return null;
      return { from: before.level, to: today.level };
    },

    /**
     * @param {string} placeId - The place.
     * @param {Array<object>} nearby - The fires within the radius (clusters).
     * @param {number} now - Now, in ms.
     * @returns {Array<object>} The new fires.
     */
    fires(placeId, nearby, now) {
      const known = fires.get(placeId);
      const memory = {
        ids: known?.ids ?? new Set(),
        fires: (known?.fires ?? []).filter((f) => now - f.at < FIRE_MEMORY_MS),
      };
      const fresh = known
        ? nearby.filter(
            (fire) =>
              !fire.ids.some((id) => memory.ids.has(id)) &&
              !memory.fires.some((other) => distanceKm(other, fire) <= SAME_FIRE_KM),
          )
        : [];
      for (const fire of nearby) {
        fire.ids.forEach((id) => memory.ids.add(id));
        memory.fires.push({ lat: fire.lat, lon: fire.lon, at: now });
      }
      // Hotspot ids live 24 hours in the source: keep the set from growing.
      if (memory.ids.size > 5000) memory.ids = new Set([...memory.ids].slice(-2000));
      fires.set(placeId, memory);
      return fresh;
    },

    /**
     * @param {string} placeId - The place.
     * @param {Array<object>} nearby - The burnt areas within the radius.
     * @returns {Array<object>} The new ones.
     */
    burnt(placeId, nearby) {
      const known = burnt.get(placeId);
      const fresh = known ? nearby.filter((area) => !known.has(area.id)) : [];
      burnt.set(placeId, new Set([...(known ?? []), ...nearby.map((area) => area.id)]));
      return fresh;
    },

    /** @param {string} placeId - A place removed or moved: a new baseline. */
    forget(placeId) {
      levels.delete(placeId);
      fires.delete(placeId);
      burnt.delete(placeId);
    },
  };
}

export { SAME_FIRE_KM, FIRE_MEMORY_MS, createTracker };
