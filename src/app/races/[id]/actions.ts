"use server";

import { revalidatePath } from "next/cache";
import { getRace } from "@/lib/courses";
import { isSavedGoal, type SavedGoal } from "@/lib/planner";
import { MAX_COMMENT, REACTIONS, type Reaction } from "@/lib/comments";
import { getUser, type SessionUser } from "@/lib/server/auth";
import { addComment, deleteComment, toggleReaction } from "@/lib/server/comments";
import { canSee, getStoredRace } from "@/lib/server/races";
import { saveGoal as storeGoal } from "@/lib/server/runners";

/** Built-in races are public; stored ones follow canSee. */
async function canSeeRace(raceId: string, user: SessionUser): Promise<boolean> {
  if (getRace(raceId)) return true;
  const stored = await getStoredRace(raceId).catch(() => null);
  return Boolean(stored && canSee(stored, user));
}

/** Saves the signed-in runner's goal and start time for a race they can see. */
export async function saveGoal(raceId: string, goalSeconds: number, startTime: string): Promise<{ saved?: SavedGoal; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Sign in to save your goal." };
  const goal: SavedGoal = { goalSeconds, startTime, savedAt: new Date().toISOString() };
  if (!isSavedGoal(goal) || !(await canSeeRace(raceId, user))) return { error: "That goal could not be saved." };
  const ok = await storeGoal(user.email, user.name, raceId, goal).catch((e) => {
    console.error("Saving goal failed:", e);
    return null;
  });
  if (ok === null) return { error: "Your goal could not be saved. Try again in a moment." };
  if (!ok) return { error: "Saving goals is not set up yet." };
  revalidatePath("/my");
  return { saved: goal };
}

export type CommentState = { error?: string; posted?: number };

/** Posts a comment from the signed-in runner on a race they can see. */
export async function postComment(raceId: string, _prev: CommentState, fd: FormData): Promise<CommentState> {
  const user = await getUser();
  if (!user) return { error: "Sign in to comment." };
  const body = String(fd.get("body") ?? "").trim();
  if (!body || body.length > MAX_COMMENT) return { error: `Write a comment of up to ${MAX_COMMENT} characters.` };
  if (!(await canSeeRace(raceId, user))) return { error: "This race no longer exists." };
  // ponytail: no rate limit; add one per runner if comments get spammed.
  const ok = await addComment(raceId, user.email, user.name, body).catch((e) => {
    console.error("Posting comment failed:", e);
    return null;
  });
  if (ok === null) return { error: "Your comment could not be posted. Try again in a moment." };
  if (!ok) return { error: "Comments are not set up yet." };
  revalidatePath(`/races/${raceId}`);
  return { posted: Date.now() };
}

/** Likes or reacts to a comment, or takes the reaction back. */
export async function reactToComment(raceId: string, commentId: string, emoji: Reaction): Promise<void> {
  const user = await getUser();
  if (!user || !/^\d+$/.test(commentId) || !REACTIONS.includes(emoji) || !(await canSeeRace(raceId, user))) return;
  await toggleReaction(raceId, commentId, user.email, emoji);
  revalidatePath(`/races/${raceId}`);
}

/** Deletes the runner's own comment; the admin can delete any. */
export async function removeComment(raceId: string, commentId: string): Promise<void> {
  const user = await getUser();
  if (!user || !/^\d+$/.test(commentId)) return;
  await deleteComment(raceId, commentId, user);
  revalidatePath(`/races/${raceId}`);
}
