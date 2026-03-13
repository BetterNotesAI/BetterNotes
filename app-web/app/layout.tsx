import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "./components/AppProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://betternotes.ai";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BetterNotes AI — Turn Notes Into LaTeX + PDF",
    template: "%s | BetterNotes",
  },
  description:
    "BetterNotes AI converts messy notes into clean LaTeX documents, formula sheets, summaries, and PDF exports in seconds.",
  keywords: [
    "BetterNotes",
    "BetterNotes AI",
    "AI notes generator",
    "LaTeX notes",
    "LaTeX cheatsheet generator",
    "formula sheet generator",
    "study notes AI",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: "BetterNotes AI — Turn Notes Into LaTeX + PDF",
    description:
      "Convert lecture notes into polished LaTeX summaries, cheatsheets, and PDFs with AI.",
    siteName: "BetterNotes",
    type: "website",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "BetterNotes AI — Turn Notes Into LaTeX + PDF",
    description:
      "Convert lecture notes into polished LaTeX summaries, cheatsheets, and PDFs with AI.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
