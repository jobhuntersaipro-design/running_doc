import { Banana, Flag, Footprints, GlassWater, TrendingDown, TrendingUp, Waves, Zap, type LucideIcon } from "lucide-react";
import type { PlanEvent } from "@/lib/planner";
import styles from "./planner.module.css";

const ICONS: Record<PlanEvent["type"], LucideIcon> = {
  start: Footprints,
  uphill: TrendingUp,
  downhill: TrendingDown,
  drink: GlassWater,
  gel: Zap,
  cool: Waves,
  banana: Banana,
  push: Flag,
};

/**
 * An icon for an event with a small looping motion that shows what happens
 * there: a cup tipping with drops, a gel's energy pulse, a climb arrow. Motion
 * stops for people who prefer reduced motion.
 */
export function EventIcon({ type, size = 24, pin = false, active = true }: { type: PlanEvent["type"]; size?: number; pin?: boolean; active?: boolean }) {
  const Icon = ICONS[type];
  const classes = [styles.eventIcon, styles[`event_${type}`], pin ? styles.eventPin : "", active ? styles.eventActive : ""].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-hidden="true">
      {pin ? <span className={styles.eventRipple} /> : null}
      <Icon size={size} strokeWidth={1.75} className={styles.eventGlyph} />
      {type === "drink" || type === "cool" ? (
        <span className={styles.drops}>
          <span />
          <span />
          <span />
        </span>
      ) : null}
    </span>
  );
}
