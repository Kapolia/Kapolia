'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable: '#E8D5B7',
  creme: '#F7F2EB',
  vert: '#2C4A3E',
  dark: '#1A1A1A',
  grey: '#6B6B6B',
  lightGrey: '#D0D0D0',
  white: '#FFFFFF',
  error: '#C0392B',
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

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
          <div style={{
            position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)',
          }}>
            {suffix}
          </div>
        )}
      </div>
      {hasError && (
        <span style={{ fontSize: '12px', color: C.error }}>{error}</span>
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
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

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

    router.push(accountType === 'candidat' ? '/onboarding' : '/recruteur')
  }

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: C.creme,
      display: 'flex',
      flexDirection: 'column',
      padding: 'clamp(20px, 4%, 40px) clamp(20px, 5%, 40px)',
    }}>
      <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Logo */}
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'center' }}>
        <img src="/logo-kavio.png" alt="Kavio" style={{ height: '64px', objectFit: 'contain' }} />
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
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(22px, 4vw, 28px)',
          color: C.dark,
          fontWeight: '400',
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

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: C.sable }} />

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
              border: `1px solid ${C.error}30`,
              color: C.error,
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
                animation: 'kavio-spin 0.7s linear infinite',
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
