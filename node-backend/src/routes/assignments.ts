/**
 * @file routes/assignments.ts
 * @description Assignment management, judge progress, criteria CRUD, and
 * organizer anomaly endpoints.
 *
 * Route summary
 * ─────────────
 *   GET  /api/assignments                  — list assignments (scoped by role)
 *   POST /api/organizer/assignments         — manual assign judge → project
 *   POST /api/organizer/assignments/auto    — algorithmic round-robin assign
 *   GET  /api/progress/:judgeId             — one judge's progress
 *   GET  /api/organizer/progress            — all judges' progress (dashboard)
 *   GET  /api/criteria                      — active criteria for event
 *   POST /api/organizer/criteria            — create a criterion
 *   PATCH /api/organizer/criteria/:id       — update a criterion
 *   GET  /api/organizer/anomalies           — all judges' anomaly flags
 *   GET  /api/organizer/anomalies/:judgeId  — one judge's anomaly flags
 *
 * Key changes from original
 * ─────────────────────────
 * • All `DEFAULT_EVENT` literals replaced with `config.defaultEventId`.
 * • `writeAudit` calls are fire-and-forget (no `await`): a failed audit write
 *   must never surface as a 500 on an otherwise-successful request.
 * • Criterion weight is validated to be a positive finite number before create.
 * • Error responses are consistent: `{ error: string }` with the HTTP status
 *   from the thrown error or 500 as fallback.
 */

import { Router, Response } from "express";
import { randomUUID }       from "crypto";
import { AuthedRequest, requireRole } from "../middleware/auth.js";
import {
  assignManual,
  autoAssign,
  listAssignments,
  judgeProgress,
  allJudgesProgress,
}                           from "../services/assignmentService.js";
import { Criterion }        from "../models/Criterion.js";
import { writeAudit }       from "../services/audit.js";
import {
  detectAllAnomalies,
  detectJudgeAnomalies,
}                           from "../services/abuseService.js";
import { config }           from "../config/index.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/assignments
// ---------------------------------------------------------------------------

/**
 * Lists assignments for an event.
 *
 * - Judges see only their own assignments.
 * - Organizers and admins may pass `?judgeId=<id>` to filter by judge,
 *   or omit it to retrieve all assignments.
 *
 * @status 200 - `{ assignments: IAssignment[] }`
 */
router.get(
  "/api/assignments",
  requireRole("admin", "organizer", "judge"),
  async (req: AuthedRequest, res: Response) => {
    const judgeId = req.user!.role === "judge"
      ? req.user!.id
      : (req.query.judgeId as string | undefined);

    const assignments = await listAssignments({
      eventId: (req.query.eventId as string) || config.defaultEventId,
      judgeId,
    });

    res.json({ assignments });
  },
);

// ---------------------------------------------------------------------------
// POST /api/organizer/assignments
// ---------------------------------------------------------------------------

/**
 * Manually assigns a single judge to a single project.  Idempotent.
 *
 * Body: `{ judgeId: string, projectId: string, eventId?: string }`
 *
 * @status 201 - `{ assignment: IAssignment }`
 * @status 400 - Missing `judgeId` or `projectId`.
 */
router.post(
  "/api/organizer/assignments",
  requireRole("admin", "organizer"),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { judgeId, projectId, eventId } = req.body ?? {};
      if (!judgeId || !projectId) {
        return res.status(400).json({ error: "judgeId and projectId are required" });
      }

      const assignment = await assignManual({
        eventId:   eventId || config.defaultEventId,
        judgeId,
        projectId,
      });

      // Fire-and-forget — never block the response on audit writes
      writeAudit(req.user!.id, "assignment.manual", { judgeId, projectId });

      res.status(201).json({ assignment });
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/organizer/assignments/auto
// ---------------------------------------------------------------------------

/**
 * Runs the algorithmic round-robin assignment across all active judges and
 * projects (optionally filtered to one track).
 *
 * Body:
 * ```json
 * {
 *   "eventId":         "evt_01",   // optional
 *   "trackId":         "trk_ml",   // optional — limits to one track
 *   "replaceExisting": true         // optional — wipes and re-assigns
 * }
 * ```
 *
 * @status 201 - `{ created: number, judges: number, projects: number }`
 * @status 400 - No active judges or no projects found.
 */
router.post(
  "/api/organizer/assignments/auto",
  requireRole("admin", "organizer"),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { eventId, trackId, replaceExisting } = req.body ?? {};
      const result = await autoAssign({
        eventId:         eventId || config.defaultEventId,
        trackId,
        replaceExisting: !!replaceExisting,
      });

      writeAudit(req.user!.id, "assignment.auto", result as Record<string, unknown>);

      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/progress/:judgeId
// ---------------------------------------------------------------------------

/**
 * Returns progress for a single judge (assigned / completed / pending counts).
 *
 * Judges may only view their own progress.  Organizers and admins may view
 * any judge.
 *
 * @status 200 - `JudgeProgress`
 * @status 403 - Judge attempting to read a peer's progress.
 */
router.get(
  "/api/progress/:judgeId",
  requireRole("admin", "organizer", "judge"),
  async (req: AuthedRequest, res: Response) => {
    const targetId = req.params.judgeId;

    if (req.user!.role === "judge" && req.user!.id !== targetId) {
      return res.status(403).json({ error: "cannot view peer progress" });
    }

    const progress = await judgeProgress(targetId);
    res.json(progress);
  },
);

// ---------------------------------------------------------------------------
// GET /api/organizer/progress
// ---------------------------------------------------------------------------

/**
 * Returns progress snapshots for all active judges.
 * Intended for the organizer dashboard.
 *
 * @status 200 - `{ judges: JudgeProgress[] }`
 */
router.get(
  "/api/organizer/progress",
  requireRole("admin", "organizer"),
  async (_req: AuthedRequest, res: Response) => {
    const judges = await allJudgesProgress();
    res.json({ judges });
  },
);

// ---------------------------------------------------------------------------
// GET /api/criteria
// ---------------------------------------------------------------------------

/**
 * Returns the active judging criteria for an event, ordered by `order` field.
 * Public — no auth required.
 *
 * @status 200 - `{ criteria: ICriterion[] }`
 */
router.get("/api/criteria", async (req, res) => {
  const eventId = (req.query.eventId as string) || config.defaultEventId;
  const criteria = await Criterion.find({ eventId, isActive: true })
    .sort({ order: 1 })
    .lean();
  res.json({ criteria });
});

// ---------------------------------------------------------------------------
// POST /api/organizer/criteria
// ---------------------------------------------------------------------------

/**
 * Creates a new judging criterion for an event.
 *
 * Body:
 * ```json
 * {
 *   "name":        "Innovation",
 *   "weight":      0.4,
 *   "description": "Novelty and originality of the idea",
 *   "order":       1,
 *   "eventId":     "evt_01"
 * }
 * ```
 *
 * @status 201 - `{ criterion: ICriterion }`
 * @status 400 - Missing `name` or `weight`, or `weight` is not a positive number.
 */
router.post(
  "/api/organizer/criteria",
  requireRole("admin", "organizer"),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { name, weight, description, order, eventId } = req.body ?? {};

      if (!name || weight == null) {
        return res.status(400).json({ error: "name and weight are required" });
      }

      const parsedWeight = Number(weight);
      if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
        return res.status(400).json({ error: "weight must be a positive number" });
      }

      const doc = await Criterion.create({
        id:          `crit_${randomUUID().slice(0, 8)}`,
        eventId:     eventId || config.defaultEventId,
        name:        String(name).trim(),
        description: description ? String(description).trim() : undefined,
        weight:      parsedWeight,
        order:       order ?? 0,
        isActive:    true,
      });

      writeAudit(req.user!.id, "criterion.create", { id: doc.id, name, weight });

      res.status(201).json({ criterion: doc });
    } catch (err: any) {
      res.status(err.status ?? 500).json({ error: err.message });
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/organizer/criteria/:id
// ---------------------------------------------------------------------------

/**
 * Partially updates a criterion.  Only the fields present in the request body
 * are modified; omitted fields are left unchanged.
 *
 * Updatable fields: `name`, `weight`, `description`, `order`, `isActive`.
 *
 * @status 200 - `{ criterion: ICriterion }`
 * @status 404 - Criterion not found.
 */
router.patch(
  "/api/organizer/criteria/:id",
  requireRole("admin", "organizer"),
  async (req: AuthedRequest, res: Response) => {
    const ALLOWED_FIELDS = ["name", "weight", "description", "order", "isActive"] as const;
    const updates: Record<string, unknown> = {};

    for (const field of ALLOWED_FIELDS) {
      if (req.body?.[field] !== undefined) updates[field] = req.body[field];
    }

    const doc = await Criterion.findOneAndUpdate(
      { id: req.params.id },
      { $set: updates },
      { new: true },
    );

    if (!doc) return res.status(404).json({ error: "criterion not found" });

    writeAudit(req.user!.id, "criterion.update", { id: req.params.id, ...updates });

    res.json({ criterion: doc });
  },
);

// ---------------------------------------------------------------------------
// GET /api/organizer/anomalies
// ---------------------------------------------------------------------------

/**
 * Returns anomaly flags for all judges who have submitted observations.
 * All checks run in parallel — see `detectAllAnomalies` for the pattern list.
 *
 * @status 200 - `{ flags: AnomalyFlag[] }`
 */
router.get(
  "/api/organizer/anomalies",
  requireRole("admin", "organizer"),
  async (_req: AuthedRequest, res: Response) => {
    const flags = await detectAllAnomalies();
    res.json({ flags });
  },
);

// ---------------------------------------------------------------------------
// GET /api/organizer/anomalies/:judgeId
// ---------------------------------------------------------------------------

/**
 * Returns anomaly flags for a single judge.
 *
 * @status 200 - `{ judgeId: string, flags: AnomalyFlag[] }`
 */
router.get(
  "/api/organizer/anomalies/:judgeId",
  requireRole("admin", "organizer"),
  async (req: AuthedRequest, res: Response) => {
    const judgeId = req.params.judgeId;
    const flags   = await detectJudgeAnomalies(judgeId);
    res.json({ judgeId, flags });
  },
);

export default router;
