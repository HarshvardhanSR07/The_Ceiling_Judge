# JUDGING.md — IMBR Mathematics

Forge uses a **single ranking model**: Interactive Multi-Facet Bayesian Ranking (IMBR).  
It is a deliberate replacement for Gavel’s scalar Bradley-Terry system.

## 1. Representation

Each project \(i\) has a latent strength vector (one dimension per criterion):

\[
\mathbf{s}_i \in \mathbb{R}^d, \quad \mathbf{s}_i \sim \mathcal{N}(\boldsymbol{\mu}_i, \boldsymbol{\Sigma}_i)
\]

For the rapid prototype we keep \(\boldsymbol{\Sigma}_i\) diagonal.

## 2. Overall comparison (probit)

\[
P(i \succ j \mid \mathbf{w}) = \Phi\bigl(\mathbf{w}^\top (\mathbf{s}_i - \mathbf{s}_j)\bigr)
\]

where \(\Phi\) is the standard normal CDF and \(\mathbf{w}\) are criterion weights.

## 3. Soft preference (1–5)

\[
P(r \mid \mathbf{s}_i,\mathbf{s}_j) \propto
\exp\Bigl(-\frac{(r - 3 - \alpha\cdot\mathbf{w}^\top(\mathbf{s}_i-\mathbf{s}_j))^2}{2\sigma^2}\Bigr)
\]

## 4. Facet-specific feedback

When a judge marks criterion \(c\):

\[
P(i \succ_c j) = \Phi(s_{i,c} - s_{j,c})
\]

Only that dimension is updated.

## 5. Bayesian update

After every observation:

\[
p(\mathbf{s}\mid\text{data}) \propto p(\text{data}\mid\mathbf{s})\,p(\mathbf{s})
\]

Implemented with a Laplace (or mean-field variational) step for real-time speed.

## 6. Final score

\[
\text{Score}_i = \mathbf{w}^\top \boldsymbol{\mu}_i
\]

Uncertainty \(\boldsymbol{\Sigma}_i\) is retained for confidence display.

## 7. Active interaction

After a judgment the system maximises expected reduction in ranking entropy of the current top-\(k\).  
It may return a new pair **or** a clarifying facet question. This dialogue replaces Gavel’s pure sequential pairwise flow.

## 8. Assignment

Judges receive a bounded batch. Next item is chosen by information-gain / load-balance hybrid. Conflict-of-interest flags are respected.

## 9. Role isolation

Peer score reads are rejected in **middleware** with 401/403. UI hiding is not sufficient.

## 10. Fixture compatibility

Absolute criterion scores present in fixtures.json are ingested as initial observations so the acceptance suite and demo data remain consistent.
