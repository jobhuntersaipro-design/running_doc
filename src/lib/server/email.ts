import "server-only";

export interface Email {
  /** Defaults to EMAIL_FROM, then Resend's shared test sender. */
  from?: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: { filename: string; content: string }[];
}

export const emailReady = () => Boolean(process.env.RESEND_API_KEY?.trim());

/** Sends one email through Resend's API. Returns whether Resend accepted it; failures are logged, never thrown. */
export async function sendEmail({ from, replyTo, ...email }: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    // Resend's shared sender only delivers to the Resend account's own address. Runners need EMAIL_FROM on a verified domain.
    body: JSON.stringify({ from: from ?? (process.env.EMAIL_FROM?.trim() || "Running Doc <onboarding@resend.dev>"), reply_to: replyTo, ...email }),
  }).catch((e: Error) => e);
  if (res instanceof Response && res.ok) return true;
  console.error("Email failed:", res instanceof Response ? `${res.status} ${await res.text()}` : res.message);
  return false;
}
