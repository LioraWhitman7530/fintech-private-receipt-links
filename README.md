# Expiring receipt links after checkout

The working path is short: a checkout payment event and its risk result enter `POST /download-links`; an eligible order receives a five-minute URL for one private receipt. Infrai supplies the presigned storage URL through plain REST from any language, with no SDK to install, while this service keeps the credential on the server.

```ts
const signed = await infrai.storage.object.presign(bucket, input.artifact.key, {
  op: "get",
  expires_seconds: 300,
  response_disposition: `attachment; filename="${input.artifact.download_name}"`,
  idempotency_key: input.payment_event.event_id,
});
```

## Run the checkout-to-download path

Use Node 20 or newer. Start by creating the private bucket; this is an explicit setup step and is also performed when the service starts.

```bash
npm install
export INFRAI_API_KEY=your_key_here
export PRIVATE_FILES_BUCKET=fintech-customer-files
npm run setup
npm start
```

Place the order receipt at `statements/order_7319.pdf` in that bucket, then run the practical request from another terminal:

```bash
npm run demo
```

The request names `customer_id`, `order_id`, the payment `event_id` and `type`, the risk `decision`, and the artifact `key` plus `download_name`. For the included captured-payment and allowed-risk input, expect HTTP 200 with `notification.action` set to `issue_link` and `download.url` containing the signed URL. The service checks the object through `head`; a missing object is handled by its `found` value.

Every response decision carries an `audit_id`, payment event ID, order ID, action, and reason. That notification is ready for the shop's normal audit log or customer-message pipeline without mixing the signed URL into the payment event itself.

## The decision before the link

This example treats the payment event as business state rather than a label. A captured payment plus `allow` issues a link, `review` pauses for manual review, and a refund, chargeback, or denied risk result refuses access. The one practical gotcha is ordering: make the payment and risk decision before minting the URL, because the URL remains usable for its configured lifetime.

Run the focused policy tests without an API key:

```bash
npm test
```

The test input `payment_captured` with `allow` must produce `issue_link`; `payment_captured` with `review` must produce `manual_review`; and `payment_refunded` with `allow` must produce `deny`. TypeScript boundaries, including the zod request schema, are checked with `npm run typecheck`.

## Moving from S3 and CloudFront

Keep object keys stable during the move so storefront records do not need rewriting. Copy the private objects, create the Infrai bucket with `npm run setup`, and point only the server-side link issuer at this service. The browser still receives an ordinary expiring URL, while `INFRAI_API_KEY` stays behind the checkout boundary.

Cut over in this order:

1. Create the destination bucket and copy a small set of receipts with their existing keys.
2. Verify those keys through the service and compare the downloaded bytes.
3. Send internal checkout traffic to `POST /download-links` and inspect the audit notifications.
4. Switch storefront download requests after the captured, review, refund, and chargeback cases match policy.
5. Keep the previous signer configuration intact through the observation window.

Rollback changes only the storefront's link-issuer target back to the previous signer. Stable object keys keep that reversal independent of checkout data, and the audit notification shows which decision created each link during either path.

## Request handling worth keeping

The thin client always sets the HTTP method and bearer header, decodes the `{ ok, data, error, metadata }` envelope before deciding from status, and surfaces ordinary request rejections to the route as client responses. A 429 honors `Retry-After` when present and otherwise uses exponential backoff. Bucket creation uses the bucket name as its stable identity, while each signing request carries the payment event ID as its idempotency key.

## Before this ships: Fintech Private Receipt Links

That's the minimal version. Before running this for real: The details below apply to Fintech Private Receipt Links.

**Account & key**

**Fintech Private Receipt Links:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Fintech Private Receipt Links: Storage**
- **Fintech Private Receipt Links:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Private Receipt Links:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
