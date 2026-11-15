// Recorded EFFIS answers (test/fixtures, November 2026) behind one fake fetch.
// Tests never touch the network.
//
//   - danger-athens-2026-07.json  a fire danger answer of a summer fortnight
//                                 (FWI 3 to 55): the fake serves its values
//                                 in order for the days asked;
//   - hotspots-iberia.xml         62 hotspots of 2026-11-14/15 (MODIS, VIIRS,
//                                 Sentinel-3), Spain and Portugal;
//   - burnt-france.json           20 burnt areas mapped in France (Pyrenees).

import { readFileSync } from 'node:fs';

export const NOW = Date.parse('2026-11-15T14:00:00Z'); // 15:00 in Paris
export const HOUR = 3600000;
export const BARCELONA = { lat: 41.3874, lon: 2.1686 };
export const PYRENEES = { lat: 42.95, lon: -0.3 };

const read = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
export const DANGER = JSON.parse(read('danger-athens-2026-07.json'));
export const HOTSPOTS_XML = read('hotspots-iberia.xml');
export const BURNT = JSON.parse(read('burnt-france.json'));
export const EMPTY_HOTSPOTS_XML =
  '<?xml version="1.0"?><wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" numberReturned="0"></wfs:FeatureCollection>';

const days = (from, to) => {
  const list = [];
  for (
    let day = Date.parse(`${from}T00:00:00Z`);
    day <= Date.parse(`${to}T00:00:00Z`);
    day += 86400000
  ) {
    list.push(new Date(day).toISOString().slice(0, 19));
  }
  return list;
};

/**
 * @description A fake fetch answering like EFFIS.
 * @param {object} [options] - Options.
 * @param {Function} [options.fwi] - `(index, day) => number`: the FWI served (default: the fixture).
 * @param {Function} [options.hotspots] - `() => string`: the WFS answer.
 * @param {Function} [options.burnt] - `(url) => object`: the burnt areas answer.
 * @param {Function} [options.status] - `(url) => number`: an HTTP status to force.
 * @returns {Function & { calls: string[] }} The fake, with the URLs asked.
 */
export function fakeFetch({
  fwi = (index) => DANGER.y_data.fwi[index % DANGER.y_data.fwi.length],
  hotspots = () => HOTSPOTS_XML,
  burnt = () => BURNT,
  status = () => 200,
} = {}) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    const code = status(url);
    const answer = (body) => ({
      status: code,
      ok: code >= 200 && code < 300,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    });
    if (url.includes('/charts/wms')) {
      const params = new URL(url).searchParams;
      const x = days(params.get('day_gte'), params.get('day_lte'));
      const y = Object.fromEntries(
        Object.keys(DANGER.y_data).map((key) => [
          key,
          x.map((day, index) =>
            key === 'fwi' ? fwi(index, day.slice(0, 10)) : DANGER.y_data[key][index % 12],
          ),
        ]),
      );
      return answer({ x_data: x, y_data: y });
    }
    if (url.includes('/gwis?')) return answer(hotspots(url));
    if (url.includes('/burntareas/current/')) return answer(burnt(url));
    throw new Error(`unexpected URL ${url}`);
  };
  fetch.calls = calls;
  return fetch;
}

export const silent = { info() {}, warn() {}, error() {}, debug() {} };
