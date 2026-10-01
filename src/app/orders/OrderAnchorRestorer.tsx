"use client";

import { useEffect } from "react";

type AnchorDocument = {
  getElementById(elementId: string): { scrollIntoView(options?: ScrollIntoViewOptions): void } | null;
};

export function OrderAnchorRestorer({ anchor }: { anchor: string | undefined }) {
  useEffect(() => restoreOrderAnchor(anchor, document), [anchor]);
  return null;
}

export function orderAnchor(orderId: string): string {
  return `order-${orderId}`;
}

export function restoreOrderAnchor(anchor: string | undefined, anchorDocument: AnchorDocument): void {
  if (!anchor || !/^order-[A-Za-z0-9_-]+$/.test(anchor)) return;
  anchorDocument.getElementById(anchor)?.scrollIntoView({ block: "center" });
}
