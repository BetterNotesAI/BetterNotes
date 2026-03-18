import { createClient } from '@/lib/supabase/server'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">My Documents</h1>
          <span className="text-sm text-gray-400">{user?.email}</span>
        </div>

        <div className="border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500 text-sm">
            No documents yet. Generation coming in M3.
          </p>
        </div>
      </div>
    </div>
  )
}
