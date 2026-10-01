import { describe, expect, it } from "vitest";

import { productConfig } from "@/config/productConfig";

describe("productConfig", () => {
  it("identifies Mendesk without inventing an unconfirmed maker signature", () => {
    expect(productConfig).toEqual({
      id: "mendesk",
      name: "Mendesk",
      attribution: {
        internalLabel: null,
        makerName: null,
        showOnCustomerArtifacts: false,
      },
    });
  });
});
