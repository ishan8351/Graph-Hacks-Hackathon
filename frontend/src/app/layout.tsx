import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Active Engineering Memory Layer",
  description: "Real-time socio-technical graph memory powered by FalkorDB, FastMCP, LangGraph, and Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0e17] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
