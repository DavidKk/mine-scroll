#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Start Next dev server + ngrok tunnel for mobile testing.
 *
 * Requires NGROK_AUTHTOKEN in .env (see .env.example).
 * Usage: pnpm dev:ngrok
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.DEV_HOST || '0.0.0.0'

function loadEnvFile() {
  const envPath = path.join(rootDir, '.env')
  if (!fs.existsSync(envPath)) return
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function waitForPort(port, host = '127.0.0.1', timeoutMs = 120_000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, host, () => {
        socket.end()
        resolve()
      })
      socket.on('error', () => {
        socket.destroy()
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for http://${host}:${port}`))
          return
        }
        setTimeout(attempt, 400)
      })
    }
    attempt()
  })
}

function printBanner(publicUrl) {
  const play = `${publicUrl}/play`
  const playFps = `${play}?fps=1`
  console.log('\n────────────────────────────────────────')
  console.log('  Mobile test (ngrok)')
  console.log('────────────────────────────────────────')
  console.log(`  Play:  ${play}`)
  console.log(`  + FPS: ${playFps}`)
  console.log('────────────────────────────────────────')
  console.log('  Open the URL on your phone (same Wi‑Fi not required).')
  console.log('  Free ngrok may show a browser warning — tap Visit Site.')
  console.log('  Ctrl+C stops Next + tunnel.\n')
}

async function main() {
  loadEnvFile()

  if (!process.env.NGROK_AUTHTOKEN) {
    console.error(
      [
        'NGROK_AUTHTOKEN is not set.',
        '',
        '1. Sign up: https://dashboard.ngrok.com/signup',
        '2. Copy token: https://dashboard.ngrok.com/get-started/your-authtoken',
        '3. Add to .env:',
        '   NGROK_AUTHTOKEN="your-token"',
        '',
      ].join('\n')
    )
    process.exit(1)
  }

  const ngrok = await import('@ngrok/ngrok')

  const next = spawn('pnpm', ['exec', 'next', 'dev', '--webpack', '-H', HOST, '-p', String(PORT)], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  })

  let listener = null
  let shuttingDown = false

  const shutdown = async (code = 0) => {
    if (shuttingDown) return
    shuttingDown = true
    if (listener) {
      try {
        await listener.close()
      } catch {
        /* ignore */
      }
    }
    if (!next.killed) next.kill('SIGTERM')
    process.exit(code)
  }

  process.on('SIGINT', () => void shutdown(0))
  process.on('SIGTERM', () => void shutdown(0))
  next.on('exit', (code) => void shutdown(code ?? 0))

  try {
    process.stdout.write(`Waiting for Next.js on :${PORT}…\n`)
    await waitForPort(PORT)
    listener = await ngrok.forward({
      addr: PORT,
      authtoken_from_env: true,
    })
    printBanner(listener.url())
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    await shutdown(1)
  }
}

main()
