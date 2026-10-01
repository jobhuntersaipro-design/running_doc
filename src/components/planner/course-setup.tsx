"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { FileDropzone } from "@/components/arc/file-dropzone/file-dropzone";
import { NumberField } from "@/components/arc/number-field/number-field";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import type { CourseInput } from "@/lib/courses/types";
import { haversineM, parseGpx, type Station, type StationKind } from "@/lib/planner";
import styles from "./planner.module.css";

const DISTANCES = [
  { value: "10k", label: "10K", km: 10 },
  { value: "half", label: "Half", km: 21.0975 },
  { value: "full", label: "Full", km: 42.195 },
  { value: "measured", label: "As measured", km: 0 },
];

const KIND_OPTIONS: { value: StationKind; label: string }[] = [
  { value: "water", label: "Water" },
  { value: "isotonic", label: "Isotonic" },
  { value: "gel", label: "Gel" },
  { value: "splash", label: "Splash" },
];

interface Loaded {
  name: string;
  gpx: string;
  measuredKm: number;
}

function guessDistance(measuredKm: number): string {
  const near = DISTANCES.filter((d) => d.km > 0).find((d) => Math.abs(d.km - measuredKm) / d.km < 0.08);
  return near?.value ?? "measured";
}

export function CourseSetup({
  course,
  onCourseChange,
}: {
  course: CourseInput | null;
  onCourseChange: (course: CourseInput | null) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [distance, setDistance] = useState("half");
  const [stations, setStations] = useState<Station[]>(course?.stations ?? []);
  const [error, setError] = useState<string | null>(null);

  function publish(next: { loaded?: Loaded | null; distance?: string; stations?: Station[] }) {
    const l = next.loaded === undefined ? loaded : next.loaded;
    const d = next.distance ?? distance;
    const s = next.stations ?? stations;
    if (!l) return onCourseChange(null);
    const km = DISTANCES.find((x) => x.value === d)?.km || Math.round(l.measuredKm * 100) / 100;
    onCourseChange({
      id: "upload",
      name: l.name,
      officialKm: km,
      gpx: l.gpx,
      stations: s.filter((x) => x.km > 0 && x.km < km && x.kinds.length).sort((a, b) => a.km - b.km),
    });
  }

  async function readFile(files: File[]) {
    const file = files[0];
    if (!file) {
      setLoaded(null);
      setError(null);
      return publish({ loaded: null });
    }
    try {
      const gpx = await file.text();
      const points = parseGpx(gpx);
      let m = 0;
      for (let i = 1; i < points.length; i++) m += haversineM(points[i - 1], points[i]);
      const next = { name: file.name.replace(/\.gpx$/i, ""), gpx, measuredKm: m / 1000 };
      const d = guessDistance(next.measuredKm);
      setLoaded(next);
      setDistance(d);
      setError(null);
      publish({ loaded: next, distance: d });
    } catch (e) {
      setLoaded(null);
      setError(e instanceof Error ? e.message : "This file could not be read.");
      publish({ loaded: null });
    }
  }

  function updateStations(next: Station[]) {
    setStations(next);
    publish({ stations: next });
  }

  function fillEvery(stepKm: number) {
    const km = DISTANCES.find((x) => x.value === distance)?.km || loaded?.measuredKm || 21;
    const next: Station[] = [];
    for (let k = stepKm; k < km - 0.5; k += stepKm) next.push({ km: Math.round(k * 10) / 10, kinds: ["water"] });
    updateStations(next);
  }

  return (
    <div className={styles.setup}>
      <FileDropzone
        label="Course GPX"
        description="Drop the race GPX here or choose it from your device"
        accept=".gpx,application/gpx+xml"
        multiple={false}
        maxFiles={1}
        maxSize={10 * 1024 * 1024}
        onFilesChange={readFile}
      />
      {error ? (
        <Alert tone="danger" title="This GPX could not be used">
          {error}. Export the course again as a GPX track with elevation, then add it here.
        </Alert>
      ) : null}

      {loaded ? (
        <>
          <div className={styles.setupRow}>
            <SegmentedControl
              label="Race distance"
              value={distance}
              onValueChange={(d) => {
                setDistance(d);
                publish({ distance: d });
              }}
              options={DISTANCES.map((d) => ({ value: d.value, label: d.label }))}
            />
            <p className={styles.muted}>
              The GPX measures <span className={styles.num}>{loaded.measuredKm.toFixed(2)} km</span>. It is stretched to the
              official distance so splits match the race markers.
            </p>
          </div>

          <div className={styles.stations}>
            <div className={styles.sectionHead}>
              <h3 className={styles.h3}>Aid stations</h3>
              <div className={styles.inlineActions}>
                <Button variant="ghost" size="sm" onClick={() => fillEvery(2.5)}>
                  Fill every 2.5 km
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => updateStations([...stations, { km: (stations.at(-1)?.km ?? 0) + 2.5, kinds: ["water"] }])}
                >
                  <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                  Add station
                </Button>
              </div>
            </div>
            {stations.length === 0 ? (
              <p className={styles.muted}>
                Add the stations from your race guide so gels line up with water. Without them, the plan assumes you carry
                everything.
              </p>
            ) : (
              <ul className={styles.stationList}>
                {stations.map((s, i) => (
                  <li key={i} className={styles.stationRow}>
                    <NumberField
                      label="Km"
                      value={s.km}
                      min={0.1}
                      max={60}
                      step={0.1}
                      formatOptions={{ maximumFractionDigits: 1 }}
                      onValueChange={(v) => updateStations(stations.map((x, j) => (j === i ? { ...x, km: v } : x)))}
                    />
                    <ChipGroup
                      label={`What station ${i + 1} has`}
                      options={KIND_OPTIONS}
                      value={s.kinds.filter((k) => KIND_OPTIONS.some((o) => o.value === k))}
                      onValueChange={(v) =>
                        updateStations(stations.map((x, j) => (j === i ? { ...x, kinds: v as StationKind[] } : x)))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove station at km ${s.km}`}
                      onClick={() => updateStations(stations.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
