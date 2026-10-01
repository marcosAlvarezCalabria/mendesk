import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("Next.js configuration", () => {
  it("accepts an authenticated order form with mobile photo payloads within the hosting limit", () => {
    expect(nextConfig.experimental?.serverActions).toMatchObject({
      bodySizeLimit: "4mb",
    });
  });
});
