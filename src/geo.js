// -----------------------------------------------------------------------------
// Places and distances (pure functions).
//
//   - a place is a house of Gladys (its latitude and longitude) or
//     coordinates typed by hand ("43.2965, 5.3698");
//   - distances on the sphere (haversine), the direction of a fire seen from
//     the place on an 8-point compass (keys forever: n, ne, e, se, s, sw, w,
//     nw), and the box of a search radius;
//   - hotspots grouped into fires: two hotspots closer than 2 km belong to
//     the same fire (a fire front is seen as a line of 375 m to 1 km pixels).
// -----------------------------------------------------------------------------

const EARTH_KM = 6371;
const CLUSTER_KM = 2;
const DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

const rad = (degrees) => (degrees * Math.PI) / 180;

/**
 * @description The distance between two points.
 * @param {{ lat: number, lon: number }} a - A point.
 * @param {{ lat: number, lon: number }} b - Another point.
 * @returns {number} Kilometres.
 * @example
 * distanceKm({ lat: 43.3, lon: 5.4 }, { lat: 43.3, lon: 5.5 }); // -> 8.1
 */
function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * @description The direction of a point seen from another one.
 * @param {{ lat: number, lon: number }} from - The place.
 * @param {{ lat: number, lon: number }} to - The fire.
 * @returns {string} n, ne, e, se, s, sw, w or nw.
 */
function directionOf(from, to) {
  const y = Math.sin(rad(to.lon - from.lon)) * Math.cos(rad(to.lat));
  const x =
    Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) -
    Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(rad(to.lon - from.lon));
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return DIRECTIONS[Math.round(bearing / 45) % 8];
}

/**
 * @description The box around a point that holds a circle of a radius.
 * @param {{ lat: number, lon: number }} point - The centre.
 * @param {number} radiusKm - The radius.
 * @returns {{ south: number, west: number, north: number, east: number }} The box.
 */
function boxAround(point, radiusKm) {
  const dLat = (radiusKm / EARTH_KM) * (180 / Math.PI);
  const dLon = dLat / Math.max(0.01, Math.cos(rad(point.lat)));
  return {
    south: Math.max(-90, point.lat - dLat),
    north: Math.min(90, point.lat + dLat),
    west: Math.max(-180, point.lon - dLon),
    east: Math.min(180, point.lon + dLon),
  };
}

/**
 * @description Read coordinates typed by hand: "43.2965, 5.3698",
 * "43.2965 5.3698", "43,2965; 5,3698".
 * @param {unknown} raw - The text.
 * @returns {{ lat: number, lon: number }|null} The point, null when unreadable.
 */
function parseCoordinates(raw) {
  const text = String(raw ?? '').trim();
  const match =
    /^(-?\d{1,2}(?:[.,]\d+)?)\s*[;,\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/.exec(text) ??
    /^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(text);
  if (!match) return null;
  const lat = Number(match[1].replace(',', '.'));
  const lon = Number(match[2].replace(',', '.'));
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/**
 * @description The id of a place: the selector of its house, or its
 * coordinates to about 100 m ("point-n43297-e5370").
 * @param {{ house?: string|null, lat: number, lon: number }} place - The place.
 * @returns {string} The id (lower case letters, digits, hyphens).
 */
function placeId(place) {
  if (place.house) {
    return `house-${String(place.house)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .slice(0, 60)}`;
  }
  const part = (value, plus, minus) =>
    `${value < 0 ? minus : plus}${Math.round(Math.abs(value) * 1000)}`;
  return `point-${part(place.lat, 'n', 's')}-${part(place.lon, 'e', 'w')}`;
}

/**
 * @description Group hotspots into fires: hotspots closer than 2 km to one
 * another (step by step) are one fire.
 * @param {Array<{ id: string, lat: number, lon: number, at: number }>} hotspots - The hotspots.
 * @returns {Array<{ ids: string[], lat: number, lon: number, first: number, last: number, count: number }>} The fires.
 */
function clusterHotspots(hotspots) {
  const groups = [];
  for (const hotspot of hotspots) {
    const near = groups.filter((group) =>
      group.points.some((point) => distanceKm(point, hotspot) <= CLUSTER_KM),
    );
    if (near.length === 0) {
      groups.push({ points: [hotspot] });
    } else {
      near[0].points.push(hotspot);
      for (const other of near.slice(1)) {
        near[0].points.push(...other.points);
        groups.splice(groups.indexOf(other), 1);
      }
    }
  }
  return groups.map(({ points }) => ({
    ids: points.map((point) => point.id).sort(),
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lon: points.reduce((sum, point) => sum + point.lon, 0) / points.length,
    first: Math.min(...points.map((point) => point.at)),
    last: Math.max(...points.map((point) => point.at)),
    count: points.length,
  }));
}

/**
 * @description The fires (or burnt areas) within a radius of a place,
 * nearest first, with their distance and direction.
 * @param {{ lat: number, lon: number }} place - The place.
 * @param {Array<{ lat: number, lon: number }>} items - Fires or burnt areas.
 * @param {number} radiusKm - The radius.
 * @returns {Array<object>} The items, with `distance` (km, one decimal) and `direction`.
 */
function within(place, items, radiusKm) {
  return items
    .map((item) => ({
      ...item,
      distance: Math.round(distanceKm(place, item) * 10) / 10,
      direction: directionOf(place, item),
    }))
    .filter((item) => item.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

export {
  CLUSTER_KM,
  DIRECTIONS,
  distanceKm,
  directionOf,
  boxAround,
  parseCoordinates,
  placeId,
  clusterHotspots,
  within,
};
