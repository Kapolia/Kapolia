'use client'

import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { C } from '@/lib/colors'
import { FONT_SANS } from '@/lib/typography'
import { Bandeau, type BandeauHandle } from '@/components/Bandeau'

const KNOB_TRAVEL = 18
const TRANSITION = '220ms cubic-bezier(.3,.7,.4,1)'

interface InterrupteurProps {
  checked: boolean
  onChange: (v: boolean) => Promise<void>
  disabled?: boolean
  id?: string
}

export interface InterrupteurHandle {
  revert: () => void
}

const Interrupteur = forwardRef<InterrupteurHandle, InterrupteurProps>(function Interrupteur(
  { checked, onChange, disabled = false, id },
  ref,
) {
  const [optimistic, setOptimistic] = useState(checked)
  const [saving, setSaving] = useState(false)
  const [savedVisible, setSavedVisible] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bandeauRef = useRef<BandeauHandle>(null)

  useEffect(() => {
    setOptimistic(checked)
  }, [checked])

  useImperativeHandle(ref, () => ({
    revert() {
      setOptimistic(checked)
    },
  }))

  async function handleToggle() {
    if (disabled || saving) return
    const next = !optimistic
    setOptimistic(next)
    setSaving(true)

    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    setSavedVisible(false)

    try {
      await onChange(next)
      setSavedVisible(true)
      savedTimerRef.current = setTimeout(() => setSavedVisible(false), 1600)
    } catch (err) {
      console.error('[Interrupteur] échec sauvegarde', err)
      setOptimistic(!next)
      bandeauRef.current?.animateOut(() => {})
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
  }, [])

  return (
    <>
      <Bandeau
        ref={bandeauRef}
        message="Le réglage n'a pas pu être enregistré. Veuillez réessayer."
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: C.succes,
          fontFamily: FONT_SANS,
          opacity: savedVisible ? 1 : 0,
          transition: 'opacity 250ms',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          whiteSpace: 'nowrap',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.succes} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Enregistré
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={optimistic}
          id={id}
          onClick={handleToggle}
          disabled={disabled}
          style={{
            width: 42,
            height: 24,
            borderRadius: 12,
            backgroundColor: optimistic ? C.vert : C.interrupteurInactif,
            border: 'none',
            padding: 0,
            position: 'relative',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.4 : 1,
            transition: `background-color ${TRANSITION}`,
            flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute',
            top: 3,
            left: optimistic ? KNOB_TRAVEL + 3 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            backgroundColor: C.white,
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            transition: `left ${TRANSITION}`,
          }} />
        </button>
      </div>
    </>
  )
})

export default Interrupteur
