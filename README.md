# Bangladesh GeoForecast

**Live Weather & Flood-Risk Explorer** — a Web GIS portfolio project by **Kazi Md. Jabed Hossain**.

Explore model weather forecasts for Bangladesh, inspect seven days of hourly values, and examine a transparent experimental rainfall indicator. This is a research demonstration, **not an official warning service or a validated flood forecasting model**.

## Run locally

Install Node.js 22 LTS or later, then open a terminal inside this folder:

```sh
npm ci
npm run dev
```

Open the local address printed by Vite (normally http://localhost:5173). Do not open `index.html` directly from the filesystem. Forecasts, map tiles, place search, and optional web fonts require an internet connection. There are no API keys to configure.

```sh
npm test             # scientific calculation and input validation tests
npm run build        # TypeScript check + static production build
npm run preview      # inspect dist/ locally
```

## Publish with GitHub Pages

1. Create a new GitHub repository named `bangladesh-geoforecast` (public is simplest for a portfolio). Do not pre-add a README if using the terminal steps below.
2. Upload **the contents of this project folder**, including `src`, `package.json`, `package-lock.json`, `vite.config.ts`, `index.html`, `tsconfig.json`, and **`.github/workflows/deploy.yml`**. The hidden `.github` folder is essential. Do not upload `node_modules`.
3. In GitHub, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Open **Actions → Test and deploy GeoForecast → Run workflow**, or push a new commit to `main`.
5. Wait for both `build` and `deploy` to succeed. The deployment job and Pages settings will show your real website URL, typically `https://YOUR_USERNAME.github.io/bangladesh-geoforecast/`.

Terminal alternative, after creating the empty repository (replace YOUR_USERNAME):

```sh
git init
git add .
git commit -m "Build Bangladesh GeoForecast portfolio app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bangladesh-geoforecast.git
git push -u origin main
```

The workflow runs tests before deployment. `base: './'` in `vite.config.ts` makes asset paths relative, supporting both repository subpaths and custom-domain roots. This single-page application stores navigation in query parameters, so it needs no server route rewrites. No website has been published on your behalf by this source package.

## Using the dashboard

- Click the map, use a study-location shortcut, search a Bangladesh town, or enter `latitude, longitude`.
- Use the timeline to inspect a forecast hour; playback changes the cards and point tooltip. Reset returns to the current outlook start.
- 24/48/72-hour totals start at the selected time. Near the forecast end, incomplete windows display a dash.
- Expand the precipitation chart to see the full outlook.
- Toggle the basemap and study-location markers. Recenter on the point or fit Bangladesh with the map buttons.
- Upload WGS84 GeoJSON (up to 5 MB, 3,000 features, 100,000 vertices). Select a feature to inspect its attributes. Polygon area is computed locally; overlaps are counted separately.
- Export the visible seven-day hourly series as CSV. Columns state units, UTC valid time, Bangladesh local time, requested coordinates, returned model grid coordinates, retrieval time and source.
- Share copies the URL with point, map extent, visible built-in layers and selected time. If clipboard access is unavailable, copy the browser address manually. Uploaded files are never included.

The point colour represents the _next 24-hour precipitation band_, not the hourly value and not flood probability. No continuous rainfall layer or observation layer is implied.

## Configure your profile

Edit `src/config.ts` to add your GitHub URL, portfolio URL and email. Empty contact fields are hidden. The author information does not claim unverified employment, agency affiliations or qualifications.

## Implementation

- React + TypeScript + Vite
- Leaflet / OpenStreetMap: interactive cartography
- Recharts: precipitation time series
- Turf: basic geometry validation and spherical polygon area
- Open-Meteo: model forecasts and GeoNames-backed place search
- GitHub Actions / Pages: static deployment

```text
src/
  App.tsx          dashboard, requests, search, timeline and exports
  MapView.tsx      Leaflet map, point layers and local feature inspection
  data.ts          time handling, accumulation, provider validation and cache
  geo.ts           GeoJSON checks and spatial area measurement
  config.ts        configurable author profile
  style.css        responsive design
  main.tsx         React entry
 tests/
  data.test.ts     calculation, time, provider and GeoJSON tests
  browser.spec.ts  browser interaction tests (test-only synthetic API responses)
 docs/
  METHODOLOGY.md
  DATA_SOURCES.md
  VALIDATION.md
  PORTFOLIO.md
.github/workflows/deploy.yml
```

## Browser tests

```sh
npx playwright install chromium
npm run test:browser
```

These browser tests deliberately use synthetic responses to test predictable interaction and failure cases. Fixtures exist only in `tests/`; the production app has **no synthetic fallback**. See `docs/VALIDATION.md` for what was actually run in the build environment and the separate real-provider checks.

## Reliability and limits

Fetches are cancellable, have a 15-second timeout, and debounce point changes. Validated results are cached per rounded coordinate for 30 minutes. Stale cached results can remain visible for up to 24 hours after retrieval if the provider is unavailable. A missing value is never silently converted to zero. Rate-limit errors are explicit; refresh has a 10-second session cooldown. There is no automatic background polling.

The free API is intended for noncommercial use. A static client cannot enforce a global request budget across visitors. Review provider terms before commercial use or substantial traffic. API and tile service availability remain external dependencies. No secrets should be added to frontend code.

GeoJSON checks are not an exhaustive topology audit; pre-validate complex datasets in desktop GIS. Geometry uploads remain in browser memory and are lost on reload. Cached weather is stored on the current device. Requests to external services expose ordinary connection information and the queried coordinates; the app adds no analytics or account system.

Scientific details: [Methodology](docs/METHODOLOGY.md). Attribution and limits: [Data sources](docs/DATA_SOURCES.md). Code: MIT; third-party data and dependencies retain their own licences.
