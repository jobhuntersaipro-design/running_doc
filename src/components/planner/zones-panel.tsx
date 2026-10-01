"use client";

import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { NumberField } from "@/components/arc/number-field/number-field";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import {
  estimateThresholdPace,
  formatClock,
  formatPace,
  hrZones,
  parseDuration,
  type CourseZones,
  type HrSettings,
  type Plan,
  type ZoneSettings,
} from "@/lib/planner";
import styles from "./planner.module.css";

const METHODS: { value: HrSettings["method"]; label: string }[] = [
  { value: "max", label: "% of max" },
  { value: "reserve", label: "Heart rate reserve" },
  { value: "custom", label: "My own zones" },
];

const METHOD_HELP: Record<HrSettings["method"], string> = {
  max: "Zones start at 50, 60, 70, 80 and 90% of your max heart rate.",
  reserve: "Zones use the range between resting and max heart rate (Karvonen), which suits fitter runners with a low resting rate.",
  custom: "Enter where each zone starts, for example from your watch, a lab test or your coach.",
};

function parsePace(text: string): number | null {
  try {
    const v = parseDuration(text.trim());
    return v >= 150 && v <= 600 ? v : null;
  } catch {
    return null;
  }
}

export function ZonesPanel({
  plan,
  zones,
  settings,
  onSettingsChange,
}: {
  plan: Plan;
  zones: CourseZones;
  settings: ZoneSettings;
  onSettingsChange: (next: ZoneSettings) => void;
}) {
  const [paceDraft, setPaceDraft] = useState<string | null>(null);
  const hr = settings.hr;
  const goal = plan.summary.goalSeconds;
  const estimate = estimateThresholdPace(goal, plan.summary.totalKm);
  const paceText = paceDraft ?? (settings.thresholdPace === null ? "" : formatPace(settings.thresholdPace));
  const paceError = paceDraft && paceDraft.trim() && parsePace(paceDraft) === null ? "Enter a pace as m:ss per km, between 2:30 and 10:00." : undefined;

  const setHr = (patch: Partial<HrSettings>) => onSettingsChange({ ...settings, hr: { ...hr, ...patch } });

  function changeMethod(method: string) {
    const next = method as HrSettings["method"];
    // Start custom zones from the ones currently shown, so the runner edits rather than starts over.
    if (next === "custom" && hr.method !== "custom") {
      const starts = hrZones(hr).map((z) => z.min) as HrSettings["customStarts"];
      setHr({ method: next, customStarts: starts });
    } else setHr({ method: next });
  }

  function changePace(text: string) {
    setPaceDraft(text);
    const v = parsePace(text);
    if (v !== null) onSettingsChange({ ...settings, thresholdPace: v });
    else if (!text.trim()) onSettingsChange({ ...settings, thresholdPace: null });
  }

  const pct = (seconds: number) => (seconds / goal) * 100;

  return (
    <div className={styles.panel}>
      <p className={styles.muted}>
        Set your own zones to see which parts of the race fall in which heart rate and pace zone. They are saved in this browser.
        On uphills the pace zone drops while heart rate rises: hold the effort, not the pace.
      </p>

      <div className={styles.zonesGrid}>
        <section className={styles.zoneForm} aria-labelledby="hr-zones-heading">
          <h3 id="hr-zones-heading" className={styles.h3}>Heart rate zones</h3>
          <div className={styles.fieldRow}>
            <NumberField
              label="Max heart rate"
              value={hr.maxHr}
              min={120}
              max={230}
              suffix=" bpm"
              onValueChange={(v) => setHr({ maxHr: v })}
              description="From a hard race or field test. 220 minus age is only a rough guess."
            />
            <NumberField
              label="Resting heart rate"
              value={hr.restingHr}
              min={30}
              max={110}
              suffix=" bpm"
              onValueChange={(v) => setHr({ restingHr: v })}
              description="Measured lying down, first thing in the morning."
            />
          </div>
          <SegmentedControl label="Zone method" value={hr.method} onValueChange={changeMethod} options={METHODS} />
          <p className={styles.muted}>{METHOD_HELP[hr.method]}</p>
          {hr.method === "custom" ? (
            <div className={styles.fieldRow}>
              {hr.customStarts.map((start, i) => (
                <NumberField
                  key={i}
                  label={`Zone ${i + 1} starts at`}
                  value={start}
                  min={60}
                  max={hr.maxHr}
                  suffix=" bpm"
                  onValueChange={(v) => {
                    const next = [...hr.customStarts] as HrSettings["customStarts"];
                    next[i] = v;
                    setHr({ customStarts: next });
                  }}
                />
              ))}
            </div>
          ) : null}

          <ZoneTable
            caption="Heart rate zones and estimated race time in each"
            rangeLabel="Heart rate"
            rows={zones.hrZones.map((z, i) => ({
              zone: z.zone,
              name: z.name,
              range: `${z.min} to ${z.max} bpm`,
              seconds: zones.hrSeconds[i],
              pct: pct(zones.hrSeconds[i]),
            }))}
          />
        </section>

        <section className={styles.zoneForm} aria-labelledby="pace-zones-heading">
          <h3 id="pace-zones-heading" className={styles.h3}>Pace zones</h3>
          <Input
            label="Threshold pace per km"
            value={paceText}
            placeholder={formatPace(estimate)}
            onChange={(e) => changePace(e.target.value)}
            onBlur={() => setPaceDraft(null)}
            error={paceError}
            inputMode="numeric"
            autoComplete="off"
            description={`The pace you could race for about an hour. Leave it empty to use ${formatPace(estimate)}/km, estimated from your goal.`}
          />
          {settings.thresholdPace !== null ? (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPaceDraft(null);
                  onSettingsChange({ ...settings, thresholdPace: null });
                }}
              >
                Use the estimate from my goal
              </Button>
            </div>
          ) : null}
          <p className={styles.muted}>Zones follow Joe Friel&apos;s run pace zones, as a share of threshold pace.</p>

          <ZoneTable
            caption="Pace zones and race time in each"
            rangeLabel="Pace"
            rows={zones.paceZones.map((z, i) => ({
              zone: z.zone,
              name: z.name,
              range:
                z.slowest === Infinity
                  ? `Slower than ${formatPace(z.fastest)}`
                  : z.fastest === 0
                    ? `Faster than ${formatPace(z.slowest)}`
                    : `${formatPace(z.slowest)} to ${formatPace(z.fastest)}`,
              seconds: zones.paceSeconds[i],
              pct: pct(zones.paceSeconds[i]),
            }))}
          />
        </section>
      </div>

      <p className={styles.hint}>
        Race heart rates are estimates from typical effort for your goal time, with drift over the race and changes on hills.
        Your real numbers depend on heat, fitness and the day.
      </p>
    </div>
  );
}

function ZoneTable({
  caption,
  rangeLabel,
  rows,
}: {
  caption: string;
  rangeLabel: string;
  rows: { zone: number; name: string; range: string; seconds: number; pct: number }[];
}) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.simpleTable}>
        <caption className={styles.srOnly}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Zone</th>
            <th scope="col">{rangeLabel}</th>
            <th scope="col">In this race</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.zone}>
              <td>
                <span className={styles.zoneTableHead}>
                  Z{r.zone} {r.name.toLowerCase()}
                </span>
              </td>
              <td className={styles.num}>{r.range}</td>
              <td className={styles.num}>
                {r.seconds > 0 ? `${formatClock(r.seconds)}, ${Math.round(r.pct)}%` : "None"}
                {r.seconds > 0 ? (
                  <span className={`${styles.zoneBar} ${styles[`zone${r.zone}`]}`} style={{ width: `${Math.max(2, r.pct)}%` }} aria-hidden="true" />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
