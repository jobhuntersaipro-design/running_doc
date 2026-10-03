"use client";

import { startTransition, useActionState, useEffect, useMemo, useState, type FormEvent } from "react";
import { FileText, Plus, Route, Trash2 } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { FileDropzone } from "@/components/arc/file-dropzone/file-dropzone";
import { Input } from "@/components/arc/input/input";
import { NumberField } from "@/components/arc/number-field/number-field";
import { RadioGroup } from "@/components/arc/radio-group/radio-group";
import { saveRace } from "@/app/admin/actions";
import { DISTANCES, LIMITS, STATION_KINDS, formatMb, type DistanceValue, type FormState } from "@/app/admin/shared";
import { COUNTRIES, findCountry, splitLocation } from "@/lib/countries";
import { haversineM, parseGpx, type Station, type StationKind } from "@/lib/planner";
import type { StoredRace } from "@/lib/server/races";
import styles from "./admin.module.css";

function guessDistance(km: number): DistanceValue {
  const near = DISTANCES.filter((d) => d.km > 0).find((d) => Math.abs(d.km - km) / d.km < 0.08);
  return near?.value ?? "custom";
}

/** Shows a local image file, freeing the object URL when it changes. */
function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return url;
}

export function RaceForm({ race, events = [] }: { race: StoredRace | null; /** Event names already in use, suggested so distances group under one event. */ events?: string[] }) {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(saveRace, {});
  const [distance, setDistance] = useState<DistanceValue>(race?.distance ?? "half");
  const [customKm, setCustomKm] = useState(race?.distance === "custom" ? String(race.officialKm) : "");
  const [stations, setStations] = useState<Station[]>(race?.stations ?? []);
  const [approximate, setApproximate] = useState(race?.stationsApproximate ?? false);
  const [gpx, setGpx] = useState<File | null>(null);
  const [gpxInfo, setGpxInfo] = useState<{ km: number; picked: DistanceValue } | { error: string } | null>(null);
  const [place] = useState(() => (race ? { country: race.country ?? "", city: race.city ?? "", ...(race.country ? {} : splitLocation(race.location)) } : null));
  const [country, setCountry] = useState(() => (place?.country ? (findCountry(place.country)?.name ?? "") : ""));
  const [pdf, setPdf] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [removePdf, setRemovePdf] = useState(false);
  const coverPreview = useObjectUrl(cover);
  const fe = state.fieldErrors ?? {};

  const km = DISTANCES.find((d) => d.value === distance)?.km || Number(customKm) || 0;
  const total = (gpx?.size ?? 0) + (pdf?.size ?? 0) + (cover?.size ?? 0);
  const tooBig = total > LIMITS.total;

  async function pickGpx(files: File[]) {
    const f = files[0] ?? null;
    setGpx(f);
    if (!f) return setGpxInfo(null);
    try {
      const points = parseGpx(await f.text());
      let m = 0;
      for (let i = 1; i < points.length; i++) m += haversineM(points[i - 1], points[i]);
      const measured = m / 1000;
      const picked = guessDistance(measured);
      setGpxInfo({ km: measured, picked });
      setDistance(picked);
      if (picked === "custom") setCustomKm(measured.toFixed(2));
    } catch (e) {
      setGpxInfo({ error: e instanceof Error ? e.message : "This file could not be read" });
    }
  }

  function fillEvery(stepKm: number) {
    const next: Station[] = [];
    for (let k = stepKm; k < (km || 21) - 0.5; k += stepKm) next.push({ km: Math.round(k * 10) / 10, kinds: ["water"] });
    setStations(next);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (race) fd.set("id", race.id);
    fd.set("distance", distance);
    // Send the code when the name matches, so the server need not spell country names the way this browser does.
    fd.set("country", findCountry(country)?.code ?? country);
    fd.set("customKm", customKm);
    fd.set("stations", JSON.stringify(stations));
    if (approximate) fd.set("stationsApproximate", "on");
    if (gpx) fd.set("gpx", gpx);
    if (pdf) fd.set("pdf", pdf);
    if (cover) fd.set("cover", cover);
    if (removeCover) fd.set("removeCover", "on");
    if (removePdf) fd.set("removePdf", "on");
    startTransition(() => dispatch(fd));
  }

  return (
    <form className={styles.raceForm} onSubmit={submit} noValidate>
      <div className={styles.headText}>
        <h1 className={styles.title}>{race ? `Edit ${race.event}` : "New race"}</h1>
        <p className={styles.lede}>
          These details show on the race card and at the top of the race plan. Files go on the card as downloads.
        </p>
      </div>

      <fieldset className={styles.section}>
        <legend className={styles.h2}>Race details</legend>
        <Input
          label="Event name"
          name="event"
          defaultValue={race?.event}
          placeholder="Standard Chartered KL Marathon 2026"
          description="Use the same event name for each distance (5K, 10K, half, full) so they share one card with a tab per distance."
          list="event-names"
          autoComplete="off"
          error={fe.event}
          required
        />
        <datalist id="event-names">
          {events.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
        <Input
          label="Category"
          name="category"
          defaultValue={race?.category}
          placeholder="Half marathon"
          description="The race within the event, as the organiser names it."
          error={fe.category}
          required
        />
        <div className={styles.fieldRow}>
          <Input label="Race date" name="date" type="date" defaultValue={race?.date} error={fe.date} required />
          <Input label="Start time" name="startTime" type="time" defaultValue={race?.startTime} description="Optional, local time." error={fe.startTime} />
          <Input
            label="Bib number"
            name="bib"
            defaultValue={race?.bib}
            placeholder="21034"
            description="Optional. Only you see it."
            maxLength={12}
            autoComplete="off"
            error={fe.bib}
          />
        </div>
        <div className={styles.fieldRow}>
          <Input
            label="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Malaysia"
            description="Type to search the list."
            list="countries"
            autoComplete="off"
            error={fe.country}
            required
          />
          <datalist id="countries">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.name} />
            ))}
          </datalist>
          <Input label="City" name="city" defaultValue={place?.city} placeholder="Kuala Lumpur" autoComplete="address-level2" error={fe.city} required />
        </div>
        <Input
          label="Official website"
          name="officialUrl"
          type="url"
          inputMode="url"
          defaultValue={race?.officialUrl}
          placeholder="https://www.kl-marathon.com"
          error={fe.officialUrl}
          required
        />
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.h2}>Course</legend>
        <div className={styles.fileField}>
          <FileDropzone
            label={race ? "Replace course GPX" : "Course GPX"}
            description="The route as a GPX track with elevation"
            accept=".gpx,application/gpx+xml"
            multiple={false}
            maxFiles={1}
            maxSize={LIMITS.gpx}
            note={`Up to ${formatMb(LIMITS.gpx)}`}
            onFilesChange={pickGpx}
          />
          {race && !gpx ? (
            <a className={styles.current} href={race.gpxUrl} download>
              <Route size={16} strokeWidth={1.75} aria-hidden="true" />
              Current GPX
            </a>
          ) : null}
          {gpxInfo && "error" in gpxInfo ? (
            <Alert tone="danger" title="This GPX could not be used">
              {gpxInfo.error}. Export the course again as a GPX track with elevation.
            </Alert>
          ) : null}
          {fe.gpx ? <p className={styles.fieldError}>{fe.gpx}</p> : null}
        </div>

        <RadioGroup
          label="Official distance"
          name="distance-choice"
          value={distance}
          onValueChange={(v) => setDistance(v as DistanceValue)}
          options={DISTANCES.map((d) => ({ value: d.value, label: d.label, description: d.km ? `${d.km} km` : "Enter the distance" }))}
        />
        <p className={styles.muted} role="status">
          {gpxInfo && "km" in gpxInfo ? (
            <>
              Your GPX measures <span className={styles.num}>{gpxInfo.km.toFixed(2)} km</span>, so we picked{" "}
              {DISTANCES.find((d) => d.value === gpxInfo.picked)?.label}. Change it if the organiser&apos;s
              distance is different. The plan stretches the course to the official distance, so splits match the km markers.
            </>
          ) : (
            "Picked for you from the course GPX when you add it. Change it if the organiser's distance is different."
          )}
        </p>
        {distance === "custom" ? (
          <Input
            label="Distance in km"
            value={customKm}
            onChange={(e) => setCustomKm(e.target.value)}
            inputMode="decimal"
            placeholder="15"
            error={fe.customKm}
          />
        ) : null}
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.h2}>Aid stations</legend>
        <p className={styles.muted}>
          Add the stations from the race guide so gels line up with water. Without them, the plan assumes runners carry everything.
        </p>
        <div className={styles.inlineActions}>
          <Button type="button" variant="ghost" size="sm" onClick={() => fillEvery(2.5)}>
            Fill every 2.5 km
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setStations([...stations, { km: Math.round(((stations.at(-1)?.km ?? 0) + 2.5) * 10) / 10, kinds: ["water"] }])}
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            Add station
          </Button>
        </div>
        {stations.length ? (
          <ul className={styles.stationList}>
            {stations.map((s, i) => (
              <li key={i} className={styles.stationRow}>
                <NumberField
                  label="Km"
                  value={s.km}
                  min={0.1}
                  max={250}
                  step={0.1}
                  formatOptions={{ maximumFractionDigits: 2 }}
                  onValueChange={(v) => setStations(stations.map((x, j) => (j === i ? { ...x, km: v } : x)))}
                />
                <ChipGroup
                  label={`What station ${i + 1} has`}
                  options={STATION_KINDS}
                  value={s.kinds.filter((k) => STATION_KINDS.some((o) => o.value === k))}
                  onValueChange={(v) => setStations(stations.map((x, j) => (j === i ? { ...x, kinds: v as StationKind[] } : x)))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove station at km ${s.km}`}
                  onClick={() => setStations(stations.filter((_, j) => j !== i))}
                >
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <Checkbox
          label="Station distances are estimates"
          description="Shows a note in the plan to check them against the official guide."
          checked={approximate}
          onCheckedChange={(v) => setApproximate(v === true)}
        />
        {fe.stations ? <p className={styles.fieldError}>{fe.stations}</p> : null}
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.h2}>Card cover and files</legend>
        <div className={styles.coverGrid}>
          <div className={styles.coverPreview} aria-label="Cover preview">
            {coverPreview || (race?.coverUrl && !removeCover) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview ?? race?.coverUrl} alt="" />
            ) : (
              <span className={styles.muted}>No cover. The card shows the route map instead.</span>
            )}
          </div>
          <div className={styles.fileField}>
            <FileDropzone
              label={race?.coverUrl ? "Replace cover image" : "Cover image"}
              description="Shown at the top of the race card. A wide photo works best (16:9)."
              accept="image/jpeg,image/png,image/webp"
              multiple={false}
              maxFiles={1}
              maxSize={LIMITS.cover}
              note={`JPG, PNG or WebP, up to ${formatMb(LIMITS.cover)}`}
              onFilesChange={(f) => setCover(f[0] ?? null)}
            />
            {race?.coverUrl && !cover ? (
              <Checkbox label="Remove the current cover" checked={removeCover} onCheckedChange={(v) => setRemoveCover(v === true)} />
            ) : null}
            {fe.cover ? <p className={styles.fieldError}>{fe.cover}</p> : null}
          </div>
        </div>

        <div className={styles.fileField}>
          <FileDropzone
            label={race?.pdfUrl ? "Replace route map" : "Official route map"}
            description="Optional. The organiser's route map or race guide as a PDF."
            accept="application/pdf,.pdf"
            multiple={false}
            maxFiles={1}
            maxSize={LIMITS.pdf}
            note={`PDF, up to ${formatMb(LIMITS.pdf)}`}
            onFilesChange={(f) => setPdf(f[0] ?? null)}
          />
          {race?.pdfUrl && !pdf ? (
            <div className={styles.inlineActions}>
              <a className={styles.current} href={race.pdfUrl} target="_blank" rel="noreferrer">
                <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
                Current route map
              </a>
              <Checkbox label="Remove it" checked={removePdf} onCheckedChange={(v) => setRemovePdf(v === true)} />
            </div>
          ) : null}
          {fe.pdf ? <p className={styles.fieldError}>{fe.pdf}</p> : null}
        </div>
        {tooBig ? (
          <Alert tone="warning" title="These files are too large together">
            They add up to {formatMb(total)}. Keep the GPX, map and cover under {formatMb(LIMITS.total)} in total.
          </Alert>
        ) : null}
      </fieldset>

      {state.error ? (
        <Alert tone="danger" title="The race was not saved">
          {state.error}
        </Alert>
      ) : null}
      <div className={styles.formActions}>
        <Button type="submit" loading={pending} disabled={tooBig}>
          {race ? "Save changes" : "Add race"}
        </Button>
      </div>
    </form>
  );
}
