'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LogoKapolia from '@/components/LogoKapolia'
import { FONT_SERIF } from '@/lib/typography'
import { safeNext, redirectAfterAuth, OAUTH_NEXT_KEY } from '@/lib/auth-redirect'

const C = {
  terracotta: '#C4673A',
  sable:      '#E7EAE8',
  creme:      '#F6F7F6',
  vert:       '#2C4A3E',
  dark:       '#15201B',
  grey:       '#687069',
  lightGrey:  '#D0D0D0',
  white:      '#FFFFFF',
  error:      '#C0392B',
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = 'text', placeholder, error, suffix,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  error?: string
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
          autoComplete={type === 'email' ? 'email' : type === 'password' ? 'current-password' : undefined}
          style={{
            width: '100%',
            padding: suffix ? '12px 44px 12px 14px' : '12px 14px',
            fontSize: '15px',
            borderRadius: '12px',
            border: `1.5px solid ${hasError ? C.error : value ? C.sable : C.lightGrey}`,
            backgroundColor: C.white,
            color: C.dark,
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
        />
        {suffix && (
          <div style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)' }}>
            {suffix}
          </div>
        )}
      </div>
      {hasError && (
        <span style={{ fontSize: '12px', color: C.error }}>{error}</span>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConnexionPage() {
  const router = useRouter()

  const [email,          setEmail]          = useState('')
  const [password,       setPassword]       = useState('')
  const [showPassword,   setShowPassword]   = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [serverError,    setServerError]    = useState('')
  const [oauthLoading,   setOauthLoading]   = useState(false)

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setServerError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setServerError('Email ou mot de passe incorrect.')
      setSubmitting(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setServerError('Une erreur inattendue est survenue.')
      setSubmitting(false)
      return
    }

    const { data: profil } = await supabase
      .from('profils')
      .select('type_compte, onboarding_completed')
      .eq('user_id', user.id)
      .single()

    const next = safeNext(new URLSearchParams(window.location.search).get('next'))
    redirectAfterAuth(router, profil ?? null, next)
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
    <main style={{
      minHeight: '100vh',
      backgroundColor: C.creme,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 'clamp(40px, 6%, 72px) clamp(20px, 5%, 40px)',
    }}>
      <style suppressHydrationWarning>
        {`@keyframes kapolia-spin { to { transform: rotate(360deg); } }`}
      </style>

      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <a
        href="/"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          textDecoration: 'none',
          marginBottom: '40px',
        }}
      >
        <LogoKapolia variante="sombre" taille={40} />
      </a>

      {/* ── Card ──────────────────────────────────────────────────────────── */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: C.white,
        borderRadius: '24px',
        padding: 'clamp(28px, 5%, 44px)',
        boxShadow: '0 2px 24px rgba(26,26,26,0.07)',
      }}>

        <h1 style={{
          fontFamily: FONT_SERIF,
          fontSize: 'clamp(24px, 4vw, 32px)',
          color: C.dark,
          fontWeight: '400',
          margin: '0 0 6px',
          lineHeight: 1.15,
        }}>
          Bon retour.
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: C.grey, lineHeight: 1.5 }}>
          Votre cap vous attend.
        </p>

        {/* ── Bouton Google ──────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={oauthLoading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1.5px solid #DADCE0',
            backgroundColor: C.white,
            cursor: oauthLoading ? 'default' : 'pointer',
            fontSize: '15px',
            fontWeight: '500',
            color: C.dark,
            transition: 'background-color 0.15s',
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
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Continuer avec Google
        </button>

        {/* ── Séparateur ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '20px 0 4px',
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: C.sable }} />
          <span style={{ fontSize: '12px', color: C.lightGrey, fontWeight: '500' }}>ou</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: C.sable }} />
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <Field
            label="Adresse e-mail"
            value={email}
            onChange={v => { setEmail(v); setServerError('') }}
            type="email"
            placeholder="vous@exemple.fr"
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Field
              label="Mot de passe"
              value={password}
              onChange={v => { setPassword(v); setServerError('') }}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
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
            <div style={{ textAlign: 'right' }}>
              <a
                href="/mot-de-passe-oublie"
                style={{ fontSize: '12px', color: C.grey, textDecoration: 'none' }}
              >
                Mot de passe oublié ?
              </a>
            </div>
          </div>

          {serverError && (
            <div style={{
              padding: '11px 14px',
              borderRadius: '10px',
              backgroundColor: '#fdf2f2',
              border: `1px solid ${C.error}30`,
              color: C.error,
              fontSize: '13px',
              lineHeight: '1.5',
            }}>
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              border: 'none',
              backgroundColor: canSubmit ? C.terracotta : C.sable,
              color: canSubmit ? C.white : C.grey,
              fontSize: '15px',
              fontWeight: '600',
              cursor: canSubmit ? 'pointer' : 'default',
              transition: 'background-color 0.2s, color 0.2s',
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
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>

        </form>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '24px 0',
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: C.sable }} />
          <span style={{ fontSize: '12px', color: C.lightGrey, fontWeight: '500' }}>ou</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: C.sable }} />
        </div>

        <a
          href="/inscription"
          style={{
            display: 'block',
            width: '100%',
            padding: '13px',
            borderRadius: '14px',
            border: `1.5px solid ${C.sable}`,
            backgroundColor: 'transparent',
            color: C.dark,
            fontSize: '14px',
            fontWeight: '600',
            textAlign: 'center',
            textDecoration: 'none',
            transition: 'border-color 0.15s',
            boxSizing: 'border-box',
          }}
        >
          Créer un compte
        </a>

      </div>

      <p style={{
        marginTop: '32px',
        fontSize: '12px',
        color: C.lightGrey,
        fontFamily: FONT_SERIF,
        fontStyle: 'italic',
        textAlign: 'center',
      }}>
        « Trouvez votre cap. »
      </p>

    </main>
  )
}
