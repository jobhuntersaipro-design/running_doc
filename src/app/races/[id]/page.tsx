import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Alert } from "@/components/arc/alert/alert";
import { Planner } from "@/components/planner/planner";
import { RaceComments } from "@/components/planner/race-comments";
import { getRace } from "@/lib/courses";
import { getUser } from "@/lib/server/auth";
import { listComments, personId } from "@/lib/server/comments";
import { getGoals } from "@/lib/server/runners";
import { linkPreview } from "@/lib/server/link-preview";
import { distanceName } from "@/lib/courses/distance";
import { builtInGpx, canSee, getStoredRace, groupByEvent, overviewRaces, storedRaceForPlanner, type Viewer } from "@/lib/server/races";

// Races added in /admin come from storage, so every race page renders on request.
export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/races/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (id === "custom") return { title: "Plan your own race" };
  const stored = getRace(id) ? null : await getStoredRace(id).catch(() => null);
  const event = getRace(id)?.event ?? (stored && canSee(stored, await getUser()) ? stored.event : undefined);
  return { title: event ? `${event}: race plan` : "Race not found" };
}

/** The other distances of the same event, for the tabs at the top of the race page. */
async function distancesOf(id: string, viewer: Viewer | null) {
  const event = groupByEvent(await overviewRaces(viewer).catch(() => [])).find((e) => e.races.some((r) => r.id === id));
  const races = event?.races ?? [];
  // Two races at one distance (a 10K run and a 10K walk) are told apart by their category.
  const clash = (km: number) => races.filter((r) => distanceName(r.km) === distanceName(km)).length > 1;
  return races.map((r) => ({ id: r.id, label: clash(r.km) ? r.category : distanceName(r.km), current: r.id === id }));
}

/** The signed-in runner's saved goal for this race, if any. */
async function savedGoalFor(id: string, email: string | undefined) {
  if (!email) return null;
  const goals = await getGoals(email).catch((e): Awaited<ReturnType<typeof getGoals>> => {
    console.error("Reading saved goals failed:", e);
    return {};
  });
  return goals[id] ?? null;
}

/** Comments for the race, or null when there is no database or it fails. */
async function commentsFor(id: string) {
  return listComments(id).catch((e) => {
    console.error("Reading comments failed:", e);
    return null;
  });
}

/** Shown when a runner tried to publish a race that is already public: they are sent here instead. */
function noticeFor(query: Record<string, string | string[] | undefined>) {
  if (!query.duplicate) return null;
  return (
    <Alert tone="warning" title="This race is already published">
      Your race stays private, so there is one page for everyone. Plan and comment here instead.
    </Alert>
  );
}

export default async function RacePage(props: PageProps<"/races/[id]">) {
  const { id } = await props.params;
  if (id === "custom") return <Planner race={null} />;
  const user = await getUser();
  const builtIn = getRace(id);
  const stored = builtIn ? null : await storedRaceForPlanner(id, user).catch(() => null);
  if (!builtIn && !stored) notFound();
  const [race, officialPreview, distances, savedGoal, comments] = await Promise.all([
    builtIn ? builtInGpx(builtIn).then((gpx) => ({ ...builtIn, gpx })) : stored!,
    linkPreview((builtIn ?? stored!).officialUrl),
    distancesOf(id, user),
    savedGoalFor(id, user?.email),
    commentsFor(id),
  ]);
  return (
    <Planner
      race={race}
      officialPreview={officialPreview}
      distances={distances}
      signedIn={!!user}
      savedGoal={savedGoal}
      notice={noticeFor(await props.searchParams)}
    >
      <RaceComments raceId={id} comments={comments} me={user ? { id: personId(user.email), name: user.name } : null} />
    </Planner>
  );
}
