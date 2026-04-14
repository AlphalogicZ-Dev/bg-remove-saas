import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Remove Image Background Free & Instantly – BgErase',
  description:
    'Remove image backgrounds 100% automatically and free. Upload a photo and get a clean transparent PNG in seconds. No signup required.',
  keywords: ['remove background', 'background remover', 'transparent PNG', 'AI image editor', 'BgErase'],
  openGraph: {
    title: 'Remove Image Background Free & Instantly – BgErase',
    description: 'Remove image backgrounds 100% automatically. Free, fast, no signup required.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white text-gray-900 antialiased min-h-screen font-sans">
        <Navbar />
        {children}
      </body>
    </html>
  )
}
