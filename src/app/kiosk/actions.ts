"use server";

import { classifyMutationError, type MutationResult } from "@/application/mutations/MutationResult";
import { RegisterClientIntake } from "@/application/useCases/RegisterClientIntake";
import { makeKioskClientRepository } from "@/composition/directus";
import { InvalidPhoneNumberError } from "@/domain/errors/InvalidPhoneNumberError";
import { isAuthError } from "@/infrastructure/auth/authError";

export type IntakeError = "consent" | "phone" | "name" | "unavailable" | "unknown" | "saveFailed";
export type IntakeFormState =
  | { status: "idle"; error: null; mutationResult?: undefined }
  | { status: "success"; error: null; mutationResult: "confirmed-saved" }
  | { status: "error"; error: IntakeError; mutationResult: Exclude<MutationResult<never>["type"], "confirmed-saved"> };

export async function intakeAction(_prev: IntakeFormState, formData: FormData): Promise<IntakeFormState> {
  const name = String(formData.get("name") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const hasConsent = formData.has("gdpr");

  if (!hasConsent) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "consent" };
  }

  try {
    await new RegisterClientIntake(makeKioskClientRepository()).execute({
      name,
      phoneRaw: phone,
      gdprConsent: true,
    });
  } catch (error) {
    if (error instanceof InvalidPhoneNumberError) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "phone" };
    }

    if (error instanceof Error && error.message === "Client name is required") {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "name" };
    }

    const classified = classifyMutationError(error, isAuthError);

    if (classified.type === "auth-expired") {
      return { status: "error", mutationResult: "auth-expired", error: "unavailable" };
    }

    if (classified.type === "outcome-unknown") {
      return { status: "error", mutationResult: "outcome-unknown", error: "unknown" };
    }

    return { status: "error", mutationResult: "confirmed-not-saved", error: "saveFailed" };
  }

  return { status: "success", mutationResult: "confirmed-saved", error: null };
}