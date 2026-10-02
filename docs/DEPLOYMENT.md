# Independent installation deployment

This package runs the Mendesk frontend as a non-root container. It binds only to the server loopback interface and reaches the installation's Directus service over a private Docker network. PostgreSQL and Directus do not need public ports.

## Requirements

- Docker Engine with Compose
- an existing, installation-specific Directus network
- a public domain or subdomain pointing to the server
- Nginx (or another reverse proxy) terminating HTTPS

Do not expose this deployment over plain HTTP. Production sessions use secure cookies, so the public `MENDESK_STORE_PANEL_URL` must use HTTPS.

## Configuration

Copy `infra/deploy/deployment.env.template` to a server-owned file named `deployment.env`, outside the Git checkout. Replace the example panel URL with the real HTTPS URL. Keep secrets and per-installation values out of Git.

The default internal URL, `http://directus:8055`, assumes the Directus service has the network alias `directus` on `mendesk-demo_default`. A different installation can set both `MENDESK_DIRECTUS_NETWORK` and `DIRECTUS_URL` without changing source code.

## Start and verify

From the checked-out release:

```sh
docker compose --env-file /secure/path/deployment.env -f infra/deploy/compose.yaml up -d --build --wait
docker compose --env-file /secure/path/deployment.env -f infra/deploy/compose.yaml ps
curl --fail --silent --show-error http://127.0.0.1:3000/login >/dev/null
```

Only after the loopback health check succeeds should Nginx route the chosen HTTPS hostname to `http://127.0.0.1:3000`.

## Rollback

Keep the previous Git commit or image available. To roll back, check out the last verified release and rebuild the app service with the same external `deployment.env`. The Directus database and uploads are not part of this frontend container and must not be deleted during a frontend rollback.

## First-setup troubleshooting

Directus singletons must be initialized with `updateSingleton`, including every required installation field. A normal item creation request fails with `Route /shop_settings doesn't exist`; updating an empty singleton without its required baseline fields fails validation.

This affected the first-setup flow in revisions `13acb9c` and `1075e6d` on 2026-10-02. The regression test for `DirectusShopProfileRepository` covers both an empty virtual singleton (`id: null`) and an existing persisted singleton. A frontend rollback does not alter `shop_settings` data.
