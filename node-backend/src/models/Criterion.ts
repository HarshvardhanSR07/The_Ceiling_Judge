/**
 * @file models/Criterion.ts
 * @description Weighted judging rubric criteria (T2), one collection per event.
 *
 * `routes/assignments.ts` (create/update/list) and `routes/scores.ts`
 * (weights + dimension count for IMBR) both read/write this collection
 * directly — it is the live source of judging weights. `EventProjectPosterior.ts`'s
 * `Event.criteria` is kept only as a denormalized mirror for legacy
 * display (written once by `seed/t2Seed.ts`); nothing computes a score or
 * a ranking from that mirror.
 *
 * Note for anyone touching `routes/assignments.ts` later: its
 * `PATCH /api/organizer/criteria/:id` handler does not currently pass
 * `runValidators: true` to `findOneAndUpdate`, so this schema's `weight`
 * constraint (`min: 0`) is enforced on `create()` but not on that update.
 * That route file is out of scope for this change, but it's worth knowing
 * the model alone doesn't close that gap.
 */

import mongoose, { Schema, Document } from "mongoose";

export interface ICriterion extends Document {
  id: string;
  eventId: string;
  name: string;
  description?: string;
  weight: number;
  /** Display order in scorecards and CSV export columns. */
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CriterionSchema = new Schema<ICriterion>(
  {
    id: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: String,
    weight: { type: Number, required: true, min: 0 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CriterionSchema.index({ eventId: 1, order: 1 });

export const Criterion = mongoose.model<ICriterion>("Criterion", CriterionSchema);
