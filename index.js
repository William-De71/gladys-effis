// -----------------------------------------------------------------------------
// Entry point of the EFFIS external integration.
//
// Brings EFFIS (European Forest Fire Information System, Copernicus Emergency
// Management Service) into Gladys, for up to three places (a house of Gladys
// or coordinates):
//   - a device per place (Fire Weather Index and danger level of today, danger
//     of tomorrow, fires seen by satellite nearby, the situation as a
//     sentence), offered on the Discovery screen (see src/device.js);
//   - scene triggers: danger level changed, fire detected nearby, burnt area
//     mapped nearby;
//   - a scene action: the fire danger of a place;
//   - dashboard widgets: the danger of the next days, the fires nearby.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
//   TZ (the timezone of Gladys: the days of the forecast are its days)
// The SDK reads the first three: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the EFFIS integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
