export type PaymentEvent = "payment_captured" | "payment_refunded" | "chargeback_opened";
export type RiskDecision = "allow" | "review" | "deny";

export type AccessDecision =
  | { action: "issue_link"; reason: "paid_and_risk_allowed" }
  | { action: "manual_review"; reason: "risk_review_required" }
  | { action: "deny"; reason: "payment_not_eligible" | "risk_denied" };

export function decideDownloadAccess(
  paymentEvent: PaymentEvent,
  riskDecision: RiskDecision,
): AccessDecision {
  if (paymentEvent !== "payment_captured") {
    return { action: "deny", reason: "payment_not_eligible" };
  }
  if (riskDecision === "review") {
    return { action: "manual_review", reason: "risk_review_required" };
  }
  if (riskDecision === "deny") {
    return { action: "deny", reason: "risk_denied" };
  }
  return { action: "issue_link", reason: "paid_and_risk_allowed" };
}
