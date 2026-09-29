/**
 * @file seed/bootstrap.ts
 * @description Orchestrates the seed sequence at boot.
 *
 * Order matters: `seedAuthAccounts` reads the Project collection to split
 * judge assignments, so `runSeed` (which creates Project documents) must
 * run first. `seedT2RubricAndAssignments` only needs the Event document
 * (created by `runSeed`) to already exist.
 *
 * Each phase runs in its own try/catch. Seed data is entirely idempotent
 * (every write here is an upsert), so a failure in one phase shouldn't
 * silently prevent the others from running — on this boot or a later
 * retry. This matters concretely for this project's own history: the
 * original `seed/authSeed.ts` could throw (see that file's header comment
 * for the `id`-less Assignment upsert that caused it), and because
 * nothing here isolated phases, that exception propagated straight out of
 * `bootstrapSeed()` and skipped `seedT2RubricAndAssignments()` entirely —
 * the Criterion collection never got seeded, and every route silently fell
 * back to an untuned default weighting with no error surfaced beyond a
 * single `console.warn` in `index.ts`.
 */

import { runSeed } from "./run.js";
import { seedT2RubricAndAssignments } from "./t2Seed.js";
import { seedAuthAccounts } from "./authSeed.js";

async function runPhase(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[forge] seed phase "${name}" failed:`, (err as Error).message);
  }
}

export async function bootstrapSeed(): Promise<void> {
  await runPhase("fixtures", runSeed);
  await runPhase("criteria", seedT2RubricAndAssignments);
  await runPhase("auth-accounts", seedAuthAccounts);
}
