import { authenticator } from 'otplib'

export interface Verify2faParams {
  token: string
  secret: string
}

export async function verify2fa(params: Verify2faParams): Promise<boolean> {
  const { token, secret } = params
  try {
    return authenticator.check(token, secret)
  } catch {
    return false
  }
}
