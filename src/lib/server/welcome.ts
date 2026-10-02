import "server-only";
import { SUGGESTION_EMAIL } from "../../app/suggestion/shared";
import { emailReady, sendEmail } from "./email";
import { listFiles, saveFile, storageReady, userKey } from "./store";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const FONT = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

const STEPS = [
  ["Add your race", "Upload the course GPX from the organiser, Strava or Garmin Connect, plus the route map if you have it. Only you can see your races."],
  ["Set your goal and zones", "Pick a goal finish time. Add your max and resting heart rate and threshold pace to see which parts of the course will feel hardest."],
  ["Rehearse, then take it with you", "Replay the whole race on the map, then load the workout onto your Garmin, Coros or Apple Watch."],
];

/** The welcome email: a three-step setup checklist. `site` is the origin the runner signed in on. */
export function welcomeEmail(name: string, site: string) {
  // Google's name can be missing or the email itself; greet by first name only when there is one.
  const first = name.includes("@") ? "" : (name.trim().split(/\s+/)[0] ?? "");
  const hello = first ? `Welcome, ${first}.` : "Welcome.";
  const links = { add: `${site}/my`, demo: `${site}/races/klscm-2026-hm`, feedback: `${site}/suggestion` };
  const footer = "You are getting this because you signed in to Running Doc with Google. Running Doc gives general guidance, not medical or coaching advice.";

  const steps = STEPS.map(([title, body], i) => {
    const pad = i === STEPS.length - 1 ? "0 0 28px" : "0 0 22px";
    return `<tr>
<td width="44" valign="top" style="padding:${pad};"><div style="width:32px;height:32px;border-radius:16px;background:#1f7dcf;color:#ffffff;font-size:15px;font-weight:700;line-height:32px;text-align:center;">${i + 1}</div></td>
<td valign="top" style="padding:${pad};font-size:15px;line-height:1.6;color:#4f5763;"><strong style="display:block;font-size:16px;color:#1d2127;">${title}</strong>${body}</td>
</tr>`;
  }).join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Welcome to Running Doc</title></head>
<body style="margin:0;padding:0;background:#f2f5f8;">
<div style="display:none;max-height:0;overflow:hidden;">Add your race, set your goal, take it to your watch.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f5f8;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 8px 18px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding-right:10px;"><img src="${site}/apple-icon.png" width="32" height="32" alt="" style="display:block;border:0;border-radius:8px;"></td>
<td style="${FONT}font-size:17px;font-weight:600;color:#16324f;">Running Doc</td>
</tr></table>
</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e1e6ec;border-radius:16px;padding:32px 28px;${FONT}color:#1d2127;">
<h1 style="margin:0 0 10px;font-size:24px;line-height:1.3;font-weight:700;color:#16324f;">${esc(hello)} Let's get you race-ready.</h1>
<p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#4f5763;">Three steps take you from a course file to a plan you can run on race day.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${steps}</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;"><tr>
<td style="border-radius:10px;background:#1f7dcf;"><a href="${links.add}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Add your first race</a></td>
</tr></table>
<p style="margin:0;font-size:14px;line-height:1.6;color:#4f5763;">No course file yet? <a href="${links.demo}" style="color:#1f7dcf;font-weight:600;text-decoration:none;">Explore the KL Marathon half plan</a></p>
</td></tr>
<tr><td style="padding:22px 8px 0;${FONT}font-size:12px;line-height:1.6;color:#868d97;">
<p style="margin:0 0 8px;">Questions or ideas? Reply to this email or use the <a href="${links.feedback}" style="color:#868d97;">Feedback page</a>.</p>
<p style="margin:0;">${footer}</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const text = [
    `${hello} Let's get you race-ready.`,
    "Three steps take you from a course file to a plan you can run on race day.",
    ...STEPS.map(([title, body], i) => `${i + 1}. ${title}\n${body}`),
    `Add your first race: ${links.add}`,
    `No course file yet? Explore the KL Marathon half plan: ${links.demo}`,
    `Questions or ideas? Reply to this email or use the Feedback page: ${links.feedback}`,
    footer,
  ].join("\n\n");

  return { subject: first ? `Welcome, ${first}: 3 steps to your race plan` : "Welcome: 3 steps to your race plan", html, text };
}

/**
 * Sends the welcome email the first time a runner signs in. A marker in their storage folder records it;
 * runners who already have files there signed up before this email existed, so they are skipped.
 * A failed send leaves no marker, so it is tried again on their next sign-in.
 */
export async function welcomeOnce(email: string, name: string, site: string): Promise<void> {
  if (!emailReady() || !storageReady() || (await listFiles(userKey(email, ""))).length) return;
  if (await sendEmail({ to: email, replyTo: SUGGESTION_EMAIL, ...welcomeEmail(name, site) }))
    await saveFile(userKey(email, "welcomed.txt"), new Date().toISOString(), "text/plain");
}
