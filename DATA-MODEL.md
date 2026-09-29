# Data Model — Forge (Dogfood T1 / T2)

MongoDB collections used by the offline portal. All identity and ranking state is local.

---

## Collections

### User
```
{
  id, email, name,
  role: "admin" | "organizer" | "judge" | "participant" | "visitor",
  passwordHash,          // bcrypt — UI login
  sessionToken,          // opaque cookie / Dogfood header
  assignedProjects?: string[],  // denormalized for fast checks
  tracks?: string[],
  isActive: boolean,
  createdAt, updatedAt
}
```

### Event
```
{
  id, name, submissionsClose,
  tracks: [{ id, name }],
  criteria: [{ id, label, weight }]   // mirror of Criterion rows (legacy readers)
}
```

### Criterion (T2 — separate weighted rubric collection)
```
{
  id, eventId,
  name,                // e.g. "Technical Depth"
  description?,
  weight: number,      // used by IMBR-BT overall projection & facets
  order: number,
  isActive: boolean,
  createdAt, updatedAt
}
```
Organizers create/update via `/api/organizer/criteria`. Ranking loads active criteria ordered by `order`.

### Project
```
{
  id, teamId, trackId, title, summary, repoUrl?, submittedAt
}
```

### Assignment (T2 — judge ↔ project, foundation of role isolation)
```
{
  id, eventId, judgeId, projectId,
  status: "pending" | "in_progress" | "completed",
  source: "manual" | "auto" | "seed",
  createdAt, updatedAt
}
```
- Unique `(judgeId, projectId)`.
- **Manual:** `POST /api/organizer/assignments`
- **Algorithmic:** `POST /api/organizer/assignments/auto` (round-robin load-balance)
- Middleware: a judge may only observe pairs where **both** `projectA` and `projectB` are assigned.

### Observation (T2 — append-only event log)
```
{
  id, eventId, judgeId,
  projectA, projectB,
  channel: "soft" | "binary" | "facet",
  preference?: 1..5,           // soft
  winnerId?: string,           // binary
  facets?: [{ criterionId, winner: "A"|"B" }],
  comment?: string,
  pairKey,                     // min(projectA,projectB):max(...) unique per judge
  createdAt                    // SERVER ONLY — client timestamps ignored
}
```
**Integrity rules**
1. `createdAt` is set exclusively in the controller (`new Date()`). Any client `createdAt` / `timestamp` field is discarded (prevents deadline manipulation).
2. Peer isolation: `GET /api/judge/scores` filters by `judgeId === requester` (organizer/admin may pass `?judge=`).
3. Assignment: `POST /api/judge/observations` requires both projects assigned to the judge.
4. Feeds IMBR-BT posterior updates; treated as an immutable log for audit / replay.
5. Duplicate `(judgeId, pairKey)` → HTTP **409**; inverted pairs canonicalized before write.

### Posterior (IMBR-BT state per project)
```
{
  projectId,
  mu: number[],      // length = #criteria
  sigma: number[],   // diagonal uncertainty
  updatedAt
}
```
Final rank score: `w · μ` with weights from Criterion.

### AuditLog
```
{ actorId, action, ip?, userAgent?, payload?, timestamp }
```
Login, register, assignment, observation, criterion changes.

---

## T2 API surface (judging integrity)

| Endpoint | Role | Purpose |
|----------|------|---------|
| `GET /api/judge/scores` | judge (own) / organizer | Own observations only; peer → **403** |
| `POST /api/judge/observations` | judge (+ assigned both) | Soft/binary/facets; server timestamp |
| `GET /api/assignments` | judge own / organizer all | Assignment list |
| `POST /api/organizer/assignments` | organizer | Manual assign |
| `POST /api/organizer/assignments/auto` | organizer | Round-robin batch |
| `GET /api/progress/:judgeId` | self or organizer | `{ assigned, completed, pending }` |
| `GET /api/organizer/progress` | organizer | All judges |
| `GET /api/criteria` | public read | Active weighted rubric |
| `POST/PATCH /api/organizer/criteria` | organizer | Manage weights |
| `GET /api/export.csv` | organizer/admin | Score + per-criterion μ + judge_count |

---

## Isolation summary

```
Request → attachUser → requireRole → requireOwnJudgeScores | requireAssignedJudge
                                                              ↓
                                                    Assignment table lookup
                                                              ↓
                                                    403 if peer or unassigned
```

Frontend hiding is never trusted. All isolation is enforced in Express middleware and query filters.
