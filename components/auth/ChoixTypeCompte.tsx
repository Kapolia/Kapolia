'use client'

import { C } from '@/lib/colors'

type TypeCompte = 'candidat' | 'recruteur'

const OPTIONS: Array<{ valeur: TypeCompte; label: string; description: string }> = [
  { valeur: 'candidat',  label: 'Candidat',  description: 'Je cherche un poste' },
  { valeur: 'recruteur', label: 'Recruteur', description: 'Je recrute' },
]

function CarteTypeCompte({
  option,
  selected,
  onClick,
}: {
  option: (typeof OPTIONS)[number]
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="choix-carte"
      style={{
        borderRadius: '12px',
        border: `1.5px solid ${selected ? C.orange : '#D3D9D5'}`,
        padding: '13px 14px 13px 42px',
        backgroundColor: selected ? 'rgba(194,97,31,.05)' : C.white,
        cursor: 'pointer',
        textAlign: 'left',
        position: 'relative',
        width: '100%',
        fontFamily: 'inherit',
      }}
    >
      <span
        className="choix-round"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          border: `1.5px solid ${selected ? C.orange : '#D3D9D5'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <span
          className="choix-dot"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: C.orange,
            transform: selected ? 'scale(1)' : 'scale(0)',
          }}
        />
      </span>

      <span style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: C.dark }}>
        {option.label}
      </span>
      <span style={{ display: 'block', fontSize: '13px', color: C.grey, marginTop: '2px' }}>
        {option.description}
      </span>
    </button>
  )
}

interface ChoixTypeCompteProps {
  valeur: TypeCompte | null
  onChange: (v: TypeCompte) => void
}

export default function ChoixTypeCompte({ valeur, onChange }: ChoixTypeCompteProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ fontSize: '14px', fontWeight: 600, color: C.dark, display: 'block' }}>
        Vous êtes
      </span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {OPTIONS.map(option => (
          <CarteTypeCompte
            key={option.valeur}
            option={option}
            selected={valeur === option.valeur}
            onClick={() => onChange(option.valeur)}
          />
        ))}
      </div>
    </div>
  )
}
