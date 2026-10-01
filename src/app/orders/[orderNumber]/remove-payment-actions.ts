"use server";

import { redirect } from "next/navigation";

import { redirectToLoginForAuthError } from "@/app/authRedirect";
import type { MutationSyncReceipt } from "@/app/sync/contracts";
import { completeOrderMutation } from "@/app/sync/server";
import { classifyMutationError, type MutationResult } from "@/application/mutations/MutationResult";
import { RemovePaymentFromOrder } from "@/application/useCases/RemovePaymentFromOrder";
import { makeOrderRepository, makePaymentRepository } from "@/composition/directus";
import type { Order } from "@/domain/entities/Order";
import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { PaymentNotFoundError } from "@/domain/errors/PaymentNotFoundError";
import { isAuthError } from "@/infrastructure/auth/authError";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";

export type RemovePaymentErrorCode = "notEditable" | "notFound" | "deleteFailed";
type PendingPaymentRemoval = { orderNumber: string; paymentId: string };

export type RemovePaymentState = { sync?: MutationSyncReceipt } & (
  | { status: "idle"; error: null; mutationResult?: undefined }
  | { status: "success"; error: null; mutationResult: "confirmed-saved" }
  | { status: "error"; error: RemovePaymentErrorCode; mutationResult: Exclude<MutationResult<never>["type"], "confirmed-saved" | "auth-expired">; pendingRemoval?: PendingPaymentRemoval }
);

export async function removePaymentAction(prev: RemovePaymentState, formData: FormData): Promise<RemovePaymentState> {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  if (prev.status === "error" && prev.mutationResult === "outcome-unknown" && prev.pendingRemoval) {
    return reconcilePaymentRemoval(token, prev.pendingRemoval);
  }

  const pendingRemoval = {
    orderNumber: String(formData.get("order_number") ?? "").trim(),
    paymentId: String(formData.get("payment_id") ?? "").trim(),
  };

  let order: Order;
  try {
    const existing = await makeOrderRepository(token).getByOrderNumber(pendingRemoval.orderNumber);
    if (!existing || !pendingRemoval.paymentId) throw new OrderNotFoundError();
    order = existing;
    await new RemovePaymentFromOrder(makeOrderRepository(token), makePaymentRepository(token)).execute(pendingRemoval);
  } catch (error) {
    if (isAuthError(error)) return redirectToLoginForAuthError(error, `/orders/${pendingRemoval.orderNumber}`);
    if (error instanceof OrderNotEditableError) return { status: "error", mutationResult: "confirmed-not-saved", error: "notEditable" };
    if (error instanceof PaymentNotFoundError || error instanceof OrderNotFoundError) return { status: "error", mutationResult: "confirmed-not-saved", error: "notFound" };

    const classified = classifyMutationError(error, isAuthError);
    if (classified.type === "auth-expired") return redirectToLoginForAuthError(error, `/orders/${pendingRemoval.orderNumber}`);
    return {
      status: "error",
      mutationResult: classified.type,
      error: "deleteFailed",
      ...(classified.type === "outcome-unknown" ? { pendingRemoval } : {}),
    };
  }

  return confirmedRemoval(order, token);
}

async function reconcilePaymentRemoval(token: string, pending: PendingPaymentRemoval): Promise<RemovePaymentState> {
  try {
    const order = await makeOrderRepository(token).getByOrderNumber(pending.orderNumber);
    if (!order) return { status: "error", mutationResult: "confirmed-not-saved", error: "notFound" };
    if (order.payments.some((payment) => payment.id === pending.paymentId)) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "deleteFailed" };
    }
    return confirmedRemoval(order, token);
  } catch (error) {
    if (isAuthError(error)) return redirectToLoginForAuthError(error, `/orders/${pending.orderNumber}`);
    return { status: "error", mutationResult: "outcome-unknown", error: "deleteFailed", pendingRemoval: pending };
  }
}

async function confirmedRemoval(order: Order, token: string): Promise<RemovePaymentState> {
  return {
    status: "success",
    mutationResult: "confirmed-saved",
    error: null,
    sync: await completeOrderMutation({ kind: "order", orderId: order.id, orderNumber: order.orderNumber.value, clientId: order.client.id }, token),
  };
}
