'use client'
import React, { useState, useRef, useEffect } from 'react'
import { C } from '@/lib/colors'
import { type EntrepriseKapolia, normaliserNomEntreprise } from '@/lib/entreprises-kapolia'

export type ParcoursExpEdit = {
  poste: string
  entreprise: string
  date_debut: string
  date_fin: string
  en_poste: boolean
  missions: string
  debut_annee?: number | null
  debut_mois?: number | null
  fin_annee?: number | null
  fin_mois?: number | null
  date_a_verifier?: boolean | null
}

export type ParcoursDiplomeEdit = {
  intitule: string
  ecole: string
  annee: string
  mention?: string
  en_cours?: boolean
  debut_annee?: number | null
  annee_debut?: string | null
}

type Props = {
  editExperiences: ParcoursExpEdit[]
  setEditExperiences: (v: ParcoursExpEdit[]) => void
  editDiplomes: ParcoursDiplomeEdit[]
  setEditDiplomes: (v: ParcoursDiplomeEdit[]) => void
  onChange: () => void
  entreprisesKapolia?: EntrepriseKapolia[]
}

const ANNEE_MIN = 1960
const ANNEE_MAX = new Date().getFullYear()
const ANNEES = Array.from({ length: ANNEE_MAX - ANNEE_MIN + 1 }, (_, i) => ANNEE_MAX - i)
const MOIS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

const LABEL_S: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, color: C.grey, marginBottom: 4, display: 'block' }
const HELP_S: React.CSSProperties = { fontSize: 12.5, color: C.grey, marginTop: 4, display: 'block' }
const SELECT_S: React.CSSProperties = {
  fontSize: 13, padding: '6px 8px', border: `1px solid ${C.sable}`,
  borderRadius: 8, fontFamily: 'inherit', color: C.dark, backgroundColor: C.white, cursor: 'pointer',
}

function finAvantDebut(exp: ParcoursExpEdit): boolean {
  if (exp.en_poste || !exp.debut_annee || !exp.fin_annee) return false
  if (exp.fin_annee < exp.debut_annee) return true
  if (exp.fin_annee === exp.debut_annee && exp.debut_mois && exp.fin_mois && exp.fin_mois < exp.debut_mois) return true
  return false
}

function FieldInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'>) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{
        fontSize: 14, padding: '7px 10px',
        border: `1px solid ${focused ? C.orange : C.sable}`,
        borderRadius: 9, outline: 'none', width: '100%',
        fontFamily: 'inherit', color: C.dark, backgroundColor: C.white,
        boxShadow: focused ? '0 0 0 3px rgba(194,97,31,.12)' : 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}

function EntrepriseInput({ value, onChange, entreprises }: { value: string; onChange: (v: string) => void; entreprises: EntrepriseKapolia[] }) {
  const [open, setOpen] = useState(false)
  const norm = normaliserNomEntreprise(value)
  const suggestions = value.length >= 3
    ? entreprises.filter(e => normaliserNomEntreprise(e.nom).includes(norm)).slice(0, 6)
    : []
  return (
    <div style={{ position: 'relative' }}>
      <FieldInput
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 9, boxShadow: '0 4px 16px rgba(0,0,0,.08)', marginTop: 4, overflow: 'hidden' }}>
          {suggestions.map(e => (
            <div key={e.nom}
              onMouseDown={() => { onChange(e.nom); setOpen(false) }}
              onMouseEnter={ev => { (ev.currentTarget as HTMLDivElement).style.backgroundColor = C.bg }}
              onMouseLeave={ev => { (ev.currentTarget as HTMLDivElement).style.backgroundColor = C.white }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13.5, color: C.dark, backgroundColor: C.white }}>
              {e.logoUrl && (
                <img src={e.logoUrl} alt="" width={20} height={20} style={{ objectFit: 'contain', borderRadius: 3, flexShrink: 0, border: `1px solid ${C.sable}` }} />
              )}
              {e.nom}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MissionsEditor({ missions, onChange }: { missions: string[]; onChange: (m: string[]) => void }) {
  const [pendingFocus, setPendingFocus] = useState<number | null>(null)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (pendingFocus !== null) {
      refs.current[pendingFocus]?.focus()
      setPendingFocus(null)
    }
  }, [pendingFocus, missions.length])

  function addMission() {
    onChange([...missions, ''])
    setPendingFocus(missions.length)
  }

  function updateMission(i: number, val: string) {
    const next = [...missions]; next[i] = val; onChange(next)
  }

  function removeMission(i: number) {
    onChange(missions.filter((_, j) => j !== i))
  }

  return (
    <div>
      <label style={LABEL_S}>Missions</label>
      {missions.length === 0 ? (
        <p style={{ fontSize: 13, color: C.grey, margin: '0 0 8px', fontStyle: 'italic' }}>
          Aucune mission pour ce poste. Deux ou trois lignes suffisent.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {missions.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                ref={el => { refs.current[i] = el }}
                value={m}
                onChange={e => updateMission(i, e.target.value)}
                style={{
                  flex: 1, fontSize: 13.5, padding: '6px 10px',
                  border: `1px solid ${C.sable}`, borderRadius: 8, outline: 'none',
                  fontFamily: 'inherit', color: C.dark, backgroundColor: C.white,
                  boxSizing: 'border-box',
                }}
              />
              <button type="button" onClick={() => removeMission(i)} aria-label="Retirer cette mission"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey, padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={addMission}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
        + Ajouter une mission
      </button>
    </div>
  )
}

export default function CarteParcours({ editExperiences, setEditExperiences, editDiplomes, setEditDiplomes, onChange, entreprisesKapolia }: Props) {

  function updateExp(i: number, patch: Partial<ParcoursExpEdit>) {
    const arr = [...editExperiences]; arr[i] = { ...arr[i], ...patch }; setEditExperiences(arr); onChange()
  }

  function updateDip(i: number, patch: Partial<ParcoursDiplomeEdit>) {
    const arr = [...editDiplomes]; arr[i] = { ...arr[i], ...patch }; setEditDiplomes(arr); onChange()
  }

  function removeExp(i: number) {
    setEditExperiences(editExperiences.filter((_, j) => j !== i)); onChange()
  }

  function removeDip(i: number) {
    setEditDiplomes(editDiplomes.filter((_, j) => j !== i)); onChange()
  }

  function addExp() {
    setEditExperiences([...editExperiences, {
      poste: '', entreprise: '', date_debut: '', date_fin: '',
      en_poste: false, missions: '',
      debut_annee: null, debut_mois: null, fin_annee: null, fin_mois: null,
    }]); onChange()
  }

  function addDip() {
    setEditDiplomes([...editDiplomes, { intitule: '', ecole: '', annee: '', en_cours: false, debut_annee: null }]); onChange()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 16 }}>

      <p style={{ fontSize: 13.5, color: C.grey, margin: 0 }}>
        Les postes se rangent du plus récent au plus ancien d&apos;après leurs dates. La frise se met à jour toute seule.
      </p>

      {/* ── Expériences ── */}
      <section>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 12 }}>Expériences</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {editExperiences.map((exp, i) => {
            const isAVerifier = !!exp.date_a_verifier
            const errDate = finAvantDebut(exp)
            const missionsArr = exp.missions ? exp.missions.split('\n').filter(m => m !== '') : []

            return (
              <div key={i} style={{
                border: `1px solid ${C.sable}`, borderRadius: 11, padding: '14px 16px',
                backgroundColor: isAVerifier ? C.peche : C.white,
              }}>
                {/* En-tête encadré */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>{exp.poste || 'Nouveau poste'}</span>
                    {exp.entreprise && <span style={{ fontSize: 13, color: C.grey, marginLeft: 6 }}>{exp.entreprise}</span>}
                  </div>
                  <button type="button" onClick={() => removeExp(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.erreur, fontFamily: 'inherit', flexShrink: 0, padding: 0 }}>
                    Supprimer
                  </button>
                </div>

                {/* Avertissement date_a_verifier */}
                {isAVerifier && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12, padding: '8px 10px', backgroundColor: 'rgba(194,97,31,.06)', borderRadius: 8 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.orangeTexte} strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
                    </svg>
                    <span style={{ fontSize: 13.5, color: C.orangeTexte, lineHeight: 1.5 }}>
                      Nous n&apos;avons pas pu lire les dates de ce poste, &laquo;&nbsp;{exp.date_debut}&nbsp;&raquo;.
                      Indiquez l&apos;année de début et l&apos;année de fin pour qu&apos;il apparaisse sur la frise. Le mois est facultatif.
                    </span>
                  </div>
                )}

                {/* Poste + Entreprise */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={LABEL_S}>Poste</label>
                    <FieldInput value={exp.poste} onChange={e => updateExp(i, { poste: e.target.value })} />
                  </div>
                  <div>
                    <label style={LABEL_S}>Entreprise</label>
                    <EntrepriseInput value={exp.entreprise} onChange={v => updateExp(i, { entreprise: v })} entreprises={entreprisesKapolia ?? []} />
                  </div>
                </div>

                {/* Dates */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
                  {/* Début */}
                  <div>
                    <label style={LABEL_S}>Début</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select value={exp.debut_mois ?? ''} onChange={e => updateExp(i, { debut_mois: e.target.value ? Number(e.target.value) : null })} style={SELECT_S}>
                        <option value="">Mois</option>
                        {MOIS.map((m, mi) => <option key={m} value={mi + 1}>{m}</option>)}
                      </select>
                      <select value={exp.debut_annee ?? ''}
                        onChange={e => updateExp(i, { debut_annee: e.target.value ? Number(e.target.value) : null })}
                        style={{ ...SELECT_S, border: `1px solid ${isAVerifier && !exp.debut_annee ? C.orange : C.sable}` }}>
                        <option value="">Année</option>
                        {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Fin */}
                  <div style={{ opacity: exp.en_poste ? 0.4 : 1 }}>
                    <label style={LABEL_S}>Fin</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select value={exp.en_poste ? '' : (exp.fin_mois ?? '')} disabled={exp.en_poste} onChange={e => updateExp(i, { fin_mois: e.target.value ? Number(e.target.value) : null })} style={SELECT_S}>
                        <option value="">Mois</option>
                        {MOIS.map((m, mi) => <option key={m} value={mi + 1}>{m}</option>)}
                      </select>
                      <select value={exp.en_poste ? '' : (exp.fin_annee ?? '')} disabled={exp.en_poste}
                        onChange={e => updateExp(i, { fin_annee: e.target.value ? Number(e.target.value) : null })}
                        style={{ ...SELECT_S, border: `1px solid ${isAVerifier && !exp.en_poste && !exp.fin_annee ? C.orange : C.sable}` }}>
                        <option value="">Année</option>
                        {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* En poste */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: C.dark, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={!!exp.en_poste} onChange={e => updateExp(i, { en_poste: e.target.checked, fin_annee: null, fin_mois: null })} />
                    J&apos;occupe ce poste
                  </label>
                </div>

                {errDate && (
                  <p style={{ fontSize: 13, color: C.erreur, margin: '0 0 10px' }}>La fin est avant le début.</p>
                )}

                {/* Missions */}
                <MissionsEditor
                  missions={missionsArr}
                  onChange={arr => updateExp(i, { missions: arr.join('\n') })}
                />
              </div>
            )
          })}
        </div>

        <button type="button" onClick={addExp}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '9px 16px', borderRadius: 9, border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Ajouter un poste
        </button>
      </section>

      {/* ── Formations ── */}
      <section style={{ borderTop: `1px solid ${C.sable}`, paddingTop: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 12 }}>Formations</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {editDiplomes.map((d, i) => (
            <div key={i} style={{ border: `1px solid ${C.sable}`, borderRadius: 11, padding: '14px 16px', backgroundColor: C.white }}>

              {/* En-tête */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.dark }}>{d.intitule || 'Nouvelle formation'}</span>
                  {d.ecole && <span style={{ fontSize: 13, color: C.grey, marginLeft: 6 }}>{d.ecole}</span>}
                </div>
                <button type="button" onClick={() => removeDip(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.erreur, fontFamily: 'inherit', flexShrink: 0, padding: 0 }}>
                  Supprimer
                </button>
              </div>

              {/* Intitulé + Établissement */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={LABEL_S}>Diplôme ou formation</label>
                  <FieldInput value={d.intitule} onChange={e => updateDip(i, { intitule: e.target.value })} />
                </div>
                <div>
                  <label style={LABEL_S}>Établissement</label>
                  <FieldInput value={d.ecole} onChange={e => updateDip(i, { ecole: e.target.value })} />
                </div>
              </div>

              {/* Années */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
                <div>
                  <label style={LABEL_S}>Année de début <span style={{ fontWeight: 400 }}>(facultative)</span></label>
                  <select value={d.annee_debut ?? (d.debut_annee ? String(d.debut_annee) : '')} onChange={e => updateDip(i, { annee_debut: e.target.value || null, debut_annee: null })} style={SELECT_S}>
                    <option value="">—</option>
                    {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL_S}>Année d&apos;obtention</label>
                  <select value={d.annee} disabled={!!d.en_cours}
                    onChange={e => updateDip(i, { annee: e.target.value })}
                    style={{ ...SELECT_S, opacity: d.en_cours ? 0.4 : 1 }}>
                    <option value="">—</option>
                    {ANNEES.map(a => <option key={a} value={String(a)}>{a}</option>)}
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: C.dark, cursor: 'pointer', marginBottom: 2 }}>
                  <input type="checkbox" checked={!!d.en_cours}
                    onChange={e => updateDip(i, { en_cours: e.target.checked, annee: e.target.checked ? '' : d.annee })} />
                  Formation en cours
                </label>
              </div>

              {!d.annee_debut && !d.debut_annee && (
                <span style={HELP_S}>Sans année de début, la formation s&apos;affiche à son année d&apos;obtention.</span>
              )}
            </div>
          ))}
        </div>

        <button type="button" onClick={addDip}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '9px 16px', borderRadius: 9, border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Ajouter une formation
        </button>
      </section>

    </div>
  )
}
