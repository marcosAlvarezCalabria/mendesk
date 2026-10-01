# Mendesk migration plan

## Audited reference

The functional baseline was exported from the tracked tree at `koko_panel` remote reference `origin/main`, commit `95f3ce624cee9815732fed991c21d63906f8c6b2`.

The active Koko working tree was deliberately not used: it was on `codex/r19-qa-dashboard`, diverged from `origin/main`, and contained tracked modifications plus untracked material. The reference repository was not changed.

The clean baseline passed:

- `pnpm run check`: 210 test files and 1,401 tests.
- `pnpm build`: successful Next.js 16 production build.

## PR sequence

1. Independent sanitized baseline: new Git history, no remote, no environment files or deployment configuration.
2. Typed product and store configuration.
3. Configurable store identity across shell, login, metadata and PWA.
4. Configurable tickets, QR links, WhatsApp messages, review links and consent copy.
5. Mendesk-scoped cookies, PWA cache, broadcast channel, drafts and idempotency storage.
6. Repeatable single-store installation contract without shared data or multi-tenancy.

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

## Decisions still required

- Confirm the official maker spelling: `Incandi` or `Incamdi`.
- Confirm whether the discreet internal signature will read exactly `Powered by Mendesk · by …` and where it may appear.
- Confirm each installation's shop name, logo assets, supported languages, panel base URL, review URL and customer-message wording.
- Confirm the future shop's commercial name; `Nika` remains a placeholder and is not encoded.
