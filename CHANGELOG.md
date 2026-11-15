# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - 2026-11-15

### Added

- EFFIS (European Forest Fire Information System, Copernicus) for up to three places, a house of Gladys or coordinates: open data, no account, no key.
- A device per place: Fire Weather Index and danger level of today (low to very extreme, the classes of the EFFIS maps), danger of tomorrow, fires seen by satellite nearby in 24 hours, the situation as a sentence.
- Scene triggers "Fire danger level changed" (filters: level, rises or falls), "Fire detected nearby" and "Burnt area mapped nearby", with a radius of 10 to 100 km.
- Scene action "Get the fire danger" (today, tomorrow or the day after), with the fires nearby and a ready-made sentence.
- Dashboard widgets "Wildfire danger" (the next 3 to 9 days) and "Fires nearby" (fires seen in 24 hours, burnt areas mapped in 7 days), crediting the source.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.1.0]: https://github.com/William-De71/gladys-effis/releases/tag/v0.1.0
