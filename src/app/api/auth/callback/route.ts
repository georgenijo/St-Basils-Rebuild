import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const type = request.nextUrl.searchParams.get('type')

  if (!code) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.delete('code')
    url.searchParams.delete('type')
    url.searchParams.set('error', 'missing_code')
    return NextResponse.redirect(url)
  }

  const redirectUrl = request.nextUrl.clone()
  redirectUrl.search = ''

  // Determine redirect destination based on auth flow type
  if (type === 'invite' || type === 'recovery') {
    redirectUrl.pathname = '/set-password'
  } else {
    redirectUrl.pathname = '/'
  }

  const response = NextResponse.redirect(redirectUrl)

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

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const errorUrl = request.nextUrl.clone()
    errorUrl.pathname = '/login'
    errorUrl.search = ''
    errorUrl.searchParams.set('error', 'auth_code_error')
    return NextResponse.redirect(errorUrl)
  }

  return response
}
