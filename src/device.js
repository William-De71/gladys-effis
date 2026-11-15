// -----------------------------------------------------------------------------
// The devices of the EFFIS integration, offered on the Discovery screen.
//
// One device per place of the configuration, "EFFIS <place>":
//   - fwi              risk / integer, 0 to 200: the Fire Weather Index of
//                      today, rounded (EFFIS forecast, ECMWF 8 km);
//   - danger           risk / integer, 0 to 5: the danger level of today
//                      (0 low, 1 moderate, 2 high, 3 very high, 4 extreme,
//                      5 very extreme);
//   - danger_tomorrow  risk / integer, 0 to 5: the same, tomorrow;
//   - fires            counter-sensor / integer: fires detected by satellite
//                      within the radius in the last 24 hours;
//   - situation        text / text: the danger and the nearest fire, as a
//                      sentence.
//
// External ids are built on the selector of the house or on the coordinates
// (to about 100 m), never on a display name. EFFIS has no push: the
// integration reads it on its own clock, so `should_poll` is false. Every
// feature is read-only.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';
import { LEVELS } from './danger.js';
import { t } from './i18n.js';

const DEVICE_TYPE = 'place';
const MAX_FWI = 200;
const MAX_COUNT = 999;

const FEATURE_KEYS = {
  FWI: 'fwi',
  DANGER: 'danger',
  DANGER_TOMORROW: 'danger_tomorrow',
  FIRES: 'fires',
  SITUATION: 'situation',
};

const shape = (category, type, min, max, history = true) => ({
  category,
  type,
  read_only: true,
  has_feedback: false,
  keep_history: history,
  min,
  max,
});

/**
 * @description The external ids of a place.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} id - The place id.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, id) => gladys.externalIds(DEVICE_TYPE, id);

/**
 * @description The place id a device (or feature) external id stands for.
 * @param {unknown} externalId - The external id.
 * @returns {string|null} The place id.
 * @example
 * placeIdFromExternalId('ext:effis:place:house-main:fwi'); // -> 'house-main'
 */
function placeIdFromExternalId(externalId) {
  const match = /:place:([a-z0-9-]+)(?::[a-z_]+)?$/i.exec(String(externalId ?? ''));
  return match ? match[1].toLowerCase() : null;
}

/**
 * @description "high (FWI 24)", or "unknown".
 * @param {{ fwi: number, level: number }|null} danger - A day.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
const dangerText = (danger, language) =>
  danger
    ? t('dangerWithFwi', language, {
        level: t(`level_${LEVELS[danger.level]}`, language),
        fwi: Math.round(danger.fwi),
      })
    : t('unknown', language);

/**
 * @description The situation of a place, as one sentence.
 * @param {object} snapshot - The snapshot of the watcher.
 * @param {string} language - The language.
 * @returns {string} The sentence.
 */
function situationText(snapshot, language) {
  const parts = [t('situationDanger', language, { danger: dangerText(snapshot.today, language) })];
  if (snapshot.fires) {
    const nearest = snapshot.fires[0];
    parts.push(
      nearest
        ? t('situationFire', language, {
            count: snapshot.fires.length,
            distance: Math.round(nearest.distance),
            direction: t(`dir_${nearest.direction}`, language),
          })
        : t('situationNoFire', language, { radius: snapshot.radius }),
    );
  }
  return parts.join(' ');
}

const PLACE_FEATURES = [
  {
    key: FEATURE_KEYS.FWI,
    name: 'featureFwi',
    shape: shape(CATEGORIES.RISK, TYPES.RISK.INTEGER, 0, MAX_FWI),
    state: (s) => (s.today ? Math.min(MAX_FWI, Math.round(s.today.fwi)) : null),
  },
  {
    key: FEATURE_KEYS.DANGER,
    name: 'featureDanger',
    shape: shape(CATEGORIES.RISK, TYPES.RISK.INTEGER, 0, LEVELS.length - 1),
    state: (s) => s.today?.level ?? null,
  },
  {
    key: FEATURE_KEYS.DANGER_TOMORROW,
    name: 'featureDangerTomorrow',
    shape: shape(CATEGORIES.RISK, TYPES.RISK.INTEGER, 0, LEVELS.length - 1),
    state: (s) => s.tomorrow?.level ?? null,
  },
  {
    key: FEATURE_KEYS.FIRES,
    name: 'featureFires',
    shape: shape(CATEGORIES.COUNTER_SENSOR, TYPES.SENSOR.INTEGER, 0, MAX_COUNT),
    state: (s) => (s.fires ? Math.min(MAX_COUNT, s.fires.length) : null),
  },
  {
    key: FEATURE_KEYS.SITUATION,
    name: 'featureSituation',
    shape: shape(CATEGORIES.TEXT, TYPES.TEXT.TEXT, 0, 0, false),
    state: (s, language) => ({ text: situationText(s, language) }),
  },
];

/**
 * @description The name of a place device.
 * @param {object} place - The place.
 * @param {string} language - The language.
 * @returns {string} "EFFIS Home".
 */
const deviceName = (place, language) => t('deviceName', language, { place: place.label });

/**
 * @description The device of a place.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} place - The resolved place.
 * @param {string} [language] - Language of the names.
 * @returns {object} The discovered device.
 */
function buildPlaceDevice(gladys, place, language = 'en') {
  const ids = idsOf(gladys, place.id);
  return {
    name: deviceName(place, language),
    external_id: ids.device,
    should_poll: false,
    params: [
      { name: 'EFFIS_LATITUDE', value: place.lat.toFixed(5) },
      { name: 'EFFIS_LONGITUDE', value: place.lon.toFixed(5) },
    ],
    features: PLACE_FEATURES.map((spec) => ({
      name: t(spec.name, language),
      external_id: ids.feature(spec.key),
      ...spec.shape,
    })),
  };
}

/**
 * @description The states of a place (unknown values are left out).
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} snapshot - The snapshot.
 * @param {string} language - Language of the texts.
 * @returns {Array<object>} The states.
 */
function buildPlaceStates(gladys, snapshot, language) {
  const ids = idsOf(gladys, snapshot.place.id);
  return PLACE_FEATURES.flatMap((spec) => {
    const value = spec.state(snapshot, language);
    const id = ids.feature(spec.key);
    if (value === null || value === undefined) return [];
    return typeof value === 'object'
      ? [{ device_feature_external_id: id, text: value.text }]
      : [{ device_feature_external_id: id, state: value }];
  });
}

export {
  DEVICE_TYPE,
  FEATURE_KEYS,
  PLACE_FEATURES,
  MAX_FWI,
  idsOf,
  placeIdFromExternalId,
  deviceName,
  dangerText,
  situationText,
  buildPlaceDevice,
  buildPlaceStates,
};
