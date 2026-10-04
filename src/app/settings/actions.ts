"use server";

import { logEvent } from "@/lib/server/activity";
import { getUser } from "@/lib/server/auth";
import { setRaceEmails } from "@/lib/server/runners";

/** Turns the signed-in runner's new-race emails on or off. */
export async function setMyRaceEmails(on: boolean): Promise<{ error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Sign in again to change this." };
  const saved = await setRaceEmails(user.email, on).catch((e) => {
    console.error("Changing race emails failed:", e);
    return false;
  });
  if (!saved) return { error: "Your choice could not be saved. Try again in a moment." };
  await logEvent(user.email, on ? "emails_on" : "emails_off");
  return {};
}
