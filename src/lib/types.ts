export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  vendorId: string;
  imageUrl?: string;
}

export interface VendorContext {
  vendorId: string;
  vendorName: string;
  businessType: string;
  products: { name: string; price: string }[];
}

export const MOCK_VENDOR: VendorContext = {
  vendorId: "fresh-flavours-kitchen",
  vendorName: "Fresh Flavours Kitchen",
  businessType: "Food & Restaurant",
  products: [
    { name: "Jollof Rice", price: "₦2,500" },
    { name: "Grilled Chicken", price: "₦3,200" },
    { name: "Pounded Yam & Egusi", price: "₦2,800" },
    { name: "Suya Plate", price: "₦1,800" },
  ],
};