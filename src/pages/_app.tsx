import type { AppProps } from "next/app";
import { Cormorant_Garamond, DM_Sans, DM_Mono } from "next/font/google";
import "@/styles/globals.css";

// Self-hosted at build time by next/font, so no third-party font requests (keeps CSP strict).
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-cormorant" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`app-root ${cormorant.variable} ${dmSans.variable} ${dmMono.variable}`}>
      <Component {...pageProps} />
    </div>
  );
}
