import { NextRequest, NextResponse } from 'next/server';
import { VendorContext, MOCK_VENDOR } from '@/lib/types';

const SYSTEM_PROMPT = (vendor: VendorContext) => `You are an AI sales assistant for ${vendor.vendorName}, a ${vendor.businessType} business. 

Rules:
- You can only sell products from this vendor's catalog.
- You must quote listed prices exactly — no custom discounts unless a coupon is mentioned.
- Respond in a friendly, helpful tone.
- If asked about something outside the catalog, say so politely.
- Currency: ${vendor.currency}.

Available products:
${vendor.products.map((p) => `- ${p.name}: ${vendor.currency} ${p.price} (${p.stock ?? 'available'} in stock) — ${p.description || ''}`).join('\n')}
`;

export async function POST(req: NextRequest) {
  try {
    const { message, vendorId, vendorName, businessType, products } = await req.json();

    const vendor: VendorContext = {
      vendorId: vendorId || MOCK_VENDOR.vendorId,
      vendorName: vendorName || MOCK_VENDOR.vendorName,
      storeUrl: MOCK_VENDOR.storeUrl,
      businessType: businessType || MOCK_VENDOR.businessType,
      currency: MOCK_VENDOR.currency,
      products: products || MOCK_VENDOR.products,
    };

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Mock AI response when no API key
      const lowerMsg = message.toLowerCase();
      let reply = "Thanks for your message! Our team will get back to you soon.";

      if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('how much')) {
        const product = vendor.products.find((p) =>
          lowerMsg.includes(p.name.toLowerCase().split(' ')[0])
        );
        if (product) {
          reply = `${product.name} costs ${vendor.currency} ${product.price}. Currently ${product.stock ?? 'available'} in stock.`;
        } else {
          reply = `Our prices start from ${vendor.currency} ${Math.min(...vendor.products.map((p) => p.price))}. What are you looking for?`;
        }
      } else if (lowerMsg.includes('menu') || lowerMsg.includes('what do you have')) {
        reply = `Here's our menu:\n${vendor.products.map((p) => `- ${p.name}: ${vendor.currency} ${p.price}`).join('\n')}\n\nWhat would you like to order?`;
      } else if (lowerMsg.includes('order') || lowerMsg.includes('buy') || lowerMsg.includes('purchase')) {
        reply = "Great! To place an order, please tell us which product you'd like and the quantity. We'll confirm the total before processing.";
      } else if (lowerMsg.includes('delivery') || lowerMsg.includes('shipping')) {
        reply = 'We offer delivery across our service area. Delivery fees depend on your location. Would you like to check the delivery fee for your address?';
      } else if (lowerMsg.includes('thank')) {
        reply = "You're welcome! Let us know if you need anything else. 😊";
      }

      return NextResponse.json({ reply });
    }

    // Real OpenAI call
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT(vendor) },
        { role: 'user', content: message },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || 'Sorry, I could not process your request.';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ reply: "Sorry, I'm having trouble connecting. Please try again." }, { status: 500 });
  }
}