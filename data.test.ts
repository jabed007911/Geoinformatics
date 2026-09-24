import { describe, it, expect } from "vitest";
import {
  HOUR,
  accumulate,
  indicator,
  startBoundary,
  localTime,
  parseForecast,
  csvForecast,
  type Hour,
} from "../src/data";
import { validateGeoJSON } from "../src/geo";
const t = Date.UTC(2026, 8, 24, 18);
const series = (n: number): Hour[] =>
  Array.from({ length: n + 1 }, (_, i) => ({
    time: t + i * HOUR,
    precipitation: i === 0 ? 999 : 1,
    temperature: 27,
    humidity: 85,
    wind: 9,
  }));
describe("preceding-hour accumulation", () => {
  it("excludes the value ending at T, includes the final boundary, and spans multiple days", () => {
    expect(accumulate(series(72), t, 24)).toBe(24);
    expect(accumulate(series(72), t, 48)).toBe(48);
    expect(accumulate(series(72), t, 72)).toBe(72);
  });
  it("rejects gaps, duplicates, missing/invalid values and a truncated forecast", () => {
    const full = series(24);
    expect(
      accumulate(
        full.filter((_, i) => i !== 10),
        t,
        24,
      ),
    ).toBeNull();
    expect(accumulate([...full, full[10]], t, 24)).toBeNull();
    expect(
      accumulate(
        full.map((h, i) => (i === 5 ? { ...h, precipitation: null } : h)),
        t,
        24,
      ),
    ).toBeNull();
    expect(
      accumulate(
        full.map((h, i) => (i === 5 ? { ...h, precipitation: -1 } : h)),
        t,
        24,
      ),
    ).toBeNull();
    expect(accumulate(series(23), t, 24)).toBeNull();
  });
  it("distinguishes zero from missing and rejects an unaligned window", () => {
    expect(
      accumulate(
        series(24).map((h) => ({ ...h, precipitation: 0 })),
        t,
        24,
      ),
    ).toBe(0);
    expect(accumulate(series(24), t + 1000, 24)).toBeNull();
  });
});
describe("time and indicator", () => {
  it("uses the next full hour without shifting an exact boundary", () => {
    expect(startBoundary(t)).toBe(t);
    expect(startBoundary(t + 1)).toBe(t + HOUR);
  });
  it("formats Bangladesh midnight across the UTC date boundary", () => {
    expect(localTime(t)).toBe("25 Sept, 00:00");
  });
  it.each([
    [0, 0],
    [24.99, 0],
    [25, 1],
    [49.99, 1],
    [50, 2],
    [99.99, 2],
    [100, 3],
    [null, -1],
    [-1, -1],
    [NaN, -1],
  ])("classifies %s as band %s", (value, level) =>
    expect(indicator(value).level).toBe(level),
  );
});
function raw() {
  return {
    latitude: 22.7,
    longitude: 89.1,
    hourly_units: {
      time: "unixtime",
      precipitation: "mm",
      temperature_2m: "°C",
      relative_humidity_2m: "%",
      wind_speed_10m: "km/h",
    },
    hourly: {
      time: [t / 1000, t / 1000 + 3600],
      precipitation: [0, null],
      temperature_2m: [27, 28],
      relative_humidity_2m: [90, 101],
      wind_speed_10m: [8, -1],
    },
  };
}
describe("provider response and export", () => {
  it("keeps nulls and quarantines invalid measurements without interpreting them as zero", () => {
    const f = parseForecast(raw(), t);
    expect(f.hours[1].precipitation).toBeNull();
    expect(f.hours[1].humidity).toBeNull();
    expect(f.hours[1].wind).toBeNull();
  });
  it("rejects unexpected units, non-hourly times and mismatched arrays", () => {
    const a = raw();
    a.hourly_units.precipitation = "inch";
    expect(() => parseForecast(a)).toThrow("units");
    const b = raw();
    b.hourly.time[1] += 1;
    expect(() => parseForecast(b)).toThrow("timestamps");
    const c = raw();
    c.hourly.precipitation.pop();
    expect(() => parseForecast(c)).toThrow("arrays");
  });
  it("exports UTC, explicit variables, grid coordinates, retrieval time and blank missing values", () => {
    const f = parseForecast(raw(), t);
    const csv = csvForecast(f, { name: "test", lat: 22.7, lon: 89.1 }, f.hours);
    expect(csv).toContain("precipitation_preceding_hour_mm");
    expect(csv).toContain("2026-09-24T18:00:00.000Z");
    expect(csv).toContain("model_grid_latitude");
    expect(csv).toContain('"","28","",""');
  });
});
describe("GeoJSON input", () => {
  it("accepts points and a closed WGS84 polygon", () => {
    expect(
      validateGeoJSON({ type: "Point", coordinates: [89, 23] }).features,
    ).toHaveLength(1);
    expect(
      validateGeoJSON({
        type: "Polygon",
        coordinates: [
          [
            [89, 23],
            [90, 23],
            [90, 24],
            [89, 23],
          ],
        ],
      }).features,
    ).toHaveLength(1);
  });
  it("rejects unclosed rings, projected coordinates, empty features and unknown geometry", () => {
    expect(() =>
      validateGeoJSON({
        type: "Polygon",
        coordinates: [
          [
            [89, 23],
            [90, 23],
            [90, 24],
            [89, 24],
          ],
        ],
      }),
    ).toThrow("closed");
    expect(() =>
      validateGeoJSON({ type: "Point", coordinates: [500000, 2600000] }),
    ).toThrow("coordinates");
    expect(() =>
      validateGeoJSON({ type: "FeatureCollection", features: [] }),
    ).toThrow("No features");
    expect(() => validateGeoJSON({ type: "Bad", coordinates: [0, 0] })).toThrow(
      "Unsupported",
    );
  });
});
