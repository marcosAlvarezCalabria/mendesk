import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CollectOrderPanel, collectRequiresPayment, type CollectOrderTexts } from "@/app/orders/[orderNumber]/CollectOrderPanel";

const texts: CollectOrderTexts = { collect: "Collect order", title: "Final payment and collection", amount: "Amount", method: "Method", cash: "Cash", card: "Card", payAndCollect: "Pay {amount} & collect", confirmCollect: "Confirm collection", collecting: "Collecting...", close: "Close", partial: "Payment recorded — order still Ready.", success: "Collected", errors: { invalid: "Invalid", conflict: "Conflict", "payment-failed": "Payment failed", unexpected: "Unexpected" } };

describe("CollectOrderPanel", () => {
  it("keeps the entry action compact", () => {
    const html = render("20.00", "€20.00");
    expect(html).toContain("Collect order");
    expect(html).toContain("min-h-11");
  });

  it("omits final payment when the balance is already zero", () => {
    expect(collectRequiresPayment("0.00")).toBe(false);
    expect(collectRequiresPayment("20.00")).toBe(true);
  });
});

function render(outstandingAmount: string, formattedOutstanding: string) {
  return renderToStaticMarkup(<CollectOrderPanel orderNumber="260910-0020" expectedDateUpdated="2026-09-10T09:00:00.000Z" outstandingAmount={outstandingAmount} formattedOutstanding={formattedOutstanding} initialIdempotencyKey="550e8400-e29b-41d4-a716-446655440020" texts={texts} />);
}
