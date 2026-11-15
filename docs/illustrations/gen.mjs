// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The two cards of a house near Barcelona, from recorded EFFIS answers
// (test/fixtures) through the real parsers (src/effis-api.js) and the real
// widget builders (src/widgets.js):
//   - "Wildfire danger": the fire danger forecast recorded for a summer
//     fortnight (EFFIS, ECMWF), from 26 July 2026;
//   - "Fires nearby": the hotspots recorded on 14-15 November 2026 within
//     50 km.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildDangerWidget, buildFiresWidget } = await load('src/widgets.js');
const { parseDanger, parseHotspots } = await load('src/effis-api.js');
const { dangerOn } = await load('src/danger.js');
const { clusterHotspots, within } = await load('src/geo.js');
const { LANGUAGES } = await load('src/i18n.js');
const { DANGER, HOTSPOTS_XML, BARCELONA } = await load('test/helpers/fixtures.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

const TODAY = '2026-07-26';
const days = parseDanger(DANGER);
const snapshot = {
  place: { id: 'house-main', label: 'Casa', ...BARCELONA },
  radius: 50,
  days,
  today: dangerOn(days, TODAY),
  tomorrow: dangerOn(days, '2026-07-27'),
  fires: within(BARCELONA, clusterHotspots(parseHotspots(HOTSPOTS_XML)), 50),
  burntAreas: [],
};

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    danger: buildDangerWidget({ snapshot, today: TODAY, language, settings: { days: 7 } }),
    fires: buildFiresWidget({ snapshot, language, timezone: 'Europe/Madrid' }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: Date.parse('2026-11-15T14:00:00Z'), widgets, contents }));
