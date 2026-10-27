"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { NumberField } from "@/components/arc/number-field/number-field";
import { dewPointC, formatClock, formatPace, heatSlowdown, raceConditions, type HourlyWeather } from "@/lib/planner";
import styles from "./planner.module.css";

type Source = { kind: "forecast" | "last-year"; weather: HourlyWeather; day: string };

/** Open-Meteo, free and keyless: the forecast reaches about 16 days ahead; past days come from its archive. */
async function hourly(lat: number, lon: number, day: string, archive: boolean, signal: AbortSignal): Promise<HourlyWeather | null> {
  const host = archive ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast";
  const q = new URLSearchParams({ latitude: lat.toFixed(3), longitude: lon.toFixed(3), hourly: "temperature_2m,relative_humidity_2m", timezone: "auto", start_date: day, end_date: day });
  // A hung request would leave the panel waiting; after 8 s the runner types the conditions in instead.
  const res = await fetch(`${host}?${q}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
  if (!res.ok) return null;
  const h = (await res.json()).hourly;
  return h ? { time: h.time, temperature: h.temperature_2m, humidity: h.relative_humidity_2m } : null;
}

/** The same day a year earlier; 29 February becomes the 28th. */
const yearBefore = (day: string) => `${Number(day.slice(0, 4)) - 1}${day.slice(4) === "-02-29" ? "-02-28" : day.slice(4)}`;

/**
 * Heat and humidity for the race hours and how much slower that makes a sensible goal.
 * Uses the forecast at the start line when race day is close, else last year's weather on the same day.
 */
export function HeatPanel({
  lat,
  lon,
  date,
  startTime,
  goalSeconds,
  km,
  onUseGoal,
}: {
  lat: number;
  lon: number;
  /** Race day, "YYYY-MM-DD"; without it only the runner's own numbers are used. */
  date?: string;
  startTime: string;
  goalSeconds: number;
  km: number;
  onUseGoal: (seconds: number) => void;
}) {
  const [source, setSource] = useState<Source | null | "loading">(date ? "loading" : null);
  const [own, setOwn] = useState<{ temp?: number; humidity?: number }>({});
  // The goal before the heat was added, so the panel does not add it twice.
  const [adjusted, setAdjusted] = useState<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (!date) return;
    const ctl = new AbortController();
    (async () => {
      const forecast = await hourly(lat, lon, date, false, ctl.signal).catch(() => null);
      if (forecast) return setSource({ kind: "forecast", weather: forecast, day: date });
      const day = yearBefore(date);
      const past = await hourly(lat, lon, day, true, ctl.signal).catch(() => null);
      setSource(past ? { kind: "last-year", weather: past, day } : null);
    })();
    return () => ctl.abort();
  }, [lat, lon, date]);

  const base = adjusted && adjusted.to === goalSeconds ? adjusted.from : goalSeconds;
  const fetched = source && source !== "loading" ? raceConditions(source.weather, startTime, base) : null;
  const temp = own.temp ?? fetched?.temp;
  const humidity = own.humidity ?? fetched?.humidity;
  const heat = temp !== undefined && humidity !== undefined ? heatSlowdown(temp, humidity) : null;
  const target = heat ? Math.round((base * (1 + heat.share)) / 5) * 5 : base;

  return (
    <div className={styles.heat}>
      <h3 className={styles.h3}>Heat and humidity</h3>
      <p className={styles.muted}>
        {source === "loading"
          ? "Checking the weather at the start line…"
          : source?.kind === "forecast"
            ? `Forecast for race hours from ${startTime}, at the start line. It updates as race day gets closer.`
            : source?.kind === "last-year"
              ? `The forecast opens about 16 days before race day. Until then, this is the weather on ${source.day}, the same day last year.`
              : date
                ? "The weather could not be loaded. Enter the conditions you expect."
                : "Enter the conditions you expect on race morning."}
      </p>
      <div className={styles.heatFields}>
        <NumberField
          label="Temperature"
          value={temp === undefined ? undefined : Math.round(temp)}
          min={0}
          max={45}
          step={1}
          suffix=" °C"
          onValueChange={(v) => setOwn({ ...own, temp: v })}
        />
        <NumberField
          label="Humidity"
          value={humidity === undefined ? undefined : Math.round(humidity)}
          min={5}
          max={100}
          step={1}
          suffix="%"
          onValueChange={(v) => setOwn({ ...own, humidity: v })}
        />
      </div>
      {heat && temp !== undefined && humidity !== undefined ? (
        <>
          <p className={styles.summary}>
            Dew point <span className={styles.num}>{Math.round(dewPointC(temp, humidity))} °C</span>.{" "}
            {heat.share < 0.0025 ? (
              "Cool enough: no need to slow down."
            ) : (
              <>
                Heat and humidity slow everyone down, so aim about <span className={styles.num}>{(heat.share * 100).toFixed(1)}%</span> slower:{" "}
                <span className={styles.num}>{formatClock(target)}</span> (<span className={styles.num}>{formatPace(target / km)}/km</span>).
              </>
            )}
          </p>
          {heat.tooHot ? (
            <Alert tone="warning" title="Too hot to race hard">
              Run for the finish, not a time. Start slower than you think, drink at every station and walk if you feel dizzy.
            </Alert>
          ) : null}
          {adjusted && adjusted.to === goalSeconds ? (
            <p className={styles.muted}>
              Your goal includes the heat, up from {formatClock(adjusted.from)}.{" "}
              <button type="button" className={styles.linkButton} onClick={() => (onUseGoal(adjusted.from), setAdjusted(null))}>
                Undo
              </button>
            </p>
          ) : heat.share >= 0.0025 ? (
            <div>
              <Button variant="secondary" size="sm" onClick={() => (setAdjusted({ from: goalSeconds, to: target }), onUseGoal(target))}>
                Use {formatClock(target)} as my goal
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
