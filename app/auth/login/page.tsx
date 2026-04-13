'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto mt-24 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#e6fff5] flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-[#00c27a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
        <p className="text-gray-500 leading-relaxed">
          We sent a magic link to{' '}
          <span className="text-[#00c27a] font-semibold">{email}</span>.
          <br />Click the link to sign in.
        </p>
        <button onClick={() => setSent(false)} className="mt-5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="mb-7">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm transition-colors flex items-center gap-1.5 mb-4">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h2 className="text-2xl font-black text-gray-900" style={{ letterSpacing: '-0.5px' }}>Sign in to removebg</h2>
          <p className="text-gray-400 text-sm mt-1.5">Save your processed images and access them anywhere</p>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-xl active:scale-[0.99] transition-all disabled:opacity-50 mb-4"
        >
          {googleLoading
            ? <span className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
            : <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
          }
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-4">
          <hr className="flex-1 border-gray-200" />
          <span className="text-gray-300 text-xs font-medium">or email</span>
          <hr className="flex-1 border-gray-200" />
        </div>

        <form onSubmit={handleMagicLink} className="space-y-3">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-[#00c27a] focus:ring-2 focus:ring-[#00c27a]/15 transition-all text-sm"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-[#00c27a] hover:bg-[#00a868] active:scale-[0.99] transition-all py-3 px-4 rounded-xl font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {loading
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                  Sending…
                </span>
              : 'Send magic link'
            }
          </button>
        </form>
        <p className="text-gray-300 text-xs text-center mt-5">No password needed — we&apos;ll email you a one-click sign in link.</p>
      </div>
    </div>
  )
}
