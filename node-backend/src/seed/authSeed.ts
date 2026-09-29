/**
 * @file seed/authSeed.ts
 * @description Seeds Admin, Organizer, two Judges, and a Participant demo
 * account, then strictly assigns judges to fixture projects.
 *
 * Key changes from the original
 * ──────────────────────────────
 * • The five user upserts now run concurrently (`Promise.all`) instead of
 *   five sequential `await`s — they're independent documents.
 * • Assignment rows are now created through
 *   `services/assignmentService.ts`'s `assignManual` — the same function
 *   `POST /api/organizer/assignments` uses — instead of this file writing
 *   its own `Assignment.findOneAndUpdate(...)`. The original call here
 *   omitted `id` entirely from the upserted document
 *   (`{ judgeId, projectId, eventId, createdAt }`, no `id`), which is a
 *   real problem once the schema requires `id`: Mongoose applies schema
 *   defaults on an upsert-created document, but with no default, the
 *   first upserted row got created with `id` absent — which MongoDB's
 *   unique index treats as `null` — and the second upsert in the same
 *   loop collided on that identical implicit null and threw `E11000`.
 *   Routing through `assignManual` means this file no longer has its own
 *   copy of the write to keep in sync with the schema, and it also keeps
 *   `User.assignedProjects` up to date automatically (assignManual does
 *   that as part of the same call), so this file no longer sets that
 *   field itself.
 *
 * One known trade-off: `assignManual` always records `source: "manual"`
 * on the row it creates. Rows created here are therefore labeled
 * "manual" rather than "seed" in the Assignment collection. Giving
 * `assignManual` an optional `source` override would remove that, but
 * `services/assignmentService.ts` is unchanged in this pass — this file
 * only reuses what it already exports.
 */

import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Project } from "../models/index.js";
import { authConfig } from "../config/auth.js";
import { assignManual } from "../services/assignmentService.js";

const EVENT_ID = "evt_01";

async function upsertUser(u: {
  id: string;
  email: string;
  name: string;
  role: "admin" | "organizer" | "judge" | "participant";
  password: string;
  sessionToken: string;
}): Promise<void> {
  const passwordHash = await bcrypt.hash(u.password, authConfig.bcryptRounds);
  await User.findOneAndUpdate(
    { id: u.id },
    {
      id: u.id,
      email: u.email.toLowerCase(),
      name: u.name,
      role: u.role,
      passwordHash,
      sessionToken: u.sessionToken,
      isActive: true,
    },
    { upsert: true, new: true },
  );
}

export async function seedAuthAccounts(): Promise<void> {
  const sp = authConfig.seedPasswords;
  const st = authConfig.seedTokens;

  // Collect project ids for strict assignment, split between two judges.
  const projects = await Project.find({}).lean();
  const allProjectIds = projects.map((p) => p.id);
  const half = Math.ceil(allProjectIds.length / 2) || 1;
  const judgeAProjects = allProjectIds.slice(0, half);
  const judgeBProjects = allProjectIds.slice(half);
  if (judgeBProjects.length === 0 && allProjectIds.length > 0) {
    judgeBProjects.push(allProjectIds[0]);
  }

  await Promise.all([
    upsertUser({
      id: "adm_01",
      email: "admin@forge.local",
      name: "Platform Admin",
      role: "admin",
      password: sp.admin,
      sessionToken: st.admin,
    }),
    upsertUser({
      id: "org_01",
      email: "organizer@forge.local",
      name: "Event Organizer",
      role: "organizer",
      password: sp.organizer,
      sessionToken: st.organizer,
    }),
    upsertUser({
      id: "jdg_01",
      email: "judge.a@forge.local",
      name: "Judge Ada",
      role: "judge",
      password: sp.judge_a,
      sessionToken: st.judge_a,
    }),
    upsertUser({
      id: "jdg_02",
      email: "judge.b@forge.local",
      name: "Judge Ben",
      role: "judge",
      password: sp.judge_b,
      sessionToken: st.judge_b,
    }),
    upsertUser({
      id: "prt_01",
      email: "participant@forge.local",
      name: "Demo Participant",
      role: "participant",
      password: sp.participant,
      sessionToken: st.participant,
    }),
  ]);

  // Assignment rows (requireAssignedJudge reads these via assignmentService).
  await Promise.all([
    ...judgeAProjects.map((projectId) =>
      assignManual({ eventId: EVENT_ID, judgeId: "jdg_01", projectId }),
    ),
    ...judgeBProjects.map((projectId) =>
      assignManual({ eventId: EVENT_ID, judgeId: "jdg_02", projectId }),
    ),
  ]);

  console.log("\n========== AUTH SEED (Dogfood offline) ==========");
  console.log("Passwords (UI login):");
  console.log(`  admin@forge.local        / ${sp.admin}`);
  console.log(`  organizer@forge.local    / ${sp.organizer}`);
  console.log(`  judge.a@forge.local      / ${sp.judge_a}`);
  console.log(`  judge.b@forge.local      / ${sp.judge_b}`);
  console.log(`  participant@forge.local  / ${sp.participant}`);
  console.log("");
  console.log("Session tokens for .dogfood.toml:");
  console.log(`  admin       = "Cookie: session=${st.admin}"`);
  console.log(`  organizer   = "Cookie: session=${st.organizer}"`);
  console.log(`  judge_a     = "Cookie: session=${st.judge_a}"`);
  console.log(`  judge_b     = "Cookie: session=${st.judge_b}"`);
  console.log(`  participant = "Cookie: session=${st.participant}"`);
  console.log("");
  console.log("Or Bearer JWT after POST /api/auth/login");
  console.log(`Judge A assigned: ${judgeAProjects.join(", ") || "(none)"}`);
  console.log(`Judge B assigned: ${judgeBProjects.join(", ") || "(none)"}`);
  console.log("=================================================\n");
}
