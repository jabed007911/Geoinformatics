import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FeatureCollection } from "geojson";
import { places, fmt, type Place } from "./data";
const initialHasView = new URLSearchParams(location.search).has("z");
export type ViewState = { lat: number; lon: number; zoom: number };
type Props = {
  place: Place;
  onSelect: (p: Place) => void;
  view: ViewState;
  onView: (v: ViewState) => void;
  base: boolean;
  shortcuts: boolean;
  uploaded: FeatureCollection | null;
  showUpload: boolean;
  color: string;
  hourValue: number | null;
  focus: number;
  home: number;
  onInspect: (properties: Record<string, unknown>) => void;
};
export default function MapView(p: Props) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    latest = useRef(p);
  latest.current = p;
  const [coords, setCoords] = useState(
    "Move over the map to inspect coordinates",
  );
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current, {
      zoomControl: false,
      minZoom: 3,
      maxZoom: 18,
    }).setView([p.view.lat, p.view.lon], p.view.zoom);
    map.current = m;
    if (!initialHasView)
      m.fitBounds(
        [
          [20.65, 88.0],
          [26.7, 92.7],
        ],
        { padding: [20, 20] },
      );
    L.control.zoom({ position: "topright" }).addTo(m);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(m);
    m.on("click", (e) =>
      latest.current.onSelect({
        name: "Selected point",
        lat: +e.latlng.lat.toFixed(4),
        lon: +e.latlng.wrap().lng.toFixed(4),
      }),
    );
    m.on("mousemove", (e) =>
      setCoords(
        `${e.latlng.lat.toFixed(4)}° N · ${e.latlng.wrap().lng.toFixed(4)}° E`,
      ),
    );
    const initialCenter = m.getCenter().wrap();
    latest.current.onView({
      lat: initialCenter.lat,
      lon: initialCenter.lng,
      zoom: m.getZoom(),
    });
    m.on("moveend", () => {
      const c = m.getCenter().wrap();
      latest.current.onView({ lat: c.lat, lon: c.lng, zoom: m.getZoom() });
    });
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m || !p.base) return;
    const layer = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 19,
      },
    ).addTo(m);
    layer.on("tileerror", () => setTileError(true));
    layer.on("tileload", () => setTileError(false));
    return () => {
      layer.remove();
    };
  }, [p.base]);
  useEffect(() => {
    const m = map.current;
    if (!m || !p.shortcuts) return;
    const group = L.layerGroup().addTo(m);
    places.forEach((place) => {
      L.circleMarker([place.lat, place.lon], {
        radius: 5,
        color: "#425f70",
        weight: 2,
        fillColor: "#fff",
        fillOpacity: 1,
        bubblingMouseEvents: false,
      })
        .bindTooltip(place.name, {
          permanent: true,
          direction: "right",
          className: "place-label",
        })
        .on("click", () => latest.current.onSelect(place))
        .addTo(group);
    });
    return () => {
      group.remove();
    };
  }, [p.shortcuts]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const marker = L.circleMarker([p.place.lat, p.place.lon], {
      radius: 10,
      color: "#fff",
      weight: 3,
      fillColor: p.color,
      fillOpacity: 1,
      bubblingMouseEvents: false,
    }).addTo(m);
    const content = document.createElement("div");
    content.textContent = `${p.place.name} · ${fmt(p.hourValue)} mm / preceding hour`;
    marker.bindTooltip(content, {
      direction: "top",
      permanent: true,
      offset: [0, -12],
      className: "forecast-label",
    });
    return () => {
      marker.remove();
    };
  }, [p.place, p.color, p.hourValue]);
  useEffect(() => {
    if (p.focus)
      map.current?.flyTo([p.place.lat, p.place.lon], 10, { duration: 0.5 });
  }, [p.focus]);
  useEffect(() => {
    if (p.home)
      map.current?.fitBounds(
        [
          [20.65, 88.0],
          [26.7, 92.7],
        ],
        { padding: [20, 20] },
      );
  }, [p.home]);
  useEffect(() => {
    const m = map.current;
    if (!m || !p.uploaded || !p.showUpload) return;
    const layer = L.geoJSON(p.uploaded, {
      style: {
        color: "#8a4aac",
        fillColor: "#b295cd",
        fillOpacity: 0.18,
        weight: 2,
      },
      pointToLayer: (_, latlng) =>
        L.circleMarker(latlng, {
          radius: 6,
          color: "#8a4aac",
          fillOpacity: 0.75,
          bubblingMouseEvents: false,
        }),
      onEachFeature: (feature, l) => {
        // User-supplied properties are rendered by React as text, never as HTML.
        l.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          latest.current.onInspect(feature.properties || {});
        });
      },
      bubblingMouseEvents: false,
    }).addTo(m);
    if (layer.getBounds().isValid())
      m.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 12 });
    return () => {
      layer.remove();
    };
  }, [p.uploaded, p.showUpload]);
  return (
    <div className="map-frame">
      <div
        ref={host}
        className="map"
        aria-label="Interactive map. Click a point to load its forecast."
      />
      <div className="map-caption">
        POINT FORECASTS <span>•</span> No continuous rainfall surface
      </div>
      {tileError && p.base && (
        <div className="tile-error" role="status">
          Basemap tiles unavailable. Point selection still works.
        </div>
      )}
      <div className="coordinates">{coords}</div>
    </div>
  );
}
