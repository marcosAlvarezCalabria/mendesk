import { describe, expect, it, vi } from "vitest";

import { orderAnchor, restoreOrderAnchor } from "@/app/orders/OrderAnchorRestorer";

describe("order anchors", () => {
  it("restores a generated logical anchor without a selector", () => {
    const scrollIntoView = vi.fn();
    const getElementById = vi.fn(() => ({ scrollIntoView }));
    const anchor = orderAnchor("order-1");

    restoreOrderAnchor(anchor, { getElementById });

    expect(getElementById).toHaveBeenCalledExactlyOnceWith("order-order-1");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it.each([undefined, "", "client-1", "order-one/two"])("ignores an invalid anchor: %s", (anchor) => {
    const getElementById = vi.fn();
    restoreOrderAnchor(anchor, { getElementById });
    expect(getElementById).not.toHaveBeenCalled();
  });
});
