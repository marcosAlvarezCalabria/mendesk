export type EditOrderLeaveGuardState = {
  dirty: boolean;
  pending: boolean;
};

type BeforeUnloadLikeEvent = {
  preventDefault: () => void;
  returnValue: unknown;
};

export function isEditOrderLeaveGuardActive({ dirty, pending }: EditOrderLeaveGuardState): boolean {
  return dirty && !pending;
}

export function confirmEditOrderNavigation(
  state: EditOrderLeaveGuardState,
  confirmLeave: () => boolean,
): boolean {
  return !isEditOrderLeaveGuardActive(state) || confirmLeave();
}

export function guardEditOrderBeforeUnload(
  event: BeforeUnloadLikeEvent,
  state: EditOrderLeaveGuardState,
): boolean {
  if (!isEditOrderLeaveGuardActive(state)) return false;
  event.preventDefault();
  event.returnValue = "";
  return true;
}

export function handleEditOrderPopNavigation(
  state: EditOrderLeaveGuardState,
  confirmLeave: () => boolean,
  restoreCurrentEntry: () => void,
  restoreFocus: () => void,
): boolean {
  const canLeave = confirmEditOrderNavigation(state, confirmLeave);
  if (!canLeave) {
    restoreCurrentEntry();
    restoreFocus();
  }
  return canLeave;
}
