'use client'
import React, { useState } from 'react'
import { C } from '@/lib/colors'
import { COMP_REF, DOMAINES } from '@/lib/referentiels'
import ChampSuggestions from '@/components/profil/ChampSuggestions'

const SUGGESTIONS_COMP = Object.values(COMP_REF).flat()
const MAX = 15

type Props = {
  valeurs: string[]
  onChange: (v: string[]) => void
  onMark: () => void
  domaine?: string
}

export default function CarteCompetences({ valeurs, onChange, onMark, domaine }: Props) {
  const [showAutres,   setShowAutres]   = useState(false)
  const [autreDomaine, setAutreDomaine] = useState<string | null>(null)

  const full               = valeurs.length >= MAX
  const domaineSuggestions = domaine ? (COMP_REF[domaine] ?? []) : []
  const autresDomaines     = DOMAINES.filter(d => d !== domaine && !!COMP_REF[d])
  const autreSuggestions   = autreDomaine ? (COMP_REF[autreDomaine] ?? []) : []

  function toggle(comp: string) {
    if (valeurs.includes(comp)) onChange(valeurs.filter(v => v !== comp))
    else if (!full) onChange([...valeurs, comp])
    onMark()
  }

  const pillStyle = (chosen: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 13,
    border: `1.5px solid ${chosen ? C.vert : C.sable}`,
    backgroundColor: chosen ? `${C.vert}12` : C.white,
    color: chosen ? C.vert : full && !chosen ? '#C0C0C0' : C.dark,
    cursor: full && !chosen ? 'default' : 'pointer',
    fontFamily: 'inherit', transition: 'all 0.15s',
  })

  const domaineBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 12,
    border: `1.5px solid ${active ? C.lien : C.sable}`,
    backgroundColor: active ? `${C.lien}10` : C.white,
    color: active ? C.lien : C.grey,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
  })

  return (
    <>
      <p style={{ fontSize: 13.5, color: C.grey, margin: '0 0 16px' }}>
        Celles qui correspondent aux offres seront mises en avant pour le recruteur.
      </p>
      <ChampSuggestions
        valeurs={valeurs}
        onChange={v => { onChange(v); onMark() }}
        suggestions={SUGGESTIONS_COMP}
        max={MAX}
        placeholder="Ajoutez une compétence…"
        libre
      />

      {/* Suggestions du domaine courant */}
      {domaineSuggestions.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: C.grey, margin: '0 0 10px' }}>
            Compétences courantes en {domaine}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {domaineSuggestions.map(s => (
              <button key={s} type="button" onClick={() => toggle(s)} style={pillStyle(valeurs.includes(s))}>
                {s}
              </button>
            ))}
          </div>
          {autresDomaines.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <button type="button"
                onClick={() => { setShowAutres(v => !v); if (showAutres) setAutreDomaine(null) }}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: C.lien, cursor: 'pointer', fontFamily: 'inherit' }}>
                Voir d&apos;autres domaines
              </button>
              {showAutres && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: autreDomaine ? 12 : 0 }}>
                    {autresDomaines.map(d => (
                      <button key={d} type="button"
                        onClick={() => setAutreDomaine(d === autreDomaine ? null : d)}
                        style={domaineBtnStyle(d === autreDomaine)}>
                        {d}
                      </button>
                    ))}
                  </div>
                  {autreDomaine && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {autreSuggestions.map(s => (
                        <button key={s} type="button" onClick={() => toggle(s)} style={pillStyle(valeurs.includes(s))}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pas de domaine → liste directe */}
      {!domaineSuggestions.length && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: C.grey, margin: '0 0 10px' }}>
            Choisissez un domaine
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: autreDomaine ? 12 : 0 }}>
            {DOMAINES.filter(d => !!COMP_REF[d]).map(d => (
              <button key={d} type="button"
                onClick={() => setAutreDomaine(d === autreDomaine ? null : d)}
                style={domaineBtnStyle(d === autreDomaine)}>
                {d}
              </button>
            ))}
          </div>
          {autreDomaine && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {autreSuggestions.map(s => (
                <button key={s} type="button" onClick={() => toggle(s)} style={pillStyle(valeurs.includes(s))}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
