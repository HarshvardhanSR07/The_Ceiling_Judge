# Threat Model — Judging & Vote Abuse (Forge)

Offline Dogfood portal. This document is the written defense for **Judging Integrity** and the optional **Threat Model** stretch points.

---

## Assets

| Asset | Why it matters |
|-------|----------------|
| Observation log | Ground truth for IMBR-BT ranking; must stay append-only |
| Posteriors / ranking | Determines winners |
| Peer ballots | Confidentiality of other judges’ scores |
| Assignment map | Prevents scoring outside mandate |
| Auth sessions / JWTs | Impersonation boundary |

---

## Actors

| Actor | Capability |
|-------|------------|
| Visitor | Public gallery only |
| Participant | Own projects; no judge APIs |
| Judge | Assigned projects only; own observations |
| Organizer / Admin | All scores, assignment, export, anomaly view |
| External attacker | No valid session; may probe HTTP APIs |

---

## Threats and controls

### T1 — Peer ballot disclosure
**Threat:** Judge B reads Judge A’s scores via API.  
**Control:** `requireOwnJudgeScores` middleware → **403**. Organizer/admin only may pass `?judge=`.  
**Residual:** Compromised organizer session (ops control).

### T2 — Scoring unassigned projects
**Threat:** Judge submits observations for projects they were not assigned.  
**Control:** `requireAssignedJudge` requires **both** `projectA` and `projectB` in the Assignment table → **403**.  
**Residual:** Organizer mis-assignment (process).

### T3 — Duplicate / inverted pair stuffing
**Threat:** Same pair submitted twice, or as `(B,A)` after `(A,B)`, to double-count soft updates.  
**Controls:**
1. **Canonical ordering:** store with `projectA < projectB` (lexicographic).
2. On swap, soft preference becomes `6 - preference`; binary winner and facet winners flip.
3. **`pairKey`** = `min:max`; unique index `(judgeId, pairKey)`.
4. Resubmit → **409 Conflict** (no silent update). Append-only log stays pure.
5. Audit action `observation.duplicate`.

### T4 — Observation spam / velocity abuse
**Threat:** Rapid automated observations to skew ranking or overload the service.  
**Control:** `rateLimitObserve` — **60 requests / 5 minutes per judgeId** → **429**.  
**Residual:** Distributed compromised judges (organizer anomaly view).

### T5 — Auth brute force / account flooding
**Threat:** Password guessing or mass registration.  
**Control:** `rateLimitAuth` — **30 requests / 15 minutes per IP+path** on login/register.  
**Residual:** Large IP pools (acceptable for offline hackathon scale).

### T6 — Client timestamp / deadline manipulation
**Threat:** Client sends backdated `createdAt` to appear inside a closed window.  
**Control:** Controller **ignores** client timestamps; sets `createdAt = new Date()` (server UTC) only.

### T7 — Same-score / low-diversity ballots
**Threat:** Judge always selects the same soft value (fixtures include this case); weak signal or protest voting.  
**Control (detect, not block):** Organizer endpoints  
`GET /api/organizer/anomalies`  
Flags: `same_score_dominance` (≥80% identical soft prefs), `low_diversity`, `high_velocity` (≥20 obs / 10 min).  
**Residual:** Legitimate harsh/lenient judges — flags are informational for organizers.

### T8 — Community vote Sybil (T3)
**Threat:** Multi-account public voting / ballot stuffing.  
**Controls (design):** one vote per `(userId, projectId)` (or IP hash if open mode), rate limit by userId+IP, hashed IP in audit, hide tallies while `voting_status=open`.  
**Status:** Spec’d for T3; implement with Vote model.

---

## Rate-limit strategy (segmented)

| Bucket | Key | Window | Max | Routes |
|--------|-----|--------|-----|--------|
| Auth | IP + path | 15 min | 30 | `/api/auth/login`, `/register` |
| Observe | judgeId | 5 min | 60 | `POST /api/judge/observations` |
| Vote (future) | userId + IP | TBD | TBD | community votes |

---

## Audit actions (readable trail)

| Action | When |
|--------|------|
| `auth.login.success` / `auth.login.failure` | Login |
| `auth.register` | Participant signup |
| `observation` | Accepted observation |
| `observation.duplicate` | 409 path (pre-check or unique index race) |
| `assignment.manual` / `assignment.auto` | Organizer assignment |
| `criterion.create` | Rubric change |

Organizers can inspect Mongo `AuditLog` / future list API; every abuse reject is recorded with actor and pairKey.

---

## What we deliberately do *not* do

- Silent upsert of duplicate pairs (would corrupt the event log).
- Hard-blocking “same score” judges (false positives; flag instead).
- Global IP bans for observations (hurts shared NAT at events).
- Cloud CAPTCHA / external fraud APIs (offline mandate).

---

## Residual risk summary

| Risk | Likelihood | Impact | Acceptance |
|------|------------|--------|------------|
| Stolen judge cookie | Low | Medium | Short session TTL; rotate on login |
| Organizer error in assignment | Medium | Medium | Progress + assignment UI |
| Colluding judges | Low | High | Out of band; audit + anomalies |
| Public-vote Sybil | N/A until T3 | High | Deferred with documented plan |

This model is intended to be **defensible in a 72-hour build**: strong isolation, pure logs, rate limits, duplicates rejected, anomalies visible — without claiming an unattainable fraud-proof system.


---

## STRIDE + ATT&CK map (T2 / T3 surfaces)

One-page view for the evaluation panel. ATT&CK IDs are **Enterprise** techniques used as a common language; several rows are application-layer analogues (authZ), not host exploits.

| Surface | S | T | R | I | D | E | Primary ATT&CK | Control in Forge |
|---------|---|---|---|---|---|---|----------------|------------------|
| `POST /api/auth/login` | ● | | | | ● | | T1110 Brute Force; T1078 Valid Accounts | `rateLimitAuth`; bcrypt; audit failures |
| Session / JWT cookie | ● | | | ● | | ● | T1078 Valid Accounts | HTTP-only cookie + Bearer; role in token; rotate on login |
| `GET /api/judge/scores` | | | | ● | | ● | T1078 (abuse of valid session) | `requireOwnJudgeScores` → **403** peer |
| `POST /api/judge/observations` | | ● | ● | | ● | ● | T1078; Impact-style abuse | Both projects assigned; canonical pair; **409** dup; server `createdAt`; observe rate limit |
| Assignment table | | ● | | | | ● | — (authZ design) | Organizer-only write; row-level judge scope |
| Posterior / ranking state | | ● | | | ● | | — (integrity of scores) | Append-only observations; replayable log |
| `GET /api/export.csv` | | | | ● | | ● | T1530 (data from cloud storage analogue) | `requireRole(organizer,admin)` only |
| Anomaly / progress APIs | | | | ● | | ● | T1087-ish discovery | Organizer/admin only |
| Public gallery `GET /api/projects` | | | | | | | T1595 Active Scanning (low) | Randomize order (T3); no live vote counts while open |
| `POST` community vote (T3) | ● | ● | ● | | ● | | T1078; T1110; Impact | Unique voter×project; rate limit; IP hash audit; hide tallies until close |
| Comments (T3) | | ● | | ● | ● | | T1059-analogue via stored XSS if unsanitized | Auth create; length limit; sanitize on render |
| Audit log | | ● | ● | ● | | | T1070 Indicator Removal (attacker goal) | Append-only; organizer read |

**STRIDE legend:** S Spoofing · T Tampering · R Repudiation · I Info disclosure · D Denial of service · E Elevation of privilege. ● = relevant to this surface.

**Notes**
- Peer ballot read is **authorization failure**, mapped under Valid Accounts (session used outside intended scope).
- Duplicate inverted pairs are **tampering** of the ranking input stream, not a classic ATT&CK host technique.
- For AI/RAG/MCP surfaces, see `security/MITRE-ATLAS.md` (ATLAS), not this Enterprise table.

