// Prints the example plan: npm run plan -- 1:59:00
import { readFileSync } from "node:fs";
import { klscm2026Hm as course } from "../src/lib/courses/klscm-2026-hm";
import { buildPlan, formatClock, formatPace, parseDuration } from "../src/lib/planner";

const goal = parseDuration(process.argv[2] ?? "1:59:00");
const plan = buildPlan({
  name: course.name,
  gpx: readFileSync(course.gpxPath, "utf8"),
  officialKm: course.officialKm,
  goalSeconds: goal,
  stations: course.stations,
});

console.log(`${plan.name}, goal ${formatClock(goal)} (${formatPace(plan.summary.goalPaceSecPerKm)}/km)`);
console.log(`Ascent ${Math.round(plan.summary.totalGain)} m, descent ${Math.round(plan.summary.totalLoss)} m`);
console.log(`Halves ${formatClock(plan.summary.firstHalfSeconds)} / ${formatClock(plan.summary.secondHalfSeconds)}\n`);
console.log("Segments");
for (const s of plan.segments) {
  console.log(`  ${s.kind.padEnd(7)} km ${s.startKm.toFixed(1)}-${s.endKm.toFixed(1)}  ${s.avgGrade.toFixed(1)}%  +${s.gain.toFixed(0)}/-${s.loss.toFixed(0)} m`);
}
console.log("\nSplits");
for (const s of plan.splits) {
  const ev = s.events.map((e) => e.title).join("; ");
  console.log(`  ${String(s.km).padStart(2)}  ${formatPace(s.paceSecPerKm)}  ${formatClock(s.cumulativeSeconds)}  ${s.avgGrade.toFixed(1).padStart(5)}%  ${s.tag.padEnd(7)} ${ev}`);
}
