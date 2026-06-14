import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BulkPilot — Bulk Mail Sender",
  description:
    "Configure SMTP, craft templates, upload recipients from Excel, and send personalized bulk mail. All config stored locally in your browser.",
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
