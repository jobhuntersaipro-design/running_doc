import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink, FileDown } from "lucide-react";
import styles from "@/components/overview/overview.module.css";
import { SiteHeader } from "@/components/site/site-header";
import { Alert } from "@/components/arc/alert/alert";
import { Planner } from "@/components/planner/planner";
import { RaceComments } from "@/components/planner/race-comments";
import { DeleteRace } from "@/components/admin/delete-race";
import { LikeButton } from "@/components/site/like-button";
import { getRace } from "@/lib/courses";
import { getUser } from "@/lib/server/auth";
import { listComments, personId } from "@/lib/server/comments";
import { likeCounts } from "@/lib/server/likes";
import { getGoals } from "@/lib/server/runners";
import { linkPreview } from "@/lib/server/link-preview";
import { distanceName } from "@/lib/courses/distance";
import { builtInGpx, canSee, getStoredRace, groupByEvent, overviewRaces, RUNNING_DOC, RUNNING_DOC_AVATAR, storedRaceForPlanner, type Viewer } from "@/lib/server/races";

// Races added in /admin come from storage, so every race page renders on request.
export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/races/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (id === "custom") return { title: "Plan your own race" };
  const stored = getRace(id) ? null : await getStoredRace(id).catch(() => null);
  const event = getRace(id)?.event ?? (stored && canSee(stored, await getUser()) ? stored.event : undefined);
  return { title: event ? `${event}: race plan` : "Race not found" };
}

/** The race's event: its other distances, for the tabs at the top of the race page, and its likes. */
async function eventOf(id: string, viewer: (Viewer & { email: string }) | null) {
  const [cards, likes] = await Promise.all([
    overviewRaces(viewer).catch(() => []),
    likeCounts(viewer?.email).catch((e): Awaited<ReturnType<typeof likeCounts>> => {
      console.error("Reading likes failed:", e);
      return {};
    }),
  ]);
  const event = groupByEvent(cards).find((e) => e.races.some((r) => r.id === id));
  const races = event?.races ?? [];
  // Two races at one distance (a 10K run and a 10K walk) are told apart by their category.
  const clash = (km: number) => races.filter((r) => distanceName(r.km) === distanceName(km)).length > 1;
  return {
    name: event?.event,
    likes: (event && likes[event.key]) || { count: 0, mine: false },
    distances: races.map((r) => ({ id: r.id, label: clash(r.km) ? r.category : distanceName(r.km), current: r.id === id })),
  };
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
  if (stored?.gpx === null) return <UpcomingRace race={stored} />;
  const [race, officialPreview, event, savedGoal, comments] = await Promise.all([
    builtIn ? builtInGpx(builtIn).then((gpx) => ({ ...builtIn, gpx })) : { ...stored!, gpx: stored!.gpx! },
    linkPreview((builtIn ?? stored!).officialUrl),
    eventOf(id, user),
    savedGoalFor(id, user?.email),
    commentsFor(id),
  ]);
  // The buttons carry keys: without them, React warns about elements passed from this page into the client Planner.
  const actions = [
    event.name ? <LikeButton key="like" raceId={id} event={event.name} likes={event.likes} signedIn={!!user} /> : null,
    stored?.deletable ? <DeleteRace key="delete" id={id} name={stored.name} then={user?.admin ? "/admin" : "/my"} /> : null,
  ];
  return (
    <Planner
      race={race}
      officialPreview={officialPreview}
      distances={event.distances}
      actions={actions}
      signedIn={!!user}
      savedGoal={savedGoal}
      notice={noticeFor(await props.searchParams)}
    >
      <RaceComments raceId={id} comments={comments} me={user ? { id: personId(user.email), ...(user.admin ? { name: RUNNING_DOC, avatar: RUNNING_DOC_AVATAR } : { name: user.name }) } : null} />
    </Planner>
  );
}

/** A race listed before its course GPX is out: the details and links, no planner yet. */
function UpcomingRace({ race }: { race: NonNullable<Awaited<ReturnType<typeof storedRaceForPlanner>>> }) {
  return (
    <main className={styles.page}>
      <SiteHeader />
      <section className={styles.intro}>
        <p className={styles.date}>{race.dateLabel}</p>
        <h1 className={styles.title}>{race.event}</h1>
        <p className={styles.lede}>
          {race.category}, {race.location}
          {race.startTime ? `, starts ${race.startTime}` : ""}
        </p>
        <p className={styles.lede}>Course GPX coming soon. Check back closer to race day.</p>
        <ul className={styles.links}>
          <li>
            <a href={race.officialUrl} target="_blank" rel="noreferrer" className={styles.link}>
              <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
              Official website
            </a>
          </li>
          {race.files.map((f) => (
            <li key={f.href}>
              <a href={f.href} download className={styles.link}>
                <FileDown size={16} strokeWidth={1.75} aria-hidden="true" />
                {f.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
