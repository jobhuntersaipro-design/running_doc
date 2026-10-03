"use server";

import { redirect } from "next/navigation";
import { logEvent } from "@/lib/server/activity";
import { validUnsubscribe } from "@/lib/server/announce";
import { setRaceEmails } from "@/lib/server/runners";

/** Turns new-race emails off or back on from the signed link in an email. No sign-in needed: the link proves the address. */
export async function setRaceEmailsFromLink(fd: FormData): Promise<void> {
  const email = String(fd.get("e") ?? "");
  const token = String(fd.get("t") ?? "");
  const on = fd.get("on") === "1";
  if (!validUnsubscribe(email, token)) redirect("/unsubscribe");
  const saved = await setRaceEmails(email, on).catch((e) => {
    console.error("Changing race emails failed:", e);
    return false;
  });
  if (saved) await logEvent(email, on ? "emails_on" : "emails_off");
  redirect(`/unsubscribe?e=${encodeURIComponent(email)}&t=${token}${saved ? "" : "&failed=1"}`);
}
