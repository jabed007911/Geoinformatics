# Verification report

Date: 24 September 2026.

## Passed

- TypeScript compilation and Vite production build.
- 20 Vitest checks covering preceding-hour accumulation, 24/48/72-hour windows, missing/duplicate/invalid values, truncated horizons, exact indicator thresholds, Bangladesh midnight rollover, malformed provider responses, CSV metadata and GeoJSON validation.
- Four Playwright browser scenarios in headless Chromium covering:
  - Location shortcuts, map clicks, place search, playback, shared URL state and reload, chart expansion, layer toggles and CSV download/content.
  - GeoJSON polygon upload, attribute inspection, safe display of HTML-like text, removal and invalid coordinate errors.
  - HTTP 429 errors, no fabricated fallback, and stale cached model data after failed refresh.
  - Desktop and mobile layouts, no horizontal overflow at 390 px, and a root-font scaling check. The scaling check is not a full accessibility audit.
- Screenshots inspected at desktop and mobile widths.
- Independent real HTTPS requests to the Open-Meteo forecast and geocoding endpoints returned HTTP 200. Responses with an Origin header included `Access-Control-Allow-Origin: *`.
- The compiled production application successfully parsed and rendered a captured real Open-Meteo response (through a test interception). No production JavaScript runtime errors were reported in that check.
- Dependency lockfile consistency checked using an npm ci dry run.

## Test isolation

The four automated UI scenarios use explicitly synthetic API fixtures and abort basemap/font requests. These fixtures are confined to tests and are not included in the production app. They establish interaction behavior, not live service availability or forecast accuracy.

The captured-response production check used real provider data obtained separately, but the browser received it via a test interception. That check verifies real-response compatibility and production rendering; it is not an end-to-end live network test.

## Not verified / limitations

- Direct external forecast requests from the automated Chromium browser timed out in this execution environment. Basemap tiles and live browser geocoding were therefore not verified end to end. Independent HTTP API/CORS checks succeeded. Verify these services in an ordinary browser after deployment.
- The map's interactive layers, coordinate selection, controls, scale and failure states were tested. Successful external OSM tile rendering was not verified in the automated browser.
- GitHub Pages deployment was not executed because this deliverable is a source repository for the owner to upload. No live public URL is claimed.
- No flood-model skill validation, full accessibility audit, exhaustive GeoJSON topology audit, or load testing has been performed.
- Geographic shortcuts are approximate navigation points. Weather output is model data, not station observations. The rainfall indicator is uncalibrated and unvalidated.

## Reproduce

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

A Chromium executable can be supplied with `CHROMIUM_PATH` when using a preinstalled browser. Tests normally use Playwright's downloaded Chromium. Network access is required for a real live-provider check; automated fixture tests do not establish it.
