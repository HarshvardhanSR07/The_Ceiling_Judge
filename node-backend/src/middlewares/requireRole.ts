/**
 * @file middleware/auth.ts
 * @description Express middleware for authentication and authorization.
 *
 * Design notes
 * ────────────
 * • Authentication is token-based (JWT preferred, session-cookie fallback).
 *   The two paths are unified by `attachUser`, which populates `req.user`
 *   for all downstream handlers.
 *
 * • Authorization is role-based with three helpers:
 *     - `requireAuth`         — any authenticated user
 *     - `requireRole(...)`    — exact role membership
 *     - `requireMinRole(...)` — hierarchical "at least X" check
 *
 * • Judging-integrity guards (Dogfood T2):
 *     - `requireOwnJudgeScores`   — peer score isolation
 *     - `requireAssignedJudge`    — scope-to-assignment enforcement
 *
 * Security notes
 * ──────────────
 * • `requireAssignedJudge` delegates to `assignmentService` so the lookup
 *   logic is defined in one place.  Previously this middleware duplicated
 *   the service's `isAssigned` / `isAssignedToBoth` implementations, which
 *   meant a future change would have needed two edits.
 *
 * • Admin / organizer bypass is always the first check so those roles never
 *   hit the DB-backed assignment lookup.
 */

import { Request, Response, NextFunction } from "express";
import { IUser }               from "../models/User.js";
import { isAssigned, isAssignedToBoth } from "../services/assignmentService.js";
import {
  findUserBySessionToken,
  findUserById,
  verifyJwt,
} from "../services/authService.js";
import { authConfig, type Role, ROLE_HIERARCHY } from "../config/auth.js";

// ---------------------------------------------------------------------------
// Extended request type
// ---------------------------------------------------------------------------

/** Express Request augmented with the resolved user and the auth method used. */
export interface AuthedRequest extends Request {
  user?:       IUser;
  authMethod?: "jwt" | "cookie";
}

// ---------------------------------------------------------------------------
// Token extraction
// ---------------------------------------------------------------------------

/**
 * Extracts the raw session / bearer token from the incoming request.
 *
 * Priority order:
 *  1. Session cookie (`session=<token>`)
 *  2. Authorization header (`Bearer <token>`)
 *  3. Custom `X-Session` header (for the dogfood checker)
 *
 * Returns an empty string when no token is present so callers can do a simple
 * truthiness check.
 */
function extractToken(req: Request): string {
  // 1. Session cookie
  const rawCookie = req.headers.cookie ?? "";
  const cookieMatch = new RegExp(`${authConfig.cookieName}=([^;]+)`).exec(rawCookie);
  if (cookieMatch?.[1]) return decodeURIComponent(cookieMatch[1].trim());

  // 2. Bearer token
  const authHeader = req.headers.authorization ?? "";
  if (/^Bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, "").trim();
  }

  // 3. X-Session header (dogfood automated checker)
  const xSession = req.headers["x-session"];
  if (typeof xSession === "string" && xSession) return xSession.trim();

  return "";
}

// ---------------------------------------------------------------------------
// attachUser — populate req.user on every request
// ---------------------------------------------------------------------------

/**
 * Middleware that resolves the caller's identity from the request token.
 *
 * JWT path (preferred): verifies the token signature and loads the user by
 * the `sub` claim, which is the application user ID.
 *
 * Session-cookie path (fallback): looks up the opaque session token in the
 * database.  Used for legacy browser sessions that pre-date JWT issuance, or
 * for the dogfood seed tokens.
 *
 * If no token is present, or the token is invalid / expired, `req.user` is
 * left undefined.  Downstream middleware (`requireAuth`, `requireRole`, etc.)
 * will then reject the request with a 401.
 */
export async function attachUser(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) return next();

    // Try JWT first — avoids a DB round-trip on every request
    const payload = verifyJwt(token);
    if (payload?.sub) {
      const user = await findUserById(payload.sub);
      if (user) {
        req.user       = user;
        req.authMethod = "jwt";
        return next();
      }
    }

    // Fall back to opaque session token (cookie / seed token)
    const user = await findUserBySessionToken(token);
    if (user) {
      req.user       = user;
      req.authMethod = "cookie";
    }

    next();
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// requireAuth — gate: any authenticated user
// ---------------------------------------------------------------------------

/**
 * Rejects unauthenticated requests with 401.
 * Must be placed after `attachUser` in the middleware chain.
 */
export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// requireRole — gate: exact role membership
// ---------------------------------------------------------------------------

/**
 * Returns a middleware that allows only the specified roles through.
 *
 * @example
 *   router.get("/admin/users", requireRole("admin", "organizer"), handler);
 */
export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "forbidden", required: roles });
      return;
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// requireMinRole — gate: hierarchical "at least X" check
// ---------------------------------------------------------------------------

/**
 * Returns a middleware that allows any role whose hierarchy rank is ≥
 * the rank of `minRole`.
 *
 * @example
 *   router.get("/scores", requireMinRole("organizer"), handler);
 *   // passes for "organizer" and "admin"; blocks "judge", "participant", "visitor"
 */
export function requireMinRole(minRole: Role) {
  const minRank = ROLE_HIERARCHY[minRole];
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (ROLE_HIERARCHY[req.user.role] < minRank) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// requireOwnJudgeScores — T2: peer score isolation
// ---------------------------------------------------------------------------

/**
 * Enforces that a judge can only read their own observations.
 *
 * Organizers and admins may pass an optional `?judge=<id>` query param to
 * read any judge's scores.  Any other role (including judges requesting a
 * peer's ID) receives 403.
 *
 * This check lives in middleware — not in the UI — so it cannot be bypassed
 * by calling the API directly.
 */
export function requireOwnJudgeScores(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  // Privileged roles: allow
  if (req.user.role === "admin" || req.user.role === "organizer") {
    return next();
  }

  // Non-judge roles: deny
  if (req.user.role !== "judge") {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  // Judge attempting to read a peer's scores: deny
  const requested = String(req.query.judge ?? req.params.judgeId ?? "");
  if (requested && requested !== req.user.id) {
    res.status(403).json({ error: "cannot read peer scores" });
    return;
  }

  next();
}

// ---------------------------------------------------------------------------
// requireAssignedJudge — T2: strict assignment enforcement
// ---------------------------------------------------------------------------

/**
 * Ensures a judge is assigned to every project referenced in the request.
 *
 * For pairwise observations (`projectA` + `projectB`), **both** projects must
 * be assigned.  This is checked in parallel via `isAssignedToBoth`, which
 * issues a single batched query rather than two sequential ones.
 *
 * For single-project requests (`projectId` body field or `:projectId` param),
 * a single assignment check is performed.
 *
 * Admin and organizer roles bypass the check entirely.
 *
 * Previously this middleware duplicated the `isAssigned` / `isAssignedToBoth`
 * logic from `assignmentService`.  It now delegates to those functions so the
 * lookup strategy is owned in one place.
 */
export async function requireAssignedJudge(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    // Privileged roles bypass assignment checks
    if (req.user.role === "admin" || req.user.role === "organizer") {
      return next();
    }

    if (req.user.role !== "judge") {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const body = req.body ?? {};
    const rawA = body.projectA ? String(body.projectA) : null;
    const rawB = body.projectB ? String(body.projectB) : null;

    // Pairwise path: both projects must be assigned (parallel lookup)
    if (rawA && rawB) {
      const ok = await isAssignedToBoth(req.user.id, rawA, rawB);
      if (!ok) {
        res.status(403).json({ error: "not assigned to both projects in the pair" });
        return;
      }
      return next();
    }

    // Single-project path
    const projectId = rawA
      ?? (body.projectId ? String(body.projectId) : null)
      ?? (req.params.projectId ? String(req.params.projectId) : null);

    if (projectId) {
      const ok = await isAssigned(req.user.id, projectId);
      if (!ok) {
        res.status(403).json({ error: "not assigned to this project", projectId });
        return;
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}
