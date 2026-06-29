declare namespace NodeJS {
  interface ProcessEnv {
    /** HS256 secret for admin session JWT cookies */
    JWT_SECRET?: string
    JWT_EXPIRES_IN?: string
    /** Full URL to hosted signet-client.mjs (production Signet login) */
    SIGNET_SDK_URL?: string
    /** Local dev username/password (ignored in production) */
    ACCESS_USERNAME?: string
    ACCESS_PASSWORD?: string
    /** Optional TOTP secret for local dev login */
    ACCESS_2FA_SECRET?: string
    /** OAuth authorization page URL (client) */
    NEXT_PUBLIC_OAUTH_LOGIN_URL?: string
    /** Server ECDH public key for OAuth token decryption (client) */
    NEXT_PUBLIC_OAUTH_SERVER_PUBLIC_KEY?: string
    /** JWT secret for verifying third-party OAuth tokens (server) */
    OAUTH_JWT_SECRET?: string
    /** Upstash Redis REST (Vercel KV / Upstash console) */
    UPSTASH_REDIS_REST_URL?: string
    UPSTASH_REDIS_REST_TOKEN?: string
    /** Injected when a KV store is linked on Vercel */
    KV_REST_API_URL?: string
    KV_REST_API_TOKEN?: string
    /** Vercel named KV store — prefix matches the storage resource name */
    minescroll_KV_REST_API_URL?: string
    minescroll_KV_REST_API_TOKEN?: string
  }
}

export {}
