/** Default play uses challenge (human advanced). Opt in to ranked expert with `?ranked=1`. */
export function isRankedMode(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('ranked') === '1' || params.get('ranked') === 'true'
}
