"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { Input } from "@/components/arc/input/input";
import { NumberField } from "@/components/arc/number-field/number-field";
import { Breadcrumb } from "@/components/arc/breadcrumb/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs";
import { SiteHeader } from "@/components/site/site-header";
import { useTheme } from "@/components/site/theme";
import { TimePicker } from "@/components/arc/time-picker/time-picker";
import type { CourseInput, RaceMeta } from "@/lib/courses/types";
import { buildPlan, courseZones, formatClock, formatPace, parseDuration, timeAt, withProfile, type SavedGoal } from "@/lib/planner";
import { saveGoal } from "@/app/races/[id]/actions";
import type { LinkPreview } from "@/lib/server/link-preview";
import { CourseSetup } from "./course-setup";
import { RaceResources } from "./race-resources";
import { FinishBenchmarks } from "./finish-benchmarks";
import { FuelPlan } from "./fuel-plan";
import { HeatPanel } from "./heat-panel";
import { HillsTable } from "./hills-table";
import { RaceReview } from "./race-review";
import { RaceRehearsal } from "./race-rehearsal";
import { useRunnerProfile } from "./runner-profile";
import { SplitsTable } from "./splits-table";
import { clockAt } from "./util";
import { WatchSetup } from "./watch-setup";
import { ZonesPanel } from "./zones-panel";
import { useZoneSettings } from "./zone-settings";
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

function goalError(seconds: number, km: number): string | null {
  const pace = seconds / km;
  if (Number.isFinite(pace) && pace >= MIN_PACE && pace <= MAX_PACE) return null;
  return `Aim between ${formatClock(MIN_PACE * km)} and ${formatClock(MAX_PACE * km)} for this distance (${formatPace(MIN_PACE)} to ${formatPace(MAX_PACE)} per km).`;
}

/** A race from the overview: the course plus its event details. */
export type PlannerRace = CourseInput &
  Pick<RaceMeta, "event" | "category" | "dateLabel" | "date" | "location" | "officialUrl" | "files"> & { publishedBy?: string; bib?: string };

/** The plan for one race, or for an uploaded GPX when `race` is null. */
export function Planner({
  race,
  officialPreview,
  distances = [],
  signedIn = false,
  savedGoal = null,
  notice,
  like,
  children,
}: {
  race: PlannerRace | null;
  officialPreview?: LinkPreview | null;
  /** Every distance of this race's event, for the tabs under the title. */
  distances?: { id: string; label: string; current: boolean }[];
  signedIn?: boolean;
  /** The signed-in runner's saved goal for this race; the plan opens on it. */
  savedGoal?: SavedGoal | null;
  /** Shown above the title, such as why the runner landed here. */
  notice?: ReactNode;
  /** The like button, under the title. */
  like?: ReactNode;
  /** Shown after the plan, such as the comments. */
  children?: ReactNode;
}) {
  const [uploaded, setUploaded] = useState<CourseInput | null>(null);
  // `draft` follows the controls; `goalSeconds` is the last in-range goal, which the plan uses.
  const [draft, setDraft] = useState(() => savedGoal?.goalSeconds ?? parseDuration(defaultGoalFor(race?.officialKm ?? 21.0975)));
  const [goalSeconds, setGoalSeconds] = useState(draft);
  // What the runner is typing in the pace field; null shows the goal's pace.
  const [paceText, setPaceText] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(savedGoal?.startTime ?? race?.startTime ?? "06:00");
  const [saved, setSaved] = useState(savedGoal);
  const [saving, setSaving] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const theme = useTheme();
  const [tab, setTab] = useState("splits");
  const { settings: savedZoneSettings, preview: setZoneSettings } = useZoneSettings();
  const profile = useRunnerProfile();
  const zoneSettings = useMemo(() => withProfile(savedZoneSettings, profile), [savedZoneSettings, profile]);

  const course: CourseInput | null = race ?? uploaded;
  const km = course?.officialKm ?? 21.0975;
  const error = goalError(draft, km);
  const goalH = Math.floor(draft / 3600);
  const goalM = Math.floor((draft % 3600) / 60);
  const goalS = draft % 60;

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

  const zones = useMemo(() => (plan ? courseZones(plan, zoneSettings, profile) : null), [plan, zoneSettings, profile]);

  function changeGoal(total: number) {
    // Minutes and seconds may step one past their range so 1:59 + 1 min rolls over to 2:00.
    const seconds = Math.min(Math.max(total, 0), 9 * 3600 + 59 * 60 + 59);
    setDraft(seconds);
    if (!goalError(seconds, km)) setGoalSeconds(seconds);
  }

  function changePace(text: string) {
    setPaceText(text);
    if (/^\d{1,2}:[0-5]\d$/.test(text.trim())) changeGoal(Math.round(parseDuration(text.trim()) * km));
  }

  function changeCourse(next: CourseInput | null) {
    setUploaded(next);
    if (next && goalError(draft, next.officialKm)) {
      const seconds = parseDuration(defaultGoalFor(next.officialKm));
      setDraft(seconds);
      setGoalSeconds(seconds);
    }
  }

  const savedNow = saved !== null && saved.goalSeconds === goalSeconds && saved.startTime === startTime;

  async function saveCurrentGoal() {
    if (!race) return;
    setSaving({ busy: true });
    const result = await saveGoal(race.id, goalSeconds, startTime).catch(() => ({ error: "Your goal could not be saved. Try again in a moment.", saved: undefined }));
    if (result.saved) setSaved(result.saved);
    setSaving({ busy: false, error: result.error });
  }

  const presets = presetsFor(km).map((p) => ({ value: p, label: p.replace(/^0:/, "").replace(/:00$/, "") }));
  // Shown in the Goal section and again in Watch setup, so the goal can change right before the download.
  const goalFields = (
    <>
      <div className={styles.goalTime} role="group" aria-label="Goal finish time">
        <NumberField label="Hours" size="sm" value={goalH} min={0} max={9} suffix=" h" onValueChange={(v) => changeGoal(v * 3600 + goalM * 60 + goalS)} />
        <NumberField label="Minutes" size="sm" value={goalM} min={-1} max={60} suffix=" min" onValueChange={(v) => changeGoal(goalH * 3600 + v * 60 + goalS)} />
        <NumberField label="Seconds" size="sm" value={goalS} min={-5} max={60} step={5} suffix=" s" onValueChange={(v) => changeGoal(goalH * 3600 + goalM * 60 + v)} />
      </div>
      <ChipGroup
        label="Common goals"
        multiple={false}
        options={presets}
        value={presets.some((p) => p.value === formatClock(draft)) ? [formatClock(draft)] : []}
        onValueChange={(v) => v[0] && changeGoal(parseDuration(v[0]))}
      />
    </>
  );

  const summary = plan?.summary;
  const cutoff = course?.cutoff;
  const cutoffArrival = plan && cutoff ? clockAt(startTime, timeAt(plan.timeline, cutoff.km)) : null;

  return (
    <main className={styles.page}>
      <SiteHeader />

      <section className={styles.section} aria-labelledby="race-heading">
        <Breadcrumb items={[{ label: "Races", href: "/" }, { label: race ? race.name : "Your race" }]} />
        {notice}
        <div className={styles.titleBlock}>
          <h1 id="race-heading" className={styles.title}>
            {race ? race.event : "Plan your own race"}
          </h1>
          <p className={styles.lede}>
            {race
              ? `${race.category}, ${race.officialKm.toFixed(1)} km. ${race.dateLabel}, ${race.location}.${race.publishedBy ? ` Published by ${race.publishedBy}.` : ""}${race.bib ? ` Your bib: ${race.bib}.` : ""}`
              : "Upload the course GPX, choose the distance and add the aid stations from your race guide."}
          </p>
          {like}
        </div>
        {distances.length > 1 ? (
          <nav className={styles.distanceTabs} aria-label="Race distance">
            {distances.map((d) => (
              <Link key={d.id} href={`/races/${d.id}`} className={styles.distanceTab} aria-current={d.current ? "page" : undefined}>
                {d.label}
              </Link>
            ))}
          </nav>
        ) : null}
        {race ? (
          <RaceResources officialUrl={race.officialUrl} files={race.files} preview={officialPreview ?? null} />
        ) : (
          <CourseSetup course={uploaded} onCourseChange={changeCourse} />
        )}
      </section>

      {course && plan && summary && zones ? (
        <>
          <section className={styles.section} aria-labelledby="goal-heading">
            <h2 id="goal-heading" className={styles.h2}>Goal</h2>
            {goalFields}
            <div className={styles.goalGrid}>
              <Input
                label="Or aim for a pace"
                description="Minutes and seconds per km, for example 5:40"
                value={paceText ?? formatPace(draft / km)}
                onChange={(e) => changePace(e.target.value)}
                onBlur={() => setPaceText(null)}
                error={error ?? undefined}
                inputMode="numeric"
                autoComplete="off"
              />
              <TimePicker label="Start time" value={startTime} onChange={setStartTime} format="12h" minuteStep={5} />
            </div>
            <p className={styles.summary}>
              Average <span className={styles.num}>{formatPace(summary.goalPaceSecPerKm)}/km</span>. First half{" "}
              <span className={styles.num}>{formatClock(summary.firstHalfSeconds)}</span>, second half{" "}
              <span className={styles.num}>{formatClock(summary.secondHalfSeconds)}</span>. Finish around{" "}
              <span className={styles.num}>{clockAt(startTime, summary.goalSeconds)}</span>.
              {cutoff && cutoffArrival ? ` You reach the km ${cutoff.km} cutoff around ${cutoffArrival}; it closes at ${cutoff.clock}.` : ""}
            </p>
            <HeatPanel
              lat={plan.track[0].lat}
              lon={plan.track[0].lon}
              date={race?.date}
              startTime={startTime}
              goalSeconds={goalSeconds}
              km={km}
              onUseGoal={changeGoal}
            />
            {race ? (
              <div className={styles.goalSave}>
                {signedIn ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={saveCurrentGoal} loading={saving.busy} disabled={savedNow || !!error}>
                      {savedNow ? (
                        <>
                          <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                          Goal saved
                        </>
                      ) : saved ? (
                        "Save this goal instead"
                      ) : (
                        "Save my goal"
                      )}
                    </Button>
                    <p className={styles.muted} role="status">
                      {saving.error ??
                        (saved ? (
                          <>
                            Your saved goal is <span className={styles.num}>{formatClock(saved.goalSeconds)}</span>, starting{" "}
                            {clockAt(saved.startTime, 0)}. It is in <Link href="/my">My races</Link> and opens here next time.
                          </>
                        ) : (
                          "Save your goal and start time to your account. This plan opens on them next time, and they are listed in My races."
                        ))}
                    </p>
                  </>
                ) : (
                  <p className={styles.muted}>
                    <Link href={`/signin?next=${encodeURIComponent(`/races/${race.id}`)}`}>Sign in</Link> to save your goal for this race.
                  </p>
                )}
              </div>
            ) : null}
          </section>

          <FinishBenchmarks km={summary.totalKm} goalSeconds={summary.goalSeconds} />

          <RaceRehearsal plan={plan} zones={zones} startTime={startTime} theme={theme} profile={profile} />

          <Tabs value={tab} onValueChange={setTab} className={styles.tabs}>
            <TabsList aria-label="Plan details">
              <TabsTrigger value="splits">Splits</TabsTrigger>
              <TabsTrigger value="hills">Hills</TabsTrigger>
              <TabsTrigger value="zones">Zones</TabsTrigger>
              <TabsTrigger value="fuel">Fuel and water</TabsTrigger>
              <TabsTrigger value="watch">Watch setup</TabsTrigger>
            </TabsList>
            <TabsContent value="splits">
              <SplitsTable plan={plan} zones={zones} startTime={startTime} />
            </TabsContent>
            <TabsContent value="hills">
              <HillsTable plan={plan} />
            </TabsContent>
            <TabsContent value="zones">
              <ZonesPanel zones={zones} settings={zoneSettings} onSettingsChange={setZoneSettings} />
            </TabsContent>
            <TabsContent value="fuel">
              <FuelPlan plan={plan} startTime={startTime} approximate={!!course.stationsApproximate} />
            </TabsContent>
            <TabsContent value="watch">
              <WatchSetup plan={plan} goal={goalFields} />
            </TabsContent>
          </Tabs>

          <RaceReview plan={plan} />
        </>
      ) : null}

      {children}

      <footer className={styles.footer}>
        <p>
          General guidance, not medical or coaching advice. Practise your pacing and fuel in training before race day.
          {course?.stationsApproximate ? " Station positions on the example course are estimates from the route map." : ""}
        </p>
      </footer>
    </main>
  );
}
