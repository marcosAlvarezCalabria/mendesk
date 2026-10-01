import { describe, expect, it, vi } from "vitest";

import { clearLegacyPinStorage } from "@/app/LegacyPinStorageCleanup";

describe("clearLegacyPinStorage", () => {
  it("removes the retired PIN values from local and session storage", () => {
    const localStorage = { removeItem: vi.fn() };
    const sessionStorage = { removeItem: vi.fn() };

    clearLegacyPinStorage({ localStorage, sessionStorage });

    expect(localStorage.removeItem).toHaveBeenCalledExactlyOnceWith("koko_pin");
    expect(sessionStorage.removeItem).toHaveBeenCalledExactlyOnceWith("koko_pin_unlocked");
  });

  it("still clears session storage when the local storage getter is unavailable", () => {
    const sessionStorage = { removeItem: vi.fn() };
    const storageSource = {
      get localStorage(): Storage {
        throw new Error("Storage unavailable");
      },
      sessionStorage,
    };

    expect(() => clearLegacyPinStorage(storageSource)).not.toThrow();
    expect(sessionStorage.removeItem).toHaveBeenCalledExactlyOnceWith("koko_pin_unlocked");
  });

  it("still clears local storage when the session storage getter is unavailable", () => {
    const localStorage = { removeItem: vi.fn() };
    const storageSource = {
      localStorage,
      get sessionStorage(): Storage {
        throw new Error("Storage unavailable");
      },
    };

    expect(() => clearLegacyPinStorage(storageSource)).not.toThrow();
    expect(localStorage.removeItem).toHaveBeenCalledExactlyOnceWith("koko_pin");
  });
});
