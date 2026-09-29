/**
 * @file models/Assignment.ts
 * @description Strict judge <-> project assignment (T2).
 *
 * A judge may only submit observations for projects listed here —
 * enforced in `middleware/auth.ts`'s `requireAssignedJudge`, which reads
 * this collection through `services/assignmentService.ts`'s `isAssigned` /
 * `isAssignedToBoth`. `assignmentService.ts` (`assignManual`, `autoAssign`)
 * is the only code that should ever write a row here; `seed/authSeed.ts`
 * goes through `assignManual` for the same reason rather than writing to
 * this model directly.
 *
 * `id` carries a generated default. Every current writer (`assignManual`'s
 * `$setOnInsert`, `autoAssign`'s `insertMany` payload) already supplies an
 * explicit `id`, so the default is defense-in-depth rather than a fix for
 * an active bug here — but a schema that *requires* `id` with no default is
 * exactly the shape that, elsewhere in this project's history, let an
 * un-migrated upsert create a document with `id` silently absent (which
 * MongoDB's unique index then treats as `null`, so a second such upsert
 * collides on that same implicit null and throws `E11000`). A default
 * closes that failure mode off at the schema level for any future writer,
 * not just the call sites that happen to be careful today.
 */

import mongoose, { Schema, Document } from "mongoose";
import { randomUUID } from "crypto";

export type AssignmentStatus = "pending" | "in_progress" | "completed";

export interface IAssignment extends Document {
  id: string;
  eventId: string;
  judgeId: string;
  projectId: string;
  status: AssignmentStatus;
  source: "manual" | "auto" | "seed";
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `asg_${randomUUID().slice(0, 8)}`,
    },
    eventId: { type: String, required: true, index: true },
    judgeId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
      index: true,
    },
    source: {
      type: String,
      enum: ["manual", "auto", "seed"],
      default: "manual",
    },
  },
  { timestamps: true },
);

// Backs both assignManual's upsert filter and autoAssign's existing-pairs
// skip-set; also prevents two different code paths from ever creating two
// rows for the same (judge, project) pair.
AssignmentSchema.index({ judgeId: 1, projectId: 1 }, { unique: true });
AssignmentSchema.index({ eventId: 1, judgeId: 1 });

export const Assignment = mongoose.model<IAssignment>("Assignment", AssignmentSchema);
