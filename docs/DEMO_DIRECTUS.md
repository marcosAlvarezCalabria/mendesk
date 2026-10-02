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

## Provision the versioned base schema

The base schema is derived from Mendesk's application contracts, not from customer data or a database dump. It creates the `clients`, `orders`, `garments`, `payments`, `appointments`, `order_sequences` and singleton `shop_settings` collections.

Set `DIRECTUS_URL` and `DIRECTUS_ADMIN_TOKEN` in your shell, then run:

```text
pnpm directus:schema:audit
pnpm directus:schema:apply
pnpm directus:schema:audit
```

The audit command is read-only. Apply refuses to write when an existing field has an incompatible type and verifies the complete schema after provisioning. Plain HTTP is accepted only for loopback URLs; a remote Directus URL must use HTTPS.

This step does not create roles, users or demonstration records. Those remain separate provisioning changes so access control and fictional content can be reviewed independently.

## Provision demo application access

After the base schema is clean, provision the non-administrator role and policy used by Mendesk:

```text
pnpm directus:access:audit
pnpm directus:access:apply
pnpm directus:access:audit
```

The policy has no administrator or Directus Studio access. It grants only the collection actions exercised by the Mendesk application. In particular, it does not allow deleting clients or orders, updating payments, changing shop configuration, or managing users and schema.

Directus 12 Core treats field-level restrictions and item filters as licensed custom permission rules. This provisioner therefore grants all fields inside each allowed action while keeping actions and collections restricted. That is acceptable for the isolated single-shop demo, where the instance stores only Mendesk data. Before commercial rollout, confirm Directus licensing or Open Innovation Grant eligibility if stricter field- or row-level rules are required.

This step does not create accounts. Demo users and their credentials are provisioned separately so passwords never enter Git history.

## Provision the demo staff account

Choose a dedicated email address and a unique password of at least 16 characters containing upper- and lowercase letters, a number and a symbol. Supply them only through the process environment together with the Directus administrator connection:

```text
pnpm directus:user:audit
pnpm directus:user:apply
pnpm directus:user:audit
```

The commands require `DEMO_STAFF_EMAIL`; apply additionally requires `DEMO_STAFF_PASSWORD`. Do not place either value in a tracked file or in command-line arguments. The provisioner creates only a missing account, assigns `Mendesk Demo Staff`, and never prints credentials. If that email already belongs to an inactive account or another role, it stops without changing the user. Re-running apply does not reset the password.

## Load fictional demonstration records

Choose the calendar date around which the demonstration should look active and expose it as `DEMO_SEED_DATE` in `YYYY-MM-DD` format. Then run:

```text
pnpm directus:seed:audit
pnpm directus:seed:apply
pnpm directus:seed:audit
```

The deterministic fixture contains 24 synthetic clients, 36 orders, their garments and payments, plus 16 appointments spanning past and future states. It contains no copied customer details or photographs. Names and telephone numbers are generated fixtures and must never be used for real messaging. The provisioner creates only missing records with Mendesk-owned deterministic IDs; it never updates or deletes existing records.

## Stop safely

Run `pnpm demo:down`. This stops the containers but retains the named volumes and their data. No reset or volume-deletion command is provided because deleting the database should always be a deliberate manual operation.

## Security boundary

- `.env.demo` is ignored by Git and generated with independent random secrets.
- The generator refuses to overwrite an existing credential file.
- No Koko infrastructure, customer records, photographs, tokens or environment files are used.
- The runtime disables Directus telemetry.
- Production requires HTTPS, external encrypted backups, monitoring, operating-system hardening and a data-processing agreement; this local Compose file does not claim to provide those controls.
