# Local Directus demonstration runtime

This runtime creates an independent local Directus and PostgreSQL installation for fictional Mendesk demonstration data. It is not a production deployment and does not contain a schema or records until the corresponding provisioning steps are run.

## Start from an empty machine

Requirements: Docker Desktop with Docker Compose, Node.js and pnpm.

1. Run `pnpm demo:env` once.
2. Open `.env.demo` locally to retrieve the generated Directus administrator credentials. Do not share or commit this file.
3. Run `pnpm demo:up`.
4. Open `http://localhost:8055` for Directus Studio.
5. Run `pnpm demo:status` to inspect container health. Directus uses its public ping endpoint for liveness; authenticated schema and data audits are separate commands.

The Directus API is bound only to loopback. PostgreSQL has no host port and is reachable only by the Directus container. Database data, uploads and extensions use separate named Docker volumes.

## Connect Mendesk locally

Create a separate ignored application environment file with:

```text
DIRECTUS_URL=http://localhost:8055
```

Application login will become functional after the schema, roles and fictional demonstration users are provisioned in the next changes.

## Stop safely

Run `pnpm demo:down`. This stops the containers but retains the named volumes and their data. No reset or volume-deletion command is provided because deleting the database should always be a deliberate manual operation.

## Security boundary

- `.env.demo` is ignored by Git and generated with independent random secrets.
- The generator refuses to overwrite an existing credential file.
- No Koko infrastructure, customer records, photographs, tokens or environment files are used.
- The runtime disables Directus telemetry.
- Production requires HTTPS, external encrypted backups, monitoring, operating-system hardening and a data-processing agreement; this local Compose file does not claim to provide those controls.
