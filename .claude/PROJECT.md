# bgremove-app — Project Overview

## Purpose
A remove.bg clone that lets users upload images and have backgrounds removed entirely in-browser via WebAssembly AI — no server processing. Optional Supabase auth enables cloud saving of processed images.

## Tech Stack
- **Framework:** Next.js 14.2.3 (App Router)
- **Language:** TypeScript 5.4.5
- **Database:** Supabase (Postgres) — no ORM, raw Supabase JS client
- **Auth:** Supabase Auth — magic link (OTP) + Google OAuth via `@supabase/ssr` v0.3.0
- **Key Packages:**
  - `@imgly/background-removal` v1.4.5 — WASM AI model running in browser (~40MB, CDN-cached)
  - `@supabase/ssr` v0.3.0 — SSR-safe Supabase client (server + browser variants)
  - `react-dropzone` v14.2.3 — file drag-and-drop
  - `jszip` v3.10.1 — bulk ZIP download
  - `clsx` + `tailwind-merge` — conditional class utility via `cn()`

## Auth Guards / Roles

| Role | Where enforced | Access |
|---|---|---|
| Guest | None (middleware only refreshes session) | Home page, bg removal, download |
| Authenticated user | `app/dashboard/page.tsx` (`redirect` if no user) | Dashboard, cloud save |
| Authenticated user | `app/api/save-image/route.ts` (401 if no user) | POST /api/save-image |
| Authenticated user | `app/api/images/route.ts` (401 if no user) | GET/DELETE /api/images |

No roles beyond guest vs authenticated. No admin panel.

## API / Route Structure

| Route | Method | Auth | Description |
|---|---|---|---|
| `/` | GET | none | Home — hero + processing UI |
| `/auth/login` | GET | none | Magic link + Google OAuth form |
| `/auth/callback` | GET | none | Supabase code exchange → redirect to `/dashboard` |
| `/dashboard` | GET | required | User's saved images |
| `/api/save-image` | POST | required | Upload original + processed to Supabase Storage, insert DB row |
| `/api/images` | GET | required | Paginated list of user's images (`limit`, `offset`) |
| `/api/images` | DELETE | required | Delete image by `id` (JSON body) — removes storage + DB row |

No API versioning. No `/api/v1/` prefix.
