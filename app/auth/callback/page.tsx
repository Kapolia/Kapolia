'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  redirectAfterAuth,
  storeNext,
  safeNext,
  OAUTH_TYPE_KEY,
  OAUTH_NEXT_KEY,
} from '@/lib/auth-redirect'
import LogoKapolia from '@/components/LogoKapolia'
import { FONT_SANS } from '@/lib/typography'
import { C as _C } from '@/lib/colors'
const C = { ..._C, lightGrey: '#D0D0D0' as const }

// ─── Palette ──────────────────────────────────────────────────────────────────

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: C.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 'clamp(40px, 6%, 72px) clamp(20px, 5%, 40px)',
    }}>
      <style suppressHydrationWarning>
        {`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}
      </style>
      <Link href="/" style={{ marginBottom: '40px', textDecoration: 'none' }}>
        <LogoKapolia variante="sombre" taille={40} />
      </Link>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: C.white,
        borderRadius: '24px',
        padding: 'clamp(28px, 5%, 44px)',
        boxShadow: '0 2px 24px rgba(26,26,26,0.07)',
      }}>
        {children}
      </div>
      <p style={{
        marginTop: '32px',
        fontSize: '12px',
        color: C.lightGrey,
        fontFamily: FONT_SANS, fontWeight: 400, letterSpacing: '-0.005em',
        fontStyle: 'italic',
        textAlign: 'center',
      }}>
        « Trouvez votre cap. »
      </p>
    </main>
  )
}

// ─── Account card ─────────────────────────────────────────────────────────────

function AccountCard({
  label, desc, icon, selected, color, onClick,
}: {
  label: string
  desc: string
  icon: React.ReactNode
  selected: boolean
  color: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '14px 12px',
        borderRadius: '14px',
        border: `2px solid ${selected ? color : C.sable}`,
        backgroundColor: selected ? `${color}12` : C.white,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <span style={{ fontSize: '22px', lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontSize: '14px',
        fontWeight: '700',
        color: selected ? color : C.dark,
        display: 'block',
        transition: 'color 0.15s',
      }}>
        {label}
      </span>
      <span style={{ fontSize: '12px', color: C.grey, lineHeight: '1.4', display: 'block' }}>
        {desc}
      </span>
    </button>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Status =
  | { kind: 'loading' }
  | { kind: 'choose_type'; userId: string; storedNext: string | null }
  | { kind: 'saving_type' }
  | { kind: 'error'; message: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readUrlError(): Status | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const errorParam       = params.get('error')
  const errorDescription = params.get('error_description')
  if (!errorParam) return null
  return {
    kind: 'error',
    message: errorDescription
      ? decodeURIComponent(errorDescription)
      : 'Google a refusé la connexion. Veuillez réessayer.',
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus]         = useState<Status>(() => readUrlError() ?? { kind: 'loading' })
  const [chosenType, setChosenType] = useState<'candidat' | 'recruteur' | null>(null)

  useEffect(() => {
    if (status.kind !== 'loading') return

    let handled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (handled) return
        if (event !== 'SIGNED_IN' || !session) return
        handled = true

        // Read and clear OAuth localStorage before any async work
        let storedType: string | null = null
        let storedNext: string | null = null
        try {
          storedType = localStorage.getItem(OAUTH_TYPE_KEY)
          const rawNext = localStorage.getItem(OAUTH_NEXT_KEY)
          if (rawNext) {
            const parsed = JSON.parse(rawNext)
            storedNext = safeNext(parsed.url ?? null)
          }
          localStorage.removeItem(OAUTH_TYPE_KEY)
          localStorage.removeItem(OAUTH_NEXT_KEY)
        } catch {
          // localStorage unavailable — storedType and storedNext remain null
        }

        const userId = session.user.id

        const { data: profil, error: profilError } = await supabase
          .from('profils')
          .select('type_compte, onboarding_completed')
          .eq('user_id', userId)
          .single()

        // PGRST116 = row not found — expected for new users
        if (profilError && profilError.code !== 'PGRST116') {
          setStatus({
            kind: 'error',
            message: 'Une erreur est survenue lors de la lecture de votre profil. Veuillez réessayer.',
          })
          return
        }

        if (profil) {
          redirectAfterAuth(router, profil, storedNext)
          return
        }

        // New user — profile does not exist yet
        if (storedType === 'candidat' || storedType === 'recruteur') {
          const { error: insertError } = await supabase
            .from('profils')
            .insert({ user_id: userId, type_compte: storedType })

          if (insertError) {
            setStatus({
              kind: 'error',
              message: 'Votre profil n\'a pas pu être créé. Veuillez réessayer.',
            })
            return
          }

          if (storedType === 'candidat') {
            if (storedNext) storeNext(storedNext)
            router.replace('/onboarding')
          } else {
            router.replace('/recruteur')
          }
          return
        }

        // New user via the connexion button — no account type stored
        setStatus({ kind: 'choose_type', userId, storedNext })
      }
    )

    const timeoutId = setTimeout(() => {
      if (!handled) {
        setStatus({
          kind: 'error',
          message: 'La connexion a pris trop de temps. Veuillez réessayer.',
        })
      }
    }, 10_000)

    return () => {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [router, status.kind])

  async function handleChooseType() {
    if (status.kind !== 'choose_type' || !chosenType) return
    const { userId, storedNext } = status
    setStatus({ kind: 'saving_type' })

    const { error: insertError } = await supabase
      .from('profils')
      .insert({ user_id: userId, type_compte: chosenType })

    if (insertError) {
      setStatus({
        kind: 'error',
        message: 'Votre profil n\'a pas pu être créé. Veuillez réessayer.',
      })
      return
    }

    if (chosenType === 'candidat') {
      if (storedNext) storeNext(storedNext)
      router.replace('/onboarding')
    } else {
      router.replace('/recruteur')
    }
  }

  // ── Spinner ─────────────────────────────────────────────────────────────────

  if (status.kind === 'loading' || status.kind === 'saving_type') {
    return (
      <Shell>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: '20px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
            animation: 'kapolia-spin 0.8s linear infinite',
          }} />
          <p style={{ margin: 0, fontSize: '14px', color: C.grey }}>
            Connexion en cours…
          </p>
        </div>
      </Shell>
    )
  }

  // ── Erreur ──────────────────────────────────────────────────────────────────

  if (status.kind === 'error') {
    return (
      <Shell>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          backgroundColor: '#fdf2f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '20px',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={C.erreur} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 style={{
          fontFamily: FONT_SANS, letterSpacing: '-0.005em',
          fontSize: 'clamp(20px, 3.5vw, 26px)',
          color: C.dark, fontWeight: 700,
          margin: '0 0 12px',
        }}>
          Connexion impossible
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: '14px', color: C.grey, lineHeight: 1.7 }}>
          {status.message}
        </p>
        <a
          href="/connexion"
          style={{
            display: 'block',
            width: '100%',
            padding: '13px',
            borderRadius: '14px',
            border: 'none',
            backgroundColor: C.terracotta,
            color: C.white,
            fontSize: '14px',
            fontWeight: '600',
            textAlign: 'center',
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          Retour à la connexion
        </a>
      </Shell>
    )
  }

  // ── Choix du type de compte ──────────────────────────────────────────────────

  return (
    <Shell>
      <h1 style={{
        fontFamily: FONT_SANS, letterSpacing: '-0.005em',
        fontSize: 'clamp(22px, 4vw, 28px)',
        color: C.dark, fontWeight: 700,
        margin: '0 0 10px',
      }}>
        Bienvenue sur Kapolia
      </h1>
      <p style={{ margin: '0 0 28px', fontSize: '14px', color: C.grey, lineHeight: 1.65 }}>
        Pour finaliser votre inscription, précisez votre profil.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: C.dark, letterSpacing: '0.02em' }}>
            Je suis…
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <AccountCard
              label="Candidat"
              desc="Je cherche un poste"
              icon="👤"
              selected={chosenType === 'candidat'}
              color={C.terracotta}
              onClick={() => setChosenType('candidat')}
            />
            <AccountCard
              label="Recruteur"
              desc="Je recrute des talents"
              icon="🔍"
              selected={chosenType === 'recruteur'}
              color={C.vert}
              onClick={() => setChosenType('recruteur')}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleChooseType}
          disabled={!chosenType}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '14px',
            border: 'none',
            backgroundColor: chosenType ? C.terracotta : C.sable,
            color: chosenType ? C.white : C.grey,
            fontSize: '15px',
            fontWeight: '600',
            cursor: chosenType ? 'pointer' : 'default',
            transition: 'all 0.2s',
            fontFamily: 'inherit',
          }}
        >
          Continuer
        </button>
      </div>
    </Shell>
  )
}
