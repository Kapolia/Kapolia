'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import { C } from '@/lib/colors'

type LienType = 'ami' | 'collegue' | 'ancien_manager' | 'famille' | 'autre'

const LIEN_OPTIONS: { value: LienType; label: string }[] = [
  { value: 'ami',            label: 'Un ami ou une amie' },
  { value: 'collegue',       label: 'Un collègue' },
  { value: 'ancien_manager', label: 'Un ancien manager' },
  { value: 'famille',        label: 'Un proche de ma famille' },
  { value: 'autre',          label: 'Autre' },
]

export type ActiveInvitation = {
  id:           string
  label_proche: string
  lien:         string
  expire_at:    string
}

export default function InvitationModal({
  open,
  onClose,
  candidatId,
  activeCount,
  onCreated,
}: {
  open:        boolean
  onClose:     () => void
  candidatId:  string
  activeCount: number
  onCreated?:  (inv: ActiveInvitation) => void
}) {
  const [labelProche, setLabelProche]         = useState('')
  const [lien, setLien]                       = useState<LienType | ''>('')
  const [etat, setEtat]                       = useState<'formulaire' | 'envoi' | 'lien' | 'erreur'>('formulaire')
  const [messageErreur, setMessageErreur]     = useState<string | null>(null)
  const [invCreee, setInvCreee]               = useState<{ jeton: string; expire_at: string } | null>(null)
  const [copie, setCopie]                     = useState(false)

  const limiteAtteinte = activeCount >= 4
  const peutSoumettre  = labelProche.trim().length > 0 && lien !== ''

  function reinitialiser() {
    setLabelProche('')
    setLien('')
    setEtat('formulaire')
    setMessageErreur(null)
    setInvCreee(null)
    setCopie(false)
  }

  function handleClose() {
    reinitialiser()
    onClose()
  }

  async function creerInvitation() {
    if (!peutSoumettre || etat === 'envoi') return
    setEtat('envoi')
    setMessageErreur(null)

    const { data, error } = await supabase
      .from('invitations_proches')
      .insert({ candidat_id: candidatId, label_proche: labelProche.trim(), lien })
      .select('id, jeton, label_proche, lien, expire_at')
      .single()

    if (error || !data) {
      console.error('[invitation] insert error:', error)
      setMessageErreur("Le lien n'a pas pu être créé. Veuillez réessayer.")
      setEtat('erreur')
      return
    }

    setInvCreee({ jeton: data.jeton as string, expire_at: data.expire_at as string })
    setEtat('lien')
    onCreated?.({
      id:           data.id           as string,
      label_proche: data.label_proche as string,
      lien:         data.lien         as string,
      expire_at:    data.expire_at    as string,
    })
  }

  function getLienUrl(jeton: string) {
    return `${window.location.origin}/repondre/${jeton}`
  }

  async function copierLien(jeton: string) {
    try {
      await navigator.clipboard.writeText(getLienUrl(jeton))
      setCopie(true)
      setTimeout(() => setCopie(false), 2500)
    } catch {
      // Le lien reste affiché et sélectionnable manuellement
    }
  }

  if (!open) return null

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', borderRadius: 8,
    border: `1px solid ${C.sable}`, backgroundColor: C.white,
    fontSize: 14, color: C.dark, fontFamily: 'inherit', outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: C.grey,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em',
  }

  const btnSecondaire: React.CSSProperties = {
    padding: '9px 20px', borderRadius: 8,
    border: `1.5px solid ${C.sable}`, backgroundColor: C.white,
    color: C.dark, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: C.white, borderRadius: 16, padding: '28px',
          width: '100%', maxWidth: '480px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
        }}
      >
        <h2 style={{
          fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 20,
          color: C.dark, margin: '0 0 16px', fontWeight: 600,
        }}>
          Inviter un proche
        </h2>

        {etat === 'lien' && invCreee ? (
          <>
            <p style={{ fontSize: 14, color: C.grey, lineHeight: 1.65, margin: '0 0 18px' }}>
              Le lien a été créé. Transmettez-le à{' '}
              <strong style={{ color: C.dark, fontWeight: 600 }}>{labelProche.trim()}</strong>{' '}
              par le moyen de votre choix.
            </p>

            <div style={{
              backgroundColor: C.bg, border: `1px solid ${C.sable}`,
              borderRadius: 10, padding: '12px 14px', marginBottom: 10,
              wordBreak: 'break-all', fontSize: 13, color: C.dark, lineHeight: 1.5,
              userSelect: 'text',
            }}>
              {getLienUrl(invCreee.jeton)}
            </div>

            <button
              onClick={() => copierLien(invCreee!.jeton)}
              style={{
                width: '100%', padding: '10px 16px', borderRadius: 8,
                border: 'none', cursor: 'pointer',
                backgroundColor: copie ? C.vert : C.terracotta,
                color: C.white, fontSize: 13, fontWeight: 600,
                transition: 'background-color 0.2s', fontFamily: 'inherit',
                marginBottom: 14,
              }}
            >
              {copie ? 'Lien copié' : 'Copier le lien'}
            </button>

            <p style={{ fontSize: 12, color: C.grey, lineHeight: 1.55, margin: '0 0 20px', fontStyle: 'italic' }}>
              Ce lien est valable sept jours et ne peut servir qu'une seule fois.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleClose} style={btnSecondaire}>Fermer</button>
            </div>
          </>
        ) : (
          <>
            {limiteAtteinte ? (
              <p style={{
                fontSize: 13, color: C.grey, lineHeight: 1.6, margin: '0 0 20px',
                padding: '12px 14px', borderRadius: 8,
                backgroundColor: C.bg, border: `1px solid ${C.sable}`,
              }}>
                Vous avez déjà quatre invitations en attente. Supprimez-en une ou attendez qu'une expire avant d'en envoyer une nouvelle.
              </p>
            ) : (
              <p style={{ fontSize: 14, color: C.grey, lineHeight: 1.65, margin: '0 0 20px' }}>
                Votre proche recevra un lien unique qu'il pourra ouvrir sans créer de compte.
                Il vous décrira en quelques mots les qualités qu'il observe chez vous.
                Sa réponse vous sera présentée ici, dans votre profil, et vous choisirez ce que vous souhaitez en afficher.
              </p>
            )}

            <div style={{ marginBottom: 14, opacity: limiteAtteinte ? 0.5 : 1, pointerEvents: limiteAtteinte ? 'none' : 'auto' }}>
              <label style={labelStyle}>Qui est cette personne ?</label>
              <input
                value={labelProche}
                onChange={e => { setLabelProche(e.target.value); if (etat === 'erreur') setEtat('formulaire') }}
                placeholder="Ex : Sophie, ou Mon directeur chez Acme"
                style={inputStyle}
                maxLength={80}
                disabled={limiteAtteinte}
              />
            </div>

            <div style={{ marginBottom: 20, opacity: limiteAtteinte ? 0.5 : 1, pointerEvents: limiteAtteinte ? 'none' : 'auto' }}>
              <label style={labelStyle}>Quel est votre lien ?</label>
              <select
                value={lien}
                onChange={e => { setLien(e.target.value as LienType | ''); if (etat === 'erreur') setEtat('formulaire') }}
                style={{ ...inputStyle, cursor: limiteAtteinte ? 'default' : 'pointer' }}
                disabled={limiteAtteinte}
              >
                <option value="">Choisissez...</option>
                {LIEN_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {etat === 'erreur' && messageErreur && (
              <p style={{ fontSize: 13, color: C.terracotta, margin: '0 0 16px', lineHeight: 1.5 }}>
                {messageErreur}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={handleClose} style={btnSecondaire}>Annuler</button>
              <button
                onClick={creerInvitation}
                disabled={!peutSoumettre || etat === 'envoi' || limiteAtteinte}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  backgroundColor: (!peutSoumettre || etat === 'envoi' || limiteAtteinte) ? C.sable : C.terracotta,
                  color: (!peutSoumettre || etat === 'envoi' || limiteAtteinte) ? C.grey : C.white,
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  cursor: (!peutSoumettre || etat === 'envoi' || limiteAtteinte) ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {etat === 'envoi' ? 'Création...' : 'Créer le lien'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
