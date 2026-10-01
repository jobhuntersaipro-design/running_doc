"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { Input } from "@/components/arc/input/input";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs";
import { ThemeSwitch, type Theme } from "@/components/arc/theme-switch/theme-switch";
import { TimePicker } from "@/components/arc/time-picker/time-picker";
import type { CourseInput } from "@/lib/courses/types";
import { buildPlan, formatClock, formatPace, parseDuration, timeAt } from "@/lib/planner";
import { CourseSetup } from "./course-setup";
import { FuelPlan } from "./fuel-plan";
import { HillsTable } from "./hills-table";
import { PaceBand } from "./pace-band";
import { RaceRehearsal } from "./race-rehearsal";
import { SplitsTable } from "./splits-table";
import { clockAt } from "./util";
import { WatchSetup } from "./watch-setup";
import styles from "./planner.module.css";

const MIN_PACE = 150;
const MAX_PACE = 720;

function presetsFor(km: number): string[] {
  if (km > 40) return ["3:30:00", "4:00:00", "4:30:00", "5:00:00", "5:30:00"];
  if (km > 20) return ["1:45:00", "2:00:00", "2:15:00", "2:30:00", "2:45:00"];
  if (km > 9) return ["0:50:00", "0:55:00", "1:00:00", "1:10:00"];
  return ["0:25:00", "0:30:00", "0:35:00"];
}

function defaultGoalFor(km: number): string {
  return km > 40 ? "4:30:00" : km > 20 ? "1:59:00" : km > 9 ? "0:59:00" : "0:30:00";
}

function goalError(text: string, km: number): string | null {
  let seconds: number;
  try {
    seconds = parseDuration(text.trim());
  } catch {
    return "Enter a time as h:mm:ss, for example 1:59:00.";
  }
  const pace = seconds / km;
  if (!Number.isFinite(pace) || pace < MIN_PACE || pace > MAX_PACE) {
    return `Enter a time between ${formatClock(MIN_PACE * km)} and ${formatClock(MAX_PACE * km)} for this distance.`;
  }
  return null;
}

// The inline script in the layout sets data-theme before paint; follow it from there.
const readTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function Planner({ example }: { example: CourseInput }) {
  const [source, setSource] = useState<"example" | "upload">("example");
  const [uploaded, setUploaded] = useState<CourseInput | null>(null);
  const [goalText, setGoalText] = useState("1:59:00");
  const [goalSeconds, setGoalSeconds] = useState(parseDuration("1:59:00"));
  const [startTime, setStartTime] = useState(example.startTime ?? "06:00");
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);
  const [tab, setTab] = useState("splits");

  const course = source === "example" ? example : uploaded;
  const km = course?.officialKm ?? 21.0975;
  const error = goalError(goalText, km);

  const plan = useMemo(() => {
    if (!course) return null;
    // A goal from another distance is out of range here; fall back to a sensible default.
    const pace = goalSeconds / course.officialKm;
    const goal = pace >= MIN_PACE && pace <= MAX_PACE ? goalSeconds : parseDuration(defaultGoalFor(course.officialKm));
    return buildPlan({
      name: course.name,
      gpx: course.gpx,
      officialKm: course.officialKm,
      goalSeconds: goal,
      stations: course.stations,
    });
  }, [course, goalSeconds]);

  function changeGoal(text: string) {
    setGoalText(text);
    if (!goalError(text, km)) setGoalSeconds(parseDuration(text.trim()));
  }

  function changeCourse(next: CourseInput | null) {
    setUploaded(next);
    if (next && goalError(goalText, next.officialKm)) changeGoalFor(next.officialKm);
  }

  function changeGoalFor(distance: number) {
    const text = defaultGoalFor(distance);
    setGoalText(text);
    setGoalSeconds(parseDuration(text));
  }

  function changeSource(value: string) {
    const next = value === "upload" ? "upload" : "example";
    setSource(next);
    const distance = next === "example" ? example.officialKm : uploaded?.officialKm;
    if (distance && goalError(goalText, distance)) changeGoalFor(distance);
    if (next === "example") setStartTime(example.startTime ?? startTime);
  }

  function changeTheme(next: Theme) {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage can be blocked; the theme still applies for this visit.
    }
  }

  const presets = presetsFor(km).map((p) => ({ value: p, label: p.replace(/^0:/, "").replace(/:00$/, "") }));
  const summary = plan?.summary;
  const gels = plan?.events.filter((e) => e.type === "gel") ?? [];
  const drinks = plan?.events.filter((e) => e.type === "drink") ?? [];
  const biggestUphill = plan?.hills.filter((h) => h.kind === "uphill").sort((a, b) => b.change - a.change)[0];
  const cutoff = course?.cutoff;
  const cutoffArrival = plan && cutoff ? clockAt(startTime, timeAt(plan.timeline, cutoff.km)) : null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Race plan</h1>
          <p className={styles.lede}>
            Pace, fuel, hills and watch setup for your race, built from the course itself.
          </p>
        </div>
        <ThemeSwitch theme={theme} onThemeChange={changeTheme} iconOnly label="Switch theme" />
      </header>

      <section className={styles.section} aria-labelledby="course-heading">
        <div className={styles.sectionHead}>
          <h2 id="course-heading" className={styles.h2}>Course</h2>
          <SegmentedControl
            label="Course source"
            value={source}
            onValueChange={changeSource}
            options={[
              { value: "example", label: "Example course" },
              { value: "upload", label: "Your GPX" },
            ]}
          />
        </div>
        {source === "example" ? (
          <p className={styles.muted}>
            {example.name}, {example.officialKm.toFixed(1)} km. Upload your own GPX to plan your race.
          </p>
        ) : null}
        {/* Kept mounted so the uploaded file and stations survive switching back and forth. */}
        <div hidden={source !== "upload"}>
          <CourseSetup course={uploaded} onCourseChange={changeCourse} />
        </div>
      </section>

      {course && plan && summary ? (
        <>
          <section className={styles.section} aria-labelledby="goal-heading">
            <h2 id="goal-heading" className={styles.h2}>Goal</h2>
            <div className={styles.goalGrid}>
              <Input
                label="Goal finish time"
                description="Hours, minutes and seconds, for example 1:59:00"
                value={goalText}
                onChange={(e) => changeGoal(e.target.value)}
                error={error ?? undefined}
                inputMode="numeric"
                autoComplete="off"
              />
              <TimePicker label="Start time" value={startTime} onChange={setStartTime} format="12h" minuteStep={5} />
            </div>
            <ChipGroup
              label="Common goals"
              multiple={false}
              options={presets}
              value={presets.some((p) => p.value === goalText) ? [goalText] : []}
              onValueChange={(v) => v[0] && changeGoal(v[0])}
            />
            <p className={styles.summary}>
              Average <span className={styles.num}>{formatPace(summary.goalPaceSecPerKm)}/km</span>. First half{" "}
              <span className={styles.num}>{formatClock(summary.firstHalfSeconds)}</span>, second half{" "}
              <span className={styles.num}>{formatClock(summary.secondHalfSeconds)}</span>. Finish around{" "}
              <span className={styles.num}>{clockAt(startTime, summary.goalSeconds)}</span>.
              {cutoff && cutoffArrival ? ` You reach the km ${cutoff.km} cutoff around ${cutoffArrival}; it closes at ${cutoff.clock}.` : ""}
            </p>
          </section>

          <section className={styles.kpis} aria-label="Plan at a glance">
            <MetricCard
              label="Total uphill"
              value={Math.round(summary.totalGain)}
              suffix=" m"
              context={
                biggestUphill
                  ? `Biggest is +${Math.round(biggestUphill.change)} m from km ${biggestUphill.startKm.toFixed(1)}`
                  : "No real uphills on this course"
              }
            />
            <MetricCard
              label="Gels"
              value={gels.length}
              context={gels.length ? `First at km ${gels[0].km.toFixed(1)}, about ${formatClock(gels[0].elapsedSeconds)} in` : "Not needed at this pace"}
            />
            <MetricCard
              label="Drink stations"
              value={drinks.length}
              context={drinks.length ? `First at km ${drinks[0].km.toFixed(1)}` : "Add stations to plan your drinks"}
            />
          </section>

          <RaceRehearsal plan={plan} startTime={startTime} theme={theme} />

          <Tabs value={tab} onValueChange={setTab} className={styles.tabs}>
            <TabsList aria-label="Plan details">
              <TabsTrigger value="splits">Splits</TabsTrigger>
              <TabsTrigger value="hills">Hills</TabsTrigger>
              <TabsTrigger value="fuel">Fuel and water</TabsTrigger>
              <TabsTrigger value="watch">Watch setup</TabsTrigger>
              <TabsTrigger value="band">Pace band</TabsTrigger>
            </TabsList>
            <TabsContent value="splits">
              <SplitsTable plan={plan} startTime={startTime} />
            </TabsContent>
            <TabsContent value="hills">
              <HillsTable plan={plan} />
            </TabsContent>
            <TabsContent value="fuel">
              <FuelPlan plan={plan} startTime={startTime} approximate={!!course.stationsApproximate} />
            </TabsContent>
            <TabsContent value="watch">
              <WatchSetup plan={plan} />
            </TabsContent>
            <TabsContent value="band">
              <PaceBand plan={plan} startTime={startTime} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <footer className={styles.footer}>
        <p>
          General guidance, not medical or coaching advice. Practise your pacing and fuel in training before race day.
          {course?.stationsApproximate ? " Station positions on the example course are estimates from the route map." : ""}
        </p>
      </footer>
    </main>
  );
}
