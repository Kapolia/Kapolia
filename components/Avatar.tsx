'use client'

const DEFAULT_COLOR = '#C4673A'

const SIZES: Record<'sm' | 'md' | 'lg', { px: number; fontSize: number }> = {
  sm: { px: 36, fontSize: 13 },
  md: { px: 52, fontSize: 18 },
  lg: { px: 80, fontSize: 28 },
}

export type AvatarProfil = {
  avatar_url?: string | null
  avatar_type?: string | null
  prenom?: string | null
  nom?: string | null
}

export default function Avatar({
  profil,
  size = 'md',
  style: extraStyle = {},
}: {
  profil: AvatarProfil
  size?: 'sm' | 'md' | 'lg'
  style?: React.CSSProperties
}) {
  const { px, fontSize } = SIZES[size]
  const initials = `${profil.prenom?.[0] ?? ''}${profil.nom?.[0] ?? ''}`.toUpperCase() || 'K'

  const base: React.CSSProperties = {
    width: px, height: px, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
    ...extraStyle,
  }

  if (profil.avatar_type === 'photo' && profil.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={profil.avatar_url} alt={initials} style={{ ...base, objectFit: 'cover' }} />
  }

  if (profil.avatar_type === 'avatar' && profil.avatar_url) {
    return (
      <div style={{ ...base, backgroundColor: '#EFEFEF', fontSize: px * 0.5 }}>
        {profil.avatar_url}
      </div>
    )
  }

  const bgColor =
    profil.avatar_type === 'initiales' && profil.avatar_url
      ? profil.avatar_url
      : DEFAULT_COLOR

  return (
    <div style={{ ...base, backgroundColor: bgColor }}>
      <span style={{ fontSize, fontWeight: 700, color: '#FFFFFF', fontFamily: 'Georgia, serif', lineHeight: 1 }}>
        {initials}
      </span>
    </div>
  )
}

