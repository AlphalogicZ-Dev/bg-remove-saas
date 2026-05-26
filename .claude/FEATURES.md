# bgremove-app — Feature Map

## Core Modules

| Module | Status | Notes |
|---|---|---|
| Background removal (client-side WASM) | existing | `lib/bgRemoval.ts` + `ProcessingQueue`. Model: medium quality. Sequential processing. |
| File upload (drag-and-drop) | existing | `Dropzone.tsx`. JPG/PNG/WebP, max 20MB. Multiple files. |
| Before/after comparison slider | existing | `BeforeAfterSlider.tsx`. Mouse + touch. Used in `ImageCard` (per-result) and `StunningQuality` (marketing). |
| Single image download | existing | `ImageCard.tsx` — anchor click, filename → `_removed.png`. |
| Bulk ZIP download | existing | `BulkDownload.tsx`. JSZip DEFLATE level 6. Shows when >1 image done. |
| Auth — magic link (OTP) | existing | `app/auth/login/page.tsx` → `signInWithOtp`. Passwordless. |
| Auth — Google OAuth | existing | `app/auth/login/page.tsx` → `signInWithOAuth`. Redirect to `/auth/callback`. |
| Cloud save (authenticated) | existing | `ImageCard.tsx` → `POST /api/save-image`. Requires login. Fire-once per image. |
| User dashboard (saved images) | existing | `app/dashboard/page.tsx`. Server component. Signed URL display + individual download. |
| Image deletion from dashboard | existing | `DELETE /api/images` route implemented — removes storage objects + DB row. UI for it in dashboard: **not yet confirmed — dashboard page.tsx doesn't show a delete button**. |
| User account / settings page | not present | No route exists. |
| Pricing / plan management | not present | Dashboard shows hardcoded "Free plan" stat. |
| Bulk cloud save | not present | Only individual per-image save from `ImageCard`. |
| Image history pagination in dashboard | partial | API supports `limit`/`offset`. Dashboard fetches hard limit of 100 with no UI pagination. |
| Processing model selection | not present | Model hardcoded to `medium` in `lib/bgRemoval.ts`. |
| WebP output | not present | Output always PNG regardless of input format. |
| Scheduled cleanup of old images | not wired | `cleanup_old_images()` function exists in schema, not scheduled yet. |
