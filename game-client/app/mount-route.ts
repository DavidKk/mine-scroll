import { setAppRoot } from './app-root.ts'
import { mountGameSession } from './game-session/index.ts'
import type { AssetLabSection } from './routes.ts'
import { assetLabSectionPath } from './routes.ts'

export type ClientRoute =
  | { type: 'game' }
  | { type: 'puzzle-rush' }
  | { type: 'assets'; section: AssetLabSection; panelId: string | null }
  | { type: 'lab'; panelId: string | null }
  | { type: 'responsive'; panelId: string | null }
  | { type: 'layout-editor'; panelId: string | null }

function mountRouteLoading(root: HTMLElement, label: string): void {
  root.className = 'app app--route-loading'
  root.replaceChildren()
  const main = document.createElement('main')
  main.className = 'route-loading'
  main.setAttribute('aria-busy', 'true')
  main.textContent = label
  root.append(main)
}

function mountLazyRoute(root: HTMLElement, loadingLabel: string, importer: (root: HTMLElement) => Promise<() => void>): () => void {
  let routeCleanup: (() => void) | undefined
  let cancelled = false

  mountRouteLoading(root, loadingLabel)

  void importer(root).then((dispose) => {
    if (cancelled) {
      dispose()
      return
    }
    routeCleanup = dispose
  })

  return () => {
    cancelled = true
    routeCleanup?.()
    root.replaceChildren()
  }
}

export function mountClientRoute(root: HTMLElement, route: ClientRoute): () => void {
  setAppRoot(root)
  root.replaceChildren()

  switch (route.type) {
    case 'puzzle-rush':
      return mountLazyRoute(root, 'Loading Puzzle Rush…', async (mountRoot) => {
        const { mountPuzzleRushSession } = await import('./puzzle-rush-session/index.ts')
        mountRoot.replaceChildren()
        const sessionCleanup = mountPuzzleRushSession(mountRoot)
        return () => {
          sessionCleanup()
          mountRoot.replaceChildren()
        }
      })
    case 'assets':
      return mountLazyRoute(root, 'Loading Asset Lab…', async (mountRoot) => {
        const { mountAssetGallery } = await import('./asset-gallery.ts')
        const { navigateApp } = await import('../navigation.ts')
        mountRoot.replaceChildren()
        return mountAssetGallery(mountRoot, route.section, route.panelId, navigateApp)
      })
    case 'lab':
      return mountLazyRoute(root, 'Loading UI Lab…', async (mountRoot) => {
        const { mountUiLab } = await import('./ui-lab.ts')
        const { navigateApp } = await import('../navigation.ts')
        mountRoot.replaceChildren()
        return mountUiLab(mountRoot, route.panelId, navigateApp)
      })
    case 'responsive':
      return mountLazyRoute(root, 'Loading responsive matrix…', async (mountRoot) => {
        const { mountResponsiveMatrix } = await import('./responsive-matrix.ts')
        const { navigateApp } = await import('../navigation.ts')
        mountRoot.replaceChildren()
        return mountResponsiveMatrix(mountRoot, route.panelId, navigateApp)
      })
    case 'layout-editor':
      return mountLazyRoute(root, 'Loading layout editor…', async (mountRoot) => {
        const { mountLayoutEditor } = await import('./layout-editor.ts')
        const { navigateApp } = await import('../navigation.ts')
        mountRoot.replaceChildren()
        return mountLayoutEditor(mountRoot, route.panelId, navigateApp)
      })
    default: {
      const sessionCleanup = mountGameSession(root)
      return () => {
        sessionCleanup()
        root.replaceChildren()
      }
    }
  }
}

export function canonicalAssetLabRedirectPath(section: AssetLabSection | null): string | null {
  if (section === null) return assetLabSectionPath('sources')
  return null
}
