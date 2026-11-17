'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { safeNext, storeNext, OAUTH_TYPE_KEY, OAUTH_NEXT_KEY } from '@/lib/auth-redirect'
import { C } from '@/lib/colors'
import { FONT_SANS } from '@/lib/typography'
import { isValidEmail } from '@/lib/validation'
import { evaluerMotDePasse, NIVEAU_MIN_MOT_DE_PASSE } from '@/lib/robustesse-mot-de-passe'
import AuthField from '@/components/auth/AuthField'
import { AuthButtonPrimary, AuthButtonGoogle } from '@/components/auth/AuthButton'
import ErreurDepliable from '@/components/auth/ErreurDepliable'
import ChoixTypeCompte from '@/components/auth/ChoixTypeCompte'
import BarreRobustesse from '@/components/auth/BarreRobustesse'

type TypeCompte = 'candidat' | 'recruteur'

export default function InscriptionPage() {
  const router = useRouter()

  const [accountType,  setAccountType]  = useState<TypeCompte | null>(null)
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [touched,      setTouched]      = useState({ email: false, confirm: false })
  const [submitting,   setSubmitting]   = useState(false)
  const [serverError,  setServerError]  = useState('')
  const [oauthLoading, setOauthLoading] = useState(false)

  const { niveau, conseil } = evaluerMotDePasse(password, email)

  const emailError = touched.email && email && !isValidEmail(email)
    ? 'Adresse e-mail invalide'
    : ''
  const confirmError = touched.confirm && confirm && confirm !== password
    ? 'Les mots de passe ne correspondent pas'
    : ''

  const isValid =
    accountType !== null &&
    isValidEmail(email) &&
    niveau >= NIVEAU_MIN_MOT_DE_PASSE &&
    confirm === password

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || submitting) return
    setSubmitting(true)
    setServerError('')

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already exists')) {
        setServerError('Cette adresse e-mail est déjà utilisée.')
      } else if (msg.includes('password') || msg.includes('weak')) {
        setServerError('Le mot de passe est trop court ou invalide.')
      } else {
        setServerError(error.message)
      }
      setSubmitting(false)
      return
    }

    if (data.user) {
      await supabase.from('profils').insert({
        user_id: data.user.id,
        type_compte: accountType,
      })
    }

    if (accountType === 'candidat') {
      const next = safeNext(new URLSearchParams(window.location.search).get('next'))
      if (next) storeNext(next)
      router.push('/onboarding')
    } else {
      router.push('/recruteur')
    }
  }

  async function handleGoogleSignIn() {
    if (!accountType || oauthLoading) return
    setOauthLoading(true)
    setServerError('')

    try {
      localStorage.setItem(OAUTH_TYPE_KEY, accountType)
      const next = safeNext(new URLSearchParams(window.location.search).get('next'))
      if (next) {
        localStorage.setItem(OAUTH_NEXT_KEY, JSON.stringify({ url: next, ts: Date.now() }))
      }
    } catch {}

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
          Créez votre profil
        </h1>

        <ChoixTypeCompte valeur={accountType} onChange={setAccountType} />

        <AuthButtonGoogle
          onClick={handleGoogleSignIn}
          loading={oauthLoading}
          disabled={!accountType || oauthLoading}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: C.sable }} />
          <span style={{ fontSize: '13px', color: C.grey }}>ou</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: C.sable }} />
        </div>

        <AuthField
          label="Adresse e-mail"
          value={email}
          onChange={v => { setEmail(v); setTouched(t => ({ ...t, email: true })) }}
          type="email"
          placeholder="vous@exemple.fr"
          autoComplete="email"
          error={!!emailError}
        >
          {emailError && (
            <span style={{ fontSize: '13px', color: C.erreur }}>{emailError}</span>
          )}
        </AuthField>

        <AuthField
          label="Mot de passe"
          value={password}
          onChange={v => setPassword(v)}
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
        >
          <BarreRobustesse niveau={niveau} conseil={conseil} />
        </AuthField>

        <AuthField
          label="Confirmer le mot de passe"
          value={confirm}
          onChange={v => { setConfirm(v); setTouched(t => ({ ...t, confirm: true })) }}
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          error={!!confirmError}
        >
          {confirmError && (
            <span style={{ fontSize: '13px', color: C.erreur }}>{confirmError}</span>
          )}
        </AuthField>

        <ErreurDepliable message={serverError} />

        <AuthButtonPrimary type="submit" disabled={!isValid || submitting} loading={submitting}>
          {submitting ? 'Création' : 'Créer mon compte'}
        </AuthButtonPrimary>

        <p style={{ margin: 0, textAlign: 'center', fontSize: '14px', color: C.grey }}>
          Déjà un compte ?{' '}
          <Link
            href="/connexion"
            style={{ color: C.orangeTexte, fontWeight: 600, textDecoration: 'none' }}
          >
            Se connecter
          </Link>
        </p>
    </form>
  )
}
