# bgremove-app — Working Memory

## Current Task
Initial project scan & `.claude/` setup — COMPLETE

## Status
- [x] Detected tech stack from `package.json` and `next.config.js`
- [x] Read all components, lib files, app routes, and Supabase schema
- [x] Populated PROJECT.md, ARCHITECTURE.md, FEATURES.md, SKILLS.md, MEMORY.md

## Open Questions
1. **`globals.css`** — References `.transparent-bg` and `.transparent-bg-dark` CSS classes (used in `BeforeAfterSlider` and `dashboard`). Content not read — read `app/globals.css` to know checkerboard CSS definitions.
2. **Delete button in dashboard UI** — `DELETE /api/images` route exists and is fully implemented, but `app/dashboard/page.tsx` has no delete button in the UI. Either not wired up or planned.
3. **`tailwind.config.ts`** — Not read. Contains `animate-pulse-dot` custom animation (referenced in `app/page.tsx`). Read if modifying animations or adding custom Tailwind utilities.
4. **`.env` / `.env.local`** — Not read. Assumed to contain `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` only.

## Notes
- Reset this file when starting a new task
- All source files have been read once — do not re-read unless a file has changed
