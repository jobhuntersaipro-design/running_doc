import { formatPace, timeAt, type Plan } from "@/lib/planner";
import { EventIcon } from "./event-icon";
import { clockAt } from "./util";
import styles from "./planner.module.css";

/** "0:45" or "1:32": time into the race, to the minute. */
function elapsed(seconds: number): string {
  const m = Math.round(seconds / 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

interface Item {
  km: number;
  title: string;
  detail: string;
  seconds: number;
}

/**
 * The race on one screen: every hill, gel and drink with its km, the time into
 * the race and the clock time, so the runner can learn the plan by heart.
 * Choosing an item moves the rehearsal there.
 */
export function RaceStrategy({ plan, startTime, onPick }: { plan: Plan; startTime: string; onPick: (km: number) => void }) {
  const uphills = plan.hills.filter((h) => h.kind === "uphill");
  const downhills = plan.hills.filter((h) => h.kind === "downhill");
  const gels = plan.events.filter((e) => e.type === "gel");
  const drinks = plan.events.filter((e) => e.type === "drink");

  const columns: { type: "uphill" | "gel" | "drink"; title: string; count: string; empty: string; items: Item[] }[] = [
    {
      type: "uphill",
      title: "Hills",
      count: `${plural(uphills.length, "uphill")}, ${plural(downhills.length, "downhill")}`,
      empty: "No real uphills. Hold an even pace the whole way.",
      items: uphills.map((h) => ({
        km: h.startKm,
        title: `Km ${h.startKm.toFixed(1)} to ${h.endKm.toFixed(1)}`,
        detail: `+${Math.round(h.change)} m at ${Math.abs(h.avgGrade).toFixed(1)}%, ease to ${formatPace(h.paceSecPerKm)}/km`,
        seconds: timeAt(plan.timeline, h.startKm),
      })),
    },
    {
      type: "gel",
      title: "Gels",
      count: plural(gels.length, "gel"),
      empty: "No gel needed at this pace. Drink at the stations.",
      items: gels.map((e) => ({ km: e.km, title: e.title, detail: `Km ${e.km.toFixed(1)}`, seconds: e.elapsedSeconds })),
    },
    {
      type: "drink",
      title: "Drinks",
      count: plural(drinks.length, "drink stop"),
      empty: "No stations added. Carry your own drink.",
      items: drinks.map((e) => ({
        km: e.km,
        title: `Km ${e.km.toFixed(1)}`,
        detail: e.title.replace(/ station$/, ""),
        seconds: e.elapsedSeconds,
      })),
    },
  ];

  return (
    <section className={styles.strategy} aria-labelledby="strategy-heading">
      <h3 id="strategy-heading" className={styles.h3}>
        Race strategy
      </h3>
      <div className={styles.strategyGrid}>
        {columns.map((c) => (
          <div key={c.type} className={styles.strategyCol}>
            <div className={styles.strategyHead}>
              <EventIcon type={c.type} size={28} active={false} />
              <span>
                <span className={styles.strategyTitle}>{c.title}</span>
                <span className={styles.strategyCount}>{c.count}</span>
              </span>
            </div>
            {c.items.length ? (
              <ol className={styles.strategyList}>
                {c.items.map((it) => (
                  <li key={`${it.title}-${it.km}`}>
                    <button type="button" className={styles.strategyItem} onClick={() => onPick(it.km)}>
                      <span className={styles.strategyWhen}>
                        <span className={styles.num}>{elapsed(it.seconds)}</span>
                        <span className={styles.strategyClock}>{clockAt(startTime, it.seconds)}</span>
                      </span>
                      <span className={styles.strategyWhat}>
                        <span className={styles.strategyItemTitle}>{it.title}</span>
                        <span className={styles.strategyDetail}>{it.detail}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.muted}>{c.empty}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
