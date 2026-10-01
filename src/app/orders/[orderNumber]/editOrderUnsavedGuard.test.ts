import { describe, expect, it, vi } from "vitest";
import {
  confirmEditOrderNavigation,
  guardEditOrderBeforeUnload,
  handleEditOrderPopNavigation,
  isEditOrderLeaveGuardActive,
} from "./editOrderUnsavedGuard";

describe("edit order unsaved changes guard", () => {
  it.each([
    [{ dirty: false, pending: false }, false],
    [{ dirty: true, pending: false }, true],
    [{ dirty: true, pending: true }, false],
  ])("activates only for unsaved changes that are not being saved", (state, expected) => {
    expect(isEditOrderLeaveGuardActive(state)).toBe(expected);
  });

  it("keeps internal navigation on the current page when Stay is chosen", () => {
    const confirmLeave = vi.fn(() => false);
    expect(confirmEditOrderNavigation({ dirty: true, pending: false }, confirmLeave)).toBe(false);
    expect(confirmLeave).toHaveBeenCalledOnce();
  });

  it("allows internal navigation once when Leave is chosen", () => {
    const confirmLeave = vi.fn(() => true);
    expect(confirmEditOrderNavigation({ dirty: true, pending: false }, confirmLeave)).toBe(true);
    expect(confirmLeave).toHaveBeenCalledOnce();
  });

  it("does not ask when the form has no unsaved changes", () => {
    const confirmLeave = vi.fn(() => false);
    expect(confirmEditOrderNavigation({ dirty: false, pending: false }, confirmLeave)).toBe(true);
    expect(confirmLeave).not.toHaveBeenCalled();
  });

  it("arms browser close only while the guard is active", () => {
    const activeEvent = { preventDefault: vi.fn(), returnValue: undefined as unknown };
    const cleanEvent = { preventDefault: vi.fn(), returnValue: undefined as unknown };
    expect(guardEditOrderBeforeUnload(activeEvent, { dirty: true, pending: false })).toBe(true);
    expect(activeEvent.preventDefault).toHaveBeenCalledOnce();
    expect(activeEvent.returnValue).toBe("");
    expect(guardEditOrderBeforeUnload(cleanEvent, { dirty: false, pending: false })).toBe(false);
    expect(cleanEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("restores the current history entry and focus when Back is rejected", () => {
    const restoreCurrentEntry = vi.fn();
    const restoreFocus = vi.fn();
    expect(handleEditOrderPopNavigation(
      { dirty: true, pending: false },
      () => false,
      restoreCurrentEntry,
      restoreFocus,
    )).toBe(false);
    expect(restoreCurrentEntry).toHaveBeenCalledOnce();
    expect(restoreFocus).toHaveBeenCalledOnce();
  });

  it("allows Back without restoring history when Leave is chosen", () => {
    const restoreCurrentEntry = vi.fn();
    const restoreFocus = vi.fn();
    expect(handleEditOrderPopNavigation(
      { dirty: true, pending: false },
      () => true,
      restoreCurrentEntry,
      restoreFocus,
    )).toBe(true);
    expect(restoreCurrentEntry).not.toHaveBeenCalled();
    expect(restoreFocus).not.toHaveBeenCalled();
  });
});
