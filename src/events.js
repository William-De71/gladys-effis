// -----------------------------------------------------------------------------
// Scene events and scene action outputs of the EFFIS integration.
//
// Triggers (keys are forever):
//   - `danger_level_changed`  the danger level of today changed (filters:
//                             device, new level, up or down);
//   - `fire_detected`         a new fire seen by satellite within the radius
//                             (filter: device);
//   - `burnt_area_mapped`     a new burnt area mapped by EFFIS within the
//                             radius (filter: device).
// Every event carries `device` (the device external id: the value of the
// "Device" filter), `device_name` and a `summary` sentence. Values are
// scalars, texts cut at 1,000 characters.
//
// Action `get_fire_danger`: the danger of a place today, tomorrow or the day
// after, and the fires around it.
// -----------------------------------------------------------------------------

import { addDays } from './dates.js';
import { dangerOn, LEVELS } from './danger.js';
import { idsOf, deviceName, dangerText } from './device.js';
import { t } from './i18n.js';
import { localDay, localTime } from './time.js';

const TRIGGERS = {
  DANGER_LEVEL_CHANGED: 'danger_level_changed',
  FIRE_DETECTED: 'fire_detected',
  BURNT_AREA_MAPPED: 'burnt_area_mapped',
};
const SCENE_ACTIONS = { GET_FIRE_DANGER: 'get_fire_danger' };
const DAYS = ['today', 'tomorrow', 'day_after'];
const MAX_TEXT = 1000;
const clip = (value) => String(value ?? '').slice(0, MAX_TEXT);
const stamp = (ms, timezone) => `${localDay(new Date(ms), timezone)} ${localTime(ms, timezone)}`;

/**
 * @description The values every event of a place carries.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} place - The place.
 * @param {string} language - The language.
 * @returns {object} `{ device, device_name }`.
 */
const placeValues = (gladys, place, language) => ({
  device: idsOf(gladys, place.id).device,
  device_name: deviceName(place, language),
});

/**
 * @description The event of a new danger level.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} snapshot - The snapshot.
 * @param {{ from: number, to: number }} change - From the tracker.
 * @param {string} language - The language.
 * @returns {{ key: string, data: object }} The event.
 */
function dangerEvent(gladys, snapshot, change, language) {
  const up = change.to > change.from;
  const level = t(`level_${LEVELS[change.to]}`, language);
  return {
    key: TRIGGERS.DANGER_LEVEL_CHANGED,
    data: {
      ...placeValues(gladys, snapshot.place, language),
      level: LEVELS[change.to],
      level_label: level,
      previous_level: LEVELS[change.from],
      previous_level_label: t(`level_${LEVELS[change.from]}`, language),
      change: up ? 'up' : 'down',
      fwi: Math.round(snapshot.today.fwi * 10) / 10,
      summary: clip(
        t(up ? 'summaryDangerUp' : 'summaryDangerDown', language, {
          place: snapshot.place.label,
          danger: dangerText(snapshot.today, language),
        }),
      ),
    },
  };
}

/**
 * @description The event of a new fire.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} snapshot - The snapshot.
 * @param {object} fire - The fire (with distance and direction).
 * @param {string} language - The language.
 * @param {string} timezone - IANA timezone.
 * @returns {{ key: string, data: object }} The event.
 */
function fireEvent(gladys, snapshot, fire, language, timezone) {
  const direction = t(`dir_${fire.direction}`, language);
  return {
    key: TRIGGERS.FIRE_DETECTED,
    data: {
      ...placeValues(gladys, snapshot.place, language),
      distance_km: fire.distance,
      direction: fire.direction,
      direction_label: direction,
      detected_at: stamp(fire.first, timezone),
      hotspots: fire.count,
      latitude: Math.round(fire.lat * 10000) / 10000,
      longitude: Math.round(fire.lon * 10000) / 10000,
      danger_level: snapshot.today ? LEVELS[snapshot.today.level] : '',
      summary: clip(
        t('summaryFire', language, {
          place: snapshot.place.label,
          distance: Math.round(fire.distance),
          direction,
          time: localTime(fire.first, timezone),
        }),
      ),
    },
  };
}

/**
 * @description The event of a new burnt area.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} snapshot - The snapshot.
 * @param {object} area - The burnt area (with distance and direction).
 * @param {string} language - The language.
 * @param {string} timezone - IANA timezone.
 * @returns {{ key: string, data: object }} The event.
 */
function burntEvent(gladys, snapshot, area, language, timezone) {
  const direction = t(`dir_${area.direction}`, language);
  const where = [area.commune, area.province, area.countryName].filter(Boolean).join(', ');
  return {
    key: TRIGGERS.BURNT_AREA_MAPPED,
    data: {
      ...placeValues(gladys, snapshot.place, language),
      area_ha: area.area,
      commune: clip(area.commune),
      province: clip(area.province),
      country: area.country,
      fire_date: localDay(new Date(area.fireDate), timezone),
      distance_km: area.distance,
      direction: area.direction,
      direction_label: direction,
      summary: clip(
        t('summaryBurnt', language, {
          place: snapshot.place.label,
          area: area.area,
          where: where || t('unknownPlace', language),
          distance: Math.round(area.distance),
          direction,
        }),
      ),
    },
  };
}

/**
 * @description The outputs of the get_fire_danger scene action.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} snapshot - The snapshot.
 * @param {object} fields - `{ day: 'today'|'tomorrow'|'day_after' }`.
 * @param {string} language - The language.
 * @param {string} today - YYYY-MM-DD.
 * @returns {object} The outputs.
 */
function dangerOutputs(gladys, snapshot, fields, language, today) {
  const when = DAYS.includes(fields?.day) ? fields.day : 'today';
  const date = addDays(today, DAYS.indexOf(when));
  const danger = dangerOn(snapshot.days, date);
  const nearest = snapshot.fires?.[0] ?? null;
  const parts = [
    t(`summaryDay_${when}`, language, {
      place: snapshot.place.label,
      danger: dangerText(danger, language),
    }),
  ];
  if (snapshot.fires) {
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
  return {
    device_name: deviceName(snapshot.place, language),
    date,
    fwi: danger ? danger.fwi : -1,
    level: danger ? LEVELS[danger.level] : '',
    level_label: danger ? t(`level_${LEVELS[danger.level]}`, language) : '',
    fires_nearby: snapshot.fires ? snapshot.fires.length : 0,
    nearest_fire_km: nearest ? nearest.distance : -1,
    summary: clip(parts.join(' ')),
  };
}

export { TRIGGERS, SCENE_ACTIONS, DAYS, dangerEvent, fireEvent, burntEvent, dangerOutputs };
