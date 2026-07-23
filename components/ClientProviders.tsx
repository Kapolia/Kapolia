'use client'

import { FavorisProvider } from '@/lib/favoris-context'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return <FavorisProvider>{children}</FavorisProvider>
}
