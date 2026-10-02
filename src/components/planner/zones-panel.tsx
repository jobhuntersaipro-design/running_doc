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
import { useZoneSettings } from "./zone-settings";
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
}: {
  plan: Plan;
  zones: CourseZones;
  settings: ZoneSettings;
  onSettingsChange: (next: ZoneSettings) => void;
}) {
  const pathname = usePathname();
  const hr = settings.hr;
  const { dirty, account, save, discard } = useZoneSettings();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [ageText, setAgeText] = useState("");
  const age = Number(ageText);
  // Tanaka's formula (208 - 0.7 x age) is closer than 220 - age for most adults.
  const ageMax = age >= 12 && age <= 90 ? Math.round(208 - 0.7 * age) : null;
  const unordered = hr.method === "custom" && hr.customStarts.some((v, i) => i > 0 && v <= hr.customStarts[i - 1]);

  async function saveZones() {
    setSaveState("saving");
    setSaveState((await save()) ? "saved" : "failed");
  }
  const [paceDraft, setPaceDraft] = useState<string | null>(null);
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
          <div className={styles.ageEstimate}>
            <Input
              label="Your age"
              description="Not sure of your max? Enter your age for an estimate."
              inputMode="numeric"
              autoComplete="off"
              value={ageText}
              onChange={(e) => setAgeText(e.target.value.replace(/\D/g, "").slice(0, 2))}
            />
            {ageMax ? (
              <Button variant="secondary" size="sm" onClick={() => setHr({ maxHr: ageMax })} disabled={ageMax === hr.maxHr}>
                {ageMax === hr.maxHr ? `Using ${ageMax} bpm` : `Use ${ageMax} bpm`}
              </Button>
            ) : null}
          </div>
          <SegmentedControl label="Zone method" value={hr.method} onValueChange={changeMethod} options={METHODS} />
          <p className={styles.muted}>{METHOD_HELP[hr.method]}</p>
          {hr.method === "custom" ? (
            <ol className={styles.customZones}>
              {hr.customStarts.map((start, i) => (
                <li key={i} className={styles[`zone${i + 1}`]}>
                  <span className={styles.zoneChip} aria-hidden="true">
                    Z{i + 1}
                  </span>
                  <NumberField
                    label={`Zone ${i + 1}, ${zones.hrZones[i].name.toLowerCase()}, starts at`}
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
                  <span className={styles.muted}>to {i < 4 ? hr.customStarts[i + 1] - 1 : hr.maxHr} bpm</span>
                </li>
              ))}
            </ol>
          ) : null}
          {unordered ? <p className={styles.fieldError}>Each zone has to start higher than the one before it.</p> : null}
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

      <div className={styles.zoneSaveBar} data-dirty={dirty || undefined} role="status">
        <p>
          {dirty
            ? "You have unsaved changes. The zones above already show them."
            : saveState === "failed"
              ? "Saved in this browser, but not to your account. Try again."
              : saveState === "saved"
                ? account === "signed-in"
                  ? "Saved to your account."
                  : "Saved in this browser."
                : account === "signed-in"
                  ? "Your zones are saved to your account."
                  : "Your zones are saved in this browser."}{" "}
          {account === "signed-out" ? (
            <Link href={`/signin?next=${encodeURIComponent(pathname)}`}>Sign in to keep them on every device.</Link>
          ) : null}
        </p>
        {dirty || saveState === "failed" ? (
          <div className={styles.inlineActions}>
            {dirty ? (
              <Button variant="ghost" size="sm" onClick={discard}>
                Discard
              </Button>
            ) : null}
            <Button size="sm" onClick={saveZones} loading={saveState === "saving"} disabled={unordered}>
              Save zones
            </Button>
          </div>
        ) : null}
      </div>

      <p className={styles.hint}>
        On uphills the pace zone drops while heart rate rises: hold the effort, not the
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
