"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { elevationAt, formatPace, type Plan, type PlanEvent } from "@/lib/planner";
import { RouteLegend } from "./route-legend";
import { paceAt } from "./util";
import styles from "./planner.module.css";

const HEIGHT = 200;
/** Right padding matches the zone charts below so distances line up. */
const PAD = { left: 40, right: 34 as number, top: 24, bottom: 48 };
const MARKER_ROW = HEIGHT - 30;

export function ElevationChart({
  plan,
  km,
  onScrub,
  hover,
  onHover,
  activeEvents,
}: {
  plan: Plan;
  km: number;
  onScrub: (km: number) => void;
  /** Shared with the pace and heart rate charts so all three point at the same spot. */
  hover: number | null;
  onHover: (km: number | null) => void;
  /** Events the rehearsal is showing now; they pulse on the chart. */
  activeEvents: PlanEvent[];
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

  const total = plan.summary.totalKm;
  const eles = plan.profile.map((p) => p.ele);
  const min = Math.floor((Math.min(...eles) - 3) / 10) * 10;
  const max = Math.ceil((Math.max(...eles) + 3) / 10) * 10;
  // Phones drop the right margin (and the zone names in it) to give the line room.
  const padRight = width < 360 ? 12 : PAD.right;
  const plotW = width - PAD.left - padRight;
  const baseY = MARKER_ROW - 18;
  const plotH = baseY - PAD.top;
  const x = (k: number) => PAD.left + (k / total) * plotW;
  const y = (e: number) => PAD.top + (1 - (e - min) / (max - min)) * plotH;

  const pathFor = (from: number, to: number) =>
    plan.profile
      .filter((p) => p.km >= from - 1e-9 && p.km <= to + 1e-9)
      .map((p, i) => `${i ? "L" : "M"}${x(p.km).toFixed(1)},${y(p.ele).toFixed(1)}`)
      .join("");
  const profilePath = pathFor(0, total);
  const area = `${profilePath}L${x(total)},${baseY}L${x(0)},${baseY}Z`;
  const ticks = [min, (min + max) / 2, max];
  const kmTicks = Array.from({ length: Math.floor(total / 5) + 1 }, (_, i) => i * 5);

  const toKm = (clientX: number) => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.min(total, Math.max(0, ((clientX - rect.left - PAD.left) / plotW) * total));
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
  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    const steps: Record<string, number> = { ArrowRight: 0.1, ArrowUp: 0.1, ArrowLeft: -0.1, ArrowDown: -0.1, PageUp: 1, PageDown: -1 };
    if (e.key === "Home") onScrub(0);
    else if (e.key === "End") onScrub(total);
    else if (e.key in steps) onScrub(Math.min(total, Math.max(0, Math.round((km + steps[e.key]) * 10) / 10)));
    else return;
    e.preventDefault();
  }

  const gels = plan.events.filter((e) => e.type === "gel");
  const drinks = plan.events.filter((e) => e.type === "drink");
  const hoverGrade = hover === null ? 0 : plan.profile[Math.min(plan.profile.length - 1, Math.round((hover / total) * (plan.profile.length - 1)))].grade;

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.chartHead}>
        <span className={styles.h3}>Elevation</span>
        <span className={`${styles.chartValue} ${styles.num}`}>
          {(() => {
            const at = hover ?? km;
            const grade = plan.profile[Math.min(plan.profile.length - 1, Math.round((at / total) * (plan.profile.length - 1)))].grade;
            return `${Math.round(elevationAt(plan.profile, at))} m, ${grade >= 0 ? "+" : ""}${grade.toFixed(1)}% at km ${at.toFixed(1)}`;
          })()}
        </span>
        <ul className={styles.legend} aria-label="Chart legend">
          <RouteLegend colorBy="hills" />
          <li><span className={styles.swatchGel} aria-hidden="true" />Gel</li>
          <li><span className={styles.swatchRing} aria-hidden="true" />Drink</li>
        </ul>
      </figcaption>
      <div ref={wrap} className={styles.chartArea}>
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className={styles.chartSvg}
          role="slider"
          tabIndex={0}
          aria-label="Course position"
          aria-valuemin={0}
          aria-valuemax={Number(total.toFixed(1))}
          aria-valuenow={Number(km.toFixed(1))}
          aria-valuetext={`${km.toFixed(1)} km, ${Math.round(elevationAt(plan.profile, km))} m elevation`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (dragging.current = false)}
          onPointerLeave={() => onHover(null)}
          onKeyDown={onKeyDown}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - padRight} y1={y(t)} y2={y(t)} className={styles.grid} />
              <text x={PAD.left - 8} y={y(t)} className={styles.axisLabel} textAnchor="end" dominantBaseline="middle">
                {Math.round(t)} m
              </text>
            </g>
          ))}
          <path d={area} className={styles.area} />
          <path d={profilePath} className={styles.profileLine} />
          {plan.segments
            .filter((s) => s.kind !== "flat")
            .map((s) => (
              <path
                key={`${s.kind}-${s.startKm}`}
                d={pathFor(s.startKm, s.endKm)}
                className={s.kind === "uphill" ? styles.climbLine : styles.descentLine}
              />
            ))}
          {plan.hills
            .filter((h) => h.kind === "uphill")
            .map((h) => (
              <text key={`peak-${h.peakKm}`} x={x(h.peakKm)} y={y(h.peakEle) - 8} className={styles.peakLabel} textAnchor="middle">
                {Math.round(h.peakEle)} m
              </text>
            ))}
          {kmTicks.map((k) => (
            <text key={k} x={x(k)} y={HEIGHT - 6} className={styles.axisLabel} textAnchor={k === 0 ? "start" : "middle"}>
              {k === 0 ? "0 km" : k}
            </text>
          ))}
          {drinks.map((d) => (
            <circle key={`d-${d.km}`} cx={x(d.km)} cy={MARKER_ROW} r={4} className={styles.drinkMark} />
          ))}
          {gels.map((g) => (
            <circle key={`g-${g.km}`} cx={x(g.km)} cy={MARKER_ROW} r={5} className={styles.gelMark} />
          ))}
          {activeEvents.slice(0, 1).map((e) => {
            const onProfile = e.type === "uphill" || e.type === "downhill" || e.type === "start" || e.type === "push";
            return (
              <g key={`active-${e.type}-${e.km}`} className={styles[`event_${e.type}`]}>
                <circle cx={x(e.km)} cy={onProfile ? y(elevationAt(plan.profile, e.km)) : MARKER_ROW} r={9} className={styles.chartPulse} />
              </g>
            );
          })}
          {hover !== null ? (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={baseY} className={styles.crosshair} />
          ) : null}
          <line x1={x(km)} x2={x(km)} y1={PAD.top} y2={baseY} className={styles.cursor} />
          <circle cx={x(km)} cy={y(elevationAt(plan.profile, km))} r={5} className={styles.cursorDot} />
        </svg>
        {hover !== null ? (
          <div
            className={styles.tooltip}
            style={{ left: Math.min(width - 180, Math.max(0, x(hover) - 90)) }}
            aria-hidden="true"
          >
            <span className={styles.num}>Km {hover.toFixed(1)}</span>
            <span className={styles.num}>
              {Math.round(elevationAt(plan.profile, hover))} m, {hoverGrade >= 0 ? "+" : ""}
              {hoverGrade.toFixed(1)}%
            </span>
            <span className={styles.num}>{formatPace(paceAt(plan, hover))}/km target</span>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
