import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  getSessionToken: vi.fn(),
  revalidatePath: vi.fn(),
  redirectToLoginForAuthError: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/app/authRedirect", () => ({ redirectToLoginForAuthError: mocks.redirectToLoginForAuthError }));
vi.mock("@/composition/directus", () => ({ makeShopProfileRepository: () => ({ complete: mocks.complete }) }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: mocks.getSessionToken }));

import { updateShopSettingsAction } from "@/app/settings/actions";

describe("updateShopSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionToken.mockResolvedValue("token");
    mocks.complete.mockResolvedValue(undefined);
    mocks.redirectToLoginForAuthError.mockImplementation((error: unknown) => { throw error; });
    mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
  });

  it("normalizes and saves the editable workshop profile", async () => {
    await expect(updateShopSettingsAction({ error: null }, formData())).resolves.toEqual({ error: null, saved: true });
    expect(mocks.complete).toHaveBeenCalledWith({
      name: "Atelier Aurora",
      contactEmail: "hello@atelier.example",
      contactPhone: "+353 85 123 4567",
      whatsappNumber: "+353 85 123 4567",
      address: "24 Camden Street, Dublin",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("returns a recoverable validation error without writing", async () => {
    const invalid = formData();
    invalid.set("contactEmail", "not-an-email");

    await expect(updateShopSettingsAction({ error: null }, invalid)).resolves.toEqual({ error: "Enter a valid email address", saved: false });
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns to the settings page after an expired session", async () => {
    mocks.getSessionToken.mockResolvedValue(null);

    await expect(updateShopSettingsAction({ error: null }, formData())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/login?next=/settings");
  });

  it("hands an expired Directus session to the shared auth recovery", async () => {
    const authError = { status: 401 };
    mocks.complete.mockRejectedValue(authError);

    await expect(updateShopSettingsAction({ error: null }, formData())).rejects.toBe(authError);
    expect(mocks.redirectToLoginForAuthError).toHaveBeenCalledWith(authError, "/settings");
  });
});

function formData(): FormData {
  const data = new FormData();
  data.set("name", " Atelier Aurora ");
  data.set("contactEmail", "HELLO@ATELIER.EXAMPLE");
  data.set("contactPhone", "+353 85 123 4567");
  data.set("whatsappNumber", "+353 85 123 4567");
  data.set("address", "24 Camden Street, Dublin");
  return data;
}
