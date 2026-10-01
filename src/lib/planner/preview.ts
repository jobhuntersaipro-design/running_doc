/**
 * An SVG path for a small route preview: longitude scaled by cos(latitude) so
 * the shape is not stretched, fitted into a width x height box with padding.
 */
export function routePreview(points: { lat: number; lon: number }[], width: number, height: number, pad = 8) {
  const lat0 = (points.reduce((s, p) => s + p.lat, 0) / points.length) * (Math.PI / 180);
  const xs = points.map((p) => p.lon * Math.cos(lat0));
  const ys = points.map((p) => p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min((width - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxY - minY || 1));
  const offX = (width - (maxX - minX) * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;
  const at = (i: number): [number, number] => [offX + (xs[i] - minX) * scale, height - (offY + (ys[i] - minY) * scale)];
  const d = points.map((_, i) => `${i ? "L" : "M"}${at(i)[0].toFixed(1)},${at(i)[1].toFixed(1)}`).join("");
  return { d, start: at(0), finish: at(points.length - 1) };
}
