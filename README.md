# Running Doc

A planner for beginner marathon and half marathon runners. Give it a course GPX and a goal time and it works out:

- **Hills**: climbs, descents and flat sections from smoothed elevation.
- **Pace**: per kilometre targets that slow on climbs, ease the first few km and finish a little quicker, all adding up to the goal.
- **Fuel and water**: when to take each gel (lined up just before a drink station, never on a climb) and what to do at every station.
- **Watch setup**: a Garmin workout file (`.fit`, one step per km with a pace range), plus pace blocks and phone sync steps for Garmin Connect, the Coros app and the iPhone Fitness app (Apple Watch).
- **Pace band**: a printable wrist band with the race time and clock time at every marker.
- **Race rehearsal**: replay the whole race in 30 s, 1 min or 3 min on an animated map, with elevation, pace zone and heart rate zone charts stacked below. Playback pauses at each uphill, downhill, gel and station with an animated marker, what to do, what you will feel and a short mental cue.
- **The race in parts**: settle in, the hills, cruise, dig deep and finish, each with what to expect and what to focus on.
- **Zones**: enter your max and resting heart rate (or your own zones) and threshold pace to see which parts of the race fall in each heart rate and pace zone, on the map, the elevation chart, the splits and the live panel. Heart rate along the course is an estimate.
- **Hills**: each uphill's start and top elevation, gradient, steepest stretch, target pace and the treadmill incline to practise it.
- **Maps**: streets (OpenFreeMap, no API key), satellite (Esri) or 3D terrain (AWS Terrain Tiles), plus a camera that follows the runner. The route is coloured by uphill, downhill and flat, and a popup describes each event when playback pauses on it.

The home page lists the races as cards (date, distance, uphill, official website, the course files and a route preview). Open a card for its plan at `/races/<id>`, or choose **Plan another race** (`/races/custom`) to upload any GPX.

The first race is the 2026 KL Marathon half marathon. Its aid station distances were read from the route map, so they are estimates.

### Adding a race

The easy way is `/admin`: sign in, then add the race's details, course GPX, route map PDF and card cover. It shows on the overview straight away. Give each distance of an event (5K, 10K, half, full) the same event name: they share one card with a ribbon per distance, and the race page gets a tab for each.

To build a race into the code instead:

1. Put its files in `public/races/<id>/` (`course.gpx`, plus any route map PDF).
2. Add a config like `src/lib/courses/klscm-2026-hm.ts` (event, date, location, official link, files, distance, start time, aid stations).
3. Add it to `RACES` in `src/lib/courses/index.ts`.

### Admin and file storage

Copy `.env.example` to `.env.local` and fill it in. In production, set the same variables in the Vercel project.

- **Runner sign-in:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from a Google OAuth client (Web application) whose authorized redirect URI is `<site>/api/auth/google/callback`. Signed-in runners add their own races at `/my`; those are visible only to them and the admin.
- **Admin login:** `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (make it with `node scripts/hash-password.mjs`) and `AUTH_SECRET` (any long random string). The password itself is never stored.
- **Email:** `RESEND_API_KEY` from a [Resend](https://resend.com) account signed up with jobhunters.ai.pro@gmail.com. The `/suggestion` page emails each suggestion and its images there, from running-doc-suggestions@kim-brothers.com (kim-brothers.com must be verified in Resend). Runners get a welcome email the first time they sign in with Google, which also needs `EMAIL_FROM` on a verified domain (e.g. `Running Doc <hello@kim-brothers.com>`).
- **Sign-ups:** `DATABASE_URL`, the pooled connection string from a [Neon](https://neon.tech) project. Each Google sign-in is recorded in a `runners` table (created on first use) and `/admin` lists every runner's name, email and sign-up date. Signed-in runners can also save an optional profile at `/settings` (age, sex, height, weight, VO2 max, kept in the same table) and their heart rate zones. The profile personalises every plan: age sets max heart rate until they set their own zones, VO2 max sets threshold pace and how hard the goal is for them (and so the estimated heart rate), and weight adds the energy used to the rehearsal. On a race page they can save their goal finish time and start time; the page opens on it next time and `/my` lists their saved goals.
- **Cloudflare R2:** race details, GPX, PDFs and cover images go to an R2 bucket when the `R2_*` variables are set. Without them, files go to the gitignored `.data` folder, which works locally but not on Vercel.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # planner and FIT encoder tests
npm run plan -- 1:59:00   # print the example plan in the terminal
```

## How it is built

- `src/lib/planner/`: the engine, plain TypeScript with no UI code.
  - `gpx.ts` reads track points. `profile.ts` resamples every 100 m, rescales to the official distance and smooths elevation.
  - `segments.ts` finds climbs and descents. `pacing.ts` spreads the goal time with a grade-adjusted pace model.
  - `fuel.ts` places gels and drinks. `blocks.ts` groups kilometres into a few pace blocks. `plan.ts` puts it together.
- `src/lib/export/fit.ts`: a small FIT workout encoder.
- `src/components/planner/`: the page, built with [Arc UI](https://uiarc.dev) components (`src/components/arc/`) and MapLibre for the map.
- `scripts/arc-add.mjs` installs more Arc components without the shadcn CLI: `node scripts/arc-add.mjs <name>`.

Map tiles come from OpenFreeMap (OpenStreetMap data), Esri World Imagery and AWS Terrain Tiles. If a tile server is unreachable, the map still draws the route and says which tiles failed.

## Caveats

The plan is general guidance, not medical or coaching advice. Practise pacing and fuel in training before race day.
