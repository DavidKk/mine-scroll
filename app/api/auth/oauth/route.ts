import { NextResponse } from 'next/server'

import { exchangeOAuthSession } from '@/services/auth/oauth'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string }
    if (!body.token || typeof body.token !== 'string') {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }
    await exchangeOAuthSession(body.token)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth login failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
