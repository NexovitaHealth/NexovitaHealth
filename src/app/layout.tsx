import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Nexovita Health — Clinical Management Platform",
  description:
    "Comprehensive home care, hospice, and palliative care management for agencies and independent practitioners.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-slate-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
