# bgremove-app — Claude Project Guide

## Project Overview
A Next.js 14 (App Router) background removal web app. Users upload images and the AI removes backgrounds entirely client-side via WebAssembly (no server processing). Optional Supabase auth allows cloud saving processed images.

## Tech Stack
- **Framework**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Background removal**: `@imgly/background-removal` — runs in the browser via WASM (~40MB model, cached after first use)
- **Auth & storage**: Supabase (`@supabase/ssr` v0.3.0)
- **UI utilities**: `clsx` + `tailwind-merge` for conditional classes, `react-dropzone` for uploads, `jszip` for bulk download

## Directory Structure
```
app/
  page.tsx              # Home — hero, ProcessingQueue, StunningQuality sections
  layout.tsx            # Root layout with Navbar
  auth/
    login/page.tsx      # Login page
    callback/           # Supabase OAuth callback
  dashboard/page.tsx    # User dashboard (saved images)
  api/
    save-image/         # API route: saves processed image to Supabase storage
    images/             # API route: fetches user's saved images
components/
  ProcessingQueue.tsx   # Main upload + processing UI (client component)
  Dropzone.tsx          # File drag-and-drop input
  ImageCard.tsx         # Single image result card with before/after
  BeforeAfterSlider.tsx # Interactive before/after comparison slider
  BulkDownload.tsx      # ZIP download for multiple images
  StunningQuality.tsx   # Marketing section
  Navbar.tsx            # Top navigation
  ScrollToTopButton.tsx # Client component for CTA scroll (avoids SSR onClick error)
lib/
  bgRemoval.ts          # Wraps @imgly/background-removal; dynamic import avoids SSR issues
  supabase/
    client.ts           # Browser Supabase client
    server.ts           # Server Supabase client (uses cookies())
  utils.ts              # Shared utilities (cn helper etc.)
middleware.ts           # Supabase session refresh on every request
```

## Key Patterns & Constraints

### Client vs Server Components
- Background removal (`lib/bgRemoval.ts`) **must only run in the browser** — always use dynamic import or `'use client'` components.
- `export const dynamic = 'force-dynamic'` on pages that need fresh Supabase auth data.
- Any component with `onClick`, `useState`, or browser APIs needs `'use client'` directive.

### Supabase
- Server-side: always use `lib/supabase/server.ts` (`createClient` with cookies).
- Client-side: always use `lib/supabase/client.ts`.
- Middleware (`middleware.ts`) refreshes the session — do not remove or skip it.
- Auth callback route is at `/auth/callback`.

### Styling
- Brand green: `#00c27a` (primary), `#34d399` (on dark backgrounds)
- Dark bg: `#0f1117`
- Use `clsx`/`tailwind-merge` via the `cn()` util from `lib/utils.ts` for conditional class merging.
- Font: Inter (variable font, loaded in layout).

## Dev Commands
```bash
npm run dev     # Start dev server (localhost:3000)
npm run build   # Production build
npm run lint    # ESLint
```

## Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
