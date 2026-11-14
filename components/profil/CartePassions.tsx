'use client'
import React from 'react'
import ChampSuggestions from '@/components/profil/ChampSuggestions'
import { iconePassion, PASSIONS_SUGGESTIONS } from '@/components/profil/IconesPassions'

type Props = {
  valeurs: string[]
  onChange: (v: string[]) => void
  onMark: () => void
}

export default function CartePassions({ valeurs, onChange, onMark }: Props) {
  return (
    <ChampSuggestions
      valeurs={valeurs}
      onChange={v => { onChange(v); onMark() }}
      suggestions={PASSIONS_SUGGESTIONS}
      max={5}
      placeholder="Écrivez une passion"
      libre
      icone={iconePassion}
    />
  )
}
