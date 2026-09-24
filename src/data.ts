export type Place = { name: string; lat: number; lon: number };
export type Hour = {
  time: number;
  precipitation: number | null;
  temperature: number | null;
  humidity: number | null;
  wind: number | null;
};
export type Forecast = {
  hours: Hour[];
  fetchedAt: number;
  gridLat: number;
  gridLon: number;
};
export const HOUR = 3600000;
export const TTL = 30 * 60 * 1000;
export const places: Place[] = [
  { name: "Satkhira", lat: 22.7185, lon: 89.0705 },
  { name: "Shyamnagar", lat: 22.3306, lon: 89.1028 },
  { name: "Tarash", lat: 24.4333, lon: 89.375 },
  { name: "Louhajang", lat: 23.4667, lon: 90.3417 },
];
export const validCoords = (lat: number, lon: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180;
export const fmt = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? "—" : n.toFixed(digits);
export const localTime = (ms: number, short = false) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    ...(short ? {} : { day: "2-digit", month: "short" }),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
export const startBoundary = (now: number) => Math.ceil(now / HOUR) * HOUR;
// Precipitation is the sum for the hour ENDING at its timestamp. A window
// (start, start + duration] includes exactly duration complete hourly values.
export function accumulate(
  hours: Hour[],
  start: number,
  duration: number,
): number | null {
  if (
    !Number.isFinite(start) ||
    start % HOUR !== 0 ||
    !Number.isInteger(duration) ||
    duration < 1
  )
    return null;
  const selected = hours.filter(
    (h) => h.time > start && h.time <= start + duration * HOUR,
  );
  if (selected.length !== duration) return null;
  let total = 0;
  for (let i = 0; i < duration; i++) {
    const h = selected[i];
    if (
      h.time !== start + (i + 1) * HOUR ||
      h.precipitation == null ||
      !Number.isFinite(h.precipitation) ||
      h.precipitation < 0
    )
      return null;
    total += h.precipitation;
  }
  return Math.round(total * 100) / 100;
}
export function indicator(total: number | null) {
  if (total == null || !Number.isFinite(total) || total < 0)
    return { label: "Unavailable", color: "#667788", level: -1 };
  if (total < 25)
    return { label: "Lower rainfall", color: "#147d79", level: 0 };
  if (total < 50)
    return { label: "Elevated rainfall", color: "#967000", level: 1 };
  if (total < 100)
    return { label: "High rainfall", color: "#bd6514", level: 2 };
  return { label: "Very high rainfall", color: "#b43d49", level: 3 };
}
function value(v: unknown, low: number, high: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= low && v <= high
    ? v
    : null;
}
export function parseForecast(raw: unknown, now = Date.now()): Forecast {
  const r = raw as Record<string, any>;
  const h = r?.hourly,
    u = r?.hourly_units;
  if (!h || !Array.isArray(h.time) || h.time.length === 0)
    throw new Error("The provider returned no hourly forecasts.");
  if (
    !u ||
    u.time !== "unixtime" ||
    u.precipitation !== "mm" ||
    u.temperature_2m !== "°C" ||
    u.relative_humidity_2m !== "%" ||
    u.wind_speed_10m !== "km/h"
  )
    throw new Error("Unexpected forecast units. Data were not displayed.");
  const keys = [
    "precipitation",
    "temperature_2m",
    "relative_humidity_2m",
    "wind_speed_10m",
  ];
  if (keys.some((k) => !Array.isArray(h[k]) || h[k].length !== h.time.length))
    throw new Error("The forecast contains inconsistent hourly arrays.");
  if (!validCoords(r.latitude, r.longitude))
    throw new Error("Invalid forecast grid coordinates.");
  const hours = h.time.map((t: unknown, i: number): Hour => {
    if (
      typeof t !== "number" ||
      !Number.isFinite(t) ||
      t < 946684800 ||
      t > 4102444800 ||
      t % 3600 !== 0 ||
      (i > 0 && t !== h.time[i - 1] + 3600)
    )
      throw new Error(
        "The forecast contains invalid or non-hourly timestamps.",
      );
    return {
      time: t * 1000,
      precipitation: value(h.precipitation[i], 0, 2000),
      temperature: value(h.temperature_2m[i], -100, 70),
      humidity: value(h.relative_humidity_2m[i], 0, 100),
      wind: value(h.wind_speed_10m[i], 0, 500),
    };
  });
  return { hours, fetchedAt: now, gridLat: r.latitude, gridLon: r.longitude };
}
export async function requestJson(
  url: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const timeout = AbortSignal.timeout(15000);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Provider rate limit reached. Wait a few minutes before trying again."
        : `Data service unavailable (HTTP ${response.status}). Please try again.`,
    );
  return response.json();
}
export async function fetchForecast(place: Place, signal: AbortSignal) {
  if (!validCoords(place.lat, place.lon))
    throw new Error("Invalid location coordinates.");
  const q = new URLSearchParams({
    latitude: String(place.lat),
    longitude: String(place.lon),
    hourly: "precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m",
    forecast_days: "8",
    timezone: "Asia/Dhaka",
    timeformat: "unixtime",
    wind_speed_unit: "kmh",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
  });
  return parseForecast(
    await requestJson(`https://api.open-meteo.com/v1/forecast?${q}`, signal),
  );
}
export function cacheKey(p: Place) {
  return `geoforecast-v1:${p.lat.toFixed(4)}:${p.lon.toFixed(4)}`;
}
export function readCache(p: Place): Forecast | null {
  try {
    const f = JSON.parse(
      localStorage.getItem(cacheKey(p)) || "null",
    ) as Forecast;
    if (
      !f ||
      !Number.isFinite(f.fetchedAt) ||
      f.fetchedAt > Date.now() + 60000 ||
      Date.now() - f.fetchedAt > 86400000 ||
      !validCoords(f.gridLat, f.gridLon) ||
      !Array.isArray(f.hours) ||
      !f.hours.length
    )
      return null;
    if (
      f.hours.some(
        (h, i) =>
          !Number.isFinite(h.time) ||
          h.time % HOUR !== 0 ||
          (i > 0 && h.time !== f.hours[i - 1].time + HOUR) ||
          [
            ["precipitation", 0, 2000],
            ["temperature", -100, 70],
            ["humidity", 0, 100],
            ["wind", 0, 500],
          ].some(([k, lo, hi]) => {
            const v = h[k as keyof Hour];
            return (
              v !== null &&
              (typeof v !== "number" ||
                !Number.isFinite(v) ||
                v < Number(lo) ||
                v > Number(hi))
            );
          }),
      )
    )
      return null;
    return f;
  } catch {
    return null;
  }
}
export function writeCache(p: Place, f: Forecast) {
  try {
    localStorage.setItem(cacheKey(p), JSON.stringify(f));
  } catch {
    /* Browsing with storage disabled still works. */
  }
}
export function csvForecast(f: Forecast, p: Place, hours: Hour[]) {
  const cell = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const header = [
    "valid_time_utc",
    "valid_time_dhaka",
    "precipitation_preceding_hour_mm",
    "temperature_2m_C",
    "humidity_2m_percent",
    "wind_10m_kmh",
    "requested_latitude",
    "requested_longitude",
    "model_grid_latitude",
    "model_grid_longitude",
    "retrieved_utc",
    "source",
  ];
  return [
    header.join(","),
    ...hours.map((h) =>
      [
        new Date(h.time).toISOString(),
        new Date(h.time + 6 * HOUR).toISOString().replace("Z", "+06:00"),
        h.precipitation,
        h.temperature,
        h.humidity,
        h.wind,
        p.lat,
        p.lon,
        f.gridLat,
        f.gridLon,
        new Date(f.fetchedAt).toISOString(),
        "Open-Meteo model forecast; CC BY 4.0",
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
}
