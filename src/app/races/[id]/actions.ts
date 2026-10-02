"use server";

import { revalidatePath } from "next/cache";
import { getRace } from "@/lib/courses";
import { isSavedGoal, type SavedGoal } from "@/lib/planner";
import { getUser } from "@/lib/server/auth";
import { canSee, getStoredRace } from "@/lib/server/races";
import { saveGoal as storeGoal } from "@/lib/server/runners";

/** Saves the signed-in runner's goal and start time for a race they can see. */
export async function saveGoal(raceId: string, goalSeconds: number, startTime: string): Promise<{ saved?: SavedGoal; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Sign in to save your goal." };
  const goal: SavedGoal = { goalSeconds, startTime, savedAt: new Date().toISOString() };
  const stored = getRace(raceId) ? null : await getStoredRace(raceId).catch(() => null);
  if (!isSavedGoal(goal) || !(getRace(raceId) || (stored && canSee(stored, user)))) return { error: "That goal could not be saved." };
  const ok = await storeGoal(user.email, user.name, raceId, goal).catch((e) => {
    console.error("Saving goal failed:", e);
    return null;
  });
  if (ok === null) return { error: "Your goal could not be saved. Try again in a moment." };
  if (!ok) return { error: "Saving goals is not set up yet." };
  revalidatePath("/my");
  return { saved: goal };
}
