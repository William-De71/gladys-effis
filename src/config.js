// -----------------------------------------------------------------------------
// Configuration of the EFFIS integration (no account, no key).
//
// Fields of the config_schema, per place (`<n>` from 1 to 3):
//   - `house_<n>`   a house of Gladys (`source: "houses"`), located in
//                   Settings > Houses;
//   - `coords_<n>`  or coordinates typed by hand ("43.2965, 5.3698"): they
//                   win over the house (a second home, a forest nearby).
// And:
//   - `radius`      kilometres around each place where fires are watched;
//   - `language`    language of the texts Gladys does not ask for in a
//                   language (feature names, scene texts): `auto` follows
//                   the language of the last widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language` language of the last widget request.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';
import { parseCoordinates } from './geo.js';

const MAX_PLACES = 3;
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };
const RADII = [10, 25, 50, 100];
const DEFAULT_RADIUS = 25;

const readString = (raw) => (typeof raw === 'string' ? raw.trim() : '');

/**
 * @description Read the radius.
 * @param {unknown} raw - The raw value ("25", 25).
 * @returns {number} Kilometres, one of RADII.
 */
function readRadius(raw) {
  const value = Number(raw);
  return RADII.includes(value) ? value : DEFAULT_RADIUS;
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} `{ places: [{ slot, house, coords, coordsText, invalid }], radius, language }`;
 * a slot without a house nor coordinates is left out.
 * @example
 * normalizeConfig({ coords_1: '43.2965, 5.3698' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const places = [];
  for (let slot = 1; slot <= MAX_PLACES; slot += 1) {
    const house = readString(config[`house_${slot}`]) || null;
    const coordsText = readString(config[`coords_${slot}`]);
    const coords = coordsText ? parseCoordinates(coordsText) : null;
    if (house || coordsText) {
      places.push({ slot, house, coords, coordsText, invalid: Boolean(coordsText) && !coords });
    }
  }
  return {
    places,
    radius: readRadius(config.radius),
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return isLanguage(language) ? language : fallback;
}

export {
  MAX_PLACES,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  RADII,
  DEFAULT_RADIUS,
  normalizeConfig,
  readLanguage,
  readRadius,
};
