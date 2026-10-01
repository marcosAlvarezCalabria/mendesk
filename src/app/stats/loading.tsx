import { AppHeader } from "@/app/_ui/AppHeader";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { t } from "@/i18n/t";

export default async function StatsLoading() {
  const locale = await getLocale();
  const dict = dictionaries[locale];

  return (
    <main className="min-h-screen bg-background text-on-surface" aria-busy="true" aria-label={t(dict, "stats.loading")}>
      <AppHeader title={t(dict, "stats.title")} />
      <div className="mx-auto w-full max-w-[720px] animate-pulse px-margin-mobile pb-24 pt-3">
        <div className="flex gap-1">{Array.from({ length: 4 }, (_, index) => <span className="h-11 w-20 rounded-full bg-surface-container" key={index} />)}</div>
        <section className="mt-3 rounded-xl bg-surface-container-lowest p-4 shadow-[0_8px_24px_rgba(31,27,23,0.07)]">
          <div className="h-4 w-28 rounded bg-surface-container" />
          <div className="mt-3 h-10 w-40 rounded bg-surface-container" />
          <div className="mt-6 h-24 rounded-lg bg-surface-container-low" />
          <div className="mt-4 grid grid-cols-2 gap-3"><div className="h-12 rounded bg-surface-container-low" /><div className="h-12 rounded bg-surface-container-low" /></div>
        </section>
        <div className="mt-3 h-36 rounded-xl bg-surface-container-lowest shadow-[0_8px_24px_rgba(31,27,23,0.06)]" />
      </div>
    </main>
  );
}
