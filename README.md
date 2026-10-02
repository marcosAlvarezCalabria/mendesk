# Mendesk

Mendesk is an independent management product for alterations and tailoring workshops.

This repository starts from the proven behaviour and Clean Architecture of the Koko Atelier panel, while keeping its own Git history, configuration and release lifecycle. Each shop is deployed as an independent installation with its own Directus instance, database, files and users. Multi-tenancy is intentionally out of scope.

## Development

- Node.js compatible with Next.js 16
- pnpm 9.12.0
- `pnpm install --frozen-lockfile`
- `pnpm run check`
- `pnpm build`

No environment file, credential, customer data, upload, log, cache or build output is part of this repository. The repository contains a credential-free local demonstration runtime; see [docs/DEMO_DIRECTUS.md](docs/DEMO_DIRECTUS.md).

The frontend has a credential-free, installation-isolated container package documented in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Public access requires a separate HTTPS reverse-proxy configuration for the chosen installation hostname.

## Current migration state

Mendesk has an independent baseline, typed installation identity and configurable customer-facing store branding. The local demonstration runtime is intended for development only and is not a production deployment.

See [docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md) for scope and sequencing.
