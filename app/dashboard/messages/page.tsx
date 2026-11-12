'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import type { KeyboardEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import GlobalAvatar, { type AvatarProfil } from '@/components/Avatar'
import RdvBubble from '@/components/RdvBubble'
import { sanitizeFilename } from '@/lib/storage-utils'
import { C } from '@/lib/colors'

const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','webp','bmp','svg'])
const MAX_BYTES  = 10 * 1024 * 1024

function isImage(nom: string) {
  return IMAGE_EXTS.has(nom.split('.').pop()?.toLowerCase() ?? '')
}

function msgDate(isoStr: string): string {
  const d = new Date(isoStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} o`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`
  return `${(b / 1024 / 1024).toFixed(1)} Mo`
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ReplyRef = { id: string; contenu: string; fromMe: boolean }

type LocalConv = {
  id: string; recruteurId?: string
  nom: string; initiales: string; avatarBg: string
  entreprise: string; offreTitre: string; offreId?: string
  dernierMsg: string; derniereHeure: string
  nonLu: number
}

type LocalMsg = {
  id: string; fromMe: boolean; contenu: string; heure: string; lu: boolean
  date?: string
  pjUrl?: string; pjNom?: string; pjType?: string
  replyToId?: string; replyToContenu?: string
  rendezVousId?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowHeure() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function initEntreprise(nom: string): string {
  if (!nom) return '?'
  const words = nom.trim().split(/\s+/)
  if (words.length === 1) return nom.slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// ─── ConvAvatar ───────────────────────────────────────────────────────────────

function ConvAvatar({ i, bg, s = 38 }: { i: string; bg: string; s?: number }) {
  return (
    <div style={{ width: s, height: s, borderRadius: '50%', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: s * 0.33, color: C.white, flexShrink: 0 }}>
      {i}
    </div>
  )
}

// ─── Double checkmarks ────────────────────────────────────────────────────────

function Checks({ lu }: { lu: boolean }) {
  const col = lu ? C.terracotta : C.grey
  const lineStyle = { stroke: col, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  return (
    <svg width="18" height="11" viewBox="0 0 18 11" style={{ flexShrink: 0, overflow: 'visible' }}>
      <polyline points="1,6 4,9 9,2"  style={lineStyle} />
      <polyline points="6,6 9,9 14,2" style={lineStyle} />
    </svg>
  )
}

// ─── File bubble ──────────────────────────────────────────────────────────────

function FileBubble({ nom, url, type, fromMe: _fromMe }: { nom: string; url?: string; type?: string; fromMe: boolean }) {
  if ((type === 'image' || isImage(nom)) && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block', maxWidth: 220, borderRadius: 12, overflow: 'hidden' }}>
        <img src={url} alt={nom} style={{ width: '100%', display: 'block' }} />
      </a>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, backgroundColor: C.white, border: `1px solid ${C.sable}`, textDecoration: 'none', maxWidth: 260, cursor: url ? 'pointer' : 'default' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span style={{ fontSize: 12, color: C.dark, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</span>
      {url && <span style={{ fontSize: 11, color: C.terracotta, fontWeight: 600, flexShrink: 0 }}>Télécharger</span>}
    </a>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ nom }: { nom: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 8px' }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: C.grey, animation: `kapolia-bounce 1.2s ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <span style={{ fontSize: 12, color: C.grey, fontStyle: 'italic' }}>{nom} est en train d&apos;écrire…</span>
    </div>
  )
}

// ─── Action btn (hover) ───────────────────────────────────────────────────────

function ActionBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width: 26, height: 26, borderRadius: 8, border: 'none', backgroundColor: h ? C.sable : C.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </button>
  )
}

// ─── Reply preview bar ────────────────────────────────────────────────────────

function ReplyBar({ reply, nom, onCancel }: { reply: ReplyRef; nom: string; onCancel: () => void }) {
  return (
    <div style={{ padding: '8px 14px', borderTop: `1px solid ${C.sable}`, borderLeft: `3px solid ${C.terracotta}`, backgroundColor: `${C.terracotta}08`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: C.terracotta, fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="9 14 4 9 9 4" />
            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
          </svg>
          Répondre à {reply.fromMe ? 'votre message' : nom}
        </div>
        <div style={{ fontSize: 12, color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {reply.contenu || 'Pièce jointe'}
        </div>
      </div>
      <button onClick={onCancel} style={{ border: 'none', backgroundColor: 'transparent', color: C.grey, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 280 }}>
        <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 20, color: C.dark, marginBottom: 8 }}>Aucun message pour le moment</div>
        <div style={{ fontSize: 14, color: C.grey, marginBottom: 24, lineHeight: 1.6 }}>Les recruteurs intéressés par votre profil vous contacteront ici.</div>
        <button onClick={onBrowse} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', backgroundColor: C.terracotta, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Découvrir les offres
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CandidatMessagesPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [userProfil, setUserProfil]   = useState<AvatarProfil>({})
  const [convs, setConvs]             = useState<LocalConv[]>([])
  const [activeId, setActiveId]       = useState('')
  const [msgCache, setMsgCache]       = useState<Record<string, LocalMsg[]>>({})
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [input, setInput]             = useState('')
  const [sending, setSending]         = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [pendingFile, setPendingFile] = useState<{ file: File; nom: string; type: string; preview?: string } | null>(null)
  const [hovMsgId, setHovMsgId]       = useState<string | null>(null)
  const [isTyping, setIsTyping]       = useState(false)
  const [replyingTo, setReplyingTo]   = useState<ReplyRef | null>(null)
  const [sendErr, setSendErr]         = useState<string | null>(null)

  const endRef           = useRef<HTMLDivElement>(null)
  const textaRef         = useRef<HTMLTextAreaElement>(null)
  const fileRef          = useRef<HTMLInputElement>(null)
  const userIdRef        = useRef<string | null>(null)
  const realtimeRef      = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const realtimeConvsRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimer      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingRef    = useRef<number>(0)
  const activeIdRef      = useRef<string>('')

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userIdRef.current = user.id

      const { data: profilData } = await supabase
        .from('profils')
        .select('prenom, nom, avatar_url, avatar_type')
        .eq('user_id', user.id)
        .single()
      if (profilData) setUserProfil(profilData as AvatarProfil)

      const { data: convsRaw, error } = await supabase
        .from('conversations')
        .select('id, recruteur_id, offre_id, dernier_message, derniere_activite, non_lu_candidat, offres(titre)')
        .eq('candidat_id', user.id)
        .eq('masquee_candidat', false)
        .order('derniere_activite', { ascending: false })

      if (error) { console.error('[messages init conversations]', error); setLoadingConvs(false); return }
      if (!convsRaw?.length) { setLoadingConvs(false); return }

      const recruteurIds = [...new Set(convsRaw.map(r => r.recruteur_id).filter(Boolean))]
      const { data: rData, error: rErr } = recruteurIds.length
        ? await supabase.from('profils_vue_publique').select('user_id, prenom, nom, entreprise_nom').in('user_id', recruteurIds)
        : { data: [] as { user_id: string; prenom?: string; nom?: string; entreprise_nom?: string | null }[], error: null }
      if (rErr) console.error('[messages init profils]', rErr)

      const profilMap: Record<string, { prenom?: string; nom?: string; entreprise_nom?: string | null }> = {}
      for (const r of (rData ?? [])) profilMap[r.user_id] = r

      const loaded: LocalConv[] = convsRaw.map(row => {
        const p          = profilMap[row.recruteur_id]
        const offre      = row.offres as { titre?: string } | null
        const entreprise = p?.entreprise_nom ?? ''
        const nom        = [p?.prenom, p?.nom].filter(Boolean).join(' ') || (entreprise ? '' : 'Recruteur inconnu')
        const displayKey = entreprise || nom
        return {
          id: row.id, recruteurId: row.recruteur_id,
          nom, initiales: initEntreprise(displayKey),
          avatarBg: '#4A7C6E', entreprise,
          offreTitre: offre?.titre ?? '',
          offreId: row.offre_id ?? undefined,
          dernierMsg: row.dernier_message ?? '',
          derniereHeure: row.derniere_activite
            ? new Date(row.derniere_activite).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
            : '',
          nonLu: row.non_lu_candidat ?? 0,
        }
      })
      setConvs(loaded)
      setLoadingConvs(false)

      // ── Realtime : conversations ──────────────────────────────────────
      if (realtimeConvsRef.current) {
        supabase.removeChannel(realtimeConvsRef.current)
        realtimeConvsRef.current = null
      }
      realtimeConvsRef.current = supabase
        .channel(`candidat-conversations-${user.id}`)
        .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'conversations', filter: `candidat_id=eq.${user.id}` },
          payload => {
            const { id: convId } = payload.old as { id: string }
            setConvs(prev => prev.filter(c => c.id !== convId))
            if (activeIdRef.current === convId) { setActiveId(''); activeIdRef.current = '' }
            setMsgCache(prev => { const n = { ...prev }; delete n[convId]; return n })
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `candidat_id=eq.${user.id}` },
          async payload => {
            const c = payload.new as { id: string; dernier_message?: string; derniere_activite?: string; non_lu_candidat?: number; masquee_candidat?: boolean; recruteur_id?: string; offre_id?: string }
            let convInList = false
            setConvs(prev => {
              if (!prev.some(conv => conv.id === c.id)) return prev
              convInList = true
              return prev.map(conv => conv.id !== c.id ? conv : {
                ...conv,
                dernierMsg:    c.dernier_message  ?? conv.dernierMsg,
                derniereHeure: c.derniere_activite
                  ? new Date(c.derniere_activite).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  : conv.derniereHeure,
                nonLu: c.id === activeIdRef.current ? 0 : (c.non_lu_candidat ?? conv.nonLu),
              })
            })
            if (!convInList && c.masquee_candidat === false && c.recruteur_id) {
              const [{ data: offre, error: rtOffreErr }, { data: profil, error: rtProfilErr }] = await Promise.all([
                c.offre_id
                  ? supabase.from('offres').select('titre').eq('id', c.offre_id).single()
                  : Promise.resolve({ data: null, error: null }),
                supabase.from('profils_vue_publique').select('prenom, nom, entreprise_nom').eq('user_id', c.recruteur_id).single(),
              ])
              if (rtOffreErr)  console.error('[messages realtime UPDATE offre]', rtOffreErr)
              if (rtProfilErr) console.error('[messages realtime UPDATE profil]', rtProfilErr)
              const p          = profil as { prenom?: string; nom?: string; entreprise_nom?: string | null } | null
              const o          = offre as { titre?: string } | null
              const entreprise = p?.entreprise_nom ?? ''
              const nom        = [p?.prenom, p?.nom].filter(Boolean).join(' ') || (entreprise ? '' : 'Recruteur inconnu')
              const displayKey = entreprise || nom
              const restored: LocalConv = {
                id: c.id, recruteurId: c.recruteur_id,
                nom, initiales: initEntreprise(displayKey),
                avatarBg: '#4A7C6E', entreprise,
                offreTitre: o?.titre ?? '',
                offreId: c.offre_id ?? undefined,
                dernierMsg: c.dernier_message ?? '',
                derniereHeure: c.derniere_activite
                  ? new Date(c.derniere_activite).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  : '',
                nonLu: c.non_lu_candidat ?? 0,
              }
              setConvs(prev => prev.some(x => x.id === c.id) ? prev : [restored, ...prev])
            }
          }
        )
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'conversations', filter: `candidat_id=eq.${user.id}` },
          async payload => {
            const row = payload.new as { id: string; recruteur_id: string; offre_id?: string; derniere_activite?: string; dernier_message?: string; non_lu_candidat?: number }
            const [{ data: offre, error: insOffreErr }, { data: profil, error: insProfilErr }] = await Promise.all([
              row.offre_id
                ? supabase.from('offres').select('titre').eq('id', row.offre_id).single()
                : Promise.resolve({ data: null, error: null }),
              supabase.from('profils_vue_publique').select('prenom, nom, entreprise_nom').eq('user_id', row.recruteur_id).single(),
            ])
            if (insOffreErr)  console.error('[messages realtime INSERT offre]', insOffreErr)
            if (insProfilErr) console.error('[messages realtime INSERT profil]', insProfilErr)
            const p          = profil as { prenom?: string; nom?: string; entreprise_nom?: string | null } | null
            const o          = offre as { titre?: string } | null
            const entreprise = p?.entreprise_nom ?? ''
            const nom        = [p?.prenom, p?.nom].filter(Boolean).join(' ') || (entreprise ? '' : 'Recruteur inconnu')
            const displayKey = entreprise || nom
            const newConv: LocalConv = {
              id: row.id, recruteurId: row.recruteur_id,
              nom, initiales: initEntreprise(displayKey),
              avatarBg: '#4A7C6E', entreprise,
              offreTitre: o?.titre ?? '',
              offreId: row.offre_id ?? undefined,
              dernierMsg: row.dernier_message ?? '',
              derniereHeure: row.derniere_activite
                ? new Date(row.derniere_activite).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : '',
              nonLu: row.non_lu_candidat ?? 0,
            }
            setConvs(prev => {
              if (prev.some(c => c.id === row.id)) return prev
              return [newConv, ...prev]
            })
          }
        )
        .subscribe()

      // Accès direct via ?conv=<id>
      const convParam = searchParams.get('conv')
      if (convParam && loaded.some(c => c.id === convParam)) {
        selectConv(convParam)
      }
    }
    init()
    return () => {
      if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null }
      if (realtimeConvsRef.current) { supabase.removeChannel(realtimeConvsRef.current); realtimeConvsRef.current = null }
      if (typingTimer.current) clearTimeout(typingTimer.current)
    }
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgCache, activeId])

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeConv  = convs.find(c => c.id === activeId) ?? null
  const activeMsgs  = msgCache[activeId] ?? []
  const totalUnread = convs.reduce((n, c) => n + c.nonLu, 0)

  // ── Realtime channel ──────────────────────────────────────────────────────

  function subscribeToConv(convId: string) {
    if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null }
    setIsTyping(false)
    if (!convId) return

    realtimeRef.current = supabase
      .channel(`conv-${convId}-${Date.now()}`)

      // ── Nouveaux messages ─────────────────────────────────────────────
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        payload => {
          const m = payload.new as {
            id: string; expediteur_id: string; contenu: string; created_at: string; lu: boolean
            piece_jointe_url?: string; piece_jointe_nom?: string; piece_jointe_type?: string
            reply_to_id?: string; rendez_vous_id?: string
          }
          if (m.expediteur_id === userIdRef.current) return
          const isActive = convId === activeIdRef.current
          setMsgCache(prev => ({
            ...prev,
            [convId]: [...(prev[convId] ?? []), {
              id: m.id, fromMe: false, lu: isActive, contenu: m.contenu,
              heure: new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              date: msgDate(m.created_at),
              pjUrl: m.piece_jointe_url, pjNom: m.piece_jointe_nom, pjType: m.piece_jointe_type,
              replyToId: m.reply_to_id, replyToContenu: undefined,
              rendezVousId: m.rendez_vous_id ?? undefined,
            }],
          }))
          setConvs(prev => prev.map(c =>
            c.id === convId ? { ...c, dernierMsg: m.contenu || (m.piece_jointe_nom ?? ''), ...(isActive ? {} : { nonLu: c.nonLu + 1 }) } : c
          ))
          if (isActive && userIdRef.current) {
            supabase.from('messages').update({ lu: true }).eq('id', m.id).then()
            supabase.from('conversations').update({ non_lu_candidat: 0 }).eq('id', convId).then()
          }
        }
      )

      // ── Lecture (flèches orange) ──────────────────────────────────────
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        payload => {
          const m = payload.new as { id: string; lu: boolean }
          setMsgCache(prev => {
            const msgs = prev[convId]
            if (!msgs) return prev
            return { ...prev, [convId]: msgs.map(msg => msg.id === m.id ? { ...msg, lu: m.lu } : msg) }
          })
        }
      )

      // ── Typing ────────────────────────────────────────────────────────
      .on('broadcast', { event: 'typing' }, () => {
        setIsTyping(true)
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setIsTyping(false), 3000)
      })
      .subscribe()
  }

  function sendTypingSignal() {
    if (!realtimeRef.current) return
    const now = Date.now()
    if (now - lastTypingRef.current < 1000) return
    lastTypingRef.current = now
    realtimeRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: userIdRef.current } }).catch(() => {})
  }

  // ── Select conversation ────────────────────────────────────────────────────

  async function selectConv(id: string) {
    setActiveId(id); activeIdRef.current = id; setReplyingTo(null)
    setConvs(prev => prev.map(c => c.id === id ? { ...c, nonLu: 0 } : c))
    subscribeToConv(id)

    const { data } = await supabase
      .from('messages')
      .select('*, reply:reply_to_id(id, contenu)')
      .eq('conversation_id', id)
      .order('created_at')

    if (data?.length) {
      setMsgCache(prev => ({
        ...prev,
        [id]: data.map(m => ({
          id: m.id,
          fromMe: m.expediteur_id === userIdRef.current,
          lu: m.lu ?? false,
          contenu: m.contenu,
          heure: new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          date: msgDate(m.created_at),
          pjUrl: m.piece_jointe_url, pjNom: m.piece_jointe_nom, pjType: m.piece_jointe_type,
          replyToId: m.reply_to_id,
          replyToContenu: (m.reply as { contenu?: string } | null)?.contenu,
          rendezVousId: (m as { rendez_vous_id?: string }).rendez_vous_id ?? undefined,
        })),
      }))
    }

    if (userIdRef.current) {
      await supabase
        .from('messages')
        .update({ lu: true })
        .eq('conversation_id', id)
        .neq('expediteur_id', userIdRef.current)
    }
    supabase.from('conversations').update({ non_lu_candidat: 0 }).eq('id', id).then()
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function send(contenu: string) {
    const pf = pendingFile
    if (!contenu.trim() && !pf) return
    if (!activeConv) return

    const heure     = nowHeure()
    const tmpId     = `tmp-${Date.now()}`
    const replySnap = replyingTo

    const msg: LocalMsg = {
      id: tmpId, fromMe: true, lu: false, contenu: contenu.trim(), heure,
      date: msgDate(new Date().toISOString()),
      pjNom: pf?.nom, pjUrl: undefined, pjType: pf?.type,
      replyToId: replySnap?.id, replyToContenu: replySnap?.contenu,
    }
    setMsgCache(prev => ({ ...prev, [activeId]: [...(prev[activeId] ?? []), msg] }))
    setConvs(prev => prev.map(c => c.id === activeId ? { ...c, dernierMsg: contenu.trim() || (pf?.nom ?? ''), derniereHeure: heure } : c))
    setInput(''); setReplyingTo(null)
    if (textaRef.current) textaRef.current.style.height = 'auto'
    if (pf?.preview) { setPendingFile(null); URL.revokeObjectURL(pf.preview) } else { setPendingFile(null) }

    let pjNom: string | undefined
    let pjUrl: string | undefined
    let pjType: string | undefined

    if (pf && userIdRef.current && activeId) {
      setUploading(true)
      const path = `${activeId}/${Date.now()}-${sanitizeFilename(pf.nom)}`
      const { error } = await supabase.storage.from('pieces-jointes').upload(path, pf.file)
      if (error) {
        setSendErr("Le fichier n'a pas pu être envoyé. Réessayez.")
        setUploading(false)
        setMsgCache(prev => ({ ...prev, [activeId]: (prev[activeId] ?? []).filter(m => m.id !== tmpId) }))
        return
      }
      pjUrl  = supabase.storage.from('pieces-jointes').getPublicUrl(path).data.publicUrl
      pjNom  = pf.nom
      pjType = pf.type
      setUploading(false)
      setMsgCache(prev => ({ ...prev, [activeId]: (prev[activeId] ?? []).map(m => m.id === tmpId ? { ...m, pjUrl } : m) }))
    }

    if (userIdRef.current && activeId) {
      setSending(true)
      const { data: inserted } = await supabase.from('messages').insert({
        expediteur_id:    userIdRef.current,
        conversation_id:  activeId,
        contenu:          contenu.trim() || (pjNom ?? ''),
        piece_jointe_url: pjUrl  ?? null,
        piece_jointe_nom: pjNom  ?? null,
        piece_jointe_type: pjType ?? null,
        reply_to_id:      replySnap?.id ?? null,
      }).select('id').single()
      if (inserted) {
        setMsgCache(prev => ({
          ...prev,
          [activeId]: (prev[activeId] ?? []).map(m => m.id === tmpId ? { ...m, id: inserted.id } : m),
        }))
      }
      setSending(false)
    }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  function adjustTA() {
    const el = textaRef.current; if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // ── File selection ────────────────────────────────────────────────────────

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    if (file.size > MAX_BYTES) {
      setSendErr('Ce fichier dépasse 10 Mo. Choisissez un fichier plus léger.')
      return
    }
    const nom     = file.name
    const type    = isImage(nom) ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'file'
    const preview = isImage(nom) ? URL.createObjectURL(file) : undefined
    setPendingFile({ file, nom, type, preview })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', backgroundColor: C.bg }}>
      <style suppressHydrationWarning>{`
        @keyframes kapolia-sp     { to{transform:rotate(360deg)} }
        @keyframes kapolia-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
      `}</style>

      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile} />

      {/* ── LEFT COLUMN ──────────────────────────────────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, height: '100%', backgroundColor: C.white, borderRight: `1px solid ${C.sable}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.sable}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 17, color: C.dark }}>Mes messages</span>
            {totalUnread > 0 && (
              <span style={{ padding: '1px 7px', borderRadius: 10, backgroundColor: C.terracotta, color: C.white, fontSize: 11, fontWeight: 700 }}>
                {totalUnread}
              </span>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <input type="text" placeholder="Rechercher…"
              style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8, border: `1.5px solid ${C.sable}`, backgroundColor: C.bg, fontSize: 13, color: C.dark, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="2" strokeLinecap="round"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConvs ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: C.grey, fontSize: 13 }}>Chargement…</div>
          ) : convs.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: C.grey, fontSize: 13 }}>Aucune conversation</div>
          ) : convs.map(conv => {
            const isActive   = conv.id === activeId
            const borderLeft = `3px solid ${isActive ? C.terracotta : 'transparent'}`
            const bgColor    = isActive ? `${C.terracotta}08` : 'transparent'
            return (
              <button key={conv.id} onClick={() => selectConv(conv.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', border: 'none', borderBottom: `1px solid ${C.sable}`, borderLeft, backgroundColor: bgColor, cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.1s' }}>
                <ConvAvatar i={conv.initiales} bg={conv.avatarBg} s={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.entreprise || conv.nom}
                    </span>
                    <span style={{ fontSize: 10, color: C.grey, flexShrink: 0, marginLeft: 4 }}>{conv.derniereHeure}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.grey, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[conv.nom, conv.offreTitre].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, color: conv.nonLu > 0 ? C.dark : C.grey, fontWeight: conv.nonLu > 0 ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {conv.dernierMsg}
                    </span>
                    {conv.nonLu > 0 && (
                      <span style={{ width: 17, height: 17, borderRadius: '50%', flexShrink: 0, backgroundColor: C.terracotta, color: C.white, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {conv.nonLu}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── CENTER COLUMN ────────────────────────────────────────────────── */}
      {!loadingConvs && convs.length === 0 ? (
        <EmptyState onBrowse={() => router.push('/offres')} />
      ) : activeConv ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '12px 22px', backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <ConvAvatar i={activeConv.initiales} bg={activeConv.avatarBg} s={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>{activeConv.entreprise || activeConv.nom}</div>
              {activeConv.nom && <div style={{ fontSize: 12, color: C.grey, marginTop: 2 }}>{activeConv.nom}</div>}
              {activeConv.offreTitre && (
                <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: 4, padding: '2px 10px', borderRadius: 20, backgroundColor: `${C.terracotta}15`, border: `1px solid ${C.terracotta}30` }}>
                  <span style={{ fontSize: 11, color: C.terracotta, fontWeight: 600 }}>{activeConv.offreTitre}</span>
                </div>
              )}
            </div>
            {activeConv.offreId && (
              <button onClick={() => router.push(`/offres/${activeConv.offreId}`)}
                style={{ padding: '7px 14px', borderRadius: 9, border: `1.5px solid ${C.sable}`, backgroundColor: 'transparent', color: C.dark, fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                Voir l&apos;offre
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>
            {activeMsgs.map((msg, i) => {
              const prev         = activeMsgs[i - 1]
              const next         = activeMsgs[i + 1]
              const dateChanged  = msg.date && (!prev || prev.date !== msg.date)
              const isFirstGroup = !prev || prev.fromMe !== msg.fromMe || dateChanged
              const isLastGroup  = !next || next.fromMe !== msg.fromMe || (msg.date && next.date !== msg.date)
              const mt           = i === 0 || dateChanged ? 0 : isFirstGroup ? 14 : 3
              return (
                <React.Fragment key={msg.id}>

                  {/* Date separator */}
                  {dateChanged && msg.date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: `${i === 0 ? 0 : 16}px 0 14px` }}>
                      <div style={{ flex: 1, height: 1, backgroundColor: C.sable }} />
                      <span style={{ fontSize: 11, color: C.grey, whiteSpace: 'nowrap' }}>{dateLabel(msg.date)}</span>
                      <div style={{ flex: 1, height: 1, backgroundColor: C.sable }} />
                    </div>
                  )}

                  <div
                    onMouseEnter={() => setHovMsgId(msg.id)}
                    onMouseLeave={() => setHovMsgId(null)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: msg.fromMe ? 'flex-end' : 'flex-start', marginTop: mt }}>

                    {/* Reply quote */}
                    {msg.replyToId && (
                      <div style={{ maxWidth: '66%', padding: '5px 10px', borderRadius: '8px 8px 0 0', borderLeft: `3px solid ${C.sable}`, backgroundColor: `${C.sable}50`, marginBottom: 2, fontSize: 12, color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <polyline points="9 14 4 9 9 4" />
                          <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                        </svg>
                        {msg.replyToContenu ?? activeMsgs.find(m => m.id === msg.replyToId)?.contenu ?? '…'}
                      </div>
                    )}

                    {/* Bubble + hover action */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: msg.fromMe ? 'row-reverse' : 'row' }}>
                      {msg.rendezVousId
                        ? <RdvBubble rdvId={msg.rendezVousId} role="candidat" />
                        : msg.pjNom
                          ? <FileBubble nom={msg.pjNom} url={msg.pjUrl} type={msg.pjType} fromMe={msg.fromMe} />
                          : (
                            <div style={{ maxWidth: '68%', padding: '10px 16px', borderRadius: 15, backgroundColor: msg.fromMe ? C.terracotta : C.white, border: msg.fromMe ? 'none' : `1.5px solid ${C.sable}`, color: msg.fromMe ? C.white : C.dark, fontSize: 14, lineHeight: '1.55', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                              {msg.contenu}
                            </div>
                          )
                      }
                      <div style={{ display: 'flex', gap: 3, opacity: hovMsgId === msg.id ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
                        <ActionBtn title="Répondre" onClick={() => setReplyingTo({ id: msg.id, contenu: msg.contenu || (msg.pjNom ?? ''), fromMe: msg.fromMe })}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 14 4 9 9 4" />
                            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                          </svg>
                        </ActionBtn>
                      </div>
                    </div>

                    {/* Time + checks */}
                    {isLastGroup && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, paddingInline: 4 }}>
                        <span style={{ fontSize: 11, color: C.grey }}>{msg.heure}</span>
                        {msg.fromMe && <Checks lu={msg.lu} />}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              )
            })}

            {isTyping && <TypingIndicator nom={(activeConv.entreprise || activeConv.nom).split(' ')[0]} />}
            <div ref={endRef} />
          </div>

          {/* Reply bar */}
          {replyingTo && (
            <ReplyBar reply={replyingTo} nom={(activeConv.entreprise || activeConv.nom).split(' ')[0]} onCancel={() => setReplyingTo(null)} />
          )}

          {/* Pending file preview */}
          {pendingFile && (
            <div style={{ padding: '8px 14px', borderTop: `1px solid ${C.sable}`, backgroundColor: `${C.terracotta}06`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {pendingFile.preview
                ? <img src={pendingFile.preview} alt={pendingFile.nom} style={{ height: 48, width: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingFile.nom}</div>
                <div style={{ fontSize: 11, color: C.grey, marginTop: 2 }}>{formatBytes(pendingFile.file.size)}</div>
              </div>
              <button onClick={() => { if (pendingFile.preview) URL.revokeObjectURL(pendingFile.preview); setPendingFile(null) }} title="Retirer"
                style={{ border: 'none', backgroundColor: 'transparent', color: C.grey, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Input bar */}
          <div style={{ padding: '10px 18px', backgroundColor: C.white, borderTop: `1px solid ${C.sable}`, display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
            <div style={{ marginBottom: 4, flexShrink: 0 }}>
              <GlobalAvatar profil={userProfil} size="sm" />
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Joindre un fichier"
              style={{ width: 38, height: 38, borderRadius: 10, border: 'none', backgroundColor: C.bg, cursor: uploading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: uploading ? 0.5 : 1 }}>
              {uploading
                ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kapolia-sp 0.7s linear infinite' }} />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
              }
            </button>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <textarea ref={textaRef} value={input}
                onChange={e => { setInput(e.target.value); adjustTA(); sendTypingSignal(); if (sendErr) setSendErr(null) }}
                onKeyDown={handleKey}
                placeholder={`Écrire à ${(activeConv.entreprise || activeConv.nom).split(' ')[0]}…`}
                rows={1}
                style={{ padding: '9px 14px', borderRadius: 12, border: `1.5px solid ${input || pendingFile ? C.terracotta : C.sable}`, backgroundColor: C.bg, fontSize: 14, color: C.dark, outline: 'none', fontFamily: 'inherit', resize: 'none', lineHeight: '1.5', overflowY: 'hidden', transition: 'border-color 0.15s' }}
              />
              {sendErr && (
                <p style={{ margin: 0, fontSize: 13, color: C.erreur, lineHeight: 1.4 }}>{sendErr}</p>
              )}
            </div>

            <button onClick={() => send(input)} disabled={(!input.trim() && !pendingFile) || sending}
              style={{ height: 38, padding: '0 18px', borderRadius: 12, border: 'none', backgroundColor: (input.trim() || pendingFile) && !sending ? C.terracotta : C.sable, color: (input.trim() || pendingFile) && !sending ? C.white : C.grey, fontSize: 14, fontWeight: 600, cursor: (input.trim() || pendingFile) && !sending ? 'pointer' : 'default', transition: 'all 0.15s', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              {sending || uploading ? 'Envoi…' : (
                <>Envoyer <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg></>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
          <div style={{ textAlign: 'center', maxWidth: 300 }}>
            <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 19, color: C.dark, marginBottom: 10 }}>Votre messagerie</div>
            <div style={{ fontSize: 14, color: C.grey, lineHeight: 1.65 }}>Sélectionnez une conversation dans la liste pour afficher les messages.</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CandidatMessagesPage() {
  return (
    <Suspense>
      <CandidatMessagesPageInner />
    </Suspense>
  )
}
