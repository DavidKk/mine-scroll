import { authenticator } from 'otplib'

import { verify2fa } from '@/services/2fa'

describe('services/2fa', () => {
  it('accepts a valid TOTP token', async () => {
    const secret = authenticator.generateSecret()
    const token = authenticator.generate(secret)
    await expect(verify2fa({ token, secret })).resolves.toBe(true)
  })

  it('rejects invalid tokens', async () => {
    const secret = authenticator.generateSecret()
    await expect(verify2fa({ token: '000000', secret })).resolves.toBe(false)
  })

  it('rejects malformed input without throwing', async () => {
    await expect(verify2fa({ token: '', secret: '' })).resolves.toBe(false)
  })
})
