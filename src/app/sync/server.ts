import { revalidatePath } from "next/cache";
import { toOrderSnapshot } from "@/application/dtos/OrderSnapshot";
import { makeOrderRepository } from "@/composition/directus";
import type { InvalidationTarget, MutationSyncReceipt, OrderInvalidation } from "./contracts";
import { invalidationPaths } from "./orderInvalidation";

// Server-only module: next/cache and authenticated composition never enter client imports.
function invalidate(target: InvalidationTarget): void {
  for (const path of invalidationPaths(target)) {
    if (path.includes("[orderNumber]")) revalidatePath(path, "page");
    else revalidatePath(path);
  }
}

export async function completeOrderMutation(target: OrderInvalidation, token: string): Promise<MutationSyncReceipt> {
  const receipt: MutationSyncReceipt = { eventId: crypto.randomUUID(), target, snapshot: null };
  try {
    const order = await makeOrderRepository(token).getByOrderNumber(target.orderNumber);
    if (order && order.id === target.orderId && order.client.id === target.clientId) {
      receipt.snapshot = toOrderSnapshot(order);
    }
  } catch {
    // The write is already confirmed. A read failure must never enable another write.
  }
  invalidate(target);
  return receipt;
}

export async function completeClientMutation(clientId: string): Promise<MutationSyncReceipt> {
  const target = { kind: "client" as const, clientId };
  invalidate(target);
  return { eventId: crypto.randomUUID(), target, snapshot: null };
}
