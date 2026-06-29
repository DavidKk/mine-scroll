import type { GameCanvasRuntime } from '../runtime/context.ts'
import { useDesktopMouseInput, useTouchPointerInput } from './input-profile.ts'
import { onContextMenu, onDoubleClick, onMouseDown, onMouseLeave, onMouseMove, onMouseUp, onPointerCancel, onPointerDown, onPointerMove, onPointerUp } from './pointer-handlers.ts'

export interface CanvasInputBindings {
  mode: 'mobile' | 'desktop'
  unbind(): void
}

export function bindCanvasInputListeners(rt: GameCanvasRuntime): CanvasInputBindings | null {
  if (typeof window === 'undefined') return null

  const mobile = useTouchPointerInput(rt.state.width)
  const desktop = useDesktopMouseInput(rt.state.width)
  if (!mobile && !desktop) return null

  const mode = mobile ? 'mobile' : 'desktop'
  const canvas = rt.canvas
  const cleanups: Array<() => void> = []

  const add = (target: EventTarget, type: string, handler: EventListener, options?: boolean | AddEventListenerOptions) => {
    target.addEventListener(type, handler, options)
    cleanups.push(() => target.removeEventListener(type, handler, options))
  }

  if (desktop) {
    const handleMouseDown = (e: Event) => onMouseDown(rt, e as MouseEvent)
    const handleMouseMove = (e: Event) => onMouseMove(rt, e as MouseEvent)
    const handleMouseUp = (e: Event) => onMouseUp(rt, e as MouseEvent)
    const handleMouseLeave = () => onMouseLeave(rt)
    const handleContextMenu = (e: Event) => onContextMenu(rt, e as MouseEvent)
    const handleDoubleClick = (e: Event) => onDoubleClick(rt, e as MouseEvent)

    add(canvas, 'mousedown', handleMouseDown)
    add(canvas, 'mousemove', handleMouseMove)
    add(canvas, 'mouseup', handleMouseUp)
    add(canvas, 'mouseleave', handleMouseLeave)
    add(window, 'mouseup', handleMouseUp)
    add(canvas, 'contextmenu', handleContextMenu)
    add(canvas, 'dblclick', handleDoubleClick)
  }

  if (mobile) {
    const handlePointerDown = (e: Event) => onPointerDown(rt, e as PointerEvent)
    const handlePointerMove = (e: Event) => onPointerMove(rt, e as PointerEvent)
    const handlePointerUp = (e: Event) => onPointerUp(rt, e as PointerEvent)
    const handlePointerCancel = (e: Event) => onPointerCancel(rt, e as PointerEvent)

    add(canvas, 'pointerdown', handlePointerDown)
    add(canvas, 'pointermove', handlePointerMove)
    add(canvas, 'pointerup', handlePointerUp)
    add(canvas, 'pointercancel', handlePointerCancel)
    add(window, 'pointerup', handlePointerUp)
    add(window, 'pointercancel', handlePointerCancel)
  }

  return {
    mode,
    unbind() {
      for (const cleanup of cleanups) cleanup()
    },
  }
}

export function rebindCanvasInputListeners(rt: GameCanvasRuntime): void {
  const mobile = useTouchPointerInput(rt.state.width)
  const desktop = useDesktopMouseInput(rt.state.width)
  const nextMode = mobile ? 'mobile' : desktop ? 'desktop' : null
  if (nextMode === rt.inputBindings?.mode) return

  rt.inputBindings?.unbind()
  rt.inputBindings = bindCanvasInputListeners(rt) ?? undefined
}
