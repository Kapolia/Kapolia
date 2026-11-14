'use client'
import React from 'react'
import { C } from '@/lib/colors'
import { COMP_REF } from '@/lib/referentiels'
import ChampSuggestions from '@/components/profil/ChampSuggestions'

const SUGGESTIONS_COMP = Object.values(COMP_REF).flat()

type Props = {
  valeurs: string[]
  onChange: (v: string[]) => void
  onMark: () => void
}

export default function CarteCompetences({ valeurs, onChange, onMark }: Props) {
  return (
    <>
      <p style={{ fontSize: 13.5, color: C.grey, margin: '0 0 16px' }}>
        Celles qui correspondent aux offres seront mises en avant pour le recruteur.
      </p>
      <ChampSuggestions
        valeurs={valeurs}
        onChange={v => { onChange(v); onMark() }}
        suggestions={SUGGESTIONS_COMP}
        max={100}
        placeholder="Ajoutez une compétence…"
        libre
      />
    </>
  )
}
