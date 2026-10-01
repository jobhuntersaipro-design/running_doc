/** m:ss for a pace in seconds per km. */
export function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** h:mm:ss for a duration in seconds. */
export function formatClock(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Parses "1:59:30", "59:30" or a number of seconds. */
export function parseDuration(text: string): number {
  const parts = text.split(":").map(Number);
  if (parts.some((p) => Number.isNaN(p))) throw new Error(`Invalid duration: ${text}`);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}
