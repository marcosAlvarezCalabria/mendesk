import React from "react";
import { getLocale } from "@/i18n/getLocale";
import { dictionaries } from "@/i18n/dictionaries";

export default async function OrdersLoading() {
  const locale = await getLocale();
  return <div role="status" aria-busy="true" className="mx-auto w-full max-w-[640px] space-y-4 px-4 py-6">
    <p>{dictionaries[locale]["orders.overview.loading"]}</p>
    <div aria-hidden="true" className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map(key => <div key={key} className="h-24 rounded-lg bg-surface-container-low" />)}
    </div>
    {[0, 1, 2].map(key => <div aria-hidden="true" key={key} className="h-28 rounded-lg bg-surface-container-low" />)}
  </div>;
}
