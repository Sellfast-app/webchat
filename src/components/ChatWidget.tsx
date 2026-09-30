'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { ChatMessage, VendorContext, MOCK_VENDOR } from '@/lib/types';

interface ChatWidgetProps {
  vendor?: VendorContext;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatWidget({ vendor = MOCK_VENDOR }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! Welcome to ${vendor.vendorName}. How can I help you today?`,
      timestamp: Date.now(),
      vendorId: vendor.vendorId,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      vendorId: vendor.vendorId,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          vendorId: vendor.vendorId,
          vendorName: vendor.vendorName,
          businessType: vendor.businessType,
          products: vendor.products,
        }),
      });

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'Sorry, I could not process your request.',
        timestamp: Date.now() + 1,
        vendorId: vendor.vendorId,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
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
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: '[image]',
        timestamp: Date.now(),
        vendorId: vendor.vendorId,
        imageUrl: reader.result as string,
      };
      setMessages((prev) => [...prev, userMessage]);
    };
    reader.readAsDataURL(file);

    // Reset input so user can send another message
    setInput('');
  };

  return (
    <>
      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Chat with us</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 flex h-[500px] w-80 flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between bg-primary px-4 py-3">
            <div className="flex items-center gap-2">
              <img
                src="/vendor-avatar.jpg"
                alt="Vendor"
                className="h-8 w-8 rounded-full object-cover"
              />
              <span className="text-sm font-semibold text-primary-foreground">{vendor.vendorName}</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-primary-foreground hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white text-gray-900 shadow-sm'
                  }`}
                >
                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="uploaded"
                      className="mb-1 max-h-40 rounded object-cover"
                    />
                  )}
                  {msg.content !== '[image]' && <span>{msg.content}</span>}
                  <div
                    className={`mt-1 text-[10px] ${
                      msg.role === 'user' ? 'text-primary-foreground/70' : 'text-gray-400'
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white p-3">
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-gray-200 px-2 py-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="rounded-lg bg-primary px-3 py-2 text-primary-foreground hover:bg-primary-secondary disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}