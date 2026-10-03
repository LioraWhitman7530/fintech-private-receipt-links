import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { decideDownloadAccess } from "./access_policy";
import { infrai, InfraiError } from "./infrai_storage";

const bucket = process.env.PRIVATE_FILES_BUCKET ?? "fintech-customer-files";
const expiresSeconds = 300;

const requestSchema = z.object({
  customer_id: z.string().min(1).max(80),
  order_id: z.string().min(1).max(80),
  payment_event: z.object({
    event_id: z.string().min(1).max(120),
    type: z.enum(["payment_captured", "payment_refunded", "chargeback_opened"]),
  }),
  risk: z.object({ decision: z.enum(["allow", "review", "deny"]) }),
  artifact: z.object({
    key: z.string().min(1).max(500),
    download_name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/),
  }),
});

export const app = express();
app.use(express.json({ limit: "32kb" }));

app.post("/download-links", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const input = requestSchema.parse(request.body);
    const decision = decideDownloadAccess(input.payment_event.type, input.risk.decision);
    const notification = {
      audit_id: `${input.order_id}:${input.payment_event.event_id}`,
      customer_id: input.customer_id,
      order_id: input.order_id,
      payment_event_id: input.payment_event.event_id,
      action: decision.action,
      reason: decision.reason,
    };

    if (decision.action !== "issue_link") {
      response.status(decision.action === "manual_review" ? 202 : 403).json({ notification });
      return;
    }

    const object = await infrai.storage.object.head(bucket, input.artifact.key);
    if (!object.found) {
      response.status(404).json({ notification, message: "Customer file was not found" });
      return;
    }

    const signed = await infrai.storage.object.presign(bucket, input.artifact.key, {
      op: "get",
      expires_seconds: expiresSeconds,
      response_disposition: `attachment; filename="${input.artifact.download_name}"`,
      idempotency_key: input.payment_event.event_id,
    });

    response.status(200).json({
      notification,
      download: { url: signed.url, expires_seconds: expiresSeconds },
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    response.status(400).json({ error: "invalid_request", issues: error.issues });
    return;
  }
  if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
    response.status(error.status).json({ error: "storage_request_rejected", message: error.message });
    return;
  }
  response.status(502).json({ error: "storage_request_failed" });
});

async function start(): Promise<void> {
  await infrai.storage.bucket.create(bucket);
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => console.log(`Download service listening on http://localhost:${port}`));
}

if (process.env.NODE_ENV !== "test") {
  start().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
