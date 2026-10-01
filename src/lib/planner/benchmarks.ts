/**
 * Average finish times from large public results datasets. They describe
 * typical finishers at big events, not any one race.
 */
export interface FinishBenchmark {
  distance: string;
  km: number;
  menSeconds: number;
  womenSeconds: number;
  source: { name: string; url: string };
}

export const FINISH_BENCHMARKS: FinishBenchmark[] = [
  {
    distance: "10K",
    km: 10,
    menSeconds: 58 * 60,
    womenSeconds: 66 * 60,
    source: { name: "Healthline", url: "https://www.healthline.com/health/exercise-fitness/average-10k-time" },
  },
  {
    distance: "half marathon",
    km: 21.0975,
    menSeconds: 1 * 3600 + 55 * 60 + 26,
    womenSeconds: 2 * 3600 + 11 * 60 + 57,
    source: { name: "RunRepeat, via Brooks Running", url: "https://www.brooksrunning.com/en_de/blog/advice-tips/average-half-marathon-time.html" },
  },
  {
    distance: "marathon",
    km: 42.195,
    menSeconds: 4 * 3600 + 14 * 60,
    womenSeconds: 4 * 3600 + 41 * 60,
    source: { name: "Running with Rock", url: "https://runningwithrock.com/average-marathon-time/" },
  },
];

/** The benchmark for a course within 8% of a standard distance, if any. */
export function benchmarkFor(km: number): FinishBenchmark | null {
  return FINISH_BENCHMARKS.find((b) => Math.abs(b.km - km) / b.km < 0.08) ?? null;
}
