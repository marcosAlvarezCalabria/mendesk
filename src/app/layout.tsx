import type { Metadata, Viewport } from "next";
import "./globals.css";
import { EB_Garamond, Nunito_Sans } from "next/font/google";
import { AppShell } from "@/app/_ui/AppShell";
import { LegacyPinStorageCleanup } from "@/app/LegacyPinStorageCleanup";
import { ServiceWorkerRegister } from "@/app/ServiceWorkerRegister";
import { logoutAction } from "@/app/dashboard/actions";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { t } from "@/i18n/t";
import { productConfig } from "@/config/productConfig";
import { storeConfig } from "@/config/currentStore";
import { getCurrentStoreIdentity } from "@/composition/currentStoreIdentity";

export async function generateMetadata(): Promise<Metadata> {
  const identity = await getCurrentStoreIdentity();
  return {
    title: `${identity.name} · ${productConfig.name}`,
    description: `Private workshop management for ${identity.name}.`,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: identity.shortName, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: "#211D18",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin", "cyrillic"],
  weight: "variable",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
  fallback: ["Georgia", "serif"],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, identity] = await Promise.all([getLocale(), getCurrentStoreIdentity()]);
  const dict = dictionaries[locale];

  return (
    <html className={`${nunitoSans.variable} ${ebGaramond.variable}`} lang={locale}>
      <body>
        <ServiceWorkerRegister />
        <LegacyPinStorageCleanup />
        <AppShell
          availableLocales={storeConfig.localization.locales}
          currentLocale={locale}
          identity={identity}
          labels={{
            mainNavigation: t(dict, "nav.mainNavigation"),
            language: t(dict, "nav.language"),
            orders: t(dict, "nav.orders"),
            add: t(dict, "nav.addNew"),
            clients: t(dict, "clients.title"),
            appointments: t(dict, "appointments.title"),
            stats: t(dict, "stats.title"),
            settings: t(dict, "nav.settings"),
            logout: t(dict, "nav.logOut"),
          }}
          logoutAction={logoutAction}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
