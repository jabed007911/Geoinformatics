import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  Globe2,
  Search,
  MapPin,
  Layers,
  Upload,
  Download,
  Share2,
  RefreshCw,
  Play,
  Pause,
  CloudRain,
  Wind,
  Droplets,
  Thermometer,
  ArrowUpRight,
  LocateFixed,
  Maximize2,
  ChevronDown,
  X,
  Info,
  Github,
  Mail,
} from "lucide-react";
import MapView, { type ViewState } from "./MapView";
import {
  HOUR,
  TTL,
  places,
  validCoords,
  fetchForecast,
  readCache,
  writeCache,
  accumulate,
  indicator,
  localTime,
  fmt,
  requestJson,
  startBoundary,
  csvForecast,
  type Forecast,
  type Place,
} from "./data";
import { validateGeoJSON, areaKm2 } from "./geo";
import type { FeatureCollection } from "geojson";
import { profile } from "./config";
const q = new URLSearchParams(location.search);
function numberParam(k: string, fallback: number) {
  const v = q.get(k);
  return v !== null && Number.isFinite(Number(v)) ? Number(v) : fallback;
}
const initialLat = numberParam("lat", places[0].lat),
  initialLon = numberParam("lon", places[0].lon);
const initialPlace: Place = validCoords(initialLat, initialLon)
  ? {
      name: (q.get("name") || places[0].name).slice(0, 100),
      lat: initialLat,
      lon: initialLon,
    }
  : places[0];
const vl = numberParam("mlat", 23.8),
  vn = numberParam("mlon", 90.3);
const initialView = {
  lat: validCoords(vl, vn) ? vl : 23.8,
  lon: validCoords(vl, vn) ? vn : 90.3,
  zoom: Math.max(3, Math.min(18, numberParam("z", 7))),
};
export default function App() {
  const [place, setPlace] = useState<Place>(initialPlace),
    [view, setView] = useState<ViewState>(initialView);
  const [forecast, setForecast] = useState<Forecast | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0),
    [now, setNow] = useState(Date.now()),
    [selectedTime, setSelectedTime] = useState(numberParam("time", 0));
  const [playing, setPlaying] = useState(false),
    [base, setBase] = useState(q.get("base") !== "0"),
    [shortcuts, setShortcuts] = useState(q.get("sites") !== "0");
  const [focus, setFocus] = useState(0),
    [home, setHome] = useState(0),
    [expanded, setExpanded] = useState(false),
    [panel, setPanel] = useState<"method" | "about" | null>(null);
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Place[]>([]),
    [searchStatus, setSearchStatus] = useState(""),
    [searching, setSearching] = useState(false);
  const [uploaded, setUploaded] = useState<FeatureCollection | null>(null),
    [uploadName, setUploadName] = useState(""),
    [showUpload, setShowUpload] = useState(true),
    [uploadError, setUploadError] = useState("");
  const [inspect, setInspect] = useState<Record<string, unknown> | null>(null),
    [toast, setToast] = useState("");
  const fileInput = useRef<HTMLInputElement>(null),
    searchAbort = useRef<AbortController | null>(null),
    modal = useRef<HTMLDialogElement>(null);
  const lastRefresh = useRef(0),
    forceNext = useRef(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (panel) modal.current?.showModal();
    else modal.current?.close();
  }, [panel]);
  useEffect(() => () => searchAbort.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    const cached = readCache(place);
    const force = forceNext.current;
    forceNext.current = false;
    setForecast(cached);
    setError("");
    setPlaying(false);
    if (!force && cached && Date.now() - cached.fetchedAt < TTL) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    const timer = setTimeout(() => {
      fetchForecast(place, controller.signal)
        .then((f) => {
          if (!controller.signal.aborted) {
            setForecast(f);
            writeCache(place, f);
            setNow(Date.now());
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(
              e instanceof Error ? e.message : "Unable to load forecasts.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [place, refresh]);
  const start = startBoundary(now);
  const hours = useMemo(
    () =>
      forecast?.hours.filter(
        (h) => h.time >= start && h.time <= start + 168 * HOUR,
      ) || [],
    [forecast, start],
  );
  const index = Math.max(
    0,
    hours.findIndex((h) => h.time === selectedTime),
  );
  const current = hours[index];
  const anchor = current?.time ?? start;
  const totals = [24, 48, 72].map((n) =>
    forecast ? accumulate(forecast.hours, anchor, n) : null,
  );
  const risk = indicator(totals[0]);
  const stale = !!forecast && now - forecast.fetchedAt >= TTL;
  useEffect(() => {
    if (forecast && now - forecast.fetchedAt > 86400000 && !loading) {
      setForecast(null);
      setError(
        "Saved forecast expired after 24 hours. Refresh to request current data.",
      );
    }
  }, [forecast, now, loading]);
  useEffect(() => {
    if (!playing || hours.length < 2) return;
    const id = setInterval(
      () =>
        setSelectedTime((t) => {
          const i = hours.findIndex((h) => h.time === t);
          return hours[(i + 1) % hours.length].time;
        }),
      900,
    );
    return () => clearInterval(id);
  }, [playing, hours]);
  useEffect(() => {
    const params = new URLSearchParams({
      lat: place.lat.toFixed(4),
      lon: place.lon.toFixed(4),
      name: place.name,
      mlat: view.lat.toFixed(4),
      mlon: view.lon.toFixed(4),
      z: String(view.zoom),
      base: base ? "1" : "0",
      sites: shortcuts ? "1" : "0",
    });
    if (selectedTime) params.set("time", String(selectedTime));
    history.replaceState(null, "", `${location.pathname}?${params}`);
  }, [place, view, base, shortcuts, selectedTime]);
  function select(p: Place, fly = false) {
    setPlace(p);
    setSelectedTime(0);
    setResults([]);
    setSearchStatus("");
    if (fly) setFocus((x) => x + 1);
  }
  async function search(e: React.FormEvent) {
    e.preventDefault();
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    const term = query.trim();
    setResults([]);
    setSearchStatus("");
    setSearching(false);
    if (term.length < 2) {
      setSearchStatus("Enter at least two characters.");
      return;
    }
    const coordinateMatch = term.match(
      /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
    );
    if (coordinateMatch) {
      const lat = +coordinateMatch[1],
        lon = +coordinateMatch[2];
      if (validCoords(lat, lon)) {
        select({ name: "Coordinate search", lat, lon }, true);
        setSearching(false);
      } else setSearchStatus("Latitude must be −90…90 and longitude −180…180.");
      return;
    }
    const local = places.filter((p) =>
      p.name.toLowerCase().includes(term.toLowerCase()),
    );
    if (local.length) {
      setResults(local);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const r = (await requestJson(
        `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: term, count: "7", language: "en", format: "json", countryCode: "BD" })}`,
        controller.signal,
      )) as any;
      if (controller.signal.aborted) return;
      const items = (Array.isArray(r.results) ? r.results : [])
        .filter(
          (x: any) =>
            x.country_code === "BD" && validCoords(x.latitude, x.longitude),
        )
        .map((x: any) => ({
          name: [x.name, x.admin1].filter(Boolean).join(", "),
          lat: x.latitude,
          lon: x.longitude,
        }));
      setResults(items);
      if (!items.length)
        setSearchStatus(
          "No places found. Try a nearby town or latitude, longitude.",
        );
    } catch {
      if (!controller.signal.aborted)
        setSearchStatus(
          "Search is unavailable. Use a shortcut, coordinates, or click the map.",
        );
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setUploadError("");
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Use a GeoJSON file smaller than 5 MB.");
      const data = validateGeoJSON(JSON.parse(await file.text()));
      setUploaded(data);
      setUploadName(file.name);
      setShowUpload(true);
      setInspect(null);
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : "Unable to read this file.",
      );
    }
    if (fileInput.current) fileInput.current.value = "";
  }
  function download() {
    if (!forecast) return;
    const url = URL.createObjectURL(
      new Blob([csvForecast(forecast, place, hours)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `geoforecast-${place.lat.toFixed(4)}-${place.lon.toFixed(4)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      setToast("Map link copied. Uploaded layers remain on your device.");
    } catch {
      setToast(
        "Copy the address in your browser to share this map. Uploaded layers are not included.",
      );
    }
  }
  const chartHours = expanded ? hours : hours.slice(index, index + 49);
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Globe2 size={26} />
          </div>
          <div>
            Bangladesh <strong>GeoForecast</strong>
            <span>Created by Kazi Md. Jabed Hossain</span>
          </div>
        </div>
        <nav aria-label="Information">
          <button onClick={() => setPanel("method")}>
            <Info size={16} />
            <span>Methodology</span>
          </button>
          <button onClick={() => setPanel("about")}>
            About the project <ArrowUpRight size={15} />
          </button>
        </nav>
        <div className="research-tag">
          RESEARCH EDITION <span>01</span>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <span className="eyebrow">EXPLORE BANGLADESH</span>
            <h1>Weather & rainfall</h1>
            <p>Inspect the weather ahead, one location at a time.</p>
          </div>
          <form onSubmit={search} className="search-form">
            <label htmlFor="place-search">Find a location</label>
            <div className="search-box">
              <input
                id="place-search"
                placeholder="Town or latitude, longitude"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={150}
              />
              <button aria-label="Search locations" disabled={searching}>
                <Search size={18} />
              </button>
            </div>
          </form>
          <div aria-live="polite" className="search-results">
            {searching && <p>Searching…</p>}
            {searchStatus && <p>{searchStatus}</p>}
            {results.map((r, i) => (
              <button key={i} onClick={() => select(r, true)}>
                <MapPin size={14} />
                {r.name}
              </button>
            ))}
          </div>
          <section className="shortcut-section">
            <div className="section-label">
              STUDY LOCATIONS <span>04</span>
            </div>
            {places.map((p, i) => (
              <button
                key={p.name}
                className={`location-button ${place.name === p.name ? "active" : ""}`}
                onClick={() => select(p, true)}
              >
                <span className="location-number">0{i + 1}</span>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.lat.toFixed(2)}° N · {p.lon.toFixed(2)}° E
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </section>
          <section className="layers-section">
            <div className="section-label">
              <span>
                <Layers size={15} /> MAP LAYERS
              </span>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={base}
                onChange={(e) => setBase(e.target.checked)}
              />{" "}
              OpenStreetMap <span>BASE</span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={shortcuts}
                onChange={(e) => setShortcuts(e.target.checked)}
              />{" "}
              Study locations <span>POINTS</span>
            </label>
            {uploaded && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={showUpload}
                  onChange={(e) => setShowUpload(e.target.checked)}
                />{" "}
                Uploaded features
              </label>
            )}
            <input
              ref={fileInput}
              type="file"
              accept=".geojson,.json,application/geo+json,application/json"
              hidden
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <button
              className="upload-button"
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={16} /> Add GeoJSON layer
            </button>
            <p className="micro">
              WGS84 · up to 5 MB · processed on your device
            </p>
            {uploadError && (
              <p className="inline-error" role="alert">
                {uploadError}
              </p>
            )}
            {uploaded && (
              <div className="upload-summary">
                <strong>{uploadName}</strong>
                <p>
                  {uploaded.features.length} features · polygon area{" "}
                  {fmt(areaKm2(uploaded), 2)} km²
                </p>
                <p>Click a feature to inspect its attributes.</p>
                <button
                  onClick={() => {
                    setUploaded(null);
                    setInspect(null);
                  }}
                >
                  Remove layer
                </button>
              </div>
            )}
          </section>
          <div className="sidebar-note">
            <CloudRain size={22} />
            <p>
              <strong>Weather is one part of risk.</strong>Rainfall alone cannot
              predict flooding. Read the methodology before interpreting the
              indicator.
            </p>
            <button
              onClick={() => setPanel("method")}
              aria-label="Read methodology"
            >
              <ArrowUpRight size={18} />
            </button>
          </div>
        </aside>
        <main>
          <div className="main-heading">
            <div>
              <div className="eyebrow">
                LOCATION OUTLOOK <span>/</span> MODEL FORECAST
              </div>
              <h2>{place.name}</h2>
              <p>
                {place.lat.toFixed(4)}° N, {place.lon.toFixed(4)}° E{" "}
                <span>·</span> All times Asia/Dhaka (UTC+6)
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="icon-button"
                onClick={share}
                aria-label="Copy shareable map link"
              >
                <Share2 size={18} />
              </button>
              <button
                className="button"
                disabled={!forecast || !hours.length}
                onClick={download}
              >
                <Download size={16} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
          <div className="status-row" aria-live="polite">
            <span className={`status-pill ${error || stale ? "warning" : ""}`}>
              {loading
                ? "Loading forecast…"
                : error
                  ? stale
                    ? "Connection issue · stale cache"
                    : "Connection issue"
                  : stale
                    ? "Cached · stale"
                    : forecast
                      ? "Forecast available"
                      : "No forecast"}
            </span>
            <span>
              {forecast
                ? `Retrieved ${localTime(forecast.fetchedAt)}`
                : loading
                  ? "Connecting to Open-Meteo"
                  : "No forecast retrieved"}
            </span>
            <button
              disabled={loading}
              onClick={() => {
                if (Date.now() - lastRefresh.current < 10000) {
                  setToast("Please wait 10 seconds between refreshes.");
                  return;
                }
                lastRefresh.current = Date.now();
                forceNext.current = true;
                setRefresh((n) => n + 1);
              }}
            >
              <RefreshCw size={14} className={loading ? "spinning" : ""} />{" "}
              Refresh
            </button>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}{" "}
              {forecast
                ? "Showing saved model data; check its retrieval time."
                : "No forecast values have been substituted. Try Refresh or another location."}
            </div>
          )}
          {forecast && !hours.length && (
            <div className="error-banner">
              No forecast hours cover the current outlook. Refresh to request a
              new forecast.
            </div>
          )}
          <div
            className="metrics"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
            }}
          >
            {[
              {
                label: "PRECIPITATION",
                value: fmt(current?.precipitation),
                unit: "mm",
                note: "Preceding hour",
                icon: CloudRain,
              },
              {
                label: "CHANCE OF RAIN",
                value: fmt(current?.precipitationProbability, 0),
                unit: "%",
                note:
                  current?.precipitationProbability == null
                    ? "Provider probability unavailable"
                    : "Preceding hour · >0.1 mm",
                icon: CloudRain,
              },
              {
                label: "TEMPERATURE",
                value: fmt(current?.temperature),
                unit: "°C",
                note: "2 m above ground",
                icon: Thermometer,
              },
              {
                label: "RELATIVE HUMIDITY",
                value: fmt(current?.humidity, 0),
                unit: "%",
                note: "2 m above ground",
                icon: Droplets,
              },
              {
                label: "WIND SPEED",
                value: fmt(current?.wind),
                unit: "km/h",
                note: "10 m above ground",
                icon: Wind,
              },
            ].map((m) => (
              <div className="metric" key={m.label}>
                <div className="metric-label">
                  {m.label}
                  <m.icon size={19} />
                </div>
                <div className="metric-value">
                  {m.value}
                  <span>{m.unit}</span>
                </div>
                <div className="metric-note">{m.note}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#42566b" }}>
            Chance of rain is Open-Meteo's precipitation probability (rain,
            showers or snow), not an observed value or flood probability. It
            covers the hour ending at the selected timeline time
            {current
              ? `: ${localTime(current.time - HOUR)}–${localTime(current.time)} (Bangladesh time)`
              : ""}
            . Missing probability is shown as —, not zero.
          </p>
          <div className="map-section">
            <MapView
              place={place}
              view={view}
              onView={setView}
              onSelect={(p) => select(p)}
              base={base}
              shortcuts={shortcuts}
              uploaded={uploaded}
              showUpload={showUpload}
              color={risk.color}
              hourValue={current?.precipitation ?? null}
              focus={focus}
              home={home}
              onInspect={setInspect}
            />
            <div className="map-tools">
              <button
                className="icon-button"
                aria-label="Zoom to selected location"
                onClick={() => setFocus((n) => n + 1)}
              >
                <LocateFixed size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Show Bangladesh extent"
                onClick={() => setHome((n) => n + 1)}
              >
                <Maximize2 size={18} />
              </button>
            </div>
            <div className="map-legend">
              <strong>24 h rainfall indicator</strong>
              <div>
                <i style={{ background: "#147d79" }} /> &lt;25{" "}
                <i style={{ background: "#967000" }} /> 25–&lt;50{" "}
                <i style={{ background: "#bd6514" }} /> 50–&lt;100{" "}
                <i style={{ background: "#b43d49" }} /> ≥100 mm
              </div>
              <small>Grey = unavailable · purple = your GeoJSON</small>
            </div>
            {inspect && (
              <div className="attribute-panel">
                <div>
                  <strong>Feature attributes</strong>
                  <button
                    aria-label="Close attributes"
                    onClick={() => setInspect(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
                {Object.keys(inspect).length ? (
                  <dl>
                    {Object.entries(inspect).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>
                          {typeof v === "object"
                            ? JSON.stringify(v)
                            : String(v ?? "—")}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p>No attributes supplied.</p>
                )}
              </div>
            )}
          </div>
          <section className="timeline">
            <div className="timeline-head">
              <span className="section-label">FORECAST TIMELINE</span>
              <strong>
                {current ? localTime(current.time) : "Awaiting forecast"}{" "}
                <small>UTC+6</small>
              </strong>
              <button
                onClick={() => {
                  setSelectedTime(0);
                  setPlaying(false);
                }}
                disabled={!hours.length}
              >
                Reset
              </button>
            </div>
            <div className="timeline-controls">
              <button
                className="play-button"
                aria-label={
                  playing ? "Pause forecast playback" : "Play forecast timeline"
                }
                disabled={hours.length < 2}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <input
                aria-label="Forecast hour"
                type="range"
                min="0"
                max={Math.max(0, hours.length - 1)}
                value={index}
                disabled={!hours.length}
                onChange={(e) => {
                  setPlaying(false);
                  setSelectedTime(hours[+e.target.value].time);
                }}
              />
              <span>
                +{current ? Math.round((current.time - start) / HOUR) : 0} h
              </span>
            </div>
            <div className="timeline-dates">
              <span>{hours[0] ? localTime(hours[0].time) : "Start"}</span>
              <span>
                {hours.at(-1)
                  ? localTime(hours.at(-1)!.time)
                  : "Seven-day outlook"}
              </span>
            </div>
          </section>
          <div className="analysis-grid">
            <section className={`chart-panel ${expanded ? "expanded" : ""}`}>
              <div className="panel-title">
                <div>
                  <span className="eyebrow">HOURLY OUTLOOK</span>
                  <h3>Precipitation over time</h3>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setExpanded(!expanded)}
                  aria-label={
                    expanded ? "Show 48-hour chart" : "Show full forecast chart"
                  }
                  aria-expanded={expanded}
                >
                  {expanded ? (
                    <ChevronDown size={18} />
                  ) : (
                    <Maximize2 size={18} />
                  )}
                </button>
              </div>
              <div className="chart">
                {hours.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartHours}
                      margin={{ left: -22, right: 12, top: 12, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="rain-fill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#198f99"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="100%"
                            stopColor="#198f99"
                            stopOpacity={0.03}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 5"
                        vertical={false}
                        stroke="#dce5e8"
                      />
                      <XAxis
                        dataKey="time"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(t) => localTime(t)}
                        minTickGap={25}
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        unit=""
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, "auto"]}
                      />
                      <Tooltip
                        labelFormatter={(v) => `${localTime(Number(v))} UTC+6`}
                        formatter={(v) => [
                          `${v} mm`,
                          "Preceding-hour precipitation",
                        ]}
                      />
                      <ReferenceLine
                        x={anchor}
                        stroke="#be781b"
                        strokeDasharray="4 4"
                      />
                      <Area
                        type="stepAfter"
                        dataKey="precipitation"
                        stroke="#14838c"
                        fill="url(#rain-fill)"
                        strokeWidth={2}
                        isAnimationActive={false}
                        connectNulls={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-chart">
                    <CloudRain size={32} />
                    <p>
                      {loading
                        ? "Loading hourly forecast…"
                        : "Hourly forecast unavailable"}
                    </p>
                    <span>
                      Live data will appear here after a successful request.
                    </span>
                  </div>
                )}
              </div>
              <p className="chart-foot">
                mm per preceding hour ·{" "}
                {expanded
                  ? "Full seven-day outlook"
                  : "Up to 48 hours from the selected time"}
              </p>
            </section>
            <section className="risk-panel">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">EXPERIMENTAL INDICATOR</span>
                  <h3>Rainfall pressure</h3>
                </div>
                <span className="experimental">UNVALIDATED</span>
              </div>
              <div className="risk-value" style={{ color: risk.color }}>
                <span style={{ background: risk.color }} />
                {risk.label}
              </div>
              <p>
                Based on the next 24 complete hours of forecast precipitation.
              </p>
              <div className="accumulations">
                {totals.map((t, i) => (
                  <div key={i}>
                    <span>{[24, 48, 72][i]} HOURS</span>
                    <strong>
                      {fmt(t)}
                      <small> mm</small>
                    </strong>
                  </div>
                ))}
              </div>
              <p className="window-note">
                Window starts {localTime(anchor)}. A dash means missing data or
                an incomplete window.
              </p>
              <button
                className="method-link"
                onClick={() => setPanel("method")}
              >
                How this is calculated <ArrowUpRight size={15} />
              </button>
            </section>
          </div>
          <footer>
            <span>
              Forecast data:{" "}
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noreferrer"
              >
                Open-Meteo
              </a>{" "}
              · CC BY 4.0
            </span>
            <span>
              Research demonstration · Not an official warning service
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <dialog
        ref={modal}
        className="info-dialog"
        onCancel={() => setPanel(null)}
        onClick={(e) => {
          if (e.target === modal.current) setPanel(null);
        }}
      >
        <div className="dialog-header">
          <span className="eyebrow">BANGLADESH GEOFORECAST</span>
          <button aria-label="Close information" onClick={() => setPanel(null)}>
            <X size={20} />
          </button>
        </div>
        {panel === "method" ? (
          <>
            <h2>Understand the forecast.</h2>
            <p>
              This is a point-based weather explorer with an experimental
              rainfall indicator. It does not predict flood extent, depth, or
              river level.
            </p>
            <h3>Source & time</h3>
            <p>
              Open-Meteo’s Best Match model forecast supplies precipitation,
              temperature, humidity, and wind. Model selection and spatial
              resolution vary; the selected point represents a model grid cell,
              not a weather station or a continuous map surface. No observations
              are displayed.
            </p>
            <p>
              Requested point: {place.lat.toFixed(4)}, {place.lon.toFixed(4)}.
              Returned model grid:{" "}
              {forecast
                ? `${forecast.gridLat.toFixed(4)}, ${forecast.gridLon.toFixed(4)}`
                : "unavailable"}
              .
            </p>
            <p>
              Retrieval time:{" "}
              {forecast
                ? `${localTime(forecast.fetchedAt)} UTC+6`
                : "unavailable"}
              . Model issue time: not supplied by this endpoint. Retrieval time
              is not model issue time.
            </p>
            <h3>Accumulations</h3>
            <p>
              The app requests eight calendar days to cover seven days ahead
              from the next full hour. Each precipitation value represents the
              preceding hour. For a selected boundary T, a 24-hour total sums
              values ending at T+1 through T+24 hours; 48- and 72-hour windows
              follow the same rule. Missing hours return unavailable, never
              zero.
            </p>
            <h3>Experimental thresholds</h3>
            <table>
              <thead>
                <tr>
                  <th>Next 24 h precipitation</th>
                  <th>Indicator</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>0 to &lt;25 mm</td>
                  <td>Lower rainfall</td>
                </tr>
                <tr>
                  <td>25 to &lt;50 mm</td>
                  <td>Elevated rainfall</td>
                </tr>
                <tr>
                  <td>50 to &lt;100 mm</td>
                  <td>High rainfall</td>
                </tr>
                <tr>
                  <td>≥100 mm</td>
                  <td>Very high rainfall</td>
                </tr>
              </tbody>
            </table>
            <p>
              These round, increasing bands are author-selected for an
              interpretable software demonstration. They are not official
              Bangladesh warning thresholds, are not locally calibrated, and
              have no claimed predictive accuracy. Lower rainfall does not mean
              low flood risk.
            </p>
            <h3>What is missing?</h3>
            <p>
              River discharge, upstream rainfall, drainage capacity, terrain,
              tides, soil saturation, and flood defences are not modelled.
              Forecast uncertainty is not quantified. Exposure and vulnerability
              are not included, so this is not a full risk assessment.
            </p>
            <p>
              <strong>Hazard</strong> is a potentially damaging event.{" "}
              <strong>Exposure</strong> describes people and assets in its path.{" "}
              <strong>Vulnerability</strong> describes their susceptibility to
              harm. <strong>Risk</strong> combines these with likelihood and
              consequences.
            </p>
            <h3>Your spatial data</h3>
            <p>
              GeoJSON is processed locally and is not uploaded to a server or
              included in shared links. Coordinates must be WGS84
              longitude/latitude. Validation checks structure, coordinate
              bounds, closed rings and basic geometry validity; it is not an
              exhaustive topology audit. Polygon area uses Turf’s spherical area
              calculation; overlapping polygons are counted separately. Uploaded
              layers do not change the indicator.
            </p>
            <h3>Availability & attribution</h3>
            <p>
              Forecasts are cached on this device for 30 minutes. Older cached
              results are labelled stale and can be shown for up to 24 hours if
              a request fails. Refresh requests are limited to one per 10
              seconds in this session. The free provider service is for
              noncommercial use and has request limits; there is no availability
              guarantee.
            </p>
            <p>
              <a
                href="https://open-meteo.com/en/docs"
                target="_blank"
                rel="noreferrer"
              >
                Forecast documentation
              </a>{" "}
              ·{" "}
              <a
                href="https://open-meteo.com/en/terms"
                target="_blank"
                rel="noreferrer"
              >
                Provider terms
              </a>{" "}
              ·{" "}
              <a
                href="https://open-meteo.com/en/docs/geocoding-api"
                target="_blank"
                rel="noreferrer"
              >
                Place search / GeoNames
              </a>{" "}
              ·{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                OpenStreetMap attribution
              </a>
            </p>
          </>
        ) : (
          <>
            <h2>
              A spatial perspective
              <br />
              on weather and risk.
            </h2>
            <p>
              Bangladesh GeoForecast is an academic and professional portfolio
              project by <strong>{profile.name}</strong>.
            </p>
            <h3>Background</h3>
            <p>
              {profile.background}. Interests include {profile.interests}
            </p>
            <h3>What this project demonstrates</h3>
            <p>
              Interactive web cartography, asynchronous environmental data
              integration, temporal aggregation, GeoJSON validation, client-side
              spatial measurement, and transparent communication of uncertainty.
            </p>
            <p>
              Built with React, TypeScript, Leaflet, Recharts, and Turf.
              Designed for static hosting with GitHub Pages.
            </p>
            <div className="profile-links">
              {profile.github && (
                <a href={profile.github}>
                  <Github size={16} /> GitHub
                </a>
              )}
              {profile.portfolio && (
                <a href={profile.portfolio}>
                  Portfolio <ArrowUpRight size={16} />
                </a>
              )}
              {profile.email && (
                <a href={`mailto:${profile.email}`}>
                  <Mail size={16} /> Contact
                </a>
              )}
            </div>
            <p className="about-note">
              Independent research demonstration. No affiliation with a
              forecasting agency or official warning service is claimed.
            </p>
          </>
        )}
      </dialog>
    </div>
  );
}
