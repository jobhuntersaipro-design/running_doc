/**
 * Average finish times from large public results datasets. They describe
 * typical finishers at big events, not any one race.
 */
export interface AgeGroupTimes {
  /** "30–39" */
  group: string;
  menSeconds: number;
  womenSeconds: number;
}

export interface FinishBenchmark {
  distance: string;
  km: number;
  menSeconds: number;
  womenSeconds: number;
  source: { name: string; url: string };
  /** Average finish time by age group for men and women, youngest first. */
  ages: AgeGroupTimes[];
  agesSource: { name: string; url: string };
}

/** "1:52:26" or "28:25" to seconds. */
function t(text: string): number {
  return text.split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
}

const ages = (rows: [string, string, string][]): AgeGroupTimes[] =>
  rows.map(([group, men, women]) => ({ group, menSeconds: t(men), womenSeconds: t(women) }));

const RUNBUNDLE = (path: string) => ({ name: "RunBundle", url: `https://runbundle.com/stats/average-race-times/${path}` });

export const FINISH_BENCHMARKS: FinishBenchmark[] = [
  {
    distance: "5K",
    km: 5,
    menSeconds: t("32:03"),
    womenSeconds: t("34:53"),
    source: RUNBUNDLE("5k"),
    ages: ages([
      ["15–19", "27:12", "29:14"],
      ["20–29", "28:25", "31:47"],
      ["30–39", "28:19", "32:28"],
      ["40–49", "28:55", "32:17"],
      ["50–59", "31:46", "34:11"],
      ["60–69", "35:41", "37:46"],
      ["70–79", "41:51", "44:15"],
    ]),
    agesSource: RUNBUNDLE("5k"),
  },
  {
    distance: "10K",
    km: 10,
    menSeconds: 58 * 60,
    womenSeconds: 66 * 60,
    source: { name: "Healthline", url: "https://www.healthline.com/health/exercise-fitness/average-10k-time" },
    ages: ages([
      ["16–19", "46:36", "1:00:21"],
      ["20–24", "51:40", "59:50"],
      ["25–29", "53:31", "1:02:25"],
      ["30–34", "54:21", "1:02:31"],
      ["35–39", "54:27", "1:02:19"],
      ["40–44", "53:31", "1:02:37"],
      ["45–49", "55:35", "1:03:27"],
      ["50–54", "56:27", "1:04:13"],
      ["55–59", "59:08", "1:07:50"],
      ["60–64", "58:56", "1:10:01"],
    ]),
    agesSource: { name: "RunRepeat, via Healthline", url: "https://www.healthline.com/health/exercise-fitness/average-10k-time" },
  },
  {
    distance: "half marathon",
    km: 21.0975,
    menSeconds: t("1:55:26"),
    womenSeconds: t("2:11:57"),
    source: { name: "RunRepeat, via Brooks Running", url: "https://www.brooksrunning.com/en_de/blog/advice-tips/average-half-marathon-time.html" },
    ages: ages([
      ["20–29", "1:52:26", "2:01:56"],
      ["30–39", "1:54:32", "2:06:24"],
      ["40–49", "1:56:16", "2:09:35"],
      ["50–59", "2:08:13", "2:17:30"],
      ["60–69", "2:25:01", "2:33:07"],
    ]),
    agesSource: RUNBUNDLE("half-marathon"),
  },
  {
    distance: "marathon",
    km: 42.195,
    menSeconds: 4 * 3600 + 14 * 60,
    womenSeconds: 4 * 3600 + 41 * 60,
    source: { name: "Running with Rock", url: "https://runningwithrock.com/average-marathon-time/" },
    ages: ages([
      ["15–19", "4:37:49", "4:42:06"],
      ["20–29", "3:59:57", "4:14:23"],
      ["30–39", "3:54:54", "4:18:31"],
      ["40–49", "4:03:20", "4:28:03"],
      ["50–59", "4:23:43", "4:46:51"],
      ["60–69", "5:01:51", "5:19:58"],
      ["70–79", "6:01:50", "6:12:41"],
    ]),
    agesSource: RUNBUNDLE("marathon"),
  },
];

/** The benchmark for a course within 8% of a standard distance, if any. */
export function benchmarkFor(km: number): FinishBenchmark | null {
  return FINISH_BENCHMARKS.find((b) => Math.abs(b.km - km) / b.km < 0.08) ?? null;
}
