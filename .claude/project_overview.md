---
name: bgremove-app project overview
description: Core stack, purpose, and structure of the bgremove-app project
type: project
---

Next.js 14 (App Router) background removal SaaS app. Users upload images; backgrounds are removed client-side via `@imgly/background-removal` (WASM, ~40MB model). Optional Supabase auth lets users save results to cloud storage.

**Why:** Fully client-side processing — no server costs per image, works offline after model is cached.

**How to apply:** Never suggest moving background removal to a server route. Keep `lib/bgRemoval.ts` browser-only with dynamic imports.

## Stack
- Next.js 14, TypeScript, Tailwind CSS
- @imgly/background-removal v1.4.5 (WASM, browser-only)
- Supabase (@supabase/ssr v0.3.0) for auth + storage
- clsx + tailwind-merge, react-dropzone, jszip
