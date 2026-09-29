/**
 * @file services/audit.ts
 * @description Thin wrapper for writing append-only audit log entries.
 *
 * Design decisions
 * ────────────────
 * • Audit writes are fire-and-forget (`.catch` logs but does not rethrow).
 *   A transient MongoDB hiccup must never surface as a 500 on the endpoint
 *   that triggered the write — the operation itself succeeded; only the audit
 *   trail has a gap.  The catch handler emits a structured error to stderr so
 *   the gap is visible in logs.
 *
 * • The function returns `void` (not `Promise<void>`) to make the fire-and-
 *   forget contract explicit at the call site — callers should NOT await it.
 *
 * • `payload` is typed as `Record<string, unknown>` rather than `any` to
 *   encourage structured audit records rather than arbitrary blobs.
 */

import { AuditLog } from "../models/AuditLog.js";

/**
 * Appends an audit log entry.  Never throws — failures are logged to stderr.
 *
 * @param actorId - The application-level ID of the user who performed the action.
 * @param action  - A dot-namespaced action string, e.g. `"observation.duplicate"`.
 * @param payload - Optional structured context for the event.
 *
 * @example
 *   writeAudit(req.user!.id, "criterion.create", { id: doc.id, name, weight });
 */
export function writeAudit(
  actorId: string,
  action:  string,
  payload: Record<string, unknown> = {},
): void {
  AuditLog.create({ actorId, action, payload, timestamp: new Date() })
    .catch((err: unknown) =>
      console.error("[audit] write failed — action:", action, "actor:", actorId, err),
    );
}
