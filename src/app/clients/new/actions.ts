"use server";

import { RegisterClient } from "@/application/useCases/RegisterClient";
import { classifyMutationError, type MutationResult } from "@/application/mutations/MutationResult";
import { ClientRegistrationValidationError } from "@/domain/errors/ClientRegistrationValidationError";
import { InvalidPhoneNumberError } from "@/domain/errors/InvalidPhoneNumberError";
import { clearSessionCookie, getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { isAuthError } from "@/infrastructure/auth/authError";
import { makeClientRepository } from "@/composition/directus";
import { completeClientMutation } from "@/app/sync/server";
import type { MutationSyncReceipt } from "@/app/sync/contracts";

export type ClientRegistrationState = {
  status: "idle" | "existing" | "success" | "absent" | "error";
  mutationResult?: MutationResult<never>["type"];
  fieldErrors?: Partial<Record<"name" | "phone" | "gdprConsent", "required" | "invalid">>;
  clientId?: string;
  sync?: MutationSyncReceipt;
};

export async function registerClientAction(_prev: ClientRegistrationState, formData: FormData): Promise<ClientRegistrationState> {
  const token = await getSessionToken();
  if (!token) return { status: "error", mutationResult: "auth-expired" };
  const mode = formData.get("mode");
  if (mode !== "create" && mode !== "reconcile") return { status: "error", mutationResult: "confirmed-not-saved" };
  const phone = formData.get("phone");
  if (typeof phone !== "string") return { status: "error", mutationResult: "confirmed-not-saved", fieldErrors: { phone: "invalid" } };
  const useCase = new RegisterClient(makeClientRepository(token));
  try {
    if (mode === "reconcile") {
      const client = await useCase.reconcile(phone);
      return client ? { status: "existing", clientId: client.id } : { status: "absent" };
    }
    const name = formData.get("name");
    if (typeof name !== "string") return { status: "error", mutationResult: "confirmed-not-saved", fieldErrors: { name: "required" } };
    const result = await useCase.execute({ name, phoneRaw: phone, gdprConsent: formData.get("gdprConsent") === "true" });
    if (result.type === "existing") return { status: "existing", clientId: result.client.id };
    const saved: ClientRegistrationState = { status: "success", clientId: result.client.id, mutationResult: "confirmed-saved" };
    try { return { ...saved, sync: await completeClientMutation(result.client.id) }; }
    catch { return saved; } // Missing receipt requires read recovery, never another create.
  } catch (error) {
    if (isAuthError(error)) { await clearSessionCookie(); return { status: "error", mutationResult: "auth-expired" }; }
    if (error instanceof ClientRegistrationValidationError) return { status: "error", mutationResult: "confirmed-not-saved", fieldErrors: { [error.field]: "required" } };
    if (error instanceof InvalidPhoneNumberError) return { status: "error", mutationResult: "confirmed-not-saved", fieldErrors: { phone: "invalid" } };
    return { status: "error", mutationResult: classifyMutationError(error, isAuthError).type };
  }
}
