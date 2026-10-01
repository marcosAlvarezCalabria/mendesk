import { buildClientsHref, parseClientsAnchor, parseClientsPage } from "@/app/clients/clientsHref";
import { safeNewClientReturnTo } from "@/app/routeContext";

export type ClientRegistrationRecovery = { status: "reconciliation-required"; returnTo: string };
const KEY = "koko:client-registration:recovery:v1";

function recoveryReturnTo(value: string): string {
  const safeReturnTo = safeNewClientReturnTo(value);
  if (safeReturnTo === "/appointments/new") return safeReturnTo;
  const params = new URL(safeReturnTo, "https://panel.invalid").searchParams;
  return buildClientsHref({
    page: parseClientsPage(params.getAll("page").length === 1 ? params.get("page")! : undefined),
    anchor: parseClientsAnchor(params.getAll("anchor").length === 1 ? params.get("anchor")! : undefined),
  });
}

export function readClientRegistrationRecovery(storage: Pick<Storage, "getItem">): ClientRegistrationRecovery | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(KEY) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (Object.keys(value).length !== 2 || !("status" in value) || value.status !== "reconciliation-required"
      || !("returnTo" in value) || typeof value.returnTo !== "string"
      || recoveryReturnTo(value.returnTo) !== value.returnTo) return null;
    return { status: "reconciliation-required", returnTo: value.returnTo };
  } catch { return null; }
}

export function writeClientRegistrationRecovery(storage: Pick<Storage, "setItem">, returnTo: string): boolean {
  try {
    storage.setItem(KEY, JSON.stringify({ status: "reconciliation-required", returnTo: recoveryReturnTo(returnTo) }));
    return true;
  } catch { return false; }
}

export function clearClientRegistrationRecovery(storage: Pick<Storage, "removeItem">): boolean {
  try { storage.removeItem(KEY); return true; } catch { return false; }
}
