// MapLibre loads its web worker from a file next to the main bundle, which the
// Next.js bundler does not emit. Copy the worker and the module it imports into
// public/ so the map can point at them with setWorkerUrl.
import { copyFileSync, mkdirSync } from "node:fs";

const from = "node_modules/maplibre-gl/dist";
const to = "public/maplibre";
mkdirSync(to, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(`${from}/${file}`, `${to}/${file}`);
