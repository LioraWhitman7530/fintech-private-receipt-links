import assert from "node:assert/strict";
import test from "node:test";
import { decideDownloadAccess } from "../src/access_policy";

test("a captured payment with an allowed risk result can receive a link", () => {
  assert.deepEqual(decideDownloadAccess("payment_captured", "allow"), {
    action: "issue_link",
    reason: "paid_and_risk_allowed",
  });
});

test("a captured payment held for risk review does not receive a link", () => {
  assert.deepEqual(decideDownloadAccess("payment_captured", "review"), {
    action: "manual_review",
    reason: "risk_review_required",
  });
});

test("a refund makes the file ineligible even when risk allows it", () => {
  assert.deepEqual(decideDownloadAccess("payment_refunded", "allow"), {
    action: "deny",
    reason: "payment_not_eligible",
  });
});
