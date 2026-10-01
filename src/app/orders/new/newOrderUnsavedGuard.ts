export type NewOrderLeaveGuardState = {
  dirty: boolean;
  submitting: boolean;
  saved?: boolean;
};

type BeforeUnloadLikeEvent = {
  preventDefault: () => void;
  returnValue: unknown;
};

export function isNewOrderLeaveGuardActive({ dirty, saved, submitting }: NewOrderLeaveGuardState): boolean {
  return dirty && !submitting && !saved;
}

export function confirmNewOrderNavigation(
  state: NewOrderLeaveGuardState,
  confirmLeave: () => boolean,
): boolean {
  return !isNewOrderLeaveGuardActive(state) || confirmLeave();
}

export function guardNewOrderBeforeUnload(
  event: BeforeUnloadLikeEvent,
  state: NewOrderLeaveGuardState,
): boolean {
  if (!isNewOrderLeaveGuardActive(state)) {
    return false;
  }

  event.preventDefault();
  event.returnValue = "";
  return true;
}

export function handleNewOrderPopNavigation(
  state: NewOrderLeaveGuardState,
  confirmLeave: () => boolean,
  restoreCurrentEntry: () => void,
): boolean {
  const canLeave = confirmNewOrderNavigation(state, confirmLeave);

  if (!canLeave) {
    restoreCurrentEntry();
  }

  return canLeave;
}
