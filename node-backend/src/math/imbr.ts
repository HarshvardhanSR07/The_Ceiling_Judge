/**
 * @file math/imbr.ts
 * @description IMBR — Interactive Multi-Facet Bayesian Ranking.
 *
 * Pure functions only.  No I/O, no side effects, no module-level state.
 * Every function can be unit-tested by passing in plain objects and asserting
 * on the return value.
 *
 * Algorithm overview
 * ──────────────────
 * Each project is modelled as a Gaussian posterior over a D-dimensional
 * quality vector, one dimension per judging criterion.  Observations (judge
 * comparisons) nudge the posterior means and shrink the standard deviations
 * (uncertainty reduction).
 *
 * Two update modes are supported:
 *   - `updateSoft`  — overall 1–5 preference; pushes both projects along the
 *                     composite criterion-weight direction.
 *   - `updateFacet` — binary winner for a single criterion dimension.
 *
 * The diagonal-covariance simplification (each dimension independent) allows
 * O(D) updates rather than O(D²) matrix operations, which is appropriate for
 * a hackathon prototype with D ≤ 10 criteria.
 *
 * Named constants
 * ───────────────
 * All tuneable hyperparameters are named constants below.  Previously they
 * appeared as magic literals scattered through the update functions, which
 * made it impossible to understand or tune the algorithm without reading every
 * line.  The values are unchanged from the original implementation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A dense vector of floating-point values, one per criterion dimension. */
export type Vec = number[];

/**
 * Gaussian posterior for one project.
 * Stored as separate mean and standard-deviation vectors (diagonal covariance).
 */
export interface Posterior {
  /** Mean quality estimate per criterion. */
  mu:    Vec;
  /** Standard deviation (uncertainty) per criterion.  Always positive. */
  sigma: Vec;
}

/**
 * A soft (1–5 scale) pairwise observation.
 * `preference = 3` is neutral; 1 strongly favours B; 5 strongly favours A.
 */
export interface SoftObservation {
  preference: number;
  /** Criterion weights — must align with the dimension of the posteriors. */
  w:          Vec;
  /**
   * Optional per-call learning-rate override.
   * Defaults to `SOFT_ALPHA` when not supplied.
   */
  alpha?:     number;
}

/** A binary (winner / loser) observation for a single criterion dimension. */
export interface FacetObservation {
  criterionIndex: number;
  winnerIsA:      boolean;
}

// ---------------------------------------------------------------------------
// Hyperparameters
// ---------------------------------------------------------------------------

/**
 * Learning rate for soft overall updates.
 * Controls how far the posterior means move on each observation.
 * Higher values converge faster but are less stable with noisy judges.
 */
const SOFT_ALPHA = 0.35;

/**
 * Uncertainty decay factor applied after each soft update.
 * `sigma *= SOFT_SIGMA_DECAY` per step (capped at MIN_SIGMA).
 * A value near 1.0 means uncertainty shrinks slowly.
 */
const SOFT_SIGMA_DECAY = 0.97;

/**
 * Learning rate for facet (single-criterion binary) updates.
 * Larger than SOFT_ALPHA because facet observations are more decisive.
 */
const FACET_DELTA = 0.4;

/**
 * Uncertainty decay factor for facet updates.
 * Applied only to the updated criterion dimension.
 */
const FACET_SIGMA_DECAY = 0.95;

/**
 * Minimum allowed posterior standard deviation.
 * Prevents sigma from collapsing to zero, which would make the model
 * completely insensitive to future observations.
 */
const MIN_SIGMA = 0.15;

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Returns a vector of `d` zeros.
 * Used to initialise prior means.
 */
export function zeros(d: number): Vec {
  return Array<number>(d).fill(0);
}

/**
 * Returns a vector of `d` copies of `v` (default 1).
 * Used to initialise prior standard deviations.
 */
export function ones(d: number, v = 1): Vec {
  return Array<number>(d).fill(v);
}

/**
 * Returns the uninformative prior posterior for a project with `d` criteria.
 * Both projects in a fresh pair start at μ = 0, σ = 1.
 */
export function defaultPosterior(d: number): Posterior {
  return { mu: zeros(d), sigma: ones(d, 1) };
}

/**
 * Computes the scalar quality score for a project:  score = w · μ
 *
 * @param mu - Posterior mean vector.
 * @param w  - Criterion weights (must be the same length as `mu`).
 * @returns  The weighted dot product.
 */
export function score(mu: Vec, w: Vec): number {
  let s = 0;
  for (let i = 0; i < mu.length; i++) s += (w[i] ?? 0) * (mu[i] ?? 0);
  return s;
}

// ---------------------------------------------------------------------------
// Standard normal CDF (φ)
// ---------------------------------------------------------------------------

/**
 * Approximates the standard normal CDF using the Abramowitz & Stegun method
 * (formula 26.2.17).  Maximum absolute error ≈ 7.5 × 10⁻⁸, which is more
 * than adequate for the win-probability heuristic.
 *
 * @param x - The quantile to evaluate.
 * @returns  Φ(x) ∈ (0, 1).
 */
export function phi(x: number): number {
  const t  = 1 / (1 + 0.2316419 * Math.abs(x));
  const d  = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p  = d * t * (
    0.3193815 + t * (
      -0.3565638 + t * (
        1.781478 + t * (
          -1.821256 + t * 1.330274
        )
      )
    )
  );
  return x > 0 ? 1 - p : p;
}

// ---------------------------------------------------------------------------
// Posterior update functions
// ---------------------------------------------------------------------------

/**
 * Applies a soft (1–5 scale) overall observation to two project posteriors.
 *
 * The preference is mapped to `[-1, +1]` via `(p − 3) / 2` so that 3 (neutral)
 * produces no mean update.  The step is distributed across all criterion
 * dimensions proportionally to the criterion weights.
 *
 * @param a   - Posterior for project A (the "preferred" end at preference = 5).
 * @param b   - Posterior for project B.
 * @param obs - The soft observation.
 * @returns   Updated posteriors for both projects (originals are not mutated).
 */
export function updateSoft(
  a:   Posterior,
  b:   Posterior,
  obs: SoftObservation,
): { a: Posterior; b: Posterior } {
  const d     = a.mu.length;
  const alpha = obs.alpha ?? SOFT_ALPHA;
  const target = (obs.preference - 3) / 2; // maps 1..5 → -1..+1
  const step   = alpha * target;

  const muA   = a.mu.slice();
  const muB   = b.mu.slice();
  const sigA  = a.sigma.slice();
  const sigB  = b.sigma.slice();

  for (let i = 0; i < d; i++) {
    const wi  = obs.w[i] ?? 0;
    muA[i]  += step * wi;
    muB[i]  -= step * wi;
    sigA[i]  = Math.max(MIN_SIGMA, sigA[i] * SOFT_SIGMA_DECAY);
    sigB[i]  = Math.max(MIN_SIGMA, sigB[i] * SOFT_SIGMA_DECAY);
  }

  return { a: { mu: muA, sigma: sigA }, b: { mu: muB, sigma: sigB } };
}

/**
 * Applies a facet (binary, single-criterion) observation to two posteriors.
 *
 * Only the dimension identified by `facet.criterionIndex` is updated.
 * All other dimensions are unchanged.
 *
 * @param a     - Posterior for project A.
 * @param b     - Posterior for project B.
 * @param facet - Which criterion to update and which project won.
 * @returns     Updated posteriors for both projects (originals are not mutated).
 */
export function updateFacet(
  a:     Posterior,
  b:     Posterior,
  facet: FacetObservation,
): { a: Posterior; b: Posterior } {
  const i    = facet.criterionIndex;
  const muA  = a.mu.slice();
  const muB  = b.mu.slice();
  const sigA = a.sigma.slice();
  const sigB = b.sigma.slice();

  if (facet.winnerIsA) {
    muA[i] += FACET_DELTA;
    muB[i] -= FACET_DELTA;
  } else {
    muA[i] -= FACET_DELTA;
    muB[i] += FACET_DELTA;
  }

  sigA[i] = Math.max(MIN_SIGMA, sigA[i] * FACET_SIGMA_DECAY);
  sigB[i] = Math.max(MIN_SIGMA, sigB[i] * FACET_SIGMA_DECAY);

  return { a: { mu: muA, sigma: sigA }, b: { mu: muB, sigma: sigB } };
}

// ---------------------------------------------------------------------------
// Win probability heuristic
// ---------------------------------------------------------------------------

/**
 * Estimates the probability that project A beats project B under the current
 * posterior means.
 *
 * Uses the standard normal CDF on the weighted score difference.  Uncertainty
 * in the posteriors is not propagated here (this is a point-estimate heuristic,
 * not a full predictive posterior).
 *
 * Used by the next-pair selection heuristic: pairs where `winProb ≈ 0.5`
 * have the highest information value.
 *
 * @param a - Posterior for project A.
 * @param b - Posterior for project B.
 * @param w - Criterion weights.
 * @returns  P(A beats B) ∈ (0, 1).
 */
export function winProb(a: Posterior, b: Posterior, w: Vec): number {
  let diff = 0;
  for (let i = 0; i < a.mu.length; i++) {
    diff += (w[i] ?? 0) * ((a.mu[i] ?? 0) - (b.mu[i] ?? 0));
  }
  return phi(diff);
}
