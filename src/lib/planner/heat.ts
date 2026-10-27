import { interpolate } from "./profile";

/** Dew point in °C from temperature and relative humidity (Magnus formula). */
export function dewPointC(tempC: number, humidity: number): number {
  const g = Math.log(Math.min(Math.max(humidity, 1), 100) / 100) + (17.62 * tempC) / (243.12 + tempC);
  return (243.12 * g) / (17.62 - g);
}

const fahrenheit = (c: number) => (c * 9) / 5 + 32;
// Temperature plus dew point in °F against how much slower to run, from Mark Hadley's widely used table
// (the top of each band: 101-110 is 0 to 0.5%, ..., 171-180 is 8 to 10%; above 180, do not race hard).
const SUM_F = [100, 110, 120, 130, 140, 150, 160, 170, 180];
const SLOWER = [0, 0.005, 0.01, 0.02, 0.03, 0.045, 0.06, 0.08, 0.1];

/** How much slower to aim in this heat and humidity, as a share of the goal (0.05 = 5% slower). */
export function heatSlowdown(tempC: number, humidity: number): { share: number; tooHot: boolean } {
  const sum = fahrenheit(tempC) + fahrenheit(dewPointC(tempC, humidity));
  return { share: interpolate(SUM_F, SLOWER, sum), tooHot: sum > 180 };
}

/** Hourly weather for one day, local times "YYYY-MM-DDTHH:mm" as Open-Meteo gives them. */
export interface HourlyWeather {
  time: string[];
  temperature: number[];
  humidity: number[];
}

/** Average temperature and humidity over the hours the race runs, from `startTime` ("HH:mm") for `seconds`. */
export function raceConditions(w: HourlyWeather, startTime: string, seconds: number): { temp: number; humidity: number } | null {
  const [h, m] = startTime.split(":").map(Number);
  const from = Math.floor(h + m / 60);
  const to = Math.min(23, Math.floor(h + m / 60 + seconds / 3600));
  const hours = w.time.map((t, i) => ({ hour: Number(t.slice(11, 13)), i })).filter((x) => x.hour >= from && x.hour <= to);
  const ok = hours.filter(({ i }) => Number.isFinite(w.temperature[i]) && Number.isFinite(w.humidity[i]));
  if (!ok.length) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return { temp: avg(ok.map(({ i }) => w.temperature[i])), humidity: avg(ok.map(({ i }) => w.humidity[i])) };
}
