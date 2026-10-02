"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import type { ZoneAccount } from "./zone-settings";
import styles from "./planner.module.css";

const METHODS: { value: HrSettings["method"]; label: string }[] = [
  { value: "max", label: "% of max" },
  { value: "reserve", label: "Heart rate reserve" },
  { value: "custom", label: "My own zones" },
];

const METHOD_NAME: Record<HrSettings["method"], string> = {
  max: "% of max",
  reserve: "heart rate reserve",
  custom: "your own zones",
};

const METHOD_HELP: Record<HrSettings["method"], string> = {
  max: "Zones start at 50, 60, 70, 80 and 90% of your max heart rate. The simplest choice.",
  reserve: "Zones use the range between resting and max heart rate (Karvonen). Suits fitter runners with a low resting rate.",
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

interface ZoneRow {
  zone: number;
  name: string;
  range: string;
  seconds: number;
}

export function ZonesPanel({
  plan,
  zones,
  settings,
  onSettingsChange,
  account,
}: {
  plan: Plan;
  zones: CourseZones;
  settings: ZoneSettings;
  onSettingsChange: (next: ZoneSettings) => void;
  account: ZoneAccount;
}) {
  const pathname = usePathname();
  const [paceDraft, setPaceDraft] = useState<string | null>(null);
  const hr = settings.hr;
  const estimate = estimateThresholdPace(plan.summary.goalSeconds, plan.summary.totalKm);
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

  const hrRows: ZoneRow[] = zones.hrZones.map((z, i) => ({
    zone: z.zone,
    name: z.name,
    range: `${z.min} to ${z.max} bpm`,
    seconds: zones.hrSeconds[i],
  }));
  const paceRows: ZoneRow[] = zones.paceZones.map((z, i) => ({
    zone: z.zone,
    name: z.name,
    range:
      z.slowest === Infinity
        ? `slower than ${formatPace(z.fastest)}/km`
        : z.fastest === 0
          ? `faster than ${formatPace(z.slowest)}/km`
          : `${formatPace(z.slowest)} to ${formatPace(z.fastest)}/km`,
    seconds: zones.paceSeconds[i],
  }));

  return (
    <div className={styles.panel}>
      <div className={styles.zonesGrid}>
        <ZoneSection
          id="hr-zones"
          title="Heart rate zones"
          rows={hrRows}
          settingsLabel={`Max ${hr.maxHr} bpm, resting ${hr.restingHr} bpm, ${METHOD_NAME[hr.method]}`}
        >
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
        </ZoneSection>

        <ZoneSection
          id="pace-zones"
          title="Pace zones"
          rows={paceRows}
          settingsLabel={`Threshold ${formatPace(zones.thresholdPace)}/km${zones.thresholdEstimated ? ", estimated from your goal" : ""}`}
        >
          <Input
            label="Threshold pace per km"
            value={paceText}
            placeholder={formatPace(estimate)}
            onChange={(e) => changePace(e.target.value)}
            onBlur={() => setPaceDraft(null)}
            error={paceError}
            inputMode="numeric"
            autoComplete="off"
            description={`The pace you could race for about an hour. Leave it empty to use ${formatPace(estimate)}/km, estimated from your goal. Zones follow Joe Friel's run pace zones.`}
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
        </ZoneSection>
      </div>

      {account === "signed-out" ? (
        <p className={styles.zoneSignIn}>
          Your zones are only saved in this browser.{" "}
          <Link href={`/signin?next=${encodeURIComponent(pathname)}`}>Sign in to save them to your account</Link> and use them on
          any device.
        </p>
      ) : null}

      <p className={styles.hint}>
        {account === "signed-in" ? "Your zones are saved to your account. " : ""}On uphills the pace zone drops while heart rate rises: hold the effort, not the
        pace. Race heart rates are estimates from typical effort for your goal time; heat, fitness and the day change them.
      </p>
    </div>
  );
}

/** One zone system: where most of the race sits, the whole race as one bar, each zone, then its settings. */
function ZoneSection({
  id,
  title,
  rows,
  settingsLabel,
  children,
}: {
  id: string;
  title: string;
  rows: ZoneRow[];
  settingsLabel: string;
  children: ReactNode;
}) {
  const total = rows.reduce((s, r) => s + r.seconds, 0) || 1;
  const top = rows.reduce((a, b) => (b.seconds > a.seconds ? b : a));
  const pct = (s: number) => Math.round((s / total) * 100);
  return (
    <section className={styles.zoneSection} aria-labelledby={`${id}-heading`}>
      <div className={styles.zoneSectionHead}>
        <h3 id={`${id}-heading`} className={styles.h3}>
          {title}
        </h3>
        <p className={styles.muted}>
          Most of your race is in <span className={styles.num}>Z{top.zone}</span> {top.name.toLowerCase()}, {top.range} (
          <span className={styles.num}>{pct(top.seconds)}%</span>).
        </p>
      </div>

      <div className={styles.zoneStack} role="img" aria-label={rows.map((r) => `Zone ${r.zone} ${pct(r.seconds)}%`).join(", ")}>
        {rows.map((r) =>
          r.seconds > 0 ? (
            <span key={r.zone} className={styles[`zone${r.zone}`]} style={{ flexGrow: r.seconds }}>
              {pct(r.seconds) >= 12 ? `Z${r.zone}` : ""}
            </span>
          ) : null,
        )}
      </div>

      <ul className={styles.zoneList}>
        {rows.map((r) => (
          <li key={r.zone} className={`${styles.zoneItem} ${styles[`zone${r.zone}`]}`} data-empty={r.seconds === 0 || undefined}>
            <span className={styles.zoneChip} aria-hidden="true">
              Z{r.zone}
            </span>
            <span className={styles.zoneText}>
              <span className={styles.zoneName}>{r.name}</span>
              <span className={styles.zoneRange}>{r.range}</span>
            </span>
            <span className={styles.zoneTime}>
              <span className={styles.num}>{r.seconds > 0 ? formatClock(r.seconds) : "None"}</span>
              {r.seconds > 0 ? <span className={styles.zonePct}>{pct(r.seconds)}%</span> : null}
            </span>
            <span className={styles.zoneTrack} aria-hidden="true">
              <span style={{ width: `${(r.seconds / total) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>

      <details className={styles.zoneSettings}>
        <summary>
          <span>{settingsLabel}</span>
          <span className={styles.zoneSettingsAction}>Change</span>
        </summary>
        <div className={styles.zoneForm}>{children}</div>
      </details>
    </section>
  );
}
