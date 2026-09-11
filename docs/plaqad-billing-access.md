# Plaqad suite billing in BSP

The prepaid invoice, usage markup and user usage pages use the signed-in human's
Plaqad Account token directly against central Auth. They do not use BSP machine
credentials. The BSP environment selector does not change their live suite scope.

The API's `FLEXPRICE_AUTH_PLAQAD_ALLOWED_USER_IDS` setting restricts this rollout to
explicitly approved central operators while retaining the mapped native BSP user
for tenant access. Each native API request checks live Super Admin status; Auth
owns its own Super Admin and configurable MFA gates for billing mutations. This
release does not change MFA enrollment or enforcement.

## Session recovery

Tokens stay in session storage. Valid expiry metadata is required before reusing
a token; near-expiry sessions share one refresh request. Railway is outside the
`.plaqad.com` cookie site, so an otherwise valid central session can have its
refresh cookie withheld by the browser. Failed refresh, invalid expiry responses,
network errors and server 401 responses start one top-level PKCE authorization
flow. The safe original page, query and fragment are restored after sign-in.
Interrupted writes are never automatically retried. An operator should review the
current record before repeating a save after reauthorization.

No session at first visit shows the sign-in screen with the requested destination
preserved. A 403 does not trigger automatic reauthorization. The callback consumes
one state/verifier pair and validates the returned token and expiry.

## Pricing behavior

Credit purchases remain $0.01 per credit. Usage markup affects the credits charged
for an operation: a $5.00 provider cost with 30% markup is $6.50, or 650 credits.
The preview uses integer arithmetic and rounds only the resulting credit charge
up to a whole credit, matching Auth's catalogue calculation.

The current legacy catalogue can have a null pricing policy and fixed credit
prices. A draft retains those fixed prices and existing class/SKU overrides by
default. Applying one percentage to all cost-based SKUs is an explicit option;
its preview clears overrides and converts positive-cost fixed items to markup.
Zero-cost fixed items keep their existing price. Saving creates a draft version;
a separate, reasoned action activates it. Opening a page or editing a preview
never changes the live catalogue.

## Usage meaning

Net usage credits are debits less actual consumption refunds. A later reporting
window can legitimately be negative when a refund relates to earlier usage.
Reservation releases do not count as consumption refunds. Plan-included and
plan-allowance operations, plan units and credit equivalents are separate usage
metrics; they are not revenue. Historical plan operations without actuals are
reported as a coverage gap. Provider costs and profit are unavailable until
reconciled cost evidence exists.

## Verification

Focused tests cover session expiry/cookie recovery, one redirect for concurrent
requests, state/return-path safety, no write replay, explicit catalogue changes,
exact credit arithmetic, and usage filters and coverage. TypeScript and the
production build run before a coordinated API/web deployment. Production smoke
checks use existing records and read-only requests; they do not create invoices,
activate pricing or send customer email.
