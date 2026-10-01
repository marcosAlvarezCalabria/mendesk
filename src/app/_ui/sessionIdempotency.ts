"use client";

import { useEffect, useSyncExternalStore } from "react";

import { IdempotencyKey } from "@/domain/values/IdempotencyKey";

const listeners = new Map<string, Set<() => void>>();

type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function restoreSessionIdempotencyKey(storage: SessionStorage, slot: string, fallback: string): string {
  const stored = storage.getItem(slot);

  if (stored && isValidKey(stored)) {
    return stored;
  }

  storage.setItem(slot, fallback);
  return fallback;
}

export function storeSessionIdempotencyKey(
  storage: SessionStorage,
  slot: string,
  nextKey: string,
  expectedCurrentKey?: string,
): boolean {
  if (!isValidKey(nextKey) || (expectedCurrentKey !== undefined && storage.getItem(slot) !== expectedCurrentKey)) {
    return false;
  }

  storage.setItem(slot, nextKey);
  notify(slot);
  return true;
}

export function clearSessionIdempotencyKey(storage: SessionStorage, slot: string, confirmedKey: string): boolean {
  if (storage.getItem(slot) !== confirmedKey) {
    return false;
  }

  storage.removeItem(slot);
  notify(slot);
  return true;
}

export function clearSessionIdempotencySlot(storage: SessionStorage, slot: string): void {
  storage.removeItem(slot);
  notify(slot);
}

export function useSessionIdempotencyKey(slot: string, fallback: string, confirmedNextKey?: string) {
  const key = useSyncExternalStore(
    (listener) => subscribe(slot, listener),
    () => restoreSessionIdempotencyKey(window.sessionStorage, slot, fallback),
    () => fallback,
  );
  const ready = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!confirmedNextKey) {
      return;
    }

    storeSessionIdempotencyKey(window.sessionStorage, slot, confirmedNextKey, key);
  }, [confirmedNextKey, key, slot]);

  return { idempotencyKey: key, ready } as const;
}

function subscribe(slot: string, listener: () => void): () => void {
  const slotListeners = listeners.get(slot) ?? new Set();
  slotListeners.add(listener);
  listeners.set(slot, slotListeners);

  return () => {
    slotListeners.delete(listener);
    if (slotListeners.size === 0) {
      listeners.delete(slot);
    }
  };
}

function notify(slot: string): void {
  listeners.get(slot)?.forEach((listener) => listener());
}

function isValidKey(value: string): boolean {
  try {
    IdempotencyKey.fromString(value);
    return true;
  } catch {
    return false;
  }
}
