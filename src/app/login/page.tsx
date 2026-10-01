import { LoginForm } from "@/app/login/LoginForm";
import { safeNextPath } from "@/app/safeNextPath";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { t } from "@/i18n/t";
import { storeConfig } from "@/config/currentStore";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const locale = await getLocale();
  const dict = dictionaries[locale];

  return (
    <LoginForm
      identity={storeConfig.identity}
      nextPath={safeNextPath(params.next)}
      texts={{
        title: t(dict, "login.title"),
        subtitle: t(dict, "login.subtitle"),
        email: t(dict, "login.email"),
        password: t(dict, "login.password"),
        submit: t(dict, "login.submit"),
        submitting: t(dict, "login.submitting"),
        error: t(dict, "login.error"),
      }}
    />
  );
}
