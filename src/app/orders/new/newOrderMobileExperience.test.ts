import { describe, expect, it, vi } from "vitest";

import { newOrderSuccessDestination, revealNewOrderStep } from "@/app/orders/new/NewOrderClientForm";

describe("new order mobile experience", () => {
  it("returns to the general orders list after creation", () => {
    expect(newOrderSuccessDestination()).toBe("/orders");
  });

  it("reveals and focuses the beginning of the active step", () => {
    const heading = {
      focus: vi.fn(),
      scrollIntoView: vi.fn(),
    };
    const form = {
      querySelector: vi.fn(() => heading),
    } as unknown as HTMLFormElement;

    revealNewOrderStep(form, "garments");

    expect(form.querySelector).toHaveBeenCalledWith('[data-step-heading="garments"]');
    expect(heading.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(heading.focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});
