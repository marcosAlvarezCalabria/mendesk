import { PhoneNumber } from "@/domain/values/PhoneNumber";

export type NewOrderStep = "client" | "garments" | "delivery" | "review";

export type ClientStepSnapshot = {
  mode: "existing" | "new";
  clientId: string;
  name: string;
  phone: string;
  hasConsent: boolean;
};

export type ClientStepError = "client" | "name" | "phone" | "consent";

export type GarmentStepSnapshot = {
  description: string;
  alterationType?: string;
  price: string;
  measurements?: string;
  photoName?: string;
};

export type OrderDetailsSnapshot = {
  garments: readonly GarmentStepSnapshot[];
};

export type DeliveryAndDepositSnapshot = {
  dueDate: string;
  deposit: string;
  method: string;
  total: number;
};

export type OrderReview = {
  clientLabel: string;
  clientPhone: string;
  dueDate: string;
  notes: string;
  garmentCount: number;
  total: number;
  deposit: number;
  outstanding: number;
  paymentMethod: string;
  garments: Array<{
    description: string;
    alterationType: string;
    price: number;
    measurements: string;
    photoName: string;
  }>;
};

export function nextOrderStep(step: NewOrderStep): NewOrderStep {
  if (step === "client") {
    return "garments";
  }

  if (step === "garments") {
    return "delivery";
  }

  if (step === "delivery") {
    return "review";
  }

  return "review";
}

export function previousOrderStep(step: NewOrderStep): NewOrderStep {
  if (step === "review") {
    return "delivery";
  }

  if (step === "delivery") {
    return "garments";
  }

  if (step === "garments") {
    return "client";
  }

  return "client";
}

export function isClientStepComplete(snapshot: ClientStepSnapshot): boolean {
  return validateClientStep(snapshot) === null;
}

export function validateClientStep(snapshot: ClientStepSnapshot): ClientStepError | null {
  if (snapshot.mode === "existing") {
    return snapshot.clientId.trim() ? null : "client";
  }

  if (!snapshot.name.trim()) {
    return "name";
  }

  if (!snapshot.phone.trim()) {
    return "phone";
  }

  try {
    PhoneNumber.fromRaw(snapshot.phone);
  } catch {
    return "phone";
  }

  return snapshot.hasConsent ? null : "consent";
}

export function shouldChangeClientMode(currentMode: ClientStepSnapshot["mode"], nextMode: ClientStepSnapshot["mode"]): boolean {
  return currentMode !== nextMode;
}

export function canSubmitOrder(step: NewOrderStep, hasReview: boolean, hasCreatedOrder: boolean): boolean {
  return step === "review" && hasReview && !hasCreatedOrder;
}

export function validateOrderDetails(snapshot: OrderDetailsSnapshot): "garment" | "description" | "price" | null {
  if (snapshot.garments.length === 0) {
    return "garment";
  }

  if (snapshot.garments.some((garment) => !garment.description.trim())) {
    return "description";
  }

  if (snapshot.garments.some((garment) => {
    const price = Number(garment.price);
    return !garment.price.trim() || !Number.isFinite(price) || price < 0;
  })) {
    return "price";
  }

  return null;
}

export function isGarmentDraftComplete(
  garment: Pick<GarmentStepSnapshot, "description" | "price">,
): boolean {
  const price = Number(garment.price);
  return Boolean(
    garment.description.trim()
    && garment.price.trim()
    && Number.isFinite(price)
    && price >= 0,
  );
}

export function validateDeliveryAndDeposit(
  snapshot: DeliveryAndDepositSnapshot,
): "dueDate" | "deposit" | "method" | null {
  if (!snapshot.dueDate) {
    return "dueDate";
  }

  const deposit = snapshot.deposit.trim() ? Number(snapshot.deposit) : 0;
  if (
    !Number.isFinite(deposit)
    || deposit < 0
    || Math.round(deposit * 100) > Math.round(snapshot.total * 100)
  ) {
    return "deposit";
  }

  if (deposit > 0 && snapshot.method !== "cash" && snapshot.method !== "card") {
    return "method";
  }

  return null;
}

export function buildOrderReview(
  input: {
    clientLabel: string;
    clientPhone: string;
    dueDate: string;
    notes: string;
    deposit: string;
    paymentMethod: string;
    garments: readonly Required<GarmentStepSnapshot>[];
  },
  alterationLabels: Record<string, string>,
): OrderReview {
  const garments = input.garments.map((garment) => ({
    description: garment.description.trim(),
    alterationType: alterationLabels[garment.alterationType] ?? garment.alterationType,
    price: Number(garment.price),
    measurements: garment.measurements.trim(),
    photoName: garment.photoName.trim(),
  }));

  const totalCents = garments.reduce((sum, garment) => sum + Math.round(garment.price * 100), 0);
  const depositCents = Math.round((input.deposit.trim() ? Number(input.deposit) : 0) * 100);

  return {
    clientLabel: input.clientLabel,
    clientPhone: input.clientPhone,
    dueDate: input.dueDate,
    notes: input.notes.trim(),
    garmentCount: garments.length,
    total: totalCents / 100,
    deposit: depositCents / 100,
    outstanding: Math.max(0, totalCents - depositCents) / 100,
    paymentMethod: depositCents > 0 ? input.paymentMethod : "",
    garments,
  };
}
