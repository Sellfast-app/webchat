export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  vendorId: string;
}

export interface VendorContext {
  vendorId: string;
  vendorName: string;
  storeUrl: string;
  businessType: 'retail' | 'food' | 'ticketing';
  currency: string;
  products: Product[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  description?: string;
  stock?: number;
}

export const MOCK_VENDOR: VendorContext = {
  vendorId: 'vendor_001',
  vendorName: 'Fresh Flavours Kitchen',
  storeUrl: 'freshflavours.store',
  businessType: 'food',
  currency: 'NGN',
  products: [
    { id: '1', name: 'Jollof Rice', price: 2500, description: 'Spicy Nigerian jollof rice with chicken', stock: 50 },
    { id: '2', name: 'Grilled Chicken', price: 3500, description: 'Smoky grilled chicken with spices', stock: 30 },
    { id: '3', name: 'Pounded Yam & Egusi', price: 4000, description: 'Classic egusi soup with pounded yam', stock: 20 },
    { id: '4', name: 'Suya Plate', price: 3000, description: 'Spiced suya with onions and pepper', stock: 40 },
  ],
};