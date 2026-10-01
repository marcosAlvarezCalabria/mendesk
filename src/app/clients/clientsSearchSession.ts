import { buildClientsHref } from "./clientsHref";
import type { ClientListViewPage } from "./ClientsSearch";

type Route = { query: string; page: number; anchor?: string };
type ServerRead = Route & { result: ClientListViewPage; error?: boolean };
type State = Route & { result: ClientListViewPage; status: "ready" | "loading" | "error"; readId?: string };
type Ports = { fetchPage: (url: string, options: RequestInit) => Promise<Response>; authenticate: (path: string) => void; replace: (path: string) => void };

export function createClientsSearchSession(initial: ServerRead, ports: Ports) {
  let state: State = { ...initial, status: initial.error ? "error" : "ready" };
  let generation = 0;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: State) => { state = next; listeners.forEach(listener => listener()); };
  function cancel() { generation++; controller?.abort(); clearTimeout(timer); }
  function request(route: Route, delay: number, replace: boolean) {
    cancel();
    const owned = generation;
    publish({ ...route, result: state.result, status: "loading", readId: undefined });
    if (replace) ports.replace(buildClientsHref({ q: route.query, page: route.page }));
    controller = new AbortController();
    const signal = controller.signal;
    timer = setTimeout(async () => {
      try {
        const response = await ports.fetchPage(`/api/clients/search?search=${encodeURIComponent(route.query.trim())}&page=${route.page}`, { signal, cache: "no-store" });
        if (owned !== generation) return;
        if (!response.ok) {
          if (response.status === 401) ports.authenticate(buildClientsHref({ q: route.query, page: route.page, anchor: route.anchor }));
          throw new Error("Client read failed");
        }
        const result: unknown = await response.json();
        if (owned !== generation) return;
        if (!isPage(result)) throw new Error("Invalid client page");
        publish({ ...route, result, status: "ready", readId: crypto.randomUUID() });
      } catch {
        if (owned === generation) publish({ ...state, status: "error" });
      }
    }, delay);
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    search(query: string) { request({ query, page: 1 }, 250, true); },
    page(page: number) { if (state.status === "ready" && page > 0) request({ query: state.query, page }, 0, true); },
    navigate(route: Route) { request(route, 0, false); },
    retry() { if (state.status === "error") request(state, 0, false); },
    adopt(read: ServerRead) { cancel(); publish({ ...read, status: read.error ? "error" : "ready" }); },
    dispose: cancel,
  };
}

function isPage(value: unknown): value is ClientListViewPage {
  if (!value || typeof value !== "object" || !("items" in value) || !Array.isArray(value.items)
    || !("hasNextPage" in value) || typeof value.hasNextPage !== "boolean") return false;
  const ids = new Set<string>();
  return value.items.every((item: unknown) => {
    if (!item || typeof item !== "object" || !("id" in item) || typeof item.id !== "string" || !item.id
      || !("name" in item) || typeof item.name !== "string" || !("phone" in item)
      || (item.phone !== null && typeof item.phone !== "string") || !("gdprConsent" in item) || typeof item.gdprConsent !== "boolean"
      || ids.has(item.id)) return false;
    ids.add(item.id); return true;
  });
}
