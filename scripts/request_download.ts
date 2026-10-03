const response = await fetch("http://localhost:3000/download-links", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    customer_id: "cus_4821",
    order_id: "order_7319",
    payment_event: { event_id: "evt_2026_09_05_001", type: "payment_captured" },
    risk: { decision: "allow" },
    artifact: { key: "statements/order_7319.pdf", download_name: "receipt-order-7319.pdf" },
  }),
});

console.log(JSON.stringify(await response.json(), null, 2));

export {};
