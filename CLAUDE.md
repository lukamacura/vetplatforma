# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (Next.js on http://localhost:3000)
npm run build    # production build
npm run lint     # ESLint
```

No test suite exists yet.

## Stack

- **Next.js 16.2.3** — App Router. This is a newer version with breaking changes vs training data; check `node_modules/next/dist/docs/` before using any Next.js API.
- **React 19.2.4** — hooks and server components behave differently; read the release notes before mixing them.
- **Supabase** (`@supabase/ssr`) — Auth + Postgres + RLS.
- **Tailwind CSS v4** — config-less, no `tailwind.config.*` file. Utility classes only.
- **shadcn/ui** components live in `src/components/ui/`.
- **TypeScript strict** mode.

## Architecture

### Route structure

| Route group | URL prefix | Who sees it |
|---|---|---|
| `(auth)` | `/login`, `/register` | Unauthenticated |
| `(owner)` | `/klijent/...` | Owners (pet owners) |
| `dashboard` | `/dashboard/...` | Vets |
| `join/[id]` | `/join/:clinicSlug` | Anyone — clinic invite link |

Root `/` redirects to `/login`.

### Auth + role routing (middleware)

`src/middleware.ts` runs on every request (except static assets). It:
1. Checks Supabase session via `createServerClient`.
2. Reads `profiles.role` from the database.
3. Redirects unauthenticated users to `/login`.
4. Redirects role mismatches (vet→`/dashboard`, owner→`/klijent`).

Roles are `'vet' | 'owner'`. Role is set at registration via `user_metadata.role` and copied into `profiles` by a Postgres trigger (`handle_new_user`).

### Supabase clients

- **Browser (Client Components):** `import { createClient } from '@/lib/supabase/client'`
- **Server (Server Components / Route Handlers):** `import { createClient } from '@/lib/supabase/server'` — this is `async`.

Never use the browser client in Server Components or the server client in Client Components.

### Database schema (`supabase/schema.sql`)

Tables: `clinics`, `profiles`, `pets`, `connections`, `services`, `appointments`.

Key relationships:
- Each clinic has one vet owner (`clinics.owner_id`).
- `connections` is the join table linking an owner to a clinic (inserted when owner clicks the `/join/:slug` invite link).
- Vets access owner data only through the `connections` table — enforced by RLS.
- `pets.vet_notes` is **never** exposed to owners (RLS + deliberate omission in queries).

### RLS rules to keep in mind

- Vets read/write pets of owners connected to their clinic via `connections`.
- Owners can only see their own pets, appointments, and connected clinic's active services.
- RLS is enforced server-side — do not rely on client-side filtering as a security boundary.

## Conventions

- **All user-facing copy is in Serbian.** Keep it that way.
- Appointments have no "pending" status — they are always `'confirmed'` on creation.
- Queries join data manually (no Supabase joins syntax) — fetch related IDs then batch-fetch with `.in()`.
- No ORM — raw Supabase query builder throughout.

## Design system

**Font:** Plus Jakarta Sans — loaded via `next/font/google` in `src/app/layout.tsx`, applied through `--font-jakarta` → `--font-sans` CSS variable chain. No fallback font needed.

### Color tokens (all defined as CSS vars in `src/app/globals.css`)

**Never hardcode hex colors** — always reference a CSS var.

| Token | Hex | Meaning — use only for this |
|---|---|---|
| `--brand` | `#2BB5A0` | Primary CTAs, brand, confirmed/connected state |
| `--brand-hover` | `#239684` | Hover on brand elements |
| `--brand-tint` | `#E6F7F5` | Brand-colored backgrounds |
| `--green` | `#16A34A` | Healthy / active / success / on-time |
| `--amber` | `#D97706` | Upcoming / due soon / needs attention |
| `--red` | `#DC2626` | Overdue / critical / error / destructive |
| `--blue` | `#2563EB` | Informational / time / stats / neutral data |
| `--yellow` | `#EAB308` | Highlights / trial warnings / "new" labels |
| `--orange` | `#EA580C` | Energy / urgency secondary / onboarding accents |

### CTA Buttons — Glassmorphism style

All primary action buttons use the `.btn-primary` class defined in `globals.css`. Rules:
- Background: semi-transparent brand color with backdrop blur (glassmorphism).
- Glow: `box-shadow` using brand color at low opacity, intensifies on hover.
- Hover: glow intensifies + `scale(1.02)`.
- Active (click): `scale(0.97)` to simulate physical depress.
- Transition: `all 0.3s ease` on all interactive states.
- Never use plain solid-fill buttons for primary actions — always `.btn-primary`.

```html
<!-- correct -->
<button class="btn-primary">Zakaži termin</button>

<!-- wrong — no glassmorphism, no glow -->
<button class="bg-[--brand] text-white rounded-lg px-4 py-2">...</button>
```

### Card surfaces

| Class | Use |
|---|---|
| `.solid-card` | Standard data cards — white bg + 1px border |
| `.glass-card` | Sidebar, modals, overlapping surfaces — frosted glass + blur |
| `.glass-card-vibrant` | Feature cards with colored tint — use with `--brand-tint`, `--yellow-tint`, etc. |

### Component classes (defined in globals.css)

**Badges:** `.badge .badge-brand`, `.badge-green`, `.badge-amber`, `.badge-red`, `.badge-blue`, `.badge-yellow`, `.badge-orange`, `.badge-muted`

**Icon containers:** `.icon-sm` (28px) / `.icon-md` (36px) / `.icon-lg` (48px) + `.icon-brand`, `.icon-green`, `.icon-amber`, `.icon-red`, `.icon-blue`, `.icon-yellow`, `.icon-orange`, `.icon-muted`

**Pulse animation:** `.pulse-dot` — animated dot for urgent badge indicators (overdue status).

### Animation conventions

- All interactive elements: `transition: all 0.3s ease`
- Hover lift on cards: `translateY(-2px)` + softer box-shadow
- Button hover: `scale(1.02)` + glow intensify
- Button active: `scale(0.97)` — physical depress feel
- Never use `transition: none` on user-visible interactive elements
