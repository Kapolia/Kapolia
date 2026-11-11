'use client'

import { C } from '@/lib/colors'

export function SelectedPointer() {
  return (
    <>
      <style suppressHydrationWarning>{`
        @keyframes kapolia-pointer-enter { from { scale: 0 } to { scale: 1 } }
      `}</style>
      <div
        aria-hidden
        style={{
          position: 'absolute', right: -7, top: '50%',
          width: 12, height: 12,
          backgroundColor: '#fff',
          borderTop: `2px solid ${C.vert}`,
          borderRight: `2px solid ${C.vert}`,
          borderTopRightRadius: 2,
          translate: '0 -50%',
          rotate: '45deg',
          scale: '0',
          animation: 'kapolia-pointer-enter 220ms cubic-bezier(0.3, 1.6, 0.5, 1) both',
          zIndex: 3,
        }}
      />
    </>
  )
}
