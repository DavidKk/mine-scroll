export function isRankedMode(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('ranked') === '1' || params.get('ranked') === 'true'
}
