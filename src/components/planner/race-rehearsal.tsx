"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { Progress } from "@/components/arc/progress/progress";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import type { Theme } from "@/components/arc/theme-switch/theme-switch";
import { formatClock, formatPace, kmAtTime, timeAt, type Plan, type PlanEvent } from "@/lib/planner";
import { ElevationChart } from "./elevation-chart";
import { TAG_LABEL, clockAt, paceAt } from "./util";
import styles from "./planner.module.css";

const RouteMap = dynamic(() => import("./route-map"), {
  ssr: false,
  loading: () => <div className={styles.mapPlaceholder} aria-busy="true" />,
});

const PLAYBACK = [
  { value: "30", label: "30 s" },
  { value: "60", label: "1 min" },
  { value: "180", label: "3 min" },
];

/** How long (km) an event stays on screen after the runner passes it. */
const CALLOUT_KM = 0.5;

const eventKey = (e: PlanEvent) => `${e.type}-${e.km}`;

export function RaceRehearsal({ plan, startTime, theme }: { plan: Plan; startTime: string; theme: Theme }) {
  const total = plan.summary.totalKm;
  const [km, setKm] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [length, setLength] = useState("60");
  const kmRef = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    kmRef.current = Math.min(km, total);
  }, [km, total]);

  useEffect(() => {
    if (!playing) return;
    const goal = plan.summary.goalSeconds;
    const rate = goal / Number(length);
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = timeAt(plan.timeline, kmRef.current) + dt * rate;
      if (t >= goal) {
        kmRef.current = total;
        setKm(total);
        setPlaying(false);
        return;
      }
      kmRef.current = kmAtTime(plan.timeline, t);
      setKm(kmRef.current);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, length, plan, total]);

  const position = Math.min(km, total);
  const elapsed = timeAt(plan.timeline, position);
  const split = plan.splits[Math.min(Math.floor(position), plan.splits.length - 1)];
  const finished = position >= total - 1e-6;
  const upcoming = plan.events.find((e) => e.km > position + 1e-6);
  const active = [...plan.events]
    .reverse()
    .find((e) => e.km <= position + 1e-6 && position - e.km < CALLOUT_KM && (position > 0 || e.type === "start"));

  function togglePlay() {
    if (finished) {
      kmRef.current = 0;
      setKm(0);
    }
    setPlaying((p) => !p || finished);
  }

  function scrub(next: number) {
    setPlaying(false);
    kmRef.current = next;
    setKm(next);
  }

  return (
    <section className={styles.rehearsal} aria-labelledby="rehearsal-heading">
      <div className={styles.sectionHead}>
        <h2 id="rehearsal-heading" className={styles.h2}>Race rehearsal</h2>
        <SegmentedControl label="Playback length" value={length} onValueChange={setLength} options={PLAYBACK} />
      </div>

      <div className={styles.rehearsalGrid}>
        <div className={styles.mapWrap}>
          <RouteMap plan={plan} km={position} theme={theme} />
        </div>

        <div className={styles.nowPanel} aria-live="off">
          <dl className={styles.nowStats}>
            <div>
              <dt>Distance</dt>
              <dd className={styles.num}>
                {position.toFixed(1)} <span className={styles.unit}>of {total.toFixed(1)} km</span>
              </dd>
            </div>
            <div>
              <dt>Race time</dt>
              <dd className={styles.num}>{formatClock(elapsed)}</dd>
            </div>
            <div>
              <dt>Clock</dt>
              <dd className={styles.num}>{clockAt(startTime, elapsed)}</dd>
            </div>
            <div>
              <dt>Target pace</dt>
              <dd className={styles.num}>
                {formatPace(paceAt(plan, position))} <span className={styles.unit}>/km</span>
              </dd>
            </div>
          </dl>

          <div className={styles.effortRow}>
            <span className={styles.muted}>Effort for km {split.km}</span>
            <Badge tone={split.tag === "push" ? "info" : "neutral"}>{TAG_LABEL[split.tag]}</Badge>
          </div>

          <div className={styles.callout} aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              {active ? (
                <motion.div
                  key={eventKey(active)}
                  className={styles.calloutCard}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, transition: { duration: motionTokens.duration.exit } }}
                  transition={reduce ? { duration: motionTokens.duration.instant } : motionTokens.spring.smooth}
                >
                  <p className={styles.calloutTitle}>{active.title}</p>
                  <p className={styles.calloutDetail}>{active.detail}</p>
                </motion.div>
              ) : (
                <motion.p
                  key="next"
                  className={styles.muted}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
                >
                  {upcoming
                    ? `Next: ${upcoming.title.toLowerCase()} in ${(upcoming.km - position).toFixed(1)} km`
                    : finished
                      ? "Finished. That is the whole race."
                      : "Nothing else until the finish."}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <Button variant="primary" onClick={togglePlay}>
          {playing ? (
            <Pause size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : finished ? (
            <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Play size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
          {playing ? "Pause" : finished ? "Replay race" : position > 0 ? "Resume" : "Play race"}
        </Button>
        <Button variant="ghost" onClick={() => scrub(0)} disabled={position === 0}>
          Back to start
        </Button>
        <Progress className={styles.progress} value={position} max={total} label="Race progress" showValue />
      </div>

      <ElevationChart plan={plan} km={position} onScrub={scrub} />
    </section>
  );
}
