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

type OffreActive = {
  id: string
  titre: string
  type_contrat: string | null
  ville: string | null
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

// ─── Input helpers ─────────────────────────────────────────────────────────────

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

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B6B6B' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36 }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecruteurEntreprisePage() {
  const router = useRouter()

  const [userId, setUserId]     = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Form fields
  const [nom, setNom]                   = useState('')
  const [secteur, setSecteur]           = useState('')
  const [taille, setTaille]             = useState('')
  const [ville, setVille]               = useState('')
  const [site, setSite]                 = useState('')
  const [description, setDescription]  = useState('')
  const [valeurs, setValeurs]           = useState<string[]>([])
  const [valeurInput, setValeurInput]   = useState('')
  const [logoUrl, setLogoUrl]           = useState<string | null>(null)

  // Logo upload
  const [logoPreview, setLogoPreview]   = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Offres actives
  const [offres, setOffres]             = useState<OffreActive[]>([])

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
          .select('id, titre, type_contrat, ville, created_at')
          .eq('recruteur_id', user.id)
          .eq('statut_publication', 'publiée')
          .eq('active', true)
          .order('created_at', { ascending: false }),
      ])

      if (profilRes.data) {
        const p = profilRes.data
        setNom(p.entreprise_nom ?? '')
        setSecteur(p.entreprise_secteur ?? '')
        setTaille(p.entreprise_taille ?? '')
        setVille(p.entreprise_ville ?? '')
        setSite(p.entreprise_site ?? '')
        setDescription(p.entreprise_description ?? '')
        setValeurs(p.entreprise_valeurs ?? [])
        if (p.entreprise_logo_url) {
          setLogoUrl(p.entreprise_logo_url)
          setLogoPreview(p.entreprise_logo_url)
        }
      }
      setOffres((offresRes.data ?? []) as OffreActive[])
      setLoading(false)
    }
    load()
  }, [router])

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 2 * 1024 * 1024) { setError('Logo trop lourd (max 2 Mo)'); return }

    setUploadingLogo(true)
    setError(null)

    // Local preview immediately
    const previewUrl = URL.createObjectURL(file)
    setLogoPreview(previewUrl)

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/logo.${ext}`

    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { setError('Erreur upload logo : ' + upErr.message); setUploadingLogo(false); return }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    // Add cache-busting to avoid stale CDN
    const freshUrl = urlData.publicUrl + '?t=' + Date.now()
    setLogoUrl(freshUrl)
    setLogoPreview(freshUrl)
    setUploadingLogo(false)
  }

  function addValeur() {
    const v = valeurInput.trim()
    if (!v || valeurs.length >= 4 || valeurs.includes(v)) return
    setValeurs([...valeurs, v])
    setValeurInput('')
  }

  function removeValeur(v: string) {
    setValeurs(valeurs.filter(x => x !== v))
  }

  async function handleSave() {
    if (!userId) return
    if (!nom.trim()) { setError('Le nom de l\'entreprise est requis.'); return }
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: upsertErr } = await supabase.from('profils').update({
      entreprise_nom:         nom.trim() || null,
      entreprise_secteur:     secteur || null,
      entreprise_taille:      taille || null,
      entreprise_ville:       ville.trim() || null,
      entreprise_site:        site.trim() || null,
      entreprise_description: description.trim() || null,
      entreprise_valeurs:     valeurs.length > 0 ? valeurs : null,
      entreprise_logo_url:    logoUrl || null,
    }).eq('user_id', userId)

    if (upsertErr) {
      setError('Erreur lors de l\'enregistrement : ' + upsertErr.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kavio-spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', padding: '40px 40px 80px' }}>
      <style suppressHydrationWarning>{`
        input:focus, textarea:focus, select:focus { border-color: ${C.terracotta} !important; box-shadow: 0 0 0 3px ${C.terracotta}15; }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(24px, 4vw, 32px)', color: C.dark, margin: '0 0 6px', lineHeight: 1.15 }}>
              Mon entreprise
            </h1>
            <p style={{ fontSize: 14, color: C.grey, margin: 0 }}>
              Ces informations s'affichent sur votre vitrine publique et sur vos offres.
            </p>
          </div>
          {userId && (
            <a
              href={`/entreprise/${userId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: C.terracotta, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, padding: '9px 18px', border: `1.5px solid ${C.terracotta}40`, borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Voir la vitrine →
            </a>
          )}
        </div>

        {/* ── SECTION : LOGO ──────────────────────────────────────────────── */}
        <div style={{ backgroundColor: C.white, borderRadius: 18, border: `1px solid ${C.sable}`, padding: '28px 32px', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: C.dark, margin: '0 0 22px' }}>Logo</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            {/* Preview */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{ width: 90, height: 90, borderRadius: 16, border: `2px dashed ${C.sable}`, backgroundColor: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, position: 'relative', transition: 'border-color 0.2s' }}
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>🏢</div>
                  <div style={{ fontSize: 10, color: C.grey }}>Ajouter</div>
                </div>
              )}
              {uploadingLogo && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(247,242,235,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kavio-spin 0.8s linear infinite' }} />
                </div>
              )}
            </div>

            <div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingLogo}
                style={{ backgroundColor: 'transparent', border: `1.5px solid ${C.sable}`, borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, color: C.dark, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8, display: 'block' }}
              >
                {uploadingLogo ? 'Envoi…' : logoPreview ? 'Changer le logo' : 'Choisir un logo'}
              </button>
              <div style={{ fontSize: 12, color: C.grey }}>PNG, JPG ou SVG · Max 2 Mo · Format carré recommandé</div>
            </div>

            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
          </div>
        </div>

        {/* ── SECTION : INFORMATIONS ──────────────────────────────────────── */}
        <div style={{ backgroundColor: C.white, borderRadius: 18, border: `1px solid ${C.sable}`, padding: '28px 32px', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: C.dark, margin: '0 0 22px' }}>Informations</h2>

          <FieldWrap>
            <Label>Nom de l'entreprise *</Label>
            <input
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Ex. Kavio SAS"
              style={inputStyle}
            />
          </FieldWrap>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FieldWrap>
              <Label>Secteur d'activité</Label>
              <Select value={secteur} onChange={setSecteur} options={SECTEUR_OPTIONS} placeholder="Choisir un secteur" />
            </FieldWrap>
            <FieldWrap>
              <Label>Taille de l'équipe</Label>
              <Select value={taille} onChange={setTaille} options={TAILLE_OPTIONS} placeholder="Choisir une taille" />
            </FieldWrap>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FieldWrap>
              <Label>Ville / localisation</Label>
              <input
                value={ville}
                onChange={e => setVille(e.target.value)}
                placeholder="Ex. Lyon, France"
                style={inputStyle}
              />
            </FieldWrap>
            <FieldWrap>
              <Label>Site web</Label>
              <input
                value={site}
                onChange={e => setSite(e.target.value)}
                placeholder="Ex. kavio.fr"
                style={inputStyle}
              />
            </FieldWrap>
          </div>
        </div>

        {/* ── SECTION : DESCRIPTION ───────────────────────────────────────── */}
        <div style={{ backgroundColor: C.white, borderRadius: 18, border: `1px solid ${C.sable}`, padding: '28px 32px', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: C.dark, margin: '0 0 6px' }}>À propos</h2>
          <p style={{ fontSize: 13, color: C.grey, margin: '0 0 20px' }}>
            Décrivez votre entreprise en quelques phrases. Vous pouvez séparer par des paragraphes.
          </p>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Qui vous êtes, ce que vous faites, pourquoi vous recrutez…"
            rows={6}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.65 }}
          />
          <div style={{ fontSize: 12, color: C.grey, marginTop: 5, textAlign: 'right' }}>
            {description.length} caractères
          </div>
        </div>

        {/* ── SECTION : VALEURS ───────────────────────────────────────────── */}
        <div style={{ backgroundColor: C.white, borderRadius: 18, border: `1px solid ${C.sable}`, padding: '28px 32px', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: C.dark, margin: '0 0 6px' }}>Valeurs</h2>
          <p style={{ fontSize: 13, color: C.grey, margin: '0 0 20px' }}>
            Maximum 4 valeurs. Elles s'afficheront sur votre vitrine et permettront aux candidats de matcher selon leurs propres valeurs.
          </p>

          {/* Tags existantes */}
          {valeurs.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {valeurs.map(v => (
                <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: `${C.vert}12`, border: `1px solid ${C.vert}30`, borderRadius: 20, padding: '7px 14px' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.vert }}>{v}</span>
                  <button
                    onClick={() => removeValeur(v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey, fontSize: 14, lineHeight: 1, padding: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          {valeurs.length < 4 && (
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={valeurInput}
                onChange={e => setValeurInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addValeur() } }}
                placeholder={`Ajouter une valeur… (${valeurs.length}/4)`}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={addValeur}
                disabled={!valeurInput.trim()}
                style={{ backgroundColor: C.vert, color: C.white, border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: valeurInput.trim() ? 1 : 0.4 }}
              >
                + Ajouter
              </button>
            </div>
          )}
          {valeurs.length >= 4 && (
            <div style={{ fontSize: 12, color: C.amber, fontWeight: 500 }}>Limite atteinte (4 valeurs maximum)</div>
          )}
        </div>

        {/* ── ERREUR & SAVE ───────────────────────────────────────────────── */}
        {error && (
          <div style={{ backgroundColor: `${C.errorRed}10`, border: `1px solid ${C.errorRed}40`, borderRadius: 12, padding: '12px 18px', marginBottom: 16, fontSize: 13, color: C.errorRed }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {saved && (
            <span style={{ fontSize: 13, color: C.vert, fontWeight: 600 }}>✓ Enregistré</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || uploadingLogo}
            style={{ backgroundColor: C.terracotta, color: C.white, border: 'none', borderRadius: 12, padding: '13px 32px', fontSize: 15, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1, transition: 'opacity 0.2s' }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>

        {/* ── SECTION : OFFRES ACTIVES ────────────────────────────────────── */}
        <div style={{ backgroundColor: C.white, borderRadius: 18, border: `1px solid ${C.sable}`, padding: '28px 32px', marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: C.dark, margin: '0 0 4px' }}>Vos offres actives</h2>
              <p style={{ fontSize: 13, color: C.grey, margin: 0 }}>
                {offres.length === 0 ? 'Aucune offre publiée pour le moment.' : `${offres.length} offre${offres.length > 1 ? 's' : ''} affichée${offres.length > 1 ? 's' : ''} sur votre vitrine.`}
              </p>
            </div>
            <button
              onClick={() => router.push('/recruteur/offres')}
              style={{ backgroundColor: 'transparent', border: `1.5px solid ${C.sable}`, borderRadius: 10, padding: '8px 16px', fontSize: 13, color: C.dark, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
            >
              Gérer les offres →
            </button>
          </div>

          {offres.length === 0 ? (
            <div style={{ backgroundColor: C.creme, borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>◎</div>
              <div style={{ fontSize: 14, color: C.grey }}>Publiez des offres pour qu'elles s'affichent sur votre vitrine.</div>
              <button
                onClick={() => router.push('/recruteur/offres/nouvelle')}
                style={{ marginTop: 16, backgroundColor: C.terracotta, color: C.white, border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Créer une offre →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {offres.map(offre => (
                <div key={offre.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', backgroundColor: C.creme, borderRadius: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: C.dark, marginBottom: 3 }}>{offre.titre}</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      {offre.type_contrat && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.vert, backgroundColor: `${C.vert}12`, padding: '2px 9px', borderRadius: 20 }}>{offre.type_contrat}</span>
                      )}
                      {offre.ville && <span style={{ fontSize: 12, color: C.grey }}>◎ {offre.ville}</span>}
                      <span style={{ fontSize: 11, color: C.grey }}>{dateLabel(offre.created_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/recruteur/offres/${offre.id}`)}
                    style={{ backgroundColor: 'transparent', border: `1px solid ${C.sable}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, color: C.grey, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  >
                    Voir →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
