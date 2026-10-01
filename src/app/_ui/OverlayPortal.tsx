"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function OverlayPortal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNothing, clientSnapshot, serverSnapshot);

  return mounted ? createPortal(children, document.body) : null;
}

const subscribeNothing = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
