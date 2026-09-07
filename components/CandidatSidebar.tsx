'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Avatar from '@/components/Avatar'
import { useFavoris } from '@/lib/favoris-context'
import LogoKapolia from '@/components/LogoKapolia'

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  vert:       '#2C4A3E',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  white:      '#FFFFFF',
}

export const SIDEBAR_WIDTH = 64

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',     href: '/dashboard',          exact: true  },
  { id: 'offres',       label: 'Offres',         href: '/offres',             exact: false },
  { id: 'favoris',      label: 'Favoris',        href: '/favoris',            exact: true  },
  { id: 'candidatures', label: 'Candidatures',   href: '/candidatures',       exact: false },
  { id: 'messages',     label: 'Messages',       href: '/dashboard/messages', exact: true  },
  { id: 'profil',       label: 'Profil',         href: '/profil',             exact: false },
  { id: 'parametres',   label: 'Paramètres',     href: '/parametres',         exact: false },
]

function NavIcon({ id, active }: { id: string; active: boolean }) {
  const s = active ? C.terracotta : C.grey
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
    case 'parametres':
      return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
    default: return null
  }
}

function SidebarNavItem({ item, active, badge }: { item: typeof NAV[number]; active: boolean; badge?: number }) {
  const router  = useRouter()
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
          backgroundColor: active ? `${C.terracotta}18` : hov ? `${C.dark}07` : 'transparent',
          border: 'none', cursor: 'pointer',
          transition: 'background-color 0.15s',
          position: 'relative',
        }}
      >
        <NavIcon id={item.id} active={active} />
        {badge !== undefined && badge > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            minWidth: 16, height: 16, padding: '0 3px',
            backgroundColor: C.terracotta, color: C.white,
            borderRadius: 8, fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, boxSizing: 'border-box',
          }}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {hov && (
        <div style={{
          position: 'absolute',
          left: 52, top: '50%', transform: 'translateY(-50%)',
          backgroundColor: C.dark, color: C.white,
          fontSize: 12, fontWeight: 500,
          padding: '5px 10px', borderRadius: 8,
          whiteSpace: 'nowrap', zIndex: 200,
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        }}>
          {item.label}
        </div>
      )}
    </div>
  )
}

function AvatarMenu({ initials, prenom, nom, avatarUrl, avatarType }: { initials: string; prenom: string; nom?: string; avatarUrl?: string; avatarType?: string }) {
  const router  = useRouter()
  const [open, setOpen] = useState(false)
  const [hov, setHov]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  async function signOut() {
    setOpen(false)
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        title={prenom || 'Mon compte'}
        style={{
          background: 'none',
          border: open ? `2px solid ${C.dark}` : '2px solid transparent',
          borderRadius: '50%', cursor: 'pointer', outline: 'none', padding: 0,
          transition: 'border-color 0.15s', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Avatar
          profil={{ prenom, nom, avatar_url: avatarUrl, avatar_type: avatarType }}
          size="sm"
        />
      </button>

      {!open && hov && (
        <div style={{
          position: 'absolute',
          left: 48, top: '50%', transform: 'translateY(-50%)',
          backgroundColor: C.dark, color: C.white,
          fontSize: 12, fontWeight: 500,
          padding: '5px 10px', borderRadius: 8,
          whiteSpace: 'nowrap', zIndex: 200,
          pointerEvents: 'none',
        }}>
          {prenom || 'Mon compte'}
        </div>
      )}

      {open && (
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
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.sable}`, marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{prenom || 'Mon compte'}</div>
            <div style={{ fontSize: 11, color: C.grey, marginTop: 2 }}>Candidat</div>
          </div>
          <MenuBtn label="Mon profil"      onClick={() => { setOpen(false); router.push('/profil') }} />
          <MenuBtn label="Paramètres"      onClick={() => { setOpen(false); router.push('/parametres') }} />
          <div style={{ height: 1, backgroundColor: C.sable, margin: '4px 0' }} />
          <MenuBtn label="Se déconnecter" onClick={signOut} danger />
        </div>
      )}
    </div>
  )
}

function MenuBtn({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '9px 12px', border: 'none', borderRadius: 8,
        backgroundColor: hov ? (danger ? '#FDECEA' : C.creme) : 'transparent',
        color: danger ? '#C0392B' : C.dark,
        fontSize: 13, fontWeight: 500, cursor: 'pointer',
        transition: 'background-color 0.12s', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

export default function CandidatSidebar({
  initials,
  prenom,
  nom,
  avatarUrl,
  avatarType,
}: {
  initials: string
  prenom: string
  nom?: string
  avatarUrl?: string
  avatarType?: string
}) {
  const pathname = usePathname()

  const [liveAvatar, setLiveAvatar] = useState<{
    avatar_url?: string; avatar_type?: string; prenom?: string; nom?: string
  }>({ prenom, nom, avatar_url: avatarUrl, avatar_type: avatarType })

  const { favIds, loaded: favsLoaded } = useFavoris()
  const favCount = favsLoaded ? favIds.size : undefined

  const [msgCount, setMsgCount] = useState<number | undefined>(undefined)

  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null

    async function fetchMsgTotal(uid: string) {
      const { data } = await supabase
        .from('conversations')
        .select('non_lu_candidat')
        .eq('candidat_id', uid)
        .eq('masquee_candidat', false)
      const total = (data ?? []).reduce((s: number, r: { non_lu_candidat: number | null }) => s + (r.non_lu_candidat ?? 0), 0)
      setMsgCount(total)
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const uid = user.id
      fetchMsgTotal(uid)
      ch = supabase
        .channel(`sidebar-cand-convs-${uid}-${Date.now()}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `candidat_id=eq.${uid}` },
          () => fetchMsgTotal(uid))
        .subscribe()
    })

    return () => { if (ch) supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profils')
        .select('avatar_url, avatar_type, prenom, nom')
        .eq('user_id', user.id)
        .single()
      if (data) setLiveAvatar({
        avatar_url:  data.avatar_url  ?? undefined,
        avatar_type: data.avatar_type ?? undefined,
        prenom:      data.prenom      ?? prenom,
        nom:         data.nom         ?? nom,
      })
    }
    fetchProfile()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  function isActive(item: typeof NAV[number]) {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0,
      width: SIDEBAR_WIDTH, height: '100vh',
      backgroundColor: C.white,
      borderRight: `1px solid ${C.sable}`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      zIndex: 40,
    }}>
      {/* Logo */}
      <div style={{
        height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: `1px solid ${C.sable}`, width: '100%', flexShrink: 0,
      }}>
        <LogoKapolia variante="sombre" avecTexte={false} taille={36} />
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 0', width: '100%', alignItems: 'center' }}>
        {NAV.map(item => (
          <SidebarNavItem
            key={item.id}
            item={item}
            active={isActive(item)}
            badge={item.id === 'favoris' ? favCount : item.id === 'messages' ? msgCount : undefined}
          />
        ))}
      </nav>

      {/* Avatar bottom */}
      <div style={{ padding: '12px 0 16px', borderTop: `1px solid ${C.sable}`, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <AvatarMenu
          initials={initials}
          prenom={liveAvatar.prenom ?? prenom}
          nom={liveAvatar.nom ?? nom}
          avatarUrl={liveAvatar.avatar_url ?? avatarUrl}
          avatarType={liveAvatar.avatar_type ?? avatarType}
        />
      </div>
    </aside>
  )
}
