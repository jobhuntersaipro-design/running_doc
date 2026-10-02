"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { saveRunnerProfile, useRunnerProfile } from "@/components/planner/runner-profile";
import { useZoneSettings } from "@/components/planner/zone-settings";
import { HrZoneFields, outOfOrder } from "@/components/planner/zones-panel";
import {
  PROFILE_LIMITS,
  formatPace,
  hrZones,
  maxHrFromAge,
  thresholdFromVo2max,
  withProfile,
  type RunnerProfile,
} from "@/lib/planner";
import inputStyles from "@/components/arc/input/input.module.css";
import adminStyles from "@/components/admin/admin.module.css";
import planner from "@/components/planner/planner.module.css";

type NumberKey = keyof typeof PROFILE_LIMITS;
type SaveState = "idle" | "saving" | "saved" | "failed";

const SEXES = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "", label: "Not set" },
];

const toText = (v: number | null) => (v === null ? "" : String(v));

/** Age, sex, height, weight and VO2 max, each optional, with what each one changes in the plan. */
export function ProfileForm({ initial }: { initial: RunnerProfile }) {
  const [draft, setDraft] = useState<Record<NumberKey, string>>({
    age: toText(initial.age),
    heightCm: toText(initial.heightCm),
    weightKg: toText(initial.weightKg),
    vo2max: toText(initial.vo2max),
  });
  const [sex, setSex] = useState<RunnerProfile["sex"]>(initial.sex);
  const [state, setState] = useState<SaveState>("idle");

  // An empty field is null; anything else must be a number in range.
  const value = (key: NumberKey) => (draft[key].trim() ? Number(draft[key]) : null);
  const error = (key: NumberKey) => {
    const v = value(key);
    const [min, max] = PROFILE_LIMITS[key];
    return v === null || (v >= min && v <= max) ? undefined : `Enter a number from ${min} to ${max}, or leave it empty.`;
  };
  const valid = (Object.keys(draft) as NumberKey[]).every((k) => !error(k));
  const age = error("age") ? null : value("age");
  const vo2max = error("vo2max") ? null : value("vo2max");

  function change(key: NumberKey, text: string) {
    setDraft({ ...draft, [key]: text.replace(/[^\d.]/g, "") });
    setState("idle");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setState("saving");
    const profile: RunnerProfile = { age: value("age"), sex, heightCm: value("heightCm"), weightKg: value("weightKg"), vo2max: value("vo2max") };
    setState((await saveRunnerProfile(profile)) ? "saved" : "failed");
  }

  return (
    <section className={adminStyles.section} aria-labelledby="profile-heading">
      <div className={adminStyles.headText}>
        <h2 id="profile-heading" className={adminStyles.h2}>
          Your profile
        </h2>
        <p className={adminStyles.muted}>
          All optional. Saved to your account and used automatically in every race plan and rehearsal: your estimated heart rate,
          your zones and the energy you use. Leave any field empty to skip it.
        </p>
      </div>
      <form className={adminStyles.form} onSubmit={submit} noValidate>
        <div className={planner.fieldRow}>
          <Input
            label="Age"
            inputMode="numeric"
            autoComplete="off"
            value={draft.age}
            onChange={(e) => change("age", e.target.value)}
            error={error("age")}
            description={`Estimates your max heart rate until you set your own zones below${age === null ? "." : `: about ${maxHrFromAge(age, sex)} bpm.`}`}
          />
          <div className={inputStyles.field}>
            <span className={inputStyles.label} aria-hidden="true">
              Sex
            </span>
            <SegmentedControl
              label="Sex"
              value={sex ?? ""}
              options={SEXES}
              onValueChange={(v) => {
                setSex(v === "female" || v === "male" ? v : null);
                setState("idle");
              }}
            />
            <span className={inputStyles.description}>Picks the max heart rate formula: Gulati&apos;s for women, Tanaka&apos;s otherwise.</span>
          </div>
        </div>
        <div className={planner.fieldRow}>
          <Input
            label="Height (cm)"
            inputMode="decimal"
            autoComplete="off"
            value={draft.heightCm}
            onChange={(e) => change("heightCm", e.target.value)}
            error={error("heightCm")}
            description="Saved with your profile. Nothing in the plan uses it yet."
          />
          <Input
            label="Weight (kg)"
            inputMode="decimal"
            autoComplete="off"
            value={draft.weightKg}
            onChange={(e) => change("weightKg", e.target.value)}
            error={error("weightKg")}
            description="Shows the energy you use as the rehearsal plays, about 1 kcal per kg per km."
          />
        </div>
        <Input
          label="VO2 max (ml/kg/min)"
          inputMode="decimal"
          autoComplete="off"
          value={draft.vo2max}
          onChange={(e) => change("vo2max", e.target.value)}
          error={error("vo2max")}
          description={`From your watch or a lab test. Sets how hard your goal pace is for you, which shapes your estimated heart rate, and your threshold pace unless you enter your own${
            vo2max === null ? "." : `: about ${formatPace(thresholdFromVo2max(vo2max))}/km.`
          }`}
        />
        <div className={planner.inlineActions}>
          <Button type="submit" loading={state === "saving"} disabled={!valid}>
            Save profile
          </Button>
        </div>
        <p className={adminStyles.muted} role="status">
          {state === "saved" ? "Saved. Your race plans use it now." : state === "failed" ? "Not saved. Try again in a moment." : ""}
        </p>
      </form>
    </section>
  );
}

/** The runner's heart rate zones, the same settings as a race plan's Zones tab. */
export function ZoneSettingsForm() {
  const { settings, preview, dirty, save, discard } = useZoneSettings();
  const profile = useRunnerProfile();
  const effective = withProfile(settings, profile);
  const [state, setState] = useState<SaveState>("idle");

  async function saveZones() {
    setState("saving");
    setState((await save()) ? "saved" : "failed");
  }

  return (
    <section id="heart-rate-zones" className={adminStyles.section} aria-labelledby="zones-heading">
      <div className={adminStyles.headText}>
        <h2 id="zones-heading" className={adminStyles.h2}>
          Heart rate zones
        </h2>
        <p className={adminStyles.muted}>
          Used for the zones and estimated heart rate in every race plan and rehearsal.
          {effective !== settings ? " Your max heart rate comes from your age until you change it here." : ""}
        </p>
      </div>
      <ul className={planner.zoneList}>
        {hrZones(effective.hr).map((z) => (
          <li key={z.zone} className={`${planner.zoneItem} ${planner[`zone${z.zone}`]}`}>
            <span className={planner.zoneChip} aria-hidden="true">
              Z{z.zone}
            </span>
            <span className={planner.zoneText}>
              <span className={planner.zoneName}>{z.name}</span>
              <span className={planner.zoneRange}>
                {z.min} to {z.max} bpm
              </span>
            </span>
          </li>
        ))}
      </ul>
      <HrZoneFields
        ageEstimate={false}
        hr={effective.hr}
        onChange={(hr) => {
          preview({ ...settings, hr });
          setState("idle");
        }}
      />
      <div className={planner.inlineActions}>
        {dirty ? (
          <Button variant="ghost" onClick={discard}>
            Discard
          </Button>
        ) : null}
        <Button onClick={saveZones} loading={state === "saving"} disabled={!dirty || outOfOrder(effective.hr)}>
          Save zones
        </Button>
      </div>
      <p className={adminStyles.muted} role="status">
        {dirty ? "Unsaved changes." : state === "saved" ? "Saved to your account." : state === "failed" ? "Saved in this browser, but not to your account. Try again." : ""}
      </p>
    </section>
  );
}
