'use client'
import React from 'react'
import Link from 'next/link'
import { C } from '@/lib/colors'
import { QUALITE_LABELS } from '@/lib/test-qualites'
import ChampSuggestions from '@/components/profil/ChampSuggestions'
import { type ActiveInvitation } from '@/components/InvitationModal'
import { reduitMouvement } from '@/lib/motion'

type ReponseGroupe = {
  reponse_id:    string
  prenom_proche: string
  lien:          string
  qualites:      string[]
}

type Props = {
  testLabels:             string[]
  hasTest:                boolean
  reponsesProches:        ReponseGroupe[]
  activeInvitations:      ActiveInvitation[]
  editQualites:           string[]
  setEditQualites:        (v: string[]) => void
  editQualitesProches:    Array<{reponse_id: string; qualite: string}>
  setEditQualitesProches: (v: Array<{reponse_id: string; qualite: string}>) => void
  onInviter:              () => void
  onChange:               () => void
}

const LIEN_LABELS: Record<string, string> = {
  ami:            'ami(e)',
  collegue:       'collègue',
  ancien_manager: 'ancien manager',
  famille:        'famille',
  autre:          'autre',
}

const SUGGESTIONS_QUALITES = [
  ...Object.values(QUALITE_LABELS),
  'Fiabilité', 'Ponctualité', 'Sens du service', "Esprit d'équipe", 'Autonomie',
  'Bienveillance', 'Patience', 'Dynamisme', 'Discrétion', 'Diplomatie',
  'Empathie', 'Réactivité', 'Polyvalence', 'Honnêteté', 'Motivation',
  'Sens des responsabilités', 'Calme', "Esprit d'analyse", "Ouverture d'esprit", 'Enthousiasme',
  // Leadership & communication
  'Leadership', "Sens de l'écoute", 'Assertivité', 'Charisme', 'Sociabilité',
  'Aisance relationnelle', 'Sens de la communication', 'Force de persuasion',
  'Sens de la négociation', 'Sens du collectif',
  // Caractère & valeurs
  'Combativité', 'Confiance en soi', 'Courage', 'Ténacité', 'Humilité',
  'Humour', 'Optimisme', 'Positivité', 'Loyauté', 'Intégrité',
  'Éthique', 'Respect', 'Tolérance', 'Générosité', 'Altruisme',
  // Esprit & réflexion
  'Esprit critique', 'Esprit de synthèse', "Esprit d'initiative",
  "Esprit d'entreprendre", 'Ambition', 'Audace', 'Imagination',
  "Sens de l'innovation", 'Vision', 'Sens politique',
  // Organisation & méthode
  "Sens de l'organisation", 'Gestion du stress', 'Résistance à la pression',
  'Flexibilité', 'Souplesse', 'Agilité', "Capacité d'apprentissage",
  'Minutie', 'Précision', 'Méthode', 'Sens du détail', 'Exigence', 'Efficacité',
  // Engagement & terrain
  'Endurance', 'Implication', 'Engagement', 'Assiduité',
  'Sens pratique', 'Pragmatisme', 'Prise de recul', 'Maîtrise de soi',
  "Sens de l'accueil", 'Sens commercial', 'Esprit de compétition',
]

const colStyle: React.CSSProperties = {
  border: `1px solid ${C.sable}`,
  borderRadius: 10,
  padding: '12px 12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const colHead: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: C.grey,
  margin: 0,
}

function formatExpiry(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export default function CarteQualites({
  testLabels, hasTest,
  reponsesProches, activeInvitations,
  editQualites, setEditQualites,
  editQualitesProches, setEditQualitesProches,
  onInviter, onChange,
}: Props) {

  function toggleProche(reponse_id: string, qualite: string) {
    const idx = editQualitesProches.findIndex(s => s.reponse_id === reponse_id && s.qualite === qualite)
    const next = idx >= 0
      ? editQualitesProches.filter((_, i) => i !== idx)
      : [...editQualitesProches, { reponse_id, qualite }]
    setEditQualitesProches(next)
    onChange()
  }

  return (
    <>
      <p style={{ fontSize: 13.5, color: C.grey, margin: '0 0 16px' }}>
        Trois regards sur vous. Seul le vôtre se modifie ici, les deux autres viennent du questionnaire et de vos proches.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>

        {/* ── Selon le questionnaire ── */}
        <div style={colStyle}>
          <p style={colHead}>Selon le questionnaire</p>
          {hasTest ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {testLabels.map(l => (
                  <span key={l} style={{ padding: '4px 10px', borderRadius: 7, backgroundColor: C.chip, fontSize: 13, fontWeight: 500, color: C.dark }}>
                    {l}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 12.5, color: C.grey, margin: 0 }}>Questionnaire rempli.</p>
              <Link href="/onboarding?refaire=questionnaire"
                style={{ fontSize: 13, fontWeight: 600, color: C.dark, padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.sable}`, backgroundColor: C.white, textDecoration: 'none', display: 'inline-block', alignSelf: 'flex-start' }}>
                Refaire le questionnaire
              </Link>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: C.grey, margin: 0 }}>Pas encore de questionnaire.</p>
              <Link href="/onboarding?refaire=questionnaire"
                style={{ fontSize: 13, fontWeight: 600, color: C.vert, padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.sable}`, backgroundColor: C.salaire, textDecoration: 'none', display: 'inline-block', alignSelf: 'flex-start' }}>
                Faire le questionnaire
              </Link>
            </>
          )}
        </div>

        {/* ── Selon vos proches ── */}
        <div style={colStyle}>
          <p style={colHead}>Selon vos proches</p>
          {reponsesProches.length === 0 && activeInvitations.length === 0 && (
            <p style={{ fontSize: 13, color: C.grey, margin: 0 }}>Aucune réponse pour le moment.</p>
          )}
          {reponsesProches.map(r => (
            <div key={r.reponse_id}>
              <p style={{ fontSize: 13.5, margin: '0 0 5px' }}>
                <span style={{ fontWeight: 600, color: C.dark }}>{r.prenom_proche}</span>
                {' '}<span style={{ color: C.grey }}>{LIEN_LABELS[r.lien] ?? r.lien}</span>
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {r.qualites.map(q => {
                  const checked = editQualitesProches.some(s => s.reponse_id === r.reponse_id && s.qualite === q)
                  return (
                    <button key={q} type="button"
                      onClick={e => {
                        const wasChecked = editQualitesProches.some(s => s.reponse_id === r.reponse_id && s.qualite === q)
                        toggleProche(r.reponse_id, q)
                        if (!wasChecked && typeof window !== 'undefined' && !reduitMouvement()) {
                          ;(e.currentTarget as HTMLElement).animate(
                            [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
                            { duration: 280, easing: 'ease-in-out' }
                          )
                        }
                      }}
                      style={{
                        padding: '4px 10px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'inherit',
                        border: checked ? '1.5px solid #BFD3C7' : `1px solid ${C.sable}`,
                        backgroundColor: checked ? C.salaire : C.white,
                        color: checked ? C.vert : C.dark,
                        transition: 'background-color 180ms, color 180ms, border-color 180ms',
                      }}>
                      {q}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {activeInvitations.map(inv => (
            <p key={inv.id} style={{ fontSize: 12.5, color: C.grey, margin: 0 }}>
              Invitation envoyée, expire le {formatExpiry(inv.expire_at)}
            </p>
          ))}
          <button type="button" onClick={onInviter}
            style={{ fontSize: 13, fontWeight: 600, color: C.vert, padding: '5px 12px', borderRadius: 8, border: `1px solid ${C.sable}`, backgroundColor: C.salaire, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}>
            Inviter un proche
          </button>
        </div>

        {/* ── Selon vous ── */}
        <div style={colStyle}>
          <p style={colHead}>Selon vous</p>
          <ChampSuggestions
            valeurs={editQualites}
            onChange={v => { setEditQualites(v); onChange() }}
            suggestions={SUGGESTIONS_QUALITES}
            max={5}
            placeholder="Ajoutez une qualité…"
            libre
            listeAuClic
          />
          <p style={{ fontSize: 12.5, color: C.grey, margin: 0 }}>
            Choisir dans la liste permet de montrer, en vert sur votre profil, les qualités que vos proches ou le questionnaire citent aussi.
          </p>
        </div>

      </div>
    </>
  )
}
