"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { ShopProfile } from "@/domain/entities/ShopProfile";

export type ShopProfileFormState = { error: string | null; saved?: boolean };

export type ShopProfileFormCopy = Record<
  "name" | "email" | "phone" | "whatsapp" | "address" | "hint" | "save" | "saving" | "saved",
  string
>;

type ShopProfileFormProps = {
  action: (state: ShopProfileFormState, formData: FormData) => Promise<ShopProfileFormState>;
  copy: ShopProfileFormCopy;
  hiddenFields?: Readonly<Record<string, string>>;
  initial: ShopProfile;
  secondary?: { href: string; label: string };
};

export function ShopProfileForm({ action, copy, hiddenFields = {}, initial, secondary }: ShopProfileFormProps) {
  const [state, formAction, pending] = useActionState(action, { error: null, saved: false });
  const [dirty, setDirty] = useState(false);

  return (
    <form action={formAction} className="space-y-6 rounded-xl bg-surface-container-lowest p-5 shadow-[0_12px_32px_rgba(45,35,24,0.08)] sm:p-8" onChange={() => setDirty(true)} onSubmit={() => setDirty(false)}>
      {Object.entries(hiddenFields).map(([name, value]) => <input key={name} name={name} type="hidden" value={value} />)}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field defaultValue={initial.name} label={copy.name} name="name" required />
        <Field autoComplete="email" defaultValue={initial.contactEmail} label={copy.email} name="contactEmail" required type="email" />
        <Field autoComplete="tel" defaultValue={initial.contactPhone} label={copy.phone} name="contactPhone" required type="tel" />
        <Field autoComplete="tel" defaultValue={initial.whatsappNumber} label={copy.whatsapp} name="whatsappNumber" type="tel" />
      </div>

      <label className="block text-label-md font-semibold">
        {copy.address}
        <textarea className="form-input mt-2 min-h-28 resize-y py-3" defaultValue={initial.address} maxLength={500} name="address" />
      </label>

      <p className="text-body-sm text-on-surface-variant">{copy.hint}</p>
      {state.error ? <p className="rounded-lg bg-error-container px-4 py-3 text-body-sm font-semibold text-on-error-container" role="alert">{state.error}</p> : null}
      {state.saved && !dirty ? <p className="rounded-lg bg-status-ready/15 px-4 py-3 text-body-sm font-semibold text-status-ready" role="status">{copy.saved}</p> : null}

      <div className={`flex flex-col-reverse gap-3 sm:flex-row sm:items-center ${secondary ? "sm:justify-between" : "sm:justify-end"}`}>
        {secondary ? <Link className="min-h-11 rounded-lg px-4 py-3 text-center text-label-md font-semibold text-on-surface-variant hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary" href={secondary.href}>{secondary.label}</Link> : null}
        <button className="min-h-12 rounded-lg bg-primary px-6 py-3 text-label-lg text-on-primary transition hover:bg-[#332b24] focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60" disabled={pending} type="submit">{pending ? copy.saving : copy.save}</button>
      </div>
    </form>
  );
}

function Field({ label, name, defaultValue, required, type = "text", autoComplete }: { label: string; name: string; defaultValue?: string; required?: boolean; type?: string; autoComplete?: string }) {
  return <label className="block text-label-md font-semibold">
    {label}
    <input autoComplete={autoComplete} className="form-input mt-2" defaultValue={defaultValue} maxLength={254} name={name} required={required} type={type} />
  </label>;
}
