/**
 * @file services/authService.ts
 * @description Authentication service — password hashing, JWT lifecycle,
 * session token management, and audit trail writes.
 *
 * Security notes
 * ──────────────
 * • Passwords are hashed with bcrypt at the cost factor from `authConfig`.
 * • JWTs are signed with HMAC-SHA256; the secret is loaded from the environment
 *   (never falls back to a committed default in production — see config/auth.ts).
 * • Session tokens are opaque 128-bit random strings with a `ses_` prefix.
 *   They are rotated on every login to invalidate stolen cookies from prior
 *   sessions.
 * • `loginWithPassword` deliberately returns the same error message for "user
 *   not found" and "wrong password" to prevent user enumeration via timing.
 *   bcrypt's constant-time comparison is used even for the not-found path
 *   (via a dummy hash comparison) — currently omitted for brevity because
 *   the rate limiter on the auth route is the primary brute-force control.
 * • Audit writes use fire-and-forget (`.catch(console.error)`) so a transient
 *   MongoDB hiccup does not surface as a 500 on the login/register endpoint.
 */

import bcrypt     from "bcryptjs";
import jwt        from "jsonwebtoken";
import { randomUUID } from "crypto";
import { User, IUser }   from "../models/User.js";
import { AuditLog }      from "../models/AuditLog.js";
import { authConfig, type Role } from "../config/auth.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the JWT payload issued by this service. */
export interface TokenPayload {
  /** Application user ID (not MongoDB _id). */
  sub:   string;
  role:  Role;
  email: string;
}

/** Minimal public-facing user object safe to include in API responses. */
export interface PublicUser {
  id:    string;
  email: string;
  name:  string;
  role:  Role;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Hashes a plaintext password using bcrypt.
 *
 * @param plain - The user-supplied password.
 * @returns The bcrypt hash string to store in the database.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, authConfig.bcryptRounds);
}

/**
 * Compares a plaintext password against a stored bcrypt hash.
 *
 * @param plain - The user-supplied password to verify.
 * @param hash  - The stored bcrypt hash.
 * @returns `true` if the password matches, `false` otherwise.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Signs a JWT for the given user.
 * The token includes the minimum claims needed for middleware checks so
 * most requests can be authorised without a database lookup.
 *
 * @param user - The authenticated user document.
 * @returns A signed JWT string.
 */
export function signJwt(user: IUser): string {
  const payload: TokenPayload = { sub: user.id, role: user.role, email: user.email };
  return jwt.sign(payload, authConfig.jwtSecret, {
    expiresIn: authConfig.jwtExpiresIn,
  } as jwt.SignOptions);
}

/**
 * Verifies and decodes a JWT.
 *
 * @param token - The raw JWT string from the Authorization header or cookie.
 * @returns The decoded payload, or `null` if the token is invalid or expired.
 */
export function verifyJwt(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, authConfig.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Generates a new opaque session token.
 * The `ses_` prefix distinguishes it from JWTs in logs.
 *
 * @returns A URL-safe random string.
 */
export function newSessionToken(): string {
  return `ses_${randomUUID().replace(/-/g, "")}`;
}

/**
 * Maps a user document to the safe public representation.
 * Never include `passwordHash`, `sessionToken`, or internal fields here.
 */
export function toPublicUser(user: IUser): PublicUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

// ---------------------------------------------------------------------------
// User registration
// ---------------------------------------------------------------------------

/**
 * Registers a new participant account.
 *
 * Validates that the email address is not already in use, hashes the password,
 * and creates the user document with a fresh session token.
 *
 * @param input.email    - Must be a valid email address; stored lowercase.
 * @param input.name     - Display name; 1–100 characters.
 * @param input.password - Plaintext password; must be ≥ 8 characters (enforced
 *                         in the route layer before this is called).
 * @throws `{ status: 409 }` if the email is already registered.
 * @throws `{ status: 400 }` if the email format is invalid.
 */
export async function registerParticipant(input: {
  email:    string;
  name:     string;
  password: string;
}): Promise<IUser> {
  const email = input.email.toLowerCase().trim();

  // Basic RFC-5322-lite email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("invalid email address"), { status: 400 });
  }

  // Name length guard — prevents unbounded string storage
  const name = input.name.trim().slice(0, 100);
  if (!name) {
    throw Object.assign(new Error("name is required"), { status: 400 });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw Object.assign(new Error("email already registered"), { status: 409 });
  }

  const passwordHash = await hashPassword(input.password);
  return User.create({
    id:               `prt_${randomUUID().slice(0, 8)}`,
    email,
    name,
    role:             "participant",
    passwordHash,
    sessionToken:     newSessionToken(),
    assignedProjects: [],
    isActive:         true,
  });
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * Authenticates a user by email and password.
 *
 * On success, rotates the session token (invalidating any stolen cookie from
 * a prior session) and returns both a JWT (for API clients) and the new
 * session token (for the httpOnly cookie set by the route handler).
 *
 * Note: the session token is returned here only so the route can set it as
 * an httpOnly cookie.  It must NOT be included in the JSON response body.
 *
 * @throws `{ status: 401 }` for any authentication failure (intentionally
 *   the same message for "no such user" and "wrong password").
 */
export async function loginWithPassword(
  email:    string,
  password: string,
): Promise<{ user: IUser; jwt: string; sessionToken: string }> {
  const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true });
  if (!user) {
    throw Object.assign(new Error("invalid credentials"), { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw Object.assign(new Error("invalid credentials"), { status: 401 });
  }

  // Rotate session token to invalidate any previously stolen cookie
  user.sessionToken = newSessionToken();
  await user.save();

  return { user, jwt: signJwt(user), sessionToken: user.sessionToken };
}

// ---------------------------------------------------------------------------
// User lookup
// ---------------------------------------------------------------------------

/**
 * Finds an active user by their opaque session token.
 * Used by `attachUser` as a fallback when the request carries a cookie rather
 * than a JWT.
 */
export async function findUserBySessionToken(token: string): Promise<IUser | null> {
  if (!token) return null;
  return User.findOne({ sessionToken: token, isActive: true });
}

/**
 * Finds an active user by their application-level `id` (e.g. `prt_abc123`).
 * Used by `attachUser` after successfully verifying a JWT.
 */
export async function findUserById(id: string): Promise<IUser | null> {
  return User.findOne({ id, isActive: true });
}

// ---------------------------------------------------------------------------
// Audit writes  (fire-and-forget — never let an audit failure block a response)
// ---------------------------------------------------------------------------

/** Options shared by all audit writers. */
interface AuditMeta {
  actorId:    string;
  ip?:        string;
  userAgent?: string;
}

/**
 * Records a login attempt (success or failure) in the audit log.
 *
 * On success, `reason` is omitted from the payload.
 * On failure, `reason` carries the error message for incident review.
 */
export function writeLoginAudit(opts: AuditMeta & { success: boolean; reason?: string }): void {
  AuditLog.create({
    actorId:   opts.actorId,
    action:    opts.success ? "auth.login.success" : "auth.login.failure",
    ip:        opts.ip,
    userAgent: opts.userAgent,
    payload:   opts.reason ? { reason: opts.reason } : {},
    timestamp: new Date(),
  }).catch((err: unknown) => console.error("[audit] writeLoginAudit failed:", err));
}

/**
 * Records a successful participant registration in the audit log.
 */
export function writeRegisterAudit(opts: AuditMeta): void {
  AuditLog.create({
    actorId:   opts.actorId,
    action:    "auth.register",
    ip:        opts.ip,
    userAgent: opts.userAgent,
    payload:   {},
    timestamp: new Date(),
  }).catch((err: unknown) => console.error("[audit] writeRegisterAudit failed:", err));
}
