'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Avatar from '@/components/Avatar'
import LogoKapolia from '@/components/LogoKapolia'
import { FONT_LOGO } from '@/lib/typography'
import { C, CARD_SHADOW } from '@/lib/colors'
import { fetchRdvEnAttenteCount } from '@/lib/rdv-en-attente'
import { reduitMouvement } from '@/lib/motion'

const LS_KEY = 'kapolia-sidebar-repliee'

// ─── NAV ──────────────────────────────────────────────────────────────────────

type NavItem    = { kind: 'item'; id: string; label: string; href: string; exact: boolean }
type NavGroup   = { kind: 'group'; title: string }
type NavDivider = { kind: 'divider' }
type NavEntry   = NavItem | NavGroup | NavDivider

const NAV: NavEntry[] = [
  { kind: 'item',    id: 'dashboard',    label: 'Tableau de bord',    href: '/dashboard',               exact: true  },
  { kind: 'group',   title: 'Ma recherche' },
  { kind: 'item',    id: 'offres',       label: 'Offres',             href: '/offres',                  exact: false },
  { kind: 'item',    id: 'favoris',      label: 'Favoris',            href: '/favoris',                 exact: true  },
  { kind: 'item',    id: 'candidatures', label: 'Candidatures',       href: '/candidatures',            exact: false },
  { kind: 'group',   title: 'Mes échanges' },
  { kind: 'item',    id: 'messages',     label: 'Messages',           href: '/dashboard/messages',      exact: true  },
  { kind: 'item',    id: 'rendez-vous',  label: 'Rendez-vous',        href: '/dashboard/rendez-vous',   exact: false },
  { kind: 'divider' },
  { kind: 'item',    id: 'profil',       label: 'Mon profil',         href: '/profil',                  exact: false },
]

// ─── Icons ────────────────────────────────────────────────────────────────────

function NavIcon({ id, active }: { id: string; active: boolean }) {
  const s = active ? C.terracotta : 'rgba(255,255,255,0.65)'
  const p = {
    width: 20, height: 20, viewBox: '0 0 24 24',
    fill: 'none' as const, stroke: s,
    strokeWidth: '1.8', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  switch (id) {
    case 'dashboard':
      return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
    case 'offres':
      return <svg {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
    case 'candidatures':
      return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
    case 'messages':
      return <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
    case 'profil':
      return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
    case 'favoris':
      return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
    case 'rendez-vous':
      return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
    default:
      return null
  }
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ count, corner, exiting }: { count: number; corner?: boolean; exiting?: boolean }) {
  if (count <= 0 && !exiting) return null
  return (
    <span style={{
      ...(corner ? {
        position: 'absolute' as const,
        top: 6, right: 6,
      } : {
        marginLeft: 'auto',
      }),
      minWidth: 16, height: 16, padding: '0 3px',
      backgroundColor: C.terracotta, color: C.white,
      borderRadius: 8, fontSize: 9, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      lineHeight: 1, boxSizing: 'border-box' as const,
      flexShrink: 0,
      animation: exiting
        ? 'kapolia-motion-badge-exit 250ms ease forwards'
        : 'kapolia-motion-badge-pop 450ms cubic-bezier(0.3, 1.6, 0.5, 1) both',
    }}>
      {count > 9 ? '9+' : count}
    </span>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ label, visible }: { label: string; visible: boolean }) {
  if (!visible) return null
  return (
    <div style={{
      position: 'absolute',
      left: 52, top: '50%', transform: 'translateY(-50%)',
      backgroundColor: C.dark, color: C.white,
      fontSize: 12, fontWeight: 500,
      padding: '5px 10px', borderRadius: 8,
      whiteSpace: 'nowrap' as const, zIndex: 200,
      pointerEvents: 'none' as const,
      boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
    }}>
      {label}
    </div>
  )
}

// ─── Menu button ──────────────────────────────────────────────────────────────

function MenuBtn({ label, onClick, danger = false, notif = false }: {
  label: string; onClick: () => void; danger?: boolean; notif?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', textAlign: 'left',
        padding: '9px 12px', border: 'none', borderRadius: 8,
        backgroundColor: hov ? (danger ? '#FDECEA' : C.bg) : 'transparent',
        color: danger ? C.erreur : C.dark,
        fontSize: 13, fontWeight: notif ? 600 : 500,
        cursor: 'pointer', transition: 'background-color 0.12s', fontFamily: 'inherit',
      }}
    >
      {notif && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          backgroundColor: C.terracotta, flexShrink: 0,
        }} />
      )}
      {label}
    </button>
  )
}

// ─── Nav item (collapsed) ─────────────────────────────────────────────────────

function CollapsedItem({ item, active, badge, badgeExiting }: { item: NavItem; active: boolean; badge?: number; badgeExiting?: boolean }) {
  const router = useRouter()
  const [hov, setHov] = useState(false)

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <button
        onClick={() => router.push(item.href)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          width: 44, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 12,
          backgroundColor: active ? 'rgba(194, 97, 31,0.18)' : hov ? 'rgba(255,255,255,0.07)' : 'transparent',
          border: 'none', cursor: 'pointer',
          transition: 'background-color 0.15s',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <NavIcon id={item.id} active={active} />
        {(badge !== undefined && badge > 0 || badgeExiting) && <Badge count={badge ?? 0} corner exiting={badgeExiting} />}
      </button>
      <Tooltip label={item.label} visible={hov} />
    </div>
  )
}

// ─── Nav item (expanded) ──────────────────────────────────────────────────────

function ExpandedItem({ item, active, badge, badgeExiting, btnRef }: {
  item: NavItem; active: boolean; badge?: number; badgeExiting?: boolean;
  btnRef?: (el: HTMLButtonElement | null) => void
}) {
  const router = useRouter()
  const [hov, setHov] = useState(false)

  return (
    <button
      ref={btnRef}
      onClick={() => router.push(item.href)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', height: 40,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 12px', borderRadius: 12, border: 'none',
        backgroundColor: hov ? 'rgba(255,255,255,0.07)' : 'transparent',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
        fontFamily: 'inherit',
        flexShrink: 0,
        position: 'relative', zIndex: 1,
      }}
    >
      <NavIcon id={item.id} active={active} />
      <span style={{
        fontSize: 13.5, fontWeight: 500,
        color: active ? C.terracotta : 'rgba(255,255,255,0.75)',
        flex: 1, textAlign: 'left', whiteSpace: 'nowrap' as const,
        overflow: 'hidden', textOverflow: 'ellipsis',
        transition: 'color 200ms ease',
      }}>
        {item.label}
      </span>
      {(badge !== undefined && badge > 0 || badgeExiting) && <Badge count={badge ?? 0} exiting={badgeExiting} />}
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CandidatSidebar({
  prenom,
  nom,
  avatarUrl,
  avatarType,
}: {
  initials: string  // reçu de Navigation.tsx, non utilisé ici
  prenom: string
  nom?: string
  avatarUrl?: string
  avatarType?: string
}) {
  const pathname = usePathname()
  const router   = useRouter()

  const [repliee,   setRepliee]   = useState(false)
  const [liveAvatar, setLiveAvatar] = useState({
    avatar_url: avatarUrl, avatar_type: avatarType, prenom, nom,
  })
  const [msgCount,        setMsgCount]        = useState<number | undefined>(undefined)
  const [rdvCount,        setRdvCount]        = useState<number | undefined>(undefined)
  const [rdvBadgeExiting, setRdvBadgeExiting] = useState(false)
  const rdvCountRef       = useRef<number | undefined>(undefined)
  const badgeExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hasNotif, setHasNotif] = useState(false)
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [menuHov,      setMenuHov]      = useState(false)
  const [asideHovered, setAsideHovered] = useState(false)
  const [toggleHovered, setToggleHovered] = useState(false)
  const menuRef     = useRef<HTMLDivElement>(null)
  const navRef      = useRef<HTMLElement>(null)
  const navItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [pillStyle, setPillStyle] = useState<{ top: number; height: number } | null>(null)

  // ── Init collapsed state ───────────────────────────────────────────────────
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_KEY) === 'true'
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRepliee(v)
    } catch {}
  }, [])

  // ── Close menu on outside click ────────────────────────────────────────────
  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  // ── Messages non lus (realtime) ────────────────────────────────────────────
  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null

    async function fetchMsgs(uid: string) {
      const { data } = await supabase
        .from('conversations')
        .select('non_lu_candidat')
        .eq('candidat_id', uid)
        .eq('masquee_candidat', false)
      const total = (data ?? []).reduce(
        (s: number, r: { non_lu_candidat: number | null }) => s + (r.non_lu_candidat ?? 0),
        0
      )
      setMsgCount(total)
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const uid = user.id
      fetchMsgs(uid)
      ch = supabase
        .channel(`sidebar-cand-convs-${uid}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `candidat_id=eq.${uid}` },
          () => fetchMsgs(uid)
        )
        .subscribe()
    })

    return () => { if (ch) supabase.removeChannel(ch) }
  }, [])

  // ── Rendez-vous en attente — recalcul à chaque page ────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      fetchRdvEnAttenteCount(user.id).then(setRdvCount)
    })
  }, [pathname])

  useEffect(() => { rdvCountRef.current = rdvCount }, [rdvCount])

  // ── Recalcul immédiat après confirmation d'un créneau ─────────────────────
  useEffect(() => {
    function onRdvConfirme() {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        fetchRdvEnAttenteCount(user.id).then(newCount => {
          const prev = rdvCountRef.current ?? 0
          const next = newCount ?? 0
          if (prev > 0 && next === 0 && !reduitMouvement()) {
            if (badgeExitTimerRef.current) clearTimeout(badgeExitTimerRef.current)
            setRdvBadgeExiting(true)
            badgeExitTimerRef.current = setTimeout(() => {
              setRdvBadgeExiting(false)
              setRdvCount(0)
            }, 250)
          } else {
            setRdvCount(newCount)
          }
        })
      })
    }
    window.addEventListener('rdv-confirme', onRdvConfirme)
    return () => window.removeEventListener('rdv-confirme', onRdvConfirme)
  }, [])

  // ── Notifications proche ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', 'reponse_proche')
        .is('read_at', null)
        .then(({ count, error }) => {
          if (!error) setHasNotif((count ?? 0) > 0)
        })
    })
  }, [])

  useEffect(() => {
    function onRead() { setHasNotif(false) }
    window.addEventListener('kapolia:notif-read', onRead)
    return () => window.removeEventListener('kapolia:notif-read', onRead)
  }, [])

  // ── Profil live (rafraîchi à chaque navigation) ───────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('profils')
        .select('avatar_url, avatar_type, prenom, nom')
        .eq('user_id', user.id)
        .single()
      if (data) {
        setLiveAvatar({
          avatar_url:  data.avatar_url  ?? undefined,
          avatar_type: data.avatar_type ?? undefined,
          prenom:      data.prenom      ?? prenom,
          nom:         data.nom         ?? nom,
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // ── Sliding active-nav pill ───────────────────────────────────────────────
  const remeasureRef = useRef<() => void>(() => {})

  useEffect(() => {
    function measure() {
      const activeItem = repliee
        ? null
        : (NAV.find(e => e.kind === 'item' && isActive(e as NavItem)) as NavItem | undefined) ?? null
      if (!activeItem) {
        setPillStyle(null)
        return
      }
      const btn = navItemRefs.current.get(activeItem.id)
      const nav = navRef.current
      if (!btn || !nav) {
        setPillStyle(null)
        return
      }
      setPillStyle({ top: btn.offsetTop, height: btn.offsetHeight })
    }
    measure()
    remeasureRef.current = measure
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, repliee])

  // Remesure après chargement des polices
  useEffect(() => {
    document.fonts.ready.then(() => remeasureRef.current())
  }, [])

  // Remesure quand le nav change de taille (transition de repli incluse)
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const ro = new ResizeObserver(() => remeasureRef.current())
    ro.observe(nav)
    return () => ro.disconnect()
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────
  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  function getBadge(id: string): number | undefined {
    if (id === 'messages')    return msgCount
    if (id === 'rendez-vous') return rdvCount
    return undefined
  }

  function toggle() {
    const next = !repliee
    setRepliee(next)
    setMenuOpen(false)
    setTimeout(() => remeasureRef.current(), 340)
    try {
      localStorage.setItem(LS_KEY, String(next))
      document.documentElement.style.setProperty('--kapolia-sidebar-w', next ? '64px' : '228px')
      document.documentElement.style.setProperty('--kapolia-sidebar-aside-w', next ? '70px' : '228px')
    } catch {}
  }

  async function signOut() {
    setMenuOpen(false)
    await supabase.auth.signOut()
    router.replace('/')
  }

  // ── Avatar profil actif ───────────────────────────────────────────────────
  const avatarProfil = {
    prenom:     liveAvatar.prenom      ?? prenom,
    nom:        liveAvatar.nom         ?? nom,
    avatar_url: liveAvatar.avatar_url  ?? avatarUrl,
    avatar_type: liveAvatar.avatar_type ?? avatarType,
  }

  const displayName = [avatarProfil.prenom, avatarProfil.nom].filter(Boolean).join(' ') || 'Mon compte'

  // ── Menu dropdown ─────────────────────────────────────────────────────────
  const menuDropdown = menuOpen ? (
    <div style={{
      position: 'absolute',
      bottom: 'calc(100% + 10px)', left: 0,
      backgroundColor: C.white,
      border: `1px solid ${C.sable}`,
      borderRadius: 14, padding: 6,
      minWidth: 200,
      boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      zIndex: 200,
      animation: 'kapolia-up 0.13s ease',
    }}>
      <style suppressHydrationWarning>{`
        @keyframes kapolia-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {hasNotif && (
        <MenuBtn
          label="Qualités reçues"
          notif
          onClick={() => {
            window.dispatchEvent(new Event('kapolia:notif-read'))
            setMenuOpen(false)
            router.push('/profil?edit=true')
          }}
        />
      )}
      <MenuBtn label="Paramètres" onClick={() => { setMenuOpen(false); router.push('/parametres') }} />
      <div style={{ height: 1, backgroundColor: C.sable, margin: '4px 0' }} />
      <MenuBtn label="Se déconnecter" onClick={signOut} danger />
    </div>
  ) : null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <aside
        onMouseEnter={() => setAsideHovered(true)}
        onMouseLeave={() => setAsideHovered(false)}
        style={{
          position: 'fixed', left: 0, top: 0, bottom: 0,
          width: 'var(--kapolia-sidebar-aside-w)',
          backgroundColor: C.vert,
          display: 'flex', flexDirection: 'column',
          zIndex: 40,
          overflow: 'hidden',
          padding: repliee ? '0' : '0 14px',
          transition: 'width 320ms cubic-bezier(0.2, 0.8, 0.2, 1), padding 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >

        {/* ── Header (logo) ──────────────────────────────────────────────── */}
        <div
          onClick={() => router.push('/dashboard')}
          style={{
            height: 64,
            display: 'flex', alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
            paddingLeft: repliee ? 0 : 6,
            justifyContent: repliee ? 'center' : 'flex-start',
            gap: 10,
            cursor: 'pointer',
          }}
        >
          <LogoKapolia variante="contour" avecTexte={false} taille={36} />
          {!repliee && (
            <span style={{
              fontFamily: FONT_LOGO, letterSpacing: '-0.005em',
              fontSize: 22, fontWeight: 600,
              color: C.sable,
              whiteSpace: 'nowrap' as const,
              userSelect: 'none' as const,
            }}>
              Kapolia
            </span>
          )}
        </div>

        {/* ── Nav ──────────────────────────────────────────────────────────── */}
        <nav ref={navRef} style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 0',
          display: 'flex', flexDirection: 'column',
          gap: repliee ? 4 : 2,
          alignItems: repliee ? 'center' : 'stretch',
          position: 'relative',
        }}>
          {/* Sliding active indicator pill */}
          {pillStyle && !repliee && (
            <div style={{
              position: 'absolute',
              left: 0, right: 0,
              top: pillStyle.top,
              height: pillStyle.height,
              borderRadius: 12,
              backgroundColor: 'rgba(194, 97, 31,0.18)',
              transition: 'top 340ms cubic-bezier(0.2, 0.8, 0.2, 1), height 340ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              pointerEvents: 'none',
              zIndex: 0,
            }} />
          )}
          {NAV.map((entry, i) => {
            if (entry.kind === 'group') {
              if (repliee) {
                return (
                  <div key={i} style={{
                    width: 28, height: 1,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    margin: '6px 0',
                  }} />
                )
              }
              return (
                <div key={i} style={{
                  fontSize: 11.5, fontWeight: 400,
                  color: 'rgba(255,255,255,0.45)',
                  padding: '14px 12px 6px',
                }}>
                  {entry.title}
                </div>
              )
            }
            if (entry.kind === 'divider') {
              return (
                <div key={i} style={{
                  height: 1,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  margin: repliee ? '6px 0' : '6px 12px',
                }} />
              )
            }
            const active = isActive(entry)
            const badge  = getBadge(entry.id)
            if (repliee) {
              return <CollapsedItem key={entry.id} item={entry} active={active} badge={badge} badgeExiting={rdvBadgeExiting && entry.id === 'rendez-vous'} />
            }
            return (
              <ExpandedItem
                key={entry.id}
                item={entry}
                active={active}
                badge={badge}
                badgeExiting={rdvBadgeExiting && entry.id === 'rendez-vous'}
                btnRef={el => {
                  if (el) navItemRefs.current.set(entry.id, el)
                  else navItemRefs.current.delete(entry.id)
                }}
              />
            )
          })}
        </nav>

        {/* ── Footer (avatar) ───────────────────────────────────────────────── */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '12px 0 16px',
          flexShrink: 0,
          display: 'flex',
          justifyContent: repliee ? 'center' : 'stretch',
        }}>
          <div ref={menuRef} style={{ position: 'relative', width: repliee ? 'auto' : '100%' }}>
            {repliee ? (
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  onMouseEnter={() => setMenuHov(true)}
                  onMouseLeave={() => setMenuHov(false)}
                  style={{
                    background: pathname === '/parametres' ? 'rgba(194, 97, 31,0.18)' : 'none',
                    border: pathname === '/parametres' ? 'none' : (menuOpen ? '2px solid rgba(255,255,255,0.4)' : '2px solid transparent'),
                    borderRadius: '50%', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background-color 0.15s, border-color 0.15s',
                  }}
                >
                  <Avatar profil={avatarProfil} size="sm" />
                </button>
                {menuHov && !menuOpen && (
                  <div style={{
                    position: 'absolute', left: 48, top: '50%', transform: 'translateY(-50%)',
                    backgroundColor: C.dark, color: C.white,
                    fontSize: 12, fontWeight: 500, padding: '5px 10px', borderRadius: 8,
                    whiteSpace: 'nowrap' as const, zIndex: 200, pointerEvents: 'none' as const,
                  }}>
                    {displayName}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setMenuOpen(o => !o)}
                onMouseEnter={() => setMenuHov(true)}
                onMouseLeave={() => setMenuHov(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', background: 'none', border: 'none',
                  padding: '8px 10px', cursor: 'pointer', borderRadius: 12,
                  backgroundColor: pathname === '/parametres' ? 'rgba(194, 97, 31,0.18)' : menuHov ? 'rgba(255,255,255,0.07)' : 'transparent',
                  transition: 'background-color 0.12s',
                  fontFamily: 'inherit',
                }}
              >
                <Avatar profil={avatarProfil} size="sm" />
                <span style={{
                  fontSize: 13, fontWeight: 600, color: C.white,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
                  flex: 1, textAlign: 'left',
                }}>
                  {displayName}
                </span>
              </button>
            )}
            {menuDropdown}
          </div>
        </div>
      </aside>

      {/* ── Bouton de repli — posé à cheval sur le bord droit ─────────────── */}
      <style suppressHydrationWarning>{`#kapolia-toggle-btn:focus-visible { opacity: 1 !important; }`}</style>
      <button
        id="kapolia-toggle-btn"
        onClick={toggle}
        onMouseEnter={() => setToggleHovered(true)}
        onMouseLeave={() => setToggleHovered(false)}
        style={{
          position: 'fixed',
          left: 'calc(var(--kapolia-sidebar-aside-w) - 13px)',
          top: 20,
          width: 26, height: 26, borderRadius: '50%',
          backgroundColor: C.white,
          boxShadow: CARD_SHADOW,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
          opacity: asideHovered || toggleHovered ? 1 : 0,
          transform: toggleHovered ? 'scale(1.08)' : 'scale(1)',
          transition: 'left 320ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease, transform 150ms ease',
        }}
        aria-label={repliee ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
      >
        <svg
          width="12" height="12" viewBox="0 0 12 12"
          fill="none" stroke={C.vert} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{
            transform: repliee ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          <path d="M8 2L4 6l4 4" />
        </svg>
      </button>
    </>
  )
}
