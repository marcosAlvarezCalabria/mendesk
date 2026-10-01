"use client";

import React, { useContext } from "react";
import { OrderSyncContext } from "@/app/sync/OrderSyncProvider";

export function OrdersReadRetry({ label }: { label: string }) {
  const session = useContext(OrderSyncContext);
  return <button type="button" className="min-h-11 rounded-lg px-3 font-bold underline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => session?.retry()}>{label}</button>;
}
