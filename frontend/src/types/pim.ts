
export type PimMode = "soft" | "binary";

export type PimState =
  | "IDLE_BATCH"
  | "LEVELING_ON"
  | "PAIR_READY"
  | "DISCLOSED"
  | "DECOY_ACTIVE"
  | "PREF_SET"
  | "COMMIT_PREF"
  | "COMMIT_ABSTAIN"
  | "NEXT_OR_DONE"
  | "EMPTY_COMPLETE";

export type PimAction =
  | { type: "START_BATCH" }
  | { type: "LOADED_PAIR" }
  | { type: "HOVER_FOCUS" }
  | { type: "LEAVE_FOCUS" }
  | { type: "DWELL_15S" }
  | { type: "ACTIVITY" }
  | { type: "SET_PREFERENCE"; payload: number }
  | { type: "COMMIT_PREF" }
  | { type: "FORFEIT" }
  | { type: "FINISH_COMMIT" }
  | { type: "QUEUE_EMPTY" };

