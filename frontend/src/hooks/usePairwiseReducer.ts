
export type PimState = "PAIR_READY" | "PREF_SET" | "COMMIT_START" | "COMMITTED" | "FORFEITED" | "DECOY_ACTIVE";

export interface PimReducerState {
  state: PimState;
  context: {
    mode: "unary" | "binary";
    preference?: number;
    meter: number;
    focus?: "A" | "B";
  };
}

export type PimAction =
  | { type: "HOVER_FOCUS"; payload?: "A" | "B" }
  | { type: "LEAVE_FOCUS" }
  | { type: "SET_PREFERENCE"; payload: number }
  | { type: "COMMIT_PREF" }
  | { type: "FINISH_COMMIT" }
  | { type: "FORFEIT" }
  | { type: "DWELL_15S" }
  | { type: "ACTIVITY" }
  | { type: "TOGGLE_MODE" };

export function pairwiseReducer(state: PimReducerState, action: PimAction): PimReducerState {
  switch (action.type) {
    case "ACTIVITY":
      if (state.state === "DECOY_ACTIVE") return { ...state, state: "PAIR_READY" };
      return state;
    case "HOVER_FOCUS":
      return { ...state, context: { ...state.context, focus: action.payload } };
    case "LEAVE_FOCUS":
      return { ...state, context: { ...state.context, focus: undefined } };
    case "SET_PREFERENCE":
      return { ...state, state: "PREF_SET", context: { ...state.context, preference: action.payload } };
    case "TOGGLE_MODE":
      return { ...state, context: { ...state.context, mode: state.context.mode === "unary" ? "binary" : "unary" } };
    case "COMMIT_PREF":
      return { ...state, state: "COMMIT_START" };
    case "FINISH_COMMIT":
      return { ...state, state: "COMMITTED" };
    case "FORFEIT":
      return { ...state, state: "FORFEITED" };
    case "DWELL_15S":
      return state.state === "PAIR_READY" ? { ...state, state: "DECOY_ACTIVE" } : state;
    default:
      return state;
  }
}

