import { describe, expect, it, vi } from "vitest";

import {
  confirmNewOrderNavigation,
  guardNewOrderBeforeUnload,
  handleNewOrderPopNavigation,
  isNewOrderLeaveGuardActive,
} from "@/app/orders/new/newOrderUnsavedGuard";

describe("new order unsaved changes guard", () => {
  it.each([
    [{ dirty: false, submitting: false }, false],
    [{ dirty: true, submitting: false }, true],
    [{ dirty: true, submitting: true }, false],
    [{ dirty: true, submitting: false, saved: true }, false],
  ] as const)("derives whether leaving needs confirmation from %o", (state, expected) => {
    expect(isNewOrderLeaveGuardActive(state)).toBe(expected);
  });

  it("lets clean navigation leave without opening a confirmation", () => {
    const confirmLeave = vi.fn(() => false);

    expect(confirmNewOrderNavigation({ dirty: false, submitting: false }, confirmLeave)).toBe(true);
    expect(confirmLeave).not.toHaveBeenCalled();
  });

  it.each([
    [true, true],
    [false, false],
  ])("honours the leave or stay choice for dirty navigation", (choice, expected) => {
    const confirmLeave = vi.fn(() => choice);

    expect(confirmNewOrderNavigation({ dirty: true, submitting: false }, confirmLeave)).toBe(expected);
    expect(confirmLeave).toHaveBeenCalledOnce();
  });

  it("arms beforeunload only while dirty and not submitting", () => {
    const preventDefault = vi.fn();
    const event = { preventDefault, returnValue: undefined };

    expect(guardNewOrderBeforeUnload(event, { dirty: true, submitting: false })).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(event.returnValue).toBe("");
  });

  it.each([
    { dirty: false, submitting: false },
    { dirty: true, submitting: true },
  ])("does not arm beforeunload for %o", (state) => {
    const preventDefault = vi.fn();
    const event = { preventDefault, returnValue: undefined };

    expect(guardNewOrderBeforeUnload(event, state)).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(event.returnValue).toBeUndefined();
  });

  it("allows browser Back or Forward after confirmation without restoring history", () => {
    const restoreCurrentEntry = vi.fn();

    expect(handleNewOrderPopNavigation(
      { dirty: true, submitting: false },
      () => true,
      restoreCurrentEntry,
    )).toBe(true);
    expect(restoreCurrentEntry).not.toHaveBeenCalled();
  });

  it("restores the form once when browser Back or Forward is rejected", () => {
    const restoreCurrentEntry = vi.fn();

    expect(handleNewOrderPopNavigation(
      { dirty: true, submitting: false },
      () => false,
      restoreCurrentEntry,
    )).toBe(false);
    expect(restoreCurrentEntry).toHaveBeenCalledOnce();
  });
});
