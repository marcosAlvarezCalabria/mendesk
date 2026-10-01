"use server";

import { completeOrderMutation } from "@/app/sync/server";
import type { MutationSyncReceipt } from "@/app/sync/contracts";
import type { Order } from "@/domain/entities/Order";
import { redirect } from "next/navigation";
import type { CreationReconciliationState } from "@/app/_ui/CreationReconciliation";

import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { RecordPayment } from "@/application/useCases/RecordPayment";
import { classifyMutationError, type MutationResult } from "@/application/mutations/MutationResult";
import { makeOrderRepository, makePaymentRepository } from "@/composition/directus";
import { InvalidMoneyError } from "@/domain/errors/InvalidMoneyError";
import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";
import { assertPaymentAllowed } from "@/domain/orders/orderRules";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { Money } from "@/domain/values/Money";
import { isPaymentMethod } from "@/domain/values/PaymentMethod";
import { isPaymentType } from "@/domain/values/PaymentType";
import { isAuthError } from "@/infrastructure/auth/authError";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";

export type PaymentErrorCode = "invalidAmount" | "overOutstanding" | "notEditable" | "invalidType" | "invalidMethod" | "saveFailed";

export type PaymentState = { sync?: MutationSyncReceipt } & (
  | { status: "idle"; error: null }
  | { status: "success"; mutationResult: "confirmed-saved"; error: null; nextIdempotencyKey: string }
  | { status: "error"; mutationResult: Exclude<MutationResult<never>["type"], "confirmed-saved" | "auth-expired">; error: PaymentErrorCode; idempotencyKey?: string });

export async function recordPaymentAction(_prev: PaymentState, formData: FormData): Promise<PaymentState> {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  const orderId = String(formData.get("order_id") ?? "").trim();
  const orderNumber = String(formData.get("order_number") ?? "").trim();

  if (!orderId || !/^\d{6}-\d+$/.test(orderNumber)) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "saveFailed" };
  }

  let idempotencyKey: string;

  try {
    idempotencyKey = IdempotencyKey.fromString(String(formData.get("idempotency_key") ?? "")).value;
  } catch {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "saveFailed" };
  }

  let order: Order;
  try {
    const existing = await makeOrderRepository(token).getByOrderNumber(orderNumber);
    if (!existing || existing.id !== orderId) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "saveFailed" };
    }
    order = existing;
    const amountEuros = Number(formData.get("amount") ?? Number.NaN);
    assertPaymentAllowed(order, Money.fromEuros(amountEuros));
    await new RecordPayment(makePaymentRepository(token)).execute({
      orderId,
      idempotencyKey,
      type: String(formData.get("payment_type") ?? ""),
      amountEuros,
      method: String(formData.get("payment_method") ?? ""),
    });
  } catch (error) {
    if (isAuthError(error)) {
      return redirectToLoginForAuthError(error, `/orders/${orderNumber}`);
    }

    const errorCode = paymentErrorCode(error);
    const classified = errorCode === "saveFailed"
      ? classifyMutationError(error, isAuthError)
      : { type: "confirmed-not-saved" as const };
    if (classified.type === "auth-expired") {
      return redirectToLoginForAuthError(error, `/orders/${orderNumber}`);
    }
    return { status: "error", mutationResult: classified.type, error: errorCode, idempotencyKey };
  }

  const sync = await completeOrderMutation({ kind: "order", orderId: order.id, orderNumber: order.orderNumber.value, clientId: order.client.id }, token);
  return { status: "success", mutationResult: "confirmed-saved", error: null, nextIdempotencyKey: crypto.randomUUID(), sync };
}

export async function reconcileRecordedPaymentAction(
  _prev: CreationReconciliationState,
  formData: FormData,
): Promise<CreationReconciliationState & { sync?: MutationSyncReceipt }> {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  const orderId = String(formData.get("order_id") ?? "").trim();
  const orderNumber = String(formData.get("order_number") ?? "").trim();
  let idempotencyKey: IdempotencyKey;
  const type = String(formData.get("payment_type") ?? "");
  const method = String(formData.get("payment_method") ?? "");
  const amountEuros = Number(formData.get("amount") ?? Number.NaN);

  try {
    idempotencyKey = IdempotencyKey.fromString(String(formData.get("idempotency_key") ?? ""));
  } catch {
    return { status: "error", mutationResult: "outcome-unknown", error: "The saved result could not be checked." };
  }

  try {
    const payment = await makePaymentRepository(token).getByIdempotencyKey(idempotencyKey);

    if (!payment) {
      return { status: "absent", mutationResult: "confirmed-not-saved", error: null };
    }

    if (payment.orderId !== orderId) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "The saved result did not match this order." };
    }

    const compatible = isPaymentType(type)
      && isPaymentMethod(method)
      && payment.type === type
      && payment.method === method
      && payment.amount.equals(Money.fromEuros(amountEuros));

    if (!compatible) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "This UUID was saved with different payment details." };
    }
    const order = await makeOrderRepository(token).getByOrderNumber(orderNumber);
    if (!order || order.id !== payment.orderId) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "The saved result did not match this order." };
    }
    const sync = await completeOrderMutation({ kind: "order", orderId: order.id, orderNumber: order.orderNumber.value, clientId: order.client.id }, token);
    return {
      status: "saved",
      sync,

      mutationResult: "confirmed-saved",
      error: null,
      nextIdempotencyKey: crypto.randomUUID(),
    };
  } catch (error) {
    if (isAuthError(error)) {
      return redirectToLoginForAuthError(error, `/orders/${orderNumber}`);
    }

    return { status: "error", mutationResult: "outcome-unknown", error: "The saved result could not be checked." };
  }
}

function paymentErrorCode(error: unknown): PaymentErrorCode {
  if (error instanceof OrderNotEditableError) {
    return "notEditable";
  }

  if (error instanceof InvalidMoneyError) {
    return "invalidAmount";
  }

  if (error instanceof Error) {
    if (error.message === "Payment amount must be greater than zero.") {
      return "invalidAmount";
    }

    if (error.message === "Payment amount exceeds the outstanding balance.") {
      return "overOutstanding";
    }

    if (error.message === "Invalid payment type.") {
      return "invalidType";
    }

    if (error.message === "Invalid payment method.") {
      return "invalidMethod";
    }
  }

  return "saveFailed";
}
