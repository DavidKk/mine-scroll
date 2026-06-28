'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Client redirect avoids React dev-mode performance.measure errors from server redirect(). */
export default function NotFound() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/play')
  }, [router])

  return null
}
