interface BoussoleKapoliaProps {
  size?: number | string
  ringColor?: string
  ringFill?: string
  northColor?: string
  southColor?: string
  centerColor?: string
  rotation?: number
  needleClassName?: string
  className?: string
  style?: React.CSSProperties
}

export default function BoussoleKapolia({
  size = 48,
  ringColor = '#2C4A3E',
  ringFill = 'white',
  northColor = '#C4673A',
  southColor = '#2C4A3E',
  centerColor = 'white',
  rotation = 35,
  needleClassName,
  className,
  style,
}: BoussoleKapoliaProps) {
  return (
    <svg
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden
    >
      <circle r="46" fill={ringFill} stroke={ringColor} strokeWidth="6" />
      <g
        transform={`rotate(${rotation})`}
        className={needleClassName}
        style={needleClassName ? { transformBox: 'fill-box', transformOrigin: 'center' } : undefined}
      >
        <polygon points="0,-40 -8.5,0 8.5,0" fill={northColor} />
        <polygon points="0,40 8.5,0 -8.5,0" fill={southColor} />
      </g>
      <circle r="5" fill={centerColor} />
    </svg>
  )
}
