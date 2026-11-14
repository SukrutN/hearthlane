import type { Metadata } from "next"
import { IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google"
import "./globals.css"

const display = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
})

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-plex",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Hearthlane — traffic windows for the AMR floor",
    template: "%s — Hearthlane",
  },
  description:
    "Hearthlane walks a fictional casting hall's release gate: a joint plan meets every deadline, the congestion map says where the tree split, and each window ask is fired or held with the reason journaled.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
