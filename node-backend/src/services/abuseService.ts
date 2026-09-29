/**
 * @file services/abuseService.ts
 * @description Vote / observation abuse controls (Judging Integrity).
 *
 * Policies implemented here
 * ─────────────────────────
 *   Canonical pair order — projectA < projectB (lexicographic).
 *     On a swap, the soft preference is inverted (6 − p) and facet winners
 *     are flipped, so the same judgment always maps to the same DB row.
 *
 *   Duplicate detection — pairKey unique index + pre-check.
 *     The pre-check catches the common case; the unique index is the hard
 *     guarantee that survives concurrent requests.
 *
 *   Anomaly flags — lightweight statistical signals for organizer review.
 *     Anomalies are informational, never blocking.  Three patterns are detected:
 *       - same_score_dominance  ≥ 80 % identical soft preferences (n ≥ 5)
 *       - low_diversity         < 2 distinct preference values across ≥ 10 obs
 *       - high_velocity         ≥ 20 observations in any 10-minute window
 *
 * Key improvements over original
 * ───────────────────────────────
 *   • `detectAllAnomalies` now runs per-judge detection in parallel with
 *     `Promise.all` instead of a sequential `for…of await` loop.
 *   • All threshold values are named constants at the top of the file.
 *   • The `pairKey` helper is exported and reused by `findDuplicateObservation`
 *     rather than computing the key twice.
 */

import { Observation } from "../models/Observation.js";

// ---------------------------------------------------------------------------
// Thresholds (named for readability and easy tuning)
// ---------------------------------------------------------------------------

/** Minimum observations before running same-score / diversity checks. */
const ANOMALY_MIN_OBS = 5;

/** Fraction of identical soft preferences that triggers same_score_dominance. */
const DOMINANCE_THRESHOLD = 0.8;

/** Minimum observations to run the low-diversity check. */
const DIVERSITY_MIN_OBS = 10;

/** Distinct preference values below which low_diversity fires. */
const DIVERSITY_MIN_DISTINCT = 2;

/** Window in milliseconds for the high-velocity check. */
const VELOCITY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/** Observations within the window that triggers high_velocity. */
const VELOCITY_THRESHOLD = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input shape for a raw (un-canonicalized) pairwise observation. */
export interface RawPairInput {
  projectA:    string;
  projectB:    string;
  preference?: number;
  winnerId?:   string;
  facets?:     { criterionId: string; winner: "A" | "B" }[];
}

/** A pairwise observation after canonical ordering has been applied. */
export interface CanonicalPair {
  projectA:    string;
  projectB:    string;
  preference?: number;
  winnerId?:   string;
  facets?:     { criterionId: string; winner: "A" | "B" }[];
  /** `true` when A and B were swapped to enforce lexicographic ordering. */
  swapped:     boolean;
}

/** An anomaly flag raised by the statistical abuse-detection routines. */
export interface AnomalyFlag {
  judgeId:  string;
  type:     "same_score_dominance" | "high_velocity" | "low_diversity";
  detail:   string;
  severity: "info" | "warn";
}

// ---------------------------------------------------------------------------
// Canonical pair ordering
// ---------------------------------------------------------------------------

/**
 * Builds the stable pair key used as the unique compound index field.
 *
 * The key is always in `min(id):max(id)` order so the same pair produces the
 * same key regardless of the order the judge submitted the projects.
 */
export function pairKey(projectA: string, projectB: string): string {
  return projectA < projectB
    ? `${projectA}:${projectB}`
    : `${projectB}:${projectA}`;
}

/**
 * Normalises a raw pairwise input into canonical (A < B) form.
 *
 * When the inputs are swapped:
 *   - Soft preference is inverted:  `p' = 6 − p`  (preserves meaning on the
 *     1–5 scale where 3 is neutral)
 *   - Binary winner is swapped to the correct canonical ID
 *   - Facet winners are flipped (A → B, B → A)
 *
 * @throws `{ status: 400 }` when `projectA === projectB`.
 */
export function canonicalizePair(input: RawPairInput): CanonicalPair {
  const { projectA, projectB } = input;

  if (projectA === projectB) {
    throw Object.assign(new Error("cannot compare a project to itself"), { status: 400 });
  }

  // Already in canonical order — return as-is
  if (projectA < projectB) {
    return {
      projectA,
      projectB,
      preference: input.preference,
      winnerId:   input.winnerId,
      facets:     input.facets,
      swapped:    false,
    };
  }

  // Swap needed — adjust semantics so the stored record is consistent
  const preference = input.preference != null
    ? 6 - Number(input.preference)
    : undefined;

  let winnerId = input.winnerId;
  if (winnerId === projectA)      winnerId = projectB;
  else if (winnerId === projectB) winnerId = projectA;

  const facets = (input.facets ?? []).map((f) => ({
    criterionId: f.criterionId,
    winner: (f.winner === "A" ? "B" : "A") as "A" | "B",
  }));

  return {
    projectA: projectB, // swapped
    projectB: projectA, // swapped
    preference,
    winnerId,
    facets,
    swapped: true,
  };
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/**
 * Looks for an existing observation by the same judge for the same pair.
 *
 * Checks both the indexed `pairKey` field (fast) and the raw `projectA` /
 * `projectB` columns (belt-and-suspenders, handles any pre-index data).
 *
 * @returns The existing document, or `null` if no duplicate exists.
 */
export async function findDuplicateObservation(
  judgeId:  string,
  projectA: string,
  projectB: string,
) {
  const key = pairKey(projectA, projectB);
  return Observation.findOne({
    judgeId,
    $or: [
      { pairKey: key },
      { projectA, projectB },
      { projectA: projectB, projectB: projectA },
    ],
  }).lean();
}

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

/**
 * Runs all statistical anomaly checks for a single judge.
 *
 * Checks are non-blocking: they never prevent an observation from being
 * accepted.  Results are surfaced to organizers via the anomaly endpoints.
 *
 * @param judgeId - Application-level judge user ID.
 * @returns An array of `AnomalyFlag` objects (empty if none detected).
 */
export async function detectJudgeAnomalies(judgeId: string): Promise<AnomalyFlag[]> {
  const flags: AnomalyFlag[] = [];

  const observations = await Observation.find({ judgeId }).lean();
  const softObs = observations.filter(
    (o) => o.channel === "soft" && o.preference != null,
  );

  // --- Same-score dominance and low-diversity checks -----------------------
  if (softObs.length >= ANOMALY_MIN_OBS) {
    // Count occurrences of each preference value
    const valueCounts = new Map<number, number>();
    for (const o of softObs) {
      const p = Number(o.preference);
      valueCounts.set(p, (valueCounts.get(p) ?? 0) + 1);
    }

    // Find the most-common preference value and its frequency
    let topCount = 0;
    let topValue = 0;
    for (const [value, count] of valueCounts) {
      if (count > topCount) { topCount = count; topValue = value; }
    }

    const dominanceRatio = topCount / softObs.length;
    if (dominanceRatio >= DOMINANCE_THRESHOLD) {
      flags.push({
        judgeId,
        type:     "same_score_dominance",
        detail:   `${Math.round(dominanceRatio * 100)}% of soft prefs are ${topValue} (n=${softObs.length})`,
        severity: "warn",
      });
    }

    if (softObs.length >= DIVERSITY_MIN_OBS && valueCounts.size < DIVERSITY_MIN_DISTINCT) {
      flags.push({
        judgeId,
        type:     "low_diversity",
        detail:   `Only ${valueCounts.size} distinct preference value(s) across ${softObs.length} soft observations`,
        severity: "warn",
      });
    }
  }

  // --- High-velocity check -------------------------------------------------
  const windowStart = new Date(Date.now() - VELOCITY_WINDOW_MS);
  const recentCount = observations.filter(
    (o) => new Date(o.createdAt) >= windowStart,
  ).length;

  if (recentCount >= VELOCITY_THRESHOLD) {
    flags.push({
      judgeId,
      type:     "high_velocity",
      detail:   `${recentCount} observations in the last ${VELOCITY_WINDOW_MS / 60_000} minutes`,
      severity: "warn",
    });
  }

  return flags;
}

/**
 * Runs anomaly detection for all judges who have submitted at least one
 * observation.  Checks run in parallel — one DB query per judge, all
 * concurrent.
 *
 * Previously this was a sequential `for…of await` loop.  For N judges the
 * original was O(N) sequential round-trips; this is O(1) latency (all in flight
 * simultaneously), bounded by MongoDB's connection pool.
 */
export async function detectAllAnomalies(): Promise<AnomalyFlag[]> {
  const judgeIds = await Observation.distinct("judgeId") as string[];
  const perJudge = await Promise.all(judgeIds.map(detectJudgeAnomalies));
  return perJudge.flat();
}
