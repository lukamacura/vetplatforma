---
name: Suspense useSearchParams Pattern
description: useSearchParams() in Next.js 16 requires Suspense boundary or build fails
type: feedback
---

Any page that calls `useSearchParams()` must be wrapped in a `<Suspense>` boundary, otherwise Next.js 16 static page generation fails at build time with "useSearchParams() should be wrapped in a suspense boundary".

**How to apply:** Split the page into an inner component that uses `useSearchParams()` and a default-export wrapper that wraps it in `<Suspense fallback={...}>`. The fallback should be a loading skeleton consistent with the page design.

**Why:** Next.js App Router's static page prerendering cannot handle `useSearchParams()` at the top level — it needs Suspense to defer that work to the client.

Affected pages in this project: `/klijent/zakazivanje`, `/dashboard/zakazivanje`.
