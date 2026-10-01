import { OfflineRetryLink } from "@/app/offline/OfflineRetryLink";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { t } from "@/i18n/t";

export default async function OfflinePage() {
  const locale = await getLocale();
  const dict = dictionaries[locale];

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-on-surface sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center">
        <section className="w-full rounded-[10px] border border-outline-variant bg-surface-container-lowest p-6 shadow-sm" aria-labelledby="offline-heading">
          <p className="font-wordmark text-wordmark text-secondary">Koko Atelier</p>
          <h1 id="offline-heading" className="mt-4 text-headline-lg text-on-surface">
            {t(dict, "offline.title")}
          </h1>
          <p className="mt-3 max-w-prose text-body-md text-on-surface-variant">{t(dict, "offline.description")}</p>
          <OfflineRetryLink label={t(dict, "offline.tryAgain")} />
        </section>
      </div>
    </main>
  );
}
