"use server";

import { completeOrderMutation } from "@/app/sync/server";
import type { MutationSyncReceipt, OrderInvalidation } from "@/app/sync/contracts";
import { redirect } from "next/navigation";

import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { getOrRefreshSessionToken } from "@/app/refreshSession";
import { classifyMutationError, type MutationResult } from "@/application/mutations/MutationResult";
import { collectGarmentInputs, parseDueDate } from "@/app/orders/new/newOrderForm";
import { AddOrderGarments, OrderGarmentProcessingError, type OrderGarmentPhoto } from "@/application/useCases/AddOrderGarments";
import { CreateOrder } from "@/application/useCases/CreateOrder";
import { RegisterClientIntake } from "@/application/useCases/RegisterClientIntake";
import { RecordPayment } from "@/application/useCases/RecordPayment";
import { makeClientRepository, makeGarmentRepository, makeOrderRepository, makeOrderSequenceProvider, makePaymentRepository, makePhotoStorage } from "@/composition/directus";
import { IdempotencyConflictError } from "@/domain/errors/IdempotencyConflictError";
import { InvalidMoneyError } from "@/domain/errors/InvalidMoneyError";
import { InvalidPhoneNumberError } from "@/domain/errors/InvalidPhoneNumberError";
import { MissingDueDateError } from "@/domain/errors/MissingDueDateError";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { PhoneNumber } from "@/domain/values/PhoneNumber";
import { isAuthError } from "@/infrastructure/auth/authError";

type NewOrderFormFields = {
  sync?: MutationSyncReceipt;
  diagnostic?: string;
  reconciliationOutcome?: "absent" | "conflict";
  orderNumber?: string;
  failedPositions?: number[];
  replacementIdempotencyKeys?: {
    order: string;
    garments: string[];
    payment: string;
  };
};

export type NewOrderFormState = NewOrderFormFields & (
  | { status: "idle"; error: null; errorCode: null }
  | { status: "success"; mutationResult: "confirmed-saved"; error: null; errorCode: null; orderNumber: string }
  | { status: "error"; mutationResult: Exclude<MutationResult<never>["type"], "auth-expired">; error: string; errorCode: NewOrderErrorCode }
);

export type NewOrderErrorCode =
  | "chooseClient"
  | "privacyConsent"
  | "dueDate"
  | "garmentMissing"
  | "garmentDescription"
  | "garmentPrice"
  | "deposit"
  | "paymentMethod"
  | "invalidPhone"
  | "clientName"
  | "partialGarments"
  | "partialGarmentsUnknown"
  | "partialPayment"
  | "partialPaymentUnknown"
  | "paymentConflict"
  | "staleSubmission"
  | "createFailed";

export async function createOrderAction(prev: NewOrderFormState, formData: FormData): Promise<NewOrderFormState> {
  const token = await getOrRefreshSessionToken();
  const intent = String(formData.get("intent") ?? "create");

  if (!token) {
    redirect("/login?next=%2Forders%2Fnew");
  }

  const clientMode = String(formData.get("client_mode") ?? "new") === "existing" ? "existing" : "new";
  const clientIdInput = String(formData.get("client_id") ?? "").trim();
  const name = String(formData.get("name") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const hasConsent = formData.has("gdpr");
  const orderIdempotencyKeyInput = String(formData.get("order_idempotency_key") ?? "");
  const garmentIdempotencyKeyInputs = stringValues(formData.getAll("garment_idempotency_key"));
  const paymentIdempotencyKeyInput = String(formData.get("payment_idempotency_key") ?? "");
  const depositInput = String(formData.get("deposit") ?? "");
  const deposit = depositInput.trim() ? Number(depositInput) : 0;
  const paymentMethod = lastStringValue(formData.getAll("payment_method")) ?? "";
  const dueDate = parseDueDate(lastStringValue(formData.getAll("due_date")));
  const notes = (lastStringValue(formData.getAll("notes")) ?? "").trim() || undefined;
  const photos = formData.getAll("garment_photo") as File[];
  const garments = collectGarmentInputs(
    stringValues(formData.getAll("garment_description")),
    stringValues(formData.getAll("garment_type")),
    stringValues(formData.getAll("garment_measurements")),
    stringValues(formData.getAll("garment_price")),
  );

  if (clientMode === "existing" && !clientIdInput) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "Please choose a client.", errorCode: "chooseClient" };
  }

  if (clientMode === "new" && !hasConsent) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "Please accept the privacy consent to continue.", errorCode: "privacyConsent" };
  }

  if (!dueDate) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "A due date is required.", errorCode: "dueDate" };
  }

  if (garments.length === 0) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "Add at least one garment to the order.", errorCode: "garmentMissing" };
  }

  if (garments.some((garment) => !garment.description.trim())) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "Each garment needs a description.", errorCode: "garmentDescription" };
  }

  if (garments.some((garment) => !Number.isFinite(garment.priceEuros) || garment.priceEuros < 0)) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "Please enter a valid price for each garment.", errorCode: "garmentPrice" };
  }
  if (!Number.isFinite(deposit) || deposit < 0) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "Please enter a valid deposit amount.", errorCode: "deposit" };
  }
  const garmentTotalCents = garments.reduce((total, garment) => total + Math.round(garment.priceEuros * 100), 0);
  if (Math.round(deposit * 100) > garmentTotalCents) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "The deposit cannot be more than the order total.", errorCode: "deposit" };
  }
  if (deposit > 0 && paymentMethod !== "cash" && paymentMethod !== "card") {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "Please choose cash or card.", errorCode: "paymentMethod" };
  }

  let orderIdempotencyKey: string;
  let garmentIdempotencyKeys: string[];
  let paymentIdempotencyKey: string | undefined;

  try {
    orderIdempotencyKey = IdempotencyKey.fromString(orderIdempotencyKeyInput).value;
    garmentIdempotencyKeys = garments.map((garment) => (
      IdempotencyKey.fromString(garmentIdempotencyKeyInputs[garment.sourceIndex] ?? "").value
    ));
    paymentIdempotencyKey = deposit > 0
      ? IdempotencyKey.fromString(paymentIdempotencyKeyInput).value
      : undefined;
  } catch {
    return {
      status: "error",
      mutationResult: "confirmed-not-saved",
      error: "The order could not be saved. Check the connection and try again.",
      errorCode: "createFailed",
      ...developmentDiagnostic("idempotency validation", "invalid UUID"),
    };
  }

  let orderNumber: string | undefined;
  let syncTarget: OrderInvalidation | undefined;
  if (intent === "reconcile") {
    return reconcileOrderCreation({
      prev,
      token,
      clientMode,
      clientIdInput,
      name,
      phone,
      dueDate,
      notes,
      garments,
      photos,
      orderIdempotencyKey,
      garmentIdempotencyKeys,
      deposit,
      paymentMethod,
      paymentIdempotencyKey,
    });
  }


  let operation = "order creation";
  try {
    let clientId = clientIdInput;
    const orderRepository = makeOrderRepository(token);

    if (clientMode === "new") {
      operation = "existing order lookup";
      const existingOrder = await orderRepository.getByIdempotencyKey(
        IdempotencyKey.fromString(orderIdempotencyKey),
      );

      if (existingOrder) {
        const requestedPhone = PhoneNumber.fromRaw(phone);
        if (
          existingOrder.client.name !== name.trim()
          || existingOrder.client.phone?.value !== requestedPhone.value
          || !existingOrder.client.gdprConsent
        ) {
          return staleSubmission(garments.length);
        }

        clientId = existingOrder.client.id;
      } else {
        operation = "client registration";
        const client = await new RegisterClientIntake(makeClientRepository(token)).execute({ name, phoneRaw: phone, gdprConsent: true });
        clientId = client.id;
      }
    }

    operation = "order creation";
    const order = await new CreateOrder(orderRepository, makeOrderSequenceProvider(token)).execute({
      idempotencyKey: orderIdempotencyKey,
      clientId,
      receivedDate: new Date(),
      dueDate,
      notes,
    });
    orderNumber = order.orderNumber.value;
    syncTarget = { kind: "order", orderId: order.id, orderNumber, clientId: order.client.id };
    operation = "garment creation";
    await new AddOrderGarments(makeGarmentRepository(token), makePhotoStorage(token)).execute({
      orderId: order.id,
      garments: garments.map((garment, index) => ({
        idempotencyKey: garmentIdempotencyKeys[index]!,
        description: garment.description,
        alterationType: garment.alterationType,
        measurements: garment.measurements,
        priceEuros: garment.priceEuros,
        photo: toOrderGarmentPhoto(photos[garment.sourceIndex]),
      })),
    });
    if (deposit > 0 && paymentIdempotencyKey) {
      try {
        await new RecordPayment(makePaymentRepository(token)).execute({
          orderId: order.id,
          idempotencyKey: paymentIdempotencyKey,
          type: "deposit",
          amountEuros: deposit,
          method: paymentMethod,
        });
      } catch (error) {
        if (isAuthError(error)) {
          return redirectToLoginForAuthError(error, `/orders/${orderNumber}`);
        }
        const classified = classifyMutationError(error, isAuthError);
        const paymentConflict = classified.type === "confirmed-not-saved" && classified.reason === "conflict";
        return {
          status: "error",
          mutationResult: classified.type === "confirmed-not-saved" ? "confirmed-saved" : "outcome-unknown",
          error: paymentConflict
            ? `Order ${orderNumber} was created, but the deposit UUID belongs to different content. Nothing was overwritten.`
            : classified.type === "confirmed-not-saved"
            ? `Order ${orderNumber} was created, but the deposit was not saved. Open the order and record it once.`
            : `Order ${orderNumber} was created, but the deposit could not be confirmed. Check Directus before retrying.`,
          errorCode: paymentConflict ? "paymentConflict" : classified.type === "confirmed-not-saved" ? "partialPayment" : "partialPaymentUnknown",
          orderNumber,
          ...(paymentConflict ? { reconciliationOutcome: "conflict" as const } : {}),
          sync: await completeOrderMutation(syncTarget, token),
        };
      }
    }
  } catch (error) {
    if (operation === "order creation" && error instanceof IdempotencyConflictError) {
      return staleSubmission(garments.length);
    }

    if (error instanceof OrderGarmentProcessingError && orderNumber && syncTarget) {
      const sync = await completeOrderMutation(syncTarget, token);
      const positions = error.failures.map((failure) => failure.index + 1).join(", ");
      const authFailure = error.failures.find((failure) => isAuthError(failure.cause));

      if (authFailure) {
        return redirectToLoginForAuthError(authFailure.cause, `/orders/${orderNumber}`);
      }

      const hasUnknownGarment = error.failures.some(
        (failure) => classifyMutationError(failure.cause, isAuthError).type === "outcome-unknown",
      );

      return {
        status: "error",
        mutationResult: hasUnknownGarment ? "outcome-unknown" : "confirmed-saved",
        error: hasUnknownGarment
          ? `Order ${orderNumber} was created, but garment positions ${positions} could not be confirmed. Open the order and check them before retrying.`
          : `Order ${orderNumber} was created, but garment positions ${positions} could not be saved. Open the order and add them again.`,
        errorCode: hasUnknownGarment ? "partialGarmentsUnknown" : "partialGarments",
        orderNumber,
        failedPositions: error.failures.map((failure) => failure.index + 1),
        sync,
      };
    }

    if (error instanceof InvalidPhoneNumberError) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "Please enter a valid phone number.", errorCode: "invalidPhone" };
    }
    if (error instanceof MissingDueDateError) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "A due date is required.", errorCode: "dueDate" };
    }

    if (error instanceof InvalidMoneyError) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "Please enter a valid price for each garment.", errorCode: "garmentPrice" };
    }

    if (error instanceof Error && error.message === "Client name is required") {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "Please enter the client's name.", errorCode: "clientName" };
    }

    if (error instanceof Error && error.message === "Garment description is required") {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "Each garment needs a description.", errorCode: "garmentDescription" };
    }

    if (isAuthError(error)) {
      return redirectToLoginForAuthError(error, "/orders/new");
    }

    const classified = classifyMutationError(error, isAuthError);

    return {
      status: "error",
      mutationResult: classified.type === "auth-expired" ? "outcome-unknown" : classified.type,
      error: classified.type === "confirmed-not-saved"
        ? "The order was not saved. Check the details and try again."
        : "The order could not be confirmed. Check the connection before trying again.",
      errorCode: "createFailed",
      ...developmentDiagnostic(operation, safeErrorMessage(error)),
    };
  }

  if (!orderNumber || !syncTarget) {
    throw new Error("Order number is missing after order creation");
  }

  return { status: "success", mutationResult: "confirmed-saved", error: null, errorCode: null, orderNumber, sync: await completeOrderMutation(syncTarget, token) };
}

function developmentDiagnostic(operation: string, reason: string): { diagnostic?: string } {
  return process.env.NODE_ENV === "development" ? { diagnostic: `${operation}: ${reason}` } : {};
}

function safeErrorMessage(error: unknown, depth = 0): string {
  if (typeof error !== "object" || error === null) {
    return "Unknown failure";
  }

  const candidate = error as {
    cause?: unknown;
    errors?: Array<{ message?: unknown; extensions?: { code?: unknown } }>;
    message?: unknown;
    response?: { status?: unknown };
    status?: unknown;
  };
  const first = candidate.errors?.[0];
  const message = typeof candidate.message === "string"
    ? candidate.message
    : typeof first?.message === "string" ? first.message : "Request failed";
  const code = typeof first?.extensions?.code === "string" ? first.extensions.code : undefined;
  const status = typeof candidate.response?.status === "number"
    ? candidate.response.status
    : typeof candidate.status === "number" ? candidate.status : undefined;
  const annotations = [code, status].filter((value) => value !== undefined).join(", ");
  const current = annotations ? `${message} [${annotations}]` : message;

  return candidate.cause !== undefined && depth < 3
    ? `${current} | cause: ${safeErrorMessage(candidate.cause, depth + 1)}`
    : current;
}

type ReconcileOrderCreationInput = {
  prev: NewOrderFormState;
  token: string;
  clientMode: "existing" | "new";
  clientIdInput: string;
  name: string;
  phone: string;
  dueDate: Date;
  notes?: string;
  garments: ReturnType<typeof collectGarmentInputs>;
  photos: File[];
  orderIdempotencyKey: string;
  garmentIdempotencyKeys: string[];
  deposit: number;
  paymentMethod: string;
  paymentIdempotencyKey?: string;
};

async function reconcileOrderCreation(input: ReconcileOrderCreationInput): Promise<NewOrderFormState> {
  if (input.prev.status !== "error" || input.prev.mutationResult !== "outcome-unknown") {
    return reconciliationConflict();
  }

  let syncTarget: OrderInvalidation | undefined;
  try {
    const orderRepository = makeOrderRepository(input.token);
    const order = await orderRepository.getByIdempotencyKey(IdempotencyKey.fromString(input.orderIdempotencyKey));

    if (!order) {
      return reconciliationAbsent();
    }

    if (!orderMatchesRequest(order, input)) {
      return reconciliationConflict();
    }
    syncTarget = { kind: "order", orderId: order.id, orderNumber: order.orderNumber.value, clientId: order.client.id };

    const positions = input.prev.errorCode === "partialGarmentsUnknown"
      ? input.prev.failedPositions ?? []
      : input.garments.map((_garment, index) => index + 1);
    const garmentRepository = makeGarmentRepository(input.token);
    let hasAbsentGarment = false;

    for (const position of positions) {
      const index = position - 1;
      const requested = input.garments[index];
      const key = input.garmentIdempotencyKeys[index];
      if (!requested || !key) {
        return reconciliationConflict();
      }

      const saved = await garmentRepository.getByIdempotencyKey(IdempotencyKey.fromString(key));
      if (!saved) {
        hasAbsentGarment = true;
        continue;
      }

      const requestedPhoto = input.photos[requested.sourceIndex];
      const expectsPhoto = Boolean(requestedPhoto && requestedPhoto.size > 0);
      if (
        saved.orderId !== order.id
        || saved.description !== requested.description.trim()
        || saved.alterationType !== requested.alterationType
        || (saved.measurements ?? "") !== (requested.measurements?.trim() ?? "")
        || saved.price.cents !== Math.round(requested.priceEuros * 100)
        || Boolean(saved.photoId) !== expectsPhoto
      ) {
        return reconciliationConflict();
      }

      if (expectsPhoto && saved.photoId) {
        const requestedUpload = await toOrderGarmentPhoto(requestedPhoto)?.load();
        if (!requestedUpload || !await makePhotoStorage(input.token).matches(saved.photoId, requestedUpload)) {
          return reconciliationConflict();
        }
      }
    }

    if (hasAbsentGarment) {
      return { ...reconciliationAbsent(), sync: await completeOrderMutation({ kind: "order", orderId: order.id, orderNumber: order.orderNumber.value, clientId: order.client.id }, input.token) };
    }

    if (input.deposit > 0) {
      if (!input.paymentIdempotencyKey) {
        return reconciliationConflict();
      }
      const payment = await makePaymentRepository(input.token).getByIdempotencyKey(
        IdempotencyKey.fromString(input.paymentIdempotencyKey),
      );
      if (!payment) {
        return { ...reconciliationAbsent(), sync: await completeOrderMutation(syncTarget, input.token) };
      }
      if (
        payment.orderId !== order.id
        || payment.type !== "deposit"
        || payment.amount.cents !== Math.round(input.deposit * 100)
        || payment.method !== input.paymentMethod
      ) {
        return reconciliationConflict();
      }
    }

    return {
      status: "success",
      mutationResult: "confirmed-saved",
      error: null,
      errorCode: null,
      orderNumber: order.orderNumber.value,
      sync: await completeOrderMutation({ kind: "order", orderId: order.id, orderNumber: order.orderNumber.value, clientId: order.client.id }, input.token),
    };
  } catch (error) {
    const sync = syncTarget ? await completeOrderMutation(syncTarget, input.token) : undefined;
    if (isAuthError(error)) {
      return redirectToLoginForAuthError(error, "/orders/new");
    }

    return {
      status: "error",
      mutationResult: "outcome-unknown",
      error: "The order still could not be confirmed. Check the connection before trying again.",
      errorCode: input.prev.errorCode === "partialGarmentsUnknown"
        ? "partialGarmentsUnknown"
        : input.prev.errorCode === "partialPaymentUnknown"
          ? "partialPaymentUnknown"
          : "createFailed",
      orderNumber: input.prev.orderNumber,
      failedPositions: input.prev.failedPositions,
      ...(sync ? { sync } : {}),
    };
  }
}

function orderMatchesRequest(order: Awaited<ReturnType<ReturnType<typeof makeOrderRepository>["getByIdempotencyKey"]>>, input: ReconcileOrderCreationInput): boolean {
  if (!order) return false;

  const clientMatches = input.clientMode === "existing"
    ? order.client.id === input.clientIdInput
    : newClientMatches(order.client, input.name, input.phone);

  return clientMatches
    && order.status.value === "received"
    && order.dueDate.getTime() === input.dueDate.getTime()
    && (order.notes ?? "") === (input.notes ?? "");
}

function newClientMatches(client: { name: string; phone?: { value: string } | null; gdprConsent: boolean }, name: string, phone: string): boolean {
  try {
    return client.name === name.trim()
      && client.phone?.value === PhoneNumber.fromRaw(phone).value
      && client.gdprConsent;
  } catch {
    return false;
  }
}

function reconciliationAbsent(): NewOrderFormState {
  return {
    status: "error",
    mutationResult: "confirmed-not-saved",
    reconciliationOutcome: "absent",
    error: "Directus confirmed that part or all of the order was not saved. You can retry now.",
    errorCode: "createFailed",
  };
}

function reconciliationConflict(): NewOrderFormState {
  return {
    status: "error",
    mutationResult: "confirmed-not-saved",
    reconciliationOutcome: "conflict",
    error: "Directus found different content for this save attempt. The order was not changed.",
    errorCode: "createFailed",
  };
}

function staleSubmission(garmentCount: number): NewOrderFormState {
  return {
    status: "error",
    mutationResult: "confirmed-not-saved",
    error: "This form was linked to an earlier save. Fresh retry keys are ready.",
    errorCode: "staleSubmission",
    replacementIdempotencyKeys: freshIdempotencyKeys(garmentCount),
  };
}

function freshIdempotencyKeys(garmentCount: number): NonNullable<NewOrderFormFields["replacementIdempotencyKeys"]> {
  return {
    order: crypto.randomUUID(),
    garments: Array.from({ length: garmentCount }, () => crypto.randomUUID()),
    payment: crypto.randomUUID(),
  };
}

function stringValues(values: FormDataEntryValue[]): string[] {
  return values.map((value) => (typeof value === "string" ? value : ""));
}

function lastStringValue(values: FormDataEntryValue[]): string | undefined {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

function toOrderGarmentPhoto(file: File | undefined): OrderGarmentPhoto | undefined {
  if (!file || file.size === 0) {
    return undefined;
  }

  return {
    async load() {
      return {
        bytes: new Uint8Array(await file.arrayBuffer()),
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      };
    },
  };
}
