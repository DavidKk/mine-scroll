import { readRequestCountryCode, sanitizeCountryCode } from '@/services/geoip/request'

describe('services/geoip/request', () => {
  it('sanitizes valid ISO country codes', () => {
    expect(sanitizeCountryCode('cn')).toBe('CN')
    expect(sanitizeCountryCode(' US ')).toBe('US')
  })

  it('rejects invalid country codes', () => {
    expect(sanitizeCountryCode('')).toBeUndefined()
    expect(sanitizeCountryCode('USA')).toBeUndefined()
    expect(sanitizeCountryCode('12')).toBeUndefined()
    expect(sanitizeCountryCode(null)).toBeUndefined()
  })

  it('reads x-vercel-ip-country from request headers', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-vercel-ip-country': 'jp' },
    })

    expect(readRequestCountryCode(request)).toBe('JP')
  })

  it('returns undefined when geo header is missing', () => {
    const request = new Request('https://example.com')
    expect(readRequestCountryCode(request)).toBeUndefined()
  })
})
