export const dynamic = 'force-dynamic'

import ProcessingQueue from '@/components/ProcessingQueue'
import StunningQuality from '@/components/StunningQuality'
import ScrollToTopButton from '@/components/ScrollToTopButton'

export default function Home() {
  return (
    <main>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative bg-[#0f1117] overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-[#ff0f50] opacity-[0.05] blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#FFD60A] opacity-[0.04] blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* LEFT */}
          <div className="flex flex-col justify-center lg:pt-8 lg:pb-16">
            <div className="inline-flex items-center gap-2.5 self-start bg-white/[0.05] border border-white/[0.09] rounded-full px-4 py-2 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff0f50] animate-pulse flex-shrink-0" />
              <span className="text-xs text-gray-400 font-medium tracking-wide">AI-powered · 100% in-browser · Private</span>
            </div>

            <h1 className="text-5xl sm:text-6xl xl:text-7xl font-black text-white leading-[1.04] mb-6" style={{ letterSpacing: '-2.5px' }}>
              Remove Image<br />Background<br />
              <span className="text-[#ff0f50]">Instantly.</span>
            </h1>

            <p className="text-gray-400 text-lg sm:text-xl leading-relaxed max-w-md">
              Upload any photo and our AI removes the background in seconds —
              with pixel-perfect precision.
            </p>
          </div>

          {/* RIGHT — drop zone card */}
          <div className="lg:sticky lg:top-24">
            <div className="bg-white rounded-3xl p-6 sm:p-8" style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)' }}>
              <ProcessingQueue />
            </div>
          </div>
        </div>
      </section>

      {/* ── STUNNING QUALITY ─────────────────────────────────── */}
      <StunningQuality />

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="relative bg-[#0a0a0f] py-28 px-5 overflow-hidden">
        {/* Background number watermarks */}
        <div className="absolute inset-0 flex items-center justify-around pointer-events-none select-none overflow-hidden">
          {['01', '02', '03'].map((n) => (
            <span key={n} className="text-[200px] sm:text-[280px] font-black text-white/[0.02] leading-none">
              {n}
            </span>
          ))}
        </div>

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[3px] uppercase text-[#ff0f50] mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff0f50]" />
              Simple Process
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-4" style={{ letterSpacing: '-1.5px' }}>
              Three steps.<br className="sm:hidden" /> Zero effort.
            </h2>
            <p className="text-gray-500 text-lg max-w-sm mx-auto">
              No editing skills required. Just upload and let the AI do its job.
            </p>
          </div>

          {/* Steps */}
          <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Connecting line (desktop) */}
            <div className="hidden sm:block absolute top-[52px] left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

            {[
              {
                n: '01',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                ),
                title: 'Upload',
                desc: 'Drag & drop or click to select any JPG, PNG, or WebP up to 20 MB.',
                accent: '#ff0f50',
                glow: 'rgba(255,15,80,0.2)',
              },
              {
                n: '02',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                  </svg>
                ),
                title: 'AI Removes Background',
                desc: 'Our deep-learning model runs entirely in your browser. Nothing leaves your device.',
                accent: '#FFD60A',
                glow: 'rgba(255,214,10,0.2)',
              },
              {
                n: '03',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                ),
                title: 'Download HD PNG',
                desc: 'Get a crisp, full-resolution transparent PNG instantly. No watermarks.',
                accent: '#a78bfa',
                glow: 'rgba(167,139,250,0.2)',
              },
            ].map((step) => (
              <div
                key={step.n}
                className="relative bg-white/[0.03] border border-white/[0.07] rounded-3xl p-8 hover:bg-white/[0.05] transition-all duration-300 group"
                style={{ boxShadow: `0 0 0 0 ${step.glow}` }}
              >
                {/* Step number top-right */}
                <span className="absolute top-6 right-7 text-xs font-black text-white/10 tracking-widest">{step.n}</span>

                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-7 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${step.accent}18`, color: step.accent, boxShadow: `0 8px 24px ${step.glow}` }}
                >
                  {step.icon}
                </div>

                <h3 className="text-white font-bold text-lg mb-3" style={{ letterSpacing: '-0.3px' }}>{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>

                {/* Bottom accent line */}
                <div
                  className="absolute bottom-0 left-8 right-8 h-[1.5px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(to right, transparent, ${step.accent}, transparent)` }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BUILT FOR EVERYONE ───────────────────────────────── */}
      <section className="relative bg-[#0f1117] py-28 px-5 overflow-hidden">
        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Center glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-[#ff0f50] opacity-[0.04] blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[3px] uppercase text-[#FFD60A] mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFD60A]" />
              Built For Everyone
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-4" style={{ letterSpacing: '-1.5px' }}>
              One tool,<br className="sm:hidden" /> endless uses.
            </h2>
            <p className="text-gray-500 text-lg max-w-sm mx-auto">
              From e-commerce to creative projects, BgErase fits every workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                emoji: '🛍️',
                gradient: 'from-amber-500/20 to-orange-500/5',
                border: 'hover:border-amber-500/30',
                glow: 'hover:shadow-[0_8px_32px_rgba(245,158,11,0.12)]',
                title: 'E-Commerce',
                desc: 'Clean white-background product photos that convert on Amazon, Shopify, and every marketplace.',
              },
              {
                emoji: '📸',
                gradient: 'from-blue-500/20 to-blue-600/5',
                border: 'hover:border-blue-500/30',
                glow: 'hover:shadow-[0_8px_32px_rgba(59,130,246,0.12)]',
                title: 'Photography',
                desc: 'Replace distracting backgrounds in portraits and headshots with professional studio quality.',
              },
              {
                emoji: '🎨',
                gradient: 'from-purple-500/20 to-violet-600/5',
                border: 'hover:border-purple-500/30',
                glow: 'hover:shadow-[0_8px_32px_rgba(139,92,246,0.12)]',
                title: 'Design & Creative',
                desc: 'Extract subjects for marketing materials, presentations, and social media in seconds.',
              },
              {
                emoji: '🚗',
                gradient: 'from-[#ff0f50]/20 to-rose-600/5',
                border: 'hover:border-[#ff0f50]/30',
                glow: 'hover:shadow-[0_8px_32px_rgba(255,15,80,0.12)]',
                title: 'Car Dealerships',
                desc: 'Swap lot backgrounds with studio environments. Present every vehicle at its best.',
              },
              {
                emoji: '🐾',
                gradient: 'from-pink-500/20 to-pink-600/5',
                border: 'hover:border-pink-500/30',
                glow: 'hover:shadow-[0_8px_32px_rgba(236,72,153,0.12)]',
                title: 'Pets & Animals',
                desc: 'Our AI excels at fur and fine hair. Perfect cutouts for even the fluffiest animals.',
              },
              {
                emoji: '📱',
                gradient: 'from-[#FFD60A]/20 to-yellow-500/5',
                border: 'hover:border-[#FFD60A]/30',
                glow: 'hover:shadow-[0_8px_32px_rgba(255,214,10,0.12)]',
                title: 'Social Media',
                desc: 'Create scroll-stopping content, transparent logos, and on-brand visuals for every platform.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className={`relative bg-white/[0.03] border border-white/[0.07] rounded-3xl p-7 transition-all duration-300 group overflow-hidden ${card.border} ${card.glow}`}
              >
                {/* Gradient wash on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl`} />

                <div className="relative z-10">
                  {/* Large emoji */}
                  <div className="text-4xl mb-5 transition-transform duration-300 group-hover:scale-110 origin-left">
                    {card.emoji}
                  </div>
                  <h3 className="text-white font-bold text-base mb-2" style={{ letterSpacing: '-0.2px' }}>{card.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="relative bg-[#0a0a0f] py-28 px-5 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(255,15,80,0.09),transparent)] pointer-events-none" />
        <div className="relative max-w-xl mx-auto">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-5" style={{ letterSpacing: '-1.5px' }}>
            Start removing backgrounds<br />
            <span className="text-[#FFD60A]">for free, right now.</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10">
            No account needed. No watermarks. Just upload and download your perfect result.
          </p>
          <ScrollToTopButton />
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-[#0a0a0f] border-t border-white/[0.05] py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <span className="font-black text-lg text-white"><span>Bg</span><span className="text-[#ff0f50]">Erase</span></span>
          <span className="text-gray-700">© 2026 BgErase. All rights reserved.</span>
        </div>
      </footer>

    </main>
  )
}
