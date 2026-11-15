'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/colors'
import { FONT_SANS } from '@/lib/typography'
import { evaluerMotDePasse } from '@/lib/robustesse-mot-de-passe'
import AuthField from '@/components/auth/AuthField'
import { AuthButtonPrimary } from '@/components/auth/AuthButton'
import ErreurDepliable from '@/components/auth/ErreurDepliable'
import BarreRobustesse from '@/components/auth/BarreRobustesse'
import AuthSpinner from '@/components/auth/AuthSpinner'

type Status =
  | 'checking'
  | 'ready'
  | 'invalid'
  | 'already_connected'
  | 'saving'
  | 'success'

export default function ReinitialisationPage() {
  const router = useRouter()
  const [status,      setStatus]      = useState<Status>('checking')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [serverError, setServerError] = useState('')

  const { niveau, conseil } = evaluerMotDePasse(password)

  const confirmError = confirm !== '' && confirm !== password
    ? 'Les mots de passe ne correspondent pas'
    : ''

  const canSubmit = status === 'ready' && niveau >= 2 && confirm === password

  useEffect(() => {
    const hasCode = new URLSearchParams(window.location.search).has('code')

    let initialSessionPresent = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (timeoutId) clearTimeout(timeoutId)
        setStatus('ready')
      } else if (event === 'INITIAL_SESSION') {
        initialSessionPresent = Boolean(session)
        if (!hasCode) {
          setStatus(session ? 'already_connected' : 'invalid')
        }
      }
    })

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    if (hasCode) {
      timeoutId = setTimeout(() => {
        setStatus(s =>
          s === 'checking'
            ? (initialSessionPresent ? 'already_connected' : 'invalid')
            : s
        )
      }, 5000)
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'ready') return
    if (niveau < 2 || password !== confirm) return

    setStatus('saving')
    setServerError('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setServerError(error.message || 'Une erreur est survenue. Réessayez.')
      setStatus('ready')
      return
    }

    await supabase.auth.signOut()
    setStatus('success')
    setTimeout(() => router.replace('/connexion'), 2500)
  }

  if (status === 'checking') {
    return <AuthSpinner />
  }

  if (status === 'invalid') {
    return (
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
            Lien invalide ou expiré
          </h1>
          <p style={{ margin: 0, fontSize: '15px', color: C.grey, lineHeight: 1.5 }}>
            Ce lien de réinitialisation est invalide ou a expiré. Les liens sont valables pendant 1 heure.
          </p>
          <AuthButtonPrimary type="button" onClick={() => router.push('/mot-de-passe-oublie')}>
            Demander un nouveau lien
          </AuthButtonPrimary>
          <p style={{ margin: 0, textAlign: 'center', fontSize: '14px', color: C.grey }}>
            <Link href="/connexion" style={{ color: C.orangeTexte, fontWeight: 600, textDecoration: 'none' }}>
              Retour à la connexion
            </Link>
          </p>
        </div>
    )
  }

  if (status === 'already_connected') {
    return (
      <div
          className="auth-stagger"
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <h1 style={{
            margin: 0, fontSize: '24px', fontWeight: 700,
            color: C.dark, fontFamily: FONT_SANS,
            letterSpacing: '-0.01em', lineHeight: 1.2,
          }}>
            Vous êtes déjà connecté
          </h1>
          <p style={{ margin: 0, fontSize: '15px', color: C.grey, lineHeight: 1.5 }}>
            {'Vous avez une session active. Ce lien de réinitialisation n\'est pas applicable à votre session actuelle. Si vous souhaitez changer votre mot de passe, rendez-vous dans vos paramètres.'}
          </p>
          <AuthButtonPrimary type="button" onClick={() => router.push('/profil')}>
            Aller à mon espace
          </AuthButtonPrimary>
        </div>
    )
  }

  if (status === 'success') {
    return (
      <div
          className="auth-stagger"
          style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center', gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
              <circle
                cx="26" cy="26" r="22"
                stroke={C.succes} strokeWidth="2.5" fill="none"
                transform="rotate(-90 26 26)"
                className="mdp-circle"
              />
              <path
                d="M14 27 L22 35 L38 18"
                stroke={C.succes} strokeWidth="2.5" fill="none"
                strokeLinecap="round" strokeLinejoin="round"
                className="mdp-check"
              />
            </svg>
          </div>
          <h1 style={{
            margin: 0, fontSize: '24px', fontWeight: 700,
            color: C.dark, fontFamily: FONT_SANS,
            letterSpacing: '-0.01em', lineHeight: 1.2,
          }}>
            Mot de passe mis à jour
          </h1>
          <p style={{ margin: 0, fontSize: '15px', color: C.grey, lineHeight: 1.5 }}>
            Votre mot de passe a bien été modifié. Vous allez être redirigé vers la page de connexion…
          </p>
        </div>
    )
  }

  return (
    <form
        onSubmit={handleSubmit}
        noValidate
        className="auth-stagger"
        style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
      >
        <h1 style={{
          margin: 0, fontSize: '28px', fontWeight: 700,
          color: C.dark, fontFamily: FONT_SANS,
          letterSpacing: '-0.01em', lineHeight: 1.15,
        }}>
          Nouveau mot de passe
        </h1>
        <p style={{ margin: 0, fontSize: '15px', color: C.grey, lineHeight: 1.5 }}>
          Choisissez un nouveau mot de passe.
        </p>
        <AuthField
          label="Nouveau mot de passe"
          value={password}
          onChange={v => { setPassword(v); setServerError('') }}
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
        >
          <BarreRobustesse niveau={niveau} conseil={conseil} />
        </AuthField>
        <AuthField
          label="Confirmer le mot de passe"
          value={confirm}
          onChange={v => { setConfirm(v); setServerError('') }}
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
        <AuthButtonPrimary
          type="submit"
          disabled={!canSubmit}
          loading={status === 'saving'}
        >
          {status === 'saving' ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
        </AuthButtonPrimary>
    </form>
  )
}
