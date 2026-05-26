# bgremove-app — Architecture

## Key Directory Structure

```
bgremove-app/
├── app/                         # Next.js App Router
│   ├── page.tsx                 # Home — force-dynamic, hero + ProcessingQueue
│   ├── layout.tsx               # Root layout: Inter font, Navbar, metadata
│   ├── globals.css              # Tailwind base + custom CSS (.transparent-bg)
│   ├── auth/
│   │   ├── login/page.tsx       # Client — magic link + Google OAuth
│   │   └── callback/route.ts    # Server — exchangeCodeForSession → /dashboard
│   ├── dashboard/page.tsx       # Server — revalidate=0, auth guard, signed URLs
│   └── api/
│       ├── save-image/route.ts  # POST — upload to storage, insert images row
│       └── images/route.ts      # GET (paginated) + DELETE
├── components/
│   ├── ProcessingQueue.tsx      # 'use client' — central state, ImageJob queue
│   ├── Dropzone.tsx             # 'use client' — react-dropzone, JPG/PNG/WebP ≤20MB
│   ├── ImageCard.tsx            # 'use client' — per-image card, download + cloud save
│   ├── BeforeAfterSlider.tsx    # 'use client' — drag slider, clipPath reveal
│   ├── BulkDownload.tsx         # 'use client' — JSZip download all done images
│   ├── Navbar.tsx               # 'use client' — auth state, sign in/out links
│   ├── StunningQuality.tsx      # 'use client' — marketing section, auto-animated slider
│   └── ScrollToTopButton.tsx    # 'use client' — CTA button (needed to avoid SSR onClick)
├── lib/
│   ├── bgRemoval.ts             # removeBackground(file, onProgress?) — WASM, browser-only
│   ├── supabase/
│   │   ├── client.ts            # createBrowserClient — for 'use client' components
│   │   └── server.ts            # createServerClient + cookies() — for server components/routes
│   └── utils.ts                 # cn(), formatFileSize(), processedFileName()
├── middleware.ts                 # Session refresh only — no route protection
├── supabase-schema.sql          # Full DB + storage schema (run once in Supabase SQL editor)
├── next.config.js               # ESLint ignored during builds, nothing else
├── tailwind.config.ts
└── tsconfig.json
```

## Design Patterns
- **No service layer** — logic lives directly in components/routes
- **Client-heavy** — all image processing is client-side; server only handles auth + storage metadata
- **Sequential processing** — `ProcessingQueue` runs jobs one at a time (for loop, not Promise.all). Intentional for memory management
- **Blob URL lifecycle** — `URL.createObjectURL` on add, `URL.revokeObjectURL` on remove/clear. Always paired
- **No state management library** — React `useState`/`useCallback` only

## Middleware / Request Pipeline
1. `middleware.ts` — runs on every request, calls `supabase.auth.getUser()` to refresh session cookie. Does NOT protect routes.
2. Dashboard and API routes each perform their own `auth.getUser()` check.

## Background Jobs / Queues
None. All processing is synchronous in the browser. The `supabase-schema.sql` includes an optional `cleanup_old_images()` Postgres function (delete records >30 days old) intended for a pg_cron or Edge Function schedule — not yet wired up.

## Supabase Schema

### Table: `public.images`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid FK | → auth.users, cascade delete |
| original_path | text | `{userId}/{ts}_original_{safeName}` |
| processed_path | text nullable | `{userId}/{ts}_processed_{safeName}.png` |
| file_name | text | original filename |
| file_size | integer nullable | bytes |
| status | text | 'pending'\|'processing'\|'done'\|'error', default 'done' |
| created_at | timestamptz | now() |

RLS: users can only CRUD their own rows.

### Storage Buckets
| Bucket | Public | Limit | Types |
|---|---|---|---|
| `originals` | false | 20MB | JPG, PNG |
| `processed` | false | 20MB | PNG only |

Storage paths: `{userId}/...`. RLS checks `(storage.foldername(name))[1] = auth.uid()::text`.
Signed URLs (1hr TTL) generated server-side for dashboard display.

## External Integrations
- **Supabase** — auth (magic link + Google OAuth), Postgres DB, private Storage
- **@imgly CDN** — WASM model weights downloaded on first use, then browser-cached
- **Unsplash** — sample images in `StunningQuality.tsx` (hardcoded URLs, marketing only)
- **Google Fonts** — Inter via `next/font/google`
