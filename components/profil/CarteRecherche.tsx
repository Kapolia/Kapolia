'use client'
import React, { useState, useEffect } from 'react'
import { C } from '@/lib/colors'
import { PREFERENCES_TELETRAVAIL, PERMIS, PERMIS_AUTRES } from '@/lib/referentiels'
import { GeoVilleInput } from '@/components/GeoVilleInput'
import { LANGUES } from '@/lib/langues'

type Props = {
  editDispo: string; setEditDispo: (v: string) => void
  editDispoDate: string; setEditDispoDate: (v: string) => void
  editTypePoste: string[]; setEditTypePoste: (v: string[]) => void
  editVille: string; setEditVille: (v: string) => void
  editModeTravail: string; setEditModeTravail: (v: string) => void
  editPermis: string[]; setEditPermis: (v: string[]) => void
  editLangues: string[]; setEditLangues: (v: string[]) => void
  onChange: () => void
  champMisEnAvant?: string | null
  actif?: boolean
}

const DISPO_OPT = [
  { key: 'maintenant',      label: 'Disponible maintenant' },
  { key: 'a_partir_de',    label: 'À partir de…' },
  { key: 'en_poste',       label: 'En poste, à l\'écoute' },
  { key: 'non_disponible', label: 'Pas disponible' },
]

const TYPE_POSTE_OPT = [
  { key: 'cdi',        label: 'CDI' },
  { key: 'cdd',        label: 'CDD' },
  { key: 'freelance',  label: 'Freelance / Mission' },
  { key: 'alternance', label: 'Alternance / Stage' },
  { key: 'ouvert',     label: 'Ouvert(e) à tout' },
]

const MOIS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]
const NIVEAUX_LANGUE = ['Natif', 'Courant', 'Intermédiaire', 'Débutant']

type LigneLangue = { nom: string; niveau: string }

function ChoixBtn({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 10px', borderRadius: 8,
      border: `1px solid ${selected ? '#BFD3C7' : C.sable}`,
      backgroundColor: selected ? C.salaire : C.white,
      color: selected ? C.vert : C.dark,
      fontSize: 13, fontWeight: selected ? 600 : 500,
      cursor: 'pointer', fontFamily: 'inherit',
    }}>
      {selected && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 6l3 3 5-5" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {label}
    </button>
  )
}

const LABEL_S: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, color: C.grey, marginBottom: 5, display: 'block' }
const HELP_S: React.CSSProperties = { fontSize: 12.5, color: C.grey, marginTop: 4, display: 'block' }
const SELECT_S: React.CSSProperties = {
  fontSize: 13, padding: '6px 10px', border: `1px solid ${C.sable}`,
  borderRadius: 8, fontFamily: 'inherit', color: C.dark, backgroundColor: C.white, cursor: 'pointer',
}

function parseLignes(arr: string[]): LigneLangue[] {
  return arr.map(s => {
    const idx = s.indexOf(' — ')
    return idx >= 0 ? { nom: s.slice(0, idx), niveau: s.slice(idx + 3) } : { nom: s, niveau: '' }
  })
}

export default function CarteRecherche({
  editDispo, setEditDispo, editDispoDate, setEditDispoDate,
  editTypePoste, setEditTypePoste, editVille, setEditVille,
  editModeTravail, setEditModeTravail,
  editPermis, setEditPermis, editLangues, setEditLangues, onChange,
  champMisEnAvant, actif,
}: Props) {
  const [lignes, setLignes] = useState<LigneLangue[]>(() => parseLignes(editLangues))
  const [autresOuverts, setAutresOuverts] = useState(() => editPermis.some(v => PERMIS_AUTRES.some(p => p.value === v)))

  useEffect(() => {
    if (!actif || !champMisEnAvant) return
    let clearTimer: ReturnType<typeof setTimeout>
    const timer = setTimeout(() => {
      const el = document.getElementById(`cr-${champMisEnAvant}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      if (champMisEnAvant === 'ville') {
        const inp = el.querySelector<HTMLInputElement>('input')
        inp?.focus()
      }
      el.style.borderRadius = '8px'
      el.style.outline = `2px solid ${C.orange}`
      el.style.boxShadow = '0 0 0 3px rgba(194,97,31,.12)'
      el.style.transition = 'outline 0.5s, box-shadow 0.5s'
      clearTimer = setTimeout(() => {
        el.style.outline = ''
        el.style.boxShadow = ''
        el.style.transition = ''
        el.style.borderRadius = ''
      }, 1500)
    }, 50)
    return () => { clearTimeout(timer); clearTimeout(clearTimer) }
  }, [champMisEnAvant, actif])

  function updateLignes(next: LigneLangue[]) {
    setLignes(next)
    setEditLangues(next.filter(l => l.nom).map(l => l.niveau ? `${l.nom} — ${l.niveau}` : l.nom))
    onChange()
  }

  function toggleMulti(arr: string[], setArr: (v: string[]) => void, key: string) {
    setArr(arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key])
    onChange()
  }

  function togglePermis(val: string) {
    if (val === 'aucun') {
      setEditPermis(editPermis.includes('aucun') ? [] : ['aucun'])
    } else {
      const without = editPermis.filter(k => k !== 'aucun')
      setEditPermis(without.includes(val) ? without.filter(k => k !== val) : [...without, val])
    }
    onChange()
  }

  const dispoDateParts = (() => {
    if (!editDispoDate) {
      const now = new Date()
      return { mois: now.getMonth() + 1, annee: now.getFullYear() }
    }
    const d = new Date(editDispoDate + 'T00:00:00')
    return { mois: d.getMonth() + 1, annee: d.getFullYear() }
  })()

  function setDispoMoisAnnee(mois: number, annee: number) {
    setEditDispoDate(`${annee}-${String(mois).padStart(2, '0')}-01`)
    onChange()
  }

  const anneeBase = new Date().getFullYear()
  const ANNEES = Array.from({ length: 4 }, (_, i) => anneeBase + i)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>

      <p style={{ fontSize: 13.5, color: C.grey, margin: 0 }}>
        Ces informations s&apos;affichent en pastilles sous votre phrase et servent à la correspondance avec les offres.
      </p>

      {/* Disponibilité */}
      <div id="cr-dispo">
        <label style={LABEL_S}>Disponibilité</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {DISPO_OPT.map(o => (
            <ChoixBtn key={o.key} label={o.label} selected={editDispo === o.key}
              onClick={() => { setEditDispo(editDispo === o.key ? '' : o.key); onChange() }} />
          ))}
        </div>
        {editDispo === 'a_partir_de' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <select value={dispoDateParts.mois}
              onChange={e => setDispoMoisAnnee(Number(e.target.value), dispoDateParts.annee)}
              style={SELECT_S}>
              {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={dispoDateParts.annee}
              onChange={e => setDispoMoisAnnee(dispoDateParts.mois, Number(e.target.value))}
              style={SELECT_S}>
              {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Contrat recherché */}
      <div id="cr-contrat">
        <label style={LABEL_S}>Contrat recherché</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {TYPE_POSTE_OPT.map(o => (
            <ChoixBtn key={o.key} label={o.label} selected={editTypePoste.includes(o.key)}
              onClick={() => toggleMulti(editTypePoste, setEditTypePoste, o.key)} />
          ))}
        </div>
      </div>

      {/* Lieu */}
      <div id="cr-ville">
        <label style={LABEL_S}>Lieu</label>
        <GeoVilleInput
          value={editVille}
          onChange={v => { setEditVille(v); onChange() }}
          onCoordsChange={() => {}}
        />
      </div>

      {/* Télétravail */}
      <div id="cr-teletravail">
        <label style={LABEL_S}>Télétravail</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {PREFERENCES_TELETRAVAIL.map(o => (
            <ChoixBtn key={o.key} label={o.label} selected={editModeTravail === o.key}
              onClick={() => { setEditModeTravail(editModeTravail === o.key ? '' : o.key); onChange() }} />
          ))}
        </div>
      </div>

      {/* Permis et habilitations */}
      <div id="cr-permis">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: C.grey }}>Permis et habilitations</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.orange, backgroundColor: C.salaire, borderRadius: 4, padding: '1px 6px' }}>Nouveau</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {PERMIS.map(p => (
            <ChoixBtn key={p.value} label={p.label} selected={editPermis.includes(p.value)}
              onClick={() => togglePermis(p.value)} />
          ))}
          <ChoixBtn label="Aucun permis" selected={editPermis.includes('aucun')}
            onClick={() => togglePermis('aucun')} />
        </div>

        {autresOuverts && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {PERMIS_AUTRES.map(p => (
              <ChoixBtn key={p.value} label={p.label} selected={editPermis.includes(p.value)}
                onClick={() => togglePermis(p.value)} />
            ))}
          </div>
        )}

        <button type="button" onClick={() => setAutresOuverts(v => !v)} style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: C.lien, fontFamily: 'inherit' }}>
          {autresOuverts ? 'Moins de choix' : 'Autres permis et habilitations'}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            {autresOuverts ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
          </svg>
        </button>

      </div>

      {/* Langues */}
      <div id="cr-langues">
        <label style={LABEL_S}>Langues</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lignes.map((ligne, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select value={ligne.nom}
                onChange={e => { const next = [...lignes]; next[i] = { ...next[i], nom: e.target.value }; updateLignes(next) }}
                style={{ ...SELECT_S, flex: 1 }}>
                <option value="">Choisir une langue</option>
                {LANGUES.map(l => <option key={l.code} value={l.nom}>{l.drapeau} {l.nom}</option>)}
              </select>
              <select value={ligne.niveau}
                onChange={e => { const next = [...lignes]; next[i] = { ...next[i], niveau: e.target.value }; updateLignes(next) }}
                style={{ ...SELECT_S, width: 140 }}>
                <option value="">Niveau</option>
                {NIVEAUX_LANGUE.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button type="button"
                onClick={() => updateLignes(lignes.filter((_, j) => j !== i))}
                aria-label="Retirer cette langue"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey, padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          <button type="button"
            onClick={() => updateLignes([...lignes, { nom: '', niveau: '' }])}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}>
            + Ajouter une langue
          </button>
        </div>
      </div>

    </div>
  )
}
