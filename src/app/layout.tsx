import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swiftree Webchat",
  description: "AI-powered chat widget for Swiftree vendors",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}