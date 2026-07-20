'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { GeoVilleInput, type GeoCoords } from '@/components/GeoVilleInput'

const RadiusMap = dynamic(() => import('@/components/RadiusMap'), { ssr: false })

const C = {
  terracotta: '#C4673A',
  sable:      '#E8D5B7',
  creme:      '#F7F2EB',
  vert:       '#2C4A3E',
  dark:       '#1A1A1A',
  grey:       '#6B6B6B',
  white:      '#FFFFFF',
}

const STEPS = [0, 10, 25, 50, 100]

function stepLabel(km: number) {
  return km === 0 ? 'Ville exacte' : `+ ${km} km`
}

function summary(ville: string, rayon: number) {
  if (!ville) return ''
  return rayon === 0 ? ville : `${ville} + ${rayon} km`
}

export function LieuRadiusPopover({
  lieu,
  rayon,
  coords,
  onConfirm,
  dark = false,
  compact = false,
}: {
  lieu: string
  rayon: number
  coords: GeoCoords | null
  onConfirm: (lieu: string, rayon: number, coords: GeoCoords | null) => void
  dark?: boolean
  compact?: boolean
}) {
  const [open, setOpen]           = useState(false)
  const [isMobile, setIsMobile]   = useState(false)

  // Draft state inside the popover (committed only on Valider)
  const [draftVille, setDraftVille]   = useState(lieu)
  const [draftRayon, setDraftRayon]   = useState(rayon)
  const [draftCoords, setDraftCoords] = useState<GeoCoords | null>(coords)

  const wrapRef    = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [popPos, setPopPos] = useState({ top: 0, left: 0, width: 420 })

  // Sync draft from external values only when closed (reset / URL restore)
  useEffect(() => {
    if (open) return
    setDraftVille(lieu); setDraftRayon(rayon); setDraftCoords(coords)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lieu, rayon, coords])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])


  function openPopover() {
    if (triggerRef.current && !isMobile) {
      const r   = triggerRef.current.getBoundingClientRect()
      const w   = 420
      // Prefer aligning to the left edge; clamp so it doesn't overflow right
      const left = Math.min(r.left, window.innerWidth - w - 12)
      setPopPos({ top: r.bottom + 6, left: Math.max(8, left), width: w })
    }
    setOpen(true)
  }

  function close() { setOpen(false) }

  function handleConfirm() {
    onConfirm(draftVille, draftRayon, draftCoords)
    close()
  }

  function handleClearAll() {
    setDraftVille('')
    setDraftRayon(25)
    setDraftCoords(null)
    onConfirm('', 25, null)
    close()
  }

  const sliderIdx = Math.max(0, STEPS.indexOf(draftRayon))

  function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    setDraftRayon(STEPS[parseInt(e.target.value)] ?? 25)
  }

  // ── Trigger label ──────────────────────────────────────────────────────────
  const displayText = summary(lieu, rayon)
  const hasFilter   = !!lieu

  const triggerBg     = dark ? (hasFilter ? C.creme   : 'transparent')            : (hasFilter ? C.vert  : C.white)
  const triggerBorder = dark ? (hasFilter ? C.creme   : 'rgba(255,255,255,0.30)') : (hasFilter ? C.vert  : C.sable)
  const triggerColor  = dark ? (hasFilter ? C.vert    : 'rgba(255,255,255,0.90)') : (hasFilter ? C.white : C.dark)

  const pct = `${(sliderIdx / (STEPS.length - 1)) * 100}%`

  const popoverContent = (
    <div
      style={{
        backgroundColor: C.white,
        borderRadius: isMobile ? '20px 20px 0 0' : 14,
        boxShadow: isMobile ? '0 -6px 40px rgba(0,0,0,0.18)' : '0 8px 40px rgba(0,0,0,0.18)',
        padding: '20px 20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <style>{`
        .kavio-radius-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 5px;
          background: transparent;
          cursor: pointer;
          outline: none;
          padding: 0;
          margin: 0;
        }
        .kavio-radius-slider::-webkit-slider-runnable-track {
          height: 5px;
          border-radius: 99px;
          background: linear-gradient(
            to right,
            ${C.vert} 0% var(--pct),
            ${C.sable} var(--pct) 100%
          );
        }
        .kavio-radius-slider::-moz-range-track {
          height: 5px;
          border-radius: 99px;
          background: ${C.sable};
        }
        .kavio-radius-slider::-moz-range-progress {
          height: 5px;
          border-radius: 99px;
          background: ${C.vert};
        }
        .kavio-radius-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${C.terracotta};
          margin-top: -6.5px;
          box-shadow: 0 2px 8px rgba(196,103,58,0.40);
          cursor: pointer;
          transition: transform 0.12s;
        }
        .kavio-radius-slider::-webkit-slider-thumb:hover {
          transform: scale(1.18);
        }
        .kavio-radius-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${C.terracotta};
          border: none;
          box-shadow: 0 2px 8px rgba(196,103,58,0.40);
          cursor: pointer;
        }
      `}</style>
      {/* Handle bar (mobile only) */}
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: -4, marginTop: -8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.sable }} />
        </div>
      )}

      {/* Title */}
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700, color: C.dark }}>
        Zone de recherche
      </div>

      {/* Autocomplete ville */}
      <GeoVilleInput
        value={draftVille}
        onChange={setDraftVille}
        onCoordsChange={setDraftCoords}
        placeholder="Ville, région…"
      />

      {/* Slider rayon */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: C.grey, fontWeight: 500 }}>Rayon</span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: C.terracotta,
            backgroundColor: `${C.terracotta}12`, padding: '3px 10px', borderRadius: 20,
          }}>
            {stepLabel(draftRayon)}
          </span>
        </div>

        {/* Custom segmented slider */}
        <div style={{ position: 'relative', padding: '6px 0' }}>
          <input
            type="range"
            min={0}
            max={STEPS.length - 1}
            step={1}
            value={sliderIdx}
            onChange={handleSlider}
            className="kavio-radius-slider"
            style={{ '--pct': pct } as React.CSSProperties}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 4, paddingBottom: 2,
          }}>
            {STEPS.map(s => (
              <span key={s} style={{
                fontSize: 10, color: draftRayon === s ? C.terracotta : C.grey,
                fontWeight: draftRayon === s ? 700 : 400, transition: 'color 0.12s',
              }}>
                {s === 0 ? 'Exacte' : `${s} km`}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      {draftCoords && (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.sable}` }}>
          <RadiusMap lat={draftCoords.lat} lng={draftCoords.lng} radiusKm={draftRayon} />
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        {hasFilter && (
          <button
            onClick={handleClearAll}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 500,
              border: `1.5px solid ${C.sable}`, backgroundColor: C.white,
              color: C.grey, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background-color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.creme)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = C.white)}
          >
            Effacer
          </button>
        )}
        <button
          onClick={handleConfirm}
          style={{
            flex: 2, padding: '11px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
            border: 'none', backgroundColor: C.terracotta, color: C.white,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Valider
        </button>
      </div>
    </div>
  )

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0, zIndex: open ? 601 : undefined }}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={openPopover}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: compact ? '13px 14px' : '11px 16px', borderRadius: 10, fontSize: compact ? 15 : 14,
          border: `1.5px solid ${triggerBorder}`,
          backgroundColor: triggerBg, color: triggerColor,
          cursor: 'pointer', fontFamily: 'inherit', fontWeight: hasFilter ? 600 : 400,
          whiteSpace: 'nowrap', transition: 'all 0.12s',
        }}
      >
        <span style={{ fontSize: 13, opacity: 0.8 }}>◎</span>
        {displayText || 'Lieu'}
        {hasFilter && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); handleClearAll() }}
            style={{ fontSize: 16, lineHeight: 1, opacity: 0.65, marginLeft: 2 }}
          >
            ×
          </span>
        )}
      </button>

      {/* Desktop — overlay transparent ferme au clic extérieur, popover par-dessus */}
      {open && !isMobile && (
        <>
          <div
            onClick={close}
            style={{ position: 'fixed', inset: 0, zIndex: 598 }}
          />
          <div style={{
            position: 'fixed',
            top: popPos.top,
            left: popPos.left,
            width: popPos.width,
            zIndex: 600,
          }}>
            {popoverContent}
          </div>
        </>
      )}

      {/* Mobile bottom-sheet */}
      {open && isMobile && (
        <>
          <div
            onClick={close}
            style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
              zIndex: 599, backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            zIndex: 600, maxHeight: '90vh', overflowY: 'auto',
          }}>
            {popoverContent}
          </div>
        </>
      )}
    </div>
  )
}
