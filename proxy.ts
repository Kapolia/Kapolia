import { NextResponse, type NextRequest } from 'next/server'

// Routes accessibles en mode vitrine (SITE_VITRINE=true)
const VITRINE_PUBLIC = new Set(['/', '/mentions-legales', '/confidentialite'])

function isVitrineAllowed(pathname: string): boolean {
  return (
    VITRINE_PUBLIC.has(pathname) ||
    pathname === '/api/liste-attente'
  )
}

export function proxy(request: NextRequest) {
  // Mode développement local : tout passe
  if (process.env.SITE_VITRINE !== 'true') {
    return NextResponse.next()
  }

  // Mode vitrine : seules les routes publiques répondent
  if (isVitrineAllowed(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL('/', request.url))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)',
  ],
}
