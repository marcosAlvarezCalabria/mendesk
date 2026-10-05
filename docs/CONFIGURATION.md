# Installation configuration

Mendesk keeps product identity separate from store identity. Each deployed shop supplies its own store configuration and connects to its own Directus instance.

## Product configuration

`src/config/productConfig.ts` contains stable Mendesk product identity. The official maker spelling is confirmed as `Incamdi`. The current maker name and internal attribution remain `null` until the discreet in-panel signature is implemented and reviewed. Customer-facing attribution remains explicitly disabled.

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
| `MENDESK_STORE_LOCALES` | Enabled locales currently implemented by the UI | `en,es,uk` |
| `MENDESK_STORE_DEFAULT_LOCALE` | Default locale from the enabled set | `en` |
| `MENDESK_STORE_TIME_ZONE` | IANA workshop time zone | `Europe/Dublin` |
| `MENDESK_STORE_CURRENCY` | ISO-style uppercase currency code | `EUR` |
| `MENDESK_STORE_CALLING_CODE` | Default digits without `+` or `00` | `353` |

No real environment file is committed. Deployment secrets and Directus connection details remain outside Git.

When no installation values are present, the application uses the visibly fictional `Demo Atelier` profile. This keeps local builds functional while making a missing real-store configuration obvious.

## Runtime workshop profile

The environment values above are the installation baseline. After a staff user signs in for the first time, `/setup` stores the editable workshop profile in the installation's Directus `shop_settings` singleton:

- business or workshop name;
- contact email;
- contact telephone;
- optional WhatsApp number;
- optional workshop address;
- setup completion time.

The same fields can be maintained later in `/settings`. The saved workshop name becomes the primary name used by the authenticated shell, page metadata, tickets and prepared WhatsApp messages. If Directus is temporarily unavailable, Mendesk falls back to `MENDESK_STORE_NAME` instead of blocking the panel.

Public pages have no staff session. They can load the saved workshop name only when the server has a valid `KIOSK_TOKEN` with the required installation-scoped permissions. Without it, login uses the baseline identity and kiosk registration is unavailable. Never use an administrator token for this value and never expose it to browser JavaScript.

The current PWA manifest, short name, offline identity and logo path still come from the installation baseline. They are not changed by `/settings` yet.

## Demonstration installation

The hosted test demo uses a dedicated Directus instance and fictional records only. Its configuration must use a neutral fictional shop identity until a real demonstration brand is approved. It must never point at Koko Atelier infrastructure, users, files or customer data.

The repository demo runtime remains a development/test package. Running it on an isolated test VPS does not make it the approved production package for a paying customer.
