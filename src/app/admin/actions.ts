"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getRace } from "@/lib/courses";
import { logEvent } from "@/lib/server/activity";
import { announceRace } from "@/lib/server/announce";
import { endSession, getUser, isAdmin, startSession, verifyCredentials, type SessionUser } from "@/lib/server/auth";
import { file, parseRaceInput, readCover, slugify, text, uniqueId, writeRace } from "@/lib/server/race-input";
import { deleteRaceFiles, getCoverOverride, getStoredRace, listRaces, publishedTwin, RUNNING_DOC, saveRecord, type StoredRace } from "@/lib/server/races";
import { forgetRace } from "@/lib/server/runners";
import { deleteFiles, saveFile, StorageError, StorageNotReadyError } from "@/lib/server/store";
import type { FormState } from "./shared";

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin");
}

async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/signin");
  return user;
}

const owns = (user: SessionUser, race: StoredRace) => user.admin || race.owner?.toLowerCase() === user.email.toLowerCase();
const homeOf = (user: SessionUser) => (user.admin ? "/admin" : "/my");
/** ponytail: flat cap per runner, add quotas by storage size if R2 costs matter. */
const MAX_RACES_PER_RUNNER = 20;

/** Emails runners about a newly public race once the response is sent, so publishing never waits on email. */
async function announceLater(race: Parameters<typeof announceRace>[0], user: SessionUser, alsoSkip: (string | undefined)[]) {
  const h = await headers();
  const site = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const except = [user.email, ...alsoSkip.filter((e): e is string => Boolean(e))];
  after(() => announceRace(race, site, user.email, except).catch((e) => console.error("Announcing race failed:", e)));
}

function storageError(e: unknown): FormState {
  if (e instanceof StorageNotReadyError || e instanceof StorageError) return { error: e.message };
  console.error(e);
  return { error: "The race could not be saved. Try again in a moment." };
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const ok = await verifyCredentials(text(fd, "email"), String(fd.get("password") ?? ""));
  if (!ok) {
    // Slows down password guessing.
    await new Promise((r) => setTimeout(r, 800));
    return { error: "That email and password do not match." };
  }
  await startSession({ email: text(fd, "email"), name: "Admin" });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/");
}

/** Creates a race, or updates one when the form carries an id. */
export async function saveRace(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const editId = text(fd, "id");
  let existing: StoredRace | null = null;
  try {
    existing = editId ? await getStoredRace(editId) : null;
    if (!editId && !user.admin && (await listRaces()).filter((r) => r.owner?.toLowerCase() === user.email.toLowerCase()).length >= MAX_RACES_PER_RUNNER)
      return { error: `You can add up to ${MAX_RACES_PER_RUNNER} races. Delete one to add another.` };
  } catch (e) {
    return storageError(e);
  }
  if (editId && (!existing || !owns(user, existing))) return { error: "This race no longer exists." };

  const parsed = await parseRaceInput(fd, { requireGpx: !existing });
  if (!("input" in parsed)) return { error: parsed.error, fieldErrors: parsed.fieldErrors };

  try {
    const { input } = parsed;
    const id = existing?.id ?? (await uniqueId(slugify(`${input.event} ${input.category}`)));
    const saved = await writeRace(input, id, existing, {
      owner: existing ? existing.owner : user.admin ? undefined : user.email,
      ownerName: existing ? existing.ownerName : user.admin ? undefined : user.name,
      publishedBy: existing?.publishedBy,
      publishedAt: existing?.publishedAt,
      announcedAt: existing ? existing.announcedAt : user.admin ? Date.now() : undefined,
    });
    if (!("race" in saved)) return saved;
    await logEvent(user.email, existing ? "race_edited" : "race_added", id, `${input.event}, ${input.category}`);
    // The admin's new races are public at once, so runners hear about them like a published race.
    if (!existing && user.admin) await announceLater({ ...saved.race, publishedBy: RUNNING_DOC }, user, []);
    revalidatePath("/");
    revalidatePath(`/races/${id}`);
    revalidatePath(homeOf(user));
  } catch (e) {
    return storageError(e);
  }
  redirect(`${homeOf(user)}?saved=1`);
}

/** Sets or removes the cover of a built-in race. */
export async function saveCover(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = text(fd, "id");
  if (!getRace(id)) return { error: "This race no longer exists." };
  const coverFile = file(fd, "cover");
  const remove = text(fd, "removeCover") === "on";
  if (!coverFile && !remove) return { error: "Choose a cover image first.", fieldErrors: { cover: "Choose a cover image." } };
  try {
    const existing = await getCoverOverride(id);
    let coverUrl: string | undefined;
    if (coverFile) {
      const cover = await readCover(coverFile);
      if (typeof cover === "string") return { error: cover, fieldErrors: { cover } };
      coverUrl = await saveFile(`races/${id}/cover.${cover.ext}`, cover.body, cover.type, { randomSuffix: true });
    }
    await saveRecord({ kind: "cover", id, coverUrl, updatedAt: Date.now() });
    await logEvent((await getUser())?.email ?? "admin", "cover", id, coverUrl ? "set" : "removed");
    if (existing?.coverUrl) await deleteFiles([existing.coverUrl]);
    revalidatePath("/");
    revalidatePath("/admin");
  } catch (e) {
    return storageError(e);
  }
  redirect("/admin?saved=1");
}

/**
 * Makes a runner's race public, credited to them. A race that is already public
 * (same event, day and distance) is not published twice: the runner is sent to it instead.
 */
export async function publishRace(id: string): Promise<FormState> {
  const user = await requireUser();
  let twin;
  try {
    const race = await getStoredRace(id);
    if (!race || !owns(user, race)) return { error: "This race no longer exists." };
    if (!race.owner || race.publishedAt !== undefined) return { error: "This race is already public." };
    twin = await publishedTwin(race);
    if (!twin) {
      // The admin publishing a runner's race credits the runner, not "Admin".
      const by = user.admin ? (race.ownerName ?? race.owner.split("@")[0]) : user.name;
      const published = { ...race, publishedBy: by, publishedAt: Date.now(), announcedAt: race.announcedAt ?? Date.now(), updatedAt: Date.now() };
      await saveRecord(published);
      await logEvent(user.email, "race_published", id, `${race.event}, ${race.category}`);
      if (!race.announcedAt) await announceLater({ ...published, publishedBy: by }, user, [race.owner]);
    }
  } catch (e) {
    return storageError(e);
  }
  if (twin) redirect(`/races/${twin.id}?duplicate=1`);
  revalidatePath("/");
  revalidatePath(`/races/${id}`);
  revalidatePath(homeOf(user));
  return {};
}

/** Makes a published race private to its runner again. */
export async function unpublishRace(id: string): Promise<FormState> {
  const user = await requireUser();
  try {
    const race = await getStoredRace(id);
    if (!race || !owns(user, race) || race.publishedAt === undefined) return { error: "This race is not published." };
    await saveRecord({ ...race, publishedBy: undefined, publishedAt: undefined, updatedAt: Date.now() });
    await logEvent(user.email, "race_unpublished", id, `${race.event}, ${race.category}`);
  } catch (e) {
    return storageError(e);
  }
  revalidatePath("/");
  revalidatePath(`/races/${id}`);
  revalidatePath(homeOf(user));
  return {};
}

/** Deletes a race added by a runner or the admin, with its files, comments and saved goals. Built-in races live in the code and cannot be deleted here. */
export async function deleteRace(id: string): Promise<FormState> {
  const user = await requireUser();
  if (getRace(id)) return { error: "Built-in races are part of the code and cannot be deleted here." };
  try {
    const race = await getStoredRace(id);
    if (!race || !owns(user, race)) return { error: "This race no longer exists." };
    await deleteRaceFiles(id);
    await forgetRace(id).catch((e) => console.error("Removing a deleted race's comments and goals failed:", e));
    await logEvent(user.email, "race_deleted", id, `${race.event}, ${race.category}${race.owner && !owns({ ...user, admin: false }, race) ? ` (added by ${race.owner})` : ""}`);
  } catch (e) {
    return storageError(e);
  }
  revalidatePath("/");
  revalidatePath(`/races/${id}`);
  revalidatePath(homeOf(user));
  return {};
}
