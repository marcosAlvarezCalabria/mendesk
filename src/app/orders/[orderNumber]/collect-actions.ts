"use server";

import { redirect } from "next/navigation";

import { completeOrderMutation } from "@/app/sync/server";
import type { MutationSyncReceipt } from "@/app/sync/contracts";
import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { classifyMutationError, type MutationResult } from "@/application/mutations/MutationResult";
import { ChangeOrderStatus } from "@/application/useCases/ChangeOrderStatus";
import { CollectOrder, CollectOrderPartialError } from "@/application/useCases/CollectOrder";
import { makeOrderRepository, makePaymentRepository } from "@/composition/directus";
import type { Order } from "@/domain/entities/Order";
import { InvalidStatusTransitionError } from "@/domain/errors/InvalidStatusTransitionError";
import { OrderConflictError } from "@/domain/errors/OrderConflictError";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { isAuthError } from "@/infrastructure/auth/authError";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";

export type CollectError = "invalid" | "conflict" | "payment-failed" | "unexpected";
type PendingCollection = { orderNumber: string; idempotencyKey: string };

export type CollectState = { sync?: MutationSyncReceipt } & (
  | { status: "idle"; error: null }
  | { status: "success"; mutationResult: "confirmed-saved"; error: null }
  | { status: "partial"; mutationResult: Exclude<MutationResult<never>["type"], "confirmed-saved" | "auth-expired">; error: "unexpected"; pending: PendingCollection }
  | { status: "error"; mutationResult: Exclude<MutationResult<never>["type"], "confirmed-saved" | "auth-expired">; error: CollectError }
);

export async function collectOrderAction(prev: CollectState, formData: FormData): Promise<CollectState> {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  if (prev.status === "partial") {
    return retryCollectedTransition(token, prev.pending);
  }

  const orderNumber = String(formData.get("order_number") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotency_key") ?? "").trim();

  try {
    const result = await new CollectOrder(makeOrderRepository(token), makePaymentRepository(token)).execute({
      orderNumber,
      expectedDateUpdated: String(formData.get("expected_date_updated") ?? ""),
      idempotencyKey,
      amountEuros: Number(formData.get("amount") ?? Number.NaN),
      method: String(formData.get("payment_method") ?? ""),
    });
    return confirmed(result.order, token);
  } catch (error) {
    if (isAuthError(error)) return redirectToLoginForAuthError(error, `/orders/${orderNumber}`);
    if (error instanceof OrderNotFoundError) return { status: "error", mutationResult: "confirmed-not-saved", error: "conflict" };
    if (error instanceof InvalidStatusTransitionError || error instanceof OrderConflictError) return { status: "error", mutationResult: "confirmed-not-saved", error: "conflict" };
    if (error instanceof CollectOrderPartialError) {
      const classified = classifyMutationError(error.cause, isAuthError);
      return { status: "partial", mutationResult: classified.type === "auth-expired" ? "outcome-unknown" : classified.type, error: "unexpected", pending: { orderNumber, idempotencyKey } };
    }
    const classified = classifyMutationError(error, isAuthError);
    if (classified.type === "auth-expired") return redirectToLoginForAuthError(error, `/orders/${orderNumber}`);
    return { status: "error", mutationResult: classified.type, error: error instanceof Error && error.message === "Final payment must equal the outstanding balance." ? "invalid" : "payment-failed" };
  }
}

async function retryCollectedTransition(token: string, pending: PendingCollection): Promise<CollectState> {
  try {
    const repository = makeOrderRepository(token);
    const current = await repository.getByOrderNumber(pending.orderNumber);
    if (!current) return { status: "error", mutationResult: "confirmed-not-saved", error: "conflict" };
    if (current.status.value === "collected") return confirmed(current, token);
    if (current.status.value !== "ready") return { status: "error", mutationResult: "confirmed-not-saved", error: "conflict" };

    const order = await new ChangeOrderStatus(repository).execute({ orderNumber: pending.orderNumber, target: "collected", expectedStatus: "ready", expectedDateUpdated: current.dateUpdated.toISOString() });
    return confirmed(order, token);
  } catch (error) {
    if (isAuthError(error)) return redirectToLoginForAuthError(error, `/orders/${pending.orderNumber}`);
    const classified = classifyMutationError(error, isAuthError);
    return { status: "partial", mutationResult: classified.type === "auth-expired" ? "outcome-unknown" : classified.type, error: "unexpected", pending };
  }
}

async function confirmed(order: Order, token: string): Promise<CollectState> {
  const sync = await completeOrderMutation({ kind: "order", orderId: order.id, orderNumber: order.orderNumber.value, clientId: order.client.id }, token);
  return { status: "success", mutationResult: "confirmed-saved", error: null, sync };
}
