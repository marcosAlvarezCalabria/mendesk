"use server";

import { completeOrderMutation } from "@/app/sync/server";
import type { MutationSyncReceipt } from "@/app/sync/contracts";
import type { Order } from "@/domain/entities/Order";
import { redirect } from "next/navigation";

import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { classifyMutationError, type MutationResult } from "@/application/mutations/MutationResult";
import { RemoveGarmentFromOrder } from "@/application/useCases/RemoveGarmentFromOrder";
import { makeGarmentRepository, makeOrderRepository } from "@/composition/directus";
import { GarmentNotFoundError } from "@/domain/errors/GarmentNotFoundError";
import { LastGarmentRemovalError } from "@/domain/errors/LastGarmentRemovalError";
import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { isAuthError } from "@/infrastructure/auth/authError";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";

export type RemoveGarmentErrorCode = "lastGarment" | "notEditable" | "notFound" | "conflict" | "deleteFailed";

type PendingGarmentRemoval = { orderNumber: string; garmentId: string; expectedDateUpdated: string };

export type RemoveGarmentState = { sync?: MutationSyncReceipt } & (
  | { status: "idle"; error: null; mutationResult?: undefined }
  | { status: "success"; error: null; mutationResult: "confirmed-saved" }
  | { status: "error"; error: RemoveGarmentErrorCode; mutationResult: Exclude<MutationResult<never>["type"], "confirmed-saved" | "auth-expired">; pendingRemoval?: PendingGarmentRemoval });

export async function removeGarmentAction(
  prev: RemoveGarmentState,
  formData: FormData,
): Promise<RemoveGarmentState> {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  if (prev.status === "error" && prev.mutationResult === "outcome-unknown" && prev.pendingRemoval) {
    return reconcileGarmentRemoval(token, prev.pendingRemoval);
  }

  const orderNumber = String(formData.get("order_number") ?? "").trim();
  const garmentId = String(formData.get("garment_id") ?? "").trim();
  const pendingRemoval: PendingGarmentRemoval = { orderNumber, garmentId, expectedDateUpdated: String(formData.get("expected_date_updated") ?? "") };

  let order: Order;
  try {
    const existing = await makeOrderRepository(token).getByOrderNumber(orderNumber);
    if (!existing) throw new OrderNotFoundError();
    order = existing;
    await new RemoveGarmentFromOrder(
      makeOrderRepository(token),
      makeGarmentRepository(token),
    ).execute({ orderNumber, garmentId, expectedDateUpdated: pendingRemoval.expectedDateUpdated });
  } catch (error) {
    if (isAuthError(error)) {
      return redirectToLoginForAuthError(error, `/orders/${orderNumber}`);
    }

    if (error instanceof LastGarmentRemovalError) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "lastGarment" };
    }

    if (error instanceof OrderNotEditableError) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "notEditable" };
    }

    if (error instanceof GarmentNotFoundError || error instanceof OrderNotFoundError) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "notFound" };
    }

    const classified = classifyMutationError(error, isAuthError);
    if (classified.type === "auth-expired") {
      return redirectToLoginForAuthError(error, `/orders/${orderNumber}`);
    }

    return {
      status: "error",
      mutationResult: classified.type,
      error: "deleteFailed",
      ...(classified.type === "outcome-unknown" ? { pendingRemoval } : {}),
    };
  }

  return { status: "success", mutationResult: "confirmed-saved", error: null, sync: await completeOrderMutation({ kind: "order", orderId: order.id, orderNumber: order.orderNumber.value, clientId: order.client.id }, token) };
}

async function reconcileGarmentRemoval(token: string, pending: PendingGarmentRemoval): Promise<RemoveGarmentState> {
  try {
    const order = await makeOrderRepository(token).getByOrderNumber(pending.orderNumber);
    if (!order) return { status: "error", mutationResult: "confirmed-not-saved", error: "conflict" };
    const garment = order.garments.find((candidate) => candidate.id === pending.garmentId);
    if (!garment) {
      return { status: "success", mutationResult: "confirmed-saved", error: null, sync: await completeOrderMutation({ kind: "order", orderId: order.id, orderNumber: order.orderNumber.value, clientId: order.client.id }, token) };
    }
    if (garment.dateUpdated.toISOString() === pending.expectedDateUpdated) return { status: "error", mutationResult: "confirmed-not-saved", error: "deleteFailed" };
    return { status: "error", mutationResult: "confirmed-not-saved", error: "conflict" };
  } catch (error) {
    if (isAuthError(error)) return redirectToLoginForAuthError(error, `/orders/${pending.orderNumber}`);
    return { status: "error", mutationResult: "outcome-unknown", error: "deleteFailed", pendingRemoval: pending };
  }
}
