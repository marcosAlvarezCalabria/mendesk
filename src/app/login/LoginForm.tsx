"use client";

import Image from "next/image";
import { useActionState } from "react";

import { Icon } from "@/app/_ui/Icon";
import { loginAction } from "@/app/login/actions";
import type { StoreIdentity } from "@/config/storeConfig";

const initialState = { error: null };

type LoginFormTexts = {
  title: string;
  subtitle: string;
  email: string;
  password: string;
  submit: string;
  submitting: string;
  error: string;
};

export function LoginForm({ identity, nextPath, texts }: { identity: StoreIdentity; nextPath: string; texts: LoginFormTexts }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-margin-mobile py-12 text-on-surface">
      <section className="w-full max-w-[720px]">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto flex size-40 items-center justify-center rounded-2xl bg-primary p-4">
              <Image
                alt={identity.logo.alt}
                className="h-full w-full object-contain"
                height={142}
                priority
                sizes="160px"
                src={identity.logo.src}
                width={160}
              />
            </div>
            <h1 className="mt-6 text-title-lg text-on-surface">{texts.title}</h1>
            <p className="mt-2 text-body-md text-on-surface-variant">{texts.subtitle}</p>
          </div>

          <form action={formAction} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-card-padding shadow-[0_4px_20px_0_rgba(0,0,0,0.04)]">
            <input name="next" type="hidden" value={nextPath} />
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-label-md text-on-surface" htmlFor="email">
                  {texts.email}
                </label>
                <input className="form-input" id="email" name="email" required type="email" />
              </div>

              <div className="space-y-2">
                <label className="text-label-md text-on-surface" htmlFor="password">
                  {texts.password}
                </label>
                <input className="form-input" id="password" name="password" required type="password" />
              </div>

              {state.error ? (
                <p className="rounded-lg border border-status-cancelled/30 bg-status-cancelled/10 px-4 py-3 text-body-sm text-status-cancelled" role="alert" aria-live="polite">
                  {texts.error}
                </p>
              ) : null}

              <button
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-label-lg text-on-primary transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending}
                type="submit"
              >
                <Icon name="login" />
                <span>{isPending ? texts.submitting : texts.submit}</span>
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
