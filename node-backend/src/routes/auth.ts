/**
 * @file routes/auth.ts
 * @description Authentication routes: register, login, logout, and /api/me.
 *
 * Security notes
 * ──────────────
 * • Session tokens are set as httpOnly cookies ONLY.  They are deliberately
 *   excluded from the JSON response body to prevent theft via XSS or response
 *   logging middleware.  (Previously the token was returned in the body,
 *   which defeated the httpOnly cookie's purpose.)
 *
 * • JWTs are returned in the JSON body for API clients (e.g. the dogfood
 *   checker) that cannot read cookies.
 *
 * • Audit writes are fire-and-forget (no `await`).  A failed audit write
 *   must never cause a 500 on a successful login or registration.
 *
 * • The `clientMeta` helper reads `X-Forwarded-For` because the Docker
 *   Compose stack routes traffic through a reverse proxy.  The meta is used
 *   only for audit logging — not for rate limiting — so IP spoofing here
 *   affects only the audit trail, not security controls.
 */

import { Router, Response } from "express";
import { AuthedRequest, requireAuth } from "../middleware/auth.js";
import { rateLimitAuth }              from "../middleware/rateLimit.js";
import {
  registerParticipant,
  loginWithPassword,
  writeLoginAudit,
  writeRegisterAudit,
  signJwt,
  toPublicUser,
}                                     from "../services/authService.js";
import { authConfig }                 from "../config/auth.js";

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the client IP and User-Agent for audit logging.
 * Not used for security controls — only for forensic trail.
 */
function clientMeta(req: AuthedRequest) {
  return {
    ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      ?? req.socket.remoteAddress,
    userAgent: req.headers["user-agent"],
  };
}

/**
 * Standard cookie options applied to all session-cookie responses.
 * `secure` is only enforced in production so local dev (HTTP) still works.
 */
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:   process.env.NODE_ENV === "production",
    maxAge:   authConfig.cookieMaxAgeMs,
  };
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

/**
 * Registers a new participant account.
 *
 * Body: `{ email: string, name: string, password: string }`
 *
 * Responds with the public user object and a JWT.  The session token is set
 * as an httpOnly cookie and is NOT included in the JSON body.
 *
 * @status 201 - Registration successful.
 * @status 400 - Missing fields or password too short.
 * @status 409 - Email already registered.
 * @status 429 - Rate limit exceeded.
 */
router.post(
  "/api/auth/register",
  rateLimitAuth,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { email, name, password } = req.body ?? {};

      if (!email || !name || !password) {
        return res.status(400).json({ error: "email, name, and password are required" });
      }
      if (String(password).length < 8) {
        return res.status(400).json({ error: "password must be at least 8 characters" });
      }

      const user  = await registerParticipant({ email, name, password });
      const token = signJwt(user);
      const meta  = clientMeta(req);

      // Fire-and-forget — must not block or surface errors to the caller
      writeRegisterAudit({ actorId: user.id, ...meta });

      res
        .cookie(authConfig.cookieName, user.sessionToken, cookieOptions())
        .status(201)
        .json({ user: toPublicUser(user), token });
    } catch (err: any) {
      const status = (err as any).status ?? 500;
      res.status(status).json({ error: err.message ?? "registration failed" });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

/**
 * Authenticates a user by email and password.
 *
 * Body: `{ email: string, password: string }`
 *
 * Responds with the public user object and a fresh JWT.  The rotated session
 * token is set as an httpOnly cookie and is NOT in the JSON body.
 *
 * @status 200 - Login successful.
 * @status 400 - Missing email or password.
 * @status 401 - Invalid credentials.
 * @status 429 - Rate limit exceeded.
 */
router.post(
  "/api/auth/login",
  rateLimitAuth,
  async (req: AuthedRequest, res: Response) => {
    const meta = clientMeta(req);
    try {
      const { email, password } = req.body ?? {};
      if (!email || !password) {
        return res.status(400).json({ error: "email and password are required" });
      }

      const { user, jwt: token, sessionToken } = await loginWithPassword(email, password);

      // Fire-and-forget
      writeLoginAudit({ actorId: user.id, success: true, ...meta });

      res
        .cookie(authConfig.cookieName, sessionToken, cookieOptions())
        .json({ user: toPublicUser(user), token });
    } catch (err: any) {
      // Fire-and-forget — use email string as actor when user is unknown
      writeLoginAudit({
        actorId: (req.body?.email as string) ?? "unknown",
        success: false,
        reason:  err.message,
        ...meta,
      });
      const status = (err as any).status ?? 500;
      res.status(status).json({ error: err.message ?? "login failed" });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

/**
 * Clears the session cookie.  Does not invalidate the JWT (stateless by
 * design; the short `jwtExpiresIn` window is the expiry mechanism).
 *
 * @status 200 - Cookie cleared.
 */
router.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(authConfig.cookieName).json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /api/me
// ---------------------------------------------------------------------------

/**
 * Returns the current user's public profile.
 * Used by the frontend to hydrate session state on page load.
 *
 * @status 200 - Returns the authenticated user.
 * @status 401 - Not authenticated.
 */
router.get(
  "/api/me",
  requireAuth,
  (req: AuthedRequest, res: Response) => {
    const u = req.user!;
    res.json({
      ...toPublicUser(u),
      tracks:           u.tracks ?? [],
      assignedProjects: u.assignedProjects ?? [],
      authMethod:       req.authMethod,
    });
  },
);

export default router;
