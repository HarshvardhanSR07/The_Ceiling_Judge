/**
 * @file services/assignmentService.ts
 * @description Judge-to-project assignment management.
 *
 * Key changes from original
 * ─────────────────────────
 * • `autoAssign` now computes all new rows in memory, then writes them with a
 *   single `insertMany` call and a single `bulkWrite` for the denormalized
 *   `User.assignedProjects` field.  The original loop issued 3 sequential
 *   DB operations per project (findOne + create + updateOne), which for
 *   100 projects meant 300 round-trips.  The new approach is 4 round-trips
 *   regardless of project count.
 *
 * • `isAssigned` and `isAssignedToBoth` are the canonical assignment-check
 *   functions.  Middleware must call these rather than duplicating the logic.
 *
 * • `judgeProgress` is unchanged; `allJudgesProgress` parallelises with
 *   `Promise.all` (the original used `Promise.all` already — preserved here).
 */

import { randomUUID } from "crypto";
import { Assignment, IAssignment } from "../models/Assignment.js";
import { Observation }             from "../models/Observation.js";
import { User }                    from "../models/User.js";
import { Project }                 from "../models/index.js";

// ---------------------------------------------------------------------------
// Assignment existence checks (used by middleware)
// ---------------------------------------------------------------------------

/**
 * Returns `true` if `judgeId` has an active assignment for `projectId`.
 *
 * Performs a single indexed `exists` query — does not load the document.
 */
export async function isAssigned(judgeId: string, projectId: string): Promise<boolean> {
  return !!(await Assignment.exists({ judgeId, projectId }));
}

/**
 * Returns `true` only if `judgeId` is assigned to **both** `projectA` and
 * `projectB`.  Both checks run in parallel.
 *
 * Used by `requireAssignedJudge` for pairwise observation submissions.
 */
export async function isAssignedToBoth(
  judgeId:  string,
  projectA: string,
  projectB: string,
): Promise<boolean> {
  const [a, b] = await Promise.all([
    isAssigned(judgeId, projectA),
    isAssigned(judgeId, projectB),
  ]);
  return a && b;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * Returns all assignments matching the optional filter.
 *
 * @param filter.eventId  - Restrict to a specific event.
 * @param filter.judgeId  - Restrict to a specific judge.
 */
export async function listAssignments(filter: {
  eventId?: string;
  judgeId?: string;
}): Promise<IAssignment[]> {
  const query: Record<string, string> = {};
  if (filter.eventId) query.eventId = filter.eventId;
  if (filter.judgeId) query.judgeId = filter.judgeId;
  return Assignment.find(query).lean() as unknown as IAssignment[];
}

// ---------------------------------------------------------------------------
// Manual assignment
// ---------------------------------------------------------------------------

/**
 * Assigns a single judge to a single project.  Idempotent — calling it twice
 * with the same arguments returns the existing row without error.
 *
 * Also keeps `User.assignedProjects` in sync so the middleware's fast-path
 * (`req.user.assignedProjects.includes(...)`) stays accurate.
 *
 * @param input.eventId   - The event this assignment belongs to.
 * @param input.judgeId   - Application-level ID of the judge user.
 * @param input.projectId - Application-level ID of the project.
 */
export async function assignManual(input: {
  eventId:   string;
  judgeId:   string;
  projectId: string;
}): Promise<IAssignment> {
  const doc = await Assignment.findOneAndUpdate(
    { judgeId: input.judgeId, projectId: input.projectId },
    {
      $setOnInsert: {
        id:        `asg_${randomUUID().slice(0, 8)}`,
        eventId:   input.eventId,
        judgeId:   input.judgeId,
        projectId: input.projectId,
        status:    "pending",
        source:    "manual",
      },
    },
    { upsert: true, new: true },
  );

  // Keep denormalized field in sync
  await User.updateOne(
    { id: input.judgeId },
    { $addToSet: { assignedProjects: input.projectId } },
  );

  return doc;
}

// ---------------------------------------------------------------------------
// Algorithmic batch assignment
// ---------------------------------------------------------------------------

/**
 * Distributes projects across active judges using round-robin load balancing.
 *
 * Performance: O(4) database round-trips regardless of project/judge count.
 *   1. Load all active judges
 *   2. Load all projects (filtered by track if provided)
 *   3. Load existing assignments (to skip already-assigned pairs)
 *   4. `insertMany` new assignments (ordered: false allows partial success)
 *   5. `bulkWrite` to update `User.assignedProjects` for all affected judges
 *
 * Previously this was an O(3n) sequential loop (findOne + create + updateOne
 * per project), which caused 300 round-trips for 100 projects.
 *
 * @param input.eventId        - Event the assignments belong to.
 * @param input.trackId        - Optional track filter; assigns only projects
 *                               in that track.
 * @param input.replaceExisting - If true, all existing assignments for the
 *                               event are deleted first and the round-robin
 *                               starts fresh.
 */
export async function autoAssign(input: {
  eventId:         string;
  trackId?:        string;
  replaceExisting?: boolean;
}): Promise<{ created: number; judges: number; projects: number }> {

  // 1. Load judges and projects concurrently
  const projectFilter: Record<string, string> = {};
  if (input.trackId) projectFilter.trackId = input.trackId;

  const [judges, projects] = await Promise.all([
    User.find({ role: "judge", isActive: true }).lean(),
    Project.find(projectFilter).lean(),
  ]);

  if (judges.length === 0) {
    throw Object.assign(new Error("no active judges"), { status: 400 });
  }
  if (projects.length === 0) {
    throw Object.assign(new Error("no projects to assign"), { status: 400 });
  }

  // Clear existing assignments if requested
  if (input.replaceExisting) {
    await Promise.all([
      Assignment.deleteMany({ eventId: input.eventId }),
      User.updateMany({ role: "judge" }, { $set: { assignedProjects: [] } }),
    ]);
  }

  // 3. Load existing assignments in one query to build a skip-set
  const existing = await Assignment.find({ eventId: input.eventId })
    .select("judgeId projectId")
    .lean();
  const existingPairs = new Set(existing.map((a) => `${a.judgeId}:${a.projectId}`));

  // 4. Compute new assignment rows and per-judge project lists in memory
  const newDocs: object[] = [];
  const judgeProjectMap = new Map<string, string[]>(); // judgeId → projectIds to add

  for (let i = 0; i < projects.length; i++) {
    const judge     = judges[i % judges.length];
    const projectId = projects[i].id;

    if (existingPairs.has(`${judge.id}:${projectId}`)) continue;

    newDocs.push({
      id:        `asg_${randomUUID().slice(0, 8)}`,
      eventId:   input.eventId,
      judgeId:   judge.id,
      projectId,
      status:    "pending",
      source:    "auto",
    });

    const list = judgeProjectMap.get(judge.id) ?? [];
    list.push(projectId);
    judgeProjectMap.set(judge.id, list);
  }

  // 5. Batch-write: insertMany for assignments, bulkWrite for user denorm
  if (newDocs.length > 0) {
    await Assignment.insertMany(newDocs, { ordered: false });

    await User.bulkWrite(
      [...judgeProjectMap.entries()].map(([judgeId, projectIds]) => ({
        updateOne: {
          filter: { id: judgeId },
          update: { $addToSet: { assignedProjects: { $each: projectIds } } },
        },
      })),
    );
  }

  return { created: newDocs.length, judges: judges.length, projects: projects.length };
}

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

/** Per-judge progress snapshot. */
export interface JudgeProgress {
  judgeId:              string;
  assigned:             number;
  completed:            number;
  pending:              number;
  assignedProjectIds:   string[];
  completedProjectIds:  string[];
}

/**
 * Computes progress for a single judge.
 *
 * "Completed" means the judge has at least one observation where the project
 * appeared as `projectA` or `projectB`.
 *
 * @param judgeId - Application-level judge user ID.
 */
export async function judgeProgress(judgeId: string): Promise<JudgeProgress> {
  const [assignments, observations] = await Promise.all([
    Assignment.find({ judgeId }).lean(),
    Observation.find({ judgeId }).lean(),
  ]);

  const assignedIds = assignments.map((a) => a.projectId);

  const touched = new Set<string>();
  for (const o of observations) {
    touched.add(o.projectA);
    touched.add(o.projectB);
  }
  const completedIds = assignedIds.filter((id) => touched.has(id));

  return {
    judgeId,
    assigned:             assignedIds.length,
    completed:            completedIds.length,
    pending:              Math.max(0, assignedIds.length - completedIds.length),
    assignedProjectIds:   assignedIds,
    completedProjectIds:  completedIds,
  };
}

/**
 * Returns progress snapshots for all active judges, computed in parallel.
 */
export async function allJudgesProgress(): Promise<JudgeProgress[]> {
  const judges = await User.find({ role: "judge", isActive: true }).lean();
  return Promise.all(judges.map((j) => judgeProgress(j.id)));
}
