'use client'
import React, { useState } from 'react'
import { C } from '@/lib/colors'
import { FONT_SERIF } from '@/lib/typography'

const LABEL_S: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, color: C.grey, marginBottom: 5, display: 'block' }
const HELP_S: React.CSSProperties = { fontSize: 12.5, color: C.grey, marginTop: 4, display: 'block' }
const MAX_DESC = 600

type Props = {
  editTitre: string; setEditTitre: (v: string) => void
  editDesc: string; setEditDesc: (v: string) => void
  editResultat: string; setEditResultat: (v: string) => void
  editImpact: string; setEditImpact: (v: string) => void
  initialImpact: string
  editVideo: string
  editImages: string[]
  uploadingVideo: boolean
  uploadingImages: boolean
  onFilmer: () => void
  onImporterVideo: () => void
  onImporterImages: () => void
  onSupprimerVideo: () => void
  onSupprimerImage: (url: string) => void
  onChange: () => void
}

function FieldInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'style'> & { style?: React.CSSProperties }) {
  const [focused, setFocused] = useState(false)
  const { style, ...rest } = props
  return (
    <input
      {...rest}
      onFocus={e => { setFocused(true); rest.onFocus?.(e) }}
      onBlur={e => { setFocused(false); rest.onBlur?.(e) }}
      style={{
        fontSize: 14, padding: '8px 11px',
        border: `1px solid ${focused ? C.orange : C.sable}`,
        borderRadius: 9, outline: 'none',
        fontFamily: 'inherit', color: C.dark, backgroundColor: C.white,
        boxShadow: focused ? '0 0 0 3px rgba(194,97,31,.12)' : 'none',
        boxSizing: 'border-box',
        ...style,
      }}
    />
  )
}

export default function CarteProjet({
  editTitre, setEditTitre,
  editDesc, setEditDesc,
  editResultat, setEditResultat,
  editImpact, setEditImpact, initialImpact,
  editVideo, editImages,
  uploadingVideo, uploadingImages,
  onFilmer, onImporterVideo, onImporterImages,
  onSupprimerVideo, onSupprimerImage, onChange,
}: Props) {

  const impactTooLong = editImpact.length > 80 && editImpact !== initialImpact

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={{ fontSize: 13.5, color: C.grey, margin: 0 }}>
        Une réalisation dont vous êtes fier, avec un résultat concret.
      </p>

      {/* Titre */}
      <div>
        <label style={LABEL_S}>Titre</label>
        <FieldInput value={editTitre} onChange={e => { setEditTitre(e.target.value); onChange() }} placeholder="Ex : Refonte du site, Campagne de recrutement…" style={{ width: '100%' }} />
      </div>

      {/* Résultat en un chiffre */}
      <div>
        <label style={LABEL_S}>Résultat en un chiffre, facultatif</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <FieldInput
                value={editResultat}
                onChange={e => { if (e.target.value.length <= 12) { setEditResultat(e.target.value); onChange() } }}
                placeholder="+47%"
                maxLength={12}
                style={{ width: 110, textAlign: 'center', fontWeight: 700 }}
              />
              <FieldInput
                value={editImpact}
                onChange={e => { setEditImpact(e.target.value); onChange() }}
                placeholder="de réduction du délai de traitement"
                style={{ flex: 1 }}
              />
            </div>
            {initialImpact.length > 80 && editImpact === initialImpact ? (
              <span style={{ ...HELP_S, color: C.orange }}>
                Votre ancien résultat est long&nbsp;: résumez-le en un chiffre et quelques mots.
              </span>
            ) : impactTooLong ? (
              <span style={{ ...HELP_S, color: C.erreur }}>
                80 caractères au plus ({editImpact.length}).
              </span>
            ) : (
              <span style={HELP_S}>
                Un chiffre, puis ce qu&apos;il mesure. Il s&apos;affiche en grand sur votre profil, comme dans l&apos;aperçu.
              </span>
            )}
          </div>
          {/* Aperçu */}
          <div style={{ width: 100, minHeight: 100, borderRadius: 12, backgroundColor: editResultat ? C.vert : C.sable, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 8px', flexShrink: 0 }}>
            {editResultat ? (
              <>
                <span style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.02em', fontSize: 24, fontWeight: 600, color: C.white, lineHeight: 1, textAlign: 'center', wordBreak: 'break-word' as const }}>{editResultat}</span>
                {editImpact && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 5, lineHeight: 1.3, textAlign: 'center' as const }}>{editImpact}</span>}
              </>
            ) : (
              <span style={{ fontSize: 11, color: C.grey, textAlign: 'center' }}>Aperçu</span>
            )}
          </div>
        </div>
      </div>

      {/* Ce que vous avez fait */}
      <div>
        <label style={LABEL_S}>Ce que vous avez fait</label>
        <textarea
          value={editDesc}
          onChange={e => { if (e.target.value.length <= MAX_DESC) { setEditDesc(e.target.value); onChange() } }}
          rows={5}
          style={{
            fontSize: 14, padding: '8px 11px', width: '100%',
            border: `1px solid ${C.sable}`, borderRadius: 9, outline: 'none',
            fontFamily: 'inherit', color: C.dark, backgroundColor: C.white,
            resize: 'vertical', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12.5, color: editDesc.length >= MAX_DESC ? C.erreur : C.grey }}>{editDesc.length} sur {MAX_DESC}</span>
        </div>
      </div>

      {/* Vidéo */}
      <div>
        <label style={LABEL_S}>Vidéo, 45 secondes au plus</label>
        {editVideo ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <video src={editVideo} style={{ width: 120, height: 72, borderRadius: 8, objectFit: 'cover', backgroundColor: C.dark }} muted playsInline />
            <button type="button" onClick={() => { onSupprimerVideo(); onChange() }}
              style={{ fontSize: 13, fontWeight: 500, color: C.erreur, background: 'none', border: `1px solid ${C.sable}`, borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Supprimer
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={onFilmer} disabled={uploadingVideo}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" fill="currentColor" />
              </svg>
              Filmer
            </button>
            <button type="button" onClick={onImporterVideo} disabled={uploadingVideo}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {uploadingVideo ? 'Envoi…' : 'Importer une vidéo'}
            </button>
          </div>
        )}
        <span style={HELP_S}>Présentez votre projet comme vous le raconteriez en entretien.</span>
      </div>

      {/* Images ou documents */}
      <div>
        <label style={LABEL_S}>Images ou documents, quatre au plus</label>
        {editImages.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {editImages.map(url => (
              <div key={url} style={{ position: 'relative' }}>
                <img src={url} alt="" style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', display: 'block', backgroundColor: C.bg }} />
                <button type="button" onClick={() => { onSupprimerImage(url); onChange() }}
                  style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', backgroundColor: C.erreur, border: `2px solid ${C.white}`, color: C.white, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {editImages.length < 4 && (
          <button type="button" onClick={onImporterImages} disabled={uploadingImages}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: `1.5px dashed ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            {uploadingImages ? 'Envoi…' : 'Ajouter'}
          </button>
        )}
      </div>
    </div>
  )
}
