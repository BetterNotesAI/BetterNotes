import { LanguageProvider } from '@/lib/i18n';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
