# Plaqad prepaid invoices

The native BSP screen is `/billing/prepaid-invoices`. A saved invoice opens directly at
`/billing/prepaid-invoices/:invoiceId`; its provider invoice links to the existing BSP
`/billing/invoices/:providerInvoiceId` screen once checkout has been prepared.

The screen calls Plaqad Auth at `VITE_PLAQAD_AUTH_URL` using the current Plaqad human
session. It neither uses an admin API key nor forwards the BSP environment selector.
The live-suite scope is stated on screen. Auth remains responsible for live Super Admin
and MFA checks, recipient ownership, exact amounts, invoice status, and payment reconciliation.

## Operator flow

1. Create a draft for the recipient email, credit quantity or eligible plan, currency and due date.
   An agreed amount is supported in exact minor units; 25,000 credits at NGN 331,494.06 is
   `amountMinor: 33149406`. Saving creates no payment and sends no email.
2. Download its PDF and optionally send a copy only to named review recipients. The customer
   cannot be included in review recipients.
3. Issue the reviewed invoice. This action sends no email.
4. For an existing customer, enter their verified owner workspace ID and choose **Prepare
   Paystack link**. The server creates the unpaid provider invoice and durable hosted checkout.
   The screen then displays the stored checkout link; refreshing does not create another charge.
5. Sending the issued invoice to the customer is a separate, explicitly confirmed action.

`VITE_PLAQAD_AUTH_ENABLED=true` exposes the prepaid invoice navigation. Plan choices come
from the public-plan projection and exclude preview-only plans. The optional 14-day Intel
promotion is represented by its approved plan lookup key and is enforced by the Auth backend.

## Required Auth contracts

All paths begin `/api/v1/admin/billing/invoices`:

- `GET /` lists invoices; `GET /:id` returns `{invoice, claimUrl, checkoutUrl}`.
- `POST /` snapshots a draft with an idempotency key.
- `POST /:id/issue` issues without email.
- `POST /:id/prepare-payment` with `{workspaceId}` prepares the verified customer checkout.
- `POST /:id/send` uses `{audience:'review',reviewEmails:[...]}` or `{audience:'recipient'}`.
- `POST /:id/revoke` revokes an unpaid invoice; `GET /:id/pdf` returns the authenticated PDF.

The view uses `invoice.providerInvoiceId` for the native BSP link and accepts the checkout
URL at the top level or within the invoice. Only HTTPS Paystack/Stripe checkout links are rendered.

## Verification and deployment

Run with Bun:

```sh
bun run test --run src/api/PlaqadBillingApi.test.ts src/pages/plaqad-billing/invoices.test.ts src/pages/plaqad-billing/PrepaidInvoicesPage.test.tsx
bun run build
```

Deployment is owned by the independent `flexprice-railway` checkout. Its `railway.web.toml`
selects `Dockerfile.web`, which pins this repo using `FLEXPRICE_FRONT_SOURCE_REF`. After
review, push the frontend commit, update that source pin, and deploy only `flexprice-web`
through the established Railway workflow. Deploy the Auth invoice schema/routes first.
No production invoice, payment link, email or pricing policy is changed by these tests.
