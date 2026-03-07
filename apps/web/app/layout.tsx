import "./globals.css";
import type { Metadata } from "next";
import { createClient } from "../lib/supabase/server";
import { Navbar } from "../components/navbar";

export const metadata: Metadata = {
  title: "BetterNotes MVP",
  description: "Turn raw notes into clean LaTeX + PDF with Stripe-powered subscriptions."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="bg-grid bg-grid">
        <Navbar isLoggedIn={Boolean(user)} />
        <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
