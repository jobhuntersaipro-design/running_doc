"use server";

import { emailReady, sendEmail } from "../../lib/server/email";
import { LIMITS, formatMb } from "../admin/shared";
import { MAX_IMAGES, SUGGESTION_EMAIL, SUGGESTION_FROM, SUGGESTION_TYPES, type SuggestionState } from "./shared";

/** Emails a runner's suggestion to the team, images attached. */
// ponytail: no rate limit; Resend's daily quota caps a flood. Add a per-IP limit or captcha if spam arrives.
export async function sendSuggestion(_prev: SuggestionState, fd: FormData): Promise<SuggestionState> {
  const field = (key: string) => String(fd.get(key) ?? "").trim();
  const type = SUGGESTION_TYPES.find((t) => t.value === field("type"))?.value ?? "Other";
  const text = field("text");
  const email = field("email");
  const images = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

  if (text.length < 20 || text.length > 5000) return { error: "Write between 20 and 5,000 characters." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email address does not look right." };
  if (images.length > MAX_IMAGES || images.some((f) => !f.type.startsWith("image/")) || images.reduce((n, f) => n + f.size, 0) > LIMITS.total)
    return { error: `Attach up to ${MAX_IMAGES} images, ${formatMb(LIMITS.total)} in total.` };

  if (!emailReady()) return { error: `Suggestions cannot be sent from here yet. Email ${SUGGESTION_EMAIL} instead.` };
  const mail = {
    to: SUGGESTION_EMAIL,
    replyTo: email || undefined,
    subject: `Running Doc ${type}: ${text.split("\n")[0].slice(0, 60)}`,
    text: `${type}\n\n${text}\n\n${email ? `From: ${email}` : "No reply address given."}`,
    attachments: await Promise.all(images.map(async (f) => ({ filename: f.name, content: Buffer.from(await f.arrayBuffer()).toString("base64") }))),
  };
  // ponytail: retries from Resend's test sender while kim-brothers.com is unverified, so suggestions still arrive. Drop it once verified.
  const sent = (await sendEmail({ ...mail, from: SUGGESTION_FROM })) || (await sendEmail(mail));
  if (!sent) return { error: `Your suggestion could not be sent. Try again, or email ${SUGGESTION_EMAIL}.` };
  return { sent: true };
}
