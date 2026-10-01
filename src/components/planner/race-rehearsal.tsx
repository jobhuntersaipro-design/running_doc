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
import { Switch } from "@/components/arc/switch/switch";
import type { Theme } from "@/components/arc/theme-switch/theme-switch";
import { HR_ZONE_NAMES, PACE_ZONE_NAMES, formatClock, formatPace, kmAtTime, timeAt, zoneAt, type CourseZones, type HillInfo, type Plan, type PlanEvent } from "@/lib/planner";
import { ElevationChart } from "./elevation-chart";
import type { MapStyle } from "./route-map";
import type { ColorBy } from "./zone-style";
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

const COLOR_BY: { value: ColorBy; label: string }[] = [
  { value: "hills", label: "Hills" },
  { value: "pace", label: "Pace zone" },
  { value: "hr", label: "Heart rate zone" },
];

const MAP_STYLES: { value: MapStyle; label: string }[] = [
  { value: "streets", label: "Streets" },
  { value: "satellite", label: "Satellite" },
  { value: "terrain", label: "Terrain" },
];

/** How long (km) an event stays on screen after the runner passes it, when not paused on it. */
const CALLOUT_KM = 0.5;
const EPS = 1e-6;

export function RaceRehearsal({ plan, zones, startTime, theme }: { plan: Plan; zones: CourseZones; startTime: string; theme: Theme }) {
  const total = plan.summary.totalKm;
  const [km, setKm] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [length, setLength] = useState("60");
  const [pauseAtEvents, setPauseAtEvents] = useState(true);
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("streets");
  const [follow, setFollow] = useState(false);
  const [colorBy, setColorBy] = useState<ColorBy>("hills");
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
      // The first frame's timestamp can be a hair before `last`; never step backwards,
      // or the runner would cross the event it just stopped at a second time.
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const from = kmRef.current;
      const t = timeAt(plan.timeline, from) + dt * rate;
      const to = t >= goal ? total : Math.max(from, kmAtTime(plan.timeline, t));
      // Stop exactly on the first event this frame would run past.
      const hit = pauseAtEvents ? plan.events.find((e) => e.type !== "start" && e.km > from + EPS && e.km <= to + EPS) : undefined;
      if (hit) {
        kmRef.current = hit.km;
        setKm(hit.km);
        setStoppedAt(hit.km);
        setPlaying(false);
        return;
      }
      kmRef.current = to;
      setKm(to);
      if (to >= total) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, length, plan, total, pauseAtEvents]);

  const position = Math.min(km, total);
  const elapsed = timeAt(plan.timeline, position);
  const split = plan.splits[Math.min(Math.floor(position), plan.splits.length - 1)];
  const finished = position >= total - EPS;
  const upcoming = plan.events.find((e) => e.km > position + EPS);
  const here = zoneAt(zones, Math.min(position, total - EPS));

  // Events at the same spot (a station with a splash zone, say) show together.
  const anchor =
    stoppedAt ??
    [...plan.events].reverse().find((e) => e.km <= position + EPS && position - e.km < CALLOUT_KM && (position > 0 || e.type === "start"))?.km ??
    null;
  const group = anchor === null ? [] : plan.events.filter((e) => Math.abs(e.km - anchor) < EPS);

  function togglePlay() {
    if (finished) {
      kmRef.current = 0;
      setKm(0);
    }
    setStoppedAt(null);
    setPlaying((p) => !p || finished);
  }

  function scrub(next: number) {
    setPlaying(false);
    setStoppedAt(null);
    kmRef.current = next;
    setKm(next);
  }

  const playLabel = playing ? "Pause" : finished ? "Replay race" : stoppedAt !== null ? "Continue" : position > 0 ? "Resume" : "Play race";

  return (
    <section className={styles.rehearsal} aria-labelledby="rehearsal-heading">
      <div className={styles.sectionHead}>
        <h2 id="rehearsal-heading" className={styles.h2}>Race rehearsal</h2>
        <SegmentedControl label="Playback length" value={length} onValueChange={setLength} options={PLAYBACK} />
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <SegmentedControl label="Map style" value={mapStyle} onValueChange={(v) => setMapStyle(v as MapStyle)} options={MAP_STYLES} />
          <SegmentedControl label="Color route by" value={colorBy} onValueChange={(v) => setColorBy(v as ColorBy)} options={COLOR_BY} />
        </div>
        <div className={styles.switches}>
          <Switch label="Pause at each event" checked={pauseAtEvents} onCheckedChange={setPauseAtEvents} />
          <Switch label="Follow runner in 3D" checked={follow} onCheckedChange={setFollow} />
        </div>
      </div>

      <div className={styles.rehearsalGrid}>
        <div className={styles.mapWrap}>
          <RouteMap
            plan={plan}
            km={position}
            theme={theme}
            mapStyle={mapStyle}
            follow={follow}
            popupEvents={stoppedAt !== null ? group : []}
            zones={zones}
            colorBy={colorBy}
          />
        </div>

        <div className={styles.nowPanel}>
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
            <div>
              <dt>Pace zone</dt>
              <dd className={styles.num}>
                Z{here.paceZone} <span className={styles.unit}>{PACE_ZONE_NAMES[here.paceZone - 1].toLowerCase()}</span>
              </dd>
            </div>
            <div>
              <dt>Heart rate, estimated</dt>
              <dd className={styles.num}>
                {here.hr} <span className={styles.unit}>bpm, Z{here.hrZone} {HR_ZONE_NAMES[here.hrZone - 1].toLowerCase()}</span>
              </dd>
            </div>
          </dl>

          <div className={styles.effortRow}>
            <span className={styles.muted}>Effort for km {split.km}</span>
            <Badge tone={split.tag === "push" ? "info" : "neutral"}>{TAG_LABEL[split.tag]}</Badge>
          </div>

          <div className={styles.callout} aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              {group.length ? (
                <motion.div
                  key={`group-${anchor}`}
                  className={styles.calloutStack}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, transition: { duration: motionTokens.duration.exit } }}
                  transition={reduce ? { duration: motionTokens.duration.instant } : motionTokens.spring.smooth}
                >
                  {group.map((e) => (
                    <EventCard key={`${e.type}-${e.km}`} event={e} />
                  ))}
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
          {playLabel}
        </Button>
        <Button variant="ghost" onClick={() => scrub(0)} disabled={position === 0}>
          Back to start
        </Button>
        <Progress className={styles.progress} value={position} max={total} label="Race progress" showValue />
      </div>

      <ElevationChart plan={plan} km={position} onScrub={scrub} zones={zones} colorBy={colorBy} />
    </section>
  );
}

function EventCard({ event }: { event: PlanEvent }) {
  return (
    <div className={styles.calloutCard}>
      <p className={styles.calloutTitle}>{event.title}</p>
      <p className={styles.calloutDetail}>{event.detail}</p>
      {event.hill ? <HillStats hill={event.hill} /> : null}
    </div>
  );
}

export function HillStats({ hill }: { hill: HillInfo }) {
  const up = hill.kind === "uphill";
  return (
    <dl className={styles.hillStats}>
      <div>
        <dt>Elevation</dt>
        <dd className={styles.num}>
          {Math.round(hill.startEle)} to {Math.round(hill.peakEle)} m
        </dd>
      </div>
      <div>
        <dt>Gradient</dt>
        <dd className={styles.num}>
          {Math.abs(hill.avgGrade).toFixed(1)}%, steepest {Math.abs(hill.steepestGrade).toFixed(1)}%
        </dd>
      </div>
      <div>
        <dt>Target pace</dt>
        <dd className={styles.num}>{formatPace(hill.paceSecPerKm)}/km</dd>
      </div>
      <div>
        <dt>Treadmill</dt>
        <dd className={styles.num}>{up && hill.treadmillIncline !== null ? `${hill.treadmillIncline}% incline` : "Practise outdoors"}</dd>
      </div>
    </dl>
  );
}
