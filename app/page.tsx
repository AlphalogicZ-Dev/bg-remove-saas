import ProcessingQueue from '@/components/ProcessingQueue'

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-16">
      {/* Hero Section */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-violet-300 text-sm mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          100% free — runs entirely in your browser
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-5 leading-tight">
          Remove backgrounds
          <br />
          <span className="text-violet-400">in seconds</span>
        </h1>

        <p className="text-white/50 text-lg max-w-md mx-auto leading-relaxed">
          Drop any image. AI removes the background instantly — no signup,
          no watermarks, no limits.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          {['JPG & PNG support', 'Multiple images', 'Before/after slider', 'Bulk ZIP download', 'Cloud save'].map(
            (f) => (
              <span
                key={f}
                className="text-xs text-white/40 border border-white/10 rounded-full px-3 py-1"
              >
                {f}
              </span>
            )
          )}
        </div>
      </div>

      {/* Processing Queue — the main UI */}
      <ProcessingQueue />

      {/* How it works */}
      <section className="mt-24 text-center">
        <h2 className="text-2xl font-semibold mb-10 text-white/80">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              title: 'Upload',
              desc: 'Drag & drop or click to upload one or multiple JPG/PNG images.',
            },
            {
              step: '02',
              title: 'Process',
              desc: 'Our AI model runs directly in your browser — nothing is sent to a server.',
            },
            {
              step: '03',
              title: 'Download',
              desc: 'Preview before/after, download individual PNGs or a bulk ZIP.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 text-left"
            >
              <span className="text-xs font-mono text-violet-400 mb-3 block">{item.step}</span>
              <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-20 border-t border-white/8 pt-8 flex items-center justify-between text-xs text-white/25">
        <span>ClearCut — Built with Next.js + Supabase</span>
        <span>Processing powered by @imgly/background-removal (WASM)</span>
      </footer>
    </main>
  )
}
