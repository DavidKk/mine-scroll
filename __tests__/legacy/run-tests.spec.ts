import { execSync } from 'node:child_process'
import path from 'node:path'

const root = path.join(__dirname, '..', '..')

describe('legacy node test runner', () => {
  it('runs scripts/run-tests.ts suite', () => {
    execSync('node --experimental-strip-types scripts/run-tests.ts', {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    })
  })
})
