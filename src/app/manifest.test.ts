import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

describe("PWA manifest", () => {
  it("uses the configured demo shop identity and opens at the orders route", () => {
    const value = manifest();

    expect(value.name).toBe("Demo Atelier");
    expect(value.short_name).toBe("Demo");
    expect(value.start_url).toBe("/orders");
    expect(value.display).toBe("standalone");
    expect(value.icons).toEqual([
      expect.objectContaining({ src: "/store/demo-atelier-mark.svg", sizes: "any", type: "image/svg+xml" }),
    ]);
  });
});
