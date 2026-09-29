/**
 * @file routes/scores.ts
 * @description Judge scoring endpoints: read own scores and submit observations.
 *
 * Observation submission pipeline (POST /api/judge/observations)
 * ──────────────────────────────────────────────────────────────
 * 1. Role + rate-limit + assignment checks (middleware)
 * 2. Input validation (projectA, projectB, channel, preference)
 * 3. Canonical pair ordering (abuseService)
 * 4. Duplicate detection — 409 if already submitted
 * 5. Channel classification and per-channel validation
 * 6. Criteria load (used for weights and dimension count)
 * 7. **Observation record created first** — if anything fails later,
 *    the log stays accurate and posteriors can be replayed from it.
 *    (Previously posteriors were mutated before the observation was
 *    persisted, meaning a crash between steps would corrupt the ranking.)
 * 8. IMBR posterior update
 * 9. Posterior save
 * 10. Audit write (fire-and-forget)
 *
 * The unique index on `(judgeId, pairKey)` is the hard concurrency guard
 * against duplicate submissions.  The pre-check (step 4) is an optimisation
 * that avoids the IMBR computation for obvious duplicates, not a security
 * boundary.
 */

import { Router, Response } from "express";
import { randomUUID }       from "crypto";
import { Posterior }        from "../models/index.js";
import { Observation }      from "../models/Observation.js";
import { Criterion }        from "../models/Criterion.js";
import {
  AuthedRequest,
  requireRole,
  requireOwnJudgeScores,
  requireAssignedJudge,
}                           from "../middleware/auth.js";
import { rateLimitObserve } from "../middleware/rateLimit.js";
import {
  defaultPosterior,
  updateSoft,
  updateFacet,
  score,
}                           from "../math/imbr.js";
import { writeAudit }       from "../services/audit.js";
import {
  canonicalizePair,
  pairKey,
  findDuplicateObservation,
}                           from "../services/abuseService.js";
import { config }           from "../config/index.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/judge/scores
// ---------------------------------------------------------------------------

/**
 * Returns the authenticated judge's own observations, newest first.
 *
 * Organizers and admins may pass `?judge=<judgeId>` to read any judge's
 * observations.  Judges requesting a peer's data are blocked by
 * `requireOwnJudgeScores` with a 403.
 *
 * @status 200 - `{ judgeId: string, observations: IObservation[] }`
 * @status 401 - Not authenticated.
 * @status 403 - Peer score access attempt.
 */
router.get(
  "/api/judge/scores",
  requireOwnJudgeScores,
  async (req: AuthedRequest, res: Response) => {
    const isPrivileged = req.user!.role === "organizer" || req.user!.role === "admin";
    const judgeId = isPrivileged
      ? (req.query.judge as string) || req.user!.id
      : req.user!.id;

    const observations = await Observation.find({ judgeId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ judgeId, observations });
  },
);

// ---------------------------------------------------------------------------
// POST /api/judge/observations
// ---------------------------------------------------------------------------

/**
 * Submits a pairwise observation (judgment) for two assigned projects.
 *
 * Request body:
 * ```json
 * {
 *   "projectA":  "prj_abc",
 *   "projectB":  "prj_def",
 *   "channel":   "soft" | "binary" | "facet",
 *   "preference": 1 | 2 | 3 | 4 | 5,   // required for soft channel
 *   "winnerId":  "prj_abc",              // required for binary channel
 *   "facets": [                          // optional per-criterion marks
 *     { "criterionId": "crit_01", "winner": "A" | "B" }
 *   ],
 *   "comment":   "optional free text ≤ 2000 chars",
 *   "eventId":   "evt_01"               // defaults to config.defaultEventId
 * }
 * ```
 *
 * @status 201 - Observation accepted.
 * @status 400 - Validation failure.
 * @status 403 - Not assigned to the project(s).
 * @status 409 - Duplicate pair for this judge.
 * @status 429 - Rate limit exceeded.
 */
router.post(
  "/api/judge/observations",
  requireRole("judge", "organizer", "admin"),
  rateLimitObserve,
  requireAssignedJudge,
  async (req: AuthedRequest, res: Response) => {
    const body   = req.body ?? {};
    const rawA   = body.projectA as string;
    const rawB   = body.projectB as string;
    const eventId = (body.eventId as string) || config.defaultEventId;

    // --- Input presence check -----------------------------------------------
    if (!rawA || !rawB) {
      return res.status(400).json({ error: "projectA and projectB are required" });
    }

    // --- Canonical pair ordering --------------------------------------------
    let canonical;
    try {
      canonical = canonicalizePair({
        projectA:   rawA,
        projectB:   rawB,
        preference: body.preference != null ? Number(body.preference) : undefined,
        winnerId:   body.winnerId,
        facets:     body.facets,
      });
    } catch (err: any) {
      return res.status(err.status ?? 400).json({ error: err.message });
    }

    const { projectA, projectB, preference, winnerId, facets, swapped } = canonical;
    const key = pairKey(projectA, projectB);

    // --- Duplicate pre-check ------------------------------------------------
    const duplicate = await findDuplicateObservation(req.user!.id, projectA, projectB);
    if (duplicate) {
      writeAudit(req.user!.id, "observation.duplicate", {
        projectA, projectB, pairKey: key, existingId: duplicate.id,
      });
      return res.status(409).json({
        error:      "duplicate observation for this pair",
        pairKey:    key,
        existingId: duplicate.id,
        policy:     "append-only: resubmits rejected with 409",
      });
    }

    // --- Channel resolution -------------------------------------------------
    type Channel = "soft" | "binary" | "facet";
    let channel: Channel;
    if (body.channel === "binary" || winnerId)                         channel = "binary";
    else if (body.channel === "facet" && preference == null)           channel = "facet";
    else                                                               channel = "soft";

    // --- Per-channel validation ---------------------------------------------
    if (channel === "soft") {
      if (preference == null || ![1, 2, 3, 4, 5].includes(Number(preference))) {
        return res.status(400).json({ error: "preference must be 1–5 for the soft channel" });
      }
    }
    if (channel === "binary") {
      if (winnerId !== projectA && winnerId !== projectB) {
        return res.status(400).json({ error: "winnerId must be projectA or projectB" });
      }
    }

    // --- Load criteria (weights + dimension count) --------------------------
    const criteria = await Criterion.find({ eventId, isActive: true })
      .sort({ order: 1 })
      .lean();
    const d = criteria.length || 2;
    const w = criteria.map((c) => c.weight || 1 / d);
    while (w.length < d) w.push(1 / d);

    // Server-authoritative timestamp — client-supplied timestamps are ignored
    const createdAt = new Date();

    // --- Persist observation FIRST ------------------------------------------
    // The observation record is created before posterior updates so that if
    // the process crashes mid-flight the append-only log stays consistent.
    // Posteriors can be fully replayed from the observation log; the reverse
    // is not true.
    let obs;
    try {
      obs = await Observation.create({
        id:         randomUUID(),
        eventId,
        judgeId:    req.user!.id,
        projectA,
        projectB,
        pairKey:    key,
        channel,
        preference: channel === "soft"   ? Number(preference) : undefined,
        winnerId:   channel === "binary" ? winnerId            : undefined,
        facets:     facets ?? [],
        comment:    typeof body.comment === "string"
          ? body.comment.slice(0, 2000)
          : undefined,
        createdAt,
      });
    } catch (err: any) {
      // Unique-index race (concurrent identical submission)
      if (err?.code === 11000) {
        writeAudit(req.user!.id, "observation.duplicate", {
          projectA, projectB, pairKey: key, reason: "unique_index",
        });
        return res.status(409).json({
          error:   "duplicate observation for this pair",
          pairKey: key,
          policy:  "append-only: resubmits rejected with 409",
        });
      }
      throw err;
    }

    // --- IMBR posterior update ---------------------------------------------
    // Initialise posteriors for projects that have never been observed
    const [postADoc, postBDoc] = await Promise.all([
      Posterior.findOne({ projectId: projectA }),
      Posterior.findOne({ projectId: projectB }),
    ]);

    const postA = postADoc ?? await Posterior.create({
      projectId: projectA, ...defaultPosterior(d), updatedAt: createdAt,
    });
    const postB = postBDoc ?? await Posterior.create({
      projectId: projectB, ...defaultPosterior(d), updatedAt: createdAt,
    });

    let a = { mu: [...postA.mu], sigma: [...postA.sigma] };
    let b = { mu: [...postB.mu], sigma: [...postB.sigma] };

    // Soft or binary update (binary is mapped to preference 5 or 1)
    if (channel === "soft" || channel === "binary") {
      const pref = channel === "binary"
        ? (winnerId === projectA ? 5 : 1)
        : Number(preference);
      ({ a, b } = updateSoft(a, b, { preference: pref, w }));
    }

    // Optional per-facet updates
    for (const f of facets ?? []) {
      const idx = criteria.findIndex((c) => c.id === f.criterionId);
      if (idx >= 0) {
        ({ a, b } = updateFacet(a, b, { criterionIndex: idx, winnerIsA: f.winner === "A" }));
      }
    }

    // Save updated posteriors (parallel)
    postA.mu = a.mu; postA.sigma = a.sigma; postA.updatedAt = createdAt;
    postB.mu = b.mu; postB.sigma = b.sigma; postB.updatedAt = createdAt;
    await Promise.all([postA.save(), postB.save()]);

    // Audit (fire-and-forget)
    writeAudit(req.user!.id, "observation", {
      projectA, projectB, pairKey: key, channel, preference, swapped,
    });

    res.status(201).json({
      observation: obs,
      canonical:   { projectA, projectB, swapped, pairKey: key },
      updated: {
        [projectA]: { mu: a.mu, score: score(a.mu, w) },
        [projectB]: { mu: b.mu, score: score(b.mu, w) },
      },
    });
  },
);

// ---------------------------------------------------------------------------
// POST /api/judge/observations/forfeit
// ---------------------------------------------------------------------------

router.post(
  "/api/judge/observations/forfeit",
  requireRole("judge", "organizer", "admin"),
  rateLimitObserve,
  requireAssignedJudge,
  async (req: AuthedRequest, res: Response) => {
    const { projectA: rawA, projectB: rawB, reason } = req.body ?? {};

    if (!rawA || !rawB) {
      return res.status(400).json({ error: "projectA and projectB are required" });
    }

    let projectA = String(rawA);
    let projectB = String(rawB);
    if (projectA > projectB) {
      projectA = String(rawB);
      projectB = String(rawA);
    }

    writeAudit(req.user!.id, "observation.forfeit", {
      projectA,
      projectB,
      reason,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({ message: "Forfeit recorded" });
  }
);

export default router;
