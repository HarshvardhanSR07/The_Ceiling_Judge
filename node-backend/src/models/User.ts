/**
 * @file models/User.ts
 * @description Mongoose schema and model for application users.
 *
 * Covers every role in the system (visitor is implicit / unauthenticated
 * and has no persisted document): participant, judge, organizer, admin.
 *
 * This is the ONLY file that may call `mongoose.model("User", ...)`.
 * `models/index.ts` only re-exports `User` from here — see that file's
 * header comment for why a second registration under the same model name
 * is never safe (Mongoose throws `OverwriteModelError` unconditionally on
 * a duplicate `mongoose.model(name, schema)` call, regardless of whether
 * the two schemas agree).
 */

import mongoose, { Schema, Document } from "mongoose";
import type { Role } from "../config/auth.js";

export interface IUser extends Document {
  /** Application-level ID (e.g. `prt_ab12cd34`) — NOT the Mongo `_id`. */
  id: string;
  email: string;
  name: string;
  role: Role;
  /** bcrypt hash — never the plaintext password. */
  passwordHash: string;
  /** Opaque session token backing the httpOnly cookie; rotated on login. */
  sessionToken: string;
  /** Optional track restriction for judges (e.g. only judge `trk_ai`). */
  tracks?: string[];
  /**
   * Denormalized cache of project IDs this judge is assigned to.
   * `services/assignmentService.ts` keeps this in sync every time an
   * `Assignment` row is written (see `assignManual` / `autoAssign`).
   * `Assignment` is the source of truth; this field exists only so
   * `middleware/auth.ts` and `GET /api/me` can read it without an extra
   * query.
   */
  assignedProjects?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    id: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "organizer", "judge", "participant", "visitor"],
      required: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    sessionToken: { type: String, required: true, unique: true, index: true },
    tracks: [String],
    assignedProjects: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>("User", UserSchema);
