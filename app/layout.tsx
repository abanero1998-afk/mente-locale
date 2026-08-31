import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mente Locale — Restaurant OS",
  description: "Sistema operativo per ristoranti: tavoli, prenotazioni, KDS, HACCP e IA.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05070A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
