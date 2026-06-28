import { safeRelativePath } from '@/services/auth/safe-relative-path'

describe('services/auth/safe-relative-path', () => {
  const fallback = '/admin/assets/sources'

  it('returns fallback for missing or empty values', () => {
    expect(safeRelativePath(undefined, fallback)).toBe(fallback)
    expect(safeRelativePath('', fallback)).toBe(fallback)
  })

  it('accepts safe relative paths', () => {
    expect(safeRelativePath('/admin/lab', fallback)).toBe('/admin/lab')
    expect(safeRelativePath(encodeURIComponent('/admin/assets/sprites'), fallback)).toBe('/admin/assets/sprites')
  })

  it('rejects open redirects and non-relative paths', () => {
    expect(safeRelativePath('https://evil.example/phish', fallback)).toBe(fallback)
    expect(safeRelativePath('//evil.example/phish', fallback)).toBe(fallback)
    expect(safeRelativePath('admin/lab', fallback)).toBe(fallback)
  })

  it('keeps raw path when decodeURIComponent fails', () => {
    expect(safeRelativePath('%E0%A4%A', fallback)).toBe(fallback)
  })
})
