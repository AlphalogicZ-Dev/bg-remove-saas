# ClearCut — AI Background Remover

A production-ready SaaS app for removing image backgrounds. Built with **Next.js 14**, **Supabase**, and deployed on **Vercel** — entirely free for MVP scale.

Background removal runs **100% in the browser** via WebAssembly (`@imgly/background-removal`). No server compute costs, ever.

---

## Features

- Drag & drop upload (single + multiple images)
- Real-time before/after comparison slider
- Bulk ZIP download
- Optional Google + magic-link auth (Supabase)
- Cloud storage for processed images (Supabase Storage)
- Mobile-friendly, premium dark UI

---

## Tech Stack

| Layer | Tech | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server components, API routes, edge middleware |
| Hosting | Vercel (free) | Zero-config deploys, global CDN |
| Auth | Supabase Auth | Google OAuth + magic links out of the box |
| Database | Supabase Postgres | Row-level security, free 500MB |
| Storage | Supabase Storage | S3-compatible, free 1GB |
| BG Removal | @imgly/background-removal | WASM, runs in browser, 100% free |
| ZIP | JSZip | Client-side ZIP generation |
| UI | Tailwind CSS | Utility-first, no runtime cost |

---

## Setup

### 1. Clone & install

```bash
git clone <your-repo>
cd bgremove-app
npm install
```

### 2. Create Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Go to **SQL Editor** → paste the entire contents of `supabase-schema.sql` → Run
3. Go to **Authentication** → Providers → enable **Google** (needs Google Cloud OAuth credentials)
4. Go to **Settings** → API → copy your **Project URL** and **anon key**

### 3. Set environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> **Note:** The first background removal takes 10–30 seconds to download the ~40MB AI model. After that it's cached in your browser.

---

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm i -g vercel
vercel login

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Deploy
vercel --prod
```

### Option B — GitHub integration (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Add the 3 environment variables in the Vercel dashboard
4. Click Deploy

### Custom domain

In Vercel → your project → **Settings** → **Domains** → add your domain.
Vercel shows you the DNS records to add. SSL is automatic.

### Supabase redirect URL

In Supabase → **Authentication** → **URL Configuration** → add:
```
https://yourdomain.com/auth/callback
```

---

## Project Structure

```
bgremove-app/
├── app/
│   ├── layout.tsx              # Root layout + font
│   ├── page.tsx                # Home / upload page
│   ├── globals.css
│   ├── auth/
│   │   ├── login/page.tsx      # Sign in (Google + magic link)
│   │   └── callback/route.ts   # OAuth callback handler
│   ├── dashboard/
│   │   └── page.tsx            # Saved images (auth-protected)
│   └── api/
│       ├── save-image/route.ts # Upload to Supabase Storage
│       └── images/route.ts     # Fetch / delete images
├── components/
│   ├── Navbar.tsx
│   ├── Dropzone.tsx
│   ├── ProcessingQueue.tsx     # Main state machine
│   ├── ImageCard.tsx           # Per-image card + slider
│   ├── BeforeAfterSlider.tsx   # Interactive comparison
│   └── BulkDownload.tsx        # ZIP generator
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser Supabase client
│   │   └── server.ts           # Server Supabase client
│   ├── bgRemoval.ts            # WASM wrapper
│   └── utils.ts
├── middleware.ts               # Route protection
├── supabase-schema.sql         # Run this in Supabase SQL editor
├── .env.local.example
├── next.config.js              # WASM + COEP/COOP headers
└── tailwind.config.ts
```

---

## Free Tier Limits

| Service | Limit | Notes |
|---|---|---|
| Vercel | 100GB bandwidth/mo | Plenty for MVP |
| Vercel | 100k serverless calls/mo | Only auth + save calls hit this |
| Supabase DB | 500MB | Metadata only — tiny |
| Supabase Storage | 1GB | ~2,000–5,000 images |
| Supabase Auth | 50,000 MAU | More than enough |
| @imgly/background-removal | Unlimited | Runs in user's browser |

**The app hits Supabase Storage limits first.** At that point, either upgrade to Supabase Pro ($25/mo) or implement a cleanup cron using the `cleanup_old_images()` SQL function included in the schema.

---

## Scaling Path

1. **Supabase Pro ($25/mo)** — 8GB storage, no project pausing, daily backups
2. **Vercel Pro ($20/mo)** — unlimited bandwidth, 1TB included
3. **Cloudflare R2** — replace Supabase Storage for $0.015/GB + zero egress fees
4. **remove.bg API** — offer as a premium tier for higher quality results (50 free credits/mo)

---

## Local Development Notes

The WASM background removal requires two special HTTP headers (`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`). These are configured in `next.config.js` and applied automatically in both development and production.

If you see a blank/failing WASM load, check the browser console for header-related errors.
