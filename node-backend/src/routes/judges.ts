/**
 * @file routes/judges.ts
 * @description Judge-facing endpoints: next comparison pair and live ranking.
 *
 * Next-pair selection (`GET /api/judge/next`)
 * ────────────────────────────────────────────
 * The heuristic selects the pair with the highest uncertainty (win probability
 * closest to 0.5), which maximises information gain per comparison.  The
 * current O(n²) brute-force scan loads all projects and posteriors from the
 * database and iterates every combination.
 *
 * At small scale (≤ 50 projects) this is fine.  At larger scale, replace the
 * inner loop with reservoir sampling over a random subset of candidates
 * (e.g., 20–30 pairs drawn without replacement from all project combinations).
 * This keeps response time constant regardless of project count while still
 * selecting high-information pairs with high probability.
 *
 * TODO (scalability): wrap pair selection in a reservoir sampler for events
 * with > 100 projects.  See services/pairSelector.ts (not yet created).
 *
 * Live ranking (`GET /api/organizer/ranking`)
 * ────────────────────────────────────────────
 * Loads all projects and posteriors in two parallel queries, computes the
 * weighted score for each project, and returns the sorted list.
 * At hackathon scale this is a single fast scan.  For larger events,
 * consider a materialized ranking refreshed asynchronously after each batch
 * of observations.
 */

import { Router, Response } from "express";
import { Project, Posterior, Event } from "../models/index.js";
import { AuthedRequest, requireRole } from "../middleware/auth.js";
import { score, winProb, defaultPosterior } from "../math/imbr.js";
import type { IPosterior } from "../models/index.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/judge/next
// ---------------------------------------------------------------------------

/**
 * Returns the next recommended project pair for the judge to compare.
 *
 * The pair is selected using an uncertainty-maximisation heuristic: the pair
 * whose current win probability is closest to 0.5 has the highest expected
 * information gain.  Projects with no posterior yet are treated as having the
 * uninformative prior (μ = 0, σ = 1).
 *
 * Response shape (pair found):
 * ```json
 * {
 *   "type": "pair",
 *   "projects": [ IProject, IProject ],
 *   "hint": "Mark overall preference 1–5; optionally add facet winners."
 * }
 * ```
 *
 * Response shape (fewer than 2 projects):
 * ```json
 * { "type": "done", "message": "not enough projects" }
 * ```
 *
 * @status 200 - Pair or done signal.
 */
router.get(
  "/api/judge/next",
  requireRole("judge", "organizer"),
  async (_req: AuthedRequest, res: Response) => {
    // Load event config and all project posteriors concurrently
    const [event, projects, posteriors] = await Promise.all([
      Event.findOne({}).lean(),
      Project.find({}).lean(),
      Posterior.find({}).lean(),
    ]);

    if (projects.length < 2) {
      return res.json({ type: "done", message: "not enough projects" });
    }

    const d = event?.criteria?.length || 2;
    const w = (event?.criteria ?? []).map((c) => c.weight || 1 / d);

    // Build a lookup map for O(1) posterior access inside the inner loop
    const posteriorById = new Map<string, IPosterior>(
      posteriors.map((p) => [p.projectId, p as IPosterior]),
    );

    // O(n²) uncertainty-maximisation scan
    // For n > 100 projects, replace with reservoir sampling over random pairs
    let bestI = 0;
    let bestJ = 1;
    let bestUncertainty = -1;

    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const pa = posteriorById.get(projects[i].id) ?? defaultPosterior(d);
        const pb = posteriorById.get(projects[j].id) ?? defaultPosterior(d);

        // Uncertainty = 1 − |2p − 1|, maximised when p = 0.5
        const p           = winProb(pa as any, pb as any, w);
        const uncertainty = 1 - Math.abs(2 * p - 1);

        if (uncertainty > bestUncertainty) {
          bestI           = i;
          bestJ           = j;
          bestUncertainty = uncertainty;
        }
      }
    }

    res.json({
      type:     "pair",
      projects: [projects[bestI], projects[bestJ]],
      hint:     "Mark overall preference 1–5; optionally add facet winners.",
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/organizer/ranking
// ---------------------------------------------------------------------------

/**
 * Returns all projects sorted by current IMBR score, descending.
 *
 * Each entry includes the scalar overall score, the full μ vector, and σ
 * (uncertainty) so the frontend can display confidence intervals.
 *
 * Response:
 * ```json
 * {
 *   "ranking": [
 *     { "id": "prj_abc", "title": "...", "score": 1.23, "mu": [...], "sigma": [...] }
 *   ]
 * }
 * ```
 *
 * @status 200 - Sorted ranking array.
 */
router.get(
  "/api/organizer/ranking",
  requireRole("admin", "organizer"),
  async (_req: AuthedRequest, res: Response) => {
    const [event, projects, posteriors] = await Promise.all([
      Event.findOne({}).lean(),
      Project.find({}).lean(),
      Posterior.find({}).lean(),
    ]);

    const d = event?.criteria?.length || 2;
    const w = (event?.criteria ?? []).map((c) => c.weight || 1 / d);

    const posteriorById = new Map<string, IPosterior>(
      posteriors.map((p) => [p.projectId, p as IPosterior]),
    );

    const ranking = projects
      .map((p) => {
        const post  = posteriorById.get(p.id) ?? defaultPosterior(d);
        const mu    = (post as any).mu    ?? defaultPosterior(d).mu;
        const sigma = (post as any).sigma ?? defaultPosterior(d).sigma;
        return {
          id:    p.id,
          title: p.title,
          score: score(mu, w),
          mu,
          sigma,
        };
      })
      .sort((a, b) => b.score - a.score);

    res.json({ ranking });
  },
);

export default router;
