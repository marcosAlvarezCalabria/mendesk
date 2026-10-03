"use server";

import { completeOrderMutation } from "@/app/sync/server";
import type { MutationSyncReceipt } from "@/app/sync/contracts";
import { notFound, redirect } from "next/navigation";

import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { classifyMutationError, type MutationResult } from "@/application/mutations/MutationResult";
import { ChangeOrderStatus } from "@/application/useCases/ChangeOrderStatus";
import type { Order } from "@/domain/entities/Order";
import { makeOrderRepository } from "@/composition/directus";
import { getCurrentStoreIdentity } from "@/composition/currentStoreIdentity";
import { isStatusAction, type StatusAction } from "@/app/orders/[orderNumber]/statusActions";
import { InvalidStatusTransitionError } from "@/domain/errors/InvalidStatusTransitionError";
import { OrderConflictError } from "@/domain/errors/OrderConflictError";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { buildWhatsappUrl } from "@/domain/messaging/buildWhatsappUrl";
import { buildReadyMessage } from "@/domain/messaging/whatsappMessages";
import { isAuthError } from "@/infrastructure/auth/authError";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { getLocale } from "@/i18n/getLocale";

export type StatusError = "invalid-transition" | "conflict" | "unexpected";

type PendingStatusChange = {
  orderNumber: string;
  source: string;
  target: StatusAction;
  expectedDateUpdated: string;
};

export type StatusState = { sync?: MutationSyncReceipt } & (
  | { status: "idle"; error: null; whatsappUrl?: undefined }
  | { status: "success"; mutationResult: "confirmed-saved"; error: null; target: StatusAction; whatsappUrl?: string }
  | { status: "error"; mutationResult: Exclude<MutationResult<never>["type"], "confirmed-saved" | "auth-expired">; error: StatusError; target?: StatusAction; pendingChange?: PendingStatusChange; whatsappUrl?: undefined });

export async function changeStatusAction(prev: StatusState, formData: FormData): Promise<StatusState> {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  if (prev.status === "error" && prev.mutationResult === "outcome-unknown" && prev.pendingChange) {
    return reconcileStatusChange(token, prev.pendingChange);
  }

  const orderNumber = String(formData.get("orderNumber") ?? "");
  const target = String(formData.get("target") ?? "");

  if (!isStatusAction(target)) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "invalid-transition" };
  }

  const pendingChange: PendingStatusChange = {
    orderNumber,
    source: String(formData.get("source") ?? ""),
    target,
    expectedDateUpdated: String(formData.get("expectedDateUpdated") ?? ""),
  };

  let order: Order;

  try {
    order = await new ChangeOrderStatus(makeOrderRepository(token)).execute({ orderNumber, target, expectedStatus: pendingChange.source, expectedDateUpdated: pendingChange.expectedDateUpdated });
  } catch (error) {
    if (error instanceof InvalidStatusTransitionError) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "invalid-transition" };
    }

    if (error instanceof OrderNotFoundError) {
      notFound();
    }

    if (error instanceof OrderConflictError) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "conflict", target };
    }

    if (isAuthError(error)) {
      return redirectToLoginForAuthError(error, `/orders/${orderNumber}`);
    }

    const classified = classifyMutationError(error, isAuthError);
    if (classified.type === "auth-expired") {
      return redirectToLoginForAuthError(error, `/orders/${orderNumber}`);
    }
    return {
      status: "error",
      mutationResult: classified.type,
      error: "unexpected",
      target,
      ...(classified.type === "outcome-unknown" ? { pendingChange } : {}),
    };
  }

  const sync = await completeOrderMutation({ kind: "order", orderId: order.id, orderNumber: order.orderNumber.value, clientId: order.client.id }, token);

  if (target === "ready") {
    const [locale, identity] = await Promise.all([getLocale(), getCurrentStoreIdentity()]);

    return {
      status: "success",
      mutationResult: "confirmed-saved",
      error: null,
      target,
      sync,
      whatsappUrl: order.client.phone ? buildWhatsappUrl(order.client.phone, buildReadyMessage({ clientName: order.client.name, locale, storeName: identity.name })) : undefined,
    };
  }

  return { status: "success", mutationResult: "confirmed-saved", error: null, target, sync };
}

async function reconcileStatusChange(token: string, pending: PendingStatusChange): Promise<StatusState> {
  try {
    const order = await makeOrderRepository(token).getByOrderNumber(pending.orderNumber);
    if (!order) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "conflict", target: pending.target };
    }
    if (order.status.value === pending.target) {
      const sync = await completeOrderMutation({ kind: "order", orderId: order.id, orderNumber: order.orderNumber.value, clientId: order.client.id }, token);
      if (pending.target === "collected") return { status: "success", mutationResult: "confirmed-saved", error: null, target: pending.target, sync };
      if (pending.target === "ready") {
        const [locale, identity] = await Promise.all([getLocale(), getCurrentStoreIdentity()]);
        return { status: "success", mutationResult: "confirmed-saved", error: null, target: pending.target, sync, whatsappUrl: order.client.phone ? buildWhatsappUrl(order.client.phone, buildReadyMessage({ clientName: order.client.name, locale, storeName: identity.name })) : undefined };
      }
      return { status: "success", mutationResult: "confirmed-saved", error: null, target: pending.target, sync };
    }
    if (order.status.value === pending.source && order.dateUpdated.toISOString() === pending.expectedDateUpdated) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "unexpected", target: pending.target };
    }
    return { status: "error", mutationResult: "confirmed-not-saved", error: "conflict", target: pending.target };
  } catch (error) {
    if (isAuthError(error)) return redirectToLoginForAuthError(error, `/orders/${pending.orderNumber}`);
    return { status: "error", mutationResult: "outcome-unknown", error: "unexpected", target: pending.target, pendingChange: pending };
  }
}
