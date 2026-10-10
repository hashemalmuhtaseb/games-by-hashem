import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { MeProvider } from "@/client/me";
import { Nav } from "@/components/Nav";

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "PartyVerse", template: "%s · PartyVerse" },
  description: "Real-time party and trivia games: flags, movies, football, rare words and more. Play solo, daily, or with friends.",
};

export const viewport: Viewport = { themeColor: "#0d0d0c", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="font-sans text-[15px] leading-normal">
        <MeProvider>
          <Nav />
          <main>{children}</main>
        </MeProvider>
      </body>
    </html>
  );
}
