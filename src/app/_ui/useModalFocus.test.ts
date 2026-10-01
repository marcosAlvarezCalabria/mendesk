import { afterEach, describe, expect, it, vi } from "vitest";

const lifecycle = vi.hoisted(() => ({ cleanup: undefined as void | (() => void) }));

vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void)) => { lifecycle.cleanup = effect(); },
}));

import { useModalFocus } from "@/app/_ui/useModalFocus";

class Focusable {
  focus = vi.fn(() => { documentState.activeElement = this; });
  hasAttribute = vi.fn(() => false);
}

const documentState: {
  activeElement: Focusable | null;
  keydown?: (event: { key: string; shiftKey: boolean; preventDefault: () => void }) => void;
} = { activeElement: null };

describe("useModalFocus", () => {
  afterEach(() => {
    lifecycle.cleanup?.();
    lifecycle.cleanup = undefined;
    vi.unstubAllGlobals();
    documentState.activeElement = null;
    documentState.keydown = undefined;
  });

  it("focuses the first control, wraps Tab, and returns focus on close", () => {
    const trigger = new Focusable();
    const first = new Focusable();
    const last = new Focusable();
    const panel = Object.assign(new Focusable(), { querySelectorAll: vi.fn(() => [first, last]) });
    documentState.activeElement = trigger;
    vi.stubGlobal("HTMLElement", Focusable);
    vi.stubGlobal("document", {
      get activeElement() { return documentState.activeElement; },
      addEventListener: (_type: string, handler: typeof documentState.keydown) => { documentState.keydown = handler; },
      removeEventListener: vi.fn(),
    });

    useModalFocus(true, { current: panel } as never, { current: trigger } as never);
    expect(first.focus).toHaveBeenCalledOnce();

    documentState.activeElement = last;
    const preventDefault = vi.fn();
    documentState.keydown?.({ key: "Tab", shiftKey: false, preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledTimes(2);

    lifecycle.cleanup?.();
    lifecycle.cleanup = undefined;
    expect(trigger.focus).toHaveBeenCalledOnce();
  });
});
