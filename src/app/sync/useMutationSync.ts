"use client";

import { useContext, useEffect, useSyncExternalStore } from "react";
import type { MutationSyncReceipt } from "./contracts";
import { OrderSyncContext } from "./OrderSyncProvider";

const subscribeNothing = () => () => {};
const zero = () => 0;
const noop = () => {};

export function useMutationSync(receipt: MutationSyncReceipt | undefined): {
  phase: "idle" | "refreshing" | "ready" | "error"; retry: () => void;
} {
  const session = useContext(OrderSyncContext);
  useSyncExternalStore(session?.subscribe ?? subscribeNothing, session?.snapshot ?? zero, zero);
  useEffect(() => { if (receipt) session?.consume(receipt); }, [session, receipt]);
  return {
    phase: !receipt || !session ? "idle" : session.hasSeen(receipt.eventId) ? session.phase() : "refreshing",
    retry: session?.retry ?? noop,
  };
}
