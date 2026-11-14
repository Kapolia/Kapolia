'use client'
import React, { useState } from 'react'
import { C } from '@/lib/colors'
import { DOMAINES, EXPERIENCES } from '@/lib/referentiels'
import Avatar, { type AvatarProfil } from '@/components/Avatar'

const MAX_PHRASE = 140

type Props = {
  profil: AvatarProfil
  editPrenom: string; setEditPrenom: (v: string) => void
  editNom: string; setEditNom: (v: string) => void
  editMetier: string; setEditMetier: (v: string) => void
  editDomaine: string; setEditDomaine: (v: string) => void
  editExperience: string; setEditExperience: (v: string) => void
  editSignature: string; setEditSignature: (v: string) => void
  sigTextareaRef: React.RefObject<HTMLTextAreaElement | null>
  videoPresentation: string | null | undefined
  uploadingVedette: boolean
  deletingVideo: boolean
  onOpenAvatarModal: () => void
  onOpenRecord: () => void
  vedetteVideoInputRef: React.RefObject<HTMLInputElement | null>
  onDeleteVideo: () => void
  onChange: () => void
}

function FieldInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'>) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{
        fontSize: 14, padding: '8px 11px',
        border: `1px solid ${focused ? C.orange : C.sable}`,
        borderRadius: 9, outline: 'none', width: '100%',
        fontFamily: 'inherit', color: C.dark, backgroundColor: C.white,
        boxShadow: focused ? '0 0 0 3px rgba(194,97,31,.12)' : 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}

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

export default function CartePresentation({
  profil, editPrenom, setEditPrenom, editNom, setEditNom,
  editMetier, setEditMetier, editDomaine, setEditDomaine,
  editExperience, setEditExperience, editSignature, setEditSignature,
  sigTextareaRef, videoPresentation, uploadingVedette, deletingVideo,
  onOpenAvatarModal, onOpenRecord, vedetteVideoInputRef, onDeleteVideo, onChange,
}: Props) {
  const [sigFocused, setSigFocused] = useState(false)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)

  function chg() { onChange() }

  function formatDuration(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginTop: 16 }}>

      {/* Photo */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 150, height: 180, borderRadius: 10, overflow: 'hidden', backgroundColor: C.bg }}>
          <Avatar profil={profil} size="lg" style={{ width: '100%', height: '100%', borderRadius: 0 }} />
        </div>
        <button type="button" onClick={onOpenAvatarModal} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: C.orangeTexte, fontWeight: 500, fontFamily: 'inherit', padding: 0,
        }}>
          Changer la photo
        </button>
      </div>

      {/* Champs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Prénom + Nom */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={LABEL_S}>Prénom</label>
            <FieldInput value={editPrenom} onChange={e => { setEditPrenom(e.target.value); chg() }} />
          </div>
          <div>
            <label style={LABEL_S}>Nom</label>
            <FieldInput value={editNom} onChange={e => { setEditNom(e.target.value); chg() }} />
          </div>
        </div>

        {/* Métier */}
        <div>
          <label style={LABEL_S}>Métier</label>
          <FieldInput value={editMetier} onChange={e => { setEditMetier(e.target.value); chg() }} />
          <span style={HELP_S}>Le métier que vous exercez ou visez, tel qu&apos;un recruteur le chercherait.</span>
        </div>

        {/* Domaine */}
        <div>
          <label style={LABEL_S}>Domaine</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DOMAINES.map(d => (
              <ChoixBtn key={d} label={d} selected={editDomaine === d}
                onClick={() => { setEditDomaine(editDomaine === d ? '' : d); chg() }} />
            ))}
          </div>
        </div>

        {/* Expérience */}
        <div>
          <label style={LABEL_S}>Niveau d&apos;expérience</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {EXPERIENCES.map(exp => (
              <ChoixBtn key={exp} label={exp} selected={editExperience === exp}
                onClick={() => { setEditExperience(editExperience === exp ? '' : exp); chg() }} />
            ))}
          </div>
          <span style={HELP_S}>Le nombre d&apos;années affiché est calculé à partir de votre parcours.</span>
        </div>

        {/* Phrase */}
        <div>
          <label style={LABEL_S}>Votre phrase</label>
          <textarea
            ref={sigTextareaRef}
            value={editSignature}
            maxLength={MAX_PHRASE}
            rows={3}
            onFocus={() => setSigFocused(true)}
            onBlur={() => setSigFocused(false)}
            onChange={e => { setEditSignature(e.target.value); chg() }}
            style={{
              fontSize: 14, padding: '8px 11px',
              border: `1px solid ${sigFocused ? C.orange : C.sable}`,
              borderRadius: 9, outline: 'none', width: '100%',
              fontFamily: 'inherit', color: C.dark, backgroundColor: C.white,
              boxShadow: sigFocused ? '0 0 0 3px rgba(194,97,31,.12)' : 'none',
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
            <span style={HELP_S}>Une phrase qui dit ce que vous apportez.</span>
            <span style={{ fontSize: 12.5, color: editSignature.length >= MAX_PHRASE ? C.erreur : C.grey, flexShrink: 0, marginLeft: 8 }}>
              {editSignature.length} sur {MAX_PHRASE}
            </span>
          </div>
        </div>

        {/* Vidéo */}
        <div>
          <label style={LABEL_S}>Vidéo de présentation</label>
          {videoPresentation ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <video
                src={videoPresentation}
                style={{ width: 120, height: 72, borderRadius: 8, objectFit: 'cover', backgroundColor: C.dark }}
                muted playsInline
                onLoadedMetadata={e => setVideoDuration(e.currentTarget.duration)}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {videoDuration !== null && (
                  <span style={{ fontSize: 12.5, color: C.grey }}>{formatDuration(videoDuration)}</span>
                )}
                <button type="button" onClick={() => vedetteVideoInputRef.current?.click()}
                  disabled={uploadingVedette || deletingVideo}
                  style={{ fontSize: 13, fontWeight: 500, color: C.orangeTexte, background: 'none', border: `1px solid ${C.sable}`, borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Remplacer
                </button>
                <button type="button" onClick={onDeleteVideo}
                  disabled={uploadingVedette || deletingVideo}
                  style={{ fontSize: 13, fontWeight: 500, color: C.erreur, background: 'none', border: `1px solid ${C.sable}`, borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {deletingVideo ? 'Suppression…' : 'Supprimer'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={onOpenRecord} disabled={uploadingVedette}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="currentColor" />
                </svg>
                Enregistrer
              </button>
              <button type="button" onClick={() => vedetteVideoInputRef.current?.click()} disabled={uploadingVedette}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {uploadingVedette ? 'Envoi…' : 'Téléverser'}
              </button>
            </div>
          )}
          <span style={HELP_S}>Une minute au plus.</span>
        </div>

      </div>
    </div>
  )
}
