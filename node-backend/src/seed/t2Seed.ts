/**
 * @file seed/t2Seed.ts
 * @description T2 seed: the weighted Criterion collection, plus the
 * Event.criteria legacy display mirror.
 *
 * Key changes from the original
 * ──────────────────────────────
 * • Assignment seeding has been removed from this file entirely. The
 *   original had its own `seedAssign` helper here that wrote Assignment
 *   rows with `status`/`source`, running *in addition to* a completely
 *   separate, differently-shaped Assignment upsert in `seed/authSeed.ts`
 *   (which didn't set `id` at all). Two seed files writing the same
 *   collection with different shapes is precisely how that class of bug
 *   happened; assignment seeding now lives in exactly one place —
 *   `seed/authSeed.ts`, calling the same `assignManual` that every other
 *   assignment write in the app goes through.
 * • This file no longer creates or upserts the Event document itself.
 *   The original did its own `Event.findOneAndUpdate(..., $setOnInsert: {...})`
 *   here with a *different* name/deadline/tracks than `seed/run.ts` seeds
 *   from the real fixtures — harmless in practice only because
 *   `$setOnInsert` is a no-op once `runSeed()` has already created the
 *   document, but still a second file asserting what the event's identity
 *   fields should be. `seed/run.ts` owns creating the Event; this file
 *   only ever updates the one field it's actually responsible for
 *   (`criteria`), and assumes the document already exists (bootstrap.ts
 *   always runs `runSeed()` first).
 * • The four criteria are upserted concurrently instead of in a
 *   sequential loop.
 */

import { Criterion } from "../models/Criterion.js";
import { Event } from "../models/index.js";

const EVENT_ID = "evt_01";

const DEFAULT_CRITERIA = [
  { name: "Innovation", weight: 0.3, order: 0 },
  { name: "Technical Depth", weight: 0.3, order: 1 },
  { name: "Impact", weight: 0.25, order: 2 },
  { name: "Polish", weight: 0.15, order: 3 },
];

export async function seedT2RubricAndAssignments(): Promise<void> {
  await Promise.all(
    DEFAULT_CRITERIA.map((c) => {
      const id = `crit_${c.order}_${c.name.toLowerCase().replace(/\s+/g, "_")}`;
      return Criterion.findOneAndUpdate(
        { id },
        {
          id,
          eventId: EVENT_ID,
          name: c.name,
          weight: c.weight,
          order: c.order,
          isActive: true,
          description: `${c.name} criterion for weighted IMBR-BT ranking`,
        },
        { upsert: true },
      );
    }),
  );

  // Legacy display mirror only — routes/scores.ts, routes/export.ts, and
  // routes/assignments.ts all read live weights from the Criterion
  // collection directly; nothing computes a score from this field.
  //
  // NOTE: routes/judges.ts's next-pair and ranking endpoints currently
  // still read `event.criteria` (this mirror) rather than the Criterion
  // collection. That route file is outside the scope of this change —
  // flagging it here since this is the one place that mirror gets
  // written, and it's the reason that route hasn't broken outright.
  const crits = await Criterion.find({ eventId: EVENT_ID, isActive: true })
    .sort({ order: 1 })
    .lean();
  await Event.updateOne(
    { id: EVENT_ID },
    { $set: { criteria: crits.map((c) => ({ id: c.id, label: c.name, weight: c.weight })) } },
  );

  console.log("[t2-seed] criteria:", crits.map((c) => `${c.name}=${c.weight}`).join(", "));
}
