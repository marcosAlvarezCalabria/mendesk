# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Mendesk serves owners and staff of independent alterations and tailoring workshops. They use it during daily workshop work, primarily on mobile and tablet, to move quickly between clients, garments, orders, payments and appointments. A customer may temporarily use the guided intake surface on the same device, without access to private workshop data.

## Product Purpose

Mendesk replaces paper-based workshop administration with one focused operational workspace. It supports the complete alteration workflow: register a client with consent, create a multi-garment order, record photos and measurements, take payments, track due dates and status, print one ticket per garment, manage fittings and contact the client through prepared WhatsApp messages.

Success means a workshop can run its daily work reliably without exposing staff to Directus administration or forcing the business into a generic retail workflow.

## Positioning

Mendesk is built around the physical lifecycle of an alteration job rather than around generic CRM, project-management or point-of-sale concepts. The order, its garments, due date, payment balance, physical tickets and next customer action stay connected throughout the workflow.

Each shop owns an independent installation and data boundary. Mendesk provides the product; the shop remains the primary visible identity.

## Operating Context

- Daily use beside the cutting and sewing workspace, often on a phone or tablet.
- Directus provides authentication, structured data and private file storage behind application ports.
- Thermal Bluetooth printing produces one physical ticket per garment with a protected deep-link QR.
- WhatsApp communication remains semi-automatic: Mendesk prepares a message and the operator chooses whether to send it.
- Koko Atelier is one independent installation and a functional reference, not a dependency or tenant.
- A separate Directus demonstration installation will contain only fictional clients, garments, orders, payments and appointments.
- The demonstration uses the real Mendesk application and workflows, not a separate marketing mockup.

## Capabilities and Constraints

- Next.js 16, React 19, strict TypeScript, Tailwind CSS, Vitest and pnpm.
- Clean Architecture separates domain, application, infrastructure, composition and delivery layers.
- Current domain contracts for orders, garments, payments, appointments, statuses and numbering remain stable unless explicitly revised.
- Every shop has its own Directus instance, database, files, users, configuration and deployment.
- Multi-tenancy and shared shop data are out of scope.
- Store name, logo, URLs, locale choices and customer-facing wording must become typed installation configuration.
- No deployment, production change or Directus write occurs without explicit authorization for that environment.
- English and Ukrainian are present in the inherited interface. The long-term language set per installation remains an open product decision.
- EUR, Irish phone normalization and `Europe/Dublin` are inherited operational assumptions that must be classified as installation defaults rather than universal Mendesk rules.

## Brand Commitments

- Product name: Mendesk.
- The configured shop name and logo are the primary identity inside each installation.
- A discreet Mendesk attribution may appear on internal product surfaces.
- Product or maker attribution must not appear in customer messages or printed tickets unless explicitly approved.
- The maker spelling is confirmed as `Incamdi`. Its future attribution must remain discreet and internal to the panel by default.
- `Nika` is an unconfirmed future shop name and must not be encoded as product truth.

## Evidence on Hand

- The functional baseline derives from the verified tracked tree of Koko Panel at commit `95f3ce624cee9815732fed991c21d63906f8c6b2`.
- The imported baseline passes 210 test files with 1,401 tests and a Next.js production build.
- The repository contains working domain, application, Directus adapter, PWA, printing, WhatsApp, appointment and statistics flows.
- There are no Mendesk customer testimonials, commercial claims, usage metrics or approved logo assets yet. Future presentation work must not fabricate them.

## Product Principles

1. The workshop is the hero; Mendesk is the quiet operating system behind it.
2. The next safe action must be obvious during busy, hands-on work.
3. Store data and infrastructure remain isolated by installation.
4. Customer communication stays intentional, reviewable and free of product advertising by default.
5. Reuse proven workflow behaviour while extracting store identity deliberately and visibly.

## Accessibility & Inclusion

The interface must preserve keyboard access, visible focus, readable hierarchy, non-color status cues and at least 44-pixel touch targets. Customer-facing intake must remain simple, private and usable without technical knowledge.
