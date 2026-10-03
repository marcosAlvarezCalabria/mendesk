"use client";

import { ShopProfileForm, type ShopProfileFormCopy } from "@/app/_ui/ShopProfileForm";
import { completeSetupAction } from "./actions";
import type { ShopProfile } from "@/domain/entities/ShopProfile";

type Copy = ShopProfileFormCopy & Record<"title" | "intro" | "skip", string>;

export function SetupForm({ copy, initial, nextPath }: { copy: Copy; initial: ShopProfile | null; nextPath: string }) {
  const profile = initial ?? { name: "", contactEmail: "", contactPhone: "" };
  return <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 sm:py-12">
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 text-label-md font-bold text-secondary">Mendesk</p>
      <h1 className="max-w-xl text-balance text-headline-lg">{copy.title}</h1>
      <p className="mt-3 max-w-[65ch] text-body-md text-on-surface-variant">{copy.intro}</p>
      <div className="mt-8">
        <ShopProfileForm action={completeSetupAction} copy={copy} hiddenFields={{ next: nextPath }} initial={profile} secondary={{ href: nextPath, label: copy.skip }} />
      </div>
    </div>
  </main>;
}
