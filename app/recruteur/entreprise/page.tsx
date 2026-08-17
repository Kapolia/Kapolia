'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const C = {
  terracotta: '#C4673A', sable: '#E8D5B7', creme: '#F7F2EB',
  vert: '#2C4A3E', dark: '#1A1A1A', grey: '#6B6B6B',
  lightGrey: '#E8E2D9', white: '#FFFFFF', amber: '#C88A2A', errorRed: '#C0392B',
}

const TAILLE_OPTIONS = ['1–10 salariés', '11–50 salariés', '50–200 salariés', '200–500 salariés', '500+ salariés']
const SECTEUR_OPTIONS = [
  'Tech & SaaS B2B', 'Tech & SaaS B2C', 'E-commerce & retail', 'Finance & fintech',
  'Santé & medtech', 'Éducation & edtech', 'Marketing & agence', 'Consulting',
  'Industrie & manufacture', 'Immobilier & proptech', 'RH & recrutement',
  'Juridique & LegalTech', 'Médias & communication', 'Autre',
]

type PresseItem = { titre: string; source: string; url: string; annee: string }

type EntrepriseProfil = {
  entreprise_nom:            string | null
  entreprise_secteur:        string | null
  entreprise_taille:         string | null
  entreprise_ville:          string | null
  entreprise_site:           string | null
  entreprise_description:    string | null
  entreprise_valeurs:        string[] | null
  entreprise_logo_url:       string | null
  entreprise_mission:        string | null
  entreprise_annee_creation: string | null
  entreprise_effectif:       string | null
  entreprise_ca:             string | null
  entreprise_levees:         string | null
  entreprise_pays:           string | null
  entreprise_avantages:      string[] | null
  entreprise_linkedin:       string | null
  entreprise_instagram:      string | null
  entreprise_presse:         PresseItem[] | null
}

type OffreActive = {
  id: string; titre: string; type_contrat: string | null
  ville: string | null; mode_travail: string | null; created_at: string
}

const PROFIL_SELECT = [
  'entreprise_nom', 'entreprise_secteur', 'entreprise_taille', 'entreprise_ville',
  'entreprise_site', 'entreprise_description', 'entreprise_valeurs', 'entreprise_logo_url',
  'entreprise_mission', 'entreprise_annee_creation', 'entreprise_effectif', 'entreprise_ca',
  'entreprise_levees', 'entreprise_pays', 'entreprise_avantages',
  'entreprise_linkedin', 'entreprise_instagram', 'entreprise_presse',
].join(', ')

const CHIFFRES: { key: keyof EntrepriseProfil; label: string }[] = [
  { key: 'entreprise_annee_creation', label: 'Fondée en' },
  { key: 'entreprise_effectif',       label: 'Collaborateurs' },
  { key: 'entreprise_levees',         label: 'Levées de fonds' },
  { key: 'entreprise_ca',             label: "Chiffre d'affaires" },
  { key: 'entreprise_pays',           label: 'Pays / bureaux' },
]

function dateLabel(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d === 0) return "Aujourd'hui"
  if (d === 1) return 'Il y a 1 jour'
  if (d < 7)   return `Il y a ${d} jours`
  if (d < 30)  return `Il y a ${Math.floor(d / 7)} sem.`
  return `Il y a ${Math.floor(d / 30)} mois`
}

// ─── Sous-composants ───────────────────────────────────────────────────────────

function LogoBlock({ url, nom, size = 76 }: { url: string | null; nom: string; size?: number }) {
  const [err, setErr] = useState(false)
  if (url && !err) return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size / 5), overflow: 'hidden', backgroundColor: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <img src={url} alt={nom} onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: Math.round(size * 0.1) }} />
    </div>
  )
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size / 5), backgroundColor: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.2)' }}>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: Math.round(size * 0.42), fontWeight: 700, color: C.white }}>{(nom || 'E').charAt(0).toUpperCase()}</span>
    </div>
  )
}

function SCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: C.white, borderRadius: 18, border: `1px solid ${C.sable}`, padding: '24px 28px', marginBottom: 16 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: C.dark, margin: '0 0 18px' }}>{title}</h2>
      {children}
    </div>
  )
}

function FLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6, display: 'block' }}>{children}</label>
}
function FWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ marginBottom: 18 }}>{children}</div>
}
const iStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: `1.5px solid ${C.sable}`, backgroundColor: C.white,
  fontSize: 14, color: C.dark, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}
function Sel({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...iStyle, appearance: 'none', cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B6B6B' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36 }}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
function TagInput({ tags, onAdd, onRemove, input, onInput, placeholder, max }: {
  tags: string[]; onAdd: () => void; onRemove: (v: string) => void
  input: string; onInput: (v: string) => void; placeholder: string; max: number
}) {
  return (
    <div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {tags.map(v => (
            <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, backgroundColor: `${C.vert}12`, border: `1px solid ${C.vert}30`, borderRadius: 20, padding: '6px 13px' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.vert }}>{v}</span>
              <button onClick={() => onRemove(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey, fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
      {tags.length < max ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={input} onChange={e => onInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd() } }} placeholder={`${placeholder} (${tags.length}/${max})`} style={{ ...iStyle, flex: 1 }} />
          <button onClick={onAdd} disabled={!input.trim()} style={{ backgroundColor: C.vert, color: C.white, border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: input.trim() ? 1 : 0.4 }}>+ Ajouter</button>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: C.amber, fontWeight: 500 }}>Limite atteinte ({max} maximum)</div>
      )}
    </div>
  )
}
function PresseRow({ item }: { item: PresseItem }) {
  return (
    <>
      <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${C.terracotta}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📰</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.titre}</div>
        <div style={{ fontSize: 12, color: C.grey }}>{item.source}{item.annee ? ` · ${item.annee}` : ''}</div>
      </div>
      {item.url && <span style={{ fontSize: 18, color: C.lightGrey, flexShrink: 0 }}>→</span>}
    </>
  )
}

const EMPTY_PROFIL: EntrepriseProfil = {
  entreprise_nom: null, entreprise_secteur: null, entreprise_taille: null,
  entreprise_ville: null, entreprise_site: null, entreprise_description: null,
  entreprise_valeurs: null, entreprise_logo_url: null, entreprise_mission: null,
  entreprise_annee_creation: null, entreprise_effectif: null, entreprise_ca: null,
  entreprise_levees: null, entreprise_pays: null, entreprise_avantages: null,
  entreprise_linkedin: null, entreprise_instagram: null, entreprise_presse: null,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecruteurEntreprisePage() {
  const router = useRouter()
  const [userId, setUserId]     = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [isEditing, setEditing] = useState(false)
  const [profil, setProfil]     = useState<EntrepriseProfil>(EMPTY_PROFIL)
  const [offres, setOffres]     = useState<OffreActive[]>([])

  // Edit fields
  const [editNom, setEditNom]               = useState('')
  const [editSecteur, setEditSecteur]       = useState('')
  const [editTaille, setEditTaille]         = useState('')
  const [editVille, setEditVille]           = useState('')
  const [editSite, setEditSite]             = useState('')
  const [editLinkedin, setEditLinkedin]     = useState('')
  const [editInstagram, setEditInstagram]   = useState('')
  const [editMission, setEditMission]       = useState('')
  const [editDesc, setEditDesc]             = useState('')
  const [editCreation, setEditCreation]     = useState('')
  const [editEffectif, setEditEffectif]     = useState('')
  const [editCa, setEditCa]                 = useState('')
  const [editLevees, setEditLevees]         = useState('')
  const [editPays, setEditPays]             = useState('')
  const [editValeurs, setEditValeurs]       = useState<string[]>([])
  const [valeurInput, setValeurInput]       = useState('')
  const [editAvantages, setEditAvantages]   = useState<string[]>([])
  const [avantageInput, setAvantageInput]   = useState('')
  const [editPresse, setEditPresse]         = useState<PresseItem[]>([])
  const [addingPresse, setAddingPresse]     = useState(false)
  const [presseForm, setPresseForm]         = useState<PresseItem>({ titre: '', source: '', url: '', annee: '' })
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
      const [pr, or] = await Promise.all([
        supabase.from('profils').select(PROFIL_SELECT).eq('user_id', user.id).single(),
        supabase.from('offres').select('id, titre, type_contrat, ville, mode_travail, created_at')
          .eq('recruteur_id', user.id).eq('statut_publication', 'publiée').eq('active', true)
          .order('created_at', { ascending: false }),
      ])
      if (pr.data) setProfil(pr.data as EntrepriseProfil)
      setOffres((or.data ?? []) as OffreActive[])
      setLoading(false)
    }
    load()
  }, [router])

  function showToast(msg: string) {
    setToastMsg(msg); setToastVisible(true)
    setTimeout(() => setToastVisible(false), 3000)
  }

  function startEdit() {
    const p = profil
    setEditNom(p.entreprise_nom ?? ''); setEditSecteur(p.entreprise_secteur ?? '')
    setEditTaille(p.entreprise_taille ?? ''); setEditVille(p.entreprise_ville ?? '')
    setEditSite(p.entreprise_site ?? ''); setEditLinkedin(p.entreprise_linkedin ?? '')
    setEditInstagram(p.entreprise_instagram ?? ''); setEditMission(p.entreprise_mission ?? '')
    setEditDesc(p.entreprise_description ?? ''); setEditCreation(p.entreprise_annee_creation ?? '')
    setEditEffectif(p.entreprise_effectif ?? ''); setEditCa(p.entreprise_ca ?? '')
    setEditLevees(p.entreprise_levees ?? ''); setEditPays(p.entreprise_pays ?? '')
    setEditValeurs([...(p.entreprise_valeurs ?? [])]); setValeurInput('')
    setEditAvantages([...(p.entreprise_avantages ?? [])]); setAvantageInput('')
    setEditPresse([...(p.entreprise_presse ?? [])])
    setEditLogoUrl(p.entreprise_logo_url); setLogoPreview(p.entreprise_logo_url)
    setSaveError(null); setAddingPresse(false)
    setPresseForm({ titre: '', source: '', url: '', annee: '' })
    setEditing(true)
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 2 * 1024 * 1024) { setSaveError('Logo trop lourd (max 2 Mo)'); return }
    setUploadingLogo(true); setSaveError(null)
    setLogoPreview(URL.createObjectURL(file))
    const ext = file.name.split('.').pop() ?? 'jpg'
    const { error: upErr } = await supabase.storage.from('avatars').upload(`${userId}/logo.${ext}`, file, { upsert: true, contentType: file.type })
    if (upErr) { setSaveError('Erreur upload : ' + upErr.message); setUploadingLogo(false); return }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(`${userId}/logo.${ext}`)
    setEditLogoUrl(urlData.publicUrl + '?t=' + Date.now())
    setLogoPreview(urlData.publicUrl + '?t=' + Date.now())
    setUploadingLogo(false)
  }

  function addPresseItem() {
    if (!presseForm.titre.trim() || !presseForm.source.trim()) return
    setEditPresse([...editPresse, { ...presseForm }])
    setPresseForm({ titre: '', source: '', url: '', annee: '' })
    setAddingPresse(false)
  }

  async function handleSave() {
    if (!userId) return
    if (!editNom.trim()) { setSaveError("Le nom de l'entreprise est requis."); return }
    setSaving(true); setSaveError(null)
    const payload: Partial<EntrepriseProfil> = {
      entreprise_nom:            editNom.trim() || null,
      entreprise_secteur:        editSecteur || null,
      entreprise_taille:         editTaille || null,
      entreprise_ville:          editVille.trim() || null,
      entreprise_site:           editSite.trim() || null,
      entreprise_linkedin:       editLinkedin.trim() || null,
      entreprise_instagram:      editInstagram.trim() || null,
      entreprise_mission:        editMission.trim() || null,
      entreprise_description:    editDesc.trim() || null,
      entreprise_annee_creation: editCreation.trim() || null,
      entreprise_effectif:       editEffectif.trim() || null,
      entreprise_ca:             editCa.trim() || null,
      entreprise_levees:         editLevees.trim() || null,
      entreprise_pays:           editPays.trim() || null,
      entreprise_valeurs:        editValeurs.length > 0 ? editValeurs : null,
      entreprise_avantages:      editAvantages.length > 0 ? editAvantages : null,
      entreprise_logo_url:       editLogoUrl || null,
      entreprise_presse:         editPresse.length > 0 ? editPresse : null,
    }
    const { error } = await supabase.from('profils').update(payload).eq('user_id', userId)
    if (error) { setSaveError('Erreur : ' + error.message); setSaving(false); return }
    setProfil(p => ({ ...p, ...payload }))
    setSaving(false); setEditing(false)
    showToast('Entreprise mise à jour ✓')
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <style suppressHydrationWarning>{`@keyframes kavio-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kavio-spin 0.8s linear infinite' }} />
    </div>
  )

  // ── EDIT MODE ──────────────────────────────────────────────────────────────

  if (isEditing) return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', padding: '36px 40px 100px' }}>
      <style suppressHydrationWarning>{`input:focus,textarea:focus,select:focus{border-color:${C.terracotta}!important;box-shadow:0 0 0 3px ${C.terracotta}15}*{box-sizing:border-box}@keyframes kavio-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(20px, 4vw, 28px)', color: C.dark, margin: '0 0 3px' }}>Modifier mon entreprise</h1>
            <p style={{ fontSize: 13, color: C.grey, margin: 0 }}>Ces informations s'affichent sur votre vitrine publique et vos offres.</p>
          </div>
          <button onClick={() => setEditing(false)} style={{ backgroundColor: 'transparent', border: `1.5px solid ${C.sable}`, borderRadius: 10, padding: '8px 18px', fontSize: 13, color: C.grey, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
        </div>

        {/* ── Logo ── */}
        <SCard title="Logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div onClick={() => fileRef.current?.click()} style={{ width: 82, height: 82, borderRadius: 14, border: `2px dashed ${C.sable}`, backgroundColor: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
              {logoPreview ? <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                : <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22 }}>🏢</div><div style={{ fontSize: 10, color: C.grey }}>Ajouter</div></div>}
              {uploadingLogo && <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(247,242,235,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kavio-spin 0.8s linear infinite' }} /></div>}
            </div>
            <div>
              <button onClick={() => fileRef.current?.click()} disabled={uploadingLogo} style={{ backgroundColor: 'transparent', border: `1.5px solid ${C.sable}`, borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: C.dark, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6, display: 'block' }}>
                {uploadingLogo ? 'Envoi…' : logoPreview ? 'Changer' : 'Choisir un logo'}
              </button>
              <div style={{ fontSize: 12, color: C.grey }}>PNG, JPG · Max 2 Mo · Format carré recommandé</div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
          </div>
        </SCard>

        {/* ── Identité ── */}
        <SCard title="Identité">
          <FWrap><FLabel>Nom de l'entreprise *</FLabel><input value={editNom} onChange={e => setEditNom(e.target.value)} placeholder="Ex. Meridian Studio" style={iStyle} /></FWrap>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FWrap><FLabel>Secteur</FLabel><Sel value={editSecteur} onChange={setEditSecteur} options={SECTEUR_OPTIONS} placeholder="Choisir…" /></FWrap>
            <FWrap><FLabel>Taille</FLabel><Sel value={editTaille} onChange={setEditTaille} options={TAILLE_OPTIONS} placeholder="Choisir…" /></FWrap>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FWrap><FLabel>Ville</FLabel><input value={editVille} onChange={e => setEditVille(e.target.value)} placeholder="Paris, France" style={iStyle} /></FWrap>
            <FWrap><FLabel>Site web</FLabel><input value={editSite} onChange={e => setEditSite(e.target.value)} placeholder="meridian.studio" style={iStyle} /></FWrap>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FWrap><FLabel>LinkedIn</FLabel><input value={editLinkedin} onChange={e => setEditLinkedin(e.target.value)} placeholder="linkedin.com/company/…" style={iStyle} /></FWrap>
            <FWrap><FLabel>Instagram</FLabel><input value={editInstagram} onChange={e => setEditInstagram(e.target.value)} placeholder="@meridianstudio" style={iStyle} /></FWrap>
          </div>
        </SCard>

        {/* ── Mission ── */}
        <SCard title="Mission / raison d'être">
          <p style={{ fontSize: 13, color: C.grey, margin: '0 0 12px' }}>Une phrase courte et percutante — le "pourquoi" de votre entreprise.</p>
          <textarea value={editMission} onChange={e => setEditMission(e.target.value)} placeholder="Ex. : Les meilleurs outils sont ceux qui disparaissent dans le travail." rows={3} style={{ ...iStyle, resize: 'vertical', lineHeight: 1.65 }} />
        </SCard>

        {/* ── Description ── */}
        <SCard title="À propos">
          <p style={{ fontSize: 13, color: C.grey, margin: '0 0 12px' }}>Présentez votre entreprise. Séparez les paragraphes par une ligne vide.</p>
          <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Qui vous êtes, ce que vous faites, pourquoi vous recrutez…" rows={7} style={{ ...iStyle, resize: 'vertical', lineHeight: 1.7 }} />
          <div style={{ fontSize: 12, color: C.grey, marginTop: 5, textAlign: 'right' }}>{editDesc.length} car.</div>
        </SCard>

        {/* ── Chiffres clés ── */}
        <SCard title="Chiffres clés">
          <p style={{ fontSize: 13, color: C.grey, margin: '0 0 14px' }}>Laissez vide les chiffres que vous ne souhaitez pas afficher.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FWrap><FLabel>Fondée en</FLabel><input value={editCreation} onChange={e => setEditCreation(e.target.value)} placeholder="2020" style={iStyle} /></FWrap>
            <FWrap><FLabel>Collaborateurs</FLabel><input value={editEffectif} onChange={e => setEditEffectif(e.target.value)} placeholder="48" style={iStyle} /></FWrap>
            <FWrap><FLabel>Levées de fonds</FLabel><input value={editLevees} onChange={e => setEditLevees(e.target.value)} placeholder="8 M€" style={iStyle} /></FWrap>
            <FWrap><FLabel>Chiffre d'affaires</FLabel><input value={editCa} onChange={e => setEditCa(e.target.value)} placeholder="14 M€" style={iStyle} /></FWrap>
            <FWrap><FLabel>Pays / bureaux</FLabel><input value={editPays} onChange={e => setEditPays(e.target.value)} placeholder="12 pays" style={iStyle} /></FWrap>
          </div>
        </SCard>

        {/* ── Valeurs ── */}
        <SCard title="Valeurs">
          <p style={{ fontSize: 13, color: C.grey, margin: '0 0 12px' }}>Maximum 4. Servent au matching avec les candidats.</p>
          <TagInput tags={editValeurs} onAdd={() => { const v = valeurInput.trim(); if (v && !editValeurs.includes(v)) { setEditValeurs([...editValeurs, v]); setValeurInput('') } }} onRemove={v => setEditValeurs(editValeurs.filter(x => x !== v))} input={valeurInput} onInput={setValeurInput} placeholder="Ajouter une valeur" max={4} />
        </SCard>

        {/* ── Avantages ── */}
        <SCard title="La vie chez nous — avantages">
          <p style={{ fontSize: 13, color: C.grey, margin: '0 0 12px' }}>Maximum 8. Commencez par un emoji pour plus d'impact. Ex. : "🌿 Remote flexible"</p>
          <TagInput tags={editAvantages} onAdd={() => { const v = avantageInput.trim(); if (v && !editAvantages.includes(v)) { setEditAvantages([...editAvantages, v]); setAvantageInput('') } }} onRemove={v => setEditAvantages(editAvantages.filter(x => x !== v))} input={avantageInput} onInput={setAvantageInput} placeholder="Ajouter un avantage" max={8} />
        </SCard>

        {/* ── Presse ── */}
        <SCard title="Dans la presse">
          {editPresse.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {editPresse.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', backgroundColor: C.creme, borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.titre}</div>
                    <div style={{ fontSize: 12, color: C.grey }}>{item.source}{item.annee ? ` · ${item.annee}` : ''}</div>
                  </div>
                  <button onClick={() => setEditPresse(editPresse.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey, fontSize: 18, padding: '0 4px', flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}
          {!addingPresse ? (
            <button onClick={() => setAddingPresse(true)} style={{ backgroundColor: 'transparent', border: `1.5px dashed ${C.sable}`, borderRadius: 10, padding: '10px 20px', fontSize: 13, color: C.grey, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>+ Ajouter un article</button>
          ) : (
            <div style={{ backgroundColor: C.creme, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><FLabel>Titre de l'article *</FLabel><input value={presseForm.titre} onChange={e => setPresseForm(f => ({ ...f, titre: e.target.value }))} placeholder="Meridian lève 8 M€…" style={iStyle} /></div>
                <div><FLabel>Source *</FLabel><input value={presseForm.source} onChange={e => setPresseForm(f => ({ ...f, source: e.target.value }))} placeholder="Le Monde" style={iStyle} /></div>
                <div><FLabel>URL</FLabel><input value={presseForm.url} onChange={e => setPresseForm(f => ({ ...f, url: e.target.value }))} placeholder="https://…" style={iStyle} /></div>
                <div><FLabel>Année</FLabel><input value={presseForm.annee} onChange={e => setPresseForm(f => ({ ...f, annee: e.target.value }))} placeholder="2025" style={iStyle} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setAddingPresse(false); setPresseForm({ titre: '', source: '', url: '', annee: '' }) }} style={{ backgroundColor: 'transparent', border: `1px solid ${C.sable}`, borderRadius: 9, padding: '8px 16px', fontSize: 13, color: C.grey, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                <button onClick={addPresseItem} disabled={!presseForm.titre.trim() || !presseForm.source.trim()} style={{ backgroundColor: C.vert, color: C.white, border: 'none', borderRadius: 9, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: (presseForm.titre.trim() && presseForm.source.trim()) ? 1 : 0.4 }}>Ajouter</button>
              </div>
            </div>
          )}
        </SCard>

        {saveError && <div style={{ backgroundColor: `${C.errorRed}10`, border: `1px solid ${C.errorRed}40`, borderRadius: 12, padding: '11px 16px', marginBottom: 14, fontSize: 13, color: C.errorRed }}>{saveError}</div>}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={() => setEditing(false)} style={{ backgroundColor: 'transparent', border: `1.5px solid ${C.sable}`, borderRadius: 12, padding: '12px 28px', fontSize: 14, color: C.grey, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          <button onClick={handleSave} disabled={saving || uploadingLogo} style={{ backgroundColor: C.terracotta, color: C.white, border: 'none', borderRadius: 12, padding: '12px 32px', fontSize: 15, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </main>
  )

  // ── VITRINE MODE ───────────────────────────────────────────────────────────

  const nom       = profil.entreprise_nom
  const valeurs   = profil.entreprise_valeurs ?? []
  const avantages = profil.entreprise_avantages ?? []
  const presse    = profil.entreprise_presse ?? []
  const chiffres  = CHIFFRES.filter(c => profil[c.key])

  if (!nom) return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ width: 88, height: 88, borderRadius: 22, backgroundColor: C.sable, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, marginBottom: 28 }}>🏢</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(22px, 4vw, 30px)', color: C.dark, margin: '0 0 10px' }}>Votre vitrine entreprise</h1>
        <p style={{ fontSize: 14, color: C.grey, margin: '0 0 32px', lineHeight: 1.7, maxWidth: 420 }}>Renseignez le profil de votre entreprise pour qu'il s'affiche sur vos offres et votre page publique.</p>
        <button onClick={startEdit} style={{ backgroundColor: C.terracotta, color: C.white, border: 'none', borderRadius: 14, padding: '14px 36px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Créer mon profil entreprise →</button>
      </div>
    </main>
  )

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', paddingBottom: 80 }}>
      <style suppressHydrationWarning>{`@keyframes kavio-spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}`}</style>

      <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: `translateX(-50%) translateY(${toastVisible ? '0' : '12px'})`, opacity: toastVisible ? 1 : 0, transition: 'opacity 0.2s, transform 0.2s', pointerEvents: 'none', zIndex: 300, backgroundColor: C.vert, color: C.white, padding: '11px 22px', borderRadius: 28, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.16)', whiteSpace: 'nowrap' }}>
        {toastMsg}
      </div>

      {/* HEADER */}
      <header style={{ backgroundColor: C.vert, padding: '48px 40px 44px', position: 'relative' }}>
        <button onClick={startEdit} style={{ position: 'absolute', top: 20, right: 24, backgroundColor: 'rgba(255,255,255,0.12)', color: C.white, border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✏️ Modifier</button>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          {offres.length > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: C.terracotta, color: C.white, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 20, marginBottom: 26 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: C.white, display: 'inline-block' }} />Recrute activement
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 22, flexWrap: 'wrap' }}>
            <LogoBlock url={profil.entreprise_logo_url} nom={nom} size={76} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(26px, 5vw, 42px)', color: C.white, margin: '0 0 10px', lineHeight: 1.1 }}>{nom}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginBottom: 26 }}>
                {profil.entreprise_secteur && <span style={{ fontSize: 13, color: C.sable }}>⬡ {profil.entreprise_secteur}</span>}
                {profil.entreprise_ville   && <span style={{ fontSize: 13, color: C.sable }}>◎ {profil.entreprise_ville}</span>}
                {profil.entreprise_taille  && <span style={{ fontSize: 13, color: C.sable }}>◷ {profil.entreprise_taille}</span>}
                {profil.entreprise_site    && <a href={profil.entreprise_site.startsWith('http') ? profil.entreprise_site : `https://${profil.entreprise_site}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.sable, opacity: 0.75, textDecoration: 'none' }}>↗ {profil.entreprise_site.replace(/^https?:\/\//, '')}</a>}
              </div>
              {userId && <a href={`/entreprise/${userId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.sable, opacity: 0.7, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: '1px solid rgba(232,213,183,0.35)', borderRadius: 10 }}>Voir la vitrine publique ↗</a>}
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px' }}>

        {/* Mission */}
        {profil.entreprise_mission && (
          <section style={{ marginBottom: 52, textAlign: 'center', padding: '0 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.terracotta, marginBottom: 14 }}>Notre mission</div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(18px, 2.5vw, 24px)', color: C.dark, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>« {profil.entreprise_mission} »</p>
          </section>
        )}

        {/* Description */}
        {profil.entreprise_description && (
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(19px, 3vw, 25px)', color: C.dark, margin: '0 0 18px' }}>Qui sommes-nous</h2>
            {profil.entreprise_description.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} style={{ fontSize: 15, color: '#3A3A3A', lineHeight: 1.75, margin: '0 0 14px' }}>{para}</p>
            ))}
          </section>
        )}

        {/* Chiffres clés */}
        {chiffres.length > 0 && (
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(19px, 3vw, 25px)', color: C.dark, margin: '0 0 20px' }}>En chiffres</h2>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(chiffres.length, 3)}, 1fr)`, gap: 14 }}>
              {chiffres.map(c => (
                <div key={c.key} style={{ backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 16, padding: '22px 20px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(22px, 4vw, 32px)', color: C.vert, fontWeight: 700, marginBottom: 6, lineHeight: 1 }}>{profil[c.key] as string}</div>
                  <div style={{ fontSize: 11, color: C.grey, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{c.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Valeurs */}
        {valeurs.length > 0 && (
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(19px, 3vw, 25px)', color: C.dark, margin: '0 0 18px' }}>Nos valeurs</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {valeurs.map(v => <div key={v} style={{ padding: '13px 22px', borderRadius: 14, backgroundColor: C.white, border: `1px solid ${C.sable}`, fontSize: 15, fontWeight: 600, color: C.vert }}>{v}</div>)}
            </div>
          </section>
        )}

        {/* Avantages */}
        {avantages.length > 0 && (
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(19px, 3vw, 25px)', color: C.dark, margin: '0 0 18px' }}>La vie chez nous</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {avantages.map(a => <div key={a} style={{ backgroundColor: C.vert, borderRadius: 14, padding: '18px 20px', color: C.sable, fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>{a}</div>)}
            </div>
          </section>
        )}

        {/* Offres */}
        <section style={{ marginBottom: 52 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(19px, 3vw, 25px)', color: C.dark, margin: 0 }}>
              Offres actives {offres.length > 0 && <span style={{ fontSize: 16, color: C.grey, fontWeight: 400 }}>({offres.length})</span>}
            </h2>
            <button onClick={() => router.push('/recruteur/offres')} style={{ backgroundColor: 'transparent', border: `1.5px solid ${C.sable}`, borderRadius: 10, padding: '8px 16px', fontSize: 13, color: C.dark, cursor: 'pointer', fontFamily: 'inherit' }}>Gérer →</button>
          </div>
          {offres.length === 0 ? (
            <div style={{ backgroundColor: C.white, borderRadius: 14, border: `1px solid ${C.sable}`, padding: '36px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: C.grey, marginBottom: 16 }}>Aucune offre publiée pour le moment.</div>
              <button onClick={() => router.push('/recruteur/offres/nouvelle')} style={{ backgroundColor: C.terracotta, color: C.white, border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Créer une offre →</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {offres.map(o => (
                <div key={o.id} style={{ backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 13, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: C.dark, fontWeight: 600, marginBottom: 5 }}>{o.titre}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {o.type_contrat && <span style={{ fontSize: 11, fontWeight: 700, color: C.vert, backgroundColor: `${C.vert}12`, padding: '2px 9px', borderRadius: 20 }}>{o.type_contrat}</span>}
                      {o.ville && <span style={{ fontSize: 12, color: C.grey }}>◎ {o.ville}{o.mode_travail ? ` · ${o.mode_travail}` : ''}</span>}
                      <span style={{ fontSize: 11, color: '#BBBBBB' }}>{dateLabel(o.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {userId && <a href={`/entreprise/${userId}#offres`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.grey, textDecoration: 'none', padding: '6px 12px', border: `1px solid ${C.sable}`, borderRadius: 8 }}>Vitrine ↗</a>}
                    <button onClick={() => router.push(`/recruteur/offres/${o.id}`)} style={{ backgroundColor: 'transparent', border: `1px solid ${C.sable}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, color: C.dark, cursor: 'pointer', fontFamily: 'inherit' }}>Voir →</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Presse */}
        {presse.length > 0 && (
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(19px, 3vw, 25px)', color: C.dark, margin: '0 0 18px' }}>Dans la presse</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {presse.map((item, i) => (
                <div key={i} style={{ backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 13 }}>
                  {item.url ? (
                    <a href={item.url.startsWith('http') ? item.url : `https://${item.url}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', textDecoration: 'none' }}>
                      <PresseRow item={item} />
                    </a>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px' }}><PresseRow item={item} /></div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Réseaux */}
        {(profil.entreprise_linkedin || profil.entreprise_instagram || profil.entreprise_site) && (
          <section>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {profil.entreprise_linkedin && (
                <a href={profil.entreprise_linkedin.startsWith('http') ? profil.entreprise_linkedin : `https://${profil.entreprise_linkedin}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 12, fontSize: 13, color: C.dark, textDecoration: 'none', fontWeight: 500 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, fontFamily: 'serif' }}>in</span> LinkedIn
                </a>
              )}
              {profil.entreprise_instagram && (
                <a href={profil.entreprise_instagram.startsWith('http') ? profil.entreprise_instagram : `https://instagram.com/${profil.entreprise_instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 12, fontSize: 13, color: C.dark, textDecoration: 'none', fontWeight: 500 }}>
                  📷 Instagram
                </a>
              )}
              {profil.entreprise_site && (
                <a href={profil.entreprise_site.startsWith('http') ? profil.entreprise_site : `https://${profil.entreprise_site}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 12, fontSize: 13, color: C.dark, textDecoration: 'none', fontWeight: 500 }}>
                  ◎ {profil.entreprise_site.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function PresseRow({ item }: { item: PresseItem }) {
  return (
    <>
      <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${C.terracotta}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📰</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.titre}</div>
        <div style={{ fontSize: 12, color: C.grey }}>{item.source}{item.annee ? ` · ${item.annee}` : ''}</div>
      </div>
      {item.url && <span style={{ fontSize: 18, color: '#D0D0D0', flexShrink: 0 }}>→</span>}
    </>
  )
}
