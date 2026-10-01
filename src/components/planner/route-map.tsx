"use client";

import { useEffect, useRef } from "react";
import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Theme } from "@/components/arc/theme-switch/theme-switch";
import type { Plan } from "@/lib/planner";
import { pointAt, trackUntil } from "./util";
import styles from "./planner.module.css";

const tiles = (variant: string) =>
  ["a", "b", "c"].map((s) => `https://${s}.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}.png`);

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

function paint(map: MapLibreMap, theme: Theme) {
  map.setLayoutProperty("tiles-light", "visibility", theme === "light" ? "visible" : "none");
  map.setLayoutProperty("tiles-dark", "visibility", theme === "dark" ? "visible" : "none");
  map.setPaintProperty("background", "background-color", token("--surface-muted", "#eee"));
  map.setPaintProperty("route", "line-color", token("--text-muted", "#999"));
  map.setPaintProperty("done", "line-color", token("--accent", "#0562ef"));
  // Same encoding as the elevation chart: gels are filled, drink stations are rings.
  const surface = token("--surface", "#fff");
  map.setPaintProperty("stops", "circle-color", ["match", ["get", "kind"], "gel", token("--series-4", "#009e84"), surface]);
  map.setPaintProperty("stops", "circle-stroke-color", ["match", ["get", "kind"], "gel", surface, token("--text-secondary", "#666")]);
}

export default function RouteMap({ plan, km, theme }: { plan: Plan; km: number; theme: Theme }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const runnerRef = useRef<Marker | null>(null);
  const ready = useRef(false);
  const latest = useRef({ plan, km, theme });
  useEffect(() => {
    latest.current = { plan, km, theme };
  });

  useEffect(() => {
    if (!container.current) return;
    setWorkerUrl(new URL("/maplibre/maplibre-gl-worker.mjs", window.location.origin).href);
    const map = new MapLibreMap({
      container: container.current,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      style: {
        version: 8,
        sources: {
          light: { type: "raster", tiles: tiles("light_all"), tileSize: 256, attribution: "© OpenStreetMap contributors © CARTO" },
          dark: { type: "raster", tiles: tiles("dark_all"), tileSize: 256, attribution: "© OpenStreetMap contributors © CARTO" },
        },
        layers: [
          { id: "background", type: "background", paint: { "background-color": "#eee" } },
          { id: "tiles-light", type: "raster", source: "light" },
          { id: "tiles-dark", type: "raster", source: "dark", layout: { visibility: "none" } },
        ],
      },
      center: [plan.track[0].lon, plan.track[0].lat],
      zoom: 12,
    });
    mapRef.current = map;

    const el = document.createElement("div");
    el.className = styles.runner;
    el.setAttribute("aria-hidden", "true");
    runnerRef.current = new Marker({ element: el });

    map.on("load", () => {
      const { plan: p, km: k, theme: t } = latest.current;
      map.addSource("route", { type: "geojson", data: line(p.track.map((s) => [s.lon, s.lat])) });
      map.addSource("done", { type: "geojson", data: line(trackUntil(p.track, k)) });
      map.addSource("stops", { type: "geojson", data: stops(p) });
      const lineLayout = { "line-join": "round", "line-cap": "round" } as const;
      map.addLayer({ id: "route", type: "line", source: "route", layout: lineLayout, paint: { "line-width": 4 } });
      map.addLayer({ id: "done", type: "line", source: "done", layout: lineLayout, paint: { "line-width": 5 } });
      map.addLayer({
        id: "stops",
        type: "circle",
        source: "stops",
        paint: { "circle-radius": 5, "circle-stroke-width": 2 },
      });
      paint(map, t);
      runnerRef.current?.setLngLat(pointAt(p.track, k)).addTo(map);
      fit(map, p);
      ready.current = true;
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      ready.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    (map.getSource("route") as GeoJSONSource).setData(line(plan.track.map((s) => [s.lon, s.lat])));
    (map.getSource("stops") as GeoJSONSource).setData(stops(plan));
  }, [plan]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    (map.getSource("done") as GeoJSONSource).setData(line(trackUntil(plan.track, km)));
    runnerRef.current?.setLngLat(pointAt(plan.track, km));
  }, [km, plan]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && ready.current) paint(map, theme);
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && ready.current) fit(map, plan);
  }, [plan.track]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.mapFrame}>
      <div ref={container} className={styles.map} role="img" aria-label="Course map with the runner's position" />
      <ul className={styles.legend} aria-label="Map legend">
        <li><span className={styles.swatchDone} aria-hidden="true" />Covered</li>
        <li><span className={styles.swatchGel} aria-hidden="true" />Gel</li>
        <li><span className={styles.swatchRing} aria-hidden="true" />Drink station</li>
      </ul>
    </div>
  );
}

function fit(map: MapLibreMap, plan: Plan) {
  const bounds = new LngLatBounds();
  plan.track.forEach((t) => bounds.extend([t.lon, t.lat]));
  map.fitBounds(bounds, { padding: 32, animate: false });
}
