/** Inline Heroicons (outline 24) for vanilla DOM — matches @heroicons/react usage in sibling projects. */

export type HeroiconName = 'x-mark' | 'trash' | 'clipboard-document'

const PATHS: Record<HeroiconName, string> = {
  'x-mark': '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />',
  trash:
    '<path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />',
  'clipboard-document':
    '<path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.118a2.25 2.25 0 0 0-2.437-1.877L9.23 1.63a2.25 2.25 0 0 0-2.437 1.877L5.52 6.75h11.96l-1.873-3.632ZM4.5 8.25v9a2.25 2.25 0 0 0 2.25 2.25h9A2.25 2.25 0 0 0 18 17.25V8.25H4.5Z" />',
}

export function createHeroicon(name: HeroiconName, className = 'ui-icon'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.75')
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add(className)
  svg.innerHTML = PATHS[name]
  return svg
}
