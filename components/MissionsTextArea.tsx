'use client'

import { useState } from 'react'
import { MAX_MISSIONS } from '@/lib/onboarding-utils'

interface Props {
  value: string
  onChange: (v: string) => void
  rows?: number
  textareaStyle?: React.CSSProperties
}

export default function MissionsTextArea({ value, onChange, rows = 3, textareaStyle }: Props) {
  const [pasteNote, setPasteNote] = useState('')

  const nonEmptyCount = value.split('\n').filter(l => l.trim()).length
  const isOver        = nonEmptyCount > MAX_MISSIONS

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && nonEmptyCount >= MAX_MISSIONS) {
      e.preventDefault()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = e.clipboardData.getData('text')
    const pastedLines = pasted.split('\n').filter(l => l.trim())
    if (pastedLines.length === 0) return

    e.preventDefault()

    const currentLines = value.split('\n').filter(l => l.trim())
    const slotsLeft    = Math.max(0, MAX_MISSIONS - currentLines.length)

    if (slotsLeft === 0) {
      const n = pastedLines.length
      setPasteNote(`${n} ligne${n > 1 ? 's' : ''} non retenue${n > 1 ? 's' : ''}.`)
      setTimeout(() => setPasteNote(''), 4000)
      return
    }

    const toAdd   = pastedLines.slice(0, slotsLeft)
    const dropped = pastedLines.length - toAdd.length
    const sep     = value === '' || value.endsWith('\n') ? '' : '\n'
    onChange(value + sep + toAdd.join('\n'))

    if (dropped > 0) {
      setPasteNote(`${dropped} ligne${dropped > 1 ? 's' : ''} non retenue${dropped > 1 ? 's' : ''}.`)
      setTimeout(() => setPasteNote(''), 4000)
    }
  }

  return (
    <div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={`Missions principales, une par ligne, ${MAX_MISSIONS} au maximum`}
        rows={rows}
        style={textareaStyle}
      />
      <div style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 11, color: isOver ? '#C4673A' : '#9CA3AF' }}>
            {nonEmptyCount} / {MAX_MISSIONS}
          </span>
          {pasteNote && (
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{pasteNote}</span>
          )}
        </div>
        {isOver && (
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
            Seules les {MAX_MISSIONS} premières missions apparaissent sur votre profil.
          </p>
        )}
      </div>
    </div>
  )
}
