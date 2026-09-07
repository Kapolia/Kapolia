import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt         = 'Kapolia — Trouvez votre cap'

export default async function Image() {
  const [loraFont, interFont] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/Lora-Bold.ttf')),
    readFile(join(process.cwd(), 'public/fonts/Inter-Regular.ttf')),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width:           '100%',
          height:          '100%',
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          justifyContent:  'center',
          backgroundColor: '#2C4A3E',
          gap:             '0px',
        }}
      >
        {/* Symbole Kapolia — variante clair */}
        <svg viewBox="0 0 42 42" width={110} height={110}>
          <circle cx="21" cy="21" r="18" fill="#F7F2EB" />
          <path
            d="M14 29 L21 12 L28 29"
            fill="none"
            stroke="#2C4A3E"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 29 L21 25 L28 29"
            fill="none"
            stroke="#C4673A"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div style={{ height: '32px', display: 'flex' }} />

        <div
          style={{
            fontFamily:    'Lora',
            fontSize:      '88px',
            fontWeight:    700,
            color:         '#FFFFFF',
            letterSpacing: '-1px',
            lineHeight:    1,
            display:       'flex',
          }}
        >
          Kapolia
        </div>

        <div style={{ height: '20px', display: 'flex' }} />

        <div
          style={{
            fontFamily: 'Inter',
            fontSize:   '30px',
            color:      '#E8D5B7',
            display:    'flex',
          }}
        >
          Trouvez votre cap.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Lora',  data: loraFont,  weight: 700, style: 'normal' },
        { name: 'Inter', data: interFont, weight: 400, style: 'normal' },
      ],
    },
  )
}
