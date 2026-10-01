import { HR_ZONE_NAMES, PACE_ZONE_NAMES, ZONES } from "@/lib/planner";
import type { ColorBy } from "./zone-style";
import styles from "./planner.module.css";

/** Legend items for the route colours; shared with the elevation chart. */
export function RouteLegend({ colorBy }: { colorBy: ColorBy }) {
  if (colorBy === "hills") {
    return (
      <>
        <li><span className={styles.swatchClimb} aria-hidden="true" />Uphill</li>
        <li><span className={styles.swatchDescent} aria-hidden="true" />Downhill</li>
        <li><span className={styles.swatchFlat} aria-hidden="true" />Flat</li>
      </>
    );
  }
  const names = colorBy === "pace" ? PACE_ZONE_NAMES : HR_ZONE_NAMES;
  return (
    <>
      {ZONES.map((z) => (
        <li key={z}>
          <span className={`${styles.swatchZone} ${styles[`zone${z}`]}`} aria-hidden="true" />
          Z{z} {names[z - 1].toLowerCase()}
        </li>
      ))}
    </>
  );
}
