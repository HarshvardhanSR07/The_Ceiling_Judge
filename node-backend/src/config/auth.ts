/**
 * @file config/auth.ts
 * @description Authentication and authorization configuration.
 *
 * All tuneable values are pulled from environment variables so the same
 * binary can run in dev, staging, and production without code changes.
 * Missing required values throw at startup — fail fast rather than silently
 * degrading to an insecure default.
 */

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

/** All roles that exist in the system, ordered from least to most privileged. */
export type Role = "visitor" | "participant" | "judge" | "organizer" | "admin";

/**
 * Numeric rank for each role.  Used by `requireMinRole` to allow callers to
 * assert "at least organizer" without listing every role explicitly.
 */
export const ROLE_HIERARCHY: Readonly<Record<Role, number>> = {
  visitor:     10,
  participant: 20,
  judge:       30,
  organizer:   40,
  admin:       50,
} as const;

// ---------------------------------------------------------------------------
// Config factory
// ---------------------------------------------------------------------------

/**
 * Returns the value of an environment variable, or a dev-only fallback when
 * `NODE_ENV` is not `"production"`.  Throws if the variable is absent in
 * production to prevent accidental deployment with insecure defaults.
 *
 * @param key        - The environment variable name.
 * @param devDefault - Value to use in non-production environments if the
 *                     variable is unset.  Pass `undefined` for variables that
 *                     must always be set.
 */
function env(key: string, devDefault?: string): string {
  const value = process.env[key];
  if (value !== undefined && value !== "") return value;

  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction && devDefault !== undefined) return devDefault;

  throw new Error(
    `[config] Required environment variable "${key}" is not set.` +
    (isProduction ? "" : `  Add it to your .env file or export it before starting the server.`)
  );
}

// ---------------------------------------------------------------------------
// Exported config object
// ---------------------------------------------------------------------------

export const authConfig = {
  // --- JWT -------------------------------------------------------------------

  /**
   * HMAC-SHA256 secret used to sign and verify JWTs.
   * Must be at least 32 random bytes in production.
   * Set via: JWT_SECRET=<long-random-string>
   */
  jwtSecret: env("JWT_SECRET", "dev-only-secret-change-me-before-production"),

  /**
   * How long a signed JWT remains valid.  Express-jwt / jsonwebtoken format.
   * Set via: JWT_EXPIRES_IN=12h
   */
  jwtExpiresIn: env("JWT_EXPIRES_IN", "12h"),

  // --- Passwords -------------------------------------------------------------

  /**
   * bcrypt cost factor.  10 is fine for a hackathon; 12+ for production.
   * Higher values increase login time (and therefore brute-force cost).
   */
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 10),

  // --- Session cookie --------------------------------------------------------

  /** Name of the HTTP-only session cookie set after login / register. */
  cookieName: "session" as const,

  /** Session cookie lifetime in milliseconds (default 12 hours). */
  cookieMaxAgeMs: 12 * 60 * 60 * 1000,

  // --- Rate limiting ---------------------------------------------------------

  /** Auth routes (login / register): sliding-window duration in milliseconds. */
  rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes

  /** Auth routes: maximum requests per window per IP+path. */
  rateLimitMax: 30,

  // --- Seed accounts (dogfood / demo only) -----------------------------------
  //
  // These values are intentionally left as literal strings because they are
  // only active when the seed script runs (never in production data).
  // Do NOT derive business logic from these values at runtime.

  /** Plaintext passwords used by the seed script to create demo accounts. */
  seedPasswords: {
    admin:       "admin123",
    organizer:   "organizer123",
    judge_a:     "judge123",
    judge_b:     "judge123",
    participant: "participant123",
  },

  /**
   * Pre-issued session tokens written into `.dogfood.toml` by the seed script.
   * These allow the automated checker to authenticate without a browser.
   */
  seedTokens: {
    admin:       "adm_seed_01",
    organizer:   "org_seed_01",
    judge_a:     "jdg_a_seed_01",
    judge_b:     "jdg_b_seed_01",
    participant: "prt_seed_01",
  },
} as const;
