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
  headers?: Record<string, string>;
}

/** Escapes text for email HTML. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

export const emailReady = () => Boolean(process.env.RESEND_API_KEY?.trim());

/** Sends one email through Resend's API. Returns whether Resend accepted it; failures are logged, never thrown. */
export async function sendEmail(email: Email): Promise<boolean> {
  return post("https://api.resend.com/emails", resendBody(email));
}

/** Sends many emails through Resend's batch API, 100 per request. Resolves to how many Resend accepted. */
export async function sendBatch(emails: Email[]): Promise<number> {
  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    if (await post("https://api.resend.com/emails/batch", chunk.map(resendBody))) sent += chunk.length;
  }
  return sent;
}

// Resend's shared sender only delivers to the Resend account's own address. Runners need EMAIL_FROM on a verified domain.
const resendBody = ({ from, replyTo, ...email }: Email) => ({
  from: from ?? (process.env.EMAIL_FROM?.trim() || "Running Doc <onboarding@resend.dev>"),
  reply_to: replyTo,
  ...email,
});

async function post(url: string, body: unknown): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return false;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch((e: Error) => e);
  if (res instanceof Response && res.ok) return true;
  console.error("Email failed:", res instanceof Response ? `${res.status} ${await res.text()}` : res.message);
  return false;
}
