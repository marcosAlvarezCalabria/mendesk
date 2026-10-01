# Mendesk repository rules

## Product boundary

Mendesk is a reusable management product for alterations and tailoring workshops. Every shop is an independent installation with its own Directus instance, database, file storage, users and deployment. Do not introduce multi-tenancy unless it is explicitly approved.

The Koko Atelier repository is reference-only. Never write to it, import its Git history or configure Mendesk to depend on it.

## Architecture and stack

- Next.js 16, React 19 and strict TypeScript.
- Tailwind CSS, Vitest and pnpm.
- Preserve the Clean Architecture boundaries under `src/domain`, `src/application`, `src/infrastructure`, `src/composition` and `src/app`.
- Keep business logic pure and isolate Directus behind application ports.

## Working agreement

- Work in small, reviewable changes with tests.
- A change is complete only when `pnpm run check` and `pnpm build` pass.
- Never commit `.env*`, credentials, tokens, sessions, customer data, photographs, uploads, logs, caches, build outputs, `node_modules` or temporary artifacts.
- Do not deploy, provision infrastructure, write to Directus or touch production without explicit authorization.
- Do not perform blind global replacements of store or product names. Treat visual identity, technical identifiers, domain contracts, browser storage, cookies, customer messages and documentation separately.
- Code, identifiers and technical comments are written in English. User-facing language decisions remain installation-specific.

## Brand rules

- The product name is Mendesk.
- The shop name and logo must become configuration, with the shop as the primary visible identity.
- Do not add the provisional maker signature until its official spelling is confirmed.
- Do not place a Mendesk or maker signature in customer-facing messages or tickets without an explicit product decision.
- Koko Atelier and any future shop are independent installations, not tenants in a shared runtime.
