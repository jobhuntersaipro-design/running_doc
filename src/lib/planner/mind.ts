import type { Chapter, PlanEvent, Timeline } from "./types";
import { timeAt } from "./pacing";

/**
 * Adds what the runner will feel and a short mental cue to each event.
 * Knowing what is coming makes the hard parts feel expected, not alarming.
 */
export function addRunnerNotes(events: PlanEvent[]): PlanEvent[] {
  let drinks = 0;
  let gels = 0;
  return events.map((e) => {
    switch (e.type) {
      case "start":
        return { ...e, feel: "Crowded, loud and exciting. The first kilometre will feel far too easy.", cue: "Patience now, pace later." };
      case "uphill": {
        const top = e.hill ? ` near the top at ${Math.round(e.hill.peakEle)} m` : "";
        return {
          ...e,
          feel: `Breathing gets louder and your legs will burn${top}. Everyone around you slows down too.`,
          cue: "Short steps, tall posture, same effort.",
        };
      }
      case "downhill":
        return { ...e, feel: "Your legs speed up on their own. It is easy to overdo it here and pay for it later.", cue: "Light and quick, let it roll." };
      case "drink":
        drinks += 1;
        return drinks === 1
          ? { ...e, feel: "Tables get crowded and the road can be wet and slippery with cups.", cue: "Grab, pinch, sip, go." }
          : { ...e, cue: "Sip and go." };
      case "gel":
        gels += 1;
        return {
          ...e,
          feel: gels === 1 ? "You will not feel hungry yet. That is the point: fuel before you need it." : "Energy from a gel takes 10 to 15 minutes to arrive.",
          cue: "Fuel early, finish strong.",
        };
      case "cool":
        return { ...e, feel: "A cold burst that feels great. Shoes may get wet, so step through, not around.", cue: "Cool head, steady legs." };
      case "banana":
        return { ...e, cue: "Small bites only." };
      case "push":
        return { ...e, feel: "Legs are heavy and your mind starts bargaining. That is normal and it passes.", cue: "Run the next 100 metres. Then the next." };
      default:
        return e;
    }
  });
}

interface HillLike {
  kind: "uphill" | "downhill";
  startKm: number;
  endKm: number;
  change: number;
}

/**
 * Splits the race into a few parts with their own job: settle in, the hills,
 * cruise, dig deep and finish. Thinking in parts makes a long race smaller.
 */
export function buildChapters(totalKm: number, hills: HillLike[], timeline: Timeline): Chapter[] {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const settleEnd = r1(Math.min(3, totalKm * 0.15));
  const finishStart = r1(totalKm > 8 ? totalKm - 2 : totalKm - 1);
  const digStart = r1(Math.min(totalKm * 0.75, finishStart - 0.5));

  const ups = hills.filter((h) => h.kind === "uphill" && h.change >= 15 && h.startKm >= settleEnd - 1 && h.startKm < digStart);
  type Part = { title: string; startKm: number; endKm: number; expect: string; focus: string };
  const parts: Part[] = [
    {
      title: "Settle in",
      startKm: 0,
      endKm: settleEnd,
      expect: "Crowds, adrenaline and a pace that feels too easy.",
      focus: "Hold back. Relax your shoulders, find some space and check your pace once, not every 10 seconds.",
    },
  ];

  let cruiseFrom = settleEnd;
  if (ups.length) {
    let hillStart = Math.max(settleEnd, r1(Math.min(...ups.map((h) => h.startKm))));
    let hillEnd = Math.max(...ups.map((h) => h.endKm));
    // Include the descent straight after the last climb.
    const after = hills.find((h) => h.kind === "downhill" && h.startKm >= hillEnd - 0.1 && h.startKm - hillEnd < 0.6);
    if (after) hillEnd = after.endKm;
    hillEnd = r1(Math.min(hillEnd, digStart));
    if (hillStart - settleEnd < 1) hillStart = settleEnd;
    else {
      parts.push({
        title: "Find your rhythm",
        startKm: settleEnd,
        endKm: hillStart,
        expect: "The field spreads out and your breathing settles.",
        focus: "Lock into goal pace and run your own race, not the people around you.",
      });
    }
    const gain = Math.round(ups.reduce((sum, h) => sum + h.change, 0));
    parts.push({
      title: "The hills",
      startKm: hillStart,
      endKm: hillEnd,
      expect: `${ups.length} uphill${ups.length > 1 ? "s" : ""} adding up to +${gain} m. Pace drops and effort rises.`,
      focus: "Run by effort, not pace. Recover on the downhills instead of racing them.",
    });
    cruiseFrom = hillEnd;
  }
  if (digStart - cruiseFrom >= 0.8) {
    parts.push({
      title: "Cruise",
      startKm: cruiseFrom,
      endKm: digStart,
      expect: "The middle can feel long and your focus can drift.",
      focus: "Stay on pace, take every drink and gel as planned, and think one kilometre at a time.",
    });
  } else {
    parts[parts.length - 1].endKm = digStart;
  }
  parts.push({
    title: "Dig deep",
    startKm: digStart,
    endKm: finishStart,
    expect: "Legs get heavy and your mind starts bargaining. Everyone feels this here.",
    focus: "Count the kilometres down, repeat your cue and follow a runner just ahead.",
  });
  parts.push({
    title: "Finish",
    startKm: finishStart,
    endKm: totalKm,
    expect: "The crowd gets louder. The finish feels close before it really is.",
    focus: "Lift the effort bit by bit and save the sprint for the last 200 metres.",
  });

  return parts.map((p, index) => ({
    index,
    ...p,
    paceSecPerKm: (timeAt(timeline, p.endKm) - timeAt(timeline, p.startKm)) / (p.endKm - p.startKm),
  }));
}
