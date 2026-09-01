import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mente Locale — Restaurant OS",
  description: "Sistema operativo per ristoranti: tavoli, prenotazioni, KDS, HACCP e IA.",
  applicationName: "Mente Locale",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/api/logo?s=192", sizes: "192x192", type: "image/jpeg" },
      { url: "/api/logo?s=512", sizes: "192x192", type: "image/jpeg" },
    ],
    apple: [{ url: "/api/logo?s=180", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Mente Locale",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050507",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <link rel="apple-touch-icon" href="/api/logo?s=180" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Mente Locale" />
      </head>
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
