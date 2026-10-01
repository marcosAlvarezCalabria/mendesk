import { describe, expect, it } from "vitest";

import {
  buildOrderReview,
  canSubmitOrder,
  isClientStepComplete,
  isGarmentDraftComplete,
  nextOrderStep,
  previousOrderStep,
  shouldChangeClientMode,
  validateClientStep,
  validateDeliveryAndDeposit,
  validateOrderDetails,
} from "@/app/orders/new/newOrderFlow";

describe("order creation flow", () => {
  it("moves forward and backward through the four guided steps", () => {
    expect(nextOrderStep("client")).toBe("garments");
    expect(nextOrderStep("garments")).toBe("delivery");
    expect(nextOrderStep("delivery")).toBe("review");
    expect(nextOrderStep("review")).toBe("review");
    expect(previousOrderStep("review")).toBe("delivery");
    expect(previousOrderStep("delivery")).toBe("garments");
    expect(previousOrderStep("garments")).toBe("client");
    expect(previousOrderStep("client")).toBe("client");
  });

  it("requires a selected existing client or complete new-client details", () => {
    expect(isClientStepComplete({ mode: "existing", clientId: "client-1", name: "", phone: "", hasConsent: false })).toBe(true);
    expect(isClientStepComplete({ mode: "existing", clientId: "", name: "", phone: "", hasConsent: false })).toBe(false);
    expect(isClientStepComplete({ mode: "new", clientId: "", name: "Liudmyla", phone: "353871234567", hasConsent: true })).toBe(true);
    expect(isClientStepComplete({ mode: "new", clientId: "", name: "Sof¡a", phone: "+34 612 345 678", hasConsent: true })).toBe(true);
    expect(isClientStepComplete({ mode: "new", clientId: "", name: "Liudmyla", phone: "", hasConsent: true })).toBe(false);
    expect(isClientStepComplete({ mode: "new", clientId: "", name: "Liudmyla", phone: "123", hasConsent: true })).toBe(false);
    expect(isClientStepComplete({ mode: "new", clientId: "", name: "Liudmyla", phone: "+999 123 456 789", hasConsent: true })).toBe(false);
    expect(isClientStepComplete({ mode: "new", clientId: "", name: "Liudmyla", phone: "353871234567", hasConsent: false })).toBe(false);
  });

  it("identifies the client field that needs attention", () => {
    expect(validateClientStep({ mode: "existing", clientId: "", name: "", phone: "", hasConsent: false })).toBe("client");
    expect(validateClientStep({ mode: "new", clientId: "", name: "", phone: "353871234567", hasConsent: true })).toBe("name");
    expect(validateClientStep({ mode: "new", clientId: "", name: "Liudmyla", phone: "123", hasConsent: true })).toBe("phone");
    expect(validateClientStep({ mode: "new", clientId: "", name: "Liudmyla", phone: "353871234567", hasConsent: false })).toBe("consent");
    expect(validateClientStep({ mode: "new", clientId: "", name: "Liudmyla", phone: "353871234567", hasConsent: true })).toBeNull();
    expect(validateClientStep({ mode: "new", clientId: "", name: "Sof¡a", phone: "0034 612 345 678", hasConsent: true })).toBeNull();
  });

  it("preserves selection when the active client mode is pressed again", () => {
    expect(shouldChangeClientMode("existing", "existing")).toBe(false);
    expect(shouldChangeClientMode("new", "new")).toBe(false);
    expect(shouldChangeClientMode("existing", "new")).toBe(true);
  });

  it("only permits submission from a valid review without a previously created order", () => {
    expect(canSubmitOrder("client", false, false)).toBe(false);
    expect(canSubmitOrder("garments", false, false)).toBe(false);
    expect(canSubmitOrder("delivery", false, false)).toBe(false);
    expect(canSubmitOrder("review", false, false)).toBe(false);
    expect(canSubmitOrder("review", true, false)).toBe(true);
    expect(canSubmitOrder("review", true, true)).toBe(false);
  });

  it("finds the first missing or invalid garment detail", () => {
    expect(validateOrderDetails({ garments: [] })).toBe("garment");
    expect(validateOrderDetails({ garments: [{ description: "", price: "24" }] })).toBe("description");
    expect(validateOrderDetails({ garments: [{ description: "Dress hem", price: "" }] })).toBe("price");
    expect(validateOrderDetails({ garments: [{ description: "Dress hem", price: "24" }] })).toBeNull();
  });

  it("only offers saving a garment after its required fields are valid", () => {
    expect(isGarmentDraftComplete({ description: "", price: "" })).toBe(false);
    expect(isGarmentDraftComplete({ description: "Dress", price: "" })).toBe(false);
    expect(isGarmentDraftComplete({ description: "Dress", price: "-1" })).toBe(false);
    expect(isGarmentDraftComplete({ description: "Dress", price: "20" })).toBe(true);
  });

  it("requires due date and a method only for a positive deposit", () => {
    expect(validateDeliveryAndDeposit({ dueDate: "", deposit: "0", method: "", total: 20 })).toBe("dueDate");
    expect(validateDeliveryAndDeposit({ dueDate: "2026-09-04", deposit: "", method: "", total: 20 })).toBeNull();
    expect(validateDeliveryAndDeposit({ dueDate: "2026-09-04", deposit: "-1", method: "cash", total: 20 })).toBe("deposit");
    expect(validateDeliveryAndDeposit({ dueDate: "2026-09-04", deposit: "20.01", method: "cash", total: 20 })).toBe("deposit");
    expect(validateDeliveryAndDeposit({ dueDate: "2026-09-04", deposit: "10", method: "", total: 20 })).toBe("method");
    expect(validateDeliveryAndDeposit({ dueDate: "2026-09-04", deposit: "20", method: "cash", total: 20 })).toBeNull();
    expect(validateDeliveryAndDeposit({ dueDate: "2026-09-04", deposit: "0", method: "", total: 20 })).toBeNull();
  });

  it("treats an untouched optional deposit as zero in the review", () => {
    const review = buildOrderReview({
      clientLabel: "Mary",
      clientPhone: "353871234567",
      dueDate: "2026-09-04",
      notes: "",
      deposit: "",
      paymentMethod: "",
      garments: [{ description: "Dress", alterationType: "hem", price: "20", measurements: "", photoName: "" }],
    }, { hem: "Hem" });

    expect(review.deposit).toBe(0);
    expect(review.outstanding).toBe(20);
  });

  it("builds a concise review using real form values", () => {
    expect(buildOrderReview({
      clientLabel: "Mary Murphy",
      clientPhone: "353871234567",
      dueDate: "2026-09-04",
      notes: "Call before collection",
      deposit: "10.50",
      paymentMethod: "cash",
      garments: [
        { description: "Blue dress", alterationType: "hem", price: "24", measurements: "Hem 4 cm", photoName: "blue-dress.jpg" },
        { description: "Wool coat", alterationType: "sleeves", price: "20.50", measurements: "", photoName: "" },
      ],
    }, { hem: "Hem", sleeves: "Sleeves" })).toEqual({
      clientLabel: "Mary Murphy",
      clientPhone: "353871234567",
      dueDate: "2026-09-04",
      notes: "Call before collection",
      garmentCount: 2,
      total: 44.5,
      deposit: 10.5,
      outstanding: 34,
      paymentMethod: "cash",
      garments: [
        { description: "Blue dress", alterationType: "Hem", price: 24, measurements: "Hem 4 cm", photoName: "blue-dress.jpg" },
        { description: "Wool coat", alterationType: "Sleeves", price: 20.5, measurements: "", photoName: "" },
      ],
    });
  });
});
