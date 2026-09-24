import type { FeatureCollection, Feature, Geometry, Position } from "geojson";
import booleanValid from "@turf/boolean-valid";
import area from "@turf/area";
import { validCoords } from "./data";
export function validateGeoJSON(input: unknown): FeatureCollection {
  if (!input || typeof input !== "object")
    throw new Error("Expected a GeoJSON object.");
  const r = input as any;
  if (r.crs)
    throw new Error(
      "Reproject to WGS84 (EPSG:4326) and remove the legacy CRS member before uploading.",
    );
  const features =
    r.type === "FeatureCollection"
      ? r.features
      : r.type === "Feature"
        ? [r]
        : [{ type: "Feature", properties: {}, geometry: r }];
  if (!Array.isArray(features) || !features.length)
    throw new Error("No features found.");
  if (features.length > 3000)
    throw new Error("Please use 3,000 features or fewer.");
  let points = 0;
  const position = (p: Position) => {
    if (
      !Array.isArray(p) ||
      p.length < 2 ||
      !p.every((v) => typeof v === "number" && Number.isFinite(v)) ||
      !validCoords(p[1], p[0])
    )
      throw new Error("Invalid coordinates. Use WGS84 longitude, latitude.");
    if (++points > 100000)
      throw new Error(
        "Please simplify this layer to fewer than 100,000 vertices.",
      );
  };
  const line = (ps: Position[], ring = false) => {
    if (!Array.isArray(ps) || ps.length < (ring ? 4 : 2))
      throw new Error("A line or polygon ring has too few coordinates.");
    ps.forEach(position);
    if (
      ring &&
      (ps[0].length !== ps.at(-1)!.length ||
        ps[0].some((v, i) => v !== ps.at(-1)![i]))
    )
      throw new Error("Polygon rings must be closed.");
  };
  const geometry = (g: Geometry, depth = 0) => {
    if (depth > 10 || !g || typeof g !== "object")
      throw new Error("Invalid or deeply nested geometry.");
    const nonempty = (v: unknown) => {
      if (!Array.isArray(v) || !v.length)
        throw new Error("Empty geometry coordinates.");
    };
    switch (g.type) {
      case "Point":
        position(g.coordinates);
        break;
      case "MultiPoint":
        nonempty(g.coordinates);
        g.coordinates.forEach(position);
        break;
      case "LineString":
        line(g.coordinates);
        break;
      case "MultiLineString":
        nonempty(g.coordinates);
        g.coordinates.forEach((p) => line(p));
        break;
      case "Polygon":
        nonempty(g.coordinates);
        g.coordinates.forEach((p) => line(p, true));
        break;
      case "MultiPolygon":
        nonempty(g.coordinates);
        g.coordinates.forEach((p) => {
          nonempty(p);
          p.forEach((r) => line(r, true));
        });
        break;
      case "GeometryCollection":
        nonempty(g.geometries);
        g.geometries.forEach((v) => geometry(v, depth + 1));
        break;
      default:
        throw new Error("Unsupported GeoJSON geometry.");
    }
  };
  features.forEach((f: Feature) => {
    if (
      f?.type !== "Feature" ||
      (f.properties !== null &&
        (typeof f.properties !== "object" || Array.isArray(f.properties)))
    )
      throw new Error("Invalid GeoJSON feature or properties.");
    geometry(f.geometry);
    if (f.geometry.type !== "GeometryCollection" && !booleanValid(f))
      throw new Error("Invalid geometry structure detected.");
  });
  return { type: "FeatureCollection", features };
}
export function areaKm2(data: FeatureCollection) {
  return area(data) / 1e6;
}
