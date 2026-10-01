"use client";

import { useContext, useEffect } from "react";
import { OrderSyncContext } from "./OrderSyncProvider";

export function ReadSyncMarker({ readId }: { readId: string }) {
  const session = useContext(OrderSyncContext);
  useEffect(() => { session?.markRead(readId); }, [session, readId]);
  return null;
}
