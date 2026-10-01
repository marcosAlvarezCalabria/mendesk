import type { StatusError, StatusState } from "@/app/orders/[orderNumber]/status-actions";
import type { StatusAction } from "@/app/orders/[orderNumber]/statusActions";

export type StatusSuccessLabels = Record<StatusAction, string>;
export type StatusErrorLabels = Record<StatusError, string>;

export function statusActionLayoutClassName(): string {
  return "grid grid-cols-2 gap-2 [&>:only-child]:col-span-2";
}

export function statusActionControlClassName(): string {
  return "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full px-2.5 text-center text-[0.75rem] font-bold leading-tight transition-[transform,filter,background-color] duration-75 active:scale-[0.98] active:brightness-90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transform-none";
}

export function shouldRenderStatusBar(
  actions: readonly StatusAction[],
  reviewWhatsappUrl: string | undefined,
  state: StatusState,
): boolean {
  return actions.length > 0 || Boolean(reviewWhatsappUrl) || Boolean(state.whatsappUrl) || state.status === "success";
}

export function statusSuccessMessage(
  state: StatusState,
  labels: StatusSuccessLabels,
): string | null {
  if (state.status !== "success" || !state.target) {
    return null;
  }

  return labels[state.target];
}

export function statusErrorMessage(
  state: StatusState,
  labels: StatusErrorLabels,
): string | null {
  if (state.status !== "error" || !state.error) {
    return null;
  }

  return labels[state.error];
}
