"""
FastAPI wrapper around IMBRBTModel.

Node owns: auth, assignment, canonical pairs, payload_hash, Merkle, Postgres.
Python owns: in-memory beliefs + rank math only.

Replay: POST /v1/comparisons/batch on boot (Node pushes ScoreEvent history).
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any, Literal, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from imbr_bt import IMBRBTModel

# --- model singleton (rebuilt via /v1/comparisons/batch after restart) ---
D = int(os.getenv("IMBR_D", "4"))
WEIGHTS = [float(x) for x in os.getenv("IMBR_WEIGHTS", "0.3,0.3,0.25,0.15").split(",")]
if len(WEIGHTS) != D:
    WEIGHTS = [1.0 / D] * D

model = IMBRBTModel(d=D, weights=WEIGHTS)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(title="Forge ranking (IMBR-BT)", version="1.0.0", lifespan=lifespan)


class ComparisonIn(BaseModel):
    """Clean math payload from Node (already canonicalized)."""

    channel: Literal["soft", "binary", "facet"] = "soft"
    project_a: str
    project_b: str
    soft_rating: Optional[int] = Field(None, ge=1, le=5)
    winner: Optional[str] = None  # project id for binary / facet
    criterion_idx: Optional[int] = None  # facet only


class BatchIn(BaseModel):
    events: list[ComparisonIn]
    reset: bool = True  # wipe in-memory beliefs before replay


def _apply(ev: ComparisonIn) -> None:
    if ev.channel == "soft":
        if ev.soft_rating is None:
            raise HTTPException(400, "soft_rating required for soft channel")
        model.update_soft(ev.project_a, ev.project_b, ev.soft_rating)
    elif ev.channel == "binary":
        if not ev.winner or ev.winner not in (ev.project_a, ev.project_b):
            raise HTTPException(400, "winner must be project_a or project_b")
        loser = ev.project_b if ev.winner == ev.project_a else ev.project_a
        model.update_overall_binary(ev.winner, loser)
    elif ev.channel == "facet":
        if ev.criterion_idx is None or ev.winner is None:
            raise HTTPException(400, "criterion_idx and winner required for facet")
        model.update_facet(ev.project_a, ev.project_b, ev.criterion_idx, ev.winner)
    else:
        raise HTTPException(400, f"unknown channel {ev.channel}")


@app.get("/health")
def health():
    return {"ok": True, "service": "python-ranking", "projects": len(model._beliefs)}


@app.post("/v1/comparisons")
def post_comparison(body: ComparisonIn):
    try:
        _apply(body)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return {"ok": True, "ranking_head": model.rank()[:5]}


@app.post("/v1/comparisons/batch")
def post_batch(body: BatchIn):
    """Event replay after container restart. Node pushes full ScoreEvent history."""
    global model
    if body.reset:
        model = IMBRBTModel(d=D, weights=WEIGHTS)
    applied = 0
    errors: list[dict[str, Any]] = []
    for i, ev in enumerate(body.events):
        try:
            _apply(ev)
            applied += 1
        except Exception as e:  # keep replaying; log bad rows
            errors.append({"index": i, "error": str(e)})
    return {"ok": True, "applied": applied, "errors": errors, "projects": len(model._beliefs)}


@app.get("/v1/rankings")
def get_rankings():
    rows = model.rank()
    return {
        "ranking": [
            {
                "project_id": pid,
                "score": score,
                "n_observations": model.get_belief(pid).n_observations,
            }
            for pid, score in rows
        ]
    }


@app.get("/v1/projects/{project_id}/belief")
def get_belief(project_id: str):
    b = model.get_belief(project_id)
    return {
        "project_id": project_id,
        "mu": b.mu.tolist(),
        "var": b.var.tolist(),
        "n_observations": b.n_observations,
    }
