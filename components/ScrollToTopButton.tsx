'use client'

export default function ScrollToTopButton() {
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="inline-flex items-center gap-2.5 bg-[#ff0f50] hover:bg-[#e0003d] active:scale-95 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all shadow-[0_8px_30px_rgba(255,15,80,0.4)]"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      Upload Your Image
    </button>
  )
}
