# Invite Links — Simplification Plan

## Problem

Owners receiving a clinic invite link (`/join/<slug>`) frequently see **"Klinika nije pronađena"** even when the slug is valid. Even when the page works, the flow is heavier than it needs to be: a client component renders a spinner, then a landing card with a "Registrujte se" button, before the user can actually do anything.

Goal: the invite link should always land the user somewhere useful — never a dead-end — and signup should auto-connect the owner to the inviting clinic.

## Root cause of the "Klinika nije pronađena" bug

`src/app/join/[slug]/page.tsx` reads the dynamic route param incorrectly:

```ts
type Params = { id: string }
const { id: slug } = await params
```

The folder is `[slug]`, so Next.js provides `params.slug`, not `params.id`. `slug` is therefore always `undefined`, `fetchClinicBySlug(supabase, undefined)` returns null, and every visitor sees the not-found card. The same broken destructuring exists in both `generateMetadata` and the page default export.

Fixing this one bug already eliminates the most common failure mode. The rest of the plan is about removing remaining friction from the flow.

## Target flow

The join page becomes a **pure server-side redirect** — no client component, no spinner flash, no landing card. All routing decisions are made before any HTML is sent.

| Visitor state | Outcome |
|---|---|
| Logged out, valid slug | `redirect("/register?clinic=<slug>")` — register form auto-connects on submit |
| Logged out, bad/expired slug | `redirect("/register")` — plain owner registration, no dead end |
| Logged in as owner, valid slug | `connectOwnerToClinicBySlug(...)` then `redirect("/klijent")` |
| Logged in as owner, bad slug | `redirect("/klijent")` — silent, no error wall |
| Logged in as vet | `redirect("/dashboard")` — silent (vets shouldn't be on owner invite links) |

The existing `register-form.tsx` already reads `?clinic=<slug>` from the query string and calls `connectOwnerToClinicBySlug` after signup — no changes needed there.

## Implementation steps

1. **Rewrite `src/app/join/[slug]/page.tsx`** as a server component.
   - Fix `Params` to `{ slug: string }` and destructure `params.slug`.
   - In the page default export:
     - `await createClient()`, fetch clinic by slug, fetch user.
     - If no user → `redirect(clinic ? "/register?clinic=<slug>" : "/register")`.
     - Read `profiles.role` (fallback to `user.user_metadata.role`).
     - If role is `vet` → `redirect("/dashboard")`.
     - If clinic exists → `await connectOwnerToClinicBySlug(supabase, user.id, slug)`.
     - `redirect("/klijent")`.
   - Keep `generateMetadata` (also fix the param bug there) — even though the page redirects, social-share crawlers may still hit it before the redirect resolves.

2. **Delete `src/app/join/[slug]/join-client.tsx`.** All views it owned (`loading`, `notFound`, `loggedOut`, `connecting`, `wrongRole`, `error`) are replaced by server-side redirects. There is no remaining caller.

3. **Verify `register-form.tsx` already handles auto-connect.** It does — `useSearchParams().get("clinic")` is read on mount, and `connectOwnerToClinicBySlug(supabase, userId, clinicSlug)` runs after `signUp` succeeds. No edits required.

4. **Verify the middleware does not block the redirect targets.** `/register` is in the public allow-list (`src/middleware.ts` line 37). Logged-in users hitting `/register` get redirected to their role's home (line 61–64), but our flow only sends *logged-out* users to `/register`, so this is fine.

5. **Lint + smoke test.**
   - `npm run lint` — expect no new warnings.
   - Manual: hit `/join/<valid-slug>` while logged out → land on `/register?clinic=<slug>` with the clinic banner; complete signup → land on `/klijent` with an active connection row.
   - Manual: hit `/join/<bad-slug>` while logged out → land on plain `/register`.
   - Manual: hit `/join/<valid-slug>` while logged in as owner → land on `/klijent`, `connections` row exists.
   - Manual: hit `/join/<valid-slug>` while logged in as vet → land on `/dashboard`.

## Out of scope (intentional)

- **Wrong-role UX for vets.** Decision: silently redirect to `/dashboard` rather than show an explanation card. Edge case; vets don't normally click owner invite links.
- **Telling owners *why* they landed on `/register` plain** (i.e., bad slug). The clinic name banner is shown when the slug is valid; when it's invalid we just present standard registration. Adding an error toast is possible later but not required.
- **`/login?clinic=<slug>` deep link.** The login form already redirects back to `/join/<slug>` after successful login (`login-form.tsx` line 60), which then resolves through the new server-side flow. No change needed.

## Files touched

- `src/app/join/[slug]/page.tsx` — rewritten (server component, redirect-only).
- `src/app/join/[slug]/join-client.tsx` — deleted.

No schema changes. No migrations. No changes to `connections.ts`, `register-form.tsx`, or `middleware.ts`.
