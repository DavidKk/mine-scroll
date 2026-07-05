import type { Config } from '@jest/types'

export default (): Config.InitialOptions => ({
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['<rootDir>/__tests__/**/*.spec.ts', '<rootDir>/__tests__/**/*.spec.tsx'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          rootDir: '.',
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          ignoreDeprecations: '6.0',
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@game-client/(.*)$': '<rootDir>/game-client/$1',
    '^@shared/core/(.*)$': '<rootDir>/shared/core/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
})
