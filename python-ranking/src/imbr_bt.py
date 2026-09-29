"""
imbr_bt.py
==========

Production implementation of IMBR-BT: a multi-facet, Bayesian
pairwise-comparison ranking model with a Bradley-Terry (logistic) link
for the "overall" comparison channel and probit links for per-criterion
("facet") channels.

Why this differs from the reference/prototype spec
----------------------------------------------------
The design doc's update rule for the soft 1-5 rating was a fixed-rate
nudge plus a fixed multiplicative variance decay:

    mu_i,k <- mu_i,k + alpha * t * w_k
    sigma_i,k <- max(0.15, 0.97 * sigma_i,k)

That rule ignores how informative the observation actually was (a
rating of "3" carries t=0 signal but still decays the variance by a
fixed factor) and it hits a hard floor after a fixed number of
observations regardless of how many comparisons a project has
actually been through. This module replaces it with a real Bayesian
filter:

  * The soft 1-5 rating has a *linear-Gaussian* observation model in
    the projected latent gap Delta = w^T(s_i - s_j), so it has an
    exact closed-form Bayes-linear (Kalman) update -- no heuristics
    required.

  * The binary Bradley-Terry outcome and the per-facet probit outcome
    are not conjugate to a Gaussian prior. Those get a single
    Fisher-scoring / Laplace step: the likelihood is locally
    approximated by a Gaussian using its score (gradient) and observed
    Fisher information (curvature) at the current mean. This is the
    same trick used by TrueSkill and by online Bayesian logistic
    regression (Chapelle 2010): one Newton step under a GLM likelihood
    is algebraically identical to a Kalman update against a pseudo
    -observation `z + gradient/fisher_info` with pseudo-noise-variance
    `1/fisher_info`.

Both update paths therefore funnel through one routine,
`_apply_linear_gaussian_evidence`, which is the only place matrix
algebra happens. That is the main maintainability win: one reviewed,
tested numerical kernel instead of three near-duplicate heuristics.

All state is kept in *precision* (inverse-variance) form. Precision
adds under independent evidence, which is numerically safer than
subtracting from a variance (subtraction risks a negative variance
under floating-point error) and needs no ad hoc floor -- it saturates
naturally as more evidence arrives, and is additionally clamped to a
generous [min_precision, max_precision] band purely as a numerical
safety rail (see `_clamp_precision`), not as a modeling assumption.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from typing import Dict, List, Sequence, Tuple

import numpy as np
from scipy.special import expit, ndtr

logger = logging.getLogger("imbr_bt")

_VALID_RATINGS = (1, 2, 3, 4, 5)
_PROB_EPS = 1e-9          # clamp for probabilities entering a division
_MIN_FISHER_INFO = 1e-9   # below this, an update is treated as "no signal"


# --------------------------------------------------------------------------
# State
# --------------------------------------------------------------------------

@dataclass
class ProjectBelief:
    """Posterior belief over one project's latent strength vector s_i."""

    project_id: str
    mu: np.ndarray          # (d,) posterior mean
    precision: np.ndarray   # (d,) diagonal posterior precision (1 / var)
    n_observations: int = 0

    @classmethod
    def prior(cls, project_id: str, d: int, prior_var: float) -> "ProjectBelief":
        if prior_var <= 0:
            raise ValueError(f"prior_var must be positive, got {prior_var}")
        return cls(
            project_id=project_id,
            mu=np.zeros(d, dtype=np.float64),
            precision=np.full(d, 1.0 / prior_var, dtype=np.float64),
        )

    @property
    def var(self) -> np.ndarray:
        return 1.0 / self.precision


# --------------------------------------------------------------------------
# Model
# --------------------------------------------------------------------------

class IMBRBTModel:
    """
    Thread-safe, multi-facet Bayesian ranking model with a
    Bradley-Terry overall channel.

    Parameters
    ----------
    d : int
        Dimensionality of the latent strength vector.
    weights : sequence of float, length d
        Criterion weights w. Normalised to unit L2 norm on construction
        for identifiability (otherwise (w, s) and (c*w, s/c) are
        observationally equivalent for any c > 0, which lets scale
        drift silently through repeated updates).
    alpha : float
        Slope relating the projected latent gap to the 1-5 soft rating:
        r = 3 + alpha * Delta + noise.
    soft_rating_sigma : float
        Std-dev of the soft-rating observation noise.
    prior_var : float
        Initial (isotropic) variance for a newly seen project.
    min_precision, max_precision : float
        Numerical safety rails on precision (see module docstring).
    """

    def __init__(
        self,
        d: int,
        weights: Sequence[float],
        alpha: float = 1.0,
        soft_rating_sigma: float = 1.0,
        prior_var: float = 1.0,
        min_precision: float = 1e-6,
        max_precision: float = 1e6,
    ) -> None:
        if d <= 0:
            raise ValueError(f"d must be positive, got {d}")
        w = np.asarray(weights, dtype=np.float64)
        if w.shape != (d,):
            raise ValueError(f"weights must have shape ({d},), got {w.shape}")
        norm = np.linalg.norm(w)
        if norm < 1e-12:
            raise ValueError("weights vector must be non-zero")
        if alpha == 0:
            raise ValueError("alpha must be non-zero")
        if soft_rating_sigma <= 0:
            raise ValueError("soft_rating_sigma must be positive")
        if not (0 < min_precision < max_precision):
            raise ValueError("require 0 < min_precision < max_precision")

        self.d = d
        self.w = w / norm
        self.alpha = float(alpha)
        self.sigma = float(soft_rating_sigma)
        self.prior_var = float(prior_var)
        self.min_precision = float(min_precision)
        self.max_precision = float(max_precision)

        self._beliefs: Dict[str, ProjectBelief] = {}
        self._locks: Dict[str, threading.RLock] = {}
        self._registry_lock = threading.RLock()  # protects the two dicts above

    # ---- state / concurrency -----------------------------------------

    def _get_or_create(self, project_id: str) -> ProjectBelief:
        with self._registry_lock:
            if project_id not in self._beliefs:
                self._beliefs[project_id] = ProjectBelief.prior(project_id, self.d, self.prior_var)
                self._locks[project_id] = threading.RLock()
            return self._beliefs[project_id]

    def _acquire_pair(self, i: str, j: str):
        """
        Return the two per-project locks in a fixed global order
        (sorted by id). Two threads racing to update (A, B) and (B, A)
        concurrently would otherwise acquire locks in opposite order
        and deadlock; sorting removes that ordering ambiguity entirely.
        """
        self._get_or_create(i)
        self._get_or_create(j)
        a, b = sorted((i, j))
        return self._locks[a], self._locks[b]

    def _clamp_precision(self, precision: np.ndarray) -> np.ndarray:
        return np.clip(precision, self.min_precision, self.max_precision)

    # ---- projections ----------------------------------------------------

    def beta(self, belief: ProjectBelief) -> float:
        """Scalar projected strength w^T mu (== log pi_i in BT terms)."""
        return float(self.w @ belief.mu)

    def _delta_stats(self, bi: ProjectBelief, bj: ProjectBelief) -> Tuple[float, float]:
        """Mean and variance of Delta = w^T(s_i - s_j) under the posterior."""
        delta_mu = float(self.w @ (bi.mu - bj.mu))
        delta_var = float((self.w**2) @ (bi.var + bj.var))
        return delta_mu, delta_var

    # ---- prediction -------------------------------------------------------

    def predict_overall_prob(self, i: str, j: str) -> float:
        """
        P(i > j), approximately marginalised over posterior uncertainty
        using MacKay's probit-logistic scale correction
        kappa = 1 / sqrt(1 + (pi/8) * Var[Delta]).

        Ignoring Var[Delta] entirely (i.e. plugging in only the mean)
        is a common but silently biasing shortcut: it makes the model
        overconfident whenever a project has few comparisons, exactly
        when it should be most cautious. The correction costs one
        multiply and removes that bias.
        """
        bi, bj = self._get_or_create(i), self._get_or_create(j)
        delta_mu, delta_var = self._delta_stats(bi, bj)
        kappa = 1.0 / np.sqrt(1.0 + (np.pi / 8.0) * delta_var)
        return float(expit(kappa * delta_mu))

    # ---- the one numerical kernel ------------------------------------

    def _apply_linear_gaussian_evidence(
        self,
        bi: ProjectBelief,
        bj: ProjectBelief,
        direction: np.ndarray,
        coef: float,
        residual: float,
        noise_var: float,
        delta_var0: float,
    ) -> None:
        """
        Bayes-linear (Kalman) update for a scalar observation

            y = coef * Delta + N(0, noise_var),   Delta = direction^T(s_i - s_j)

        against independent diagonal-Gaussian priors on s_i and s_j.
        `residual` must already be `y - coef * E[Delta]`.

        `direction` is `self.w` for the overall BT/soft channel, or a
        one-hot vector for a single-facet probit channel -- the math is
        identical either way, which is why both call sites share this
        routine instead of duplicating it.
        """
        denom = (coef ** 2) * delta_var0 + noise_var
        if denom <= 0 or not np.isfinite(denom):
            logger.warning(
                "skipping update: non-finite/non-positive denom=%s (i=%s, j=%s)",
                denom, bi.project_id, bj.project_id,
            )
            return

        scale = coef / denom
        gain_i = bi.var * direction * scale
        gain_j = -bj.var * direction * scale

        bi.mu = bi.mu + gain_i * residual
        bj.mu = bj.mu + gain_j * residual

        precision_delta = (coef * direction) ** 2 / denom
        bi.precision = self._clamp_precision(bi.precision + precision_delta)
        bj.precision = self._clamp_precision(bj.precision + precision_delta)

        bi.n_observations += 1
        bj.n_observations += 1

        logger.debug(
            "evidence applied: i=%s j=%s residual=%.4f denom=%.4g "
            "beta_i=%.4f beta_j=%.4f n_i=%d n_j=%d",
            bi.project_id, bj.project_id, residual, denom,
            self.beta(bi), self.beta(bj), bi.n_observations, bj.n_observations,
        )

    # ---- overall channel: soft 1-5 rating (exact conjugate update) -------

    def update_soft(self, i: str, j: str, r: int) -> None:
        """Soft 1-5 overall preference: r = 3 + alpha * Delta + noise."""
        if i == j:
            raise ValueError("cannot compare a project against itself")
        if r not in _VALID_RATINGS:
            raise ValueError(f"soft rating must be one of {_VALID_RATINGS}, got {r!r}")

        lock_a, lock_b = self._acquire_pair(i, j)
        with lock_a, lock_b:
            bi, bj = self._beliefs[i], self._beliefs[j]
            delta_mu0, delta_var0 = self._delta_stats(bi, bj)
            residual = (r - 3) - self.alpha * delta_mu0
            self._apply_linear_gaussian_evidence(
                bi, bj, self.w, self.alpha, residual, self.sigma ** 2, delta_var0
            )

    # ---- overall channel: binary Bradley-Terry outcome (Fisher step) -----

    def update_overall_binary(self, winner: str, loser: str) -> None:
        """Binary "A beat B" overall outcome, ordinary Bradley-Terry."""
        if winner == loser:
            raise ValueError("cannot compare a project against itself")

        lock_a, lock_b = self._acquire_pair(winner, loser)
        with lock_a, lock_b:
            bw, bl = self._beliefs[winner], self._beliefs[loser]
            delta_mu0, delta_var0 = self._delta_stats(bw, bl)
            p = float(np.clip(expit(delta_mu0), _PROB_EPS, 1.0 - _PROB_EPS))
            gradient = 1.0 - p          # d/dDelta log sigma(Delta), target=1 (winner)
            fisher_info = p * (1.0 - p)
            if fisher_info < _MIN_FISHER_INFO:
                # Outcome was already near-certain under the current belief;
                # a Newton step here would divide by ~0 and inject an
                # enormous, spurious precision/mean update. Skipping is the
                # numerically correct behaviour: an expected outcome truly
                # carries almost no new information.
                logger.debug(
                    "near-certain BT outcome (p=%.6f) for %s vs %s; skipping update",
                    p, winner, loser,
                )
                return
            residual = gradient / fisher_info
            self._apply_linear_gaussian_evidence(
                bw, bl, self.w, 1.0, residual, 1.0 / fisher_info, delta_var0
            )

    # ---- facet channel: per-criterion probit (Fisher step) ---------------

    def update_facet(self, i: str, j: str, criterion_idx: int, winner: str) -> None:
        """Per-criterion probit preference; touches only dimension `criterion_idx`."""
        if i == j:
            raise ValueError("cannot compare a project against itself")
        if not (0 <= criterion_idx < self.d):
            raise ValueError(f"criterion_idx {criterion_idx} out of range [0, {self.d})")
        if winner not in (i, j):
            raise ValueError("winner must be one of the two compared projects")

        lock_a, lock_b = self._acquire_pair(i, j)
        with lock_a, lock_b:
            bi, bj = self._beliefs[i], self._beliefs[j]
            direction = np.zeros(self.d, dtype=np.float64)
            direction[criterion_idx] = 1.0
            z_mu = float(bi.mu[criterion_idx] - bj.mu[criterion_idx])
            z_var = float(bi.var[criterion_idx] + bj.var[criterion_idx])
            y = 1.0 if winner == i else -1.0

            cdf = float(np.clip(ndtr(y * z_mu), _PROB_EPS, 1.0 - _PROB_EPS))
            pdf = float(np.exp(-0.5 * z_mu ** 2) / np.sqrt(2.0 * np.pi))
            gradient = y * pdf / cdf
            cdf_pos = float(np.clip(ndtr(z_mu), _PROB_EPS, 1.0 - _PROB_EPS))
            cdf_neg = float(np.clip(ndtr(-z_mu), _PROB_EPS, 1.0 - _PROB_EPS))
            fisher_info = (pdf ** 2) / (cdf_pos * cdf_neg)

            if fisher_info < _MIN_FISHER_INFO:
                logger.debug(
                    "near-certain facet outcome (criterion=%d) for %s vs %s; skipping",
                    criterion_idx, i, j,
                )
                return

            residual = gradient / fisher_info
            self._apply_linear_gaussian_evidence(
                bi, bj, direction, 1.0, residual, 1.0 / fisher_info, z_var
            )

    # ---- ranking ------------------------------------------------------

    def rank(self) -> List[Tuple[str, float]]:
        """Return (project_id, score) pairs sorted best-first."""
        with self._registry_lock:
            items = list(self._beliefs.items())
        return sorted(((pid, self.beta(b)) for pid, b in items), key=lambda kv: kv[1], reverse=True)

    def get_belief(self, project_id: str) -> ProjectBelief:
        return self._get_or_create(project_id)
