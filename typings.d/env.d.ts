declare namespace NodeJS {
  interface ProcessEnv {
    /** HS256 secret for admin session JWT cookies */
    JWT_SECRET?: string
    JWT_EXPIRES_IN?: string
    /** Full URL to hosted signet-client.mjs (production Signet login) */
    SIGNET_SDK_URL?: string
    /** Server-side fallback for Signet SDK URL (vercel-openapi compat) */
    NEXT_PUBLIC_SIGNET_SDK_URL?: string
    /** Optional auth center origin override (vercel-openapi compat) */
    SIGNET_ORIGIN?: string
    SIGNET_AUTH_ORIGIN?: string
    /** Set to `0` to hide Signet login (vercel-openapi compat) */
    ENABLE_SIGNET_LOGIN?: string
    /** Admin username; also validates third-party OAuth tokens */
    ACCESS_USERNAME?: string
    /** Local dev password login (ignored in production on MineScroll) */
    ACCESS_PASSWORD?: string
    /** Optional TOTP secret for local dev login */
    ACCESS_2FA_SECRET?: string
    /** OAuth authorization page URL (client) */
    NEXT_PUBLIC_OAUTH_LOGIN_URL?: string
    /** Server ECDH public key for OAuth token decryption (client) */
    NEXT_PUBLIC_OAUTH_SERVER_PUBLIC_KEY?: string
    /** JWT secret for verifying third-party OAuth tokens (server) */
    OAUTH_JWT_SECRET?: string
    /** MineScroll KV / Redis — REST API URL (preferred) */
    MINE_SCROLL_KV_REST_API_URL?: string
    /** MineScroll KV URL fallback (use REST URL with @upstash/redis) */
    MINE_SCROLL_KV_URL?: string
    /** MineScroll Redis URL fallback */
    MINE_SCROLL_REDIS_URL?: string
    /** MineScroll KV REST write token (preferred) */
    MINE_SCROLL_KV_REST_API_TOKEN?: string
    /** MineScroll KV REST read-only token (fallback when write token is unset) */
    MINE_SCROLL_KV_REST_API_READ_ONLY_TOKEN?: string
    /** ngrok authtoken for `pnpm dev:ngrok` */
    NGROK_AUTHTOKEN?: string
  }
}

export {}
