import { test, expect, type Page } from "@playwright/test";
const H = 3600000;
// Deliberately synthetic: only used to verify UI behavior, never bundled in the app.
function fixture() {
  const start = Math.floor(Date.now() / H) * H;
  const times = Array.from({ length: 194 }, (_, i) => start / 1000 + i * 3600);
  return {
    latitude: 22.75,
    longitude: 89.0625,
    hourly_units: {
      time: "unixtime",
      precipitation: "mm",
      temperature_2m: "°C",
      relative_humidity_2m: "%",
      wind_speed_10m: "km/h",
    },
    hourly: {
      time: times,
      precipitation: times.map(
        (_, i) => +Math.max(0, 3 * Math.sin(i / 8)).toFixed(1),
      ),
      temperature_2m: times.map(
        (_, i) => +(28 + 3 * Math.cos(i / 5)).toFixed(1),
      ),
      relative_humidity_2m: times.map(() => 85),
      wind_speed_10m: times.map(() => 12),
    },
  };
}
async function intercept(page: Page) {
  await page.route("https://api.open-meteo.com/**", (route) =>
    route.fulfill({ json: fixture() }),
  );
  await page.route("https://geocoding-api.open-meteo.com/**", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            name: "Dhaka",
            admin1: "Dhaka",
            country_code: "BD",
            latitude: 23.81,
            longitude: 90.41,
          },
        ],
      },
    }),
  );
  // Network-dependent assets are not required for deterministic behavior checks.
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByText("Forecast available", { exact: true }),
  ).toBeVisible();
}
test("forecast, map selection, search, playback, share state, CSV and layer controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await intercept(page);
  await expect(page.locator(".metric-value").first()).not.toHaveText("—mm");
  await page.getByRole("button", { name: "Tarash" }).click();
  await expect(
    page.getByRole("heading", { name: "Tarash", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Forecast available", { exact: true }),
  ).toBeVisible();
  await page.locator(".map").click({ position: { x: 100, y: 160 } });
  await expect(
    page.getByRole("heading", { name: "Selected point", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Forecast available", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Find a location").fill("Dhaka");
  await page.getByRole("button", { name: "Search locations" }).click();
  await page.getByRole("button", { name: "Dhaka, Dhaka", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dhaka, Dhaka", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Forecast available", { exact: true }),
  ).toBeVisible();
  const range = page.getByRole("slider", { name: "Forecast hour" });
  await range.fill("12");
  await expect(range).toHaveValue("12");
  await page.getByRole("button", { name: "Play forecast timeline" }).click();
  await expect(range).not.toHaveValue("12");
  await page.getByRole("button", { name: "Pause forecast playback" }).click();
  await page.getByRole("checkbox", { name: "OpenStreetMap" }).uncheck();
  await expect(page).toHaveURL(/base=0/);
  await expect(page).toHaveURL(/lat=23.8100/);
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await dl;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const stream = await download.createReadStream();
  let content = "";
  for await (const b of stream!) content += b.toString();
  expect(content).toContain("precipitation_preceding_hour_mm");
  expect(content.split("\r\n").length).toBeGreaterThan(160);
  await page.getByRole("button", { name: "Show full forecast chart" }).click();
  await expect(page.locator(".chart-panel")).toHaveClass(/expanded/);
  await page.getByRole("button", { name: "Methodology", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "OpenStreetMap" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("heading", { name: "Dhaka, Dhaka", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("GeoJSON upload, attribute text safety, removal and invalid-file feedback", async ({
  page,
}) => {
  await intercept(page);
  const geo = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "TEST AREA", note: "<img src=x onerror=alert(1)>" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [89.05, 22.7],
              [89.1, 22.7],
              [89.1, 22.75],
              [89.05, 22.75],
              [89.05, 22.7],
            ],
          ],
        },
      },
    ],
  };
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "test.geojson",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(geo)),
    });
  await expect(
    page.getByText("1 features · polygon area", { exact: false }),
  ).toBeVisible();
  await page
    .locator('.leaflet-overlay-pane path[fill="#b295cd"]')
    .click({ force: true });
  await expect(page.getByText("TEST AREA", { exact: true })).toBeVisible();
  await expect(page.locator(".attribute-panel img")).toHaveCount(0);
  await page.getByRole("button", { name: "Remove layer", exact: true }).click();
  await expect(page.locator(".upload-summary")).toHaveCount(0);
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "bad.geojson",
      mimeType: "application/json",
      buffer: Buffer.from('{"type":"Point","coordinates":[900,100]}'),
    });
  await expect(page.getByRole("alert")).toContainText("Invalid coordinates");
});
test("provider failures never create synthetic forecasts; stale cache is identified", async ({
  page,
}) => {
  await page.route("https://api.open-meteo.com/**", (route) =>
    route.fulfill({ status: 429, json: { error: true } }),
  );
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("rate limit");
  await expect(page.locator(".metric-value").first()).toHaveText("—mm");
  const r = fixture();
  await page.evaluate(
    ({ r, H }) =>
      localStorage.setItem(
        "geoforecast-v1:22.7185:89.0705",
        JSON.stringify({
          fetchedAt: Date.now() - H,
          gridLat: r.latitude,
          gridLon: r.longitude,
          hours: r.hourly.time.map((t, i) => ({
            time: t * 1000,
            precipitation: r.hourly.precipitation[i],
            temperature: r.hourly.temperature_2m[i],
            humidity: 85,
            wind: 12,
          })),
        }),
      ),
    { r, H },
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Showing saved model data",
  );
  await expect(page.locator(".metric-value").first()).not.toHaveText("—mm");
});
test("mobile layout and 200% text scale fit without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await intercept(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Shyamnagar" }).click();
  await expect(
    page.getByRole("heading", { name: "Shyamnagar", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Forecast available", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show Bangladesh extent" }).click();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
