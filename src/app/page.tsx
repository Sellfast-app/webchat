import { ChatWidget } from "@/components/ChatWidget";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ storeId?: string }> }) {
  const { storeId } = await searchParams;
  return <ChatWidget storeId={storeId || ""} />;
}
