"use client";

import { useState, useRef, useEffect } from "react";
import { Send, X, Loader2, Image as ImageIcon } from "lucide-react";
import { ChatMessage, VendorContext, MOCK_VENDOR } from "@/lib/types";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ChatWidgetProps {
  vendor?: VendorContext;
}

export function ChatWidget({ vendor = MOCK_VENDOR }: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content: `Hello! Welcome to ${vendor.vendorName}. How can I help you today?`,
      timestamp: Date.now(),
      vendorId: vendor.vendorId,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
      vendorId: vendor.vendorId,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input.trim(),
          vendorId: vendor.vendorId,
          vendorName: vendor.vendorName,
          businessType: vendor.businessType,
          products: vendor.products,
        }),
      });
      const data = await res.json();
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply || "Sorry, I could not process your request.",
        timestamp: Date.now() + 1,
        vendorId: vendor.vendorId,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I'm having trouble connecting. Please try again.",
        timestamp: Date.now() + 1,
        vendorId: vendor.vendorId,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const msg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: "[image]",
        timestamp: Date.now(),
        vendorId: vendor.vendorId,
        imageUrl: reader.result as string,
      };
      setMessages((prev) => [...prev, msg]);
    };
    reader.readAsDataURL(file);
    setInput("");
  };

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between bg-primary px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src="/vendor-avatar.jpg"
            alt="Vendor"
            className="h-10 w-10 rounded-full object-cover ring-2 ring-primary-foreground/20"
          />
          <div>
            <h2 className="text-base font-semibold text-primary-foreground">
              {vendor.vendorName}
            </h2>
            <p className="text-xs text-primary-foreground/70">
              {vendor.businessType}
            </p>
          </div>
        </div>
        <a
          href="/"
          className="rounded-lg bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-foreground/20"
        >
          Back to Store
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-xl px-4 py-3 text-sm shadow-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-white text-gray-900 shadow"
                }`}
              >
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="uploaded"
                    className="mb-2 max-h-60 rounded-lg object-cover"
                  />
                )}
                {msg.content !== "[image]" && <span>{msg.content}</span>}
                <div
                  className={`mt-2 text-[10px] ${
                    msg.role === "user"
                      ? "text-primary-foreground/70"
                      : "text-gray-400"
                  }`}
                >
                  {formatTime(msg.timestamp)}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl bg-white px-4 py-3 shadow">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-gray-200 p-2.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-primary px-4 py-3 text-primary-foreground hover:bg-primary-secondary disabled:opacity-50 transition-colors"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}