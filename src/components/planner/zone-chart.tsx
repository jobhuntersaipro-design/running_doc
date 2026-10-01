"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { ZoneNumber } from "@/lib/planner";
import styles from "./planner.module.css";

const HEIGHT = 150;
/** Right padding matches the elevation chart so distances line up; zone names sit in it. */
const PAD = { left: 40, right: 92 as number, top: 10, bottom: 26 };

export interface ZoneChartPoint {
  startKm: number;
  endKm: number;
  value: number;
}

export interface ZoneChartBand {
  zone: ZoneNumber;
  name: string;
  /** Value range of the zone; open ends may be infinite. */
  from: number;
  to: number;
}

/**
 * A line over distance drawn on top of horizontal zone bands, so you can see
 * which zone each part of the race sits in. Shares the cursor and hover with
 * the elevation chart above it.
 */
export function ZoneChart({
  title,
  points: rawPoints,
  runs,
  bands,
  invert = false,
  format,
  describe,
  totalKm,
  km,
  hover,
  onHover,
  onScrub,
}: {
  title: string;
  points: ZoneChartPoint[];
  /** Readable zone stretches for colouring the line. */
  runs: { startKm: number; endKm: number; zone: ZoneNumber }[];
  bands: ZoneChartBand[];
  /** Draw smaller values higher (pace: faster is up). */
  invert?: boolean;
  format: (v: number) => string;
  describe: (km: number) => string;
  totalKm: number;
  km: number;
  hover: number | null;
  onHover: (km: number | null) => void;
  onScrub: (km: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const dragging = useRef(false);

  useEffect(() => {
    const node = wrap.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Smooth over about 600 m so 100 m jitter does not read as real changes.
  const points = rawPoints.map((p, i) => {
    const near = rawPoints.slice(Math.max(0, i - 3), i + 4);
    return { ...p, value: near.reduce((sum, q) => sum + q.value, 0) / near.length };
  });
  const values = points.map((p) => p.value);
  const span = Math.max(...values) - Math.min(...values);
  const lo = Math.min(...values) - Math.max(4, span * 0.25);
  const hi = Math.max(...values) + Math.max(4, span * 0.25);
  // Phones drop the right margin (and the zone names in it) to give the line room.
  const padRight = width < 520 ? 14 : PAD.right;
  const plotW = width - PAD.left - padRight;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (k: number) => PAD.left + (k / totalKm) * plotW;
  const y = (v: number) => {
    const f = (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo);
    return PAD.top + (invert ? f : 1 - f) * plotH;
  };
  const valueAt = (k: number) => points.find((p) => k >= p.startKm && k <= p.endKm)?.value ?? points[points.length - 1].value;
  const pathFor = (from: number, to: number) =>
    points
      .filter((p) => p.endKm > from - 1e-9 && p.startKm < to + 1e-9)
      .map((p, i) => `${i ? "L" : "M"}${x(Math.max(from, (p.startKm + p.endKm) / 2)).toFixed(1)},${y(p.value).toFixed(1)}`)
      .join("");

  const toKm = (clientX: number) => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.min(totalKm, Math.max(0, ((clientX - rect.left - PAD.left) / plotW) * totalKm));
  };
  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onScrub(toKm(e.clientX));
  }
  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    const k = toKm(e.clientX);
    onHover(k);
    if (dragging.current) onScrub(k);
  }

  const visible = bands
    .map((b) => ({ ...b, top: y(invert ? Math.max(b.from, b.to) : Math.min(b.from, b.to)), bottom: y(invert ? Math.min(b.from, b.to) : Math.max(b.from, b.to)) }))
    .map((b) => ({ ...b, y0: Math.min(b.top, b.bottom), y1: Math.max(b.top, b.bottom) }))
    .filter((b) => b.y1 - b.y0 > 0.5);
  const kmTicks = Array.from({ length: Math.floor(totalKm / 5) + 1 }, (_, i) => i * 5);

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.chartHead}>
        <span className={styles.h3}>{title}</span>
      </figcaption>
      <div ref={wrap} className={styles.chartArea}>
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className={styles.chartSvg}
          role="img"
          aria-label={`${title}. ${describe(km)} at km ${km.toFixed(1)}.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (dragging.current = false)}
          onPointerLeave={() => onHover(null)}
        >
          {visible.map((b) => (
            <g key={b.zone} className={styles[`zone${b.zone}`]}>
              <rect x={PAD.left} width={plotW} y={b.y0} height={b.y1 - b.y0} className={styles.zoneBand} />
              {b.y1 - b.y0 >= 12 && padRight > 14 ? (
                <text x={width - padRight + 8} y={(b.y0 + b.y1) / 2} className={styles.bandLabel} dominantBaseline="middle">
                  Z{b.zone} {b.name.toLowerCase()}
                </text>
              ) : null}
            </g>
          ))}
          {[lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15].map((v) => (
            <text key={v} x={PAD.left - 8} y={y(v)} className={styles.axisLabel} textAnchor="end" dominantBaseline="middle">
              {format(v)}
            </text>
          ))}
          {runs.map((r) => (
            <path key={`${r.zone}-${r.startKm}`} d={pathFor(r.startKm, r.endKm)} className={`${styles.zoneLine} ${styles[`zone${r.zone}`]}`} />
          ))}
          {kmTicks.map((k) => (
            <text key={k} x={x(k)} y={HEIGHT - 6} className={styles.axisLabel} textAnchor={k === 0 ? "start" : "middle"}>
              {k === 0 ? "0 km" : k}
            </text>
          ))}
          {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className={styles.crosshair} /> : null}
          <line x1={x(km)} x2={x(km)} y1={PAD.top} y2={PAD.top + plotH} className={styles.cursor} />
          <circle cx={x(km)} cy={y(valueAt(km))} r={5} className={styles.cursorDot} />
        </svg>
        {hover !== null ? (
          <div className={styles.tooltip} style={{ left: Math.min(width - 180, Math.max(0, x(hover) - 90)) }} aria-hidden="true">
            <span className={styles.num}>Km {hover.toFixed(1)}</span>
            <span className={styles.num}>{describe(hover)}</span>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
