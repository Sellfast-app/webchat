export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  vendorId: string;
  imageUrl?: string;
  sources?: Array<{ title: string; url: string }>;
}

export interface VendorContext {
  vendorId: string;
  vendorName: string;
  businessType: string;
  logo?: string | null;
  description?: string | null;
  currency: string;
  fulfillmentModes: string[];
  vendorDeliveryRates: Array<{ id: string; location: string; rate: number }>;
  catalog: CatalogItem[];
}

export interface CatalogItem {
  id: string;
  name: string;
  description?: string | null;
  price?: number;
  image?: string | null;
  weight?: number;
  options?: {
    type?: string;
    portions?: Array<{ id: string; name: string; price: number }>;
    servingPrices?: Array<{ servingType: string; price: number }>;
    addOns?: Array<{ id?: string; name: string; required: boolean; selection: string; maxSelection?: number; options: Array<{ id: string; name: string; price: number }> }>;
    bundles?: Array<{ id: string; name: string; price: number }>;
    variants?: Array<Record<string, unknown>>;
    tickets?: Array<{ id: string; name: string; kind: string; price: number; remaining: number }>;
    startsAt?: string;
    endsAt?: string;
    location?: string;
  };
}
