// -----------------------------------------------------------------------------
// Dashboard widgets of the EFFIS integration (pure functions, reused by
// docs/illustrations/gen.mjs).
//
//   - `danger`  the danger level of today and of the next days of a place
//               (settings `device`, `days` 3 to 9);
//   - `fires`   the fires seen by satellite within the radius in the last 24
//               hours and the burnt areas EFFIS mapped there in the last 7
//               days (setting `device`).
//
// Both carry the source in their caption: EFFIS data is CC BY 4.0 and asks
// for the credit. Budget of a card: 2 texts (heading, caption), 1 status list.
// -----------------------------------------------------------------------------

import { addDays } from './dates.js';
import { LEVELS, LEVEL_COLORS, forecastFrom } from './danger.js';
import { clip, formatDay, formatDate, t } from './i18n.js';
import { localTime } from './time.js';

const WIDGETS = { DANGER: 'danger', FIRES: 'fires' };
const DAYS = { min: 3, max: 9, default: 7 };
const MAX_ROWS = 10;

/**
 * @description How many days the danger widget lists.
 * @param {unknown} raw - The setting.
 * @returns {number} 3 to 9.
 */
function readDays(raw) {
  const value = Number(raw);
  if (raw === '' || raw === null || raw === undefined || !Number.isFinite(value))
    return DAYS.default;
  return Math.min(DAYS.max, Math.max(DAYS.min, Math.round(value)));
}

/**
 * @description A content made of one message (nothing read yet, no place…).
 * @param {string} text - The message.
 * @param {number} [ttl] - Cache duration.
 * @returns {object} The content.
 */
const messageContent = (text, ttl = 300) => ({
  ttl_seconds: ttl,
  components: [{ type: 'text', variant: 'body', text: clip(text, 300) }],
});

/**
 * @description The "danger" widget.
 * @param {object} options - Options.
 * @param {object} options.snapshot - The snapshot of the place.
 * @param {string} options.today - YYYY-MM-DD.
 * @param {string} options.language - The language.
 * @param {object} [options.settings] - `{ days }`.
 * @returns {object} The content.
 */
function buildDangerWidget({ snapshot, today, language, settings = {} }) {
  const days = forecastFrom(snapshot.days, today, readDays(settings.days));
  if (days.length === 0) return messageContent(t('noForecast', language), 900);
  const first = days[0];
  const heading =
    first.day === today
      ? t('dangerHeading', language, { level: t(`level_${LEVELS[first.level]}`, language) })
      : t('unknown', language);
  return {
    ttl_seconds: 1800,
    components: [
      { type: 'text', variant: 'heading', text: clip(heading, 40) },
      {
        type: 'text',
        variant: 'caption',
        text: clip(t('dangerCaption', language, { place: snapshot.place.label }), 80),
      },
      {
        type: 'status',
        items: days.map((entry) => ({
          icon: entry.level >= 2 ? 'alert-triangle' : 'sun',
          label: clip(
            entry.day === today
              ? t('todayWord', language)
              : entry.day === addDays(today, 1)
                ? t('tomorrowWord', language)
                : formatDay(entry.day, language, 'short'),
            40,
          ),
          value: clip(
            `${t(`level_${LEVELS[entry.level]}`, language)} · ${Math.round(entry.fwi)}`,
            40,
          ),
          color: LEVEL_COLORS[entry.level],
        })),
      },
    ],
  };
}

/**
 * @description The "fires" widget.
 * @param {object} options - Options.
 * @param {object} options.snapshot - The snapshot of the place.
 * @param {string} options.language - The language.
 * @param {string} options.timezone - IANA timezone.
 * @returns {object} The content.
 */
function buildFiresWidget({ snapshot, language, timezone }) {
  const fires = snapshot.fires ?? [];
  const areas = snapshot.burntAreas ?? [];
  const caption = clip(t('firesCaption', language, { radius: snapshot.radius }), 80);
  if (snapshot.fires === null) return messageContent(t('notReadYet', language), 60);
  const heading =
    fires.length === 0
      ? t('firesNone', language)
      : t(fires.length === 1 ? 'firesOne' : 'firesMany', language, { count: fires.length });
  const items = [
    ...fires.map((fire) => ({
      icon: 'alert-triangle',
      label: clip(
        t('fireRow', language, {
          distance: Math.round(fire.distance),
          direction: t(`dir_${fire.direction}`, language),
        }),
        40,
      ),
      value: clip(t('fireSeen', language, { time: localTime(fire.last, timezone) }), 40),
      color: 'danger',
    })),
    ...areas.map((area) => ({
      icon: 'map',
      label: clip(
        area.commune || area.province || area.countryName || t('unknownPlace', language),
        40,
      ),
      value: clip(
        t('burntRow', language, {
          area: area.area,
          distance: Math.round(area.distance),
          date: formatDate(new Date(area.fireDate).toISOString().slice(0, 10), language),
        }),
        40,
      ),
      color: 'warning',
    })),
  ].slice(0, MAX_ROWS);
  const components = [
    { type: 'text', variant: 'heading', text: clip(heading, 40) },
    { type: 'text', variant: 'caption', text: caption },
  ];
  if (items.length > 0) components.push({ type: 'status', items });
  return { ttl_seconds: 600, components };
}

export { WIDGETS, DAYS, MAX_ROWS, readDays, messageContent, buildDangerWidget, buildFiresWidget };
