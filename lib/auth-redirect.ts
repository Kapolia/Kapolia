import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

export const NEXT_KEY        = 'kapolia_post_signup_next'
export const OAUTH_TYPE_KEY  = 'kapolia_oauth_account_type'
export const OAUTH_NEXT_KEY  = 'kapolia_oauth_next'

export function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null
  return raw
}

export function storeNext(url: string) {
  try { localStorage.setItem(NEXT_KEY, JSON.stringify({ url, ts: Date.now() })) } catch {}
}

export type Profil = {
  type_compte: string
  onboarding_completed: boolean
} | null

export function redirectAfterAuth(
  router: AppRouterInstance,
  profil: Profil,
  nextUrl: string | null,
) {
  if (!profil || profil.type_compte === 'recruteur') {
    router.replace('/recruteur')
    return
  }
  if (profil.onboarding_completed) {
    router.replace(nextUrl ?? '/dashboard')
  } else {
    if (nextUrl) storeNext(nextUrl)
    router.replace('/onboarding')
  }
}
