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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-black text-xl tracking-tight text-gray-900 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-[#00c27a] rounded-lg flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-white" width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
          remove<span className="text-[#00c27a]">bg</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {!loading && (
            <>
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
                  >
                    My Images
                  </Link>
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut()
                      window.location.href = '/'
                    }}
                    className="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/auth/login"
                    className="text-sm font-semibold bg-[#00c27a] hover:bg-[#00a868] text-white transition-all px-4 py-2 rounded-lg active:scale-95"
                  >
                    Sign Up Free
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
