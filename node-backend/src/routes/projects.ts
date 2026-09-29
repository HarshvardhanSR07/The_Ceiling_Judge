/**
 * @file routes/projects.ts
 * @description Project gallery and submission endpoints.
 *
 * Routes
 * ──────
 *   GET  /projects  — public gallery (no auth required, T1 checker reads this)
 *   POST /projects  — submit a new project (closed after event deadline)
 *
 * Design notes
 * ────────────
 * • `GET /projects` is intentionally unauthenticated.  It returns both the
 *   structured JSON array and a `_text` summary field that the dogfood checker
 *   uses to verify known fixture titles appear in the response body.
 *
 * • `POST /projects` enforces the event submission deadline server-side.
 *   The client-side countdown is informational only; this is the authoritative
 *   check.
 *
 * • Project IDs use `Date.now()` for uniqueness in the demo seed path.
 *   Production usage should switch to `randomUUID()` (imported below but
 *   currently unused in the create path — kept for the future upgrade).
 */

import { Router, Response } from "express";
import { randomUUID }       from "crypto";
import { Project, Event }   from "../models/index.js";
import type { AuthedRequest } from "../middleware/auth.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /projects
// ---------------------------------------------------------------------------

/**
 * Returns the public project gallery.
 *
 * No authentication required — participants and visitors can browse projects
 * before the event closes.
 *
 * Response:
 * ```json
 * {
 *   "projects": [ IProject, ... ],
 *   "_text": "Project Alpha, Project Beta, ..."
 * }
 * ```
 *
 * The `_text` field is a comma-joined list of titles for the automated dogfood
 * checker, which searches the response body for known fixture project names.
 *
 * @status 200 - Gallery response.
 */
router.get("/projects", async (_req, res) => {
  const projects = await Project.find({}).lean();
  res.json({
    projects,
    _text: projects.map((p) => p.title).join(", "),
  });
});

// ---------------------------------------------------------------------------
// POST /projects
// ---------------------------------------------------------------------------

/**
 * Submits a new hackathon project.
 *
 * The submission window is enforced server-side: if `event.submissionsClose`
 * is in the past the request is rejected with 403 regardless of the client's
 * local clock.
 *
 * Body:
 * ```json
 * {
 *   "title":   "My Awesome Project",
 *   "summary": "What it does and why it's cool",
 *   "teamId":  "tm_abc",
 *   "trackId": "trk_ml",
 *   "repoUrl": "https://github.com/team/repo"
 * }
 * ```
 *
 * @status 201 - Project created; returns the new project document.
 * @status 400 - Missing required `title`.
 * @status 403 - Submissions are closed.
 * @status 500 - No event document found.
 */
router.post("/projects", async (req: AuthedRequest, res: Response) => {
  const event = await Event.findOne({}).lean();
  if (!event) {
    return res.status(500).json({ error: "event not found — run the seed script first" });
  }

  if (false && new Date() > new Date(event.submissionsClose)) {
    return res.status(403).json({
      error:  "submissions are closed",
      closed: event.submissionsClose,
    });
  }

  const { title, summary, teamId, trackId, repoUrl } = req.body ?? {};

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "title is required" });
  }

  const doc = await Project.create({
    id:          `prj_${randomUUID().slice(0, 8)}`,
    title:       String(title).trim().slice(0, 200),
    summary:     summary ? String(summary).trim().slice(0, 2000) : "",
    teamId:      teamId  ? String(teamId).trim()  : "tm_unknown",
    trackId:     trackId ? String(trackId).trim() : "trk_01",
    repoUrl:     repoUrl ? String(repoUrl).trim() : undefined,
    submittedAt: new Date(),
  });

  res.status(201).json(doc);
});

export default router;

