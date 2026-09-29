/**
 * @file models/AuditLog.ts
 * @description Append-only audit trail model.
 *
 * Every audit write in the codebase — auth events (`services/authService.ts`),
 * observation/assignment/criterion events (`services/audit.ts`) — lands in
 * this single collection. `models/index.ts` only re-exports `AuditLog` from
 * here; this is the only file that may call `mongoose.model("AuditLog", ...)`.
 */

import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  /** Application-level ID of the user who performed the action (or an
   *  email string for a failed pre-auth login attempt). */
  actorId: string;
  /** Dot-namespaced action, e.g. `"observation.duplicate"`, `"criterion.create"`. */
  action: string;
  ip?: string;
  userAgent?: string;
  payload?: Record<string, unknown>;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  actorId: { type: String, index: true },
  action: { type: String, required: true, index: true },
  ip: String,
  userAgent: String,
  payload: Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now, index: true },
});

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
