import { describe, expect, it, vi } from "vitest";

import { resolveAvailableStoreIdentity } from "@/composition/currentStoreIdentity";

const baseline = {
  name: "Demo Atelier",
  shortName: "Demo",
  logo: { src: "/store/demo.svg", alt: "Demo Atelier" },
};

describe("resolveAvailableStoreIdentity", () => {
  it("uses the first available saved profile", async () => {
    const failed = vi.fn().mockRejectedValue(new Error("expired session"));
    const available = vi.fn().mockResolvedValue({
      name: "Atelier Aurora",
      contactEmail: "hello@example.com",
      contactPhone: "+353 85 123 4567",
    });

    await expect(resolveAvailableStoreIdentity(baseline, [failed, available])).resolves.toMatchObject({ name: "Atelier Aurora" });
    expect(failed).toHaveBeenCalledOnce();
    expect(available).toHaveBeenCalledOnce();
  });

  it("keeps the installation baseline when all profile reads fail", async () => {
    const failed = vi.fn().mockRejectedValue(new Error("Directus unavailable"));

    await expect(resolveAvailableStoreIdentity(baseline, [failed])).resolves.toBe(baseline);
  });
});
