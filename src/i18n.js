// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, widget contents, scene summaries, status
// and results of the Configuration screen. Danger levels follow the EFFIS
// legend (low, moderate, high, very high, extreme, very extreme).
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // levels and directions
  level_low: { en: 'Low', fr: 'Faible', de: 'Gering', es: 'Bajo' },
  level_moderate: { en: 'Moderate', fr: 'Modéré', de: 'Mäßig', es: 'Moderado' },
  level_high: { en: 'High', fr: 'Élevé', de: 'Hoch', es: 'Alto' },
  level_very_high: { en: 'Very high', fr: 'Très élevé', de: 'Sehr hoch', es: 'Muy alto' },
  level_extreme: { en: 'Extreme', fr: 'Extrême', de: 'Extrem', es: 'Extremo' },
  level_very_extreme: {
    en: 'Very extreme',
    fr: 'Très extrême',
    de: 'Sehr extrem',
    es: 'Muy extremo',
  },
  dir_n: { en: 'north', fr: 'au nord', de: 'Norden', es: 'norte' },
  dir_ne: { en: 'north-east', fr: 'au nord-est', de: 'Nordosten', es: 'noreste' },
  dir_e: { en: 'east', fr: 'à l’est', de: 'Osten', es: 'este' },
  dir_se: { en: 'south-east', fr: 'au sud-est', de: 'Südosten', es: 'sureste' },
  dir_s: { en: 'south', fr: 'au sud', de: 'Süden', es: 'sur' },
  dir_sw: { en: 'south-west', fr: 'au sud-ouest', de: 'Südwesten', es: 'suroeste' },
  dir_w: { en: 'west', fr: 'à l’ouest', de: 'Westen', es: 'oeste' },
  dir_nw: { en: 'north-west', fr: 'au nord-ouest', de: 'Nordwesten', es: 'noroeste' },
  unknown: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
  unknownPlace: {
    en: 'unknown place',
    fr: 'lieu inconnu',
    de: 'unbekannter Ort',
    es: 'lugar desconocido',
  },
  dangerWithFwi: {
    en: '{level} (FWI {fwi})',
    fr: '{level} (FWI {fwi})',
    de: '{level} (FWI {fwi})',
    es: '{level} (FWI {fwi})',
  },

  // device
  deviceName: {
    en: 'EFFIS {place}',
    fr: 'EFFIS {place}',
    de: 'EFFIS {place}',
    es: 'EFFIS {place}',
  },
  featureFwi: {
    en: 'Fire Weather Index',
    fr: 'Indice forêt météo (FWI)',
    de: 'Feuerwetterindex (FWI)',
    es: 'Índice meteorológico de incendios',
  },
  featureDanger: {
    en: 'Fire danger today',
    fr: 'Danger d’incendie aujourd’hui',
    de: 'Waldbrandgefahr heute',
    es: 'Peligro de incendio hoy',
  },
  featureDangerTomorrow: {
    en: 'Fire danger tomorrow',
    fr: 'Danger d’incendie demain',
    de: 'Waldbrandgefahr morgen',
    es: 'Peligro de incendio mañana',
  },
  featureFires: {
    en: 'Fires nearby (24 h)',
    fr: 'Feux à proximité (24 h)',
    de: 'Brände in der Nähe (24 h)',
    es: 'Incendios cercanos (24 h)',
  },
  featureSituation: { en: 'Situation', fr: 'Situation', de: 'Lage', es: 'Situación' },
  situationDanger: {
    en: 'Fire danger today: {danger}.',
    fr: 'Danger d’incendie aujourd’hui : {danger}.',
    de: 'Waldbrandgefahr heute: {danger}.',
    es: 'Peligro de incendio hoy: {danger}.',
  },
  situationFire: {
    en: '{count} fire(s) seen by satellite in 24 h, the nearest {distance} km {direction}.',
    fr: '{count} feu(x) vu(s) par satellite en 24 h, le plus proche à {distance} km {direction}.',
    de: '{count} Brand/Brände per Satellit in 24 h, der nächste {distance} km im {direction}.',
    es: '{count} incendio(s) visto(s) por satélite en 24 h, el más cercano a {distance} km al {direction}.',
  },
  situationNoFire: {
    en: 'No fire seen by satellite within {radius} km in 24 h.',
    fr: 'Aucun feu vu par satellite à moins de {radius} km en 24 h.',
    de: 'Kein Brand per Satellit im Umkreis von {radius} km in 24 h.',
    es: 'Ningún incendio visto por satélite a menos de {radius} km en 24 h.',
  },

  // scenes
  summaryDangerUp: {
    en: 'Fire danger rises at {place}: {danger}.',
    fr: 'Le danger d’incendie monte à {place} : {danger}.',
    de: 'Die Waldbrandgefahr steigt bei {place}: {danger}.',
    es: 'El peligro de incendio sube en {place}: {danger}.',
  },
  summaryDangerDown: {
    en: 'Fire danger falls at {place}: {danger}.',
    fr: 'Le danger d’incendie baisse à {place} : {danger}.',
    de: 'Die Waldbrandgefahr sinkt bei {place}: {danger}.',
    es: 'El peligro de incendio baja en {place}: {danger}.',
  },
  summaryFire: {
    en: 'Fire seen by satellite {distance} km {direction} of {place} at {time}.',
    fr: 'Feu vu par satellite à {distance} km {direction} de {place} à {time}.',
    de: 'Brand per Satellit {distance} km im {direction} von {place} um {time} erkannt.',
    es: 'Incendio visto por satélite a {distance} km al {direction} de {place} a las {time}.',
  },
  summaryBurnt: {
    en: 'EFFIS mapped a burnt area of {area} ha at {where}, {distance} km {direction} of {place}.',
    fr: 'EFFIS a cartographié une surface brûlée de {area} ha à {where}, à {distance} km {direction} de {place}.',
    de: 'EFFIS hat eine Brandfläche von {area} ha bei {where} kartiert, {distance} km im {direction} von {place}.',
    es: 'EFFIS ha cartografiado un área quemada de {area} ha en {where}, a {distance} km al {direction} de {place}.',
  },
  summaryDay_today: {
    en: 'Fire danger today at {place}: {danger}.',
    fr: 'Danger d’incendie aujourd’hui à {place} : {danger}.',
    de: 'Waldbrandgefahr heute bei {place}: {danger}.',
    es: 'Peligro de incendio hoy en {place}: {danger}.',
  },
  summaryDay_tomorrow: {
    en: 'Fire danger tomorrow at {place}: {danger}.',
    fr: 'Danger d’incendie demain à {place} : {danger}.',
    de: 'Waldbrandgefahr morgen bei {place}: {danger}.',
    es: 'Peligro de incendio mañana en {place}: {danger}.',
  },
  summaryDay_day_after: {
    en: 'Fire danger the day after tomorrow at {place}: {danger}.',
    fr: 'Danger d’incendie après-demain à {place} : {danger}.',
    de: 'Waldbrandgefahr übermorgen bei {place}: {danger}.',
    es: 'Peligro de incendio pasado mañana en {place}: {danger}.',
  },

  // widgets
  todayWord: { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy' },
  tomorrowWord: { en: 'Tomorrow', fr: 'Demain', de: 'Morgen', es: 'Mañana' },
  dangerHeading: {
    en: 'Danger: {level}',
    fr: 'Danger : {level}',
    de: 'Gefahr: {level}',
    es: 'Peligro: {level}',
  },
  dangerCaption: {
    en: '{place} · FWI · Source: EFFIS (Copernicus)',
    fr: '{place} · FWI · Source : EFFIS (Copernicus)',
    de: '{place} · FWI · Quelle: EFFIS (Copernicus)',
    es: '{place} · FWI · Fuente: EFFIS (Copernicus)',
  },
  noForecast: {
    en: 'No fire danger forecast yet for this place.',
    fr: 'Pas encore de prévision du danger pour ce lieu.',
    de: 'Noch keine Gefahrenvorhersage für diesen Ort.',
    es: 'Aún no hay previsión de peligro para este lugar.',
  },
  firesCaption: {
    en: 'Within {radius} km · Source: EFFIS (Copernicus)',
    fr: 'À moins de {radius} km · Source : EFFIS (Copernicus)',
    de: 'Im Umkreis von {radius} km · Quelle: EFFIS (Copernicus)',
    es: 'A menos de {radius} km · Fuente: EFFIS (Copernicus)',
  },
  firesNone: {
    en: 'No active fire',
    fr: 'Aucun feu actif',
    de: 'Kein aktiver Brand',
    es: 'Ningún incendio activo',
  },
  firesOne: {
    en: '1 active fire',
    fr: '1 feu actif',
    de: '1 aktiver Brand',
    es: '1 incendio activo',
  },
  firesMany: {
    en: '{count} active fires',
    fr: '{count} feux actifs',
    de: '{count} aktive Brände',
    es: '{count} incendios activos',
  },
  fireRow: {
    en: '{distance} km {direction}',
    fr: '{distance} km {direction}',
    de: '{distance} km im {direction}',
    es: '{distance} km al {direction}',
  },
  fireSeen: {
    en: 'seen {time}',
    fr: 'vu à {time}',
    de: 'gesehen {time}',
    es: 'visto a las {time}',
  },
  burntRow: {
    en: '{area} ha · {distance} km · {date}',
    fr: '{area} ha · {distance} km · {date}',
    de: '{area} ha · {distance} km · {date}',
    es: '{area} ha · {distance} km · {date}',
  },
  notReadYet: {
    en: 'EFFIS has not been read yet: come back in a minute.',
    fr: 'EFFIS n’a pas encore été lu : revenez dans une minute.',
    de: 'EFFIS wurde noch nicht gelesen: in einer Minute wieder.',
    es: 'EFFIS aún no se ha leído: vuelva en un minuto.',
  },

  // status and check action
  noPlace: {
    en: 'No place: choose a house of Gladys or type coordinates.',
    fr: 'Aucun lieu : choisissez une maison de Gladys ou saisissez des coordonnées.',
    de: 'Kein Ort: Wählen Sie ein Gladys-Haus oder geben Sie Koordinaten ein.',
    es: 'Ningún lugar: elija una casa de Gladys o escriba coordenadas.',
  },
  statusConnected: {
    en: 'EFFIS read for {places} place(s).',
    fr: 'EFFIS lu pour {places} lieu(x).',
    de: 'EFFIS für {places} Ort(e) gelesen.',
    es: 'EFFIS leído para {places} lugar(es).',
  },
  statusPartial: {
    en: 'EFFIS read for {places} place(s); {failed} not: {problem}',
    fr: 'EFFIS lu pour {places} lieu(x) ; {failed} non : {problem}',
    de: 'EFFIS für {places} Ort(e) gelesen; {failed} nicht: {problem}',
    es: 'EFFIS leído para {places} lugar(es); {failed} no: {problem}',
  },
  statusUnreachable: {
    en: 'EFFIS cannot be reached (network). Retrying in a few minutes.',
    fr: 'EFFIS est injoignable (réseau). Nouvel essai dans quelques minutes.',
    de: 'EFFIS ist nicht erreichbar (Netzwerk). Neuer Versuch in einigen Minuten.',
    es: 'No se puede acceder a EFFIS (red). Nuevo intento en unos minutos.',
  },
  statusUnavailable: {
    en: 'EFFIS does not answer for now (server busy). Retrying later.',
    fr: 'EFFIS ne répond pas pour l’instant (serveur occupé). Nouvel essai plus tard.',
    de: 'EFFIS antwortet derzeit nicht (Server ausgelastet). Später neuer Versuch.',
    es: 'EFFIS no responde por ahora (servidor ocupado). Nuevo intento más tarde.',
  },
  statusUnexpected: {
    en: 'EFFIS gave an unexpected answer: see the logs.',
    fr: 'EFFIS a donné une réponse inattendue : voir les journaux.',
    de: 'EFFIS gab eine unerwartete Antwort: siehe Protokolle.',
    es: 'EFFIS dio una respuesta inesperada: vea los registros.',
  },
  statusHouseNotLocated: {
    en: 'The house “{house}” has no position: locate it in Settings > Houses.',
    fr: 'La maison « {house} » n’a pas de position : placez-la dans Paramètres > Maisons.',
    de: 'Das Haus „{house}“ hat keine Position: Legen Sie sie unter Einstellungen > Häuser fest.',
    es: 'La casa «{house}» no tiene posición: ubíquela en Ajustes > Casas.',
  },
  statusCoordsInvalid: {
    en: 'Coordinates “{coords}” not understood: type “latitude, longitude”, e.g. 43.2965, 5.3698.',
    fr: 'Coordonnées « {coords} » non comprises : saisissez « latitude, longitude », par ex. 43.2965, 5.3698.',
    de: 'Koordinaten „{coords}“ nicht verstanden: „Breite, Länge“ eingeben, z. B. 43.2965, 5.3698.',
    es: 'Coordenadas «{coords}» no entendidas: escriba «latitud, longitud», p. ej. 43.2965, 5.3698.',
  },
  placeNotRead: {
    en: '{place} has not been read yet.',
    fr: '{place} n’a pas encore été lu.',
    de: '{place} wurde noch nicht gelesen.',
    es: '{place} aún no se ha leído.',
  },
  checkPlace: {
    en: '{place}: {situation}',
    fr: '{place} : {situation}',
    de: '{place}: {situation}',
    es: '{place}: {situation}',
  },
};

/**
 * @description True for a language of the integration.
 * @param {unknown} language - The language.
 * @returns {boolean} True when known.
 */
const isLanguage = (language) => LANGUAGES.includes(language);

/**
 * @description A text in a language, with its {placeholders} replaced.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language (English when unknown).
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) return key;
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object|Function} [values] - The substitutions, or `(language) => values`.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const locale = (language) => (isLanguage(language) ? language : 'en');

/**
 * @description A calendar day: "Tuesday, April 28" (long), "Thu, Apr 30" (short).
 * @param {string} iso - YYYY-MM-DD.
 * @param {string} language - The language.
 * @param {'long'|'short'} [style] - The style.
 * @returns {string} The text.
 */
function formatDay(iso, language, style = 'long') {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(language), {
    weekday: style,
    day: 'numeric',
    month: style,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * @description A calendar day without its weekday: "Nov 24", "24 nov.".
 * @param {string} iso - YYYY-MM-DD.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function formatDate(iso, language) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(language), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export { LANGUAGES, TEXTS, isLanguage, t, all, clip, formatDay, formatDate };
