import { afterEach, describe, expect, it, vi } from "vitest";

const lifecycle = vi.hoisted(() => ({ cleanup: undefined as void | (() => void) }));

vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void)) => { lifecycle.cleanup = effect(); },
}));

import { useDismissibleDetails } from "./useDismissibleDetails";

describe("useDismissibleDetails", () => {
  afterEach(() => {
    lifecycle.cleanup?.();
    lifecycle.cleanup = undefined;
    vi.unstubAllGlobals();
  });

  it("closes on an outside pointer without stealing focus", () => {
    const listeners = new Map<string, (event: { target?: unknown; key?: string; preventDefault?: () => void }) => void>();
    const removeEventListener = vi.fn();
    vi.stubGlobal("document", {
      addEventListener: (type: string, listener: (event: { target?: unknown; key?: string; preventDefault?: () => void }) => void) => listeners.set(type, listener),
      removeEventListener,
    });
    const inside = {};
    const details = { open: true, contains: vi.fn((target: unknown) => target === inside) };
    const trigger = { focus: vi.fn() };
    const onOpenChange = vi.fn();

    useDismissibleDetails(true, { current: details } as never, { current: trigger } as never, onOpenChange);
    listeners.get("pointerdown")?.({ target: inside });
    expect(details.open).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();

    listeners.get("pointerdown")?.({ target: {} });
    expect(details.open).toBe(false);
    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(trigger.focus).not.toHaveBeenCalled();

    lifecycle.cleanup?.();
    lifecycle.cleanup = undefined;
    expect(removeEventListener).toHaveBeenCalledWith("pointerdown", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("closes on Escape and restores focus to the trigger", () => {
    const listeners = new Map<string, (event: { target?: unknown; key?: string; preventDefault?: () => void }) => void>();
    vi.stubGlobal("document", {
      addEventListener: (type: string, listener: (event: { target?: unknown; key?: string; preventDefault?: () => void }) => void) => listeners.set(type, listener),
      removeEventListener: vi.fn(),
    });
    const details = { open: true, contains: vi.fn() };
    const trigger = { focus: vi.fn() };
    const onOpenChange = vi.fn();
    const preventDefault = vi.fn();

    useDismissibleDetails(true, { current: details } as never, { current: trigger } as never, onOpenChange);
    listeners.get("keydown")?.({ key: "Escape", preventDefault });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(details.open).toBe(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(trigger.focus).toHaveBeenCalledOnce();
  });

  it("does not register document listeners while closed", () => {
    const addEventListener = vi.fn();
    vi.stubGlobal("document", { addEventListener, removeEventListener: vi.fn() });

    useDismissibleDetails(false, { current: null }, { current: null }, vi.fn());

    expect(addEventListener).not.toHaveBeenCalled();
  });
});
