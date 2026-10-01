import type { PaceBlock, Split } from "./types";

/**
 * Groups consecutive kilometres whose target pace stays within `toleranceSec`
 * of the block's first kilometre. Typing 22 steps into a watch by hand is
 * error prone, so this gives a handful of blocks instead.
 */
export function buildPaceBlocks(splits: Split[], toleranceSec = 10): PaceBlock[] {
  const blocks: { start: number; end: number; anchor: number; splits: Split[] }[] = [];
  for (const s of splits) {
    const current = blocks[blocks.length - 1];
    if (current && Math.abs(s.paceSecPerKm - current.anchor) <= toleranceSec) {
      current.end = s.endKm;
      current.splits.push(s);
    } else {
      blocks.push({ start: s.startKm, end: s.endKm, anchor: s.paceSecPerKm, splits: [s] });
    }
  }
  // Fold a trailing fragment (the last 97.5 m of a half) into the block before it.
  const last = blocks[blocks.length - 1];
  if (blocks.length > 1 && last.end - last.start < 0.5) {
    const prev = blocks[blocks.length - 2];
    prev.end = last.end;
    prev.splits.push(...last.splits);
    blocks.pop();
  }
  return blocks.map((b) => {
    const seconds = b.splits.reduce((sum, s) => sum + s.splitSeconds, 0);
    const pace = seconds / (b.end - b.start);
    const tags = new Set(b.splits.map((s) => s.tag));
    const label = tags.has("hold") && b.start < 2 ? "Settle in" : tags.has("push") ? "Finish" : tags.has("hold") ? "Hills" : "Steady";
    return { startKm: b.start, endKm: b.end, paceSecPerKm: pace, label };
  });
}
