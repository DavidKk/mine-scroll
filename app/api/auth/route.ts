import { NextResponse } from 'next/server'

import { login } from '@/services/auth/login'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string
      password?: string
      token?: string
      rememberMe?: boolean
    }
    await login(body.username ?? '', body.password ?? '', body.token ?? '', body.rememberMe === true)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
