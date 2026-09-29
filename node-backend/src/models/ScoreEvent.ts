/**
 * @file models/Observation.ts
 * @description The append-only pairwise-judgment log (T2/T3).
 *
 * Every judge submission (`POST /api/judge/observations`) is one document
 * here. `routes/scores.ts` creates the Observation record *before* it
 * touches any Posterior document, specifically so the log stays the
 * authoritative, replayable source of truth even if something fails
 * partway through posterior application — see that route's own header
 * comment for the full reasoning.
 *
 * `pairKey` is always `min(projectA, projectB):max(...)`
 * (`services/abuseService.ts`'s `pairKey` / `canonicalizePair`), so the
 * unique `(judgeId, pairKey)` index is what actually enforces "one
 * observation per judge per pair" under concurrent submissions — the
 * duplicate pre-check in the route is an optimisation, not the security
 * boundary.
 *
 * `createdAt` is always set by the route handler (`new Date()`); a client-
 * supplied timestamp is never trusted, so a closed submission window can't
 * be worked around by backdating a request.
 */

import mongoose, { Schema, Document } from "mongoose";

export type ObservationChannel = "soft" | "binary" | "facet";

export interface IFacetMark {
  criterionId: string;
  winner: "A" | "B";
}

export interface IObservation extends Document {
  id: string;
  eventId: string;
  judgeId: string;
  projectA: string;
  projectB: string;
  /** soft = overall 1-5 preference; binary = winner only; facet = per-criterion marks only. */
  channel: ObservationChannel;
  /** 1-5, present only when channel is "soft". */
  preference?: number;
  /** Winning project id, present only when channel is "binary". */
  winnerId?: string;
  facets?: IFacetMark[];
  comment?: string;
  /** Canonical, judge-scoped key: min(projectA,projectB):max(...) */
  pairKey: string;
  createdAt: Date;
}

const ObservationSchema = new Schema<IObservation>(
  {
    id: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    judgeId: { type: String, required: true, index: true },
    projectA: { type: String, required: true, index: true },
    projectB: { type: String, required: true, index: true },
    channel: { type: String, enum: ["soft", "binary", "facet"], required: true },
    preference: { type: Number, min: 1, max: 5 },
    winnerId: String,
    facets: [
      {
        criterionId: { type: String, required: true },
        winner: { type: String, enum: ["A", "B"], required: true },
      },
    ],
    comment: { type: String, maxlength: 2000 },
    pairKey: { type: String, required: true, index: true },
    createdAt: { type: Date, required: true, index: true },
  },
  { timestamps: false },
);

// The hard concurrency guard referenced throughout routes/scores.ts and
// services/abuseService.ts's findDuplicateObservation.
ObservationSchema.index({ judgeId: 1, pairKey: 1 }, { unique: true });
// GET /api/judge/scores sorts by createdAt desc, scoped to one judge.
ObservationSchema.index({ judgeId: 1, createdAt: -1 });
// abuseService's high-velocity check filters by createdAt across all judges.
ObservationSchema.index({ createdAt: -1 });

export const Observation = mongoose.model<IObservation>("Observation", ObservationSchema);
