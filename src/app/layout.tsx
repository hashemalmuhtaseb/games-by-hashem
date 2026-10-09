import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MeProvider } from "@/client/me";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: { default: "PartyVerse — party games that never repeat", template: "%s · PartyVerse" },
  description: "Real-time party and trivia games: flags, movies, football, rare words and more. Play solo, daily, or with friends.",
};

export const viewport: Viewport = { themeColor: "#07060d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans">
        <MeProvider>
          <Nav />
          <main>{children}</main>
        </MeProvider>
      </body>
    </html>
  );
}
