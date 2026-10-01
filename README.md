# Race plan

A planner for beginner marathon and half marathon runners. Give it a course GPX and a goal time and it works out:

- **Hills**: climbs, descents and flat sections from smoothed elevation.
- **Pace**: per kilometre targets that slow on climbs, ease the first few km and finish a little quicker, all adding up to the goal.
- **Fuel and water**: when to take each gel (lined up just before a drink station, never on a climb) and what to do at every station.
- **Watch setup**: a Garmin workout file (`.fit`, one step per km with a pace range), plus pace blocks and steps for Coros and Apple Watch.
- **Pace band**: a printable wrist band with the race time and clock time at every marker.
- **Race rehearsal**: an animated map and elevation profile with a progress bar. Playback pauses at each uphill, downhill, gel and station with what to do there.
- **Hills**: each uphill's start and top elevation, gradient, steepest stretch, target pace and the treadmill incline to practise it.
- **Maps**: streets (CARTO), satellite (Esri) or 3D terrain (AWS Terrain Tiles), plus a camera that follows the runner.

The example course is the 2026 KL Marathon half marathon. Its aid station distances were read from the route map, so they are estimates.

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

Map tiles come from CARTO (OpenStreetMap data), Esri World Imagery and AWS Terrain Tiles. If a tile server is unreachable, the map still draws the route and says which tiles failed.

## Caveats

The plan is general guidance, not medical or coaching advice. Practise pacing and fuel in training before race day.
