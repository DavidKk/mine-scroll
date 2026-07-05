/** 2px indicator scrollbar: not draggable, position only. */
export interface CustomScrollbarOptions {
  /** Class toggled on the indicator while the view is scrolling. */
  scrollingClass?: string
  /** How long to keep {@link CustomScrollbarOptions.scrollingClass} after scroll stops. */
  scrollingHoldMs?: number
}

export function attachCustomScrollbar(view: HTMLElement, indicator: HTMLElement, thumb: HTMLElement, options: CustomScrollbarOptions = {}): () => void {
  const scrollingClass = options.scrollingClass ?? 'scroll-indicator--scrolling'
  const scrollingHoldMs = options.scrollingHoldMs ?? 420
  let scrollIdleTimer = 0

  function setScrolling(active: boolean): void {
    window.clearTimeout(scrollIdleTimer)
    indicator.classList.toggle(scrollingClass, active)
    if (!active) return
    scrollIdleTimer = window.setTimeout(() => {
      indicator.classList.remove(scrollingClass)
    }, scrollingHoldMs)
  }

  function update(): void {
    const { scrollTop, scrollHeight, clientHeight } = view
    if (scrollHeight <= clientHeight + 1) {
      indicator.classList.add('scroll-indicator--hidden')
      setScrolling(false)
      return
    }
    indicator.classList.remove('scroll-indicator--hidden')
    const track = clientHeight
    const thumbH = Math.max(12, track * (clientHeight / scrollHeight))
    const maxScroll = scrollHeight - clientHeight
    const top = maxScroll > 0 ? (scrollTop / maxScroll) * (track - thumbH) : 0
    thumb.style.height = `${thumbH}px`
    thumb.style.transform = `translateY(${top}px)`
  }

  function onScroll(): void {
    setScrolling(true)
    update()
  }

  view.addEventListener('scroll', onScroll, { passive: true })
  const ro = new ResizeObserver(update)
  ro.observe(view)
  update()

  return () => {
    window.clearTimeout(scrollIdleTimer)
    view.removeEventListener('scroll', onScroll)
    ro.disconnect()
    indicator.classList.remove(scrollingClass)
  }
}

/** Wrap a scrollable region and mount the custom scrollbar. */
export function wrapWithCustomScrollbar(el: HTMLElement, hostClass = '', options: CustomScrollbarOptions = {}): () => void {
  if (el.parentElement?.classList.contains('scroll-host')) {
    const indicator = el.parentElement.querySelector('.scroll-indicator')
    const thumb = el.parentElement.querySelector('.scroll-indicator__thumb')
    if (indicator instanceof HTMLElement && thumb instanceof HTMLElement) {
      return attachCustomScrollbar(el, indicator, thumb, options)
    }
  }

  const host = document.createElement('div')
  host.className = hostClass ? `scroll-host ${hostClass}` : 'scroll-host'

  const indicator = document.createElement('div')
  indicator.className = 'scroll-indicator'
  indicator.setAttribute('aria-hidden', 'true')

  const thumb = document.createElement('div')
  thumb.className = 'scroll-indicator__thumb'
  indicator.append(thumb)

  el.classList.add('scroll-view')
  const parent = el.parentNode
  parent?.insertBefore(host, el)
  host.append(el, indicator)

  const detachScrollbar = attachCustomScrollbar(el, indicator, thumb, options)

  return () => {
    detachScrollbar()
    if (el.parentElement === host && parent) {
      parent.insertBefore(el, host)
    }
    host.remove()
  }
}

/** Page-level scroll indicator (html/body). */
export function attachPageScrollbar(): () => void {
  const indicator = document.createElement('div')
  indicator.className = 'scroll-indicator scroll-indicator--page'
  indicator.setAttribute('aria-hidden', 'true')

  const thumb = document.createElement('div')
  thumb.className = 'scroll-indicator__thumb'
  indicator.append(thumb)
  document.body.append(indicator)

  function metrics(): { scrollTop: number; scrollHeight: number; clientHeight: number } {
    const el = document.documentElement
    return {
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }
  }

  function update(): void {
    const { scrollTop, scrollHeight, clientHeight } = metrics()
    if (scrollHeight <= clientHeight + 1) {
      indicator.classList.add('scroll-indicator--hidden')
      return
    }
    indicator.classList.remove('scroll-indicator--hidden')
    const track = clientHeight
    const thumbH = Math.max(12, track * (clientHeight / scrollHeight))
    const maxScroll = scrollHeight - clientHeight
    const top = maxScroll > 0 ? (scrollTop / maxScroll) * (track - thumbH) : 0
    thumb.style.height = `${thumbH}px`
    thumb.style.transform = `translateY(${top}px)`
  }

  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update, { passive: true })
  update()

  return () => {
    window.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
    indicator.remove()
  }
}
