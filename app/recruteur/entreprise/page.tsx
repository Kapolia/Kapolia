'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  vert:       '#2C4A3E',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  lightGrey:  '#E8E2D9',
  white:      '#FFFFFF',
  amber:      '#C88A2A',
  errorRed:   '#C0392B',
}

const TAILLE_OPTIONS = ['1–10 salariés', '11–50 salariés', '50–200 salariés', '200–500 salariés', '500+ salariés']
const SECTEUR_OPTIONS = [
  'Tech & SaaS B2B', 'Tech & SaaS B2C', 'E-commerce & retail', 'Finance & fintech',
  'Santé & medtech', 'Éducation & edtech', 'Marketing & agence', 'Consulting',
  'Industrie & manufacture', 'Immobilier & proptech', 'RH & recrutement',
  'Juridique & LegalTech', 'Médias & communication', 'Autre',
]

type EntrepriseProfil = {
  entreprise_nom:         string | null
  entreprise_secteur:     string | null
  entreprise_taille:      string | null
  entreprise_ville:       string | null
  entreprise_site:        string | null
  entreprise_description: string | null
  entreprise_valeurs:     string[] | null
  entreprise_logo_url:    string | null
}

type OffreActive = {
  id: string
  titre: string
  type_contrat: string | null
  ville: string | null
  mode_travail: string | null
  created_at: string
}

function dateLabel(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d === 0) return "Aujourd'hui"
  if (d === 1) return 'Il y a 1 jour'
  if (d < 7)   return `Il y a ${d} jours`
  if (d < 30)  return `Il y a ${Math.floor(d / 7)} sem.`
  return `Il y a ${Math.floor(d / 30)} mois`
}

// ─── Logo helpers ──────────────────────────────────────────────────────────────

function LogoBlock({ url, nom, size = 80 }: { url: string | null; nom: string; size?: number }) {
  const [err, setErr] = useState(false)
  if (url && !err) {
    return (
      <div style={{ width: size, height: size, borderRadius: Math.round(size / 5), overflow: 'hidden', backgroundColor: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <img src={url} alt={nom} onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: Math.round(size * 0.1) }} />
      </div>
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size / 5), backgroundColor: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.2)' }}>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: Math.round(size * 0.42), fontWeight: 700, color: C.white }}>{(nom || 'E').charAt(0).toUpperCase()}</span>
    </div>
  )
}

// ─── Form sub-components ───────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6, display: 'block' }}>{children}</label>
}

function FieldWrap({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      {children}
      {hint && <div style={{ fontSize: 12, color: C.grey, marginTop: 5 }}>{hint}</div>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: `1.5px solid ${C.sable}`, backgroundColor: C.white,
  fontSize: 14, color: C.dark, outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
}

function SelectInput({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B6B6B' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36 }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecruteurEntreprisePage() {
  const router = useRouter()

  const [userId, setUserId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setEditing] = useState(false)

  // Profil data (source of truth)
  const [profil, setProfil]   = useState<EntrepriseProfil>({
    entreprise_nom: null, entreprise_secteur: null, entreprise_taille: null,
    entreprise_ville: null, entreprise_site: null, entreprise_description: null,
    entreprise_valeurs: null, entreprise_logo_url: null,
  })
  const [offres, setOffres]   = useState<OffreActive[]>([])

  // Edit form state (populated when entering edit mode)
  const [editNom, setEditNom]               = useState('')
  const [editSecteur, setEditSecteur]       = useState('')
  const [editTaille, setEditTaille]         = useState('')
  const [editVille, setEditVille]           = useState('')
  const [editSite, setEditSite]             = useState('')
  const [editDesc, setEditDesc]             = useState('')
  const [editValeurs, setEditValeurs]       = useState<string[]>([])
  const [valeurInput, setValeurInput]       = useState('')
  const [editLogoUrl, setEditLogoUrl]       = useState<string | null>(null)
  const [logoPreview, setLogoPreview]       = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo]   = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [saveError, setSaveError]           = useState<string | null>(null)
  const [toastMsg, setToastMsg]             = useState('')
  const [toastVisible, setToastVisible]     = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/connexion'); return }
      setUserId(user.id)

      const [profilRes, offresRes] = await Promise.all([
        supabase.from('profils')
          .select('entreprise_nom, entreprise_secteur, entreprise_taille, entreprise_ville, entreprise_site, entreprise_description, entreprise_valeurs, entreprise_logo_url')
          .eq('user_id', user.id)
          .single(),
        supabase.from('offres')
          .select('id, titre, type_contrat, ville, mode_travail, created_at')
          .eq('recruteur_id', user.id)
          .eq('statut_publication', 'publiée')
          .eq('active', true)
          .order('created_at', { ascending: false }),
      ])

      if (profilRes.data) setProfil(profilRes.data as EntrepriseProfil)
      setOffres((offresRes.data ?? []) as OffreActive[])
      setLoading(false)
    }
    load()
  }, [router])

  function showToast(msg: string) {
    setToastMsg(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 3000)
  }

  function startEdit() {
    setEditNom(profil.entreprise_nom ?? '')
    setEditSecteur(profil.entreprise_secteur ?? '')
    setEditTaille(profil.entreprise_taille ?? '')
    setEditVille(profil.entreprise_ville ?? '')
    setEditSite(profil.entreprise_site ?? '')
    setEditDesc(profil.entreprise_description ?? '')
    setEditValeurs([...(profil.entreprise_valeurs ?? [])])
    setEditLogoUrl(profil.entreprise_logo_url)
    setLogoPreview(profil.entreprise_logo_url)
    setValeurInput('')
    setSaveError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setSaveError(null)
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 2 * 1024 * 1024) { setSaveError('Logo trop lourd (max 2 Mo)'); return }
    setUploadingLogo(true)
    setSaveError(null)
    setLogoPreview(URL.createObjectURL(file))
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/logo.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { setSaveError('Erreur upload logo : ' + upErr.message); setUploadingLogo(false); return }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const freshUrl = urlData.publicUrl + '?t=' + Date.now()
    setEditLogoUrl(freshUrl)
    setLogoPreview(freshUrl)
    setUploadingLogo(false)
  }

  function addValeur() {
    const v = valeurInput.trim()
    if (!v || editValeurs.length >= 4 || editValeurs.includes(v)) return
    setEditValeurs([...editValeurs, v])
    setValeurInput('')
  }

  async function handleSave() {
    if (!userId) return
    if (!editNom.trim()) { setSaveError("Le nom de l'entreprise est requis."); return }
    setSaving(true)
    setSaveError(null)

    const payload = {
      entreprise_nom:         editNom.trim() || null,
      entreprise_secteur:     editSecteur || null,
      entreprise_taille:      editTaille || null,
      entreprise_ville:       editVille.trim() || null,
      entreprise_site:        editSite.trim() || null,
      entreprise_description: editDesc.trim() || null,
      entreprise_valeurs:     editValeurs.length > 0 ? editValeurs : null,
      entreprise_logo_url:    editLogoUrl || null,
    }

    const { error } = await supabase.from('profils').update(payload).eq('user_id', userId)
    if (error) {
      setSaveError('Erreur : ' + error.message)
      setSaving(false)
      return
    }

    setProfil(payload as EntrepriseProfil)
    setSaving(false)
    setEditing(false)
    showToast('Entreprise mise à jour ✓')
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kavio-spin 0.8s linear infinite' }} />
      </div>
    )
  }

  const nom     = profil.entreprise_nom
  const valeurs = profil.entreprise_valeurs ?? []
  const isEmpty = !nom

  // ── EDIT MODE ─────────────────────────────────────────────────────────────────

  if (isEditing) {
    return (
      <main style={{ backgroundColor: C.creme, minHeight: '100vh', padding: '40px 40px 100px' }}>
        <style suppressHydrationWarning>{`
          input:focus, textarea:focus, select:focus { border-color: ${C.terracotta} !important; box-shadow: 0 0 0 3px ${C.terracotta}15; }
          * { box-sizing: border-box; }
        `}</style>

        {/* Header */}
        <div style={{ maxWidth: 720, margin: '0 auto 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(22px, 4vw, 30px)', color: C.dark, margin: '0 0 4px' }}>
                Modifier mon entreprise
              </h1>
              <p style={{ fontSize: 13, color: C.grey, margin: 0 }}>
                Ces informations s'affichent sur votre vitrine publique et sur vos offres.
              </p>
            </div>
            <button
              onClick={cancelEdit}
              style={{ backgroundColor: 'transparent', border: `1.5px solid ${C.sable}`, borderRadius: 10, padding: '8px 18px', fontSize: 13, color: C.grey, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Annuler
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {/* Logo */}
          <div style={{ backgroundColor: C.white, borderRadius: 18, border: `1px solid ${C.sable}`, padding: '26px 30px', marginBottom: 18 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: C.dark, margin: '0 0 20px' }}>Logo</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div onClick={() => fileRef.current?.click()} style={{ width: 86, height: 86, borderRadius: 14, border: `2px dashed ${C.sable}`, backgroundColor: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, marginBottom: 3 }}>🏢</div>
                    <div style={{ fontSize: 10, color: C.grey }}>Ajouter</div>
                  </div>
                )}
                {uploadingLogo && (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(247,242,235,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kavio-spin 0.8s linear infinite' }} />
                  </div>
                )}
              </div>
              <div>
                <button onClick={() => fileRef.current?.click()} disabled={uploadingLogo} style={{ backgroundColor: 'transparent', border: `1.5px solid ${C.sable}`, borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: C.dark, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 7, display: 'block' }}>
                  {uploadingLogo ? 'Envoi…' : logoPreview ? 'Changer' : 'Choisir un logo'}
                </button>
                <div style={{ fontSize: 12, color: C.grey }}>PNG, JPG · Max 2 Mo · Format carré recommandé</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
            </div>
          </div>

          {/* Informations */}
          <div style={{ backgroundColor: C.white, borderRadius: 18, border: `1px solid ${C.sable}`, padding: '26px 30px', marginBottom: 18 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: C.dark, margin: '0 0 20px' }}>Informations</h2>
            <FieldWrap>
              <Label>Nom de l'entreprise *</Label>
              <input value={editNom} onChange={e => setEditNom(e.target.value)} placeholder="Ex. Kavio SAS" style={inputStyle} />
            </FieldWrap>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FieldWrap>
                <Label>Secteur d'activité</Label>
                <SelectInput value={editSecteur} onChange={setEditSecteur} options={SECTEUR_OPTIONS} placeholder="Choisir…" />
              </FieldWrap>
              <FieldWrap>
                <Label>Taille</Label>
                <SelectInput value={editTaille} onChange={setEditTaille} options={TAILLE_OPTIONS} placeholder="Choisir…" />
              </FieldWrap>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FieldWrap>
                <Label>Ville</Label>
                <input value={editVille} onChange={e => setEditVille(e.target.value)} placeholder="Ex. Lyon, France" style={inputStyle} />
              </FieldWrap>
              <FieldWrap>
                <Label>Site web</Label>
                <input value={editSite} onChange={e => setEditSite(e.target.value)} placeholder="Ex. kavio.fr" style={inputStyle} />
              </FieldWrap>
            </div>
          </div>

          {/* Description */}
          <div style={{ backgroundColor: C.white, borderRadius: 18, border: `1px solid ${C.sable}`, padding: '26px 30px', marginBottom: 18 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: C.dark, margin: '0 0 6px' }}>À propos</h2>
            <p style={{ fontSize: 13, color: C.grey, margin: '0 0 18px' }}>Présentez votre entreprise en quelques phrases.</p>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Qui vous êtes, ce que vous faites, pourquoi vous recrutez…" rows={6} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }} />
            <div style={{ fontSize: 12, color: C.grey, marginTop: 5, textAlign: 'right' }}>{editDesc.length} car.</div>
          </div>

          {/* Valeurs */}
          <div style={{ backgroundColor: C.white, borderRadius: 18, border: `1px solid ${C.sable}`, padding: '26px 30px', marginBottom: 18 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: C.dark, margin: '0 0 6px' }}>Valeurs</h2>
            <p style={{ fontSize: 13, color: C.grey, margin: '0 0 18px' }}>Maximum 4. Servent au matching avec les candidats.</p>
            {editValeurs.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {editValeurs.map(v => (
                  <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: `${C.vert}12`, border: `1px solid ${C.vert}30`, borderRadius: 20, padding: '7px 14px' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.vert }}>{v}</span>
                    <button onClick={() => setEditValeurs(editValeurs.filter(x => x !== v))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey, fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            {editValeurs.length < 4 ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={valeurInput} onChange={e => setValeurInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addValeur() } }} placeholder={`Ajouter… (${editValeurs.length}/4)`} style={{ ...inputStyle, flex: 1 }} />
                <button onClick={addValeur} disabled={!valeurInput.trim()} style={{ backgroundColor: C.vert, color: C.white, border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: valeurInput.trim() ? 1 : 0.4 }}>
                  + Ajouter
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.amber, fontWeight: 500 }}>Limite atteinte (4 valeurs)</div>
            )}
          </div>

          {/* Erreur */}
          {saveError && (
            <div style={{ backgroundColor: `${C.errorRed}10`, border: `1px solid ${C.errorRed}40`, borderRadius: 12, padding: '11px 16px', marginBottom: 16, fontSize: 13, color: C.errorRed }}>
              {saveError}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button onClick={cancelEdit} style={{ backgroundColor: 'transparent', border: `1.5px solid ${C.sable}`, borderRadius: 12, padding: '12px 28px', fontSize: 14, color: C.grey, cursor: 'pointer', fontFamily: 'inherit' }}>
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving || uploadingLogo} style={{ backgroundColor: C.terracotta, color: C.white, border: 'none', borderRadius: 12, padding: '12px 32px', fontSize: 15, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── VITRINE MODE ──────────────────────────────────────────────────────────────

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', paddingBottom: 80 }}>
      <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>

      {/* Toast */}
      <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: `translateX(-50%) translateY(${toastVisible ? '0' : '12px'})`, opacity: toastVisible ? 1 : 0, transition: 'opacity 0.2s, transform 0.2s', pointerEvents: 'none', zIndex: 300, backgroundColor: C.vert, color: C.white, padding: '11px 22px', borderRadius: 28, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.16)', whiteSpace: 'nowrap' }}>
        {toastMsg}
      </div>

      {/* ── EMPTY STATE ────────────────────────────────────────────────────── */}
      {isEmpty ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ width: 88, height: 88, borderRadius: 22, backgroundColor: C.sable, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, marginBottom: 28 }}>🏢</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(22px, 4vw, 30px)', color: C.dark, margin: '0 0 10px' }}>
            Votre vitrine entreprise
          </h1>
          <p style={{ fontSize: 14, color: C.grey, margin: '0 0 32px', lineHeight: 1.7, maxWidth: 420 }}>
            Renseignez le profil de votre entreprise pour qu'il s'affiche sur vos offres et sur votre page publique. C'est ce que les candidats verront.
          </p>
          <button
            onClick={startEdit}
            style={{ backgroundColor: C.terracotta, color: C.white, border: 'none', borderRadius: 14, padding: '14px 36px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Créer mon profil entreprise →
          </button>
          {userId && (
            <a href={`/entreprise/${userId}`} target="_blank" rel="noopener noreferrer" style={{ marginTop: 16, fontSize: 13, color: C.grey, textDecoration: 'none' }}>
              Voir la vitrine publique (vide pour l'instant)
            </a>
          )}
        </div>
      ) : (

        <>
          {/* ── HEADER VITRINE ───────────────────────────────────────────────── */}
          <header style={{ backgroundColor: C.vert, padding: '48px 40px 44px', position: 'relative' }}>

            {/* Bouton Modifier — coin supérieur droit */}
            <button
              onClick={startEdit}
              style={{ position: 'absolute', top: 20, right: 24, backgroundColor: 'rgba(255,255,255,0.12)', color: C.white, border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(4px)', transition: 'background 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.12)' }}
            >
              ✏️ Modifier
            </button>

            <div style={{ maxWidth: 860, margin: '0 auto' }}>

              {offres.length > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: C.terracotta, color: C.white, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 20, marginBottom: 26 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: C.white, display: 'inline-block' }} />
                  Recrute activement
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 22, flexWrap: 'wrap' }}>
                <LogoBlock url={profil.entreprise_logo_url} nom={nom!} size={76} />

                <div style={{ flex: 1, minWidth: 200 }}>
                  <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 5vw, 42px)', color: C.white, margin: '0 0 10px', lineHeight: 1.1 }}>
                    {nom}
                  </h1>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginBottom: 26 }}>
                    {profil.entreprise_secteur && <span style={{ fontSize: 13, color: C.sable }}>⬡ {profil.entreprise_secteur}</span>}
                    {profil.entreprise_ville   && <span style={{ fontSize: 13, color: C.sable }}>◎ {profil.entreprise_ville}</span>}
                    {profil.entreprise_taille  && <span style={{ fontSize: 13, color: C.sable }}>◷ {profil.entreprise_taille}</span>}
                    {profil.entreprise_site    && (
                      <a href={profil.entreprise_site.startsWith('http') ? profil.entreprise_site : `https://${profil.entreprise_site}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.sable, opacity: 0.75, textDecoration: 'none' }}>
                        ↗ {profil.entreprise_site.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>
                  {userId && (
                    <a href={`/entreprise/${userId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.sable, opacity: 0.7, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: '1px solid rgba(232,213,183,0.35)', borderRadius: 10 }}>
                      Voir la vitrine publique ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* ── CONTENU ─────────────────────────────────────────────────────── */}
          <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px' }}>

            {/* Description */}
            {profil.entreprise_description && (
              <section style={{ marginBottom: 52 }}>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(19px, 3vw, 25px)', color: C.dark, margin: '0 0 18px' }}>Qui sommes-nous</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {profil.entreprise_description.split('\n\n').filter(Boolean).map((para, i) => (
                    <p key={i} style={{ fontSize: 15, color: '#3A3A3A', lineHeight: 1.75, margin: 0 }}>{para}</p>
                  ))}
                </div>
              </section>
            )}

            {/* Valeurs */}
            {valeurs.length > 0 && (
              <section style={{ marginBottom: 52 }}>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(19px, 3vw, 25px)', color: C.dark, margin: '0 0 18px' }}>Nos valeurs</h2>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {valeurs.map(v => (
                    <div key={v} style={{ padding: '13px 22px', borderRadius: 14, backgroundColor: C.white, border: `1px solid ${C.sable}`, fontSize: 15, fontWeight: 600, color: C.vert }}>
                      {v}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Champs manquants — hint pour compléter */}
            {(!profil.entreprise_description || valeurs.length === 0) && (
              <div style={{ backgroundColor: `${C.amber}0D`, border: `1px solid ${C.amber}30`, borderRadius: 14, padding: '16px 22px', marginBottom: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                <div style={{ fontSize: 13, color: C.dark }}>
                  <strong>Profil incomplet</strong> — ajoutez {[!profil.entreprise_description && 'une description', valeurs.length === 0 && 'des valeurs'].filter(Boolean).join(' et ')} pour enrichir votre vitrine.
                </div>
                <button onClick={startEdit} style={{ backgroundColor: C.amber, color: C.white, border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  Compléter →
                </button>
              </div>
            )}

            {/* Offres actives */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(19px, 3vw, 25px)', color: C.dark, margin: 0 }}>
                  Offres actives {offres.length > 0 && <span style={{ fontSize: 16, color: C.grey, fontWeight: 400 }}>({offres.length})</span>}
                </h2>
                <button onClick={() => router.push('/recruteur/offres')} style={{ backgroundColor: 'transparent', border: `1.5px solid ${C.sable}`, borderRadius: 10, padding: '8px 16px', fontSize: 13, color: C.dark, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Gérer les offres →
                </button>
              </div>

              {offres.length === 0 ? (
                <div style={{ backgroundColor: C.white, borderRadius: 16, border: `1px solid ${C.sable}`, padding: '40px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 30, marginBottom: 10 }}>◎</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: C.dark, marginBottom: 6 }}>Aucune offre publiée</div>
                  <div style={{ fontSize: 13, color: C.grey, marginBottom: 20 }}>Publiez vos premières offres pour qu'elles s'affichent ici et sur votre vitrine.</div>
                  <button onClick={() => router.push('/recruteur/offres/nouvelle')} style={{ backgroundColor: C.terracotta, color: C.white, border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Créer une offre →
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {offres.map(offre => (
                    <div key={offre.id} style={{ backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: C.dark, fontWeight: 600, marginBottom: 6 }}>{offre.titre}</div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          {offre.type_contrat && <span style={{ fontSize: 11, fontWeight: 700, color: C.vert, backgroundColor: `${C.vert}12`, padding: '2px 9px', borderRadius: 20 }}>{offre.type_contrat}</span>}
                          {offre.ville       && <span style={{ fontSize: 12, color: C.grey }}>◎ {offre.ville}{offre.mode_travail ? ` · ${offre.mode_travail}` : ''}</span>}
                          <span style={{ fontSize: 11, color: '#BBBBBB' }}>{dateLabel(offre.created_at)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        {userId && (
                          <a href={`/entreprise/${userId}#offres`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.grey, textDecoration: 'none', padding: '6px 12px', border: `1px solid ${C.sable}`, borderRadius: 8 }}>
                            Vitrine ↗
                          </a>
                        )}
                        <button onClick={() => router.push(`/recruteur/offres/${offre.id}`)} style={{ backgroundColor: 'transparent', border: `1px solid ${C.sable}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, color: C.dark, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Voir →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  )
}
