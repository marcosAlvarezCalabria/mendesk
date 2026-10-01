import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

describe("PWA manifest", () => {
  it("opens the installed standalone app at the authenticated orders route", () => {
    const value = manifest();

    expect(value.start_url).toBe("/orders");
    expect(value.display).toBe("standalone");
    expect(value.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ sizes: "512x512", type: "image/png" }),
    ]));
  });
});
