'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Palette ──────────────────────────────────────────────────────────────────

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  vert:       '#2C4A3E',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  lightGrey:  '#D0D0D0',
  white:      '#FFFFFF',
  bg:         '#F5F5F5',
  sidebar:    '#18211F',
  sidebarHov: '#243330',
  red:        '#C0392B',
  redBg:      '#FDECEA',
  blue:       '#2563EB',
  amber:      '#C88A2A',
}

const ADMIN_EMAIL = 'charley1foucher@gmail.com'

// ─── Types ────────────────────────────────────────────────────────────────────

type Profil = {
  id: string
  user_id: string
  prenom: string | null
  email?: string | null
  type_compte: string | null
  domaine: string | null
  ville: string | null
  created_at: string
}

type Offre = {
  id: string
  titre: string
  entreprise_nom: string | null
  ville: string | null
  type_contrat: string | null
  active: boolean | null
  created_at: string
}

type Statut = 'envoyée' | 'vue' | 'en_cours' | 'acceptée' | 'refusée'

type Candidature = {
  id: string
  created_at: string
  statut: Statut
  candidat_id: string
  offre_id: string
  profils?: { prenom: string | null } | null
  offres?: { titre: string } | null
}

type Stats = {
  total: number
  candidats: number
  recruteurs: number
  offres: number
  candidatures: number
}

type Section = 'utilisateurs' | 'offres' | 'candidatures'

// ─── Statut config ────────────────────────────────────────────────────────────

const STATUTS: Statut[] = ['envoyée', 'vue', 'en_cours', 'acceptée', 'refusée']

const STATUT_STYLE: Record<Statut, { color: string; bg: string; label: string }> = {
  envoyée:  { color: C.grey,       bg: '#F0F0F0', label: 'Envoyée' },
  vue:      { color: C.blue,       bg: '#EBF0FF', label: 'Vue' },
  en_cours: { color: C.amber,      bg: `${C.amber}20`, label: 'En cours' },
  acceptée: { color: C.vert,       bg: `${C.vert}18`, label: 'Acceptée' },
  refusée:  { color: C.red,        bg: C.redBg,   label: 'Refusée' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 30) return `Il y a ${days} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
}

async function fetchCount(table: string, filter?: { col: string; val: string }): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from(table).select('*', { count: 'exact', head: true })
  if (filter) q = q.eq(filter.col, filter.val)
  const { count } = await q
  return (count as number | null) ?? 0
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{
      minHeight: '100vh', backgroundColor: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%',
        border: `3px solid ${C.sable}`, borderTopColor: C.terracotta,
        animation: 'kavio-spin 0.8s linear infinite',
      }} />
    </div>
  )
}

function StatCard({ label, value, icon, accent }: {
  label: string; value: number; icon: string; accent: string
}) {
  return (
    <div style={{
      flex: '1 1 140px',
      backgroundColor: C.white,
      borderRadius: '14px',
      padding: '20px',
      border: `1px solid #E8E8E8`,
    }}>
      <div style={{ fontSize: '18px', marginBottom: '10px' }}>{icon}</div>
      <div style={{
        fontFamily: 'Georgia, serif',
        fontSize: '34px', fontWeight: '700',
        color: accent, lineHeight: 1, marginBottom: '6px',
      }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: C.grey, fontWeight: '500' }}>{label}</div>
    </div>
  )
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px',
    }}>
      <h2 style={{
        fontFamily: 'Georgia, serif', fontSize: '18px',
        color: C.dark, margin: 0,
      }}>
        {title}
      </h2>
      <span style={{
        fontSize: '12px', fontWeight: '700', color: C.grey,
        backgroundColor: '#EBEBEB', padding: '2px 8px', borderRadius: '20px',
      }}>
        {count}
      </span>
    </div>
  )
}

function SearchInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string
}) {
  return (
    <div style={{ position: 'relative', marginBottom: '14px' }}>
      <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke={C.lightGrey} strokeWidth="2" strokeLinecap="round"
        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      >
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '9px 12px 9px 36px',
          fontSize: '13px', borderRadius: '10px',
          border: '1.5px solid #E8E8E8',
          backgroundColor: C.white, color: C.dark,
          outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
        }}
      />
    </div>
  )
}

function BtnDanger({ label, onClick, loading }: {
  label: string; onClick: () => void; loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        backgroundColor: 'transparent', color: C.red,
        border: `1px solid ${C.red}40`, borderRadius: '8px',
        padding: '5px 12px', fontSize: '12px', fontWeight: '600',
        cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()

  const [loading, setLoading]         = useState(true)
  const [stats, setStats]             = useState<Stats>({ total: 0, candidats: 0, recruteurs: 0, offres: 0, candidatures: 0 })
  const [profils, setProfils]         = useState<Profil[]>([])
  const [offres, setOffres]           = useState<Offre[]>([])
  const [candidatures, setCandidatures] = useState<Candidature[]>([])
  const [section, setSection]         = useState<Section>('utilisateurs')
  const [searchUsers, setSearchUsers] = useState('')
  const [searchOffres, setSearchOffres] = useState('')
  const [busy, setBusy]               = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.email !== ADMIN_EMAIL) {
        router.replace('/')
        return
      }

      const [total, candidats, recruteurs, nOffres, nCands] = await Promise.all([
        fetchCount('profils'),
        fetchCount('profils', { col: 'type_compte', val: 'candidat' }),
        fetchCount('profils', { col: 'type_compte', val: 'recruteur' }),
        fetchCount('offres'),
        fetchCount('candidatures'),
      ])

      const [profilsRes, offresRes, candsRes] = await Promise.all([
        supabase.from('profils').select('id,user_id,prenom,type_compte,domaine,ville,created_at').order('created_at', { ascending: false }),
        supabase.from('offres').select('id,titre,entreprise_nom,ville,type_contrat,active,created_at').order('created_at', { ascending: false }),
        supabase.from('candidatures').select('id,created_at,statut,candidat_id,offre_id,profils(prenom),offres(titre)').order('created_at', { ascending: false }).limit(50),
      ])

      setStats({ total, candidats, recruteurs, offres: nOffres, candidatures: nCands })
      setProfils((profilsRes.data as Profil[]) ?? [])
      setOffres((offresRes.data as Offre[]) ?? [])
      setCandidatures((candsRes.data as unknown as Candidature[]) ?? [])
      setLoading(false)
    }
    init()
  }, [router])

  // ── Actions ───────────────────────────────────────────────────────────────

  async function deleteProfil(userId: string) {
    if (!confirm('Supprimer cet utilisateur ? Cette action est irréversible.')) return
    setBusy(userId)
    await supabase.from('profils').delete().eq('user_id', userId)
    setProfils(prev => prev.filter(p => p.user_id !== userId))
    setStats(s => ({ ...s, total: s.total - 1 }))
    setBusy(null)
  }

  async function toggleOffre(id: string, current: boolean | null) {
    setBusy(id)
    await supabase.from('offres').update({ active: !current }).eq('id', id)
    setOffres(prev => prev.map(o => o.id === id ? { ...o, active: !current } : o))
    setBusy(null)
  }

  async function deleteOffre(id: string) {
    if (!confirm('Supprimer cette offre ?')) return
    setBusy(id)
    await supabase.from('offres').delete().eq('id', id)
    setOffres(prev => prev.filter(o => o.id !== id))
    setStats(s => ({ ...s, offres: s.offres - 1 }))
    setBusy(null)
  }

  async function updateStatut(id: string, statut: Statut) {
    setBusy(id)
    await supabase.from('candidatures').update({ statut }).eq('id', id)
    setCandidatures(prev => prev.map(c => c.id === id ? { ...c, statut } : c))
    setBusy(null)
  }

  // ── Filtres ───────────────────────────────────────────────────────────────

  const filteredProfils = useMemo(() => {
    const q = searchUsers.toLowerCase()
    return profils.filter(p =>
      !q || (p.prenom ?? '').toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q) || (p.domaine ?? '').toLowerCase().includes(q)
    )
  }, [profils, searchUsers])

  const filteredOffres = useMemo(() => {
    const q = searchOffres.toLowerCase()
    return offres.filter(o =>
      !q || o.titre.toLowerCase().includes(q) || (o.entreprise_nom ?? '').toLowerCase().includes(q) || (o.ville ?? '').toLowerCase().includes(q)
    )
  }, [offres, searchOffres])

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return <Spinner />

  const NAV: { id: Section; label: string; count: number }[] = [
    { id: 'utilisateurs', label: 'Utilisateurs',  count: stats.total },
    { id: 'offres',       label: 'Offres',         count: stats.offres },
    { id: 'candidatures', label: 'Candidatures',   count: stats.candidatures },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: C.bg }}>
      <style suppressHydrationWarning>{`@keyframes kavio-spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: '220px', flexShrink: 0,
        backgroundColor: C.sidebar,
        display: 'flex', flexDirection: 'column',
        padding: '0 0 24px',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          marginBottom: '8px',
        }}>
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: '18px',
            color: C.white, marginBottom: '4px',
          }}>
            Kavio
          </div>
          <div style={{
            fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em',
            color: C.terracotta, textTransform: 'uppercase',
          }}>
            Admin
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 10px' }}>
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 14px', borderRadius: '10px',
                marginBottom: '4px', border: 'none',
                backgroundColor: section === item.id ? C.sidebarHov : 'transparent',
                color: section === item.id ? C.white : 'rgba(255,255,255,0.5)',
                fontSize: '13px', fontWeight: section === item.id ? '600' : '400',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.15s',
              }}
            >
              {item.label}
              <span style={{
                fontSize: '11px', fontWeight: '600',
                backgroundColor: section === item.id ? C.terracotta : 'rgba(255,255,255,0.1)',
                color: C.white,
                padding: '1px 7px', borderRadius: '10px',
              }}>
                {item.count}
              </span>
            </button>
          ))}
        </nav>

        {/* Back */}
        <div style={{ padding: '0 10px' }}>
          <button
            onClick={() => router.push('/')}
            style={{
              width: '100%', padding: '9px 14px', borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent',
              color: 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: 'pointer',
            }}
          >
            ← Retour au site
          </button>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '36px 40px', minWidth: 0, overflowX: 'auto' }}>

        {/* ── STATS ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '36px' }}>
          <StatCard icon="◎" label="Utilisateurs"   value={stats.total}        accent={C.dark} />
          <StatCard icon="👤" label="Candidats"     value={stats.candidats}    accent={C.terracotta} />
          <StatCard icon="🔍" label="Recruteurs"    value={stats.recruteurs}   accent={C.vert} />
          <StatCard icon="⬡" label="Offres"         value={stats.offres}       accent={C.amber} />
          <StatCard icon="✦" label="Candidatures"   value={stats.candidatures} accent={C.blue} />
        </div>

        {/* ── SECTION UTILISATEURS ────────────────────────────────────── */}
        {section === 'utilisateurs' && (
          <section>
            <SectionHeader title="Utilisateurs" count={filteredProfils.length} />
            <SearchInput value={searchUsers} onChange={setSearchUsers} placeholder="Rechercher par prénom, email, domaine…" />

            <div style={{
              backgroundColor: C.white, borderRadius: '14px',
              border: '1px solid #E8E8E8', overflow: 'hidden',
            }}>
              {/* Head */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 140px 90px 90px 80px',
                gap: '12px', padding: '10px 18px',
                backgroundColor: '#F9F9F9',
                borderBottom: '1px solid #EFEFEF',
                fontSize: '11px', fontWeight: '700',
                color: C.grey, textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                <span>Prénom</span>
                <span>Compte</span>
                <span>Domaine</span>
                <span>Ville</span>
                <span>Inscrit</span>
                <span></span>
              </div>

              {filteredProfils.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: C.grey, fontSize: '13px' }}>
                  Aucun utilisateur trouvé.
                </div>
              ) : (
                filteredProfils.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 100px 140px 90px 90px 80px',
                      gap: '12px', padding: '12px 18px',
                      alignItems: 'center',
                      borderBottom: i < filteredProfils.length - 1 ? '1px solid #F3F3F3' : 'none',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ fontWeight: '600', color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.prenom ?? '—'}
                    </span>
                    <span>
                      <span style={{
                        fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px',
                        backgroundColor: p.type_compte === 'recruteur' ? `${C.vert}18` : `${C.terracotta}15`,
                        color: p.type_compte === 'recruteur' ? C.vert : C.terracotta,
                      }}>
                        {p.type_compte ?? '—'}
                      </span>
                    </span>
                    <span style={{ color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.domaine ?? '—'}
                    </span>
                    <span style={{ color: C.grey }}>{p.ville ?? '—'}</span>
                    <span style={{ color: C.lightGrey, fontSize: '12px' }}>{dateLabel(p.created_at)}</span>
                    <span>
                      <BtnDanger
                        label="Supprimer"
                        onClick={() => deleteProfil(p.user_id)}
                        loading={busy === p.user_id}
                      />
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* ── SECTION OFFRES ──────────────────────────────────────────── */}
        {section === 'offres' && (
          <section>
            <SectionHeader title="Offres" count={filteredOffres.length} />
            <SearchInput value={searchOffres} onChange={setSearchOffres} placeholder="Rechercher par titre, entreprise, ville…" />

            <div style={{
              backgroundColor: C.white, borderRadius: '14px',
              border: '1px solid #E8E8E8', overflow: 'hidden',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 130px 90px 80px 90px 160px',
                gap: '12px', padding: '10px 18px',
                backgroundColor: '#F9F9F9',
                borderBottom: '1px solid #EFEFEF',
                fontSize: '11px', fontWeight: '700',
                color: C.grey, textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                <span>Titre</span>
                <span>Entreprise</span>
                <span>Ville</span>
                <span>Contrat</span>
                <span>Publiée</span>
                <span>Actions</span>
              </div>

              {filteredOffres.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: C.grey, fontSize: '13px' }}>
                  Aucune offre trouvée.
                </div>
              ) : (
                filteredOffres.map((o, i) => (
                  <div
                    key={o.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 130px 90px 80px 90px 160px',
                      gap: '12px', padding: '12px 18px',
                      alignItems: 'center',
                      borderBottom: i < filteredOffres.length - 1 ? '1px solid #F3F3F3' : 'none',
                      fontSize: '13px',
                      opacity: o.active === false ? 0.5 : 1,
                    }}
                  >
                    <span style={{
                      fontWeight: '600', color: C.dark,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {o.titre}
                    </span>
                    <span style={{ color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.entreprise_nom ?? '—'}
                    </span>
                    <span style={{ color: C.grey }}>{o.ville ?? '—'}</span>
                    <span style={{ color: C.grey }}>{o.type_contrat ?? '—'}</span>
                    <span style={{ color: C.lightGrey, fontSize: '12px' }}>{dateLabel(o.created_at)}</span>
                    <span style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => toggleOffre(o.id, o.active)}
                        disabled={busy === o.id}
                        style={{
                          backgroundColor: o.active ? `${C.vert}15` : `${C.amber}20`,
                          color: o.active ? C.vert : C.amber,
                          border: 'none', borderRadius: '8px',
                          padding: '5px 10px', fontSize: '12px', fontWeight: '600',
                          cursor: busy === o.id ? 'default' : 'pointer',
                          opacity: busy === o.id ? 0.5 : 1,
                        }}
                      >
                        {o.active ? 'Désactiver' : 'Activer'}
                      </button>
                      <BtnDanger
                        label="Suppr."
                        onClick={() => deleteOffre(o.id)}
                        loading={busy === o.id}
                      />
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* ── SECTION CANDIDATURES ────────────────────────────────────── */}
        {section === 'candidatures' && (
          <section>
            <SectionHeader title="Dernières candidatures" count={candidatures.length} />

            <div style={{
              backgroundColor: C.white, borderRadius: '14px',
              border: '1px solid #E8E8E8', overflow: 'hidden',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 100px 200px',
                gap: '12px', padding: '10px 18px',
                backgroundColor: '#F9F9F9',
                borderBottom: '1px solid #EFEFEF',
                fontSize: '11px', fontWeight: '700',
                color: C.grey, textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                <span>Candidat</span>
                <span>Offre</span>
                <span>Date</span>
                <span>Statut</span>
              </div>

              {candidatures.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: C.grey, fontSize: '13px' }}>
                  Aucune candidature.
                </div>
              ) : (
                candidatures.map((c, i) => {
                  const st = STATUT_STYLE[c.statut] ?? STATUT_STYLE.envoyée
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr 100px 200px',
                        gap: '12px', padding: '12px 18px',
                        alignItems: 'center',
                        borderBottom: i < candidatures.length - 1 ? '1px solid #F3F3F3' : 'none',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ fontWeight: '600', color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.profils?.prenom ?? '—'}
                      </span>
                      <span style={{ color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.offres?.titre ?? '—'}
                      </span>
                      <span style={{ color: C.lightGrey, fontSize: '12px' }}>{dateLabel(c.created_at)}</span>
                      <span>
                        <select
                          value={c.statut}
                          onChange={e => updateStatut(c.id, e.target.value as Statut)}
                          disabled={busy === c.id}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '8px',
                            border: `1.5px solid ${st.color}40`,
                            backgroundColor: st.bg,
                            color: st.color,
                            fontSize: '12px', fontWeight: '600',
                            cursor: 'pointer', fontFamily: 'inherit',
                            outline: 'none',
                          }}
                        >
                          {STATUTS.map(s => (
                            <option key={s} value={s}>
                              {STATUT_STYLE[s].label}
                            </option>
                          ))}
                        </select>
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        )}

      </main>
    </div>
  )
}
