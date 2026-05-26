# bgremove-app — Dev Patterns & Conventions

## Naming Conventions
- **Components:** PascalCase files, default exports (`ProcessingQueue.tsx`, `ImageCard.tsx`)
- **Lib files:** camelCase (`bgRemoval.ts`, `utils.ts`)
- **API routes:** folder-based (`app/api/save-image/route.ts`)
- **Types:** defined in the component file that owns them, exported if shared (e.g. `ImageJob` from `ProcessingQueue.tsx`)
- **CSS classes:** Tailwind utility-first; custom CSS only in `globals.css`

## Component Structure
- No service layer — logic lives directly in components and route handlers
- Client components: all stateful UI (`'use client'` at top)
- Server components: pages that need auth check or DB access without interactivity (`dashboard/page.tsx`)
- Pattern for SSR-unsafe code: dynamic import (bgRemoval) or extract to a `'use client'` component (ScrollToTopButton)

## Supabase Usage
| Context | Import from | Client type |
|---|---|---|
| Server component / API route | `@/lib/supabase/server` | `createServerClient` + `cookies()` |
| Client component | `@/lib/supabase/client` | `createBrowserClient` |

Never use the server client in a `'use client'` component. Never use the browser client in a server component or route handler.

## API Response Format
- Success: `NextResponse.json({ success: true, ...data })`
- Error: `NextResponse.json({ error: 'message' }, { status: NNN })`
- No envelope wrapper, no versioning prefix

## Validation
- File type + size validated client-side in `Dropzone.tsx` (react-dropzone config + manual filter)
- Re-validated server-side in `app/api/save-image/route.ts`
- Auth validated at the top of every protected route handler (`getUser()` → 401 if null)
- No validation library (no Zod/Yup) — manual checks only

## Styling Conventions
- Use `cn()` from `lib/utils.ts` for all conditional class merging (never bare template literals)
- Brand green: `#00c27a` (primary), `#00a868` (hover), `#34d399` (on dark backgrounds)
- Dark section bg: `#0f1117`
- Light green bg tint: `#e6fff5`
- Letter-spacing tight on headings: `style={{ letterSpacing: '-1px' }}` inline (not a Tailwind class)
- Rounded corners: `rounded-xl` (cards), `rounded-2xl` (larger containers), `rounded-full` (badges/pills)
- Shadows: custom `shadow-[0_4px_14px_rgba(0,194,122,0.35)]` style for green-tinted shadows

## Route Organization
- No auth middleware protection — each page/route does its own `getUser()` check
- `middleware.ts` only refreshes session, not a gatekeeper
- `export const dynamic = 'force-dynamic'` on pages needing fresh auth data (home)
- `export const revalidate = 0` on server pages that must not be cached (dashboard)

## Common Patterns
- Blob URL cleanup: always call `URL.revokeObjectURL` when removing images to prevent memory leaks
- Processing is sequential (for loop, not Promise.all) — intentional for memory management under large batches
- Storage paths always prefixed with `user.id` — matches RLS folder policy
- File naming for processed output: `processedFileName(name)` from `lib/utils.ts` — strips ext, appends `_removed.png`
- `eslint` is disabled during builds (`next.config.js: ignoreDuringBuilds: true`)
