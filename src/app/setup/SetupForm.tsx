"use client";

import Link from "next/link";
import { useActionState } from "react";
import { completeSetupAction, type SetupFormState } from "./actions";
import type { ShopProfile } from "@/domain/entities/ShopProfile";

type Copy = Record<"title" | "intro" | "name" | "email" | "phone" | "whatsapp" | "address" | "hint" | "save" | "saving" | "skip", string>;

export function SetupForm({ copy, initial, nextPath }: { copy: Copy; initial: ShopProfile | null; nextPath: string }) {
  const [state, action, pending] = useActionState<SetupFormState, FormData>(completeSetupAction, { error: null });
  return <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 sm:py-12">
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 text-label-md font-bold text-secondary">Mendesk</p>
      <h1 className="max-w-xl text-balance text-headline-lg">{copy.title}</h1>
      <p className="mt-3 max-w-[65ch] text-body-md text-on-surface-variant">{copy.intro}</p>

      <form action={action} className="mt-8 space-y-6 rounded-xl bg-surface-container-lowest p-5 shadow-[0_12px_32px_rgba(45,35,24,0.08)] sm:p-8">
        <input name="next" type="hidden" value={nextPath} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field defaultValue={initial?.name} label={copy.name} name="name" required />
          <Field autoComplete="email" defaultValue={initial?.contactEmail} label={copy.email} name="contactEmail" required type="email" />
          <Field autoComplete="tel" defaultValue={initial?.contactPhone} label={copy.phone} name="contactPhone" required type="tel" />
          <Field autoComplete="tel" defaultValue={initial?.whatsappNumber} label={copy.whatsapp} name="whatsappNumber" type="tel" />
        </div>
        <label className="block text-label-md font-semibold">
          {copy.address}
          <textarea className="form-input mt-2 min-h-28 resize-y py-3" defaultValue={initial?.address} maxLength={500} name="address" />
        </label>
        <p className="text-body-sm text-on-surface-variant">{copy.hint}</p>
        {state.error ? <p className="rounded-lg bg-error-container px-4 py-3 text-body-sm font-semibold text-on-error-container" role="alert">{state.error}</p> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link className="min-h-11 rounded-lg px-4 py-3 text-center text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary" href={nextPath}>{copy.skip}</Link>
          <button className="min-h-12 rounded-lg bg-primary px-6 py-3 text-label-lg text-on-primary transition hover:bg-[#332b24] focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60" disabled={pending} type="submit">{pending ? copy.saving : copy.save}</button>
        </div>
      </form>
    </div>
  </main>;
}

function Field({ label, name, defaultValue, required, type = "text", autoComplete }: { label: string; name: string; defaultValue?: string; required?: boolean; type?: string; autoComplete?: string }) {
  return <label className="block text-label-md font-semibold">
    {label}
    <input autoComplete={autoComplete} className="form-input mt-2" defaultValue={defaultValue} maxLength={254} name={name} required={required} type={type} />
  </label>;
}
