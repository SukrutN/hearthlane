import type { Metadata } from "next"
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google"
import { ScrollReveal } from "@/components/scroll-reveal"
import "./globals.css"

const display = Space_Grotesk({
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
  metadataBase: new URL("https://sukrutn.github.io/hearthlane"),
  title: {
    default: "Hearthlane, release windows for a robot floor",
    template: "%s. Hearthlane",
  },
  description:
    "Hearthlane plans robot traffic for a fictional warehouse: one joint plan meets every deadline, and each departure window is granted or held with the reason stated.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <ScrollReveal />
      </body>
    </html>
  )
}
