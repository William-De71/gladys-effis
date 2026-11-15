// -----------------------------------------------------------------------------
// The EFFIS services the integration reads (European Forest Fire Information
// System, Copernicus Emergency Management Service, European Commission). Open
// data under CC BY 4.0, no account, no key: the endpoints the official EFFIS
// viewer (forest-fire.emergency.copernicus.eu/apps/effis.csv) calls itself.
//
//   - fire danger    GET api.effis.emergency.copernicus.eu/rest/2/burntareas/
//                    charts/wms?model=ecmwf&day_gte=…&day_lte=…&point=(lon lat)
//                    -> { x_data: ["2026-11-15T00:00:00", …], y_data: { fwi,
//                    isi, bui, ffmc, dmc, dc, "anomaly index", "ranking index"
//                    } }: the Canadian Fire Weather Index of the ECMWF model
//                    (8 km), a value a day, from 2 days back to 9 ahead;
//   - hotspots       WFS GetFeature `ms:all.hs.today.points` on
//                    maps.effis.emergency.copernicus.eu/gwis, in a box: the
//                    thermal anomalies seen by the MODIS, VIIRS and Sentinel-3
//                    satellites in the last 24 hours (`id`, `acq_at` in UTC,
//                    position). GML only (no JSON output on this layer);
//   - burnt areas    GET api.effis.emergency.copernicus.eu/rest/2/burntareas/
//                    current/?firedate__gte=…&limit=…&offset=…: the fires EFFIS
//                    mapped (Europe, Middle East, North Africa), with their
//                    area, commune, province, country and fire date.
//
// Error kinds: `unreachable` (network, timeout), `unavailable` (5xx, 429),
// `unexpected` (an answer the integration does not understand).
// -----------------------------------------------------------------------------

const DANGER_URL = 'https://api.effis.emergency.copernicus.eu/rest/2/burntareas/charts/wms';
const WFS_URL = 'https://maps.effis.emergency.copernicus.eu/gwis';
const BURNT_URL = 'https://api.effis.emergency.copernicus.eu/rest/2/burntareas/current/';
const TIMEOUT_MS = 30000;
const MAX_HOTSPOTS = 2000;
const BURNT_PAGE = 100;
const MAX_BURNT_PAGES = 10;
const DANGER_KEYS = ['fwi', 'isi', 'bui', 'ffmc', 'dmc', 'dc'];

class EffisError extends Error {
  /**
   * @param {string} kind - unreachable, unavailable or unexpected.
   * @param {string} message - The details, for the logs.
   */
  constructor(kind, message) {
    super(message);
    this.name = 'EffisError';
    this.kind = kind;
  }
}

/**
 * @description A number, or null.
 * @param {unknown} value - The raw value.
 * @returns {number|null} The number.
 */
const numberOrNull = (value) => {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : null;
};

/**
 * @description Read the fire danger answer: one entry a day.
 * @param {unknown} body - The parsed JSON.
 * @returns {Array<{ day: string, fwi: number|null }>} The days, in order (other indices too).
 */
function parseDanger(body) {
  if (!body || !Array.isArray(body.x_data) || !body.y_data || typeof body.y_data !== 'object') {
    throw new EffisError('unexpected', 'fire danger: no x_data / y_data');
  }
  return body.x_data
    .map((raw, index) => {
      const day = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw))?.[1];
      if (!day) return null;
      const entry = { day };
      for (const key of DANGER_KEYS) {
        entry[key] = numberOrNull(body.y_data[key]?.[index]);
      }
      return entry;
    })
    .filter(Boolean);
}

/**
 * @description Read the hotspots of a WFS answer (GML 3.2, MapServer).
 * @param {string} xml - The answer.
 * @returns {Array<{ id: string, lat: number, lon: number, at: number }>} The hotspots.
 */
function parseHotspots(xml) {
  const text = String(xml ?? '');
  if (/ExceptionReport/.test(text)) {
    throw new EffisError(
      'unexpected',
      `hotspots: ${/<ows:ExceptionText>([^<]*)/.exec(text)?.[1] ?? 'exception'}`,
    );
  }
  if (!/FeatureCollection/.test(text)) {
    throw new EffisError('unexpected', 'hotspots: not a feature collection');
  }
  const hotspots = [];
  for (const member of text.split('<wfs:member>').slice(1)) {
    const pos = /<gml:pos>\s*(-?[\d.]+)\s+(-?[\d.]+)\s*<\/gml:pos>/.exec(member);
    const id = /<ms:id>([^<]+)<\/ms:id>/.exec(member)?.[1];
    const acq = /<ms:acq_at>(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)<\/ms:acq_at>/.exec(member);
    if (!pos || !id || !acq) continue;
    const at = Date.parse(`${acq[1]}T${acq[2].length === 5 ? `${acq[2]}:00` : acq[2]}Z`);
    const lat = Number(pos[1]);
    const lon = Number(pos[2]);
    if (!Number.isFinite(at) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    hotspots.push({ id: id.trim(), lat, lon, at });
  }
  return hotspots;
}

/**
 * @description Read a burnt area of the REST answer.
 * @param {object} raw - One result.
 * @returns {object|null} `{ id, lat, lon, area, commune, province, country, countryName, fireDate, updated }`.
 */
function parseBurntArea(raw) {
  const [lon, lat] = raw?.centroid?.coordinates ?? [];
  const fireDate = Date.parse(raw?.firedate ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(fireDate)) return null;
  const text = (value) => (typeof value === 'string' && value !== 'N.A.' ? value.trim() : '');
  return {
    id: String(raw.id),
    lat,
    lon,
    area: Math.max(0, Math.round(numberOrNull(raw.area_ha) ?? 0)),
    commune: text(raw.commune),
    province: text(raw.province),
    country: text(raw.country),
    countryName: text(raw.countryful),
    fireDate,
    updated: Date.parse(raw.lastupdate ?? '') || fireDate,
  };
}

/**
 * @description Create the EFFIS client.
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - fetch implementation (tests).
 * @param {string} [options.userAgent] - User-Agent of the requests.
 * @returns {{ danger: Function, hotspots: Function, burntAreas: Function }} The client.
 */
function createEffisClient({ fetch = globalThis.fetch, userAgent = 'gladys-effis' } = {}) {
  /**
   * @description One GET, with the error kinds.
   * @param {string} url - The URL.
   * @param {'json'|'text'} as - How to read the body.
   * @returns {Promise<unknown>} The body.
   */
  async function get(url, as) {
    let response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          Accept: as === 'json' ? 'application/json' : 'application/xml',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new EffisError('unreachable', err.message);
    }
    if (response.status === 429 || response.status >= 500) {
      throw new EffisError('unavailable', `HTTP ${response.status}`);
    }
    if (!response.ok) {
      throw new EffisError('unexpected', `HTTP ${response.status}`);
    }
    const body = await response.text();
    if (as === 'text') return body;
    try {
      return JSON.parse(body);
    } catch {
      throw new EffisError('unexpected', 'not JSON');
    }
  }

  return {
    /**
     * @param {{ lat: number, lon: number }} point - The place.
     * @param {string} from - First day, YYYY-MM-DD.
     * @param {string} to - Last day, YYYY-MM-DD.
     * @returns {Promise<Array<object>>} The fire danger of each day.
     */
    async danger({ lat, lon }, from, to) {
      const url = `${DANGER_URL}?model=ecmwf&day_gte=${from}&day_lte=${to}&point=(${lon.toFixed(4)}%20${lat.toFixed(4)})`;
      return parseDanger(await get(url, 'json'));
    },
    /**
     * @param {{ south: number, west: number, north: number, east: number }} box - The box.
     * @returns {Promise<Array<object>>} The hotspots of the last 24 hours in it.
     */
    async hotspots({ south, west, north, east }) {
      const bbox = [south, west, north, east].map((value) => value.toFixed(4)).join(',');
      const url =
        `${WFS_URL}?service=WFS&version=2.0.0&request=GetFeature&typeNames=ms:all.hs.today.points` +
        `&count=${MAX_HOTSPOTS}&bbox=${bbox},urn:ogc:def:crs:EPSG::4326`;
      return parseHotspots(await get(url, 'text'));
    },
    /**
     * @param {string} since - YYYY-MM-DD.
     * @param {object} [options] - `{ updated }`: the areas updated since that
     * day (`lastupdate__gte`), instead of the fires started since then.
     * @returns {Promise<Array<object>>} The burnt areas.
     */
    async burntAreas(since, { updated = false } = {}) {
      const areas = [];
      const filter = updated ? 'lastupdate__gte' : 'firedate__gte';
      for (let page = 0; page < MAX_BURNT_PAGES; page += 1) {
        const url = `${BURNT_URL}?${filter}=${since}&limit=${BURNT_PAGE}&offset=${page * BURNT_PAGE}`;
        const body = await get(url, 'json');
        if (!body || !Array.isArray(body.results)) {
          throw new EffisError('unexpected', 'burnt areas: no results');
        }
        areas.push(...body.results.map(parseBurntArea).filter(Boolean));
        if (!body.next || body.results.length < BURNT_PAGE) break;
      }
      return areas;
    },
  };
}

export {
  DANGER_URL,
  WFS_URL,
  BURNT_URL,
  DANGER_KEYS,
  EffisError,
  parseDanger,
  parseHotspots,
  parseBurntArea,
  createEffisClient,
};
