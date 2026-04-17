import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'BetterNotes — Study Documents with AI', template: '%s | BetterNotes' },
  description: 'Generate beautiful study documents, formula sheets, and PDFs in seconds — powered by AI and LaTeX.',
  icons: { icon: '/brand/logo.png', apple: '/brand/logo.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
