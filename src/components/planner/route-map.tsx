"use client";

import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map as MapLibreMap, Marker, Popup, setWorkerUrl, type ExpressionSpecification, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Theme } from "@/components/arc/theme-switch/theme-switch";
import { formatPace, type Plan, type PlanEvent } from "@/lib/planner";
import { pointAt } from "./util";
import styles from "./planner.module.css";

export type MapStyle = "streets" | "satellite" | "terrain";

/** OpenFreeMap vector styles: free, no API key, no request limits. */
const BASEMAP: Record<Theme, string> = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
/** Used when the basemap style cannot be fetched, so the route still draws. */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "fallback-background", type: "background", paint: { "background-color": "#eee" } }],
};
const BASEMAP_TIMEOUT_MS = 6000;
const DEM_TILES = ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"];
const PROVIDER: Record<MapStyle, string> = { streets: "OpenFreeMap", satellite: "Esri", terrain: "AWS Terrain Tiles" };

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

/** Track coordinates between two distances, with interpolated end points. */
function slice(plan: Plan, fromKm: number, toKm: number): [number, number][] {
  const coords: [number, number][] = [pointAt(plan.track, fromKm)];
  for (const t of plan.track) if (t.km > fromKm && t.km < toKm) coords.push([t.lon, t.lat]);
  coords.push(pointAt(plan.track, toKm));
  return coords;
}

/** The course as one line per uphill, downhill and flat section, cut off at `untilKm`. */
function routeSegments(plan: Plan, untilKm = Infinity): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: plan.segments
      .filter((s) => s.startKm < untilKm)
      .map((s) => ({
        type: "Feature",
        properties: { kind: s.kind },
        geometry: { type: "LineString", coordinates: slice(plan, s.startKm, Math.min(s.endKm, untilKm)) },
      })),
  };
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

/** Adds our sources and layers on top of whichever basemap style is loaded. */
function addOverlay(map: MapLibreMap, plan: Plan, km: number) {
  map.addSource("satellite", {
    type: "raster",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    tileSize: 256,
    maxzoom: 19,
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
  });
  map.addSource("dem-hillshade", { type: "raster-dem", tiles: DEM_TILES, encoding: "terrarium", tileSize: 256, maxzoom: 14, attribution: "Elevation © Mapzen, AWS Terrain Tiles" });
  map.addSource("dem-terrain", { type: "raster-dem", tiles: DEM_TILES, encoding: "terrarium", tileSize: 256, maxzoom: 14 });
  map.addSource("route", { type: "geojson", data: routeSegments(plan) });
  map.addSource("done", { type: "geojson", data: routeSegments(plan, km) });
  map.addSource("stops", { type: "geojson", data: stops(plan) });

  const lineLayout = { "line-join": "round", "line-cap": "round" } as const;
  map.addLayer({ id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" } });
  map.addLayer({ id: "hillshade", type: "hillshade", source: "dem-hillshade", layout: { visibility: "none" }, paint: { "hillshade-exaggeration": 0.5 } });
  map.addLayer({ id: "route-casing", type: "line", source: "route", layout: lineLayout, paint: { "line-width": 8 } });
  map.addLayer({ id: "route-ahead", type: "line", source: "route", layout: lineLayout, paint: { "line-width": 4, "line-opacity": 0.4 } });
  map.addLayer({ id: "route-done", type: "line", source: "done", layout: lineLayout, paint: { "line-width": 5 } });
  map.addLayer({ id: "stops", type: "circle", source: "stops", paint: { "circle-radius": 5, "circle-stroke-width": 2 } });
}

function applyStyle(map: MapLibreMap, style: MapStyle) {
  const show = (id: string, on: boolean) => map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  show("satellite", style === "satellite");
  show("hillshade", style === "terrain");
  map.setTerrain(style === "terrain" ? { source: "dem-terrain", exaggeration: 1.3 } : null);

  const surface = token("--surface", "#fff");
  // Same colours as the elevation chart: uphill, downhill, and a neutral for flat ground.
  const byKind: ExpressionSpecification = ["match", ["get", "kind"], "uphill", token("--series-3", "#e58f00"), "downhill", token("--series-2", "#7128a5"), token("--text-secondary", "#666")];
  map.setPaintProperty("route-casing", "line-color", style === "satellite" ? "rgba(255, 255, 255, 0.9)" : surface);
  map.setPaintProperty("route-ahead", "line-color", byKind);
  map.setPaintProperty("route-done", "line-color", byKind);
  map.setPaintProperty("hillshade", "hillshade-shadow-color", token("--text-secondary", "#666"));
  map.setPaintProperty("hillshade", "hillshade-highlight-color", surface);
  if (map.getLayer("fallback-background")) map.setPaintProperty("fallback-background", "background-color", token("--surface-muted", "#eee"));
  // Gels are filled, drink stations are rings, as on the elevation chart.
  map.setPaintProperty("stops", "circle-color", ["match", ["get", "kind"], "gel", token("--series-4", "#009e84"), surface]);
  map.setPaintProperty("stops", "circle-stroke-color", ["match", ["get", "kind"], "gel", surface, token("--text-secondary", "#666")]);
}

function fit(map: MapLibreMap, plan: Plan, style: MapStyle, noticeShown: boolean) {
  const bounds = new LngLatBounds();
  plan.track.forEach((t) => bounds.extend([t.lon, t.lat]));
  // Leave room under the tile notice so it never covers part of the course.
  const padding = { top: noticeShown ? 88 : 32, right: 32, bottom: 32, left: 32 };
  map.fitBounds(bounds, { padding, animate: false, pitch: 0, bearing: 0 });
  // Tilting after the fit keeps the whole course on screen; the near edge grows as the view tilts.
  if (style === "terrain") map.jumpTo({ pitch: 40, zoom: map.getZoom() - 0.35 });
}

/** Popup content built from DOM nodes so event text is never parsed as HTML. */
function popupContent(events: PlanEvent[]): HTMLElement {
  const root = document.createElement("div");
  root.className = styles.popupBody;
  for (const e of events) {
    const item = document.createElement("div");
    const title = document.createElement("p");
    title.className = styles.popupTitle;
    title.textContent = `Km ${e.km.toFixed(1)}: ${e.title}`;
    const detail = document.createElement("p");
    detail.className = styles.popupDetail;
    detail.textContent = e.detail;
    item.append(title, detail);
    if (e.hill) {
      const h = e.hill;
      const facts = document.createElement("p");
      facts.className = styles.popupFacts;
      const parts = [
        `${Math.round(h.startEle)} to ${Math.round(h.peakEle)} m`,
        `${Math.abs(h.avgGrade).toFixed(1)}% average`,
        `${formatPace(h.paceSecPerKm)}/km`,
      ];
      if (h.treadmillIncline !== null) parts.push(`treadmill ${h.treadmillIncline}%`);
      facts.textContent = parts.join(", ");
      item.append(facts);
    }
    root.append(item);
  }
  return root;
}

export default function RouteMap({
  plan,
  km,
  theme,
  mapStyle,
  follow,
  popupEvents,
}: {
  plan: Plan;
  km: number;
  theme: Theme;
  mapStyle: MapStyle;
  follow: boolean;
  /** Events to describe in a popup at the runner, shown while playback is paused on them. */
  popupEvents: PlanEvent[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const runnerRef = useRef<Marker | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const bearingRef = useRef(0);
  const loadedTheme = useRef<Theme | null>(null);
  // Bumps every time a style (basemap or fallback) finishes loading with our overlay on top.
  const [styleVersion, setStyleVersion] = useState(0);
  const [tiles, setTiles] = useState<Record<string, "ok" | "failed">>({});
  const latest = useRef({ plan, km });
  useEffect(() => {
    latest.current = { plan, km };
  });

  useEffect(() => {
    if (!container.current) return;
    setWorkerUrl(new URL("/maplibre/maplibre-gl-worker.mjs", window.location.origin).href);
    const initialTheme: Theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    loadedTheme.current = initialTheme;
    const { plan: p } = latest.current;
    const map = new MapLibreMap({
      container: container.current,
      style: BASEMAP[initialTheme],
      attributionControl: { compact: true },
      cooperativeGestures: true,
      maxPitch: 70,
      center: [p.track[0].lon, p.track[0].lat],
      zoom: 12,
    });
    mapRef.current = map;

    const el = document.createElement("div");
    el.className = styles.runner;
    el.setAttribute("aria-hidden", "true");
    runnerRef.current = new Marker({ element: el });

    map.on("style.load", () => {
      const { plan: p2, km: k } = latest.current;
      addOverlay(map, p2, k);
      runnerRef.current?.setLngLat(pointAt(p2.track, k)).addTo(map);
      setStyleVersion((v) => v + 1);
    });
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

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Swap the basemap when the theme changes; the overlay is re-added on style.load.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadedTheme.current === theme) return;
    loadedTheme.current = theme;
    setTiles({});
    map.setStyle(BASEMAP[theme], { diff: false });
  }, [theme]);

  // If the basemap style never arrives (blocked, offline), fall back to a plain one so the route draws.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = window.setTimeout(() => {
      if (!map.getSource("route")) {
        setTiles((t) => ({ ...t, basemap: "failed" }));
        map.setStyle(FALLBACK_STYLE, { diff: false });
      }
    }, BASEMAP_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [theme]);

  // Map style and token colours
  useEffect(() => {
    const map = mapRef.current;
    if (map && styleVersion > 0) applyStyle(map, mapStyle);
  }, [styleVersion, mapStyle, theme]);

  // Route data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleVersion === 0 || !map.getSource("route")) return;
    (map.getSource("route") as GeoJSONSource).setData(routeSegments(plan));
    (map.getSource("stops") as GeoJSONSource).setData(stops(plan));
  }, [styleVersion, plan]);


  // Runner position, covered route, and the chase camera when following
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleVersion === 0 || !map.getSource("done")) return;
    const here = pointAt(plan.track, km);
    (map.getSource("done") as GeoJSONSource).setData(routeSegments(plan, km));
    runnerRef.current?.setLngLat(here);
    if (follow) {
      const ahead = pointAt(plan.track, Math.min(km + 0.15, plan.summary.totalKm));
      const target = ahead[0] === here[0] && ahead[1] === here[1] ? bearingRef.current : bearingBetween(here, ahead);
      // Turn gradually so the camera does not snap at every corner.
      const delta = ((target - bearingRef.current + 540) % 360) - 180;
      bearingRef.current += delta * 0.15;
      map.jumpTo({ center: here, bearing: bearingRef.current, pitch: 60, zoom: 16 });
    }
  }, [styleVersion, km, plan, follow]);

  // Popup describing the events the rehearsal is paused on
  const popupKey = popupEvents.map((e) => `${e.type}-${e.km}`).join("|");
  useEffect(() => {
    const map = mapRef.current;
    popupRef.current?.remove();
    popupRef.current = null;
    if (!map || styleVersion === 0 || popupEvents.length === 0) return;
    popupRef.current = new Popup({ closeButton: true, closeOnClick: false, maxWidth: "280px", offset: 14, className: styles.popup })
      .setLngLat(pointAt(plan.track, popupEvents[0].km))
      .setDOMContent(popupContent(popupEvents))
      .addTo(map);
  }, [popupKey, styleVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const needed = mapStyle === "satellite" ? ["satellite"] : mapStyle === "terrain" ? ["dem-hillshade"] : ["openmaptiles", "basemap"];
  const failed =
    tiles.basemap === "failed" && mapStyle === "streets"
      ? true
      : needed.some((id) => tiles[id] === "failed") && !needed.some((id) => tiles[id] === "ok");

  // Overview camera whenever following stops, the course, style or notice changes
  const ready = styleVersion > 0;
  useEffect(() => {
    const map = mapRef.current;
    if (map && ready && !follow) fit(map, plan, mapStyle, failed);
  }, [ready, follow, plan.track, mapStyle, failed]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <li><span className={styles.swatchClimb} aria-hidden="true" />Uphill</li>
        <li><span className={styles.swatchDescent} aria-hidden="true" />Downhill</li>
        <li><span className={styles.swatchFlat} aria-hidden="true" />Flat</li>
        <li><span className={styles.swatchGel} aria-hidden="true" />Gel</li>
        <li><span className={styles.swatchRing} aria-hidden="true" />Drink station</li>
        <li className={styles.legendNote}>Faded line is still ahead</li>
      </ul>
    </div>
  );
}
