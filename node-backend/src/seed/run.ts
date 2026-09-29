/**
 * @file seed/run.ts
 * @description Loads fixtures.json (or a minimal fallback) and seeds the
 * Event, Project, and Posterior collections.
 *
 * Key changes from the original
 * ──────────────────────────────
 * • User/session seeding has been removed from this file entirely. The
 *   original also upserted a hardcoded list of role sessions here
 *   (`org_seed_01`, `jdg_a_seed_01`, ...) via the old `models/index.ts`
 *   User model, while `seed/authSeed.ts` upserted the *same* user IDs
 *   afterwards with the real schema, bcrypt password hashes, and its own
 *   session tokens. Two files writing the same User documents with
 *   different shapes is exactly the kind of drift this whole model split
 *   was meant to eliminate — user/session seeding now lives in exactly
 *   one place, `seed/authSeed.ts`.
 * • Per-project upserts run concurrently (`Promise.all`) instead of a
 *   sequential `for` loop — each project's Project + Posterior upsert is
 *   independent of every other project's, so there's no ordering reason
 *   to serialize them.
 * • This file no longer writes `Event.criteria`. `seed/t2Seed.ts` owns
 *   that field (it's the one place the Criterion collection — the live
 *   weight source — is seeded, and the Event.criteria mirror is derived
 *   from it); leaving it unset here means there is exactly one seed
 *   script writing that field instead of two disagreeing about it.
 */

import fs from "fs";
import { Event, Project, Posterior } from "../models/index.js";
import { config } from "../config/index.js";
import { defaultPosterior } from "../math/imbr.js";

export async function runSeed(): Promise<void> {
  const fixturesPath = config.fixturesPath;
  let data: any;

  if (fs.existsSync(fixturesPath)) {
    data = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));
    console.log("[seed] loaded fixtures from", fixturesPath);
  } else {
    // Minimal fallback so the portal boots without the official file.
    data = {
      event: {
        id: "evt_01",
        name: "Sample Hack 2026",
        submissions_close: "2020-01-01T00:00:00Z", // past -> closed
      },
      tracks: [{ id: "trk_01", name: "Developer tools" }],
      projects: [
        {
          id: "prj_01",
          team: "tm_01",
          track: "trk_01",
          title: "Quiet Hours",
          summary: "One line.",
          repo_url: "https://example.org/repo",
          submitted_at: "2026-02-28T22:14:00Z",
        },
        {
          id: "prj_02",
          team: "tm_01",
          track: "trk_01",
          title: "Signal Bridge",
          summary: "Demo project two.",
          submitted_at: "2026-02-28T23:00:00Z",
        },
      ],
    };
    console.log("[seed] fixtures.json not found — using minimal fallback");
  }

  await Event.findOneAndUpdate(
    { id: data.event.id },
    {
      id: data.event.id,
      name: data.event.name,
      submissionsClose: new Date(data.event.submissions_close || data.event.submissionsClose),
      tracks: data.tracks || [],
    },
    { upsert: true },
  );

  const projects: any[] = data.projects || [];
  await Promise.all(
    projects.map(async (p) => {
      // Real dimensionality is resolved per-request from the Criterion
      // collection (see routes/scores.ts); 2 here is just a harmless
      // placeholder shape until seed/t2Seed.ts runs and the first
      // observation is scored.
      await Promise.all([
        Project.findOneAndUpdate(
          { id: p.id },
          {
            id: p.id,
            teamId: p.team || p.teamId,
            trackId: p.track || p.trackId,
            title: p.title,
            summary: p.summary || "",
            repoUrl: p.repo_url || p.repoUrl,
            submittedAt: new Date(p.submitted_at || p.submittedAt || Date.now()),
          },
          { upsert: true },
        ),
        Posterior.findOneAndUpdate(
          { projectId: p.id },
          { projectId: p.id, ...defaultPosterior(2), updatedAt: new Date() },
          { upsert: true },
        ),
      ]);
    }),
  );

  console.log(`[seed] event "${data.event.id}" and ${projects.length} project(s) upserted`);
}

// Allow running directly: `tsx src/seed/run.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  import("mongoose").then(async (mongoose) => {
    await mongoose.default.connect(config.mongoUri);
    await runSeed();
    process.exit(0);
  });
}
