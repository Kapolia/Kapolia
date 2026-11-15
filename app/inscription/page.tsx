'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LogoKapolia from '@/components/LogoKapolia'
import { FONT_SANS } from '@/lib/typography'
import { safeNext, storeNext, OAUTH_TYPE_KEY, OAUTH_NEXT_KEY } from '@/lib/auth-redirect'
import { C as _C } from '@/lib/colors'
import { isValidEmail } from '@/lib/validation'
const C = { ..._C, lightGrey: '#D0D0D0' as const }

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = 'text', placeholder, error, hint, suffix,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  error?: string
  hint?: string
  suffix?: React.ReactNode
}) {
  const hasError = Boolean(error)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: C.dark, letterSpacing: '0.02em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: suffix ? '12px 44px 12px 14px' : '12px 14px',
            fontSize: '15px',
            borderRadius: '12px',
            border: `1.5px solid ${hasError ? C.erreur : value ? C.sable : C.lightGrey}`,
            backgroundColor: C.white,
            color: C.dark,
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
        />
        {suffix && (
          <div style={{
            position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)',
          }}>
            {suffix}
          </div>
        )}
      </div>
      {hasError && (
        <span style={{ fontSize: '12px', color: C.erreur }}>{error}</span>
      )}
      {hint && !hasError && (
        <span style={{ fontSize: '12px', color: C.grey }}>{hint}</span>
      )}
    </div>
  )
}


function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type AccountType = 'candidat' | 'recruteur' | null

export default function InscriptionPage() {
  const router = useRouter()

  const [accountType, setAccountType] = useState<AccountType>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false, confirm: false })
  const [submitting,   setSubmitting]   = useState(false)
  const [serverError,  setServerError]  = useState('')
  const [oauthLoading, setOauthLoading] = useState(false)

  // Errors (only shown after field touched)
  const emailError = touched.email && email && !isValidEmail(email) ? 'Adresse e-mail invalide' : ''
  const passwordError = touched.password && password && password.length < 8 ? '8 caractères minimum' : ''
  const confirmError = touched.confirm && confirm && confirm !== password ? 'Les mots de passe ne correspondent pas' : ''

  const isValid =
    accountType !== null &&
    isValidEmail(email) &&
    password.length >= 8 &&
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
    <main style={{
      minHeight: '100vh',
      backgroundColor: C.bg,
      display: 'flex',
      flexDirection: 'column',
      padding: 'clamp(20px, 4%, 40px) clamp(20px, 5%, 40px)',
    }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Logo */}
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'center' }}>
        <LogoKapolia variante="sombre" taille={40} />
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '460px',
        margin: '0 auto',
        backgroundColor: C.white,
        borderRadius: '24px',
        padding: 'clamp(28px, 5%, 44px)',
        boxShadow: '0 2px 24px rgba(26,26,26,0.07)',
      }}>

        {/* Header */}
        <h1 style={{
          fontFamily: FONT_SANS, letterSpacing: '-0.005em',
          fontSize: 'clamp(22px, 4vw, 28px)',
          color: C.dark,
          fontWeight: 700,
          margin: '0 0 28px',
        }}>
          Créez votre profil
        </h1>
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

          {/* Account type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: C.dark, letterSpacing: '0.02em' }}>
              Je suis…
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <AccountCard
                label="Candidat"
                desc="Je cherche un poste"
                emoji="👤"
                selected={accountType === 'candidat'}
                color={C.terracotta}
                onClick={() => setAccountType('candidat')}
              />
              <AccountCard
                label="Recruteur"
                desc="Je recrute des talents"
                emoji="🔍"
                selected={accountType === 'recruteur'}
                color={C.vert}
                onClick={() => setAccountType('recruteur')}
              />
            </div>
          </div>

          {/* Bouton Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={!accountType || oauthLoading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderRadius: '12px',
              border: `1.5px solid ${!accountType ? C.sable : '#DADCE0'}`,
              backgroundColor: C.white,
              cursor: !accountType || oauthLoading ? 'default' : 'pointer',
              fontSize: '15px',
              fontWeight: '500',
              color: !accountType ? C.grey : C.dark,
              transition: 'all 0.15s',
              fontFamily: 'inherit',
              opacity: oauthLoading ? 0.7 : 1,
            }}
          >
            {oauthLoading ? (
              <span style={{
                display: 'inline-block',
                width: '18px', height: '18px',
                borderRadius: '50%',
                border: `2px solid ${C.lightGrey}`,
                borderTopColor: C.grey,
                animation: 'kapolia-spin 0.7s linear infinite',
                flexShrink: 0,
              }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
                style={{ opacity: !accountType ? 0.4 : 1, transition: 'opacity 0.15s' }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continuer avec Google
          </button>

          {/* Séparateur ou */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: C.sable }} />
            <span style={{ fontSize: '12px', color: C.lightGrey, fontWeight: '500' }}>ou</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: C.sable }} />
          </div>

          {/* Email */}
          <Field
            label="Adresse e-mail"
            value={email}
            onChange={v => { setEmail(v); setTouched(t => ({ ...t, email: true })) }}
            type="email"
            placeholder="sophie@exemple.fr"
            error={emailError}
          />

          {/* Mot de passe */}
          <Field
            label="Mot de passe"
            value={password}
            onChange={v => { setPassword(v); setTouched(t => ({ ...t, password: true })) }}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            error={passwordError}
            hint={!passwordError && password ? undefined : '8 caractères minimum'}
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                <EyeIcon open={showPassword} />
              </button>
            }
          />

          {/* Confirmation */}
          <Field
            label="Confirmer le mot de passe"
            value={confirm}
            onChange={v => { setConfirm(v); setTouched(t => ({ ...t, confirm: true })) }}
            type={showConfirm ? 'text' : 'password'}
            placeholder="••••••••"
            error={confirmError}
            suffix={
              <button
                type="button"
                onClick={() => setShowConfirm(s => !s)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                aria-label={showConfirm ? 'Masquer' : 'Afficher'}
              >
                <EyeIcon open={showConfirm} />
              </button>
            }
          />

          {/* Server error */}
          {serverError && (
            <p style={{
              margin: 0,
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: '#fdf2f2',
              border: `1px solid ${C.erreur}30`,
              color: C.erreur,
              fontSize: '13px',
              lineHeight: '1.5',
            }}>
              {serverError}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid || submitting}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              border: 'none',
              backgroundColor: isValid ? C.terracotta : C.sable,
              color: isValid ? C.white : C.grey,
              fontSize: '15px',
              fontWeight: '600',
              cursor: isValid && !submitting ? 'pointer' : 'default',
              transition: 'all 0.2s',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {submitting && (
              <span style={{
                display: 'inline-block',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.35)',
                borderTopColor: '#fff',
                animation: 'kapolia-spin 0.7s linear infinite',
                flexShrink: 0,
              }} />
            )}
            {submitting ? 'Création…' : 'Créer mon compte'}
          </button>

        </form>

        {/* Login link */}
        <p style={{ textAlign: 'center', marginTop: '22px', fontSize: '13px', color: C.grey }}>
          Déjà un compte ?{' '}
          <a href="/connexion" style={{ color: C.terracotta, fontWeight: '600', textDecoration: 'none' }}>
            Se connecter
          </a>
        </p>

      </div>
    </main>
  )
}

// ─── Account card ─────────────────────────────────────────────────────────────

function AccountCard({
  label, desc, emoji, selected, color, onClick,
}: {
  label: string
  desc: string
  emoji: string
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
      <span style={{ fontSize: '22px', lineHeight: 1 }}>{emoji}</span>
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
