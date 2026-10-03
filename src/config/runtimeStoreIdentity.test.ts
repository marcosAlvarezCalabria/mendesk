import { describe, expect, it } from "vitest";

import { runtimeStoreIdentity } from "@/config/runtimeStoreIdentity";

const baseline = {
  name: "Demo Atelier",
  shortName: "Demo",
  logo: { src: "/store/demo.svg", alt: "Demo Atelier" },
};

describe("runtimeStoreIdentity", () => {
  it("uses the saved workshop name as the primary identity and logo alternative", () => {
    expect(runtimeStoreIdentity(baseline, {
      name: "Atelier Aurora ✂️",
      contactEmail: "hello@example.com",
      contactPhone: "+353 85 123 4567",
    })).toEqual({
      name: "Atelier Aurora ✂️",
      shortName: "Demo",
      logo: { src: "/store/demo.svg", alt: "Atelier Aurora ✂️" },
    });
  });

  it("keeps the installation identity when no saved profile is available", () => {
    expect(runtimeStoreIdentity(baseline, null)).toBe(baseline);
  });
});
