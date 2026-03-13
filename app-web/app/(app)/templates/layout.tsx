import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Templates",
  description:
    "Browse BetterNotes templates to generate LaTeX summaries, formula sheets, and polished study documents.",
  alternates: {
    canonical: "/templates",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
