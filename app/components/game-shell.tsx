'use client'

import '@game-client/ui/boot/boot-screen.css'

import type { ClientRoute } from '@game-client/bootstrap'
import { ensureClientBoot, isClientBootFinished, mountRoute, preloadGameAudio } from '@game-client/bootstrap'
import { registerAppNavigator, unregisterAppNavigator } from '@game-client/navigation'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { AdminShellSkeleton } from '@/app/components/admin-shell-skeleton'
import { BootScreenShell } from '@/app/components/boot-screen-shell'

type GameShellProps = {
  route: ClientRoute
}

function isGameRoute(route: ClientRoute): boolean {
  return route.type === 'game'
}

function isAdminRoute(route: ClientRoute): boolean {
  return route.type !== 'game'
}

function adminShellWithRail(route: ClientRoute): boolean {
  return route.type === 'assets' || route.type === 'lab' || route.type === 'responsive'
}

export function GameShell({ route }: GameShellProps) {
  const isGame = isGameRoute(route)
  const rootRef = useRef<HTMLDivElement>(null)
  const bootScreenRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [showLoader, setShowLoader] = useState(() => !isClientBootFinished())

  useEffect(() => {
    registerAppNavigator(
      (path) => router.push(path),
      (path) => router.replace(path)
    )
    return () => unregisterAppNavigator()
  }, [router])

  useEffect(() => {
    const root = rootRef.current
    const bootScreen = bootScreenRef.current
    if (!root) return

    let disposed = false
    let cleanup: (() => void) | undefined

    void ensureClientBoot({
      bootScreenEl: isGame ? bootScreen : null,
      silent: !isGame,
    }).then(() => {
      if (disposed) return
      if (isGame) preloadGameAudio()
      setShowLoader(false)
      cleanup = mountRoute(root, route)
    })

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [
    isGame,
    route.type,
    route.type === 'assets' ? route.section : '',
    route.type === 'assets' ? route.panelId : '',
    route.type === 'lab' ? route.panelId : '',
    route.type === 'responsive' ? route.panelId : '',
    route.type === 'layout-editor' ? route.panelId : '',
  ])

  return (
    <>
      {showLoader && isGame ? <BootScreenShell ref={bootScreenRef} /> : null}
      {showLoader && !isGame ? <AdminShellSkeleton withRail={adminShellWithRail(route)} withSubnav={isAdminRoute(route)} /> : null}
      <div ref={rootRef} className="game-root" />
    </>
  )
}
