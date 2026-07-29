import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/Confirm";

export const metadata: Metadata = {
  title: "GMAO CONSUMER CAMEROUN",
  description: "Système de Gestion de Maintenance Assistée par Ordinateur",
  manifest: "/manifest.json",
  icons: { icon: "/icons/icon-192x192.png" },
};

export const viewport: Viewport = {
  themeColor: "#060537",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
