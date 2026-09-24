interface Props {
  count:  number
  max:    number
  theme?: 'light' | 'dark'
}

export default function SignatureCounter({ count, max, theme = 'light' }: Props) {
  const warnAt     = Math.floor(max * 0.9)
  const isAlert    = count >= warnAt || count > max
  const normalColor = theme === 'dark' ? 'rgba(255,255,255,0.45)' : '#AAAAAA'

  return (
    <div style={{
      textAlign:  'right',
      fontSize:   11,
      marginTop:  4,
      color:      isAlert ? '#C4673A' : normalColor,
      transition: 'color 0.2s',
    }}>
      {count}/{max}
    </div>
  )
}
