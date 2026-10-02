// MapLibre loads its web worker from a file next to the main bundle, which the
// Next.js bundler does not emit. Copy the worker and the module it imports into
// public/ so the map can point at them with setWorkerUrl.
import { copyFileSync, mkdirSync } from "node:fs";

const from = "node_modules/maplibre-gl/dist";
const to = "public/maplibre";
mkdirSync(to, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(`${from}/${file}`, `${to}/${file}`);

// pdf.js renders the route map preview the same way: its worker is served from public/.
mkdirSync("public/pdfjs", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", "public/pdfjs/pdf.worker.min.mjs");
