import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  // Blocked in production even if DEV_ADMIN_BYPASS leaks
  if (
    process.env.DEV_ADMIN_BYPASS !== 'true' ||
    process.env.VERCEL_ENV === 'production' ||
    !process.env.DEV_ADMIN_EMAIL ||
    !process.env.DEV_ADMIN_PASSWORD
  ) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const rawRedirect = request.nextUrl.searchParams.get('redirectTo') || '/admin/dashboard'
  // Only allow internal paths
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/admin/dashboard'
  const response = NextResponse.redirect(new URL(redirectTo, request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.DEV_ADMIN_EMAIL!,
    password: process.env.DEV_ADMIN_PASSWORD!,
  })

  if (error) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}
