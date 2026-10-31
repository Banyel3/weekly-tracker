import type { Metadata } from "next";
import { Geist } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Weekly Tracker",
};

const THEME_IDS = ["cosmic-night", "mocha-mousse", "catppuccin", "graphite", "northern-lights", "amethyst-haze"];
const themeScript = `try{var t=localStorage.getItem("theme");if(${JSON.stringify(THEME_IDS)}.indexOf(t)>=0)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={geist.variable} data-theme="cosmic-night" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
