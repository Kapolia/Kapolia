'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { accepterCreneau, isRdvPlusPropose } from '@/lib/rdv'
import { C } from '@/lib/colors'

type Props = {
  rdvId:        string
  creneauId:    string
  recruteurNom: string
  entrepriseNom: string
  onConfirme:   () => void
  onAnnuler:    () => void
  onExpire:     () => void
}

export default function NumeroAppel({ rdvId, creneauId, recruteurNom, entrepriseNom, onConfirme, onAnnuler, onExpire }: Props) {
  const [telephone,  setTelephone]  = useState<string | null>(null)   // null = loading
  const [mode,       setMode]       = useState<'affichage' | 'saisie'>('saisie')
  const [inputVal,   setInputVal]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg,     setErrMsg]     = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setTelephone(''); return }
      supabase.from('profils').select('telephone').eq('user_id', user.id).single()
        .then(({ data, error }) => {
          if (error) {
            console.error('[NumeroAppel fetch]', error.message, error.code, error.details, error.hint)
            setTelephone('')
            setMode('saisie')
            return
          }
          const tel = (data as { telephone?: string | null } | null)?.telephone ?? null
          if (tel) {
            setTelephone(tel)
            setInputVal(tel)
            setMode('affichage')
          } else {
            setTelephone('')
            setMode('saisie')
          }
        })
    })
  }, [])

  const digits     = inputVal.replace(/\D/g, '')
  const canConfirm = (mode === 'affichage' || digits.length >= 10) && !submitting

  async function confirmer() {
    if (!canConfirm) return
    setSubmitting(true)
    setErrMsg(null)

    if (mode === 'saisie' && inputVal.trim() !== (telephone ?? '')) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error: telErr } = await supabase
          .from('profils')
          .update({ telephone: inputVal.trim() })
          .eq('user_id', user.id)
        if (telErr) {
          console.error('[NumeroAppel update]', telErr.message, telErr.code, telErr.details, telErr.hint)
          setErrMsg('Votre numéro n\'a pas pu être enregistré. Réessayez dans un instant.')
          setSubmitting(false)
          return
        }
      }
    }

    const { error } = await accepterCreneau(rdvId, creneauId)
    if (error) {
      setSubmitting(false)
      if (isRdvPlusPropose(error)) { onExpire() } else {
        setErrMsg('Le créneau n\'a pas pu être confirmé. Réessayez dans un instant.')
      }
      return
    }
    setSubmitting(false)
    onConfirme()
  }

  if (telephone === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
        <style suppressHydrationWarning>{`@keyframes na-sp{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${C.sable}`, borderTopColor: C.orange, animation: 'na-sp 0.7s linear infinite' }} />
      </div>
    )
  }

  return (
    <div>
      <style suppressHydrationWarning>{`@keyframes na-sp{to{transform:rotate(360deg)}}`}</style>

      {mode === 'affichage' ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: C.dark }}>
            {recruteurNom} vous appellera au <strong>{telephone}</strong>.
          </span>
          <button
            onClick={() => setMode('saisie')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.orangeTexte, fontFamily: 'inherit', padding: 0 }}
          >
            Modifier
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, color: C.dark, margin: '0 0 8px', lineHeight: 1.55 }}>
            Votre numéro, pour que {recruteurNom} puisse vous appeler :
          </p>
          <input
            type="tel"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="06 00 00 00 00"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${C.sable}`, fontSize: 13, fontFamily: 'inherit', color: C.dark, outline: 'none', backgroundColor: C.white }}
          />
        </div>
      )}

      {errMsg && (
        <p style={{ fontSize: 11, color: '#8A3B12', margin: '0 0 10px', lineHeight: 1.5 }}>{errMsg}</p>
      )}

      <p style={{ fontSize: 12.5, color: C.grey, margin: '0 0 12px', lineHeight: 1.5 }}>
        En confirmant, vous partagez ce numéro avec {entrepriseNom} pour cet appel. Il est aussi enregistré dans votre profil, où vous seul le voyez.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={confirmer}
          disabled={!canConfirm}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            backgroundColor: C.orange, color: '#fff', fontWeight: 600,
            borderRadius: 10, padding: '9px 16px', fontSize: 13,
            border: 'none', fontFamily: 'inherit',
            cursor: !canConfirm ? 'default' : 'pointer',
            opacity: !canConfirm ? 0.5 : 1, transition: 'opacity 0.15s',
          }}
        >
          {submitting
            ? <><div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'na-sp 0.7s linear infinite', flexShrink: 0 }} /> Confirmer ce créneau</>
            : 'Confirmer ce créneau'
          }
        </button>
        <button
          onClick={onAnnuler}
          disabled={submitting}
          style={{ background: 'none', border: 'none', cursor: submitting ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, color: C.grey, fontFamily: 'inherit', padding: 0, opacity: submitting ? 0.5 : 1 }}
        >
          Revenir
        </button>
      </div>
    </div>
  )
}
