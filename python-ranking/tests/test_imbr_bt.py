"""
test_imbr_bt.py
================
Unit tests for imbr_bt.py, covering:
  - input validation / boundary conditions
  - correctness of the Bayesian update direction and magnitude
  - the numerical edge cases identified in the audit (near-certain
    outcomes, precision blow-up, self-comparison)
  - a concurrency stress test for the lock-ordering fix
"""

import itertools
import random
import threading

import numpy as np
import pytest

from imbr_bt import IMBRBTModel, ProjectBelief


D = 3
W = [1.0, 1.0, 1.0]


def make_model(**kwargs) -> IMBRBTModel:
    defaults = dict(d=D, weights=W, alpha=1.0, soft_rating_sigma=1.0, prior_var=1.0)
    defaults.update(kwargs)
    return IMBRBTModel(**defaults)


# ---------------------------------------------------------------------------
# Construction / validation
# ---------------------------------------------------------------------------

def test_weights_are_normalised():
    m = make_model(weights=[3.0, 4.0, 0.0])
    assert np.isclose(np.linalg.norm(m.w), 1.0)


def test_zero_weight_vector_rejected():
    with pytest.raises(ValueError):
        make_model(weights=[0.0, 0.0, 0.0])


def test_wrong_shape_weights_rejected():
    with pytest.raises(ValueError):
        make_model(weights=[1.0, 1.0])


def test_zero_alpha_rejected():
    with pytest.raises(ValueError):
        make_model(alpha=0.0)


def test_nonpositive_sigma_rejected():
    with pytest.raises(ValueError):
        make_model(soft_rating_sigma=0.0)


def test_bad_precision_bounds_rejected():
    with pytest.raises(ValueError):
        make_model(min_precision=10.0, max_precision=1.0)


# ---------------------------------------------------------------------------
# Boundary conditions on inputs to update calls
# ---------------------------------------------------------------------------

def test_self_comparison_soft_raises():
    m = make_model()
    with pytest.raises(ValueError):
        m.update_soft("A", "A", 5)


def test_self_comparison_binary_raises():
    m = make_model()
    with pytest.raises(ValueError):
        m.update_overall_binary("A", "A")


def test_self_comparison_facet_raises():
    m = make_model()
    with pytest.raises(ValueError):
        m.update_facet("A", "A", 0, "A")


@pytest.mark.parametrize("bad_rating", [0, 6, -1, 3.5, "3", None])
def test_invalid_soft_rating_raises(bad_rating):
    m = make_model()
    with pytest.raises(ValueError):
        m.update_soft("A", "B", bad_rating)


def test_facet_criterion_out_of_range_raises():
    m = make_model()
    with pytest.raises(ValueError):
        m.update_facet("A", "B", 99, "A")


def test_facet_winner_must_be_one_of_the_pair():
    m = make_model()
    with pytest.raises(ValueError):
        m.update_facet("A", "B", 0, "C")


# ---------------------------------------------------------------------------
# Correctness of the update direction / magnitude
# ---------------------------------------------------------------------------

def test_soft_update_moves_winner_up_and_loser_down():
    m = make_model()
    beta_a0 = m.beta(m.get_belief("A"))
    beta_b0 = m.beta(m.get_belief("B"))
    m.update_soft("A", "B", r=5)  # A strongly preferred
    beta_a1 = m.beta(m.get_belief("A"))
    beta_b1 = m.beta(m.get_belief("B"))
    assert beta_a1 > beta_a0
    assert beta_b1 < beta_b0


def test_neutral_soft_rating_does_not_move_symmetric_priors():
    m = make_model()
    m.update_soft("A", "B", r=3)  # r=3 => residual should be ~0 for symmetric priors
    beta_a = m.beta(m.get_belief("A"))
    beta_b = m.beta(m.get_belief("B"))
    assert abs(beta_a - beta_b) < 1e-9


def test_soft_update_strictly_increases_precision():
    m = make_model()
    prec_before = m.get_belief("A").precision.copy()
    m.update_soft("A", "B", r=4)
    prec_after = m.get_belief("A").precision
    assert np.all(prec_after >= prec_before)
    assert np.any(prec_after > prec_before)


def test_repeated_agreement_increases_confidence_monotonically():
    m = make_model()
    scores = []
    for _ in range(20):
        m.update_overall_binary("A", "B")
        scores.append(m.beta(m.get_belief("A")) - m.beta(m.get_belief("B")))
    # the gap should be non-decreasing on average and never go negative
    assert scores[-1] > scores[0]
    assert all(s >= -1e-9 for s in scores)


def test_prediction_agrees_with_relative_score():
    m = make_model()
    for _ in range(10):
        m.update_overall_binary("A", "B")
    p = m.predict_overall_prob("A", "B")
    assert p > 0.5
    p_rev = m.predict_overall_prob("B", "A")
    assert np.isclose(p + p_rev, 1.0, atol=1e-9)


def test_facet_update_only_touches_target_dimension():
    m = make_model()
    m.update_facet("A", "B", criterion_idx=1, winner="A")
    mu_a = m.get_belief("A").mu
    prec_a = m.get_belief("A").precision
    for k in (0, 2):
        assert mu_a[k] == 0.0
        assert prec_a[k] == pytest.approx(1.0 / m.prior_var)
    assert mu_a[1] != 0.0
    assert prec_a[1] > 1.0 / m.prior_var


# ---------------------------------------------------------------------------
# Numerical edge cases identified in the audit
# ---------------------------------------------------------------------------

def test_near_certain_binary_outcome_does_not_explode():
    """
    Force Delta far into the tail (p -> 1) and confirm the Fisher-info
    guard kicks in instead of dividing by ~0 and producing inf/nan.
    """
    m = make_model()
    bw = m.get_belief("WINNER")
    bl = m.get_belief("LOSER")
    bw.mu[:] = 50.0   # already an overwhelming favourite
    bl.mu[:] = -50.0
    m.update_overall_binary("WINNER", "LOSER")
    assert np.all(np.isfinite(bw.mu))
    assert np.all(np.isfinite(bl.mu))
    assert np.all(np.isfinite(bw.precision))
    assert np.all(np.isfinite(bl.precision))


def test_near_certain_facet_outcome_does_not_explode():
    m = make_model()
    bi = m.get_belief("A")
    bj = m.get_belief("B")
    bi.mu[0] = 100.0
    bj.mu[0] = -100.0
    m.update_facet("A", "B", criterion_idx=0, winner="A")
    assert np.all(np.isfinite(bi.mu))
    assert np.all(np.isfinite(bj.mu))


def test_precision_never_exceeds_max_precision():
    m = make_model(max_precision=10.0)
    for _ in range(500):
        m.update_soft("A", "B", r=5)
    assert np.all(m.get_belief("A").precision <= 10.0 + 1e-9)


def test_precision_never_below_min_precision():
    m = make_model(min_precision=0.01)
    # even with no updates at all, prior precision must respect the floor
    b = m.get_belief("NEW")
    assert np.all(b.precision >= 0.01)


def test_cold_start_project_has_prior_mean_zero():
    m = make_model()
    b = m.get_belief("FRESH")
    assert np.allclose(b.mu, 0.0)
    assert b.n_observations == 0


# ---------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------

def test_rank_is_sorted_descending_by_score():
    m = make_model()
    for _ in range(5):
        m.update_overall_binary("A", "B")
        m.update_overall_binary("B", "C")
    ranking = m.rank()
    scores = [s for _, s in ranking]
    assert scores == sorted(scores, reverse=True)
    ids = [pid for pid, _ in ranking]
    assert ids.index("A") < ids.index("B") < ids.index("C")


# ---------------------------------------------------------------------------
# Concurrency: the lock-ordering fix must prevent deadlock under contention
# ---------------------------------------------------------------------------

def test_concurrent_updates_do_not_deadlock_or_corrupt_state():
    m = make_model()
    project_ids = [f"P{k}" for k in range(6)]
    for pid in project_ids:
        m.get_belief(pid)  # pre-register so pairs can be chosen freely

    pairs = list(itertools.permutations(project_ids, 2))
    errors = []

    def worker(seed: int):
        rng = random.Random(seed)
        try:
            for _ in range(200):
                i, j = rng.choice(pairs)
                choice = rng.random()
                if choice < 0.34:
                    m.update_soft(i, j, rng.choice([1, 2, 3, 4, 5]))
                elif choice < 0.67:
                    m.update_overall_binary(i, j)
                else:
                    m.update_facet(i, j, rng.randrange(D), rng.choice([i, j]))
        except Exception as exc:  # pragma: no cover - surfaced via `errors`
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(seed,)) for seed in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)

    assert not any(t.is_alive() for t in threads), "deadlock: a worker thread never finished"
    assert not errors, f"worker raised: {errors}"
    for pid in project_ids:
        b = m.get_belief(pid)
        assert np.all(np.isfinite(b.mu))
        assert np.all(np.isfinite(b.precision))
