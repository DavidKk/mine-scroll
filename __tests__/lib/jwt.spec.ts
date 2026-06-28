import { generateToken, parseExpirationSeconds, verifyJwtWithSecret, verifyToken } from '@/lib/jwt'

const TEST_SECRET = 'unit-test-jwt-secret'

describe('lib/jwt', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, JWT_SECRET: TEST_SECRET }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('parseExpirationSeconds', () => {
    it('parses numeric seconds', () => {
      expect(parseExpirationSeconds(3600)).toBe(3600)
      expect(parseExpirationSeconds('120')).toBe(120)
    })

    it('parses duration suffixes', () => {
      expect(parseExpirationSeconds('7d')).toBe(7 * 86400)
      expect(parseExpirationSeconds('12h')).toBe(12 * 3600)
      expect(parseExpirationSeconds('30m')).toBe(30 * 60)
      expect(parseExpirationSeconds('45s')).toBe(45)
    })

    it('falls back to one day for unknown strings', () => {
      expect(parseExpirationSeconds('not-a-duration')).toBe(86400)
    })
  })

  describe('generateToken / verifyToken', () => {
    it('round-trips payload with authenticated claim', async () => {
      const token = await generateToken({ authenticated: true, sub: 'alice', provider: 'local' }, { expiresIn: '1h' })
      const payload = await verifyToken(token)
      expect(payload).toMatchObject({ authenticated: true, sub: 'alice', provider: 'local' })
      expect(typeof payload?.iat).toBe('number')
      expect(typeof payload?.exp).toBe('number')
    })

    it('rejects tampered tokens', async () => {
      const token = await generateToken({ authenticated: true })
      const tampered = `${token}x`
      expect(await verifyToken(tampered)).toBeNull()
    })

    it('rejects expired tokens', async () => {
      jest.useFakeTimers()
      const token = await generateToken({ authenticated: true }, { expiresIn: 1 })
      jest.advanceTimersByTime(2000)
      expect(await verifyToken(token)).toBeNull()
      jest.useRealTimers()
    })

    it('throws when JWT_SECRET is missing', async () => {
      delete process.env.JWT_SECRET
      await expect(generateToken({ authenticated: true })).rejects.toThrow('JWT_SECRET')
    })
  })

  describe('verifyJwtWithSecret', () => {
    it('verifies with an arbitrary secret', async () => {
      const otherSecret = 'other-secret-key'
      process.env.JWT_SECRET = otherSecret
      const token = await generateToken({ authenticated: true, username: 'bob' })
      expect(await verifyJwtWithSecret(token, otherSecret)).toMatchObject({ username: 'bob' })
      expect(await verifyJwtWithSecret(token, 'wrong-secret')).toBeNull()
    })
  })
})
