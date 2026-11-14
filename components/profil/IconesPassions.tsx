import React from 'react'
import { C } from '@/lib/colors'

// ─── Icônes SVG (12 familles + générique) ─────────────────────────────────────

type IconProps = { size?: number }

function IconMusique({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  )
}

function IconSport({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

function IconLecture({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  )
}

function IconVoyage({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  )
}

function IconCuisine({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/>
      <line x1="10" y1="1" x2="10" y2="4"/>
      <line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  )
}

function IconJeux({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <line x1="6" y1="12" x2="10" y2="12"/>
      <line x1="8" y1="10" x2="8" y2="14"/>
      <circle cx="15" cy="11" r="1" fill={C.vert} stroke="none"/>
      <circle cx="18" cy="13" r="1" fill={C.vert} stroke="none"/>
    </svg>
  )
}

function IconPhoto({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

function IconArt({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  )
}

function IconCinema({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18"/>
      <line x1="7" y1="2" x2="7" y2="22"/>
      <line x1="17" y1="2" x2="17" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="2" y1="7" x2="7" y2="7"/>
      <line x1="17" y1="7" x2="22" y2="7"/>
      <line x1="17" y1="17" x2="22" y2="17"/>
      <line x1="2" y1="17" x2="7" y2="17"/>
    </svg>
  )
}

function IconTech({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )
}

function IconNature({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20l5-9 4 5 3-4 5 8z"/>
      <line x1="3" y1="20" x2="21" y2="20"/>
    </svg>
  )
}

function IconBienEtre({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

function IconGenerique({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={C.vert} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 8v4l3 3"/>
    </svg>
  )
}

// ─── Matching par mots-clés ───────────────────────────────────────────────────

const FAMILLES: { test: (n: string) => boolean; Icone: (p: IconProps) => React.ReactElement }[] = [
  {
    test: n => /musiq|guitare|piano|chant|instrument|jazz|rock|basse|violon|batterie|harp|clarinet/i.test(n),
    Icone: IconMusique,
  },
  {
    test: n => /sport|football|basket|tennis|natation|running|vélo|velo|fitness|rugby|volley|handball|athlét|boxe|judo|karaté|karat|cycl|triathlon|equitation/i.test(n),
    Icone: IconSport,
  },
  {
    test: n => /lectur|livre|roman|littérat|biblioth|poésie|poesie|manga|bd|bandes dessinées|bande dessin/i.test(n),
    Icone: IconLecture,
  },
  {
    test: n => /voyage|voyag|explorer|découverte|découvrir|backpack|randonn|trek|montagne|escalade|ski|alpinis/i.test(n),
    Icone: IconVoyage,
  },
  {
    test: n => /cuisin|gastrono|pâtisseri|patisseri|boulanger|cocktail|oenolog|vin|brassage|ferment/i.test(n),
    Icone: IconCuisine,
  },
  {
    test: n => /jeux|gaming|jeu vidéo|jeu video|esport|dnd|donjons|tabletop|jeux de société|jeux de societe|jeu de rôle|jeu de role|echecs|échecs/i.test(n),
    Icone: IconJeux,
  },
  {
    test: n => /photo|photographie|photographe|film photo|argentique|portrait/i.test(n),
    Icone: IconPhoto,
  },
  {
    test: n => /art|dessin|peinture|aquarelle|illustration|calligraphie|sculptur|céramiqu|ceramiq|graffiti|maroquin|bijou|broderie/i.test(n),
    Icone: IconArt,
  },
  {
    test: n => /cinéma|cinema|film|series|série|animation|théâtre|theatre|stand-up|standup|opéra|opera|spectacle/i.test(n),
    Icone: IconCinema,
  },
  {
    test: n => /tech|technolog|informatiqu|développement|develop|code|programm|ia |intelligence artificielle|robot|hacking|cybersecur|raspberry|arduino/i.test(n),
    Icone: IconTech,
  },
  {
    test: n => /natur|randonn|montagne|escalade|plongée|plongee|surf|ski|snowboard|jardin|forêt|foret|plein air|camping|chasse|pêche|peche|apicultur/i.test(n),
    Icone: IconNature,
  },
  {
    test: n => /yoga|danse|méditation|meditation|bien-être|bien etre|pilates|sophrolog|relaxation|mindfulness|zumba|salsa|tango/i.test(n),
    Icone: IconBienEtre,
  },
]

export function iconePassion(texte: string): React.ReactNode {
  for (const famille of FAMILLES) {
    if (famille.test(texte)) return <famille.Icone size={20} />
  }
  return <IconGenerique size={20} />
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

export const PASSIONS_SUGGESTIONS: string[] = [
  'Musique', 'Sport', 'Lecture', 'Voyage', 'Cuisine',
  'Gaming', 'Photographie', 'Dessin', 'Cinéma', 'Technologie',
  'Randonnée', 'Yoga', 'Guitare', 'Pâtisserie', 'Piano',
  'Danse', 'Nature', 'Écriture', 'Montagne', 'Podcasts',
  'Vélo', 'Peinture', 'Jardinage', 'Plongée', 'Surf',
  'Escalade', 'Méditation', 'DIY', 'Couture', 'Cocktails',
  'Ski', 'Moto', 'Aquarelle', 'Jeux de société', 'Tennis',
  'Natation', 'Astronomie', 'Théâtre', 'Bénévolat', 'Arts martiaux',
]
