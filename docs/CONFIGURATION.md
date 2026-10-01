# Installation configuration

Mendesk keeps product identity separate from store identity. Each deployed shop supplies its own store configuration and connects to its own Directus instance.

## Product configuration

`src/config/productConfig.ts` contains stable Mendesk product identity. The maker name and internal attribution remain `null` until the official `Incandi`/`Incamdi` spelling is confirmed. Customer-facing attribution is explicitly disabled.

## Store configuration contract

`loadStoreConfig` accepts these installation-owned values:

| Variable | Purpose | Example |
| --- | --- | --- |
| `MENDESK_STORE_ID` | Stable lowercase installation slug | `demo-atelier` |
| `MENDESK_STORE_NAME` | Primary visible shop name | `Demo Atelier` |
| `MENDESK_STORE_SHORT_NAME` | Compact/PWA shop name | `Demo` |
| `MENDESK_STORE_LOGO_PATH` | Root-relative public logo path | `/store/logo.svg` |
| `MENDESK_STORE_PANEL_URL` | Canonical panel URL used for deep links | `https://demo.example.com` |
| `MENDESK_STORE_REVIEW_URL` | Optional public review URL | `https://example.com/review` |
| `MENDESK_STORE_LOCALES` | Enabled locales currently implemented by the UI | `en,uk` |
| `MENDESK_STORE_DEFAULT_LOCALE` | Default locale from the enabled set | `en` |
| `MENDESK_STORE_TIME_ZONE` | IANA workshop time zone | `Europe/Dublin` |
| `MENDESK_STORE_CURRENCY` | ISO-style uppercase currency code | `EUR` |
| `MENDESK_STORE_CALLING_CODE` | Default digits without `+` or `00` | `353` |

No real environment file is committed. Deployment secrets and Directus connection details remain outside Git.

## Demonstration installation

The planned demo will use a dedicated Directus instance and fictional records only. Its configuration must use a neutral fictional shop identity until a real demonstration brand is approved. It must never point at Koko Atelier infrastructure, users, files or customer data.
