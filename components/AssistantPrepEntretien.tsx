'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import { C } from '@/lib/colors'

type Phase = 'idle' | 'loading' | 'done' | 'error' | 'quota_atteint'

function formatDateAnalyse(iso: string): string {
  const date = new Date(iso)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  if (date.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
  return date.toLocaleDateString('fr-FR', opts)
}

export default function AssistantPrepEntretien({
  rdvId,
  dateRdv,
  typeRdv,
  onClose,
}: {
  rdvId:   string
  dateRdv: string
  typeRdv: 'telephonique' | 'entretien'
  onClose: () => void
}) {
  const [phase, setPhase]           = useState<Phase>('idle')
  const [reponse, setReponse]       = useState('')
  const [analysedAt, setAnalysedAt] = useState<string | null>(null)
  const [erreur, setErreur]         = useState('')
  const [visible, setVisible]       = useState(false)

  const question  = typeRdv === 'telephonique' ? 'Comment préparer cet appel ?' : 'Comment préparer cet entretien ?'
  const dateLabel = (() => {
    if (!dateRdv) return ''
    const d = new Date(dateRdv)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  })()

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))

    let mounted = true
    async function chargerDernier() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !mounted) return
      try {
        const res  = await fetch(`/api/prep-entretien?rdv_id=${encodeURIComponent(rdvId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok || !mounted) return
        const data = await res.json()
        if (data.reponse && mounted) {
          setReponse(data.reponse)
          setAnalysedAt(data.analysed_at ?? null)
          setPhase('done')
        }
      } catch {
        // silencieux — l'utilisateur verra l'état idle
      }
    }
    chargerDernier()
    return () => { mounted = false }
  }, [rdvId])

  async function lancer() {
    setPhase('loading')
    setErreur('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setPhase('error')
      setErreur('Session expirée, veuillez vous reconnecter.')
      return
    }

    try {
      const res  = await fetch('/api/prep-entretien', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rdv_id: rdvId }),
      })
      const data = await res.json()

      if (res.status === 429) { setPhase('quota_atteint'); return }

      if (!res.ok || data.error) {
        setPhase('error')
        setErreur(typeof data.error === 'string' ? data.error : `Erreur ${res.status}`)
        return
      }

      setReponse(data.reponse)
      setAnalysedAt(data.analysed_at ?? null)
      setPhase('done')
    } catch (err) {
      setPhase('error')
      setErreur(`Erreur réseau : ${String(err)}`)
    }
  }

  function fermer() {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  return (
    <div
      role="dialog"
      aria-label="Assistant Kapolia"
      style={{
        position:        'fixed',
        right:           28,
        bottom:          28,
        width:           380,
        maxHeight:       500,
        backgroundColor: C.white,
        border:          `1px solid ${C.sable}`,
        borderRadius:    20,
        boxShadow:       '0 8px 32px rgba(0,0,0,0.12)',
        display:         'flex',
        flexDirection:   'column',
        overflow:        'hidden',
        zIndex:          200,
        transform:       visible ? 'translateX(0) scale(1)' : 'translateX(calc(100% + 60px)) scale(0.97)',
        opacity:         visible ? 1 : 0,
        transition:      'transform 0.25s cubic-bezier(0.16,1,0.3,1), opacity 0.2s',
      }}
    >
      {/* En-tête */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '18px 20px 14px',
        borderBottom:   `1px solid ${C.sable}`,
        flexShrink:     0,
      }}>
        <div>
          <div style={{
            fontSize:      11,
            fontWeight:    600,
            color:         C.terracotta,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom:  4,
          }}>
            Assistant Kapolia
          </div>
          <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 16, color: C.dark, lineHeight: 1.3 }}>
            {question}
          </div>
          {dateLabel && (
            <div style={{ fontSize: 11, color: C.grey, marginTop: 3 }}>{dateLabel}</div>
          )}
        </div>
        <button
          onClick={fermer}
          aria-label="Fermer le panneau"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.grey, padding: 4, lineHeight: 1, flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Corps */}
      <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>

        {phase === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: C.grey, lineHeight: 1.65, margin: 0 }}>
              L&apos;assistant analyse le poste, l&apos;entreprise et votre profil pour identifier
              les points sur lesquels concentrer votre préparation.
            </p>
            <button
              onClick={lancer}
              style={{
                backgroundColor: C.vert,
                color:           C.white,
                border:          'none',
                borderRadius:    12,
                padding:         '11px 20px',
                fontSize:        13,
                fontWeight:      600,
                cursor:          'pointer',
                fontFamily:      'inherit',
              }}
            >
              Lancer l&apos;analyse
            </button>
          </div>
        )}

        {phase === 'loading' && (
          <div style={{
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            gap:           14,
            padding:       '28px 0',
          }}>
            <style suppressHydrationWarning>{`
              @keyframes ia-pe-spin { to { transform: rotate(360deg); } }
            `}</style>
            <div style={{
              width:          28,
              height:         28,
              borderRadius:   '50%',
              border:         `2.5px solid ${C.sable}`,
              borderTopColor: C.terracotta,
              animation:      'ia-pe-spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: 13, color: C.grey }}>Analyse en cours...</span>
          </div>
        )}

        {phase === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{
              fontSize:   14,
              color:      C.dark,
              lineHeight: 1.7,
              margin:     0,
              whiteSpace: 'pre-wrap',
            }}>
              {reponse}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              {analysedAt && (
                <span style={{ fontSize: 11, color: C.grey }}>
                  Analyse du {formatDateAnalyse(analysedAt)}
                </span>
              )}
              <button
                onClick={lancer}
                style={{
                  background:   'none',
                  border:       `1px solid ${C.sable}`,
                  borderRadius: 10,
                  padding:      '7px 14px',
                  fontSize:     12,
                  color:        C.grey,
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                  whiteSpace:   'nowrap',
                  flexShrink:   0,
                }}
              >
                Relancer l&apos;analyse
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: C.erreur, lineHeight: 1.6, margin: 0 }}>
              {erreur || 'Une erreur est survenue.'}
            </p>
            <button
              onClick={() => setPhase(reponse ? 'done' : 'idle')}
              style={{
                background:   'none',
                border:       `1px solid ${C.sable}`,
                borderRadius: 10,
                padding:      '8px 16px',
                fontSize:     12,
                color:        C.grey,
                cursor:       'pointer',
                fontFamily:   'inherit',
                alignSelf:    'flex-start',
              }}
            >
              Réessayer
            </button>
          </div>
        )}

        {phase === 'quota_atteint' && (
          <p style={{ fontSize: 13, color: C.grey, lineHeight: 1.65, margin: 0 }}>
            Vous avez atteint la limite de 5 analyses par jour pour cette question.
            Le quota se renouvelle le lendemain.
          </p>
        )}

      </div>
    </div>
  )
}
