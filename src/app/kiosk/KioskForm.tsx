"use client";

import { useActionState, useEffect, useRef } from "react";

import { intakeAction, type IntakeError } from "@/app/kiosk/actions";
import { isKioskSubmissionBlocked } from "@/app/kiosk/kioskSubmission";
import { useOnlineStatus } from "@/app/kiosk/useOnlineStatus";

const initialState = { status: "idle" as const, error: null };

type KioskFormTexts = {
  successTitle: string;
  successSubtitle: string;
  registerAnother: string;
  title: string;
  subtitle: string;
  name: string;
  phone: string;
  gdpr: string;
  submit: string;
  submitting: string;
  offline: string;
  errors: Record<IntakeError, string>;
};

export function KioskForm({ texts }: { texts: KioskFormTexts }) {
  const [state, formAction, isPending] = useActionState(intakeAction, initialState);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status !== "error") return;
    if (state.error === "name") nameRef.current?.focus();
    if (state.error === "phone") phoneRef.current?.focus();
    if (state.error === "consent") consentRef.current?.focus();
  }, [state]);

  const fieldError = state.status === "error" ? state.error : null;
  const isOnline = useOnlineStatus();
  const submissionBlocked = isKioskSubmissionBlocked(isPending, state.mutationResult, isOnline);

  if (state.status === "success") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-on-surface">
        <section className="w-full max-w-md rounded-[10px] border border-outline-variant bg-surface-container-lowest p-7 text-center shadow-sm sm:p-8">
          <p className="font-wordmark text-wordmark text-secondary">Koko Atelier</p>
          <h1 className="mt-4 text-headline-lg text-on-surface">{texts.successTitle}</h1>
          <p className="mt-3 text-body-md text-on-surface-variant">{texts.successSubtitle}</p>
          <a
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-5 text-label-lg text-on-primary transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background"
            href="/kiosk"
          >
            {texts.registerAnother}
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-7 text-on-surface sm:px-5">
      <section className="w-full max-w-md rounded-[10px] border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:p-7">
        <div className="mb-6">
          <p className="font-wordmark text-wordmark text-secondary">Koko Atelier</p>
          <h1 className="mt-4 text-headline-lg text-on-surface">{texts.title}</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">{texts.subtitle}</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <label className="text-label-lg text-on-surface" htmlFor="name">
              {texts.name}
            </label>
            <input
              autoComplete="name"
              aria-describedby={fieldError === "name" ? "kiosk-form-error" : undefined}
              aria-invalid={fieldError === "name" || undefined}
              ref={nameRef}
              className="min-h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-base text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-secondary/30"
              id="name"
              name="name"
              required
              type="text"
            />
          </div>

          <div className="space-y-2">
            <label className="text-label-lg text-on-surface" htmlFor="phone">
              {texts.phone}
            </label>
            <input
              autoComplete="tel"
              aria-describedby={fieldError === "phone" ? "kiosk-form-error" : undefined}
              aria-invalid={fieldError === "phone" || undefined}
              ref={phoneRef}
              className="min-h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-base text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-secondary/30"
              id="phone"
              inputMode="tel"
              name="phone"
              required
              type="tel"
            />
          </div>

          <label className="flex min-h-12 gap-3 rounded-lg bg-surface-container-low p-4 text-body-md text-on-surface">
            <input aria-describedby={fieldError === "consent" ? "kiosk-form-error" : undefined} aria-invalid={fieldError === "consent" || undefined} className="mt-0.5 h-5 w-5 shrink-0 accent-primary focus:ring-secondary" name="gdpr" ref={consentRef} required type="checkbox" />
            <span>{texts.gdpr}</span>
          </label>

          {!isOnline ? (
            <p className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-body-md text-on-surface" role="status" aria-live="polite">
              {texts.offline}
            </p>
          ) : null}

          {state.error ? (
            <p className="rounded-lg bg-error-container px-4 py-3 text-body-md font-bold text-on-error-container" id="kiosk-form-error" role="alert">
              {texts.errors[state.error]}
            </p>
          ) : null}

          <button
            className="min-h-12 w-full rounded-full bg-primary px-5 text-label-lg text-on-primary transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45"
            disabled={submissionBlocked}
            type="submit"
          >
            {isPending ? texts.submitting : texts.submit}
          </button>
        </form>
      </section>
    </main>
  );
}
