# Sources, attribution and service terms

Official documentation checked during implementation on 24 September 2026. External terms may change; recheck before a public high-traffic or commercial launch.

## Open-Meteo forecast

- Documentation: https://open-meteo.com/en/docs
- Endpoint: https://api.open-meteo.com/v1/forecast
- Hourly fields: `precipitation`, `temperature_2m`, `relative_humidity_2m`, `wind_speed_10m`.
- Explicit units: mm, °C, %, km/h; `timeformat=unixtime`; `timezone=Asia/Dhaka`.
- Eight requested calendar days cover a seven-day forward viewport.
- Data licence: CC BY 4.0. Display attribution links Open-Meteo; CSV retains source/licence identification. Computed totals and indicator are application-derived transformations.
- Terms: https://open-meteo.com/en/terms
- The free service is restricted to noncommercial use. Published limits at review: fewer than 600 calls/minute, 5,000/hour, 10,000/day; the plan table also lists 300,000/month. These are provider limits, not guaranteed per-visitor allowances.
- No API key is used. Direct HTTPS GET integration is attempted from the browser. See VALIDATION.md for the actual browser/network verification outcome.
- Model source choice and resolution vary; there is no observation or issuance-time claim.

## Place search

- Documentation: https://open-meteo.com/en/docs/geocoding-api
- Endpoint: https://geocoding-api.open-meteo.com/v1/search
- `countryCode=BD`, with a second Bangladesh filter on returned results.
- Open-Meteo's geocoding data are based on GeoNames: https://www.geonames.org/ (CC BY). Attribution is linked in the methodology panel.
- Built-in study-location shortcuts and coordinate search need no geocoding network call.

## OpenStreetMap

- Tiles: https://tile.openstreetmap.org/{z}/{x}/{y}.png
- Attribution: © OpenStreetMap contributors, https://www.openstreetmap.org/copyright
- OSM database: ODbL. Rendered tile usage follows https://operations.osmfoundation.org/policies/tiles/.
- Standard Leaflet browser requests, normal browser caching and visible attribution are used. No offline tile download, prefetching, bulk scraping, cache bypass or tile export is implemented.
- No availability guarantee. Use a suitable alternative tile provider if project traffic grows. The app shows a tile-error message and retains coordinate selection when tiles fail.

## Fonts, code and icons

- DM Sans and Manrope via Google Fonts, under the SIL Open Font License. System font fallback is provided. Font requests may be blocked without breaking the app.
- React, Vite, TypeScript, Recharts, Turf and Lucide retain their upstream open-source licences. Leaflet is BSD-2-Clause. Package versions are recorded in package-lock.json.
- The project's MIT licence covers its original source, not ownership of third-party data, map tiles, fonts, dependencies or user uploads.

## Local data and privacy

GeoJSON is parsed in browser memory, is not sent to the forecasting provider and is not retained across reloads. Point coordinates are sent to Open-Meteo for forecasts; search text is sent for place-name lookup. Weather cache is stored in localStorage. The app does not add analytics or authentication.
