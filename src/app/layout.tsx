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
      <head>
        <link rel="preload" href="/fonts/inter-4.1/InterVariable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
