/**
 * @file models/EventProjectPosterior.ts
 * @description Mongoose schemas and models for Event, Project, and Posterior.
 *
 * These three models are tightly coupled to the ranking lifecycle:
 *   - Event       — configuration (criteria, tracks, deadline)
 *   - Project     — a hackathon submission
 *   - Posterior   — IMBR-BT state (μ, Σ) per project; updated each observation
 *
 * Kept in one file because they share no complex sub-schemas and splitting
 * them further would create noise without meaningful benefit.
 */

import mongoose, { Schema, Document } from "mongoose";

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export interface IEvent extends Document {
  id: string;
  name: string;
  submissionsClose: Date;
  tracks: { id: string; name: string }[];
  criteria: { id: string; label: string; weight: number }[];
}

const EventSchema = new Schema<IEvent>({
  id:               { type: String, required: true, unique: true, index: true },
  name:             { type: String, required: true },
  submissionsClose: { type: Date,   required: true },
  tracks: [{ id: String, name: String }],
  criteria: [{ id: String, label: String, weight: Number }],
});

export const Event = mongoose.model<IEvent>("Event", EventSchema);

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export interface IProject extends Document {
  id: string;
  teamId: string;
  trackId: string;
  title: string;
  summary: string;
  repoUrl?: string;
  submittedAt: Date;
}

const ProjectSchema = new Schema<IProject>({
  id:          { type: String, required: true, unique: true, index: true },
  teamId:      { type: String, required: true, index: true },
  trackId:     { type: String, required: true, index: true },
  title:       { type: String, required: true },
  summary:     { type: String, default: "" },
  repoUrl:     String,
  submittedAt: { type: Date, required: true },
});

export const Project = mongoose.model<IProject>("Project", ProjectSchema);

// ---------------------------------------------------------------------------
// Posterior  (IMBR-BT ranking state)
// ---------------------------------------------------------------------------

export interface IPosterior extends Document {
  projectId: string;
  /** Mean vector — one entry per judging criterion. */
  mu: number[];
  /** Diagonal standard-deviation vector — uncertainty per criterion. */
  sigma: number[];
  updatedAt: Date;
}

const PosteriorSchema = new Schema<IPosterior>({
  projectId: { type: String, required: true, unique: true, index: true },
  mu:        { type: [Number], required: true },
  sigma:     { type: [Number], required: true },
  updatedAt: { type: Date,   required: true },
});

export const Posterior = mongoose.model<IPosterior>("Posterior", PosteriorSchema);
