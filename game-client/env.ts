/** Client-safe dev flag (replaces Vite `import.meta.env.DEV`). */
export const isDev = process.env.NODE_ENV === 'development'

/** Client-safe prod flag (replaces Vite `import.meta.env.PROD`). */
export const isProd = process.env.NODE_ENV === 'production'
