/** Ranked is on by default; opt out with `?arcade=1` or `?ranked=false`. */
export function isRankedMode(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('arcade') === '1' || params.get('arcade') === 'true') return false
  if (params.get('ranked') === '0' || params.get('ranked') === 'false') return false
  return true
}
