import { NextRequest, NextResponse } from "next/server";
import { VendorContext, MOCK_VENDOR } from "@/lib/types";

const SYSTEM_PROMPT = (vendor: VendorContext) =>
  `You are an AI sales assistant for ${vendor.vendorName}, a ${vendor.businessType} vendor. 
Available products: ${vendor.products.map((p) => `${p.name} (${p.price})`).join(", ")}.
Always reference these products and prices when helping customers. Do not invent prices.`;

export async function POST(req: NextRequest) {
  try {
    const { message, vendorId, vendorName, businessType, products } =
      await req.json();

    const vendor: VendorContext = {
      vendorId,
      vendorName,
      businessType,
      products,
    };

    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      const replies: Record<string, string> = {
        "fresh-flavours-kitchen":
          "Welcome to Fresh Flavours Kitchen! We serve Jollof Rice (₦2,500), Grilled Chicken (₦3,200), Pounded Yam & Egusi (₦2,800), and Suya Plate (₦1,800). What would you like to order?",
      };
      return NextResponse.json({
        reply:
          replies[vendorId] ||
          `Hello! Welcome to ${vendorName}. How can I help you today?`,
      });
    }

    const { OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: openaiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: SYSTEM_PROMPT(vendor) },
        { role: "user", content: message },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    return NextResponse.json({
      reply: completion.choices[0]?.message?.content || "Sorry, I could not process your request.",
    });
  } catch {
    return NextResponse.json(
      { reply: "Sorry, I'm having trouble connecting. Please try again." },
      { status: 500 }
    );
  }
}