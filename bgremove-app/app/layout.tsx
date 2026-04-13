import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ClearCut — AI Background Remover',
  description:
    'Remove image backgrounds instantly with AI. Free, fast, no signup required. Supports JPG and PNG.',
  keywords: ['background remover', 'remove background', 'AI image editor', 'transparent PNG'],
  openGraph: {
    title: 'ClearCut — AI Background Remover',
    description: 'Remove image backgrounds instantly. Free, fast, no signup required.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#0a0a0a] text-white antialiased min-h-screen">
        <Navbar />
        {children}
      </body>
    </html>
  )
}
