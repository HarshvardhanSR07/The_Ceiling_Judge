# Architecture

## Runtime components

1. **backend** (Node/Express) — HTTP API, auth, role isolation, orchestration
2. **rag-service** (Python FastAPI) — embeddings, LanceDB, IMBR ranking updates
3. **mongo** — source of truth
4. **ollama** — local embeddings + optional LLM summaries

All talk over the internal Docker network. External traffic only hits port 8080.

## Layering (backend)

```
routes/        → thin HTTP adapters
middleware/    → auth + role isolation (critical for T2 peer-scores check)
services/      → use-cases (Observation, Assignment, Ranking, RAG client, Audit)
math/ + imbr/  → pure IMBR functions (no I/O)
models/        → Mongoose schemas / repositories
seed/          → loads fixtures.json, prints auth headers
```

## Data flow (one judgment)

1. Judge POSTs observation (soft preference ± facets)
2. Middleware authenticates and blocks peer access
3. ObservationService persists raw observation
4. Calls IMBR engine → updated (μ, Σ) for involved projects
5. Posteriors saved; audit entry written
6. AssignmentService returns next pair **or** clarifying question

## Offline guarantee

- No external API keys
- Models live on Docker volumes
- `docker compose up` works with network disconnected after first pull


## Vote / observation abuse controls (Judging Integrity)

See **THREAT-MODEL.md** for the full written defense. Implementation summary:

| Control | Behavior |
|---------|----------|
| Canonical pairs | `projectA < projectB`; soft pref → `6 - pref` on swap |
| Duplicates | Unique `(judgeId, pairKey)`; conflict → **409** (append-only) |
| Observation rate limit | 60 / 5 min **per judgeId** |
| Auth rate limit | 30 / 15 min **per IP+path** |
| Server timestamps | Client `createdAt` ignored |
| Assignment | Both projects must be assigned |
| Peer isolation | Peer score reads → **403** |
| Anomalies | `GET /api/organizer/anomalies` — same-score ≥80%, velocity, low diversity |

Code: `services/abuseService.ts`, `middleware/rateLimit.ts`, `routes/scores.ts`.
