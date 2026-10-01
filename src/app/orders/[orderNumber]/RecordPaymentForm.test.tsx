import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const draft = vi.hoisted(() => ({ touched: false }));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useState: (value: unknown) => react.useState(typeof value === "boolean" ? draft.touched : value) };
});

vi.mock("@/app/_ui/sessionIdempotency", () => ({
  useSessionIdempotencyKey: (_slot: string, key: string) => ({ idempotencyKey: key, ready: true }),
}));
vi.mock("@/app/_ui/OverlayPortal", () => ({
  OverlayPortal: ({ children }: { children: unknown }) => children,
}));

import { RecordPaymentForm, type RecordPaymentTexts } from "@/app/orders/[orderNumber]/RecordPaymentForm";

const texts: RecordPaymentTexts = {
  ariaLabel: "Record payment", type: "Type", deposit: "Deposit", final: "Final",
  amount: "Amount", amountHint: "Outstanding amount", method: "Method", cash: "Cash", card: "Card",
  addDeposit: "Add deposit", finalPayment: "Final payment", close: "Close payment panel",
  confirm: "Confirm payment", confirming: "Recording payment", success: "Payment recorded.",
  amountRequired: "Enter an amount between €0.01 and €42.50 to continue.",
  amountTooHigh: "Reduce the amount to €42.50 or less.",
  checkSaved: "Check Directus",
  checkingSaved: "Checking Directus...",
  confirmedAbsent: "Not saved.",
  confirmedSaved: "Saved.",
  errors: {
    invalidAmount: "Invalid amount.", invalidType: "Invalid type.",
    invalidMethod: "Invalid method.", overOutstanding: "Amount exceeds outstanding.",
    notEditable: "This order cannot accept payments.", saveFailed: "Could not record payment.",
  },
};

describe("RecordPaymentForm", () => {
  beforeEach(() => { draft.touched = false; });
  it("keeps a disabled form when the order becomes non-editable", () => {
    draft.touched = true;
    const html = renderToStaticMarkup(<RecordPaymentForm editable={false} defaultAmount="42.50" outstandingAmount="42.50" defaultType="final" idempotencyKey="550e8400-e29b-41d4-a716-446655440002" orderId="order-1" orderNumber="260902-0007" texts={texts} />);
    expect(html).toContain('name="amount"');
    expect(html).toMatch(/<input[^>]*disabled=""[^>]*name="amount"/);
  });
  it("does not show an untouched payment form on a non-editable order", () => {
    const html = renderToStaticMarkup(<RecordPaymentForm editable={false} defaultAmount="42.50" outstandingAmount="42.50" defaultType="final" idempotencyKey="550e8400-e29b-41d4-a716-446655440002" orderId="order-1" orderNumber="260902-0007" texts={texts} />);
    expect(html).not.toContain('name="amount"');
  });
  it("renders the stable payment idempotency key", () => {
    draft.touched = true;
    const html = renderToStaticMarkup(
      <RecordPaymentForm
        defaultAmount="42.50"
        outstandingAmount="42.50"
        defaultType="final"
        idempotencyKey="550e8400-e29b-41d4-a716-446655440002"
        orderId="order-1"
        orderNumber="260902-0007"
        texts={texts}
      />,
    );

    expect(html).toContain('name="idempotency_key"');
    expect(html).toContain('value="550e8400-e29b-41d4-a716-446655440002"');
    expect(html).toContain("Final payment");
    expect(html).toContain('role="dialog"');
  });

  it("opens a compact bottom payment panel with the order context still behind it", () => {
    draft.touched = true;
    const html = renderToStaticMarkup(<RecordPaymentForm defaultAmount="42.50" outstandingAmount="42.50" defaultType="final" idempotencyKey="550e8400-e29b-41d4-a716-446655440002" orderId="order-1" orderNumber="260902-0007" texts={texts} />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain("fixed inset-0");
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="payment_type"[^>]*value="final"/);
    expect(html).toContain("Confirm payment");
    expect(html).toMatch(/<button[^>]*type="submit"/);
    expect(html).not.toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });

  it("disables confirmation while a received deposit amount is empty", () => {
    draft.touched = true;
    const html = renderToStaticMarkup(<RecordPaymentForm defaultAmount="" outstandingAmount="42.50" defaultType="deposit" idempotencyKey="550e8400-e29b-41d4-a716-446655440002" orderId="order-1" orderNumber="260902-0007" texts={texts} />);

    expect(html).toContain("Add deposit");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
    expect(html).toContain("Enter an amount between €0.01 and €42.50 to continue.");
    expect(html).toContain('aria-describedby="payment-validation"');
  });

  it("explains that an amount above outstanding must be reduced", () => {
    draft.touched = true;
    const html = renderToStaticMarkup(<RecordPaymentForm defaultAmount="50" outstandingAmount="42.50" defaultType="deposit" idempotencyKey="550e8400-e29b-41d4-a716-446655440002" orderId="order-1" orderNumber="260902-0007" texts={texts} />);

    expect(html).toContain("Reduce the amount to €42.50 or less.");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });
});
