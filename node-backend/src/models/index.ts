/**
 * @file models/index.ts
 * @description Barrel re-export for all Mongoose models.
 *
 * Previously this file contained duplicate, lightweight shadow schemas that
 * conflicted with the authoritative definitions in the individual model files.
 * Duplicate model registration causes runtime warnings and TypeScript silently
 * picks whichever interface is imported first, masking missing fields.
 *
 * This file is now a pure re-export.  All schema definitions live in their
 * own files; add a new model by creating `models/MyModel.ts` and adding one
 * export line here.
 */

export { User }         from "./User.js";
export type { IUser }   from "./User.js";

export { Observation }          from "./Observation.js";
export type { IObservation, ObservationChannel, IFacetMark } from "./Observation.js";

export { Assignment }           from "./Assignment.js";
export type { IAssignment, AssignmentStatus } from "./Assignment.js";

export { Criterion }            from "./Criterion.js";
export type { ICriterion }      from "./Criterion.js";

export { AuditLog }             from "./AuditLog.js";
export type { IAuditLog }       from "./AuditLog.js";

export { Event, Project, Posterior } from "./EventProjectPosterior.js";
export type { IEvent, IProject, IPosterior } from "./EventProjectPosterior.js";
