"use client";

import { useEffect } from "react";

type RemovableStorage = Pick<Storage, "removeItem">;
type StorageSource = {
  readonly localStorage: RemovableStorage;
  readonly sessionStorage: RemovableStorage;
};

export function LegacyPinStorageCleanup() {
  useEffect(() => {
    clearLegacyPinStorage(window);
  }, []);

  return null;
}

export function clearLegacyPinStorage(storageSource: StorageSource): void {
  try {
    storageSource.localStorage.removeItem("koko_pin");
  } catch {
    // Storage getters and writes can fail in private or restricted browser contexts.
  }

  try {
    storageSource.sessionStorage.removeItem("koko_pin_unlocked");
  } catch {
    // Each legacy value is cleaned independently so startup is never blocked.
  }
}
