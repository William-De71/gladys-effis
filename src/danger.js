// -----------------------------------------------------------------------------
// The fire danger classes of EFFIS, on the Canadian Fire Weather Index (FWI),
// as the legend of the EFFIS forecast layers draws them:
//
//   0 low            FWI < 11.2
//   1 moderate       11.2 to 21.3
//   2 high           21.3 to 38.0
//   3 very high      38.0 to 50.0
//   4 extreme        50.0 to 70.0
//   5 very extreme   70.0 and more
//
// Level keys are forever (scene filters store them).
// -----------------------------------------------------------------------------

const LEVELS = ['low', 'moderate', 'high', 'very_high', 'extreme', 'very_extreme'];
const THRESHOLDS = [11.2, 21.3, 38.0, 50.0, 70.0];
// Semantic colors of the widgets, by level.
const LEVEL_COLORS = ['success', 'info', 'warning', 'danger', 'danger', 'danger'];

/**
 * @description The danger level of a Fire Weather Index.
 * @param {number|null} fwi - The index.
 * @returns {number|null} 0 (low) to 5 (very extreme), null when unknown.
 * @example
 * levelOf(24.5); // -> 2 (high)
 */
function levelOf(fwi) {
  if (typeof fwi !== 'number' || !Number.isFinite(fwi)) return null;
  const level = THRESHOLDS.findIndex((threshold) => fwi < threshold);
  return level === -1 ? THRESHOLDS.length : level;
}

/**
 * @description The fire danger of a day in a forecast.
 * @param {Array<object>} days - The days of the EFFIS answer.
 * @param {string} day - YYYY-MM-DD.
 * @returns {{ day: string, fwi: number, level: number }|null} The day, null when unknown.
 */
function dangerOn(days, day) {
  const entry = (days ?? []).find((candidate) => candidate.day === day);
  if (!entry || levelOf(entry.fwi) === null) return null;
  return { ...entry, fwi: Math.round(entry.fwi * 10) / 10, level: levelOf(entry.fwi) };
}

/**
 * @description The forecast from a day on: one entry per known day.
 * @param {Array<object>} days - The days of the EFFIS answer.
 * @param {string} from - First day, YYYY-MM-DD.
 * @param {number} count - How many days at most.
 * @returns {Array<{ day: string, fwi: number, level: number }>} The days.
 */
function forecastFrom(days, from, count) {
  return (days ?? [])
    .filter((entry) => entry.day >= from && levelOf(entry.fwi) !== null)
    .slice(0, count)
    .map((entry) => dangerOn(days, entry.day));
}

export { LEVELS, THRESHOLDS, LEVEL_COLORS, levelOf, dangerOn, forecastFrom };
