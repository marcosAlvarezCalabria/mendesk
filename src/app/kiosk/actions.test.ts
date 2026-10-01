import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvalidPhoneNumberError } from "@/domain/errors/InvalidPhoneNumberError";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), isAuthError: vi.fn() }));

vi.mock("@/application/useCases/RegisterClientIntake", () => ({
  RegisterClientIntake: class {
    execute(input: unknown) { return mocks.execute(input); }
  },
}));
vi.mock("@/composition/directus", () => ({ makeKioskClientRepository: vi.fn(() => ({})) }));
vi.mock("@/infrastructure/auth/authError", () => ({ isAuthError: mocks.isAuthError }));

import { intakeAction } from "@/app/kiosk/actions";

describe("intakeAction mutation result", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execute.mockResolvedValue({ id: "client-1" });
    mocks.isAuthError.mockReturnValue(false);
  });

  it("reports confirmed saved after creating the intake once", async () => {
    await expect(intakeAction({ status: "idle", error: null }, intakeFormData())).resolves.toEqual({
      status: "success",
      mutationResult: "confirmed-saved",
      error: null,
    });
  });

  it("reports local consent validation as confirmed not saved", async () => {
    await expect(intakeAction({ status: "idle", error: null }, new FormData())).resolves.toEqual({
      status: "error",
      mutationResult: "confirmed-not-saved",
      error: "consent",
    });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each([
    [new InvalidPhoneNumberError(), "phone"],
    [new Error("Client name is required"), "name"],
  ])("reports domain validation as confirmed not saved", async (error, message) => {
    mocks.execute.mockRejectedValueOnce(error);

    await expect(intakeAction({ status: "idle", error: null }, intakeFormData())).resolves.toEqual({
      status: "error",
      mutationResult: "confirmed-not-saved",
      error: message,
    });
  });

  it("reports a dropped response as outcome unknown instead of throwing", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("Connection dropped"));

    await expect(intakeAction({ status: "idle", error: null }, intakeFormData())).resolves.toEqual({
      status: "error",
      mutationResult: "outcome-unknown",
      error: "unknown",
    });
  });

  it("distinguishes an expired technical kiosk credential", async () => {
    mocks.execute.mockRejectedValueOnce({ status: 401 });
    mocks.isAuthError.mockReturnValueOnce(true);

    await expect(intakeAction({ status: "idle", error: null }, intakeFormData())).resolves.toEqual({
      status: "error",
      mutationResult: "auth-expired",
      error: "unavailable",
    });
  });
});

function intakeFormData(): FormData {
  const formData = new FormData();
  formData.set("name", "Test Client");
  formData.set("phone", "0851234567");
  formData.set("gdpr", "on");
  return formData;
}
