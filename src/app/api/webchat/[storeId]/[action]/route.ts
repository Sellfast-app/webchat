import { NextResponse } from "next/server";

const API_BASE = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL)?.trim().replace(/\/+$/, "");
const INTERNAL_SECRET = process.env.SWIFTREE_INTERNAL_SECRET;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function proxy(request: Request, context: { params: Promise<{ storeId: string; action: string }> }, method: "GET" | "POST") {
  const { storeId, action } = await context.params;
  if (!UUID.test(storeId)) return NextResponse.json({ message: "Invalid store id" }, { status: 400 });
  const paths: Record<string, { path: string; requiresSecret?: boolean }> = {
    context: { path: `webchat/${encodeURIComponent(storeId)}/context` },
    messages: { path: `webchat/${encodeURIComponent(storeId)}/messages` },
    events: { path: `webchat/${encodeURIComponent(storeId)}/events` },
    "payment-methods": { path: `v2/payment-methods/stores/${encodeURIComponent(storeId)}` },
    "retail-quote": { path: "orders/quote", requiresSecret: true },
    "retail-order": { path: "orders/create", requiresSecret: true },
    "food-quote": { path: "orders/food/quote", requiresSecret: true },
    "food-order": { path: "orders/food/create", requiresSecret: true },
    "ticket-order": { path: "tickets/checkout" },
  };
  const target = paths[action];
  if (!target) return NextResponse.json({ message: "Unknown chat action" }, { status: 404 });
  if (!API_BASE) return NextResponse.json({ message: "Chat API is not configured" }, { status: 503 });
  if (target.requiresSecret && !INTERNAL_SECRET) return NextResponse.json({ message: "Order service is not configured" }, { status: 503 });
  try {
    const headers: Record<string, string> = {};
    let body: string | undefined;
    if (method === "POST") {
      const parsed = await request.json().catch(() => null);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
      if (action !== "events" && String(parsed.store_id || "") !== storeId) return NextResponse.json({ message: "Store id does not match this checkout" }, { status: 400 });
      if (["retail-order", "food-order", "ticket-order"].includes(action)) {
        parsed.sales_channel = "web_chat";
        parsed.sales_source = "web_chat";
      }
      if (["retail-quote", "food-quote"].includes(action)) {
        parsed.sales_channel = "web_chat";
        parsed.sales_source = "web_chat";
      }
      if (target.requiresSecret) headers["X-Internal-Secret"] = INTERNAL_SECRET!;
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(parsed);
    }
    const response = await fetch(`${API_BASE}/api/${target.path}`, {
      method,
      ...(method === "POST" ? { headers, body } : {}),
      cache: "no-store",
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ message: "Unable to reach the chat service" }, { status: 502 });
  }
}

export async function GET(request: Request, context: { params: Promise<{ storeId: string; action: string }> }) {
  return proxy(request, context, "GET");
}

export async function POST(request: Request, context: { params: Promise<{ storeId: string; action: string }> }) {
  return proxy(request, context, "POST");
}
