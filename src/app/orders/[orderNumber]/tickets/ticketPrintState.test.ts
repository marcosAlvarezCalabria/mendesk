import { describe, expect, it } from "vitest";

import { createTicketPrintState, failTicketJob, finishTicket, retryTicketIndexes, startTicketJob, toggleTicket } from "@/app/orders/[orderNumber]/tickets/ticketPrintState";

describe("ticketPrintState", () => {
  it("selects every garment initially and toggles one without affecting the others", () => {
    const initial = createTicketPrintState(3);
    expect(initial.selected).toEqual([true, true, true]);
    expect(toggleTicket(initial, 1).selected).toEqual([true, false, true]);
  });

  it("retains the selection and retries only tickets not confirmed by the printer", () => {
    const initial = toggleTicket(createTicketPrintState(3), 1);
    const started = startTicketJob(initial, [0, 2]);
    const onePrinted = finishTicket(started);
    const failed = failTicketJob(onePrinted);

    expect(failed.selected).toEqual([true, false, true]);
    expect(retryTicketIndexes(failed)).toEqual([2]);
  });

  it("has no retry work after every ticket is confirmed", () => {
    const started = startTicketJob(createTicketPrintState(1), [0]);
    expect(retryTicketIndexes(finishTicket(started))).toEqual([]);
  });
});
