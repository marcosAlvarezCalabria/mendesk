import type { ClientRegistrationState } from "./actions";
import { PhoneNumber } from "@/domain/values/PhoneNumber";
import { clearClientRegistrationRecovery, readClientRegistrationRecovery, writeClientRegistrationRecovery } from "./clientRegistrationRecovery";
import { safeNewClientReturnTo, withReturnTo } from "@/app/routeContext";
type State = { name: string; phone: string; gdprConsent: boolean; hydrated: boolean; recovery: boolean; checkedPhone: string | null; pending: boolean; frozen: boolean; storageError: boolean; result: ClientRegistrationState };
type Ports = { storage: () => Pick<Storage, "getItem" | "setItem" | "removeItem">; action: (prev: ClientRegistrationState, form: FormData) => Promise<ClientRegistrationState>; login: (path: string) => void; open: (id: string, returnTo: string) => void };
export function createClientRegistrationSession(origin: string, ports: Ports) {
  let returnTo = safeNewClientReturnTo(origin);
  let state: State = { name: "", phone: "", gdprConsent: false, hydrated: false, recovery: false, checkedPhone: null, pending: false, frozen: false, storageError: false, result: { status: "idle" } };
  const listeners = new Set<() => void>();
  let abandoned = false;
  let opened = false;
  const update = (next: Partial<State>) => { state = { ...state, ...next }; listeners.forEach(listener => listener()); };
  function clear() {
    try { const ok = clearClientRegistrationRecovery(ports.storage()); update({ storageError: !ok }); return ok; }
    catch { update({ storageError: true }); return false; }
  }
  function open() {
    if (!abandoned && !opened && state.result.clientId && clear()) {
      opened = true;
      update({ name: "", phone: "", gdprConsent: false, frozen: true });
      ports.open(state.result.clientId!, returnTo);
    }
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    hydrate() {
      if (state.hydrated) return;
      try {
        const marker = readClientRegistrationRecovery(ports.storage());
        if (marker) returnTo = marker.returnTo;
        update({ hydrated: true, recovery: Boolean(marker) });
      } catch { update({ hydrated: true, storageError: true }); }
    },
    change(field: "name" | "phone" | "gdprConsent", value: string | boolean) {
      if (state.pending || state.frozen) return;
      if (field === "gdprConsent" && typeof value === "boolean") update({ gdprConsent: value });
      if (field === "name" && typeof value === "string") update({ name: value });
      if (field === "phone" && typeof value === "string") update({ phone: value, checkedPhone: null });
    },
    keepEditing() { if (!state.pending && state.result.status === "existing") update({ result: { status: "idle" }, frozen: false }); },
    async submit(mode: "create" | "reconcile") {
      if (abandoned || !state.hydrated || state.pending || state.result.status === "success") return;
      if (mode === "create" && (state.frozen || (state.recovery && state.checkedPhone !== state.phone))) return;
      const fieldErrors: NonNullable<ClientRegistrationState["fieldErrors"]> = {};
      if (mode === "create" && !state.name.trim()) fieldErrors.name = "required";
      try { PhoneNumber.fromRaw(state.phone); } catch { fieldErrors.phone = "invalid"; }
      if (mode === "create" && !state.gdprConsent) fieldErrors.gdprConsent = "required";
      if (Object.keys(fieldErrors).length) {
        update({ result: { status: "error", mutationResult: "confirmed-not-saved", fieldErrors } });
        return;
      }
      let persisted = false;
      try { persisted = writeClientRegistrationRecovery(ports.storage(), returnTo); } catch { /* No write without recovery marker. */ }
      if (!persisted) { update({ storageError: true }); return; }
      const form = new FormData(); form.set("mode", mode); form.set("phone", state.phone); form.set("returnTo", returnTo);
      if (mode === "create") { form.set("name", state.name); form.set("gdprConsent", String(state.gdprConsent)); }
      update({ pending: true, storageError: false });
      let result: ClientRegistrationState;
      try { result = await ports.action(state.result, form); }
      catch { result = { status: "error", mutationResult: "outcome-unknown" }; }
      // Departure does not cancel a server write; its late response no longer owns this UI.
      if (abandoned) return;
      update({ pending: false, result });
      if (result.mutationResult === "auth-expired") {
        let safeReturn = "/clients";
        try { safeReturn = readClientRegistrationRecovery(ports.storage())?.returnTo ?? safeReturn; } catch { /* Generic fallback. */ }
        update({ name: "", phone: "", gdprConsent: false, recovery: true, checkedPhone: null, frozen: false });
        ports.login(`/login?${new URLSearchParams({ next: withReturnTo("/clients/new", safeReturn) })}`);
      } else if (result.status === "absent") update({ checkedPhone: state.phone, frozen: false });
      else if (mode === "reconcile" && result.status === "existing") open();
      else if (result.mutationResult === "outcome-unknown") update({ recovery: true, checkedPhone: null, frozen: true });
    },
    open,
    abandon() {
      if (!clear()) return false;
      abandoned = true;
      update({ name: "", phone: "", gdprConsent: false, pending: false, recovery: false, checkedPhone: null, frozen: true, result: { status: "idle" } });
      return true;
    },
  };
}
