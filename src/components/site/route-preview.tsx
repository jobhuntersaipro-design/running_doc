/** A small drawing of a course, from a precomputed SVG path. No map tiles needed. */
export function RoutePreview({
  d,
  start,
  finish,
  width,
  height,
  className,
}: {
  d: string;
  start: [number, number];
  finish: [number, number];
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label="Course shape">
      <path d={d} fill="none" stroke="var(--surface)" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={start[0]} cy={start[1]} r={5} fill="var(--surface)" stroke="var(--foreground)" strokeWidth={2} />
      <circle cx={finish[0]} cy={finish[1]} r={3.5} fill="var(--foreground)" stroke="var(--surface)" strokeWidth={1.5} />
    </svg>
  );
}
