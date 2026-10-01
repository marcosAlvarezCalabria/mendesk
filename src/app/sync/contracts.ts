import type { OrderSnapshot } from "@/application/dtos/OrderSnapshot";

export type OrderInvalidation = { kind: "order"; orderId: string; orderNumber: string; clientId: string };
export type ClientInvalidation = { kind: "client"; clientId: string };
export type InvalidationTarget = OrderInvalidation | ClientInvalidation;
export type MutationSyncReceipt = { eventId: string; target: InvalidationTarget; snapshot: OrderSnapshot | null };
export type InvalidationSignal = { version: 1; eventId: string; target: InvalidationTarget };
