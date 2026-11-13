'use client'

import React, { useState, useEffect, useLayoutEffect, useRef, Suspense } from 'react'
import type { KeyboardEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FONT_SERIF } from '@/lib/typography'
import RdvBubble from '@/components/RdvBubble'
import { EntrepriseLogo } from '@/components/EntrepriseLogo'
import { sanitizeFilename, normalizeText } from '@/lib/storage-utils'
import { dateListeMessage, formatJourCourt, formatHeure } from '@/lib/rdv-format'
import { STATUTS, type StatutCandidature } from '@/lib/statuts'
import { C, CARD_SHADOW } from '@/lib/colors'
import { Bandeau, type BandeauHandle } from '@/components/Bandeau'
import { EASE, animerCartes, type CardPos } from '@/lib/motion'

const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','webp','bmp','svg'])
const MAX_BYTES  = 10 * 1024 * 1024

function isImage(nom: string) {
  return IMAGE_EXTS.has(nom.split('.').pop()?.toLowerCase() ?? '')
}

// Paris-TZ date key for grouping messages
function msgDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

// "Aujourd'hui" / "Hier" / "Mardi 10 novembre"
function dateLabel(dateStr: string): string {
  const opts  = { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' } as const
  const TZ    = { timeZone: 'Europe/Paris' } as const
  const nowStr = new Date().toLocaleDateString('fr-FR', opts)
  const toMs   = (s: string) => { const [d, m, y] = s.split('/'); return Date.UTC(+y, +m - 1, +d) }
  const diff   = Math.round((toMs(nowStr) - toMs(dateStr)) / 86400000)
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Hier'
  const [dd, mm, yyyy] = dateStr.split('/')
  const d     = new Date(`${yyyy}-${mm}-${dd}T12:00:00Z`)
  const wd    = d.toLocaleDateString('fr-FR', { weekday: 'long', ...TZ })
  const day   = d.toLocaleDateString('fr-FR', { day: 'numeric', ...TZ })
  const month = d.toLocaleDateString('fr-FR', { month: 'long', ...TZ })
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)} ${day} ${month}`
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} o`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`
  return `${(b / 1024 / 1024).toFixed(1)} Mo`
}

// Split text into plain strings + clickable <a> nodes
function renderMsgText(text: string, fromMe: boolean): React.ReactNode {
  const URL_RE    = /https?:\/\/[^\s<>'"]+/g
  const TRAIL_RE  = /[.,;:!?)»]+$/
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    let url   = match[0]
    let trail = ''
    const tm  = TRAIL_RE.exec(url)
    if (tm) { trail = tm[0]; url = url.slice(0, url.length - trail.length) }
    parts.push(
      <a key={match.index} href={url} target="_blank" rel="noopener noreferrer"
        style={{ color: fromMe ? C.white : C.orangeTexte, textDecoration: 'underline', fontWeight: 600 }}>
        {url}
      </a>
    )
    if (trail) parts.push(trail)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 0 ? text : <>{parts}</>
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ReplyRef = { id: string; contenu: string; fromMe: boolean }

type LocalConv = {
  id: string; recruteurId?: string
  nom: string; logoUrl?: string
  entreprise: string; offreTitre: string; offreId?: string
  dernierMsg: string; derniereDate: string
  nonLu: number
  dernierMsgFromMe?: boolean
  dernierMsgIsRdv?: boolean
  dernierMsgIsFile?: boolean
}

type LocalMsg = {
  id: string; fromMe: boolean; contenu: string; heure: string; lu: boolean
  date?: string
  pjUrl?: string; pjNom?: string; pjType?: string
  replyToId?: string; replyToContenu?: string
  rendezVousId?: string
  failed?: boolean
  retryContenu?: string
  retryReplyId?: string | null
  retryFile?: File
}

type PVP = { user_id: string; prenom?: string; nom?: string; entreprise_nom?: string | null; entreprise_logo_url?: string | null }

type LastMsgRow = { expediteur_id: string; rendez_vous_id?: string | null; piece_jointe_nom?: string | null }

type ContextOffre = {
  id: string; titre: string; ville: string | null
  expire_at: string | null; statut: string | null
}

type ContextCand = { offre_id: string; statut: string }

type ContextCreneau = { id: string; debut_utc: string; selectionne: boolean }

type ContextRdv = {
  id: string; conversation_id: string
  type: 'telephonique' | 'entretien'
  statut: string; creneaux_rdv: ContextCreneau[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowHeure() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function convPreview(conv: LocalConv): string {
  if (conv.dernierMsgIsRdv)   return 'Rendez-vous proposé'
  if (conv.dernierMsgIsFile)  return conv.dernierMsg
  if (conv.dernierMsgFromMe)  return `Vous : ${conv.dernierMsg}`
  return conv.dernierMsg
}

function isOffreExpiree(o: ContextOffre | undefined): boolean {
  if (!o) return false
  if (o.statut === 'archivée') return true
  if (o.statut !== 'brouillon' && o.expire_at && new Date(o.expire_at) <= new Date()) return true
  return false
}

function scrollToRdv(rdvId: string) {
  const el = document.querySelector(`[data-rdv-id="${rdvId}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  setTimeout(() => {
    el.classList.add('kapolia-rdv-hl')
    el.addEventListener('animationend', () => el.classList.remove('kapolia-rdv-hl'), { once: true })
  }, 350)
}

// ─── Double checkmarks ────────────────────────────────────────────────────────

function Checks({ lu }: { lu: boolean }) {
  const col       = lu ? C.vert : '#B8BFBB'
  const lineStyle = { stroke: col, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  return (
    <svg width="18" height="11" viewBox="0 0 18 11" style={{ flexShrink: 0, overflow: 'visible' }}>
      <polyline points="1,6 4,9 9,2"  style={lineStyle} />
      <polyline points="6,6 9,9 14,2" style={lineStyle} />
    </svg>
  )
}

// ─── File bubble ──────────────────────────────────────────────────────────────

function FileBubble({ nom, url, type }: { nom: string; url?: string; type?: string }) {
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
      <span style={{ fontSize: 13, color: C.grey }}>{nom} écrit…</span>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 280 }}>
        <div style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 20, fontWeight: 600, color: C.dark, marginBottom: 8 }}>Aucun message pour le moment</div>
        <div style={{ fontSize: 14, color: C.grey, marginBottom: 24, lineHeight: 1.6 }}>Les recruteurs qui repèrent votre profil vous écriront ici.</div>
        <button onClick={onBrowse} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', backgroundColor: C.orange, color: C.white, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Voir les offres
        </button>
      </div>
    </div>
  )
}

// ─── Calendar icon ────────────────────────────────────────────────────────────

function IconCalendar({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CandidatMessagesPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [convs, setConvs]                 = useState<LocalConv[]>([])
  const [activeId, setActiveId]           = useState('')
  const [msgCache, setMsgCache]           = useState<Record<string, LocalMsg[]>>({})
  const [loadingConvs, setLoadingConvs]   = useState(true)
  const [drafts, setDrafts]               = useState<Record<string, string>>({})
  const [perConvReply, setPerConvReply]   = useState<Record<string, ReplyRef | null>>({})
  const [perConvFile, setPerConvFile]     = useState<Record<string, { file: File; nom: string; type: string; preview?: string } | null>>({})
  const [sending, setSending]             = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [hovMsgId, setHovMsgId]           = useState<string | null>(null)
  const [hovConvId, setHovConvId]         = useState<string | null>(null)
  const [isTyping, setIsTyping]           = useState(false)
  const [sendErr, setSendErr]             = useState<string | null>(null)
  const [menuOpen, setMenuOpen]           = useState(false)
  const [retiredConv, setRetiredConv]     = useState<{ conv: LocalConv; nextId: string } | null>(null)
  const [q, setQ]                         = useState('')
  const [contextOffres, setContextOffres] = useState<Record<string, ContextOffre>>({})
  const [contextCands, setContextCands]   = useState<Record<string, ContextCand>>({})
  const [contextRdvs, setContextRdvs]     = useState<Record<string, ContextRdv>>({})
  const [unreadSepMsgId, setUnreadSepMsgId] = useState<string | null>(null)
  const [msgLoadErr, setMsgLoadErr]         = useState(false)
  const [reduitsMotion, setReduitsMotion]   = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  const endRef           = useRef<HTMLDivElement>(null)
  const textaRef         = useRef<HTMLTextAreaElement>(null)
  const fileRef          = useRef<HTMLInputElement>(null)
  const userIdRef        = useRef<string | null>(null)
  const realtimeRef      = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const realtimeConvsRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimer      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingRef    = useRef<number>(0)
  const activeIdRef      = useRef<string>('')
  const menuBtnRef       = useRef<HTMLButtonElement>(null)
  const menuRef          = useRef<HTMLDivElement>(null)
  const retiredTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bandeauRetirRef  = useRef<BandeauHandle>(null)
  const inputZoneRef     = useRef<HTMLDivElement>(null)
  const retiredConvRef   = useRef<{ conv: LocalConv; nextId: string } | null>(null)
  const convListRef      = useRef<HTMLDivElement>(null)
  const highlightRef     = useRef<HTMLDivElement>(null)
  const prevHighlightPos = useRef<{ top: number; h: number } | null>(null)
  const prevConvPositionsRef = useRef<Map<string, CardPos>>(new Map())
  const contextBandeauRef = useRef<HTMLDivElement>(null)
  const threadRef        = useRef<HTMLDivElement>(null)
  const prevMsgRef       = useRef<{ activeId: string; count: number }>({ activeId: '', count: 0 })
  const prevLuRef        = useRef<Map<string, boolean>>(new Map())
  const justBatchLoadedRef = useRef<Record<string, boolean>>({})

  // Sync retiredConvRef pour accès depuis timers et cleanup
  useEffect(() => { retiredConvRef.current = retiredConv }, [retiredConv])

  // ── Reduced motion ────────────────────────────────────────────────────────

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduitsMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userIdRef.current = user.id

      const { data: convsRaw, error } = await supabase
        .from('conversations')
        .select('id, recruteur_id, offre_id, dernier_message, derniere_activite, non_lu_candidat, offres(titre)')
        .eq('candidat_id', user.id)
        .eq('masquee_candidat', false)
        .order('derniere_activite', { ascending: false })

      if (error) { console.error('[messages init conversations]', error); setLoadingConvs(false); return }
      if (!convsRaw?.length) { setLoadingConvs(false); return }

      const recruteurIds = [...new Set(convsRaw.map(r => r.recruteur_id).filter(Boolean))]
      const offreIds     = [...new Set(convsRaw.map(r => r.offre_id).filter(Boolean))]
      const convIds      = convsRaw.map(r => r.id)

      const [pvpResult, offresCtxResult, candsCtxResult, rdvsCtxResult] = await Promise.all([
        recruteurIds.length
          ? supabase.from('profils_vue_publique').select('user_id, prenom, nom, entreprise_nom, entreprise_logo_url').in('user_id', recruteurIds)
          : Promise.resolve({ data: [] as PVP[], error: null }),
        offreIds.length
          ? supabase.from('offres').select('id, titre, ville, expire_at, statut').in('id', offreIds)
          : Promise.resolve({ data: [] as ContextOffre[], error: null }),
        offreIds.length
          ? supabase.from('candidatures').select('offre_id, statut').eq('candidat_id', user.id).eq('masquee_candidat', false).in('offre_id', offreIds)
          : Promise.resolve({ data: [] as ContextCand[], error: null }),
        convIds.length
          ? supabase.from('rendez_vous').select('id, conversation_id, type, statut, creneaux_rdv(id, debut_utc, selectionne)').in('conversation_id', convIds).in('statut', ['proposee', 'acceptee'])
          : Promise.resolve({ data: [], error: null }),
      ])

      const lastMsgResults = await Promise.all(
        convsRaw.map(row =>
          supabase
            .from('messages')
            .select('expediteur_id, rendez_vous_id, piece_jointe_nom')
            .eq('conversation_id', row.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        )
      )

      const { data: rData, error: rErr } = pvpResult
      if (rErr) console.error('[messages init profils]', rErr)
      const profilMap: Record<string, PVP> = {}
      for (const r of (rData ?? [])) profilMap[r.user_id] = r

      if (offresCtxResult.error) console.error('[messages init offres]', offresCtxResult.error)
      const offresMap: Record<string, ContextOffre> = {}
      for (const o of ((offresCtxResult.data as ContextOffre[] | null) ?? [])) offresMap[o.id] = o
      setContextOffres(offresMap)

      if (candsCtxResult.error) console.error('[messages init candidatures]', candsCtxResult.error)
      const candsMap: Record<string, ContextCand> = {}
      for (const c of ((candsCtxResult.data as ContextCand[] | null) ?? [])) {
        if (c.offre_id) candsMap[c.offre_id] = c
      }
      setContextCands(candsMap)

      if (rdvsCtxResult.error) console.error('[messages init rendez-vous]', rdvsCtxResult.error)
      const rdvsMap: Record<string, ContextRdv> = {}
      for (const r of ((rdvsCtxResult.data as unknown as ContextRdv[] | null) ?? [])) {
        rdvsMap[r.conversation_id] = r
      }
      setContextRdvs(rdvsMap)

      const lastMsgMap: Record<string, { fromMe: boolean; isRdv: boolean; isFile: boolean }> = {}
      for (let i = 0; i < convsRaw.length; i++) {
        if (lastMsgResults[i].error) console.error('[messages init dernier-msg]', lastMsgResults[i].error)
        const lm = lastMsgResults[i].data as LastMsgRow | null
        if (lm) {
          lastMsgMap[convsRaw[i].id] = {
            fromMe: lm.expediteur_id === user.id,
            isRdv:  !!lm.rendez_vous_id,
            isFile: !!lm.piece_jointe_nom,
          }
        }
      }

      const loaded: LocalConv[] = convsRaw.map(row => {
        const p          = profilMap[row.recruteur_id]
        const offre      = row.offres as { titre?: string } | null
        const entreprise = p?.entreprise_nom ?? ''
        const nom        = [p?.prenom, p?.nom].filter(Boolean).join(' ') || (entreprise ? '' : 'Recruteur inconnu')
        const lm         = lastMsgMap[row.id]
        return {
          id: row.id, recruteurId: row.recruteur_id,
          nom, logoUrl: p?.entreprise_logo_url ?? undefined,
          entreprise,
          offreTitre: offre?.titre ?? '',
          offreId: row.offre_id ?? undefined,
          dernierMsg: row.dernier_message ?? '',
          derniereDate: row.derniere_activite ?? '',
          nonLu: row.non_lu_candidat ?? 0,
          dernierMsgFromMe: lm?.fromMe,
          dernierMsgIsRdv:  lm?.isRdv  ?? false,
          dernierMsgIsFile: lm?.isFile ?? false,
        }
      })
      setConvs(loaded)
      setLoadingConvs(false)

      // Realtime : conversations
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
                dernierMsg:   c.dernier_message  ?? conv.dernierMsg,
                derniereDate: c.derniere_activite ?? conv.derniereDate,
                nonLu: c.id === activeIdRef.current ? 0 : (c.non_lu_candidat ?? conv.nonLu),
              })
            })
            if (!convInList && c.masquee_candidat === false && c.recruteur_id) {
              const [{ data: offre, error: rtOffreErr }, { data: profil, error: rtProfilErr }] = await Promise.all([
                c.offre_id
                  ? supabase.from('offres').select('titre').eq('id', c.offre_id).single()
                  : Promise.resolve({ data: null, error: null }),
                supabase.from('profils_vue_publique').select('prenom, nom, entreprise_nom, entreprise_logo_url').eq('user_id', c.recruteur_id).single(),
              ])
              if (rtOffreErr)  console.error('[messages realtime UPDATE offre]', rtOffreErr)
              if (rtProfilErr) console.error('[messages realtime UPDATE profil]', rtProfilErr)
              const p          = profil as PVP | null
              const o          = offre as { titre?: string } | null
              const entreprise = p?.entreprise_nom ?? ''
              const nom        = [p?.prenom, p?.nom].filter(Boolean).join(' ') || (entreprise ? '' : 'Recruteur inconnu')
              const restored: LocalConv = {
                id: c.id, recruteurId: c.recruteur_id,
                nom, logoUrl: p?.entreprise_logo_url ?? undefined,
                entreprise,
                offreTitre: o?.titre ?? '',
                offreId: c.offre_id ?? undefined,
                dernierMsg: c.dernier_message ?? '',
                derniereDate: c.derniere_activite ?? '',
                nonLu: c.non_lu_candidat ?? 0,
                dernierMsgFromMe: undefined,
                dernierMsgIsRdv:  false,
                dernierMsgIsFile: false,
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
              supabase.from('profils_vue_publique').select('prenom, nom, entreprise_nom, entreprise_logo_url').eq('user_id', row.recruteur_id).single(),
            ])
            if (insOffreErr)  console.error('[messages realtime INSERT offre]', insOffreErr)
            if (insProfilErr) console.error('[messages realtime INSERT profil]', insProfilErr)
            const p          = profil as PVP | null
            const o          = offre as { titre?: string } | null
            const entreprise = p?.entreprise_nom ?? ''
            const nom        = [p?.prenom, p?.nom].filter(Boolean).join(' ') || (entreprise ? '' : 'Recruteur inconnu')
            const newConv: LocalConv = {
              id: row.id, recruteurId: row.recruteur_id,
              nom, logoUrl: p?.entreprise_logo_url ?? undefined,
              entreprise,
              offreTitre: o?.titre ?? '',
              offreId: row.offre_id ?? undefined,
              dernierMsg: row.dernier_message ?? '',
              derniereDate: row.derniere_activite ?? '',
              nonLu: row.non_lu_candidat ?? 0,
              dernierMsgFromMe: undefined,
              dernierMsgIsRdv:  false,
              dernierMsgIsFile: false,
            }
            setConvs(prev => {
              if (prev.some(c => c.id === row.id)) return prev
              return [newConv, ...prev]
            })
          }
        )
        .subscribe()

      const convParam = searchParams.get('conv')
      if (convParam && loaded.some(c => c.id === convParam)) {
        const initNonLu = loaded.find(c => c.id === convParam)?.nonLu ?? 0
        selectConv(convParam, initNonLu)
      }
    }
    init()
    return () => {
      if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null }
      if (realtimeConvsRef.current) { supabase.removeChannel(realtimeConvsRef.current); realtimeConvsRef.current = null }
      if (typingTimer.current) clearTimeout(typingTimer.current)
      // Point 4 : retrait en attente au démontage → confirmer immédiatement sans animation
      if (retiredTimerRef.current) {
        clearTimeout(retiredTimerRef.current)
        retiredTimerRef.current = null
        if (retiredConvRef.current) {
          confirmerRetrait(retiredConvRef.current.conv.id, retiredConvRef.current.conv)
        }
      }
    }
  }, [])

  // ── Reload RDV quand RdvBubble confirme ───────────────────────────────────

  useEffect(() => {
    function onRdvConfirme() {
      const convId = activeIdRef.current
      if (!convId) return
      supabase
        .from('rendez_vous')
        .select('id, conversation_id, type, statut, creneaux_rdv(id, debut_utc, selectionne)')
        .eq('conversation_id', convId)
        .in('statut', ['proposee', 'acceptee'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) console.error('[messages reload-rdv]', error)
          else if (data) setContextRdvs(prev => ({ ...prev, [convId]: data as unknown as ContextRdv }))
        })
    }
    window.addEventListener('rdv-confirme', onRdvConfirme)
    return () => window.removeEventListener('rdv-confirme', onRdvConfirme)
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgCache, activeId])

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('kapolia-brouillons-messages')
      if (saved) setDrafts(JSON.parse(saved) as Record<string, string>)
    } catch {}
  }, [])

  // ── Animations ────────────────────────────────────────────────────────────

  // Point 1 + 5 : cascade à l'entrée et remontée FLIP
  useLayoutEffect(() => {
    if (!convListRef.current) return
    const cards = convListRef.current.querySelectorAll<HTMLElement>('[data-card-id]')
    if (cards.length === 0) { prevConvPositionsRef.current = new Map<string, CardPos>(); return }
    prevConvPositionsRef.current = animerCartes(cards, prevConvPositionsRef.current)
  }, [convs, q])

  // Point 2 : fond glissant
  useLayoutEffect(() => {
    const h    = highlightRef.current
    const list = convListRef.current
    if (!h || !list) return
    if (!activeId) {
      h.style.opacity = '0'
      prevHighlightPos.current = null
      return
    }
    const btn = list.querySelector<HTMLElement>(`[data-conv-id="${activeId}"]`)
    if (!btn) { h.style.opacity = '0'; return }
    const newTop = btn.offsetTop
    const newH   = btn.offsetHeight
    const prev   = prevHighlightPos.current
    h.style.opacity = '1'
    if (prev && !reduitsMotion) {
      h.getAnimations().forEach(a => a.cancel())
      h.animate(
        [{ top: prev.top + 'px', height: prev.h + 'px' }, { top: newTop + 'px', height: newH + 'px' }],
        { duration: 320, easing: EASE, fill: 'forwards' }
      )
    }
    h.style.top    = newTop + 'px'
    h.style.height = newH + 'px'
    prevHighlightPos.current = { top: newTop, h: newH }
  }, [activeId, convs, reduitsMotion])

  // Point 3 : fondu bandeau de contexte + fil
  useLayoutEffect(() => {
    if (!activeId || reduitsMotion) return
    if (contextBandeauRef.current) {
      contextBandeauRef.current.getAnimations().forEach(a => a.cancel())
      contextBandeauRef.current.animate(
        [{ opacity: '0' }, { opacity: '1' }],
        { duration: 250, easing: 'ease-out' }
      )
    }
    if (threadRef.current) {
      threadRef.current.getAnimations().forEach(a => a.cancel())
      threadRef.current.animate(
        [{ opacity: '0', transform: 'translateY(8px)' }, { opacity: '1', transform: 'translateY(0)' }],
        { duration: 300, easing: EASE }
      )
    }
  }, [activeId])

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeConv  = convs.find(c => c.id === activeId) ?? null
  const activeMsgs  = msgCache[activeId] ?? []
  const totalUnread = convs.reduce((n, c) => n + c.nonLu, 0)

  const filteredConvs = q.trim()
    ? convs.filter(conv => {
        const needle = normalizeText(q.trim())
        return [conv.entreprise, conv.nom, conv.offreTitre, conv.dernierMsg].some(
          s => normalizeText(s ?? '').includes(needle)
        )
      })
    : convs

  const input       = drafts[activeId] ?? ''
  const replyingTo  = perConvReply[activeId] ?? null
  const pendingFile = perConvFile[activeId] ?? null

  // Point 4 + 5 : bulle montante à l'envoi/réception
  useLayoutEffect(() => {
    const prev   = prevMsgRef.current
    const curLen = activeMsgs.length
    if (prev.activeId !== activeId) {
      prevMsgRef.current = { activeId, count: curLen }
      return
    }
    if (justBatchLoadedRef.current[activeId]) {
      justBatchLoadedRef.current[activeId] = false
      prevMsgRef.current = { activeId, count: curLen }
      return
    }
    if (curLen > prev.count && !reduitsMotion) {
      for (let i = prev.count; i < curLen; i++) {
        const msg = activeMsgs[i]
        if (!msg) continue
        const el = document.querySelector<HTMLElement>(`[data-msg-id="${msg.id}"]`)
        if (!el) continue
        const origin = msg.fromMe ? 'bottom right' : 'bottom left'
        el.animate(
          [
            { opacity: '0', transform: 'translateY(14px) scale(0.96)', transformOrigin: origin },
            { opacity: '1', transform: 'translateY(0) scale(1)',       transformOrigin: origin },
          ],
          { duration: 280, easing: EASE }
        )
      }
    }
    prevMsgRef.current = { activeId, count: curLen }
  }, [activeMsgs, activeId, reduitsMotion])

  // Point 4 : fondu Envoyé → Lu (450 ms)
  useEffect(() => {
    if (reduitsMotion) return
    for (const msg of activeMsgs) {
      if (!msg.fromMe) continue
      const prevLu = prevLuRef.current.get(msg.id)
      if (prevLu === false && msg.lu === true) {
        const metaEl = document.querySelector<HTMLElement>(`[data-msg-meta="${msg.id}"]`)
        if (metaEl) {
          metaEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' })
        }
      }
      prevLuRef.current.set(msg.id, msg.lu)
    }
    const currentIds = new Set(activeMsgs.map(m => m.id))
    for (const id of Array.from(prevLuRef.current.keys())) {
      if (!currentIds.has(id)) prevLuRef.current.delete(id)
    }
  }, [activeMsgs, reduitsMotion])

  // ── Realtime channel ──────────────────────────────────────────────────────

  function subscribeToConv(convId: string) {
    if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null }
    setIsTyping(false)
    if (!convId) return

    realtimeRef.current = supabase
      .channel(`conv-${convId}-${Date.now()}`)
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
          if (isActive && userIdRef.current) {
            supabase.from('messages').update({ lu: true }).eq('id', m.id)
              .then(({ error }) => { if (error) console.error('[messages marquer-lu-realtime]', error) })
            supabase.from('conversations').update({ non_lu_candidat: 0 }).eq('id', convId)
              .then(({ error }) => { if (error) console.error('[messages non-lu-reset-realtime]', error) })
          } else {
            setConvs(prev => prev.map(c =>
              c.id === convId ? {
                ...c,
                dernierMsg:       m.contenu || (m.piece_jointe_nom ?? ''),
                derniereDate:     m.created_at,
                dernierMsgFromMe: false,
                dernierMsgIsRdv:  !!m.rendez_vous_id,
                dernierMsgIsFile: !!m.piece_jointe_nom,
                nonLu: c.nonLu + 1,
              } : c
            ))
          }
        }
      )
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

  async function selectConv(id: string, knownNonLu?: number) {
    // Snapshot nonLu BEFORE clearing it
    const prevNonLu = knownNonLu ?? (convs.find(c => c.id === id)?.nonLu ?? 0)
    setMsgLoadErr(false)
    setUnreadSepMsgId(null)
    setActiveId(id); activeIdRef.current = id; setMenuOpen(false)
    setConvs(prev => prev.map(c => c.id === id ? { ...c, nonLu: 0 } : c))
    subscribeToConv(id)

    const { data, error: loadErr } = await supabase
      .from('messages')
      .select('*, reply:reply_to_id(id, contenu)')
      .eq('conversation_id', id)
      .order('created_at')

    if (loadErr) {
      console.error('[messages charger]', loadErr)
      setMsgLoadErr(true)
      return
    }

    if (data?.length) {
      const uid = userIdRef.current
      justBatchLoadedRef.current[id] = true
      setMsgCache(prev => ({
        ...prev,
        [id]: data.map(m => ({
          id: m.id,
          fromMe: m.expediteur_id === uid,
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

      // Find separator position BEFORE marking as read
      if (prevNonLu > 0) {
        const uid2 = userIdRef.current
        const firstUnread = data.find(m => m.expediteur_id !== uid2 && !m.lu)
        if (firstUnread) setUnreadSepMsgId(firstUnread.id)
      }

      const last = data[data.length - 1] as {
        expediteur_id: string; rendez_vous_id?: string | null; piece_jointe_nom?: string | null
      }
      setConvs(prev => prev.map(c => c.id === id ? {
        ...c,
        dernierMsgFromMe: last.expediteur_id === userIdRef.current,
        dernierMsgIsRdv:  !!last.rendez_vous_id,
        dernierMsgIsFile: !!last.piece_jointe_nom,
      } : c))
    }

    if (userIdRef.current) {
      const { error: luErr } = await supabase
        .from('messages')
        .update({ lu: true })
        .eq('conversation_id', id)
        .neq('expediteur_id', userIdRef.current)
      if (luErr) console.error('[messages marquer-lu]', luErr)
    }
    supabase.from('conversations').update({ non_lu_candidat: 0 }).eq('id', id)
      .then(({ error }) => { if (error) console.error('[messages non-lu-reset]', error) })
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function send(contenu: string) {
    const pf = pendingFile
    if (!contenu.trim() && !pf) return
    if (!activeConv) return

    const heure     = nowHeure()
    const tmpId     = `tmp-${Date.now()}`
    const replySnap = replyingTo
    const convId    = activeId

    const msg: LocalMsg = {
      id: tmpId, fromMe: true, lu: false, contenu: contenu.trim(), heure,
      date: msgDate(new Date().toISOString()),
      pjNom: pf?.nom, pjUrl: undefined, pjType: pf?.type,
      replyToId: replySnap?.id, replyToContenu: replySnap?.contenu,
    }
    setMsgCache(prev => ({ ...prev, [convId]: [...(prev[convId] ?? []), msg] }))
    setDrafts(prev => {
      const next = { ...prev }; delete next[convId]
      try { sessionStorage.setItem('kapolia-brouillons-messages', JSON.stringify(next)) } catch {}
      return next
    })
    setPerConvReply(prev => ({ ...prev, [convId]: null }))
    if (textaRef.current) textaRef.current.style.height = 'auto'
    if (pf?.preview) URL.revokeObjectURL(pf.preview)
    setPerConvFile(prev => ({ ...prev, [convId]: null }))

    let pjNom: string | undefined
    let pjUrl: string | undefined
    let pjType: string | undefined

    if (pf && userIdRef.current && convId) {
      setUploading(true)
      const path = `${convId}/${Date.now()}-${sanitizeFilename(pf.nom)}`
      const { error } = await supabase.storage.from('pieces-jointes').upload(path, pf.file)
      if (error) {
        console.error('[messages send] file upload failed', error)
        setMsgCache(prev => ({
          ...prev,
          [convId]: (prev[convId] ?? []).map(m => m.id === tmpId
            ? { ...m, failed: true, retryContenu: contenu.trim(), retryFile: pf.file }
            : m),
        }))
        setUploading(false)
        return
      }
      pjUrl  = supabase.storage.from('pieces-jointes').getPublicUrl(path).data.publicUrl
      pjNom  = pf.nom
      pjType = pf.type
      setUploading(false)
      setMsgCache(prev => ({ ...prev, [convId]: (prev[convId] ?? []).map(m => m.id === tmpId ? { ...m, pjUrl } : m) }))
    }

    if (userIdRef.current && convId) {
      setSending(true)
      const { data: inserted, error: insertError } = await supabase.from('messages').insert({
        expediteur_id:    userIdRef.current,
        conversation_id:  convId,
        contenu:          contenu.trim() || (pjNom ?? ''),
        piece_jointe_url: pjUrl  ?? null,
        piece_jointe_nom: pjNom  ?? null,
        piece_jointe_type: pjType ?? null,
        reply_to_id:      replySnap?.id ?? null,
      }).select('id').single()

      if (insertError || !inserted) {
        console.error('[messages send] insert failed', insertError)
        setMsgCache(prev => ({
          ...prev,
          [convId]: (prev[convId] ?? []).map(m => m.id === tmpId
            ? { ...m, failed: true, retryContenu: contenu.trim(), retryReplyId: replySnap?.id ?? null }
            : m),
        }))
        setSending(false)
        return
      }

      setMsgCache(prev => ({
        ...prev,
        [convId]: (prev[convId] ?? []).map(m => m.id === tmpId ? { ...m, id: inserted.id, failed: false } : m),
      }))
      setConvs(prev => prev.map(c => c.id === convId ? {
        ...c,
        dernierMsg:       contenu.trim() || (pjNom ?? ''),
        derniereDate:     new Date().toISOString(),
        dernierMsgFromMe: true,
        dernierMsgIsRdv:  false,
        dernierMsgIsFile: !!pjNom,
      } : c))
      setSending(false)
    }
  }

  // ── Retry failed message ──────────────────────────────────────────────────

  async function retrySend(msg: LocalMsg) {
    if (!msg.failed) return
    const contenu = msg.retryContenu ?? msg.contenu
    const convId  = activeId
    const tmpId   = msg.id

    setMsgCache(prev => ({
      ...prev,
      [convId]: (prev[convId] ?? []).map(m => m.id === tmpId ? { ...m, failed: false } : m),
    }))

    // Re-upload file si l'upload initial avait échoué
    let pjUrl  = msg.pjUrl
    let pjNom  = msg.pjNom
    let pjType = msg.pjType
    if (msg.retryFile && !pjUrl && userIdRef.current) {
      setUploading(true)
      const path = `${convId}/${Date.now()}-${sanitizeFilename(msg.retryFile.name)}`
      const { error: upErr } = await supabase.storage.from('pieces-jointes').upload(path, msg.retryFile)
      if (upErr) {
        console.error('[messages send] retry upload failed', upErr)
        setMsgCache(prev => ({
          ...prev,
          [convId]: (prev[convId] ?? []).map(m => m.id === tmpId ? { ...m, failed: true } : m),
        }))
        setUploading(false)
        return
      }
      pjUrl  = supabase.storage.from('pieces-jointes').getPublicUrl(path).data.publicUrl
      pjNom  = msg.retryFile.name
      pjType = msg.pjType
      setUploading(false)
      setMsgCache(prev => ({
        ...prev,
        [convId]: (prev[convId] ?? []).map(m => m.id === tmpId ? { ...m, pjUrl, pjNom, pjType, retryFile: undefined } : m),
      }))
    }

    // Ne jamais insérer piece_jointe_nom sans piece_jointe_url
    const safePjNom = pjUrl ? (pjNom ?? null) : null
    const safePjType = pjUrl ? (pjType ?? null) : null

    setSending(true)
    const { data: inserted, error: insertError } = await supabase.from('messages').insert({
      expediteur_id:    userIdRef.current,
      conversation_id:  convId,
      contenu:          contenu || (safePjNom ?? ''),
      piece_jointe_url: pjUrl     ?? null,
      piece_jointe_nom: safePjNom,
      piece_jointe_type: safePjType,
      reply_to_id:      msg.retryReplyId ?? msg.replyToId ?? null,
    }).select('id').single()

    if (insertError || !inserted) {
      console.error('[messages send] retry failed', insertError)
      setMsgCache(prev => ({
        ...prev,
        [convId]: (prev[convId] ?? []).map(m => m.id === tmpId ? { ...m, failed: true } : m),
      }))
      setSending(false)
      return
    }

    setMsgCache(prev => ({
      ...prev,
      [convId]: (prev[convId] ?? []).map(m => m.id === tmpId ? { ...m, id: inserted.id, failed: false } : m),
    }))
    setConvs(prev => prev.map(c => c.id === convId ? {
      ...c,
      dernierMsg:       contenu || (pjNom ?? ''),
      derniereDate:     new Date().toISOString(),
      dernierMsgFromMe: true,
      dernierMsgIsRdv:  false,
      dernierMsgIsFile: !!pjNom,
    } : c))
    setSending(false)
  }

  async function confirmerRetrait(id: string, convSnapshot: LocalConv) {
    const { error } = await supabase
      .from('conversations')
      .update({ masquee_candidat: true })
      .eq('id', id)
    if (error) {
      console.error('[messages retirer]', error)
      setConvs(prev => {
        if (prev.some(c => c.id === id)) return prev
        return [...prev, convSnapshot].sort((a, b) =>
          new Date(b.derniereDate).getTime() - new Date(a.derniereDate).getTime()
        )
      })
    }
  }

  function retirerConversation() {
    if (!activeConv) return
    setMenuOpen(false)

    const convToRemove = activeConv
    const idx          = convs.findIndex(c => c.id === convToRemove.id)
    const remaining    = convs.filter(c => c.id !== convToRemove.id)
    const nextConv     = remaining[idx] ?? remaining[Math.max(0, idx - 1)] ?? null

    function proceed() {
      // Point 2 : retrait déjà en attente → confirmer immédiatement avant d'en lancer un nouveau
      if (retiredTimerRef.current) {
        clearTimeout(retiredTimerRef.current)
        retiredTimerRef.current = null
        if (retiredConvRef.current) {
          confirmerRetrait(retiredConvRef.current.conv.id, retiredConvRef.current.conv)
        }
      }

      setConvs(remaining)
      setRetiredConv({ conv: convToRemove, nextId: nextConv?.id ?? '' })
      if (nextConv) {
        selectConv(nextConv.id, nextConv.nonLu)
      } else {
        setActiveId(''); activeIdRef.current = ''
        subscribeToConv('')
      }

      // Point 3 : écriture d'abord, bandeau ensuite (sans dépendre de bandeauRetirRef)
      retiredTimerRef.current = setTimeout(() => {
        confirmerRetrait(convToRemove.id, convToRemove).then(() => {
          if (bandeauRetirRef.current) {
            bandeauRetirRef.current.animateOut(() => setRetiredConv(null))
          } else {
            setRetiredConv(null)
          }
        })
      }, 5000)
    }

    // Point 6 : repli de la ligne (280 ms), puis bandeau monte
    const btn = convListRef.current?.querySelector<HTMLElement>(`[data-conv-id="${convToRemove.id}"]`)
    if (btn && !reduitsMotion) {
      const fullH = btn.offsetHeight
      btn.style.overflow = 'hidden'
      if (highlightRef.current) {
        highlightRef.current.getAnimations().forEach(a => a.cancel())
        highlightRef.current.animate(
          [{ opacity: '1' }, { opacity: '0' }],
          { duration: 180, easing: 'ease-in', fill: 'forwards' }
        )
      }
      const anim = btn.animate(
        [
          { height: fullH + 'px', opacity: '1', marginBottom: '2px' },
          { height: '0px',        opacity: '0', marginBottom: '0px' },
        ],
        { duration: 280, easing: 'ease-in', fill: 'forwards' }
      )
      anim.onfinish = proceed
    } else {
      proceed()
    }
  }

  function annulerRetrait() {
    if (!retiredConv) return
    if (retiredTimerRef.current) { clearTimeout(retiredTimerRef.current); retiredTimerRef.current = null }

    const convToRestore = retiredConv.conv
    setConvs(prev => {
      const withRestored = [...prev, convToRestore]
      return withRestored.sort((a, b) =>
        new Date(b.derniereDate).getTime() - new Date(a.derniereDate).getTime()
      )
    })
    bandeauRetirRef.current?.animateOut(() => { setRetiredConv(null) })
    selectConv(convToRestore.id, convToRestore.nonLu)
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  function adjustTA() {
    const el = textaRef.current; if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = ''
    if (file.size > MAX_BYTES) {
      setSendErr('Ce fichier dépasse 10 Mo. Choisissez un fichier plus léger.')
      return
    }
    const nom     = file.name
    const type    = isImage(nom) ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'file'
    const preview = isImage(nom) ? URL.createObjectURL(file) : undefined
    setPerConvFile(prev => ({ ...prev, [activeId]: { file, nom, type, preview } }))
  }

  useEffect(() => {
    if (!menuOpen) return
    function onDocMouseDown(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return
      if (menuBtnRef.current?.contains(e.target as Node)) return
      setMenuOpen(false)
    }
    function onDocKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onDocKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onDocKeyDown)
    }
  }, [menuOpen])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', backgroundColor: C.bg }}>
      <style suppressHydrationWarning>{`
        @keyframes kapolia-sp     { to{transform:rotate(360deg)} }
        @keyframes kapolia-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        @keyframes kapolia-rdv-ring {
          0%, 15% { box-shadow: 0 0 0 3px ${C.orange}; }
          100%     { box-shadow: 0 0 0 3px transparent; }
        }
        .kapolia-rdv-hl { animation: kapolia-rdv-ring 1.4s ease-out forwards; border-radius: 14px; }
        @media (prefers-reduced-motion: reduce) { .kapolia-rdv-hl { animation: none; } }
        .dk-dots-btn:hover { background-color: ${C.chip}; }
      `}</style>

      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile} />

      {/* ── LEFT COLUMN ──────────────────────────────────────────────────── */}
      <div style={{ width: 310, flexShrink: 0, height: '100%', backgroundColor: C.white, borderRight: `1px solid ${C.sable}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ padding: '24px 20px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <span style={{ fontFamily: FONT_SERIF, letterSpacing: '-0.005em', fontSize: 24, fontWeight: 600, color: C.dark }}>Messages</span>
            {totalUnread > 0 && (
              <span style={{ fontSize: 13, fontWeight: 600, color: C.orangeTexte }}>
                {totalUnread === 1 ? '1 non lu' : `${totalUnread} non lus`}
              </span>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Entreprise, interlocuteur, offre"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 36px', borderRadius: 10, border: `1px solid ${C.sable}`, backgroundColor: C.bg, fontSize: 14, color: C.dark, outline: 'none', fontFamily: 'inherit' }}
            />
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="2" strokeLinecap="round"
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
          </div>
        </div>

        <div ref={convListRef} style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px', position: 'relative' }}>
          {/* Point 2 : fond glissant */}
          <div ref={highlightRef} style={{ position: 'absolute', left: 10, right: 10, borderRadius: 11, backgroundColor: C.salaire, pointerEvents: 'none', opacity: 0, zIndex: 0 }} />
          {loadingConvs ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: C.grey, fontSize: 13 }}>Chargement…</div>
          ) : filteredConvs.length === 0 ? (
            q.trim() ? (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13.5, color: C.grey, lineHeight: 1.5 }}>
                Aucune conversation ne correspond à « {q.trim()} ».
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: C.grey, fontSize: 13 }}>Aucune conversation</div>
            )
          ) : filteredConvs.map(conv => {
            const isActive  = conv.id === activeId
            const isHovered = hovConvId === conv.id && !isActive
            return (
              <button key={conv.id} data-card-id={conv.id} data-conv-id={conv.id} onClick={() => selectConv(conv.id)}
                onMouseEnter={() => setHovConvId(conv.id)}
                onMouseLeave={() => setHovConvId(null)}
                style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 10px', border: 'none', borderRadius: 11, backgroundColor: isHovered && !isActive ? C.bg : 'transparent', cursor: 'pointer', textAlign: 'left', transition: reduitsMotion ? 'none' : 'background-color 0.1s', marginBottom: 2 }}>
                <EntrepriseLogo nom={conv.entreprise || conv.nom || '?'} logoUrl={conv.logoUrl} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                      {conv.entreprise || conv.nom}
                    </span>
                    <span style={{ fontSize: 12, flexShrink: 0, marginLeft: 6, color: conv.nonLu > 0 ? C.orangeTexte : C.grey, fontWeight: conv.nonLu > 0 ? 600 : 400 }}>
                      {conv.derniereDate ? dateListeMessage(conv.derniereDate) : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.grey, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.offreTitre || 'Repéré dans la candidathèque'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {drafts[conv.id] && conv.id !== activeId
                        ? <>
                            <span style={{ color: C.orangeTexte, fontWeight: 600 }}>Brouillon&nbsp;: </span>
                            <span style={{ color: C.grey }}>{drafts[conv.id]}</span>
                          </>
                        : <span style={{ color: conv.nonLu > 0 ? C.dark : C.grey, fontWeight: conv.nonLu > 0 ? 600 : 400 }}>{convPreview(conv)}</span>
                      }
                    </span>
                    {conv.nonLu > 0 && (
                      <span key={`badge-${conv.id}-${conv.nonLu}`} style={{ height: 19, minWidth: 19, padding: '0 5px', borderRadius: 10, backgroundColor: C.orange, color: C.white, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxSizing: 'border-box', animation: reduitsMotion ? 'none' : 'kapolia-motion-badge-pop 450ms cubic-bezier(0.3, 1.6, 0.5, 1) both' }}>
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

          {/* En-tête conversation */}
          <div style={{ position: 'relative', padding: '16px 26px', backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <EntrepriseLogo nom={activeConv.entreprise || activeConv.nom || '?'} logoUrl={activeConv.logoUrl} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.dark, lineHeight: 1.25 }}>{activeConv.nom || activeConv.entreprise}</div>
              {activeConv.entreprise && (
                <div style={{ fontSize: 13, color: C.grey, marginTop: 2 }}>{activeConv.entreprise}</div>
              )}
            </div>
            <button ref={menuBtnRef} className="dk-dots-btn" title="Options" onClick={() => setMenuOpen(o => !o)} style={{ width: 34, height: 34, borderRadius: 9, border: 'none', backgroundColor: menuOpen ? C.chip : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background-color 0.12s' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="5"  r="1" fill={C.grey} />
                <circle cx="12" cy="12" r="1" fill={C.grey} />
                <circle cx="12" cy="19" r="1" fill={C.grey} />
              </svg>
            </button>
            {menuOpen && (
              <div ref={menuRef} style={{
                position: 'absolute',
                top: menuBtnRef.current
                  ? menuBtnRef.current.offsetTop + menuBtnRef.current.offsetHeight + 4
                  : 60,
                right: 22,
                backgroundColor: C.white,
                borderRadius: 11,
                boxShadow: '0 2px 6px rgba(27,48,38,.08), 0 12px 28px rgba(27,48,38,.14)',
                minWidth: 230,
                zIndex: 20,
                paddingBottom: 10,
                animation: 'kapolia-motion-menu-open 0.15s ease-out',
                transformOrigin: 'top right',
              }}>
                <button
                  type="button"
                  onClick={retirerConversation}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 500, color: C.dark, fontFamily: 'inherit', boxSizing: 'border-box' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" /><path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                  Retirer de ma messagerie
                </button>
                <div style={{ margin: '0 16px', padding: '8px 0 2px', borderTop: `1px solid ${C.sable}`, fontSize: 12, color: C.grey, lineHeight: 1.5 }}>
                  {activeConv.nom} pourra toujours vous écrire. La conversation reviendra alors dans votre liste.
                </div>
              </div>
            )}
          </div>

          {/* Bandeau de contexte */}
          {(() => {
            const hasOffre = !!activeConv.offreId
            const offre    = activeConv.offreId ? contextOffres[activeConv.offreId] : undefined
            const cand     = activeConv.offreId ? contextCands[activeConv.offreId] : undefined
            const rdv      = contextRdvs[activeId] ?? null
            const expired  = isOffreExpiree(offre)

            const bandeauLeft: React.ReactNode[] = []

            if (hasOffre) {
              bandeauLeft.push(
                <span key="offre" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: C.dark }}>{offre?.titre ?? activeConv.offreTitre}</span>
                  {offre?.ville && <span style={{ color: C.grey }}>&nbsp;· {offre.ville}</span>}
                </span>
              )
            } else {
              bandeauLeft.push(
                <span key="no-offre" style={{ color: C.grey }}>
                  {activeConv.nom} a repéré votre profil dans la candidathèque.
                </span>
              )
            }

            if (cand && hasOffre) {
              const cfg    = STATUTS[cand.statut as StatutCandidature] ?? STATUTS['envoyée']
              const label  = cfg.labelCandidat.toLowerCase()
              const isRing = cfg.candidat.dotStyle === 'ring'
              bandeauLeft.push(
                <span key="cand" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, display: 'inline-block', backgroundColor: isRing ? 'transparent' : cfg.candidat.dot, border: isRing ? `2px solid ${cfg.candidat.dot}` : 'none', boxSizing: 'border-box' }} />
                  <span>Candidature&nbsp;: <span style={{ fontWeight: 600 }}>{label}</span></span>
                </span>
              )
            }

            if (expired && hasOffre) {
              bandeauLeft.push(<span key="expired" style={{ color: C.grey }}>Offre expirée</span>)
            }

            if (rdv) {
              const futurCreneaux = rdv.creneaux_rdv.some(c => new Date(c.debut_utc).getTime() > Date.now())
              if (rdv.statut === 'proposee' && futurCreneaux) {
                bandeauLeft.push(
                  <span key="rdv" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <IconCalendar size={17} />
                    <span>Rendez-vous à confirmer</span>
                    <button onClick={() => scrollToRdv(rdv.id)} style={{ marginLeft: 4, padding: '6px 12px', borderRadius: 8, border: 'none', backgroundColor: C.orange, color: C.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      Choisir un créneau
                    </button>
                  </span>
                )
              } else if (rdv.statut === 'acceptee') {
                const choisi = rdv.creneaux_rdv.find(c => c.selectionne)
                if (choisi && new Date(choisi.debut_utc).getTime() > Date.now()) {
                  const typeLabel = rdv.type === 'telephonique' ? 'Appel' : 'Entretien'
                  const jc        = formatJourCourt(choisi.debut_utc)
                  const dateStr   = jc.charAt(0).toLowerCase() + jc.slice(1) + ' à ' + formatHeure(choisi.debut_utc)
                  bandeauLeft.push(
                    <span key="rdv" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <IconCalendar size={17} />
                      <span style={{ fontWeight: 600 }}>{typeLabel} {dateStr}</span>
                    </span>
                  )
                }
              }
            }

            const isNonRetenue = cand?.statut === 'refusée'
            let rightLink: React.ReactNode = null
            if (hasOffre) {
              if (isNonRetenue || expired) {
                rightLink = (
                  <button onClick={() => router.push(`/candidatures?offre=${activeConv.offreId}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: C.orangeTexte, fontFamily: 'inherit', padding: 0 }}>
                    Voir des offres proches
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                )
              } else {
                rightLink = (
                  <button onClick={() => router.push(`/offres/${activeConv.offreId}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: C.orangeTexte, fontFamily: 'inherit', padding: 0 }}>
                    Voir l&apos;offre
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                )
              }
            } else {
              rightLink = (
                <button onClick={() => router.push(`/entreprise/${activeConv.recruteurId}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: C.orangeTexte, fontFamily: 'inherit', padding: 0 }}>
                  Voir l&apos;entreprise
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              )
            }

            const sep = { width: 1, height: 16, backgroundColor: C.sable, flexShrink: 0, alignSelf: 'center' as const, margin: '0 18px' }
            return (
              <div ref={contextBandeauRef} style={{ padding: '11px 26px', backgroundColor: C.white, borderBottom: `1px solid ${C.sable}`, display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 8, fontSize: 13.5, lineHeight: 1.4, flexShrink: 0 }}>
                {bandeauLeft.flatMap((item, i) => i === 0
                  ? [<React.Fragment key={`item-${i}`}>{item}</React.Fragment>]
                  : [<div key={`sep-${i}`} style={sep} />, <React.Fragment key={`item-${i}`}>{item}</React.Fragment>]
                )}
                <div style={{ marginLeft: 'auto', flexShrink: 0 }}>{rightLink}</div>
              </div>
            )
          })()}

          {/* Messages */}
          <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>
            {msgLoadErr ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14, color: C.grey }}>
                  Les messages n&apos;ont pas pu être chargés.{' '}
                  <button type="button" onClick={() => selectConv(activeId)} style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', color: C.orangeTexte, textDecoration: 'underline', cursor: 'pointer' }}>
                    Réessayer
                  </button>
                </span>
              </div>
            ) : activeMsgs.map((msg, i) => {
              const prev         = activeMsgs[i - 1]
              const next         = activeMsgs[i + 1]
              const dateChanged  = msg.date && (!prev || prev.date !== msg.date)
              const isFirstGroup = !prev || prev.fromMe !== msg.fromMe || !!dateChanged
              const isLastGroup  = !next || next.fromMe !== msg.fromMe || (!!msg.date && next.date !== msg.date)
              const mt           = i === 0 || dateChanged ? 0 : isFirstGroup ? 14 : 3
              const isUnreadSep  = msg.id === unreadSepMsgId
              const bgBubble     = msg.failed ? '#E8ECEA' : msg.fromMe ? C.vert : C.white
              const colorBubble  = msg.failed ? C.dark : msg.fromMe ? C.white : C.dark
              const radiusBubble = isLastGroup
                ? (msg.fromMe ? '15px 15px 5px 15px' : '15px 15px 15px 5px')
                : '15px'
              const shadowBubble = (!msg.fromMe && !msg.failed) ? '0 1px 2px rgba(27,48,38,.07)' : 'none'

              return (
                <React.Fragment key={msg.id}>
                  {/* Séparateur "Nouveau message" */}
                  {isUnreadSep && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: `${i === 0 ? 0 : 16}px 0 14px` }}>
                      <div style={{ flex: 1, height: 1, backgroundColor: `${C.orangeTexte}59` }} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: C.orangeTexte, whiteSpace: 'nowrap' }}>Nouveau message</span>
                      <div style={{ flex: 1, height: 1, backgroundColor: `${C.orangeTexte}59` }} />
                    </div>
                  )}
                  {/* Séparateur de date */}
                  {dateChanged && msg.date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: `${i === 0 && !isUnreadSep ? 0 : 16}px 0 14px` }}>
                      <div style={{ flex: 1, height: 1, backgroundColor: C.sable }} />
                      <span style={{ fontSize: 12.5, color: C.grey, whiteSpace: 'nowrap' }}>{dateLabel(msg.date)}</span>
                      <div style={{ flex: 1, height: 1, backgroundColor: C.sable }} />
                    </div>
                  )}
                  <div
                    data-msg-id={msg.id}
                    onMouseEnter={() => setHovMsgId(msg.id)}
                    onMouseLeave={() => setHovMsgId(null)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: msg.fromMe ? 'flex-end' : 'flex-start', marginTop: mt }}>
                    {/* Nom recruteur au-dessus du premier message d'un groupe reçu */}
                    {isFirstGroup && !msg.fromMe && (
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.grey, marginBottom: 3 }}>
                        {activeConv.nom || activeConv.entreprise}
                      </div>
                    )}
                    {/* Citation */}
                    {msg.replyToId && (
                      <div style={{ maxWidth: '66%', padding: '4px 10px', borderLeft: `2px solid ${C.sable}`, marginBottom: 3, fontSize: 12.5, color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {msg.replyToContenu ?? activeMsgs.find(m => m.id === msg.replyToId)?.contenu ?? '…'}
                      </div>
                    )}
                    {/* Bulle + bouton répondre */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: msg.fromMe ? 'row-reverse' : 'row' }}>
                      {msg.rendezVousId
                        ? (
                          <div data-rdv-id={msg.rendezVousId}>
                            <RdvBubble rdvId={msg.rendezVousId} role="candidat" />
                          </div>
                        )
                        : msg.pjNom
                          ? <FileBubble nom={msg.pjNom} url={msg.pjUrl} type={msg.pjType} />
                          : (
                            <div style={{ maxWidth: '72%', padding: '10px 15px', borderRadius: radiusBubble, backgroundColor: bgBubble, boxShadow: shadowBubble, color: colorBubble, fontSize: 14.5, lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                              {renderMsgText(msg.contenu, msg.fromMe && !msg.failed)}
                            </div>
                          )
                      }
                      {/* Bouton répondre (survol) */}
                      <button
                        onClick={() => setPerConvReply(prev => ({ ...prev, [activeId]: { id: msg.id, contenu: msg.contenu || (msg.pjNom ?? ''), fromMe: msg.fromMe } }))}
                        title="Répondre"
                        style={{ width: 34, height: 34, borderRadius: 10, border: 'none', backgroundColor: C.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: hovMsgId === msg.id ? 1 : 0, transition: reduitsMotion ? 'none' : 'opacity 0.15s' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 14 4 9 9 4" />
                          <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                        </svg>
                      </button>
                    </div>
                    {/* Méta : heure + coches ou "Non envoyé" */}
                    {isLastGroup && (
                      <div data-msg-meta={msg.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, paddingInline: 2 }}>
                        {msg.failed ? (
                          <span style={{ fontSize: 11.5, color: C.erreur, fontWeight: 600 }}>
                            Non envoyé.{' '}
                            <button type="button" onClick={() => retrySend(msg)} style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                              Réessayer
                            </button>
                          </span>
                        ) : (
                          <>
                            <span style={{ fontSize: 11.5, color: C.grey }}>{msg.heure}</span>
                            {msg.fromMe && (
                              <>
                                <Checks lu={msg.lu} />
                                <span style={{ fontSize: 11.5, color: C.grey }}>{msg.lu ? 'Lu' : 'Envoyé'}</span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              )
            })}
            {isTyping && <TypingIndicator nom={activeConv.nom || activeConv.entreprise} />}
            <div ref={endRef} />
          </div>

          {/* Zone de saisie */}
          <div ref={inputZoneRef} style={{ padding: '12px 22px 16px', backgroundColor: C.bg, flexShrink: 0 }}>
            <div style={{ backgroundColor: C.white, borderRadius: 14, boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
              {/* Barre de réponse */}
              {replyingTo && (
                <div style={{ padding: '8px 14px', borderBottom: `1px solid ${C.sable}`, borderLeft: `3px solid ${C.terracotta}`, backgroundColor: `${C.terracotta}08`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: C.terracotta, fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></svg>
                      Répondre à {replyingTo.fromMe ? 'votre message' : (activeConv.nom || activeConv.entreprise).split(' ')[0]}
                    </div>
                    <div style={{ fontSize: 12, color: C.grey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {replyingTo.contenu || 'Pièce jointe'}
                    </div>
                  </div>
                  <button onClick={() => setPerConvReply(prev => ({ ...prev, [activeId]: null }))} style={{ border: 'none', backgroundColor: 'transparent', color: C.grey, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              )}
              {/* Aperçu fichier */}
              {pendingFile && (
                <div style={{ padding: '8px 14px', borderBottom: `1px solid ${C.sable}`, backgroundColor: `${C.terracotta}06`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {pendingFile.preview
                    ? <img src={pendingFile.preview} alt={pendingFile.nom} style={{ height: 44, width: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingFile.nom}</div>
                    <div style={{ fontSize: 11, color: C.grey, marginTop: 1 }}>{formatBytes(pendingFile.file.size)}</div>
                  </div>
                  <button onClick={() => { if (pendingFile.preview) URL.revokeObjectURL(pendingFile.preview); setPerConvFile(prev => ({ ...prev, [activeId]: null })) }} title="Retirer"
                    style={{ border: 'none', backgroundColor: 'transparent', color: C.grey, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              )}
              {/* Ligne de saisie */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '8px 10px 8px 10px' }}>
                <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Joindre un fichier"
                  style={{ width: 34, height: 34, borderRadius: 9, border: 'none', backgroundColor: 'transparent', cursor: uploading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: uploading ? 0.5 : 1 }}>
                  {uploading
                    ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${C.sable}`, borderTopColor: C.terracotta, animation: 'kapolia-sp 0.7s linear infinite' }} />
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.grey} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                  }
                </button>
                <textarea
                  ref={textaRef}
                  value={input}
                  onChange={e => {
                    const val = e.target.value
                    const id  = activeId
                    setDrafts(prev => {
                      const next = { ...prev }
                      if (val) next[id] = val; else delete next[id]
                      try { sessionStorage.setItem('kapolia-brouillons-messages', JSON.stringify(next)) } catch {}
                      return next
                    })
                    adjustTA(); sendTypingSignal(); if (sendErr) setSendErr(null)
                  }}
                  onKeyDown={handleKey}
                  placeholder={`Répondre à ${activeConv.nom || activeConv.entreprise}`}
                  rows={1}
                  style={{ flex: 1, minHeight: 38, maxHeight: 120, padding: '8px 10px', border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: 14.5, color: C.dark, fontFamily: 'inherit', resize: 'none', lineHeight: 1.5, overflowY: 'hidden' }}
                />
                <button
                  onClick={() => send(input)}
                  disabled={(!input.trim() && !pendingFile) || sending}
                  style={{ height: 34, padding: '0 16px', borderRadius: 9, border: 'none', backgroundColor: (input.trim() || pendingFile) && !sending ? C.terracotta : C.sable, color: (input.trim() || pendingFile) && !sending ? C.white : C.grey, fontSize: 14, fontWeight: 600, cursor: (input.trim() || pendingFile) && !sending ? 'pointer' : 'default', transition: 'all 0.15s', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {sending || uploading ? 'Envoi…' : (
                    <>Envoyer <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg></>
                  )}
                </button>
              </div>
            </div>
            {sendErr && (
              <p style={{ margin: '5px 0 0', fontSize: 12, color: C.erreur, lineHeight: 1.4 }}>{sendErr}</p>
            )}
            <div style={{ marginTop: 6, fontSize: 12, color: C.grey, textAlign: 'center' }}>
              Entrée pour envoyer, Maj + Entrée pour aller à la ligne.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
          <span style={{ fontSize: 14, color: C.grey }}>Choisissez une conversation pour l&apos;afficher.</span>
        </div>
      )}

      {retiredConv && (
        <Bandeau
          ref={bandeauRetirRef}
          fixe
          bas={(inputZoneRef.current?.offsetHeight ?? 110) + 16}
          message={`Conversation avec ${retiredConv.conv.entreprise || retiredConv.conv.nom} retirée.`}
          action={{ libelle: 'Annuler', onClick: annulerRetrait }}
        />
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
