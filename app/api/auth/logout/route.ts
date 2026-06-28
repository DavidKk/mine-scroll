import { NextResponse } from 'next/server'

import { logout } from '@/services/auth/login'

export async function POST() {
  await logout()
  return NextResponse.json({ ok: true })
}
