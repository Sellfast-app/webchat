"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, MessageCircle, Minus, Plus, Send, ShoppingBag, X } from "lucide-react";
import { CatalogItem, ChatMessage, VendorContext } from "@/lib/types";

type CartLine = {
  item: CatalogItem;
  quantity: number;
  optionId?: string;
  optionName?: string;
  variant?: Record<string, unknown>;
  addOns: Record<string, string[]>;
  attendeeNames: string[];
};
type Customer = { name: string; email: string; phone: string; address: string; city: string; state: string; post_code: string; country: string };
type PaymentMethod = { id: string; name?: string; label?: string; available?: boolean };
type DeliveryOption = { name?: string; fee?: number; rate_card_id?: string | number; service_code?: string; id?: string; [key: string]: unknown };
type View = "chat" | "catalog" | "cart" | "checkout" | "complete";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function money(value: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}

function fullNameParts(name: string) {
  const [first_name, ...rest] = name.trim().split(/\s+/);
  return { first_name, last_name: rest.join(" ") || first_name };
}

function errorText(result: any, fallback: string) {
  return typeof result?.message === "string" ? result.message : fallback;
}

export function ChatWidget({ storeId }: { storeId: string }) {
  const [vendor, setVendor] = useState<VendorContext | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextError, setContextError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [view, setView] = useState<View>("chat");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [selectedVariant, setSelectedVariant] = useState<Record<string, unknown> | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [deliveryRateId, setDeliveryRateId] = useState("");
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
  const [deliveryOptionIndex, setDeliveryOptionIndex] = useState("");
  const [foodOrderKey, setFoodOrderKey] = useState("");
  const [previewPricing, setPreviewPricing] = useState<{ total_before_delivery?: number; platform_fee?: number } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [customer, setCustomer] = useState<Customer>({ name: "", email: "", phone: "", address: "", city: "", state: "", post_code: "", country: "NG" });
  const [checkoutSessionId, setCheckoutSessionId] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const businessType = vendor?.businessType || "";
  const isFood = /food|restaurant/i.test(businessType);
  const isTicket = /ticket/i.test(businessType);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const catalog = vendor?.catalog || [];
  const subtotal = useMemo(() => cart.reduce((sum, line) => {
    const options = line.item.options;
    let unit = Number(line.variant?.price ?? line.item.price ?? 0);
    if (isFood) {
      const option = [...(options?.portions || []), ...(options?.bundles || []), ...(options?.servingPrices || []).map((s) => ({ id: s.servingType, name: s.servingType, price: s.price }))].find((entry) => entry.id === line.optionId);
      if (option) unit = option.price;
      for (const ids of Object.values(line.addOns)) for (const id of ids) {
        const addon = options?.addOns?.flatMap((g) => g.options).find((entry) => entry.id === id);
        unit += Number(addon?.price || 0);
      }
    } else if (isTicket) {
      unit = Number(options?.tickets?.find((entry) => entry.id === line.optionId)?.price || 0);
    }
    return sum + unit * line.quantity;
  }, 0), [cart, isFood, isTicket]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, view]);

  useEffect(() => {
    if (!storeId) { setContextError("This chat link is missing its store reference."); return; }
    const key = `swiftree-webchat-session:${storeId}`;
    const existing = sessionStorage.getItem(key);
    const current = existing || crypto.randomUUID();
    if (!existing) sessionStorage.setItem(key, current);
    setSessionId(current);
  }, [storeId]);

  useEffect(() => {
    if (!storeId || !sessionId) return;
    let active = true;
    fetch(`/api/webchat/${encodeURIComponent(storeId)}/context`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(errorText(result, "Unable to load store"));
        return result.data;
      })
      .then((context) => {
        if (!active) return;
        const resolved: VendorContext = {
          vendorId: context.storeId, vendorName: context.storeName, businessType: context.businessType,
          logo: context.logo, description: context.description, currency: context.currency,
          fulfillmentModes: context.fulfillmentModes || [], vendorDeliveryRates: context.vendorDeliveryRates || [],
          catalog: Array.isArray(context.catalog) ? context.catalog : [],
        };
        setVendor(resolved);
        setCustomer((current) => ({ ...current, country: context.country || "NG" }));
        setMessages([{ id: "welcome", role: "assistant", content: `Hello! Welcome to ${resolved.vendorName}. Ask me about the store, or browse the catalog to place an order.`, timestamp: Date.now(), vendorId: resolved.vendorId }]);
        void fetch(`/api/webchat/${encodeURIComponent(storeId)}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
      })
      .catch((reason: unknown) => active && setContextError(reason instanceof Error ? reason.message : "Unable to load this store"));
    return () => { active = false; };
  }, [storeId, sessionId]);

  const handleSend = async () => {
    const message = input.trim();
    if (!message || !vendor || loading) return;
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: message, timestamp: Date.now(), vendorId: vendor.vendorId }]);
    setInput(""); setLoading(true);
    try {
      const history = messages.map(({ role, content }) => ({ role, content }));
      const res = await fetch(`/api/webchat/${encodeURIComponent(storeId)}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, sessionId, history }) });
      const data = await res.json();
      if (!res.ok) throw new Error(errorText(data, "The assistant is temporarily unavailable."));
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: data.data?.reply || "Sorry, I could not process your request.", timestamp: Date.now() + 1, vendorId: vendor.vendorId, sources: Array.isArray(data.data?.sources) ? data.data.sources : [] }]);
    } catch (reason) {
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: reason instanceof Error ? reason.message : "Sorry, I'm having trouble connecting. Please try again.", timestamp: Date.now() + 1, vendorId: vendor.vendorId }]);
    } finally { setLoading(false); }
  };

  const openItem = (item: CatalogItem) => {
    setSelectedItem(item); setSelectedAddOns({}); setQuantity(1);
    const variants = Array.isArray(item.options?.variants) ? item.options.variants : [];
    setSelectedVariant(variants[0] || null);
    const options = item.options;
    const first = isTicket ? options?.tickets?.find((ticket) => ticket.remaining > 0)?.id
      : isFood ? options?.portions?.[0]?.id || options?.bundles?.[0]?.id || options?.servingPrices?.[0]?.servingType
      : "";
    setSelectedOptionId(first || "");
  };

  const addSelectedItem = () => {
    if (!selectedItem) return;
    const options = selectedItem.options;
    const hasChoice = (isFood && Boolean(options?.portions?.length || options?.bundles?.length || options?.servingPrices?.length)) || (isTicket && Boolean(options?.tickets?.length));
    if (hasChoice && !selectedOptionId) return;
    if (!isFood && !isTicket && Array.isArray(options?.variants) && options.variants.length && !selectedVariant) return;
    if (isTicket && Number(options?.tickets?.find((ticket) => ticket.id === selectedOptionId)?.remaining || 0) < quantity) return;
    const attendeeNames = isTicket ? Array.from({ length: quantity }, () => "") : [];
    setCart((previous) => [...previous, { item: selectedItem, quantity, optionId: selectedOptionId || undefined, variant: selectedVariant || undefined, addOns: selectedAddOns, attendeeNames }]);
    setCheckoutSessionId("");
    setSelectedItem(null);
  };

  const updateQuantity = (index: number, value: number) => { setCheckoutSessionId(""); setCart((previous) => previous.map((line, i) => i === index ? { ...line, quantity: Math.max(1, Math.min(20, value)), attendeeNames: isTicket ? Array.from({ length: Math.max(1, Math.min(20, value)) }, (_, n) => line.attendeeNames[n] || "") : line.attendeeNames } : line)); };
  const updateCustomer = (field: keyof Customer, value: string) => setCustomer((previous) => ({ ...previous, [field]: value }));
  const needsCheckoutPreview = !isTicket && Boolean(deliveryMethod);
  const needsCourierQuote = needsCheckoutPreview && !["vendor", "pickup"].includes(deliveryMethod);
  const selectedDeliveryOption = deliveryOptionIndex === "" ? null : deliveryOptions[Number(deliveryOptionIndex)] || null;
  const selectedManualRate = vendor?.vendorDeliveryRates.find((rate) => rate.id === deliveryRateId);
  const deliveryFeeEstimate = needsCourierQuote ? Number(selectedDeliveryOption?.fee || 0) : deliveryMethod === "vendor" ? Number(selectedManualRate?.rate || 0) : 0;

  const getDeliveryQuote = async () => {
    if (!vendor || !customer.name || !customer.email || !customer.phone || !customer.address || !customer.city || !customer.state || !customer.post_code) {
      setCheckoutError("Enter your contact and complete delivery address before requesting a quote."); return;
    }
    setQuoteLoading(true); setCheckoutError(""); setDeliveryOptions([]); setDeliveryOptionIndex(""); setFoodOrderKey(""); setPreviewPricing(null);
    try {
      const items = isFood ? cart.map((line) => {
        const options = line.item.options;
        const portion = options?.portions?.find((entry) => entry.id === line.optionId);
        const bundle = options?.bundles?.find((entry) => entry.id === line.optionId);
        const serving = options?.servingPrices?.find((entry) => entry.servingType === line.optionId);
        const addons = (options?.addOns || []).flatMap((group) => {
          const selected = line.addOns[group.name] || [];
          return selected.length ? [{ uid: group.id, addOnGroupOption: selected.map((uid) => ({ uid, quantity: 1 })) }] : [];
        });
        return { product_id: line.item.id, name: line.item.name, weight: 0, ...(portion ? { portion: [{ uid: portion.id, quantity: line.quantity }] } : {}), ...(bundle ? { bundleConfig: { uid: bundle.id, quantity: line.quantity } } : {}), ...(serving ? { servingType: serving.servingType, quantity_customizable: line.quantity } : {}), ...(addons.length ? { addOnGroup: addons } : {}) };
      }) : cart.map((line) => ({ product_id: line.item.id, name: line.item.name, price: Number(line.variant?.price ?? line.item.price ?? 0), quantity: line.quantity, weight: Number(line.item.weight || 0), ...(line.variant ? { variant: line.variant } : {}) }));
      const payload = { store_id: storeId, items, total_amount: Math.max(1, subtotal), total_items: cartCount, payment_method: paymentMethod || "paystack", delivery_method: deliveryMethod, customer_info: { ...customer, name: customer.name.trim() }, notes: "WebChat order" };
      const action = isFood ? "food-quote" : "retail-quote";
      const response = await fetch(`/api/webchat/${encodeURIComponent(storeId)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || result.status !== "success") throw new Error(errorText(result, "Could not get delivery quote"));
      const data = result.data || {};
      setPreviewPricing(data.pricing || null);
      const raw = Array.isArray(data.quote) ? data.quote : data.quote ? [data.quote] : [];
      const options = raw.map((option: any) => typeof option === "number" ? { fee: option } : option).filter((option: DeliveryOption) => Number.isFinite(Number(option.fee)));
      if (needsCourierQuote && !options.length) throw new Error("No delivery quote was returned for this address.");
      setDeliveryOptions(options);
      setDeliveryOptionIndex(options.length ? "0" : "");
      setFoodOrderKey(String(data.orderKey || ""));
    } catch (reason) { setCheckoutError(reason instanceof Error ? reason.message : "Could not get delivery quote"); }
    finally { setQuoteLoading(false); }
  };

  const beginCheckout = async () => {
    setCheckoutError(""); setCheckoutLoading(true);
    try {
      let methods: PaymentMethod[] = [];
      const needsPayment = !isTicket || cart.some((line) => Number(line.item.options?.tickets?.find((ticket) => ticket.id === line.optionId)?.price || 0) > 0);
      if (needsPayment) {
        const response = await fetch(`/api/webchat/${encodeURIComponent(storeId)}/payment-methods`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(errorText(result, "Unable to load payment methods"));
        methods = Array.isArray(result.data) ? result.data : result.data?.methods || [];
      }
      const id = checkoutSessionId || crypto.randomUUID(); setCheckoutSessionId(id);
      const eventResponse = await fetch(`/api/webchat/${encodeURIComponent(storeId)}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, event: "checkout.started", checkoutSessionId: id }) });
      if (!eventResponse.ok) throw new Error("Could not start checkout tracking. Please try again.");
      setPaymentMethods(methods.filter((method) => method.available !== false));
      setPaymentMethod(methods.find((method) => method.available !== false)?.id || "");
      const modes = vendor?.fulfillmentModes || [];
      const firstDelivery = modes.find((mode) => ["vendor", "pickup", "gig", "sendbox", "relay"].includes(mode)) || "vendor";
      setDeliveryMethod(firstDelivery);
      setDeliveryRateId(""); setDeliveryOptions([]); setDeliveryOptionIndex(""); setFoodOrderKey("");
      setView("checkout");
    } catch (reason) { setCheckoutError(reason instanceof Error ? reason.message : "Unable to start checkout"); }
    finally { setCheckoutLoading(false); }
  };

  const placeOrder = async () => {
    if (!vendor || !cart.length || checkoutLoading) return;
    setCheckoutError("");
    if (!customer.name.trim() || !customer.email.trim() || !customer.phone.trim()) { setCheckoutError("Enter your name, email, and phone number."); return; }
    if (!isTicket && (!customer.address.trim() || !customer.city.trim() || !customer.state.trim() || !customer.post_code.trim())) { setCheckoutError("Enter your complete delivery address."); return; }
    const requiresPayment = !isTicket || cart.some((line) => Number(line.item.options?.tickets?.find((ticket) => ticket.id === line.optionId)?.price || 0) > 0);
    if (requiresPayment && !paymentMethod) { setCheckoutError("No payment method is currently available for this store."); return; }
    if (!checkoutSessionId) { setCheckoutError("Checkout session expired. Start checkout again."); return; }

    setCheckoutLoading(true);
    try {
      let action: string; let payload: Record<string, any>;
      if (isTicket) {
        const [first_name, ...rest] = customer.name.trim().split(/\s+/);
        const tickets = cart.map((line) => {
          const ticket = line.item.options?.tickets?.find((entry) => entry.id === line.optionId);
          if (!ticket) throw new Error("Choose a valid ticket type for every event.");
          const attendees = line.attendeeNames.map((name) => fullNameParts(name));
          if (attendees.some((entry, i) => !line.attendeeNames[i].trim())) throw new Error("Enter the full name for each ticket attendee.");
          return { ticket_type_id: ticket.id, attendees };
        });
        if (cart.some((line) => line.item.id !== cart[0].item.id)) throw new Error("Tickets from separate events must be checked out separately.");
        payload = { store_id: storeId, event_id: cart[0].item.id, idempotency_key: crypto.randomUUID(), checkout_session_id: checkoutSessionId, ...(paymentMethod ? { payment_method: paymentMethod } : {}), customer: { first_name: first_name || "", last_name: rest.join(" ") || first_name || "", email: customer.email, whatsapp: customer.phone }, tickets };
        action = "ticket-order";
      } else {
        const customerInfo = { ...customer, name: customer.name.trim() };
        const quoteFields = previewPricing ? {
          ...(foodOrderKey ? { orderKey: foodOrderKey } : {}),
          ...(needsCourierQuote && selectedDeliveryOption?.rate_card_id != null ? { rate_card_id: selectedDeliveryOption.rate_card_id } : {}),
        } : {};
        if (isFood) {
          const items = cart.map((line) => {
            const item = line.item; const options = item.options;
            const portion = options?.portions?.find((entry) => entry.id === line.optionId);
            const bundle = options?.bundles?.find((entry) => entry.id === line.optionId);
            const serving = options?.servingPrices?.find((entry) => entry.servingType === line.optionId);
            const addOnGroup = (options?.addOns || []).flatMap((group) => {
              const selected = line.addOns[group.name] || [];
              return selected.length ? [{ uid: group.id, addOnGroupOption: selected.map((uid) => ({ uid, quantity: 1 })) }] : [];
            });
            return { product_id: item.id, name: item.name, weight: 0, ...(item.image ? { image: item.image } : {}), ...(portion ? { portion: [{ uid: portion.id, quantity: line.quantity }] } : {}), ...(bundle ? { bundleConfig: { uid: bundle.id, quantity: line.quantity } } : {}), ...(serving ? { servingType: serving.servingType, quantity_customizable: line.quantity } : {}), ...(addOnGroup.length ? { addOnGroup } : {}) };
          });
          payload = { store_id: storeId, items, total_amount: Math.max(1, subtotal), total_items: cartCount, payment_method: paymentMethod, delivery_method: deliveryMethod || "vendor", customer_info: customerInfo, notes: "WebChat order", checkout_session_id: checkoutSessionId, ...quoteFields, ...(deliveryRateId ? { delivery_rate: vendor.vendorDeliveryRates.find((rate) => rate.id === deliveryRateId) ? { id: deliveryRateId, location: vendor.vendorDeliveryRates.find((rate) => rate.id === deliveryRateId)!.location, fee: vendor.vendorDeliveryRates.find((rate) => rate.id === deliveryRateId)!.rate } : undefined } : {}) };
          action = "food-order";
        } else {
          const items = cart.map((line) => ({ product_id: line.item.id, name: line.item.name, price: Number(line.variant?.price ?? line.item.price ?? 0), quantity: line.quantity, weight: Number(line.item.weight || 0), ...(line.item.image ? { image: line.item.image } : {}), ...(line.variant ? { variant: line.variant } : {}) }));
          payload = { store_id: storeId, items, total_amount: Math.max(1, subtotal), total_items: cartCount, payment_method: paymentMethod, delivery_method: deliveryMethod || "vendor", customer_info: customerInfo, notes: "WebChat order", checkout_session_id: checkoutSessionId, ...quoteFields, ...(deliveryRateId ? { delivery_rate: vendor.vendorDeliveryRates.find((rate) => rate.id === deliveryRateId) ? { id: deliveryRateId, location: vendor.vendorDeliveryRates.find((rate) => rate.id === deliveryRateId)!.location, fee: vendor.vendorDeliveryRates.find((rate) => rate.id === deliveryRateId)!.rate } : undefined } : {}) };
          action = "retail-order";
        }
      }

      const response = await fetch(`/api/webchat/${encodeURIComponent(storeId)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || result.status !== "success") throw new Error(errorText(result, "Order could not be created"));
      const data = result.data || {};
      const paymentUrl = data.payment?.authorization_url || data.transaction?.meta_data?.authorization_url || data.payment_url || data.authorization_url;
      const order = data.order || data;
      if (paymentUrl) { window.location.assign(paymentUrl); return; }
      const noPaymentDue = Number(order.order_total ?? order.total_amount ?? data.total_amount ?? 0) === 0 || order.payment_status === "free";
      setMessages((previous) => [...previous, { id: `order-${Date.now()}`, role: "assistant", content: `Your order${order.order_number ? ` ${order.order_number}` : ""} has been created. ${noPaymentDue ? "No payment is due." : "Payment has not been confirmed yet. Contact the store if you do not receive a payment link."}`, timestamp: Date.now(), vendorId: vendor.vendorId }]);
      setCart([]); setView("complete");
    } catch (reason) { setCheckoutError(reason instanceof Error ? reason.message : "Order could not be created. Check the details and try again."); }
    finally { setCheckoutLoading(false); }
  };

  const goToCheckout = () => { void beginCheckout(); };
  const ticketNeedsPayment = cart.some((line) => Number(line.item.options?.tickets?.find((ticket) => ticket.id === line.optionId)?.price || 0) > 0);
  const formFields: Array<{ key: keyof Customer; label: string; type?: string; required?: boolean }> = [
    { key: "name", label: "Full name", required: true }, { key: "email", label: "Email", type: "email", required: true },
    { key: "phone", label: "WhatsApp / phone", type: "tel", required: true },
    ...(!isTicket ? [{ key: "address" as const, label: "Street address", required: true }, { key: "city" as const, label: "City", required: true }, { key: "state" as const, label: "State / region", required: true }, { key: "post_code" as const, label: "Postcode", required: true }, { key: "country" as const, label: "Country", required: true }] : []),
  ];

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50">
      <header className="flex items-center justify-between bg-[#4FCA6A] px-4 py-3 shadow-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {vendor?.logo ? <img src={vendor.logo} alt="" className="h-10 w-10 rounded-full bg-white object-cover ring-2 ring-white" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#3BA65A]">{vendor?.vendorName?.slice(0, 1).toUpperCase() || "S"}</div>}
          <div className="min-w-0"><h2 className="truncate text-base font-semibold text-white">{vendor?.vendorName || "Swiftree Store"}</h2><p className="text-xs text-white/80">{businessType}</p></div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setView("chat")} aria-label="Chat" title="Chat" className="rounded-lg p-2 text-white hover:bg-white/15"><MessageCircle size={19} /></button>
          <button onClick={() => setView("catalog")} aria-label="Browse catalog" title="Browse catalog" className="rounded-lg p-2 text-white hover:bg-white/15"><ShoppingBag size={19} /></button>
          <button onClick={() => setView("cart")} aria-label={`Cart, ${cartCount} items`} title={`Cart, ${cartCount} items`} className="relative rounded-lg p-2 text-white hover:bg-white/15"><ShoppingBag size={19} />{cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-white px-1 text-center text-[10px] font-bold text-green-700">{cartCount}</span>}</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {contextError && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{contextError}</p>}

          {view === "chat" && <>
            {messages.map((msg) => <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-white text-gray-900"}`}>
              {msg.content !== "[image]" && <span className="whitespace-pre-wrap">{msg.content}</span>}
              {msg.sources?.length ? <div className="mt-3 border-t border-gray-100 pt-2"><p className="mb-1 text-[10px] font-medium text-gray-500">Sources</p><ul className="space-y-1">{msg.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">{source.title}</a></li>)}</ul></div> : null}
              <div className={`mt-2 text-[10px] ${msg.role === "user" ? "text-primary-foreground/70" : "text-gray-400"}`}>{formatTime(msg.timestamp)}</div>
            </div></div>)}
            {loading && <div className="flex justify-start"><div className="rounded-xl bg-white px-4 py-3 shadow"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div></div>}
            {!messages.length && !contextError && <p className="text-sm text-gray-500">Loading this store...</p>}
          </>}

          {view === "catalog" && <section><div className="mb-4 flex items-center justify-between"><h1 className="text-lg font-semibold">{isFood ? "Menu" : isTicket ? "Events" : "Products"}</h1><button onClick={() => setView("chat")} title="Close catalog" aria-label="Close catalog" className="rounded p-2 text-gray-600 hover:bg-gray-200"><X size={18} /></button></div>
            {catalog.length === 0 ? <p className="py-12 text-center text-sm text-gray-500">No items are currently available.</p> : <div className="grid gap-3 sm:grid-cols-2">{catalog.map((item) => <article key={item.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">{item.image && <img src={item.image} alt="" className="h-36 w-full object-cover" />}<div className="p-3"><h2 className="font-medium">{item.name}</h2>{item.description && <p className="mt-1 line-clamp-2 text-xs text-gray-600">{item.description}</p>}<p className="mt-2 text-sm font-semibold">{isTicket ? `${item.options?.tickets?.length || 0} ticket types` : isFood ? `${item.options?.portions?.length || item.options?.bundles?.length || 1} options` : money(Number(item.price || 0), vendor?.currency || "NGN")}</p><button onClick={() => openItem(item)} className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{isTicket ? "Choose tickets" : isFood ? "Choose options" : "Add to cart"}</button></div></article>)}</div>}
          </section>}

          {view === "cart" && <section><div className="mb-4 flex items-center justify-between"><h1 className="text-lg font-semibold">Your cart</h1><button onClick={() => setView("catalog")} className="text-sm font-medium text-green-700">Continue browsing</button></div>
            {!cart.length ? <p className="py-12 text-center text-sm text-gray-500">Your cart is empty.</p> : <div className="space-y-3">{cart.map((line, index) => <div key={`${line.item.id}-${index}`} className="flex items-center gap-3 rounded-lg border bg-white p-3">{line.item.image && <img src={line.item.image} alt="" className="h-14 w-14 rounded object-cover" />}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{line.item.name}</p><p className="text-xs text-gray-500">{line.optionName || line.item.options?.tickets?.find((ticket) => ticket.id === line.optionId)?.name || ""}</p></div><div className="flex items-center gap-2"><button onClick={() => updateQuantity(index, line.quantity - 1)} aria-label="Decrease quantity" className="rounded border p-1"><Minus size={14} /></button><span className="w-5 text-center text-sm">{line.quantity}</span><button onClick={() => updateQuantity(index, line.quantity + 1)} aria-label="Increase quantity" className="rounded border p-1"><Plus size={14} /></button></div><button onClick={() => { setCheckoutSessionId(""); setCart((previous) => previous.filter((_, i) => i !== index)); }} title="Remove item" aria-label="Remove item" className="p-1 text-gray-500"><X size={16} /></button></div>)}<div className="flex justify-between border-t py-3 font-semibold"><span>Estimated subtotal</span><span>{money(subtotal, vendor?.currency || "NGN")}</span></div><button disabled={checkoutLoading} onClick={goToCheckout} className="w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-60">{checkoutLoading ? "Preparing checkout..." : "Continue to checkout"}</button></div>}
          </section>}

          {view === "checkout" && <section><div className="mb-4 flex items-center gap-2"><button onClick={() => setView("cart")} aria-label="Back to cart" className="rounded p-2 hover:bg-gray-200"><ArrowLeft size={18} /></button><h1 className="text-lg font-semibold">Checkout</h1></div>
            <div className="space-y-4 rounded-lg border bg-white p-4">{formFields.map((field) => <label key={field.key} className="block text-sm font-medium text-gray-700">{field.label}<input required={field.required} type={field.type || "text"} value={customer[field.key]} onChange={(event) => updateCustomer(field.key, event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600" /></label>)}
              {isTicket ? <div className="space-y-3"><h2 className="font-medium">Attendee details</h2>{cart.map((line, lineIndex) => line.attendeeNames.map((name, attendeeIndex) => <label key={`${lineIndex}-${attendeeIndex}`} className="block text-sm text-gray-700">{line.item.name}, attendee {attendeeIndex + 1}<input value={name} onChange={(event) => setCart((previous) => previous.map((entry, index) => index === lineIndex ? { ...entry, attendeeNames: entry.attendeeNames.map((value, i) => i === attendeeIndex ? event.target.value : value) } : entry))} className="mt-1 w-full rounded-md border px-3 py-2" /></label>))}</div> : <>
                <label className="block text-sm font-medium text-gray-700">Delivery method<select value={deliveryMethod} onChange={(event) => { setDeliveryMethod(event.target.value); setDeliveryRateId(""); setDeliveryOptions([]); setDeliveryOptionIndex(""); setFoodOrderKey(""); setPreviewPricing(null); }} className="mt-1 w-full rounded-md border px-3 py-2">{(vendor?.fulfillmentModes.length ? vendor.fulfillmentModes : ["vendor"]).map((mode) => <option key={mode} value={mode}>{mode === "vendor" ? "Vendor delivery" : mode === "pickup" ? "Store pickup" : mode === "gig" ? "GIG Logistics" : mode === "sendbox" ? "Sendbox" : mode === "relay" ? "Relay" : mode}</option>)}</select></label>
                {deliveryMethod === "vendor" && Boolean(vendor?.vendorDeliveryRates.length) && <label className="block text-sm font-medium text-gray-700">Delivery area<select value={deliveryRateId} onChange={(event) => { setDeliveryRateId(event.target.value); setPreviewPricing(null); }} className="mt-1 w-full rounded-md border px-3 py-2"><option value="">Select delivery area</option>{vendor?.vendorDeliveryRates.map((rate) => <option key={rate.id} value={rate.id}>{rate.location} · {money(Number(rate.rate), vendor.currency)}</option>)}</select></label>}
                {needsCheckoutPreview && <div className="space-y-2"><button type="button" onClick={() => void getDeliveryQuote()} disabled={quoteLoading || (deliveryMethod === "vendor" && Boolean(vendor?.vendorDeliveryRates.length) && !deliveryRateId)} className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50">{quoteLoading ? "Calculating..." : previewPricing ? needsCourierQuote ? "Refresh delivery rates and total" : "Refresh total" : needsCourierQuote ? "Get delivery rates and total" : "Calculate total"}</button>{needsCourierQuote && deliveryOptions.length > 1 && <label className="block text-sm font-medium text-gray-700">Choose delivery rate<select value={deliveryOptionIndex} onChange={(event) => setDeliveryOptionIndex(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2">{deliveryOptions.map((option, index) => <option key={`${option.rate_card_id || option.service_code || index}`} value={index}>{option.name || option.service_code || `Option ${index + 1}`} · {money(Number(option.fee || 0), vendor?.currency || "NGN")}</option>)}</select></label>}{needsCourierQuote && deliveryOptions.length === 1 && <p className="text-sm text-gray-600">{deliveryOptions[0].name || "Delivery"}: {money(Number(deliveryOptions[0].fee || 0), vendor?.currency || "NGN")}</p>}</div>}
              </>}
              {(!isTicket || ticketNeedsPayment) && <label className="block text-sm font-medium text-gray-700">Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2"><option value="">Select payment method</option>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label || method.name || method.id}</option>)}</select></label>}
              <div className="space-y-1 border-t pt-3 text-sm"><div className="flex justify-between"><span>Items</span><span>{money(subtotal, vendor?.currency || "NGN")}</span></div>{previewPricing && <div className="flex justify-between"><span>Swiftree platform fee</span><span>{money(Number(previewPricing.platform_fee || 0), vendor?.currency || "NGN")}</span></div>}{previewPricing && <div className="flex justify-between"><span>Delivery</span><span>{deliveryFeeEstimate ? money(deliveryFeeEstimate, vendor?.currency || "NGN") : "Free"}</span></div>}<div className="flex justify-between border-t pt-2 font-semibold"><span>{previewPricing ? "Estimated total" : isTicket ? "Ticket subtotal" : "Estimated subtotal"}</span><span>{money(previewPricing ? Number(previewPricing.total_before_delivery || subtotal) + deliveryFeeEstimate : subtotal, vendor?.currency || "NGN")}</span></div></div>
              {checkoutError && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{checkoutError}</p>}
              <button disabled={checkoutLoading || ((!isTicket || ticketNeedsPayment) && !paymentMethod) || (deliveryMethod === "vendor" && Boolean(vendor?.vendorDeliveryRates.length) && !deliveryRateId) || (needsCheckoutPreview && !previewPricing) || (needsCourierQuote && (!selectedDeliveryOption || (isFood && !foodOrderKey)))} onClick={() => void placeOrder()} className="w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-60">{checkoutLoading ? "Placing order..." : "Place order"}</button>
            </div>
          </section>}

          {view === "complete" && <section className="rounded-lg border bg-white p-8 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">✓</div><h1 className="text-lg font-semibold">Order submitted</h1><p className="mt-2 text-sm text-gray-600">Your order was sent to the store. Payment confirmation and order updates will follow through the store’s configured channels.</p><button onClick={() => setView("chat")} className="mt-5 rounded-md border px-4 py-2 text-sm">Back to chat</button></section>}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {view === "chat" && <div className="border-t border-gray-200 bg-white p-3 sm:p-4"><div className="mx-auto flex max-w-3xl items-center gap-2"><input type="text" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void handleSend()} placeholder="Ask about products or the store..." disabled={!vendor || Boolean(contextError)} className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" /><button onClick={() => void handleSend()} disabled={loading || !vendor || !input.trim()} title="Send message" aria-label="Send message" className="rounded-xl bg-primary p-3 text-primary-foreground disabled:opacity-50"><Send className="h-5 w-5" /></button></div></div>}

      {selectedItem && <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedItem(null)}><div role="dialog" aria-modal="true" aria-labelledby="item-dialog-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-white p-5 sm:rounded-xl">
        <div className="mb-4 flex items-center justify-between"><h2 id="item-dialog-title" className="font-semibold">{selectedItem.name}</h2><button onClick={() => setSelectedItem(null)} aria-label="Close" className="rounded p-2 hover:bg-gray-100"><X size={18} /></button></div>
        {selectedItem.description && <p className="mb-4 text-sm text-gray-600">{selectedItem.description}</p>}
        {isFood && <label className="mb-4 block text-sm font-medium">Choose an option<select value={selectedOptionId} onChange={(event) => setSelectedOptionId(event.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Select</option>{selectedItem.options?.portions?.map((option) => <option key={option.id} value={option.id}>{option.name} · {money(option.price, vendor?.currency || "NGN")}</option>)}{selectedItem.options?.bundles?.map((option) => <option key={option.id} value={option.id}>{option.name} · {money(option.price, vendor?.currency || "NGN")}</option>)}{selectedItem.options?.servingPrices?.map((option) => <option key={option.servingType} value={option.servingType}>{option.servingType} · {money(option.price, vendor?.currency || "NGN")}</option>)}</select></label>}
        {isTicket && <label className="mb-4 block text-sm font-medium">Ticket type<select value={selectedOptionId} onChange={(event) => setSelectedOptionId(event.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Select ticket type</option>{selectedItem.options?.tickets?.filter((ticket) => ticket.remaining > 0).map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.name} · {money(ticket.price, vendor?.currency || "NGN")} · {ticket.remaining} left</option>)}</select></label>}
        {!isFood && !isTicket && Array.isArray(selectedItem.options?.variants) && selectedItem.options.variants.length > 0 && <label className="mb-4 block text-sm font-medium">Product variant<select value={selectedItem.options.variants.indexOf(selectedVariant || {})} onChange={(event) => setSelectedVariant(selectedItem.options?.variants?.[Number(event.target.value)] || null)} className="mt-1 w-full rounded border p-2">{selectedItem.options.variants.map((variant, index) => { const label = Object.entries(variant).filter(([key, value]) => key !== "price" && value != null && typeof value !== "object").map(([key, value]) => `${key}: ${String(value)}`).join(" · "); return <option key={index} value={index}>{label || `Option ${index + 1}`}{variant.price != null ? ` · ${money(Number(variant.price), vendor?.currency || "NGN")}` : ""}</option>; })}</select></label>}
        {isFood && selectedItem.options?.addOns?.map((group) => <fieldset key={group.name} className="mb-4"><legend className="mb-2 text-sm font-medium">{group.name}{group.required ? " (required)" : ""}</legend>{group.options.map((option) => <label key={option.id} className="flex items-center gap-2 py-1 text-sm"><input type={group.selection === "multiple" ? "checkbox" : "radio"} name={`${selectedItem.id}-${group.name}`} checked={(selectedAddOns[group.name] || []).includes(option.id)} onChange={() => setSelectedAddOns((previous) => ({ ...previous, [group.name]: group.selection === "multiple" ? (previous[group.name] || []).includes(option.id) ? previous[group.name].filter((id) => id !== option.id) : [...(previous[group.name] || []), option.id] : [option.id] }))} />{option.name}{option.price ? ` · ${money(option.price, vendor?.currency || "NGN")}` : ""}</label>)}</fieldset>)}
        <label className="mb-4 block text-sm font-medium">Quantity<input type="number" min={1} max={20} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} className="mt-1 w-full rounded border p-2" /></label>
        <button onClick={addSelectedItem} disabled={Boolean(isFood && selectedItem.options?.addOns?.some((group) => group.required && !(selectedAddOns[group.name]?.length)))} className="w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50">Add to cart</button>
      </div></div>}
    </div>
  );
}
