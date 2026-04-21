import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const TRIAL_DAYS = 30

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isPublic =
    pathname.startsWith('/join') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/vets') ||
    pathname === '/'

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, clinic_id')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? (user.user_metadata?.role as string | undefined)

    if (role === 'vet' && pathname.startsWith('/klijent')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (role === 'owner' && pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/klijent', request.url))
    }

    if (pathname === '/login' || pathname === '/register') {
      const dest = role === 'vet' ? '/dashboard' : '/klijent'
      return NextResponse.redirect(new URL(dest, request.url))
    }

    // Subscription gating for vets
    if (role === 'vet' && pathname.startsWith('/dashboard')) {
      // Upgrade page is always accessible
      if (pathname.startsWith('/dashboard/upgrade')) {
        return supabaseResponse
      }

      // Fetch clinic subscription state
      const clinicId = profile?.clinic_id
      if (clinicId) {
        const { data: clinic } = await supabase
          .from('clinics')
          .select('trial_started_at, subscription_status')
          .eq('id', clinicId)
          .single()

        if (clinic) {
          const status = clinic.subscription_status as string
          if (status === 'expired' || status === 'cancelled') {
            return NextResponse.redirect(new URL('/dashboard/upgrade', request.url))
          }
          if (status === 'trial' && clinic.trial_started_at) {
            const trialStart = new Date(clinic.trial_started_at)
            const daysSince  = (Date.now() - trialStart.getTime()) / (1000 * 60 * 60 * 24)
            if (daysSince > TRIAL_DAYS) {
              // Persist the expired state so UI badges and queries stay truthful.
              // RLS policy clinics_vet_all lets the owner update their own clinic.
              await supabase
                .from('clinics')
                .update({ subscription_status: 'expired' })
                .eq('id', clinicId)
              return NextResponse.redirect(new URL('/dashboard/upgrade', request.url))
            }
          }
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webm|mp4|ogg)$).*)',
  ],
}
