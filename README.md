# Mendesk

Mendesk is an independent management product for alterations and tailoring workshops.

This repository starts from the proven behaviour and Clean Architecture of the Koko Atelier panel, while keeping its own Git history, configuration and release lifecycle. Each shop is deployed as an independent installation with its own Directus instance, database, files and users. Multi-tenancy is intentionally out of scope.

## Development

- Node.js compatible with Next.js 16
- pnpm 9.12.0
- `pnpm install --frozen-lockfile`
- `pnpm run check`
- `pnpm build`

No environment file, credential, customer data, upload, log, cache, build output or deployment configuration is part of this repository.

## Current migration state

The first change establishes a safe, functional and independently versioned baseline. Store-specific Koko references remain temporarily in application code and tests so they can be extracted deliberately in later, focused changes. Nothing in this repository is configured for deployment.

See [docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md) for scope and sequencing.
