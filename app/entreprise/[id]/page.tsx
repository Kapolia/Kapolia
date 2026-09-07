'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calculerScore, type ProfilMatch } from '@/lib/matching'

const C = {
  terracotta: '#C4673A', sable: '#E8D5B7', creme: '#F7F2EB',
  vert: '#2C4A3E', dark: '#1A1A1A', grey: '#6B6B6B',
  lightGrey: '#D0D0D0', white: '#FFFFFF', amber: '#C88A2A',
}

type PresseItem = { titre: string; source: string; url: string; annee: string }

type EntrepriseProfil = {
  user_id:                   string
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

type Offre = {
  id: string; titre: string; type_contrat: string | null; ville: string | null
  mode_travail: string | null; domaine: string | null; experience: string | null
  salaire_min: number | null; salaire_max: number | null; periode_salaire: string | null
  valeurs: string[] | null; created_at: string; score?: number
}

const PROFIL_SELECT = [
  'user_id', 'entreprise_nom', 'entreprise_secteur', 'entreprise_taille', 'entreprise_ville',
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

function LogoBlock({ ep, size = 80 }: { ep: EntrepriseProfil; size?: number }) {
  const [err, setErr] = useState(false)
  const nom = ep.entreprise_nom ?? 'E'
  if (ep.entreprise_logo_url && !err) return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size / 5), overflow: 'hidden', backgroundColor: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <img src={ep.entreprise_logo_url} alt={nom} onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: Math.round(size * 0.1) }} />
    </div>
  )
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size / 5), backgroundColor: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.2)' }}>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: Math.round(size * 0.42), fontWeight: 700, color: C.white }}>{nom.charAt(0).toUpperCase()}</span>
    </div>
  )
}

function ScoreRing({ score, delay = 0 }: { score: number; delay?: number }) {
  const [go, setGo] = useState(false)
  useEffect(() => { const t = setTimeout(() => setGo(true), delay); return () => clearTimeout(t) }, [delay])
  const size = 54, sw = 5, r = (size - sw * 2) / 2, circ = 2 * Math.PI * r
  const offset = go ? circ * (1 - score / 100) : circ
  const color  = score >= 75 ? C.vert : score >= 50 ? C.amber : C.lightGrey
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.sable} strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color, lineHeight: 1 }}>{score}%</span>
        <span style={{ fontSize: 9, color: C.grey, lineHeight: 1.2 }}>match</span>
      </div>
    </div>
  )
}

function STitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(19px, 3vw, 25px)', color: C.dark, margin: '0 0 18px' }}>{children}</h2>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EntrepriseVitrinePage() {
  const params = useParams()
  const router = useRouter()
  const id     = params.id as string

  const [ep, setEp]                         = useState<EntrepriseProfil | null>(null)
  const [offres, setOffres]                 = useState<Offre[]>([])
  const [loading, setLoading]               = useState(true)
  const [notFound, setNotFound]             = useState(false)
  const [fetchError, setFetchError]         = useState(false)
  const [isConnected, setIsConnected]       = useState(false)
  const [candidatProfil, setCandidatProfil] = useState<ProfilMatch | null>(null)
  const [suivre, setSuivre]                 = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setIsConnected(!!user)

      const { data: rawData, error: profilError } = await supabase
        .from('profils').select(PROFIL_SELECT).eq('user_id', id).single()

      if (profilError) {
        if (profilError.code === 'PGRST116') {
          // Aucune ligne trouvée — l'entreprise n'existe pas ou n'a pas configuré son profil
          setNotFound(true)
        } else {
          console.error('[vitrine] Erreur chargement profil:', profilError)
          setFetchError(true)
        }
        setLoading(false)
        return
      }

      const profilData = rawData as unknown as EntrepriseProfil | null
      if (!profilData?.entreprise_nom) { setNotFound(true); setLoading(false); return }
      setEp(profilData)

      const { data: offresData } = await supabase
        .from('offres')
        .select('id, titre, type_contrat, ville, mode_travail, domaine, experience, salaire_min, salaire_max, periode_salaire, valeurs, created_at')
        .eq('recruteur_id', id).eq('statut_publication', 'publiée').eq('active', true)
        .order('created_at', { ascending: false })

      const raw = (offresData ?? []) as Offre[]

      if (user) {
        const { data: p } = await supabase.from('profils')
          .select('domaine, experience, type_poste, valeur, disponibilite, ville')
          .eq('user_id', user.id).single()
        if (p) {
          setCandidatProfil(p as ProfilMatch)
          setOffres(raw.map(o => ({ ...o, score: calculerScore(p as ProfilMatch, o as Parameters<typeof calculerScore>[1]) })))
        } else setOffres(raw)
      } else setOffres(raw)

      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: C.creme }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kapolia-spin 0.8s linear infinite' }} />
    </div>
  )

  if (fetchError) return (
    <div style={{ minHeight: '100vh', backgroundColor: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: isConnected ? 64 : 0 }}>
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: C.dark, margin: '0 0 8px' }}>Une erreur est survenue</p>
        <p style={{ fontSize: 14, color: C.grey, margin: 0 }}>Impossible de charger cette page. Veuillez réessayer dans quelques instants.</p>
      </div>
    </div>
  )

  if (notFound || !ep) return (
    <div style={{ minHeight: '100vh', backgroundColor: C.creme, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: isConnected ? 64 : 0 }}>
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: C.dark, margin: '0 0 10px' }}>Entreprise introuvable</h1>
        <p style={{ fontSize: 14, color: C.grey, margin: '0 0 24px' }}>Cette page n'existe pas ou l'entreprise n'a pas encore configuré son profil.</p>
        <button onClick={() => router.push('/offres')} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Voir les offres →</button>
      </div>
    </div>
  )

  const nom       = ep.entreprise_nom!
  const valeurs   = ep.entreprise_valeurs ?? []
  const avantages = ep.entreprise_avantages ?? []
  const presse    = ep.entreprise_presse ?? []
  const chiffres  = CHIFFRES.filter(c => ep[c.key])

  return (
    <main style={{ backgroundColor: C.creme, minHeight: '100vh', marginLeft: isConnected ? 64 : 0 }}>
      <style suppressHydrationWarning>{`@keyframes kapolia-spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}`}</style>

      {/* NAVBAR — visiteur non connecté uniquement */}
      {!isConnected && (
        <nav style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`, padding: '0 40px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
          <div onClick={() => router.push('/')} style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: C.dark, cursor: 'pointer', letterSpacing: '-0.02em' }}>Kapolia</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => router.push('/offres')} style={{ padding: '7px 16px', borderRadius: 10, border: `1px solid ${C.sable}`, backgroundColor: 'transparent', color: C.grey, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Toutes les offres</button>
            <button onClick={() => router.push('/connexion')} style={{ padding: '7px 16px', borderRadius: 10, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Se connecter</button>
          </div>
        </nav>
      )}

      {/* HEADER */}
      <header style={{ backgroundColor: C.vert, padding: '52px 40px 48px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* Lien de retour — candidat connecté uniquement (remplace le bouton navbar) */}
          {isConnected && (
            <button
              onClick={() => router.push('/offres')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: `${C.sable}AA`, fontSize: 13, padding: '0 0 20px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              ← Toutes les offres
            </button>
          )}
          {offres.length > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: C.terracotta, color: C.white, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 20, marginBottom: 28 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: C.white, display: 'inline-block' }} />Recrute activement
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            <LogoBlock ep={ep} size={80} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 5vw, 44px)', color: C.white, margin: '0 0 8px', lineHeight: 1.1 }}>{nom}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 28 }}>
                {ep.entreprise_secteur && <span style={{ fontSize: 14, color: C.sable }}>⬡ {ep.entreprise_secteur}</span>}
                {ep.entreprise_ville   && <span style={{ fontSize: 14, color: C.sable }}>◎ {ep.entreprise_ville}</span>}
                {ep.entreprise_taille  && <span style={{ fontSize: 14, color: C.sable }}>◷ {ep.entreprise_taille}</span>}
                {ep.entreprise_site    && <a href={ep.entreprise_site.startsWith('http') ? ep.entreprise_site : `https://${ep.entreprise_site}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: C.sable, opacity: 0.8, textDecoration: 'none' }}>↗ {ep.entreprise_site.replace(/^https?:\/\//, '')}</a>}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {offres.length > 0 && (
                  <button onClick={() => document.getElementById('offres')?.scrollIntoView({ behavior: 'smooth' })} style={{ backgroundColor: C.terracotta, color: C.white, border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Voir les offres ({offres.length})
                  </button>
                )}
                <button onClick={() => setSuivre(s => !s)} style={{ backgroundColor: suivre ? 'rgba(232,213,183,0.25)' : 'transparent', color: C.sable, border: `1px solid ${C.sable}60`, borderRadius: 12, padding: '12px 24px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                  {suivre ? '✓ Suivi' : '+ Suivre'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENU */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '52px 24px 80px' }}>

        {/* Mission */}
        {ep.entreprise_mission && (
          <section style={{ marginBottom: 56, textAlign: 'center', padding: '0 32px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.terracotta, marginBottom: 16 }}>Notre mission</div>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(18px, 2.5vw, 26px)', color: C.dark, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
              « {ep.entreprise_mission} »
            </p>
          </section>
        )}

        {/* Description */}
        {ep.entreprise_description && (
          <section style={{ marginBottom: 56 }}>
            <STitle>Qui sommes-nous</STitle>
            {ep.entreprise_description.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} style={{ fontSize: 15, color: '#3A3A3A', lineHeight: 1.75, margin: '0 0 14px' }}>{para}</p>
            ))}
          </section>
        )}

        {/* Chiffres clés */}
        {chiffres.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <STitle>En chiffres</STitle>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(chiffres.length, 3)}, 1fr)`, gap: 14 }}>
              {chiffres.map(c => (
                <div key={c.key} style={{ backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 16, padding: '24px 20px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(22px, 4vw, 34px)', color: C.vert, fontWeight: 700, marginBottom: 8, lineHeight: 1 }}>{ep[c.key] as string}</div>
                  <div style={{ fontSize: 11, color: C.grey, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{c.label}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Valeurs */}
        {valeurs.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <STitle>Nos valeurs</STitle>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {valeurs.map(v => <div key={v} style={{ padding: '13px 22px', borderRadius: 14, backgroundColor: C.white, border: `1px solid ${C.sable}`, fontSize: 15, fontWeight: 600, color: C.vert }}>{v}</div>)}
            </div>
          </section>
        )}

        {/* Avantages */}
        {avantages.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <STitle>La vie chez nous</STitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {avantages.map(a => <div key={a} style={{ backgroundColor: C.vert, borderRadius: 14, padding: '18px 20px', color: C.sable, fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>{a}</div>)}
            </div>
          </section>
        )}

        {/* Offres */}
        <section id="offres" style={{ marginBottom: 56 }}>
          <STitle>Nos offres actuelles</STitle>
          <p style={{ fontSize: 14, color: C.grey, margin: '-10px 0 22px' }}>
            {candidatProfil ? 'Score de compatibilité calculé selon votre profil Kapolia.' : 'Connectez-vous pour voir votre score de compatibilité.'}
          </p>
          {offres.length === 0 ? (
            <div style={{ backgroundColor: C.white, borderRadius: 16, border: `1px solid ${C.sable}`, padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: C.dark, marginBottom: 6 }}>Aucune offre active en ce moment</div>
              <div style={{ fontSize: 13, color: C.grey }}>Revenez bientôt ou suivez cette entreprise pour être notifié.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {offres.map((offre, i) => {
                const sal = (offre.salaire_min || offre.salaire_max)
                  ? ((offre.salaire_min && offre.salaire_max)
                    ? `${offre.salaire_min.toLocaleString('fr-FR')} – ${offre.salaire_max.toLocaleString('fr-FR')} €`
                    : `${(offre.salaire_min ?? offre.salaire_max)!.toLocaleString('fr-FR')} €`)
                    + (offre.periode_salaire === 'mensuel' ? '/mois' : '/an')
                  : null
                return (
                  <div key={offre.id} style={{ backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 16, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    {candidatProfil && offre.score != null && <ScoreRing score={offre.score} delay={i * 120} />}
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, color: C.dark, fontWeight: 600, marginBottom: 7 }}>{offre.titre}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        {offre.type_contrat && <span style={{ fontSize: 12, fontWeight: 700, color: C.vert, backgroundColor: `${C.vert}15`, padding: '3px 10px', borderRadius: 20 }}>{offre.type_contrat}</span>}
                        {sal && <span style={{ fontSize: 13, color: C.dark, fontWeight: 500 }}>💰 {sal}</span>}
                        {offre.ville && <span style={{ fontSize: 13, color: C.grey }}>◎ {offre.ville}{offre.mode_travail ? ` · ${offre.mode_travail}` : ''}</span>}
                        <span style={{ fontSize: 12, color: C.lightGrey }}>{dateLabel(offre.created_at)}</span>
                      </div>
                    </div>
                    <button onClick={() => router.push(isConnected ? `/offres/${offre.id}` : '/connexion')} style={{ backgroundColor: C.terracotta, color: C.white, border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
                      Voir l'offre →
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          {!isConnected && offres.length > 0 && (
            <div style={{ marginTop: 20, padding: '18px 22px', backgroundColor: `${C.terracotta}0D`, border: `1px solid ${C.terracotta}30`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.dark, marginBottom: 3 }}>Votre score de compatibilité</div>
                <div style={{ fontSize: 13, color: C.grey }}>Créez votre profil Kapolia pour voir si ces offres vous correspondent.</div>
              </div>
              <button onClick={() => router.push('/inscription')} style={{ backgroundColor: C.terracotta, color: C.white, border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                Créer mon profil →
              </button>
            </div>
          )}
        </section>

        {/* Presse */}
        {presse.length > 0 && (
          <section style={{ marginBottom: 56 }}>
            <STitle>Dans la presse</STitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {presse.map((item, i) => (
                <div key={i} style={{ backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 14 }}>
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
        {(ep.entreprise_linkedin || ep.entreprise_instagram || ep.entreprise_site) && (
          <section>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {ep.entreprise_linkedin && (
                <a href={ep.entreprise_linkedin.startsWith('http') ? ep.entreprise_linkedin : `https://${ep.entreprise_linkedin}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 12, fontSize: 13, color: C.dark, textDecoration: 'none', fontWeight: 500 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, fontFamily: 'serif' }}>in</span> LinkedIn
                </a>
              )}
              {ep.entreprise_instagram && (
                <a href={ep.entreprise_instagram.startsWith('http') ? ep.entreprise_instagram : `https://instagram.com/${ep.entreprise_instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 12, fontSize: 13, color: C.dark, textDecoration: 'none', fontWeight: 500 }}>
                  📷 Instagram
                </a>
              )}
              {ep.entreprise_site && (
                <a href={ep.entreprise_site.startsWith('http') ? ep.entreprise_site : `https://${ep.entreprise_site}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', backgroundColor: C.white, border: `1px solid ${C.sable}`, borderRadius: 12, fontSize: 13, color: C.dark, textDecoration: 'none', fontWeight: 500 }}>
                  ◎ {ep.entreprise_site.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </section>
        )}
      </div>

      {/* FOOTER */}
      <footer style={{ backgroundColor: C.dark, padding: '32px 40px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: C.white }}>{nom}</div>
          <div style={{ fontSize: 12, color: C.sable, opacity: 0.5 }}>{offres.length} offre{offres.length !== 1 ? 's' : ''} sur Kapolia</div>
        </div>
      </footer>
    </main>
  )
}
