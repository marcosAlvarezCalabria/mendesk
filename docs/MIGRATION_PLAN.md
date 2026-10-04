# Mendesk migration plan

## Audited reference

The functional baseline was exported from the tracked tree at `koko_panel` remote reference `origin/main`, commit `95f3ce624cee9815732fed991c21d63906f8c6b2`.

The active Koko working tree was deliberately not used: it was on `codex/r19-qa-dashboard`, diverged from `origin/main`, and contained tracked modifications plus untracked material. The reference repository was not changed.

The clean baseline passed:

- `pnpm run check`: 210 test files and 1,401 tests.
- `pnpm build`: successful Next.js 16 production build.

## Delivered sequence

1. Completed: independent sanitized baseline with new Git history and no copied environment, customer or build material.
2. Completed: typed product and installation configuration.
3. Completed: Mendesk-scoped cookies, cache, broadcast channel, drafts and idempotency storage.
4. Completed: configurable installation identity for the shell, login metadata, tickets, QR links, WhatsApp messages, review links and consent copy.
5. Completed: isolated Directus/PostgreSQL demo runtime, versioned schema, application policy, demo user and deterministic fictional records.
6. Completed: repeatable single-store frontend deployment contract, HTTPS runbook, first-run `/setup` and editable `/settings` workshop profile.
7. Completed through PR #18: the saved `shop_settings.name` becomes the primary runtime workshop name after authentication, with the typed installation identity as fallback.

## Remaining productization work

- Configure a dedicated least-privilege `KIOSK_TOKEN` per installation so public login and kiosk surfaces can read the saved workshop name and kiosk intake can operate without a staff session.
- Add reviewed logo upload/selection and apply it to the panel and PWA assets.
- Make the PWA manifest, short name and offline identity follow the approved installation branding.
- Approve a production Directus package for paying clients, including SMTP, encrypted backups, monitoring, restore tests and legal controls.
- Add the discreet internal signature only after its placement is explicitly approved.

## Reusable without domain changes

- Domain entities and value objects for clients, orders, garments, payments and appointments.
- Application use cases, ports, DTOs, idempotency and reconciliation rules.
- Directus adapters and composition boundaries, once runtime configuration is installation-owned.
- UI flows, accessibility behaviour, offline handling, search, statistics and printing ports.
- Test suite and Clean Architecture directory structure.

## Store-specific coupling to extract deliberately

- Visible Koko name, logo, metadata and PWA icons.
- Ticket header, canonical QR base URL, WhatsApp sender name, review URL and GDPR copy.
- Cookie names for session, refresh and locale.
- PWA cache name, BroadcastChannel name, draft keys and idempotency slots.
- Cloudflare/Vinext deployment details and Koko Directus URL; these are excluded from the baseline.
- Historical Koko documents, mockups and operational evidence; these are reference-only and excluded.

## Confirmed decisions

- The official maker spelling is `Incamdi`.
- Each shop remains an independent installation with its own Directus, database, files, users and deployment; multi-tenancy remains out of scope.
- The workshop is the primary visible identity. Mendesk/Incamdi attribution is not included in customer tickets or messages by default.
- The saved workshop name and contact details are entered during `/setup` and can be maintained in `/settings`.

## Decisions still required

- Approve the exact placement of the discreet internal signature `Powered by Mendesk · by Incamdi`.
- Approve each installation's logo assets, supported languages, panel URL, review URL and customer-message wording.
- Confirm the future shop's commercial name; `Nika` remains a placeholder and is not encoded.
