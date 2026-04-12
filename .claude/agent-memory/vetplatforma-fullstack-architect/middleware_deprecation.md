---
name: Middleware Deprecation Warning
description: Next.js 16 shows deprecation warning for middleware — rename to proxy when ready
type: project
---

Next.js 16.2.3 emits: `"The 'middleware' file convention is deprecated. Please use 'proxy' instead."` at build time. This is a warning only — not a build error — so `src/middleware.ts` continues to work. Renaming to `src/proxy.ts` is required before upgrading Next.js further, but is not urgent for MVP.

**Why:** The file convention changed in Next.js 16.x. The proxy file has the same structure as middleware.

**How to apply:** Don't rename yet — wait until a Next.js upgrade is planned. Flag it then.
