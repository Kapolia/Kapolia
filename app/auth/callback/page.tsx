'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  redirectAfterAuth,
  storeNext,
  safeNext,
  OAUTH_TYPE_KEY,
  OAUTH_NEXT_KEY,
} from '@/lib/auth-redirect'
import { C } from '@/lib/colors'
import { FONT_SANS } from '@/lib/typography'
import AuthShell from '@/components/auth/AuthShell'
import { AuthButtonPrimary } from '@/components/auth/AuthButton'
import ErreurDepliable from '@/components/auth/ErreurDepliable'
import ChoixTypeCompte from '@/components/auth/ChoixTypeCompte'
import AuthSpinner from '@/components/auth/AuthSpinner'

type Status =
  | { kind: 'loading' }
  | { kind: 'choose_type'; userId: string; storedNext: string | null }
  | { kind: 'saving_type' }
  | { kind: 'error'; message: string }

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

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status,      setStatus]      = useState<Status>(() => readUrlError() ?? { kind: 'loading' })
  const [chosenType,  setChosenType]  = useState<'candidat' | 'recruteur' | null>(null)
  const [chooseError, setChooseError] = useState('')

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
    setChooseError('')

    const { error: insertError } = await supabase
      .from('profils')
      .insert({ user_id: userId, type_compte: chosenType })

    if (insertError) {
      setChooseError("Votre profil n'a pas pu être créé. Veuillez réessayer.")
      setStatus({ kind: 'choose_type', userId, storedNext })
      return
    }

    if (chosenType === 'candidat') {
      if (storedNext) storeNext(storedNext)
      router.replace('/onboarding')
    } else {
      router.replace('/recruteur')
    }
  }

  if (status.kind === 'loading' || status.kind === 'saving_type') {
    return (
      <AuthShell>
        <AuthSpinner label="Connexion en cours…" />
      </AuthShell>
    )
  }

  if (status.kind === 'error') {
    return (
      <AuthShell>
        <div
          className="auth-stagger"
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            backgroundColor: '#FBF1F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"
              stroke={C.erreur} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 style={{
            margin: 0, fontSize: '24px', fontWeight: 700,
            color: C.dark, fontFamily: FONT_SANS,
            letterSpacing: '-0.01em', lineHeight: 1.2,
          }}>
            Connexion impossible
          </h1>
          <p style={{ margin: 0, fontSize: '15px', color: C.grey, lineHeight: 1.5 }}>
            {status.message}
          </p>
          <AuthButtonPrimary type="button" onClick={() => router.push('/connexion')}>
            Retour à la connexion
          </AuthButtonPrimary>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div
        className="auth-stagger"
        style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
      >
        <h1 style={{
          margin: 0, fontSize: '28px', fontWeight: 700,
          color: C.dark, fontFamily: FONT_SANS,
          letterSpacing: '-0.01em', lineHeight: 1.15,
        }}>
          Bienvenue sur Kapolia
        </h1>
        <p style={{ margin: 0, fontSize: '15px', color: C.grey, lineHeight: 1.5 }}>
          Pour finaliser votre inscription, précisez votre profil.
        </p>
        <ChoixTypeCompte valeur={chosenType} onChange={setChosenType} />
        <ErreurDepliable message={chooseError} />
        <AuthButtonPrimary type="button" disabled={!chosenType} onClick={handleChooseType}>
          Continuer
        </AuthButtonPrimary>
      </div>
    </AuthShell>
  )
}
