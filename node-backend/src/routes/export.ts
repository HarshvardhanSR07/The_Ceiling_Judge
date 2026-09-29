/**
 * @file routes/export.ts
 * @description CSV export of project rankings for post-event analysis.
 *
 * Output columns
 * ──────────────
 *   project_id        — application-level ID (e.g. "prj_abc123")
 *   title             — project title (CSV-escaped)
 *   track_id          — track the project was submitted to
 *   overall_score     — w · μ (4 decimal places)
 *   mu_<criterion>    — per-criterion mean (one column per active criterion)
 *   mu_vector         — full μ vector as semicolon-joined string
 *   judge_count       — distinct judges who observed this project
 *   observation_count — total observations where this project appeared
 *
 * Performance note
 * ────────────────
 * The original implementation computed `observation_count` with a
 * `allObs.filter(o => o.projectA === p.id || o.projectB === p.id).length`
 * call inside the `projects.map()` loop — O(projects × observations).
 *
 * This version pre-computes both `judgeCount` and `observationCount` into
 * Maps in a single O(observations) pass, reducing the total work to
 * O(projects + observations).
 */

import { Router, Response } from "express";
import { Project, Posterior } from "../models/index.js";
import { Criterion }          from "../models/Criterion.js";
import { Observation }        from "../models/Observation.js";
import { AuthedRequest, requireRole } from "../middleware/auth.js";
import { score }              from "../math/imbr.js";
import { config }             from "../config/index.js";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escapes a string for embedding in a CSV cell.
 * - Wraps the value in double-quotes.
 * - Doubles any existing double-quote characters (`"` → `""`).
 *
 * @param value - Raw cell value (will be coerced to string).
 * @returns     - A CSV-safe double-quoted string.
 */
function csvCell(value: string | number | undefined | null): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/**
 * Sanitises a criterion name for use as a CSV column header.
 * Replaces all non-alphanumeric characters with underscores.
 */
function headerSlug(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}

// ---------------------------------------------------------------------------
// GET /api/export.csv
// ---------------------------------------------------------------------------

/**
 * Exports the current rankings as a CSV file.
 *
 * Requires organizer or admin role.  The export represents a snapshot of the
 * posterior means at the moment of the request.
 *
 * Query parameters:
 *   `eventId` — defaults to `config.defaultEventId`.
 *
 * @status 200 - CSV file download.
 */
router.get(
  "/api/export.csv",
  requireRole("organizer", "admin"),
  async (req: AuthedRequest, res: Response) => {
    const eventId = (req.query.eventId as string) || config.defaultEventId;

    // Load all required data concurrently
    const [criteria, projects, posteriors, observations] = await Promise.all([
      Criterion.find({ eventId, isActive: true }).sort({ order: 1 }).lean(),
      Project.find({}).lean(),
      Posterior.find({}).lean(),
      Observation.find({ eventId }).lean(),
    ]);

    const d       = criteria.length || 2;
    const weights = criteria.map((c) => c.weight || 1 / d);
    while (weights.length < d) weights.push(1 / d);

    // Index posteriors by projectId for O(1) lookup
    const posteriorById = new Map(posteriors.map((p) => [p.projectId, p]));

    // Pre-compute per-project judge set and observation count in one O(n) pass
    const judgesByProject = new Map<string, Set<string>>();
    const obsCountByProject = new Map<string, number>();

    for (const o of observations) {
      for (const projectId of [o.projectA, o.projectB]) {
        // Distinct judge set
        const judges = judgesByProject.get(projectId) ?? new Set<string>();
        judges.add(o.judgeId);
        judgesByProject.set(projectId, judges);

        // Total observation appearances
        obsCountByProject.set(projectId, (obsCountByProject.get(projectId) ?? 0) + 1);
      }
    }

    // Build CSV header
    const criterionHeaders = criteria.map((c) => `mu_${headerSlug(c.name)}`);
    const header = [
      "project_id",
      "title",
      "track_id",
      "overall_score",
      ...criterionHeaders,
      "mu_vector",
      "judge_count",
      "observation_count",
    ].join(",");

    // Build one CSV row per project
    const rows = projects.map((project) => {
      const post        = posteriorById.get(project.id);
      const mu          = post?.mu?.length ? post.mu : Array<number>(d).fill(0);
      const overallScore = score(mu, weights);
      const perCriterion = criteria.map((_, i) => (mu[i] ?? 0).toFixed(4));
      const judgeCount  = judgesByProject.get(project.id)?.size ?? 0;
      const obsCount    = obsCountByProject.get(project.id) ?? 0;

      return [
        project.id,
        csvCell(project.title),
        project.trackId ?? "",
        overallScore.toFixed(4),
        ...perCriterion,
        csvCell(mu.join(";")),
        judgeCount,
        obsCount,
      ].join(",");
    });

    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="forge-export-${timestamp}.csv"`,
    );
    res.status(200).send([header, ...rows].join("\n"));
  },
);

export default router;
