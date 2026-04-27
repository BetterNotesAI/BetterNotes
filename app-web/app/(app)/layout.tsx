import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from './_components/Sidebar'
import { SearchPalette } from './_components/SearchPalette'
import AppBackground from '../components/AppBackground'
import { UserPreferencesSync } from './_components/UserPreferencesSync'
import { LanguageProvider } from '@/lib/i18n'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <LanguageProvider>
      <div className="flex h-screen overflow-hidden text-white relative">
        <UserPreferencesSync />
        <AppBackground />
        <Sidebar />
        <SearchPalette />
        <main className="flex-1 overflow-hidden relative z-10">
          {children}
        </main>
      </div>
    </LanguageProvider>
  )
}
