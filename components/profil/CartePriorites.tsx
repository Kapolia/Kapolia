'use client'
import React from 'react'
import ChampSuggestions from '@/components/profil/ChampSuggestions'

const PRIORITES = [
  'Impact réel', 'Équipe soudée', 'Salaire compétitif',
  'Évolution rapide', 'Sens & mission', 'Flexibilité horaire',
  'Apprentissage continu', 'Autonomie', 'Stabilité',
]

type Props = {
  valeurs: string[]
  onChange: (v: string[]) => void
  onMark: () => void
}

export default function CartePriorites({ valeurs, onChange, onMark }: Props) {
  return (
    <ChampSuggestions
      valeurs={valeurs}
      onChange={v => { onChange(v); onMark() }}
      suggestions={PRIORITES}
      max={3}
      placeholder="Écrivez ce qui compte pour vous"
      libre
    />
  )
}
