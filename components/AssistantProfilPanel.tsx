'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'

const C = {
  terracotta: '#C4673A',
  sable:      '#E7EAE8',
  creme:      '#F6F7F6',
  vert:       '#2C4A3E',
  dark:       '#15201B',
  grey:       '#687069',
  white:      '#FFFFFF',
}

type Phase = 'idle' | 'loading' | 'done' | 'error' | 'quota_atteint'

function formatDateAnalyse(iso: string): string {
  const date = new Date(iso)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  if (date.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
  return date.toLocaleDateString('fr-FR', opts)
}

export default function AssistantProfilPanel({ isEditing }: { isEditing: boolean }) {
  const [open, setOpen]           = useState(false)
  const [phase, setPhase]         = useState<Phase>('idle')
  const [reponse, setReponse]     = useState('')
  const [analysedAt, setAnalysedAt] = useState<string | null>(null)
  const [erreur, setErreur]       = useState('')
  const [hovered, setHovered]     = useState(false)

  useEffect(() => {
    let mounted = true
    async function chargerDernier() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !mounted) return
      try {
        const res  = await fetch('/api/assistant-profil', {
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
  }, [])

  if (isEditing) return null

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
      const res  = await fetch('/api/assistant-profil', {
        method:  'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
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

  return (
    <>
      {/* ── Panneau ──────────────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-label="Assistant Kapolia"
        aria-hidden={!open}
        style={{
          position:        'fixed',
          right:           28,
          bottom:          88,
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
          transform:       open ? 'translateX(0) scale(1)' : 'translateX(calc(100% + 60px)) scale(0.97)',
          opacity:         open ? 1 : 0,
          transition:      'transform 0.25s cubic-bezier(0.16,1,0.3,1), opacity 0.2s',
          pointerEvents:   open ? 'auto' : 'none',
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
            <div style={{ fontFamily: FONT_SERIF, fontSize: 16, color: C.dark, lineHeight: 1.3 }}>
              Qu&apos;est-ce qui manque à mon profil ?
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
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
                L&apos;assistant analyse l&apos;état de votre profil et vous explique ce qui manque
                pour être mieux repéré par les recruteurs.
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
                @keyframes ia-spin { to { transform: rotate(360deg); } }
              `}</style>
              <div style={{
                width:          28,
                height:         28,
                borderRadius:   '50%',
                border:         `2.5px solid ${C.sable}`,
                borderTopColor: C.terracotta,
                animation:      'ia-spin 0.8s linear infinite',
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
              <p style={{ fontSize: 13, color: '#C0392B', lineHeight: 1.6, margin: 0 }}>
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

      {/* ── Bouton flottant ───────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Analyser mon profil"
        aria-label="Analyser mon profil"
        style={{
          position:        'fixed',
          bottom:          28,
          right:           28,
          height:          54,
          width:           hovered ? 210 : 54,
          backgroundColor: C.terracotta,
          border:          'none',
          borderRadius:    27,
          boxShadow:       '0 4px 16px rgba(34,49,43,.22)',
          cursor:          'pointer',
          fontFamily:      'inherit',
          zIndex:          200,
          display:         'flex',
          alignItems:      'center',
          overflow:        'hidden',
          paddingLeft:     15,
          paddingRight:    0,
          transition:      'width 280ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Tracés de l'aiguille Kapolia, repris de LogoKapolia, en crème */}
        <svg
          viewBox="0 0 42 42"
          width={22}
          height={22}
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M14 29 L21 12 L28 29"
            fill="none"
            stroke={C.creme}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 29 L21 25 L28 29"
            fill="none"
            stroke={C.creme}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Libellé révélé au survol */}
        <span style={{
          display:    'block',
          maxWidth:   hovered ? '160px' : '0px',
          overflow:   'hidden',
          whiteSpace: 'nowrap',
          opacity:    hovered ? 1 : 0,
          marginLeft: 9,
          fontSize:   13.5,
          fontWeight: 500,
          color:      C.creme,
          transition: [
            'max-width 280ms cubic-bezier(0.16,1,0.3,1)',
            `opacity ${hovered ? '160ms 100ms' : '80ms 0ms'}`,
          ].join(', '),
        }}>
          Analyser mon profil
        </span>
      </button>
    </>
  )
}
