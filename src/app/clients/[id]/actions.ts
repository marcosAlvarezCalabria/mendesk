"use server";

import { completeClientMutation } from "@/app/sync/server";
import type { MutationSyncReceipt } from "@/app/sync/contracts";
import { redirect } from "next/navigation";
import { redirectToLoginForAuthError } from "@/app/authRedirect";

import { classifyMutationError, type MutationResult } from "@/application/mutations/MutationResult";
import { AnonymizeClient } from "@/application/useCases/AnonymizeClient";
import { makeClientRepository } from "@/composition/directus";
import { ClientAnonymizationIncompleteError } from "@/domain/errors/ClientAnonymizationIncompleteError";
import { isAuthError } from "@/infrastructure/auth/authError";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";

export type AnonymizeState = { sync?: MutationSyncReceipt } & (
  | { status: "idle"; error: null; mutationResult?: undefined }
  | { status: "success"; error: null; mutationResult: "confirmed-saved" }
  | { status: "error"; error: string; mutationResult: Exclude<MutationResult<never>["type"], "confirmed-saved" | "auth-expired"> });

export async function anonymizeClientAction(_prev: AnonymizeState, formData: FormData): Promise<AnonymizeState> {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  if (formData.get("understood") !== "true") {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "Confirm the irreversible removal before continuing." };
  }

  try {
    await new AnonymizeClient(makeClientRepository(token)).execute(clientId);
  } catch (error) {
    if (isAuthError(error)) {
      return redirectToLoginForAuthError(error, `/clients/${clientId}`);
    }

    const classified = classifyMutationError(error, isAuthError);
    const knownIncomplete = error instanceof ClientAnonymizationIncompleteError
      || (error instanceof Error && error.message === "Client id is required");

    return {
      status: "error",
      mutationResult: knownIncomplete ? "confirmed-not-saved" : classified.type === "auth-expired" ? "outcome-unknown" : classified.type,
      error: anonymizeErrorMessage(error),
      ...(error instanceof ClientAnonymizationIncompleteError ? { sync: await completeClientMutation(clientId) } : {}),
    };
  }

  return { status: "success", mutationResult: "confirmed-saved", error: null, sync: await completeClientMutation(clientId) };
}

function anonymizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "Client id is required") {
    return "Client is required.";
  }

  if (error instanceof ClientAnonymizationIncompleteError) {
    return "The client could not be fully anonymized. Please try again.";
  }

  return "The client could not be anonymized.";

}
