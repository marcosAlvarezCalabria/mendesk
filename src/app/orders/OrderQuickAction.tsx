"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { cx } from "@/app/_ui/classNames";
import { Icon } from "@/app/_ui/Icon";
import {
  changeStatusAction,
  type StatusState,
} from "@/app/orders/[orderNumber]/status-actions";

const initialState: StatusState = { status: "idle", error: null };

type QuickStatusTarget = "ready" | "collected";

export type OrderQuickActionTexts = {
  action: string;
  pending: string;
  success: string;
  error: string;
  openWhatsapp: string;
};

export function OrderQuickAction({
  orderNumber,
  target,
  texts,
}: {
  orderNumber: string;
  target: QuickStatusTarget;
  texts: OrderQuickActionTexts;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    changeStatusAction,
    initialState,
  );
  const succeeded = state.status === "success" && state.target === target;

  useEffect(() => {
    if (succeeded && target === "collected") {
      router.refresh();
    }
  }, [router, succeeded, target]);

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {succeeded ? (
        <p
          aria-live="polite"
          className="min-h-11 flex-1 content-center text-body-sm text-status-ready"
          role="status"
        >
          {texts.success}
        </p>
      ) : (
        <form action={formAction} className="min-w-0 flex-1">
          <input name="orderNumber" type="hidden" value={orderNumber} />
          <input name="target" type="hidden" value={target} />
          <button
            className={cx(
              "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-[0.75rem] font-bold text-white transition focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
              target === "ready" ? "bg-primary hover:bg-primary/90" : "bg-status-ready hover:bg-status-ready/90",
            )}
            disabled={isPending}
            type="submit"
          >
            <Icon className="size-4" name={target === "ready" ? "check_circle" : "inventory_2"} />
            <span aria-live="polite">
              {isPending ? texts.pending : texts.action}
            </span>
          </button>
        </form>
      )}

      {state.whatsappUrl ? (
        <a
          className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-status-ready px-5 text-[0.75rem] font-bold text-white transition hover:bg-status-ready/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background"
          href={state.whatsappUrl}
          onClick={() => router.refresh()}
          rel="noreferrer"
          target="_blank"
        >
          <Icon className="size-4" name="chat" />
          <span>{texts.openWhatsapp}</span>
        </a>
      ) : null}

      {state.status === "error" ? (
        <p
          aria-live="polite"
          className="w-full rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container"
          role="alert"
        >
          {texts.error}
        </p>
      ) : null}
    </div>
  );
}
