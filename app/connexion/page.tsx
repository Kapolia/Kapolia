'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  vert:       '#2C4A3E',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  lightGrey:  '#D0D0D0',
  white:      '#FFFFFF',
  error:      '#C0392B',
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CompassIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="12.5" stroke={C.sable} strokeWidth="1.5" />
      <polygon points="14,4 16,14 14,12 12,14" fill={C.terracotta} />
      <polygon points="14,24 16,14 14,16 12,14" fill={C.lightGrey} />
      <circle cx="14" cy="14" r="1.8" fill={C.dark} />
    </svg>
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

function PersonIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function BuildingIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  )
}

// ─── Type selector cards ───────────────────────────────────────────────────────

type TypeCompte = 'candidat' | 'recruteur' | null

function TypeCard({
  type, selected, onClick,
}: {
  type: 'candidat' | 'recruteur'
  selected: boolean
  onClick: () => void
}) {
  const isCandidат = type === 'candidat'
  const accentColor = isCandidат ? C.terracotta : C.vert
  const label  = isCandidат ? 'Je suis candidat(e)' : 'Je recrute'
  const iconColor = selected ? C.white : accentColor

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '14px 12px',
        borderRadius: '14px',
        border: `2px solid ${selected ? accentColor : C.sable}`,
        backgroundColor: selected ? accentColor : C.white,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.18s ease',
        outline: 'none',
      }}
    >
      {isCandidат
        ? <PersonIcon color={iconColor} />
        : <BuildingIcon color={iconColor} />
      }
      <span style={{
        fontSize: '13px',
        fontWeight: '600',
        color: selected ? C.white : C.dark,
        transition: 'color 0.18s',
        lineHeight: 1.2,
        textAlign: 'center',
      }}>
        {label}
      </span>
    </button>
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

// ─── Mismatch notice ──────────────────────────────────────────────────────────

function MismatchNotice({ realType }: { realType: 'candidat' | 'recruteur' }) {
  const label = realType === 'candidat' ? 'candidat' : 'recruteur'
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: '10px',
      backgroundColor: `${C.sable}50`,
      border: `1px solid ${C.sable}`,
      color: C.grey,
      fontSize: '13px',
      lineHeight: 1.5,
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
    }}>
      <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>ℹ️</span>
      <span>
        Ce compte est un compte <strong style={{ color: C.dark }}>{label}</strong>.
        Vous allez être redirigé(e) vers la bonne page.
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConnexionPage() {
  const router = useRouter()

  const [typeChoisi, setTypeChoisi] = useState<TypeCompte>(null)
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [mismatch, setMismatch]     = useState<'candidat' | 'recruteur' | null>(null)

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting

  function toggleType(t: 'candidat' | 'recruteur') {
    setTypeChoisi(prev => prev === t ? null : t)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setServerError('')
    setMismatch(null)

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
      .select('type_compte')
      .eq('user_id', user.id)
      .single()

    const realType: 'candidat' | 'recruteur' =
      profil?.type_compte === 'recruteur' ? 'recruteur' : 'candidat'

    const destination = realType === 'recruteur' ? '/recruteur' : '/dashboard'

    // Type sélectionné ne correspond pas → afficher le message puis rediriger
    if (typeChoisi !== null && typeChoisi !== realType) {
      setMismatch(realType)
      setSubmitting(false)
      setTimeout(() => router.replace(destination), 2400)
      return
    }

    router.replace(destination)
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
        {`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}
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
        <img src="/logo-kavio.png" alt="Kavio" style={{ height: '64px', objectFit: 'contain' }} />
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

        {/* Titre */}
        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(24px, 4vw, 32px)',
          color: C.dark,
          fontWeight: '400',
          margin: '0 0 6px',
          lineHeight: 1.15,
        }}>
          Bon retour.
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: '14px', color: C.grey, lineHeight: 1.5 }}>
          Votre cap vous attend.
        </p>

        {/* ── Type de compte ────────────────────────────────────────────── */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{
            fontSize: '12px', fontWeight: '600', color: C.grey,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            margin: '0 0 10px',
          }}>
            Vous êtes — <span style={{ fontWeight: '400' }}>facultatif</span>
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <TypeCard
              type="candidat"
              selected={typeChoisi === 'candidat'}
              onClick={() => toggleType('candidat')}
            />
            <TypeCard
              type="recruteur"
              selected={typeChoisi === 'recruteur'}
              onClick={() => toggleType('recruteur')}
            />
          </div>
        </div>

        {/* Séparateur */}
        <div style={{
          height: '1px', backgroundColor: C.sable, margin: '0 0 28px',
        }} />

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Email */}
          <Field
            label="Adresse e-mail"
            value={email}
            onChange={v => { setEmail(v); setServerError('') }}
            type="email"
            placeholder="vous@exemple.fr"
          />

          {/* Mot de passe */}
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
                href="#"
                onClick={e => e.preventDefault()}
                style={{ fontSize: '12px', color: C.grey, textDecoration: 'none' }}
              >
                Mot de passe oublié ?
              </a>
            </div>
          </div>

          {/* Mismatch notice */}
          {mismatch && <MismatchNotice realType={mismatch} />}

          {/* Erreur serveur */}
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

          {/* Submit */}
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
            {submitting && !mismatch && (
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
            {submitting && !mismatch ? 'Connexion…' : 'Se connecter'}
          </button>

        </form>

        {/* Séparateur */}
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

        {/* Créer un compte */}
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

      {/* Baseline */}
      <p style={{
        marginTop: '32px',
        fontSize: '12px',
        color: C.lightGrey,
        fontFamily: 'Georgia, serif',
        fontStyle: 'italic',
        textAlign: 'center',
      }}>
        « Trouvez votre cap. »
      </p>

    </main>
  )
}
