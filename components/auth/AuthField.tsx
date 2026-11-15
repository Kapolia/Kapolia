'use client'

import { useState, useRef, useEffect } from 'react'
import { C } from '@/lib/colors'
import { reduitMouvement } from '@/lib/motion'

interface AuthFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'email' | 'password'
  placeholder?: string
  autoComplete: string
  error?: boolean
  shake?: number
  hint?: string
  children?: React.ReactNode
}

export default function AuthField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  error = false,
  shake = 0,
  hint,
  children,
}: AuthFieldProps) {
  const isPassword = type === 'password'
  const [show, setShow] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!shake) return
    if (reduitMouvement()) return
    const el = wrapRef.current
    if (!el) return
    el.classList.remove('auth-input-wrap--shake')
    void el.offsetWidth
    el.classList.add('auth-input-wrap--shake')
  }, [shake])

  const inputClass = [
    'auth-input',
    isPassword ? 'auth-input--pw' : '',
    error ? 'auth-input--error' : '',
  ].filter(Boolean).join(' ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '14px', fontWeight: 600, color: C.dark, display: 'block' }}>
        {label}
      </label>

      <div ref={wrapRef} className="auth-input-wrap">
        <input
          type={isPassword ? (show ? 'text' : 'password') : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={inputClass}
        />

        {isPassword && (
          <button
            type="button"
            className="auth-eye-btn"
            onClick={() => setShow(s => !s)}
            aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            <span className={`auth-eye-icon${show ? '' : ' auth-eye-icon--hidden'}`} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke={C.grey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </span>
            <span className={`auth-eye-icon${show ? ' auth-eye-icon--hidden' : ''}`} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke={C.grey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </span>
          </button>
        )}
      </div>

      {hint && <span style={{ fontSize: '13px', color: C.grey }}>{hint}</span>}
      {children}
    </div>
  )
}
