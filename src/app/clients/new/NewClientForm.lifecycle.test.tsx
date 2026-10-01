import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  state: { name: "Example", phone: "", gdprConsent: false, hydrated: true, pending: false, frozen: false, recovery: false, checkedPhone: null, storageError: false, result: { status: "idle" } } as Record<string, unknown>,
  abandon: vi.fn(() => true), open: vi.fn(), push: vi.fn(), replace: vi.fn(),
  keepEditing: vi.fn(), submit: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock("./actions", () => ({ registerClientAction: vi.fn() }));
vi.mock("./clientRegistrationSession", () => ({ createClientRegistrationSession: () => ({
  snapshot: () => mocks.state, subscribe: vi.fn(), hydrate: vi.fn(), abandon: mocks.abandon, open: mocks.open,
  keepEditing: mocks.keepEditing, submit: mocks.submit,
}) }));
vi.mock("@/app/sync/useMutationSync", () => ({ useMutationSync: () => ({ phase: "refreshing", retry: vi.fn() }) }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: () => unknown) => [initial(), vi.fn()],
  useRef: (initial: unknown) => ({ current: initial }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => { mocks.effects.push(effect); },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
import { NewClientForm } from "./NewClientForm";

function nodes(node: ReactNode): Array<Record<string, unknown>> {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node.props, ...nodes(node.props.children as ReactNode)];
}
function render() {
  const listeners = new Map<string, (event: unknown) => void>();
  vi.stubGlobal("document", { addEventListener: (type: string, callback: (event: unknown) => void) => listeners.set(type, callback), removeEventListener: vi.fn(), getElementById: vi.fn() });
  vi.stubGlobal("window", { confirm: vi.fn(() => false), location: { href: "http://localhost:3000/clients/new" }, history: { state: {}, pushState: vi.fn() }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const all = nodes(NewClientForm({ locale: "en", returnTo: "/clients" }));
  const dialogProps = all.find(props => props["aria-labelledby"] === "client-leave-title");
  const dialog = { open: false, showModal: vi.fn(), close: vi.fn() };
  if (dialogProps) (dialogProps.ref as { current: unknown }).current = dialog;
  mocks.effects.forEach(effect => effect());
  return { all, dialog, listeners };
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.effects.length = 0; mocks.abandon.mockReturnValue(true);
  mocks.state = { name: "Example", phone: "", gdprConsent: false, hydrated: true, pending: false, frozen: false, recovery: false, checkedPhone: null, storageError: false, result: { status: "idle" } };
});
afterEach(() => vi.unstubAllGlobals());

describe("new client departure lifecycle", () => {
  it.each([false, true])("guards navigation links and only follows after confirmation (leave=%s)", leave => {
    const { all, listeners, dialog } = render();
    class Anchor {
      click = vi.fn();
      closest() { return this; }
    }
    vi.stubGlobal("Element", Anchor);
    const anchor = new Anchor();
    const event = { defaultPrevented: false, target: anchor, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    listeners.get("click")!(event);
    expect(event.preventDefault).toHaveBeenCalledOnce(); expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(anchor.click).not.toHaveBeenCalled();
    const id = leave ? "client-leave-confirm" : "client-leave-stay";
    (all.find(props => props.id === id)!.onClick as () => void)();
    expect(anchor.click).toHaveBeenCalledTimes(leave ? 1 : 0);
    expect(mocks.abandon).toHaveBeenCalledTimes(leave ? 1 : 0);
    if (leave) {
      event.preventDefault.mockClear(); listeners.get("click")!(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
  });
  it.each(["name", "phone", "gdprConsent"])("visually highlights Cancel when %s changes without disabling the empty exit", field => {
    mocks.state.name = "";
    const empty = render().all.find(props => props.children === "Cancel")!;
    mocks.state[field] = field === "gdprConsent" ? true : "Example";
    const changed = render().all.find(props => props.children === "Cancel")!;
    expect(empty.disabled).not.toBe(true); expect(changed.disabled).not.toBe(true);
    expect(changed.className).not.toBe(empty.className);
    expect(changed.className).toContain("bg-secondary-container");
    mocks.state[field] = field === "gdprConsent" ? false : "";
    expect(render().all.find(props => props.children === "Cancel")!.className).toBe(empty.className);
  });
  it("gives all buttons enabled hover and pressed feedback plus a keyboard focus indicator", () => {
    const buttons = render().all.filter(props => props.type === "button" || props.type === "submit");
    for (const button of buttons) {
      expect(button.className).toContain("enabled:hover:bg-");
      expect(button.className).toContain("enabled:active:bg-");
      expect(button.className).toContain("focus-visible:outline-2");
      expect(button.className).toContain("motion-reduce:transition-none");
    }
  });
  it.each([false, true])("keeps Cancel available and opens an in-page confirmation (pending=%s)", pending => {
    mocks.state.pending = pending;
    const { all, dialog } = render();
    const cancel = all.find(props => props.children === "Cancel")!;
    expect(cancel.disabled).not.toBe(true);
    (cancel.onClick as () => void)();
    expect(dialog.showModal).toHaveBeenCalledOnce(); expect(window.confirm).not.toHaveBeenCalled();
    expect(mocks.abandon).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
    const confirm = all.find(props => props.id === "client-leave-confirm")!;
    (confirm.onClick as () => void)();
    expect(mocks.abandon).toHaveBeenCalledOnce(); expect(mocks.push).toHaveBeenCalledWith("/clients");
  });
  it("allows logout after explicit confirmation even while a request is pending", () => {
    mocks.state.pending = true;
    const { all, dialog, listeners } = render();
    const event = { target: { id: "logout", requestSubmit: vi.fn() }, submitter: null, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    listeners.get("submit")!(event);
    expect(event.preventDefault).toHaveBeenCalledOnce(); expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(event.target.requestSubmit).not.toHaveBeenCalled(); expect(mocks.abandon).not.toHaveBeenCalled();
    (all.find(props => props.id === "client-leave-confirm")!.onClick as () => void)();
    expect(mocks.abandon).toHaveBeenCalledOnce(); expect(event.target.requestSubmit).toHaveBeenCalledOnce();
    event.preventDefault.mockClear(); listeners.get("submit")!(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
  it("opens a confirmed saved record without waiting for a read marker on the creation form", () => {
    mocks.state.result = { status: "success", clientId: "test", sync: { eventId: "test" } };
    render(); expect(mocks.open).toHaveBeenCalledOnce();
  });
  it("presents an existing client as the announced primary result without resubmitting", () => {
    mocks.state.result = { status: "existing", clientId: "client-1" };
    const { all } = render();
    const notice = all.find(props => props.role === "alert" && props["aria-labelledby"] === "existing-client-title");
    const title = all.find(props => props.id === "existing-client-title");
    const open = all.find(props => props.children === "Open existing client")!;
    const edit = all.find(props => props.children === "Keep editing")!;

    expect(notice).toBeDefined();
    expect(title?.children).toBe("Existing client found");
    const openClasses = String(open.className).split(" ");
    const editClasses = String(edit.className).split(" ");
    expect(openClasses).toContain("bg-primary");
    expect(openClasses).toContain("text-on-primary");
    expect(editClasses).not.toContain("bg-primary");

    (open.onClick as () => void)();
    expect(mocks.open).toHaveBeenCalledOnce();
    expect(mocks.submit).not.toHaveBeenCalled();
    (edit.onClick as () => void)();
    expect(mocks.keepEditing).toHaveBeenCalledOnce();
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("keeps the form and does not replay logout when departure is declined", () => {
    const { all, listeners, dialog } = render();
    const event = { target: { id: "logout", requestSubmit: vi.fn() }, submitter: null, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    listeners.get("submit")!(event);
    (all.find(props => props.id === "client-leave-stay")!.onClick as () => void)();
    expect(dialog.close).toHaveBeenCalledOnce(); expect(mocks.abandon).not.toHaveBeenCalled();
    expect(event.target.requestSubmit).not.toHaveBeenCalled(); expect(mocks.state.name).toBe("Example");
  });
});
