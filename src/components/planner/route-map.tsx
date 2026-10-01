"use client";

import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Theme } from "@/components/arc/theme-switch/theme-switch";
import type { Plan } from "@/lib/planner";
import { pointAt, trackUntil } from "./util";
import styles from "./planner.module.css";

export type MapStyle = "streets" | "satellite" | "terrain";

const carto = (variant: string) =>
  ["a", "b", "c"].map((s) => `https://${s}.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}.png`);
const OSM = "© OpenStreetMap contributors";
const DEM_TILES = ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"];
const DEM_ATTRIBUTION = "Elevation © Mapzen, AWS Terrain Tiles";

/** Which tile sources each style needs, so a failure can be reported for the style on screen. */
function sourcesFor(style: MapStyle, theme: Theme): string[] {
  if (style === "satellite") return ["satellite"];
  if (style === "terrain") return ["dem-hillshade"];
  return [theme === "dark" ? "streets-dark" : "streets-light"];
}

const PROVIDER: Record<MapStyle, string> = { streets: "CARTO", satellite: "Esri", terrain: "AWS Terrain Tiles" };

/** Arc tokens can be oklch(); MapLibre needs rgb, so let the browser resolve them. */
function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!value || !ctx) return fallback;
  ctx.canvas.width = ctx.canvas.height = 1;
  ctx.fillStyle = fallback;
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

function line(coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } };
}

function stops(plan: Plan): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: plan.events
      .filter((e) => e.type === "gel" || e.type === "drink")
      .map((e) => ({
        type: "Feature",
        properties: { kind: e.type },
        geometry: { type: "Point", coordinates: pointAt(plan.track, e.km) },
      })),
  };
}

function bearingBetween([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const toRad = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * toRad) * Math.cos(lat2 * toRad);
  const x =
    Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
    Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos((lon2 - lon1) * toRad);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function applyStyle(map: MapLibreMap, style: MapStyle, theme: Theme) {
  const show = (id: string, on: boolean) => map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  show("streets-light", style === "streets" && theme === "light");
  show("streets-dark", style === "streets" && theme === "dark");
  show("satellite", style === "satellite");
  show("hillshade", style === "terrain");
  map.setTerrain(style === "terrain" ? { source: "dem-terrain", exaggeration: 1.3 } : null);

  const surface = token("--surface", "#fff");
  map.setPaintProperty("background", "background-color", token("--surface-muted", "#eee"));
  map.setPaintProperty("hillshade", "hillshade-shadow-color", token("--text-secondary", "#666"));
  map.setPaintProperty("hillshade", "hillshade-highlight-color", surface);
  map.setPaintProperty("hillshade", "hillshade-accent-color", token("--text-muted", "#999"));
  // A light line stands out on imagery; the muted token reads best on the plain styles.
  map.setPaintProperty("route", "line-color", style === "satellite" ? "rgba(255, 255, 255, 0.85)" : token("--text-muted", "#999"));
  map.setPaintProperty("done", "line-color", token("--accent", "#0562ef"));
  // Same encoding as the elevation chart: gels are filled, drink stations are rings.
  map.setPaintProperty("stops", "circle-color", ["match", ["get", "kind"], "gel", token("--series-4", "#009e84"), surface]);
  map.setPaintProperty("stops", "circle-stroke-color", ["match", ["get", "kind"], "gel", surface, token("--text-secondary", "#666")]);
}

function fit(map: MapLibreMap, plan: Plan, style: MapStyle) {
  const bounds = new LngLatBounds();
  plan.track.forEach((t) => bounds.extend([t.lon, t.lat]));
  map.fitBounds(bounds, { padding: 32, animate: false, pitch: 0, bearing: 0 });
  // Tilting after the fit keeps the whole course on screen; the near edge grows as the view tilts.
  if (style === "terrain") map.jumpTo({ pitch: 40, zoom: map.getZoom() - 0.35 });
}

export default function RouteMap({
  plan,
  km,
  theme,
  mapStyle,
  follow,
}: {
  plan: Plan;
  km: number;
  theme: Theme;
  mapStyle: MapStyle;
  follow: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const runnerRef = useRef<Marker | null>(null);
  const bearingRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [tiles, setTiles] = useState<Record<string, "ok" | "failed">>({});
  const latest = useRef({ plan, km });
  useEffect(() => {
    latest.current = { plan, km };
  });

  useEffect(() => {
    if (!container.current) return;
    setWorkerUrl(new URL("/maplibre/maplibre-gl-worker.mjs", window.location.origin).href);
    const { plan: p } = latest.current;
    const map = new MapLibreMap({
      container: container.current,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      maxPitch: 70,
      style: {
        version: 8,
        sources: {
          "streets-light": { type: "raster", tiles: carto("rastertiles/voyager"), tileSize: 256, attribution: `${OSM} © CARTO` },
          "streets-dark": { type: "raster", tiles: carto("dark_all"), tileSize: 256, attribution: `${OSM} © CARTO` },
          satellite: {
            type: "raster",
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
          },
          "dem-hillshade": { type: "raster-dem", tiles: DEM_TILES, encoding: "terrarium", tileSize: 256, maxzoom: 14, attribution: DEM_ATTRIBUTION },
          "dem-terrain": { type: "raster-dem", tiles: DEM_TILES, encoding: "terrarium", tileSize: 256, maxzoom: 14 },
        },
        layers: [
          { id: "background", type: "background", paint: { "background-color": "#eee" } },
          { id: "streets-light", type: "raster", source: "streets-light" },
          { id: "streets-dark", type: "raster", source: "streets-dark", layout: { visibility: "none" } },
          { id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" } },
          { id: "hillshade", type: "hillshade", source: "dem-hillshade", layout: { visibility: "none" }, paint: { "hillshade-exaggeration": 0.5 } },
        ],
      },
      center: [p.track[0].lon, p.track[0].lat],
      zoom: 12,
    });
    mapRef.current = map;

    const el = document.createElement("div");
    el.className = styles.runner;
    el.setAttribute("aria-hidden", "true");
    runnerRef.current = new Marker({ element: el });

    map.on("data", (e) => {
      if (e.dataType === "source" && "tile" in e && e.tile && "sourceId" in e) {
        const id = String(e.sourceId);
        setTiles((t) => (t[id] === "ok" ? t : { ...t, [id]: "ok" }));
      }
    });
    map.on("error", (e) => {
      const id = "sourceId" in e ? String(e.sourceId) : null;
      if (id) setTiles((t) => (t[id] ? t : { ...t, [id]: "failed" }));
    });

    // Draw the route as soon as the style is parsed. The "load" event waits for
    // basemap tiles, so a slow or blocked tile server would leave the map empty.
    let drawn = false;
    const drawRoute = () => {
      if (drawn) return;
      drawn = true;
      const { plan: p2, km: k } = latest.current;
      map.addSource("route", { type: "geojson", data: line(p2.track.map((s) => [s.lon, s.lat])) });
      map.addSource("done", { type: "geojson", data: line(trackUntil(p2.track, k)) });
      map.addSource("stops", { type: "geojson", data: stops(p2) });
      const lineLayout = { "line-join": "round", "line-cap": "round" } as const;
      map.addLayer({ id: "route", type: "line", source: "route", layout: lineLayout, paint: { "line-width": 4 } });
      map.addLayer({ id: "done", type: "line", source: "done", layout: lineLayout, paint: { "line-width": 5 } });
      map.addLayer({ id: "stops", type: "circle", source: "stops", paint: { "circle-radius": 5, "circle-stroke-width": 2 } });
      runnerRef.current?.setLngLat(pointAt(p2.track, k)).addTo(map);
      setReady(true);
    };
    map.once("style.load", drawRoute);
    map.once("load", drawRoute);

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      setReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Style and theme
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready) applyStyle(map, mapStyle, theme);
  }, [ready, mapStyle, theme]);

  // Route data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("route") as GeoJSONSource).setData(line(plan.track.map((s) => [s.lon, s.lat])));
    (map.getSource("stops") as GeoJSONSource).setData(stops(plan));
  }, [ready, plan]);

  // Overview camera whenever following stops, the course changes or the style changes
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready && !follow) fit(map, plan, mapStyle);
  }, [ready, follow, plan.track, mapStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Runner position, and the chase camera when following
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const here = pointAt(plan.track, km);
    (map.getSource("done") as GeoJSONSource).setData(line(trackUntil(plan.track, km)));
    runnerRef.current?.setLngLat(here);
    if (follow) {
      const ahead = pointAt(plan.track, Math.min(km + 0.15, plan.summary.totalKm));
      const target = ahead[0] === here[0] && ahead[1] === here[1] ? bearingRef.current : bearingBetween(here, ahead);
      // Turn gradually so the camera does not snap at every corner.
      const delta = ((target - bearingRef.current + 540) % 360) - 180;
      bearingRef.current += delta * 0.15;
      map.jumpTo({ center: here, bearing: bearingRef.current, pitch: 60, zoom: 16 });
    }
  }, [ready, km, plan, follow]);

  const needed = sourcesFor(mapStyle, theme);
  const failed = needed.some((id) => tiles[id] === "failed") && !needed.some((id) => tiles[id] === "ok");

  return (
    <div className={styles.mapFrame}>
      <div className={styles.mapBox}>
        <div ref={container} className={styles.map} role="img" aria-label="Course map with the runner's position" />
        {failed ? (
          <p className={styles.mapNotice} role="status">
            {PROVIDER[mapStyle]} tiles could not load, so only the route shows. Try another style or check your connection.
          </p>
        ) : null}
      </div>
      <ul className={styles.legend} aria-label="Map legend">
        <li><span className={styles.swatchDone} aria-hidden="true" />Covered</li>
        <li><span className={styles.swatchGel} aria-hidden="true" />Gel</li>
        <li><span className={styles.swatchRing} aria-hidden="true" />Drink station</li>
      </ul>
    </div>
  );
}
