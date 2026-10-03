import { KioskForm } from "@/app/kiosk/KioskForm";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { t } from "@/i18n/t";
import { getCurrentStoreIdentity } from "@/composition/currentStoreIdentity";

export default async function KioskPage() {
  const [locale, identity] = await Promise.all([getLocale(), getCurrentStoreIdentity()]);
  const dict = dictionaries[locale];

  return (
    <KioskForm
      storeName={identity.name}
      texts={{
        successTitle: t(dict, "kiosk.successTitle"),
        successSubtitle: t(dict, "kiosk.successSubtitle"),
        registerAnother: t(dict, "kiosk.registerAnother"),
        title: t(dict, "kiosk.title"),
        subtitle: t(dict, "kiosk.subtitle"),
        name: t(dict, "kiosk.name"),
        phone: t(dict, "kiosk.phone"),
        gdpr: t(dict, "kiosk.gdpr", { storeName: identity.name }),
        submit: t(dict, "kiosk.submit"),
        submitting: t(dict, "kiosk.submitting"),
        offline: t(dict, "kiosk.offline"),
        errors: {
          consent: t(dict, "kiosk.errors.consent"),
          phone: t(dict, "kiosk.errors.phone"),
          name: t(dict, "kiosk.errors.name"),
          unavailable: t(dict, "kiosk.errors.unavailable"),
          unknown: t(dict, "kiosk.errors.unknown"),
          saveFailed: t(dict, "kiosk.error"),
        },
      }}
    />
  );
}
