import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { QueryProvider } from "@/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Facturador Restaurant",
    template: "%s | Facturador Restaurant",
  },
  description: "Facturación y control financiero básico para restaurante.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Facturador",
  },
};

export const viewport: Viewport = {
  themeColor: "#14201b",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <RegisterServiceWorker />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
