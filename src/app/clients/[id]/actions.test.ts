import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClientAnonymizationIncompleteError } from "@/domain/errors/ClientAnonymizationIncompleteError";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getSessionToken: vi.fn(),
  isAuthError: vi.fn(),
  redirectToLoginForAuthError: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/application/useCases/AnonymizeClient", () => ({
  AnonymizeClient: class {
    execute(input: unknown) { return mocks.execute(input); }
  },
}));
vi.mock("@/app/authRedirect", () => ({ redirectToLoginForAuthError: mocks.redirectToLoginForAuthError }));
vi.mock("@/composition/directus", () => ({ makeClientRepository: vi.fn(() => ({})) }));
vi.mock("@/infrastructure/auth/authError", () => ({ isAuthError: mocks.isAuthError }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: mocks.getSessionToken }));

import { anonymizeClientAction } from "@/app/clients/[id]/actions";

describe("anonymizeClientAction", () => {
  it("rejects missing irreversible confirmation before mutation", async () => {
    const data = clientFormData(); data.delete("understood");
    expect(await anonymizeClientAction({ status: "idle", error: null }, data)).toMatchObject({ status: "error", mutationResult: "confirmed-not-saved" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionToken.mockResolvedValue("token");
    mocks.isAuthError.mockReturnValue(false);
    mocks.redirectToLoginForAuthError.mockRejectedValue(new Error("NEXT_REDIRECT"));
    mocks.execute.mockResolvedValue(undefined);
  });

  it("reports confirmed saved only after the complete anonymization finishes", async () => {
    await expect(anonymizeClientAction({ status: "idle", error: null }, clientFormData())).resolves.toEqual({
      status: "success",
      mutationResult: "confirmed-saved",
      sync: expect.objectContaining({ eventId: expect.any(String) }),
      error: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/clients/client-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/clients");
  });

  it.each([
    [new Error("Client id is required"), "Client is required."],
    [new ClientAnonymizationIncompleteError(1), "The client could not be fully anonymized. Please try again."],
  ])("reports a known incomplete operation as confirmed not saved", async (error, message) => {
    mocks.execute.mockRejectedValueOnce(error);

    await expect(anonymizeClientAction({ status: "idle", error: null }, clientFormData())).resolves.toEqual({
      status: "error",
      mutationResult: "confirmed-not-saved",
      error: message,
      ...(error instanceof ClientAnonymizationIncompleteError ? { sync: expect.objectContaining({ target: { kind: "client", clientId: "client-1" } }) } : {}),
    });
  });

  it("reports an uncertain technical failure without claiming completion", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("Connection dropped"));

    await expect(anonymizeClientAction({ status: "idle", error: null }, clientFormData())).resolves.toEqual({
      status: "error",
      mutationResult: "outcome-unknown",
      error: "The client could not be anonymized.",
    });
  });

  it("preserves the client destination when auth expires", async () => {
    const authError = { status: 401 };
    mocks.execute.mockRejectedValueOnce(authError);
    mocks.isAuthError.mockReturnValueOnce(true);

    await expect(anonymizeClientAction({ status: "idle", error: null }, clientFormData())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirectToLoginForAuthError).toHaveBeenCalledWith(authError, "/clients/client-1");
  });
});

function clientFormData(): FormData {
  const formData = new FormData();
  formData.set("client_id", "client-1");
  formData.set("understood", "true");
  return formData;
}
