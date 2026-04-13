'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <nav className="border-b border-white/[0.08] px-6 py-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-[#0a0a0a]/80">
      {/* Logo */}
      <Link href="/" className="font-semibold text-lg tracking-tight hover:opacity-80 transition-opacity">
        <span className="text-white">Clear</span>
        <span className="text-violet-400">Cut</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-2">
        {!loading && (
          <>
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm text-white/60 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
                >
                  My images
                </Link>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut()
                    window.location.href = '/'
                  }}
                  className="text-sm text-white/40 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="text-sm bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-2 rounded-lg font-medium"
              >
                Sign in
              </Link>
            )}
          </>
        )}
      </div>
    </nav>
  )
}
