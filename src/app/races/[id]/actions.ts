"use server";

import { revalidatePath } from "next/cache";
import { getRace } from "@/lib/courses";
import { formatClock, isSavedGoal, type SavedGoal } from "@/lib/planner";
import { MAX_COMMENT, REACTIONS, type Reaction } from "@/lib/comments";
import { getUser, type SessionUser } from "@/lib/server/auth";
import { logEvent } from "@/lib/server/activity";
import { addComment, deleteComment, editComment, toggleReaction } from "@/lib/server/comments";
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
  await logEvent(user.email, "goal", raceId, `${formatClock(goalSeconds)}, start ${startTime}`);
  revalidatePath("/my");
  return { saved: goal };
}

export type CommentResult = { error?: string };

const failed = (what: string) => (e: unknown) => {
  console.error(`${what} failed:`, e);
  return null;
};

function checkBody(raw: string): string | { error: string } {
  const body = raw.trim();
  return body && body.length <= MAX_COMMENT ? body : { error: `Write a comment of up to ${MAX_COMMENT} characters.` };
}

/** Posts a comment, or a reply to one, from the signed-in runner on a race they can see. */
export async function postComment(raceId: string, raw: string, parentId: string | null): Promise<CommentResult> {
  const user = await getUser();
  if (!user) return { error: "Sign in to comment." };
  const body = checkBody(raw);
  if (typeof body !== "string") return body;
  if (parentId !== null && !/^\d+$/.test(parentId)) return { error: "That comment no longer exists." };
  if (!(await canSeeRace(raceId, user))) return { error: "This race no longer exists." };
  // ponytail: no rate limit; add one per runner if comments get spammed.
  const ok = await addComment(raceId, user.email, user.name, body, parentId).catch(failed("Posting comment"));
  if (ok === null) return { error: "Your comment could not be posted. Try again in a moment." };
  if (!ok) return { error: "Comments are not set up yet." };
  await logEvent(user.email, parentId ? "reply" : "comment", raceId, body);
  revalidatePath(`/races/${raceId}`);
  return {};
}

/** Changes the text of the runner's own comment. */
export async function changeComment(raceId: string, commentId: string, raw: string): Promise<CommentResult> {
  const user = await getUser();
  if (!user) return { error: "Sign in to edit." };
  const body = checkBody(raw);
  if (typeof body !== "string") return body;
  if (!/^\d+$/.test(commentId)) return { error: "That comment no longer exists." };
  const ok = await editComment(raceId, commentId, user.email, body).catch(failed("Editing comment"));
  if (ok === null) return { error: "Your edit could not be saved. Try again in a moment." };
  if (!ok) return { error: "That comment can no longer be edited." };
  await logEvent(user.email, "comment_edited", raceId, body);
  revalidatePath(`/races/${raceId}`);
  return {};
}

/** Likes or reacts to a comment, or takes the reaction back. */
export async function reactToComment(raceId: string, commentId: string, emoji: Reaction): Promise<CommentResult> {
  const user = await getUser();
  if (!user) return { error: "Sign in to react." };
  if (!/^\d+$/.test(commentId) || !REACTIONS.includes(emoji) || !(await canSeeRace(raceId, user))) return { error: "That reaction could not be saved." };
  const added = await toggleReaction(raceId, commentId, user.email, emoji).catch(failed("Reacting"));
  if (added === null) return { error: "Your reaction could not be saved. Try again in a moment." };
  await logEvent(user.email, added ? "reaction" : "unreaction", raceId, `${emoji} on comment ${commentId}`);
  revalidatePath(`/races/${raceId}`);
  return {};
}

/** Deletes the runner's own comment; the admin can delete any. */
export async function removeComment(raceId: string, commentId: string): Promise<CommentResult> {
  const user = await getUser();
  if (!user) return { error: "Sign in to delete." };
  if (!/^\d+$/.test(commentId)) return { error: "That comment no longer exists." };
  const gone = await deleteComment(raceId, commentId, user).catch(failed("Deleting comment"));
  if (gone === null) return { error: "That comment could not be deleted. Try again in a moment." };
  await logEvent(user.email, "comment_deleted", raceId, gone.email === user.email.toLowerCase() ? gone.body : `by ${gone.email}: ${gone.body}`);
  revalidatePath(`/races/${raceId}`);
  if (user.admin) revalidatePath("/admin");
  return {};
}
