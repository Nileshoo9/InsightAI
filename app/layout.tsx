import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap"
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f4fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f1a" }
  ]
};

export const metadata: Metadata = {
  title: {
    default: "AI Data Analyst — Instant Business Insights",
    template: "%s | AI Data Analyst"
  },
  description:
    "Upload any CSV or Excel dataset and get AI-powered business insights, trends, and recommendations in seconds.",
  keywords: ["AI", "data analyst", "business insights", "CSV analysis", "dashboard"],
  robots: "index, follow"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
