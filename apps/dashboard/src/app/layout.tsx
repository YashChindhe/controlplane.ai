import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ControlPlane.ai - Real-Time AI Output Governance Dashboard",
  description: "Governance control center for Tri-Guard proxy engine to monitor AI model cost, performance, and responsibility metrics in real time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
