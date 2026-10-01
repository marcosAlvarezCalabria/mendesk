import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const view = vi.hoisted(() => ({ confirming: false }));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, useState: (value: unknown) => react.useState(typeof value === "boolean" ? view.confirming : value) };
});

import { RemovePaymentForm, type RemovePaymentTexts } from "@/app/orders/[orderNumber]/RemovePaymentForm";

const texts: RemovePaymentTexts = {
  remove: "Remove payment",
  cancel: "Keep payment",
  confirmation: "Remove {type} of {amount}? Outstanding will increase by {amount}.",
  confirm: "Remove payment",
  removing: "Removing...",
  checkSaved: "Check saved result",
  checkingSaved: "Checking...",
  success: "Payment removed.",
  errors: { notEditable: "Not editable", notFound: "Not found", deleteFailed: "Could not remove payment." },
};

describe("RemovePaymentForm", () => {
  beforeEach(() => { view.confirming = false; });

  it("shows a compact removal action on the exact payment", () => {
    const html = renderToStaticMarkup(<RemovePaymentForm amount="€10.00" orderNumber="260910-0020" paymentId="payment-1" paymentType="Deposit" texts={texts} />);

    expect(html).toContain('name="payment_id"');
    expect(html).toContain('value="payment-1"');
    expect(html).toContain('aria-label="Remove payment"');
    expect(html).not.toContain("Outstanding will increase");
  });

  it("requires confirmation and names the financial consequence", () => {
    view.confirming = true;
    const html = renderToStaticMarkup(<RemovePaymentForm amount="€10.00" orderNumber="260910-0020" paymentId="payment-1" paymentType="Deposit" texts={texts} />);

    expect(html).toContain("Remove Deposit of €10.00? Outstanding will increase by €10.00.");
    expect(html).toContain("Keep payment");
    expect(html).toMatch(/<button[^>]*type="submit"/);
  });
});
