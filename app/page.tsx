import ProcessingQueue from '@/components/ProcessingQueue'
import StunningQuality from '@/components/StunningQuality'

export default function Home() {
  return (
    <main>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-[#f0fdf8] via-white to-white pt-16 pb-20 px-5">
        <div className="max-w-3xl mx-auto text-center mb-12">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#e6fff5] border border-[#00c27a]/20 rounded-full px-4 py-1.5 text-[#00875a] text-sm font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00c27a] animate-pulse-dot" />
            100% Automatically and Free
          </div>

          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.08] text-gray-900 mb-5" style={{ letterSpacing: '-1.5px' }}>
            Remove Image Background
            <br />
            <span className="text-[#00c27a]">Instantly & Free</span>
          </h1>

          <p className="text-gray-500 text-lg max-w-lg mx-auto leading-relaxed">
            Upload any photo and our AI removes the background in seconds —
            with pixel-perfect precision. No sign-up required.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-7">
            {['JPG & PNG & WebP', 'Multiple images', 'Before/after preview', 'Download PNG', 'Cloud save'].map((f) => (
              <span key={f} className="text-xs text-gray-400 border border-gray-200 rounded-full px-3.5 py-1.5 font-medium bg-white">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Processing queue — main UI */}
        <div className="max-w-4xl mx-auto">
          <ProcessingQueue />
        </div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────────── */}
      <section className="bg-[#00c27a] py-12 px-5">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-6 text-center">
          {[
            { val: '1B+', label: 'Images processed' },
            { val: '5 sec', label: 'Average processing time' },
            { val: 'Free', label: 'For every image' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-4xl sm:text-5xl font-black text-white leading-none mb-1.5" style={{ letterSpacing: '-2px' }}>{s.val}</div>
              <div className="text-sm text-white/75 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── STUNNING QUALITY ───────────────────────────────── */}
      <StunningQuality />

      {/* ── HOW IT WORKS ───────────────────────────────────── */}
      <section className="bg-white py-20 px-5">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block text-xs font-bold tracking-[2px] uppercase text-[#00c27a] mb-3">Simple Process</span>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3" style={{ letterSpacing: '-1px' }}>
            Three steps. Zero effort.
          </h2>
          <p className="text-gray-400 text-lg max-w-md mx-auto mb-12">
            No editing skills required. Just upload and let our AI do the heavy lifting.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { n: '1', title: 'Upload', desc: 'Drag & drop or click to select any JPG, PNG, or WebP. Up to 20MB supported.' },
              { n: '2', title: 'AI Removes Background', desc: 'Our deep learning model runs in your browser — nothing sent to a server.' },
              { n: '3', title: 'Download HD PNG', desc: 'Get your transparent PNG instantly. Sign in to save to the cloud.' },
            ].map((step) => (
              <div key={step.n} className="bg-gray-50 border border-gray-100 rounded-2xl p-7 text-left">
                <div className="w-12 h-12 rounded-xl bg-[#e6fff5] border border-[#00c27a]/20 flex items-center justify-center text-[#00c27a] font-black text-xl mb-5">
                  {step.n}
                </div>
                <h3 className="font-bold text-gray-900 text-base mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── USE CASES ──────────────────────────────────────── */}
      <section className="bg-gray-50 py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold tracking-[2px] uppercase text-[#00c27a] mb-3">Built For Everyone</span>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3" style={{ letterSpacing: '-1px' }}>
              One tool, endless uses
            </h2>
            <p className="text-gray-400 text-lg max-w-md mx-auto">
              From e-commerce to creative projects, removebg fits every workflow.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: '🛍️', bg: '#fef3c7', title: 'E-Commerce', desc: 'Clean white-background product photos that convert. Perfect for Amazon, Shopify & marketplaces.' },
              { icon: '📸', bg: '#dbeafe', title: 'Photography', desc: 'Replace distracting backgrounds in portraits and headshots with professional studio quality.' },
              { icon: '🎨', bg: '#ede9fe', title: 'Design & Creative', desc: 'Extract subjects for marketing materials, presentations, and social media in seconds.' },
              { icon: '🚗', bg: '#d1fae5', title: 'Car Dealerships', desc: 'Swap lot backgrounds with studio environments. Present every vehicle at its best.' },
              { icon: '🐾', bg: '#fee2e2', title: 'Pets & Animals', desc: 'Our AI excels at fur and fine hair. Perfect cutouts for even the fluffiest animals.' },
              { icon: '📱', bg: '#fce7f3', title: 'Social Media', desc: 'Create scroll-stopping content, transparent logos, and on-brand visuals for every platform.' },
            ].map((card) => (
              <div key={card.title} className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-[#00c27a]/40 hover:shadow-[0_6px_24px_rgba(0,194,122,0.1)] transition-all group">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4" style={{ background: card.bg }}>
                  {card.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{card.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="bg-[#0f1117] py-20 px-5 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4" style={{ letterSpacing: '-1px' }}>
            Start removing backgrounds<br />
            <span className="text-[#34d399]">for free, right now.</span>
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            No account needed. No watermarks. Just upload and download your perfect result.
          </p>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            className="inline-flex items-center gap-2.5 bg-[#00c27a] hover:bg-[#00a868] active:scale-95 text-white font-bold text-base px-8 py-4 rounded-xl transition-all shadow-[0_4px_20px_rgba(0,194,122,0.4)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Upload Your Image
          </a>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="bg-[#0f1117] border-t border-white/[0.06] py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <span className="font-bold text-white/80">remove<span className="text-[#00c27a]">bg</span></span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gray-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-gray-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gray-400 transition-colors">Contact</a>
          </div>
          <span className="text-gray-700">© 2025 removebg</span>
        </div>
      </footer>

    </main>
  )
}
