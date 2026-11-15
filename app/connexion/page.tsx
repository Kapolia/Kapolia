'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/colors'
import { FONT_SANS } from '@/lib/typography'
import { safeNext, redirectAfterAuth, OAUTH_NEXT_KEY } from '@/lib/auth-redirect'
import AuthShell from '@/components/auth/AuthShell'
import AuthField from '@/components/auth/AuthField'
import { AuthButtonPrimary, AuthButtonGoogle } from '@/components/auth/AuthButton'
import ErreurDepliable from '@/components/auth/ErreurDepliable'

export default function ConnexionPage() {
  const router = useRouter()

  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [serverError,   setServerError]   = useState('')
  const [oauthLoading,  setOauthLoading]  = useState(false)
  const [emailError,    setEmailError]    = useState(false)
  const [passwordError, setPasswordError] = useState(false)
  const [passwordShake, setPasswordShake] = useState(0)

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting

  function clearErrors() {
    setServerError('')
    setEmailError(false)
    setPasswordError(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setServerError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.code === 'invalid_credentials') {
        setServerError('Adresse e-mail ou mot de passe incorrect.')
        setEmailError(true)
        setPasswordError(true)
        setPasswordShake(n => n + 1)
      } else if (error.code === 'email_not_confirmed') {
        setServerError(
          "Votre adresse e-mail n'est pas encore confirmée. Ouvrez le lien que nous vous avons envoyé pour activer votre compte."
        )
      } else if (error.status === 429) {
        setServerError('Trop de tentatives. Patientez quelques minutes avant de réessayer.')
      } else {
        console.error('[connexion] signInWithPassword error', error.code, error.message)
        setServerError('Connexion impossible pour le moment. Vérifiez votre connexion internet et réessayez.')
      }
      setSubmitting(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setServerError('Une erreur inattendue est survenue.')
      setSubmitting(false)
      return
    }

    const { data: profil, error: profilError } = await supabase
      .from('profils')
      .select('type_compte, onboarding_completed')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profilError) {
      console.error('[connexion] profil read error', profilError.code, profilError.message)
      setServerError('Connexion impossible pour le moment. Vérifiez votre connexion internet et réessayez.')
      setSubmitting(false)
      return
    }

    if (!profil) {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        console.error('[connexion] signOut error (compte sans profil)', signOutError.code, signOutError.message)
      }
      setServerError('Votre compte est incomplet. Contactez-nous pour le rétablir.')
      setSubmitting(false)
      return
    }

    const next = safeNext(new URLSearchParams(window.location.search).get('next'))
    redirectAfterAuth(router, profil, next)
  }

  async function handleGoogleSignIn() {
    if (oauthLoading) return
    setOauthLoading(true)
    setServerError('')

    const next = safeNext(new URLSearchParams(window.location.search).get('next'))
    if (next) {
      try { localStorage.setItem(OAUTH_NEXT_KEY, JSON.stringify({ url: next, ts: Date.now() })) } catch {}
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    })

    if (error) {
      setServerError('La connexion avec Google a échoué. Veuillez réessayer.')
      setOauthLoading(false)
    }
  }

  return (
    <AuthShell>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="auth-stagger"
        style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
      >
        <h1 style={{
          margin: 0,
          fontSize: '28px',
          fontWeight: 700,
          color: C.dark,
          fontFamily: FONT_SANS,
          letterSpacing: '-0.01em',
          lineHeight: 1.15,
        }}>
          Bon retour.
        </h1>

        <p style={{ margin: 0, fontSize: '15px', color: C.grey, lineHeight: 1.5 }}>
          Votre cap vous attend.
        </p>

        <AuthButtonGoogle
          onClick={handleGoogleSignIn}
          loading={oauthLoading}
          disabled={oauthLoading}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: C.sable }} />
          <span style={{ fontSize: '13px', color: C.grey }}>ou</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: C.sable }} />
        </div>

        <AuthField
          label="Adresse e-mail"
          value={email}
          onChange={v => { setEmail(v); clearErrors() }}
          type="email"
          placeholder="vous@exemple.fr"
          autoComplete="email"
          error={emailError}
        />

        <AuthField
          label="Mot de passe"
          value={password}
          onChange={v => { setPassword(v); clearErrors() }}
          type="password"
          autoComplete="current-password"
          error={passwordError}
          shake={passwordShake}
        />

        <div style={{ textAlign: 'right' }}>
          <Link
            href="/mot-de-passe-oublie"
            style={{ fontSize: '14px', color: C.grey, textDecoration: 'none' }}
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <ErreurDepliable message={serverError} />

        <AuthButtonPrimary type="submit" disabled={!canSubmit} loading={submitting}>
          {submitting ? 'Connexion' : 'Se connecter'}
        </AuthButtonPrimary>

        <p style={{ margin: 0, textAlign: 'center', fontSize: '14px', color: C.grey }}>
          Pas encore de compte ?{' '}
          <Link
            href="/inscription"
            style={{ color: C.orangeTexte, fontWeight: 600, textDecoration: 'none' }}
          >
            Créer un compte
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
