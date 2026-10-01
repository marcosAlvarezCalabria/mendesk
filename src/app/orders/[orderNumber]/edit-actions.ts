"use server";

import { completeOrderMutation } from "@/app/sync/server";
import type { MutationSyncReceipt } from "@/app/sync/contracts";
import type { Order } from "@/domain/entities/Order";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { redirect } from "next/navigation";
import type { CreationReconciliationState } from "@/app/_ui/CreationReconciliation";

import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { classifyMutationError, type MutationResult } from "@/application/mutations/MutationResult";
import { parseDueDate } from "@/app/orders/new/newOrderForm";
import { AddGarmentToOrder } from "@/application/useCases/AddGarmentToOrder";
import { OrderGarmentProcessingError, type OrderGarmentPhoto } from "@/application/useCases/AddOrderGarments";
import { EditGarment } from "@/application/useCases/EditGarment";
import { EditOrderDetails } from "@/application/useCases/EditOrderDetails";
import { makeGarmentRepository, makeOrderRepository, makePhotoStorage } from "@/composition/directus";
import { InvalidMoneyError } from "@/domain/errors/InvalidMoneyError";
import { MissingDueDateError } from "@/domain/errors/MissingDueDateError";
import { Money } from "@/domain/values/Money";
import { toAlterationType } from "@/domain/values/AlterationType";
import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { isAuthError } from "@/infrastructure/auth/authError";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";

type PendingEdit =
  | { kind: "order"; orderNumber: string; expectedDateUpdated: string; dueDateValue: string; notes: string }
  | { kind: "garment"; orderNumber: string; garmentId: string; expectedDateUpdated: string; description: string; alterationType: string; measurements: string; price: string };

export type EditState = { sync?: MutationSyncReceipt } & (
  | { status: "idle"; error: null }
  | { status: "error"; mutationResult: Exclude<MutationResult<never>["type"], "confirmed-saved" | "auth-expired">; error: string; pendingEdit?: PendingEdit }
  | { status: "success"; mutationResult: "confirmed-saved"; error: null; saved?: { dueDate: string; notes: string } });
export type AddGarmentErrorCode = "notEditable" | "description" | "price" | "saveFailed";
export type AddGarmentState = { sync?: MutationSyncReceipt } & (
  | { status: "idle"; error: null }
  | { status: "success"; mutationResult: "confirmed-saved"; error: null; nextIdempotencyKey: string }
  | { status: "error"; mutationResult: Exclude<MutationResult<never>["type"], "confirmed-saved" | "auth-expired">; error: AddGarmentErrorCode; idempotencyKey?: string });

export async function editOrderDetailsAction(prev: EditState, formData: FormData): Promise<EditState> {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }
  if (prev.status === "error" && prev.mutationResult === "outcome-unknown" && prev.pendingEdit?.kind === "order") {
    return reconcileOrderDetails(token, prev.pendingEdit);
  }

  const orderNumber = String(formData.get("orderNumber") ?? "");
  const dueDateValue = stringValue(formData.get("due_date"));
  const dueDate = parseDueDate(dueDateValue);
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const expectedDateUpdatedValue = String(formData.get("expected_date_updated") ?? "");
  const expectedDateUpdated = parseVersion(expectedDateUpdatedValue);
  if (!expectedDateUpdated) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "Reload the order before editing it." };
  }
  const pendingEdit: PendingEdit = {
    kind: "order", orderNumber, expectedDateUpdated: expectedDateUpdatedValue,
    dueDateValue: dueDateValue ?? "", notes: notes ?? "",
  };

  let order: Order;
  try {
    order = await new EditOrderDetails(makeOrderRepository(token)).execute({ orderNumber, expectedDateUpdated, dueDate, notes });
  } catch (error) {
    return await handleEditError(error, `/orders/${orderNumber}`, pendingEdit);
  }

  const sync = await synchronizeOrder(order, token);
  return {
    status: "success",
    error: null,
    mutationResult: "confirmed-saved",
    saved: {
      dueDate: dueDateValue ?? "",
      notes: notes ?? "",
    },
    sync,
  };
}

export async function editGarmentAction(prev: EditState, formData: FormData): Promise<EditState> {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }
  if (prev.status === "error" && prev.mutationResult === "outcome-unknown" && prev.pendingEdit?.kind === "garment") {
    return reconcileGarmentEdit(token, prev.pendingEdit);
  }

  const orderNumber = String(formData.get("orderNumber") ?? "");
  const garmentId = String(formData.get("garment_id") ?? "");
  const description = String(formData.get("description") ?? "");
  const alterationType = String(formData.get("alteration_type") ?? "");
  const measurements = String(formData.get("measurements") ?? "").trim() || undefined;
  const price = String(formData.get("price") ?? "");
  const expectedDateUpdatedValue = String(formData.get("expected_date_updated") ?? "");
  const expectedDateUpdated = parseVersion(expectedDateUpdatedValue);
  if (!expectedDateUpdated) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "Reload the order before editing it." };
  }
  const pendingEdit: PendingEdit = {
    kind: "garment", orderNumber, garmentId, expectedDateUpdated: expectedDateUpdatedValue,
    description: description.trim(), alterationType, measurements: measurements ?? "", price,
  };

  let order: Order;
  try {
    const existing = await makeOrderRepository(token).getByOrderNumber(orderNumber);
    if (!existing) throw new OrderNotFoundError();
    order = existing;
    await new EditGarment(makeOrderRepository(token), makeGarmentRepository(token)).execute({
      orderNumber,
      garmentId,
      expectedDateUpdated,
      description,
      alterationType,
      measurements,
      priceEuros: Number(price),
    });
  } catch (error) {
    return await handleEditError(error, `/orders/${orderNumber}`, pendingEdit);
  }

  return { status: "success", mutationResult: "confirmed-saved", error: null, sync: await synchronizeOrder(order, token) };
}

export async function addGarmentToOrderAction(
  _prev: AddGarmentState,
  formData: FormData,
): Promise<AddGarmentState> {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  const orderNumber = String(formData.get("order_number") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  const alterationType = String(formData.get("alteration_type") ?? "");
  const measurements = String(formData.get("measurements") ?? "").trim() || undefined;
  const price = String(formData.get("price") ?? "");
  const photo = toOrderGarmentPhoto(formData.get("photo"));

  let idempotencyKey: string;

  try {
    idempotencyKey = IdempotencyKey.fromString(String(formData.get("idempotency_key") ?? "")).value;
  } catch {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "saveFailed" };
  }

  let order: Order;
  try {
    const existing = await makeOrderRepository(token).getByOrderNumber(orderNumber);
    if (!existing) throw new OrderNotFoundError();
    order = existing;
    await new AddGarmentToOrder(
      makeOrderRepository(token),
      makeGarmentRepository(token),
      makePhotoStorage(token),
    ).execute({
      idempotencyKey,
      orderNumber,
      description,
      alterationType,
      measurements,
      priceEuros: Number(price),
      photo,
    });
  } catch (error) {
    const cause = error instanceof OrderGarmentProcessingError
      ? error.failures[0]?.cause ?? error
      : error;

    if (isAuthError(cause)) {
      return redirectToLoginForAuthError(cause, `/orders/${orderNumber}`);
    }

    return handleAddGarmentError(cause, idempotencyKey);
  }

  return { status: "success", mutationResult: "confirmed-saved", error: null, nextIdempotencyKey: crypto.randomUUID(), sync: await synchronizeOrder(order, token) };
}

export async function reconcileAddedGarmentAction(
  _prev: CreationReconciliationState,
  formData: FormData,
): Promise<CreationReconciliationState & { sync?: MutationSyncReceipt }> {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  const orderNumber = String(formData.get("order_number") ?? "").trim();
  let idempotencyKey: IdempotencyKey;
  const description = String(formData.get("description") ?? "").trim();
  const alterationType = String(formData.get("alteration_type") ?? "");
  const measurements = String(formData.get("measurements") ?? "").trim() || undefined;
  const priceEuros = Number(formData.get("price") ?? Number.NaN);
  const photo = formData.get("photo");
  const expectsPhoto = photo instanceof File && photo.size > 0;

  try {
    idempotencyKey = IdempotencyKey.fromString(String(formData.get("idempotency_key") ?? ""));

  } catch {
    return { status: "error", mutationResult: "outcome-unknown", error: "The saved result could not be checked." };
  }

  try {
    const orderRepository = makeOrderRepository(token);
    const [order, garment] = await Promise.all([
      orderRepository.getByOrderNumber(orderNumber),
      makeGarmentRepository(token).getByIdempotencyKey(idempotencyKey),
    ]);

    if (!garment) {
      return { status: "absent", mutationResult: "confirmed-not-saved", error: null };
    }

    if (!order || garment.orderId !== order.id) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "The saved result did not match this order." };
    }

    let compatible = false;
    try {
      compatible = garment.description === description
        && garment.alterationType === toAlterationType(alterationType)
        && garment.measurements === measurements
        && garment.price.equals(Money.fromEuros(priceEuros))
        && (!expectsPhoto || Boolean(garment.photoId));
    } catch {
      compatible = false;
    }
    if (!compatible) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "This UUID was saved with different garment details." };
    }

    const sync = await synchronizeOrder(order, token);
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

function handleAddGarmentError(error: unknown, idempotencyKey: string): AddGarmentState {
  if (error instanceof OrderNotEditableError) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "notEditable", idempotencyKey };
  }

  if (error instanceof InvalidMoneyError) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "price", idempotencyKey };
  }

  if (error instanceof Error && error.message === "Garment description is required") {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "description", idempotencyKey };
  }

  const classified = classifyMutationError(error, isAuthError);
  return {
    status: "error",
    mutationResult: classified.type === "auth-expired" ? "outcome-unknown" : classified.type,
    error: "saveFailed",
    idempotencyKey,
  };
}

async function handleEditError(error: unknown, requestedPath: string, pendingEdit: PendingEdit): Promise<EditState> {
  if (error instanceof OrderNotEditableError) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "This order can no longer be edited." };
  }

  if (error instanceof MissingDueDateError) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "A due date is required." };
  }

  if (error instanceof InvalidMoneyError) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "Enter a valid price." };
  }

  if (error instanceof Error && error.message === "Garment description is required") {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "Each garment needs a description." };
  }

  const classified = classifyMutationError(error, isAuthError);
  if (classified.type === "auth-expired") {
    return await redirectToLoginForAuthError(error, requestedPath);
  }
  return {
    status: "error",
    mutationResult: classified.type,
    error: classified.type === "outcome-unknown"
      ? "We could not confirm whether the change was saved. Check the order before trying again."
      : "The change was not saved. Please review it and try again.",
    ...(classified.type === "outcome-unknown" ? { pendingEdit } : {}),
  };
}

async function reconcileOrderDetails(token: string, pending: Extract<PendingEdit, { kind: "order" }>): Promise<EditState> {
  try {
    const order = await makeOrderRepository(token).getByOrderNumber(pending.orderNumber);
    const dueDate = parseDueDate(pending.dueDateValue);
    if (!order || !dueDate) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "The change was not saved. Reload the order before editing it." };
    }
    if (order.dueDate.getTime() === dueDate.getTime() && (order.notes ?? "") === pending.notes) {
      return { status: "success", mutationResult: "confirmed-saved", error: null, saved: { dueDate: pending.dueDateValue, notes: pending.notes }, sync: await synchronizeOrder(order, token) };
    }
    const expected = parseVersion(pending.expectedDateUpdated);
    if (expected && order.dateUpdated.getTime() === expected.getTime()) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "The change was confirmed not saved. Press Save to try again." };
    }
    return { status: "error", mutationResult: "confirmed-not-saved", error: "The order changed elsewhere. Reload it before editing." };
  } catch (error) {
    if (isAuthError(error)) return redirectToLoginForAuthError(error, `/orders/${pending.orderNumber}`);
    return { status: "error", mutationResult: "outcome-unknown", error: "We still could not confirm whether the change was saved.", pendingEdit: pending };
  }
}

async function reconcileGarmentEdit(token: string, pending: Extract<PendingEdit, { kind: "garment" }>): Promise<EditState> {
  try {
    const order = await makeOrderRepository(token).getByOrderNumber(pending.orderNumber);
    const garment = order?.garments.find((candidate) => candidate.id === pending.garmentId);
    let alterationType;
    let price;
    try {
      alterationType = toAlterationType(pending.alterationType);
      price = Money.fromEuros(Number(pending.price));
    } catch {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "The change was not saved. Review the garment before trying again." };
    }
    if (!order || !garment) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "The garment changed elsewhere. Reload the order before editing." };
    }
    if (garment.description === pending.description && garment.alterationType === alterationType && (garment.measurements ?? "") === pending.measurements && garment.price.equals(price)) {
      return { status: "success", mutationResult: "confirmed-saved", error: null, sync: await synchronizeOrder(order, token) };
    }
    const expected = parseVersion(pending.expectedDateUpdated);
    if (expected && garment.dateUpdated.getTime() === expected.getTime()) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "The change was confirmed not saved. Press Save to try again." };
    }
    return { status: "error", mutationResult: "confirmed-not-saved", error: "The garment changed elsewhere. Reload the order before editing." };
  } catch (error) {
    if (isAuthError(error)) return redirectToLoginForAuthError(error, `/orders/${pending.orderNumber}`);
    return { status: "error", mutationResult: "outcome-unknown", error: "We still could not confirm whether the change was saved.", pendingEdit: pending };
  }
}

function parseVersion(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function synchronizeOrder(order: Order, token: string): Promise<MutationSyncReceipt> {
  return completeOrderMutation({ kind: "order", orderId: order.id, orderNumber: order.orderNumber.value, clientId: order.client.id }, token);
}

function stringValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toOrderGarmentPhoto(value: FormDataEntryValue | null): OrderGarmentPhoto | undefined {
  if (!(value instanceof File) || value.size === 0) {
    return undefined;
  }

  return {
    async load() {
      return {
        bytes: new Uint8Array(await value.arrayBuffer()),
        filename: value.name,
        contentType: value.type || "application/octet-stream",
      };
    },
  };
}
