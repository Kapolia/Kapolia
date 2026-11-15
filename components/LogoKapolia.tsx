import { FONT_LOGO } from '@/lib/typography'
import { C } from '@/lib/colors'

export type Variante = 'sombre' | 'clair' | 'contour' | 'terracotta' | 'monochrome'

interface Props {
  variante?:        Variante
  avecTexte?:       boolean
  taille?:          number | string
  couleur?:         string
  className?:       string
  style?:           React.CSSProperties
  needleClassName?: string
}

type Cfg = {
  disque:  string | null
  bordure: string | null
  pointe:  string
  base:    string
  texte:   string
}

function getConfig(variante: Variante, couleur: string): Cfg {
  switch (variante) {
    case 'sombre':
      return { disque: C.vert,  bordure: null,    pointe: C.white,  base: C.orange, texte: C.vert   }
    case 'clair':
      return { disque: C.bg,    bordure: null,    pointe: C.vert,   base: C.orange, texte: C.white  }
    case 'contour':
      return { disque: null,    bordure: C.sable, pointe: C.white,  base: C.orange, texte: C.sable  }
    case 'terracotta':
      return { disque: C.vert,  bordure: null,    pointe: C.white,  base: C.sable,  texte: C.sable  }
    case 'monochrome':
      return { disque: couleur, bordure: null,    pointe: couleur,  base: couleur,  texte: couleur  }
  }
}

export default function LogoKapolia({
  variante  = 'sombre',
  avecTexte = true,
  taille    = 36,
  couleur   = C.vert,
  className,
  style,
  needleClassName,
}: Props) {
  const c = getConfig(variante, couleur)

  // Below 20 px the fine strokes collapse : thicker paths + r=21 (flush to viewBox edge)
  const isSmall = typeof taille === 'number' && taille <= 20

  const px = typeof taille === 'number' ? `${taille}px` : taille

  const symbol = (
    <svg
      viewBox="0 0 42 42"
      width={taille}
      height={taille}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', width: px, height: px }}
    >
      {c.disque !== null
        ? <circle cx="21" cy="21" r={isSmall ? 20 : 18} fill={c.disque} />
        : <circle cx="21" cy="21" r={isSmall ? 20 : 18} fill="none" stroke={c.bordure!} strokeWidth={isSmall ? '2.4' : '1.6'} />
      }
      <g
        className={needleClassName}
        style={needleClassName ? { transformBox: 'view-box', transformOrigin: 'center' } : undefined}
      >
        <path
          d="M14 29 L21 12 L28 29"
          fill="none"
          stroke={c.pointe}
          strokeWidth={isSmall ? '4.4' : '2.6'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 29 L21 25 L28 29"
          fill="none"
          stroke={c.base}
          strokeWidth={isSmall ? '4.4' : '2.6'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )

  if (!avecTexte) {
    return (
      <span
        className={className}
        style={{ display: 'inline-block', lineHeight: 0, ...style }}
      >
        {symbol}
      </span>
    )
  }

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', ...style }}
    >
      {symbol}
      <span
        style={{
          fontFamily: FONT_LOGO, letterSpacing: '-0.005em',
          fontWeight: 600,
          fontSize:   typeof taille === 'number' ? `${Math.round(taille * 0.56)}px` : undefined,
          color:      c.texte,
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        Kapolia
      </span>
    </span>
  )
}
