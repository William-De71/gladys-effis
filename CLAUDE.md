# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for EFFIS, the European Forest
Fire Information System of the Copernicus Emergency Management Service
(European Commission, JRC): a Node.js service (Node 22+, ESM, no build step)
that runs in its own sandboxed Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency.

EFFIS data is open data under **CC BY 4.0**: credit the source wherever it is
shown (the widget captions do). There is no documented public API: the
integration reads the endpoints the official viewer
(forest-fire.emergency.copernicus.eu/apps/effis.csv) calls itself, without an
account or a key. It is **not an official alert service**: say so wherever a
user may rely on it.

## Commands

```bash
npm install
npm test                                  # node --test, never touches the network
node --test test/app.test.js              # one file
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, places resolution, status messages
src/effis-api.js        the three EFFIS endpoints, their parsers, error kinds
src/watcher.js          the reading clock: danger 3 h, hotspots 30 min, burnt areas 1 h
src/tracker.js          what is new (level, fire, burnt area); first reading = baseline
src/danger.js           FWI -> danger levels (classes of the EFFIS legend)
src/geo.js              coordinates, distances, directions, boxes, hotspots -> fires
src/events.js           scene trigger payloads and scene action outputs
src/device.js           one device per place, its five features and states
src/widgets.js          the `danger` and `fires` widgets (pure, reused by gen.mjs)
src/config.js           configuration (places, radius, language)
src/i18n.js             runtime texts, en / fr / de / es
src/time.js, dates.js   timezone (TZ given by the supervisor) and YYYY-MM-DD helpers
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          recorded EFFIS answers (November 2026)
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## What EFFIS answers (recorded November 2026)

- **Fire danger**: `GET https://api.effis.emergency.copernicus.eu/rest/2/burntareas/charts/wms?model=ecmwf&day_gte=YYYY-MM-DD&day_lte=YYYY-MM-DD&point=(lon%20lat)`
  -> `{ x_data: ["2026-11-15T00:00:00", …], y_data: { fwi, isi, bui, ffmc, dmc, dc, "anomaly index", "ranking index" } }`,
  past days and 9 days ahead (ECMWF, 8 km). The WMS GetFeatureInfo of the
  `*.query` layers answers empty attributes: do not use it.
- **Hotspots**: WFS 2.0 `GetFeature` of `ms:all.hs.today.points` on
  `https://maps.effis.emergency.copernicus.eu/gwis`, with
  `bbox=south,west,north,east,urn:ogc:def:crs:EPSG::4326`: GML only (JSON is
  refused on this layer), `ms:id`, `ms:acq_at` ("2026-11-15 13:16:00", UTC),
  `gml:pos` (lat lon), the last 24 hours, all satellites.
- **Burnt areas**: `GET https://api.effis.emergency.copernicus.eu/rest/2/burntareas/current/`
  with `firedate__gte` or `lastupdate__gte` (a day), `country`, `limit`,
  `offset`; no spatial filter (`in_bbox` is ignored). Fields `centroid`,
  `commune` / `province` ("N.A." when unknown), `country`, `countryful`,
  `firedate`, `area_ha`, `lastupdate`. Europe, Middle East, North Africa.
- Danger classes of the legend: low < 11.2, moderate < 21.3, high < 38,
  very high < 50, extreme < 70, very extreme.

## Rules

- **Keys are forever**: device and feature external ids
  (`ext:<selector>:place:house-<house selector>` or
  `place:point-n43297-e5370`, coordinates to about 100 m), feature
  `category` / `type` / `min` / `max`, the level keys (`low` …
  `very_extreme`), `up` / `down`, directions (`n` … `nw`), `today` /
  `tomorrow` / `day_after`, the keys of `config_schema`, `actions`, the
  widgets and their settings, scene triggers (fields, options, variables) and
  the scene action (fields, outputs). `test/manifest.test.js` lists them on
  purpose.
- **Be gentle with EFFIS**: one request at a time, 2 seconds apart, the
  integration named in the User-Agent; danger every 3 hours (and at a new
  day), hotspots every 30 minutes, burnt areas every hour (7 days at start,
  then the areas updated since yesterday). A widget never costs a request.
- **A failed reading changes nothing**: the last data stays, it is never
  "no fire". The first reading of a place (or after a radius change) is a
  baseline: no scene event replays what is already there. A scene action
  never fires a scene trigger.
- **`should_poll` stays false**; every feature is read-only. Unknown values
  are not published.
- **The container rootfs is read-only.** Nothing is written, not even under
  `/data`.
- **Four languages.** Every user-facing text (manifest, `src/i18n.js`,
  `docs/*.md`, README) exists in English, French, German and Spanish
  (`test/i18n.test.js`). In French, the directions carry their preposition
  ("au nord", "à l’est").
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language. `location: true`,
  Gladys `>=5.3.0`, no `countries`, transport `["cloud"]`.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.

## Pitfalls

- A satellite hotspot is a thermal anomaly: farm burns, flares and industry
  show too. Never call it a confirmed wildfire in a user text.
- Hotspots of the same fire move from pass to pass: a fire is "new" only when
  none of its hotspots is known and no fire seen in the last 48 hours lies
  within 4 km.
- The burnt areas endpoint has no spatial filter: at the height of summer the
  first load of 7 days can take several pages (10 at most, 100 each).
