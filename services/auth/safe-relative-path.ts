/** Decode and validate post-login relative path; reject open redirects. */
export function safeRelativePath(raw: string | undefined, fallback: string): string {
  if (!raw || typeof raw !== 'string') return fallback
  let path = raw
  try {
    path = decodeURIComponent(raw)
  } catch {
    path = raw
  }
  if (!path.startsWith('/') || path.startsWith('//')) return fallback
  return path
}
