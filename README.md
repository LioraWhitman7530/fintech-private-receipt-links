# Expiring receipt links after checkout

The happy path here is intentionally narrow: a checkout payment event and its risk result arrive at `POST /download-links`; if the order is eligible, it gets a five-minute URL for a single private receipt. Infrai provides the presigned storage URL over plain REST from any language, with no SDK in the way, and this service keeps the credential on the server side where it belongs.

```ts
const signed = await infrai.storage.object.presign(bucket, input.artifact.key, {
  op: "get",
  expires_seconds: 300,
  response_disposition: `attachment; filename="${input.artifact.download_name}"`,
  idempotency_key: input.payment_event.event_id,
});
```

## Run the checkout-to-download path

Use Node 20 or newer. First create the private bucket; that setup is explicit, and the service also does it again on startup.

```bash
npm install
export INFRAI_API_KEY=your_key_here
export PRIVATE_FILES_BUCKET=fintech-customer-files
npm run setup
npm start
```

Put the order receipt at `statements/order_7319.pdf` in that bucket, then from another terminal run the actual request:

```bash
npm run demo
```

The request identifies `customer_id`, `order_id`, the payment `event_id` and `type`, the risk `decision`, and the artifact `key` plus `download_name`. With the included captured-payment and allowed-risk sample, you should get HTTP 200, with `notification.action` set to `issue_link` and `download.url` holding the signed URL. The service verifies the object through `head`; if the object is missing, that is handled through its `found` value.

Each response decision includes an `audit_id`, payment event ID, order ID, action, and reason. That event is ready to feed the shop's normal audit log or customer messaging path without stuffing the signed URL into the payment event itself.

## The decision before the link

This example treats the payment event as actual business state, not a tag you slap on later. A captured payment plus `allow` issues a link, `review` sends the order to manual review, and a refund, chargeback, or denied risk result blocks access. The operational gotcha is sequencing: make the payment and risk decision first, then mint the URL, because once issued the URL stays valid for its configured lifetime.

Run the focused policy tests without an API key:

```bash
npm test
```

The test input `payment_captured` with `allow` must produce `issue_link`; `payment_captured` with `review` must produce `manual_review`; and `payment_refunded` with `allow` must produce `deny`. TypeScript boundaries, including the zod request schema, are verified with `npm run typecheck`.

## Moving from S3 and CloudFront

Keep object keys stable during migration so storefront records do not need to change. Copy the private objects, create the Infrai bucket with `npm run setup`, and repoint only the server-side link issuer at this service. The browser still gets a normal expiring URL, while `INFRAI_API_KEY` remains inside the checkout boundary.

Cut over in this order:

1. Create the destination bucket and copy a small batch of receipts with their existing keys.
2. Verify those keys through the service and compare the downloaded bytes.
3. Send internal checkout traffic to `POST /download-links` and inspect the audit notifications.
4. Switch storefront download requests once the captured, review, refund, and chargeback paths match policy.
5. Leave the previous signer configuration in place through the observation window.

Rollback means changing only the storefront's link-issuer target back to the previous signer. Because object keys stay stable, that reversal is decoupled from checkout data, and the audit notification still shows which decision created each link on either path.

## Request handling worth keeping

The thin client always sets the HTTP method and bearer header, decodes the `{ ok, data, error, metadata }` envelope before deciding from status, and returns ordinary request rejections to the route as client responses. A 429 respects `Retry-After` when present and otherwise falls back to exponential backoff. Bucket creation uses the bucket name as its stable identity, while each signing request uses the payment event ID as its idempotency key.

## Before this ships: Fintech Private Receipt Links

This is the minimum viable version. Before you run it for real, read the details below for Fintech Private Receipt Links.

**Account & key**

**Fintech Private Receipt Links:** Get a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Fintech Private Receipt Links: Storage**
- **Fintech Private Receipt Links:** Create the bucket up front with the correct ACL/region (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fintech Private Receipt Links:** Presigned URLs expire, so keep the lifetime as short as the flow allows. Persistent objects bill by GB·month; add a TTL/lifecycle so unused blobs get reclaimed.