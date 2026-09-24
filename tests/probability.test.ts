import { expect, it } from "vitest";
import { parseForecast, csvForecast } from "../src/data";
function response(probability: unknown = [0, 100]) {
  return {
    latitude: 23,
    longitude: 90,
    hourly_units: {
      time: "unixtime",
      precipitation: "mm",
      precipitation_probability: "%",
      temperature_2m: "°C",
      relative_humidity_2m: "%",
      wind_speed_10m: "km/h",
    },
    hourly: {
      time: [1790251200, 1790254800],
      precipitation: [0, 2],
      precipitation_probability: probability,
      temperature_2m: [28, 29],
      relative_humidity_2m: [80, 90],
      wind_speed_10m: [10, 12],
    },
  };
}
it("preserves the 0 and 100 percent endpoints", () => {
  expect(
    parseForecast(response()).hours.map((h) => h.precipitationProbability),
  ).toEqual([0, 100]);
});
it.each([
  [null, null],
  [-1, 101],
  ["70", NaN],
])("never treats missing or invalid probability as zero: %s %s", (a, b) => {
  expect(
    parseForecast(response([a, b])).hours.map(
      (h) => h.precipitationProbability,
    ),
  ).toEqual([null, null]);
});
it("allows absent probability without losing the other forecast fields", () => {
  const f = parseForecast(response(null));
  expect(f.hours[0].precipitationProbability).toBeNull();
  expect(f.hours[1].precipitation).toBe(2);
});
it("rejects probability arrays that are not aligned or have wrong units", () => {
  expect(() => parseForecast(response([50]))).toThrow("arrays");
  const r = response();
  r.hourly_units.precipitation_probability = "fraction";
  expect(() => parseForecast(r)).toThrow("units");
});
it("exports probability separately from amount, with blanks for unavailable values", () => {
  const f = parseForecast(response([70, null]));
  const csv = csvForecast(f, { name: "test", lat: 23, lon: 90 }, f.hours);
  expect(csv).toContain("precipitation_probability_preceding_hour_percent");
  expect(csv).toContain('"0","70","28"');
  expect(csv).toContain('"2","","29"');
});
