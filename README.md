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

The complete repeatable shop onboarding, deployment, validation and rollback process is documented in Spanish in [docs/CLIENT_INSTALLATION_RUNBOOK.md](docs/CLIENT_INSTALLATION_RUNBOOK.md).

## Current migration state

Mendesk has an independent baseline, typed installation configuration, isolated Directus provisioning and deterministic fictional demo data. First login completes the workshop profile through `/setup`; staff can later edit the business name and contact details in `/settings`. The saved workshop name becomes the primary runtime identity in the authenticated panel, tickets and prepared WhatsApp messages, while the installation baseline remains the safe fallback.

The repository's demo Compose package is suitable for local development and isolated test demonstrations. It is not yet the approved commercial production package for a paying client. Logo upload, PWA identity and a least-privilege kiosk credential remain separate follow-up work.

See [docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md) for scope and sequencing.
