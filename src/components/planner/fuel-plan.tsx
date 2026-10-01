import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { formatClock, type Plan, type PlanEvent } from "@/lib/planner";
import { clockAt } from "./util";
import styles from "./planner.module.css";

const FUEL_TYPES: PlanEvent["type"][] = ["gel", "drink", "cool", "banana"];
const LABEL: Partial<Record<PlanEvent["type"], string>> = { gel: "Gel", drink: "Drink", cool: "Cool", banana: "Optional" };

export function FuelPlan({ plan, startTime, approximate }: { plan: Plan; startTime: string; approximate: boolean }) {
  const events = plan.events.filter((e) => FUEL_TYPES.includes(e.type));
  const gels = events.filter((e) => e.type === "gel");

  return (
    <div className={styles.panel}>
      <div className={styles.fuelIntro}>
        <p>
          {gels.length
            ? `Carry ${gels.length} gel${gels.length > 1 ? "s" : ""} (plus one spare) for about ${formatClock(plan.summary.goalSeconds)} of running. `
            : "At this pace you finish before a gel makes much difference, so water is enough. "}
          For races over about 75 minutes, most runners do well on 30 to 60 g of carbohydrate per hour. A typical gel has 20
          to 25 g.
        </p>
        <ul className={styles.tips}>
          <li>Use the same gel brand in training first. Race day is the wrong time to find out it upsets your stomach.</li>
          <li>Take each gel just before a water station, then drink a few sips. Gels with no water sit badly.</li>
          <li>In heat and humidity, drink at most stations but only to thirst. Pour water over your head to cool down.</li>
        </ul>
      </div>

      {approximate ? (
        <Alert tone="warning" title="Station positions are estimates">
          They were read from the route map. Check them against the official race guide before race day.
        </Alert>
      ) : null}

      {events.length ? (
        <ol className={styles.fuelList}>
          {events.map((e) => (
            <li key={`${e.type}-${e.km}`} className={styles.fuelRow}>
              <div className={styles.fuelWhere}>
                <span className={styles.num}>Km {e.km.toFixed(1)}</span>
                <span className={`${styles.muted} ${styles.num}`}>
                  {formatClock(e.elapsedSeconds)}, {clockAt(startTime, e.elapsedSeconds)}
                </span>
              </div>
              <div className={styles.fuelWhat}>
                <div className={styles.fuelTitle}>
                  <span>{e.title}</span>
                  <Badge size="sm" tone={e.type === "gel" ? "info" : "neutral"}>{LABEL[e.type]}</Badge>
                </div>
                <p className={styles.muted}>{e.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.muted}>No aid stations on this course yet. Add them under Course to plan your drinks.</p>
      )}
    </div>
  );
}
