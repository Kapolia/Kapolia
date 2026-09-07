'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import CandidatSidebar from '@/components/CandidatSidebar'
import LogoKapolia from '@/components/LogoKapolia'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  white:      '#FFFFFF',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TypeCompte = 'candidat' | 'recruteur' | null

type NavState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'candidat'; prenom: string; nom: string; avatarUrl?: string; avatarType?: string }
  | { status: 'recruteur'; prenom: string; nom: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initiales(prenom: string, nom: string) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || 'K'
}

// ─── Guest nav sub-components ─────────────────────────────────────────────────

function NavLink({
  href, children, pathname,
}: {
  href: string; children: React.ReactNode; pathname: string
}) {
  const router  = useRouter()
  const [hov, setHov] = useState(false)
  const active = pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <button
      onClick={() => router.push(href)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'none', border: 'none', padding: '4px 2px',
        fontSize: '14px', fontWeight: active ? '600' : '400',
        color: active || hov ? C.terracotta : C.grey,
        cursor: 'pointer', transition: 'color 0.15s',
        position: 'relative', fontFamily: 'inherit',
      }}
    >
      {children}
      {active && (
        <span style={{
          position: 'absolute', bottom: '-2px', left: 0, right: 0,
          height: '2px', backgroundColor: C.terracotta, borderRadius: '1px',
        }} />
      )}
    </button>
  )
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'none', border: `1.5px solid ${hov ? C.terracotta : C.sable}`,
        borderRadius: '10px', padding: '8px 16px',
        fontSize: '13px', fontWeight: '500',
        color: hov ? C.terracotta : C.grey,
        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

function PrimaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        backgroundColor: hov ? '#b35c34' : C.terracotta,
        border: 'none', borderRadius: '10px', padding: '8px 16px',
        fontSize: '13px', fontWeight: '600', color: C.white,
        cursor: 'pointer', transition: 'background-color 0.15s', fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Navigation() {
  const router   = useRouter()
  const pathname = usePathname()
  const [nav, setNav] = useState<NavState>({ status: 'loading' })

  // Recalculé avant l'effet pour être utilisé comme dépendance
  const FULLSCREEN_PATHS = ['/', '/onboarding', '/connexion', '/inscription', '/mot-de-passe-oublie', '/auth']
  const isFullscreen = FULLSCREEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))

  useEffect(() => {
    // Re-fetch quand on sort d'une page plein écran (ex : fin onboarding → /profil)
    // pour que onboarding_completed=true soit bien pris en compte.
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setNav({ status: 'guest' })
        return
      }

      const { data: profil } = await supabase
        .from('profils')
        .select('prenom, nom, type_compte, avatar_url, avatar_type, onboarding_completed')
        .eq('user_id', user.id)
        .single()

      const tc: TypeCompte = (profil?.type_compte as TypeCompte) ?? 'candidat'
      const prenom = profil?.prenom ?? ''
      const nom    = profil?.nom    ?? ''

      if (tc === 'recruteur') {
        setNav({ status: 'recruteur', prenom, nom })
      } else if (!profil?.onboarding_completed) {
        // Candidat non-onboardé — pas de sidebar, nav guest
        setNav({ status: 'guest' })
      } else {
        setNav({ status: 'candidat', prenom, nom, avatarUrl: profil?.avatar_url ?? undefined, avatarType: profil?.avatar_type ?? undefined })
      }
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load())
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen])

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }, [router])

  // Pages plein écran — aucune navigation (ni sidebar ni navbar)
  if (isFullscreen) return null

  // Recruteur sidebar is handled by app/recruteur/layout.tsx
  if (pathname.startsWith('/recruteur')) return null
  if (nav.status === 'recruteur') return null

  // Still resolving auth — show nothing to avoid layout shift
  if (nav.status === 'loading') return null

  // Candidats get the fixed sidebar, not a horizontal navbar
  if (nav.status === 'candidat') {
    return (
      <CandidatSidebar
        initials={initiales(nav.prenom, nav.nom)}
        prenom={nav.prenom}
        nom={nav.nom}
        avatarUrl={nav.avatarUrl}
        avatarType={nav.avatarType}
      />
    )
  }

  // ── Guest horizontal navbar ────────────────────────────────────────────────

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 40,
      backgroundColor: C.white,
      borderBottom: `1px solid ${C.sable}`,
      boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
      height: '64px',
    }}>
      <div style={{
        maxWidth: '1100px', margin: '0 auto', height: '100%',
        padding: '0 28px',
        display: 'flex', alignItems: 'center', gap: '32px',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <LogoKapolia variante="sombre" taille={32} />
        </button>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flex: 1 }}>
          <NavLink href="/offres" pathname={pathname}>Les offres</NavLink>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <GhostBtn onClick={() => router.push('/connexion')}>Se connecter</GhostBtn>
          <PrimaryBtn onClick={() => router.push('/inscription')}>Créer mon profil</PrimaryBtn>
        </div>
      </div>
    </nav>
  )
}
