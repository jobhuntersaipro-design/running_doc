import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/components/arc/foundation.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KLSCM 2026 race plan",
  description: "Pace, fuel and course guidance for the Kuala Lumpur Standard Chartered Marathon half marathon.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
