import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Active Engineering Memory Layer",
  description: "Graph memory for developer agents using FalkorDB, FastMCP, and LangGraph",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
