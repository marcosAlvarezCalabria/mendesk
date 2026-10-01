export type TicketPrintPhase =
  | "idle"
  | "connecting"
  | "ready"
  | "printing"
  | "success"
  | "error";

export type TicketPrintState = {
  selected: boolean[];
  job: number[];
  confirmed: number;
  phase: TicketPrintPhase;
};

export function createTicketPrintState(ticketCount: number): TicketPrintState {
  return {
    selected: Array.from({ length: ticketCount }, () => true),
    job: [],
    confirmed: 0,
    phase: "idle",
  };
}

export function toggleTicket(
  state: TicketPrintState,
  index: number,
): TicketPrintState {
  if (index < 0 || index >= state.selected.length) return state;

  return {
    ...state,
    selected: state.selected.map((selected, ticketIndex) =>
      ticketIndex === index ? !selected : selected,
    ),
  };
}

export function startTicketJob(
  state: TicketPrintState,
  indexes: readonly number[],
): TicketPrintState {
  return {
    ...state,
    job: [...indexes],
    confirmed: 0,
    phase: "connecting",
  };
}

export function finishTicket(state: TicketPrintState): TicketPrintState {
  const confirmed = Math.min(state.confirmed + 1, state.job.length);

  return {
    ...state,
    confirmed,
    phase: confirmed === state.job.length ? "success" : "printing",
  };
}

export function failTicketJob(state: TicketPrintState): TicketPrintState {
  return { ...state, phase: "error" };
}

export function retryTicketIndexes(state: TicketPrintState): number[] {
  return state.job.slice(state.confirmed);
}
