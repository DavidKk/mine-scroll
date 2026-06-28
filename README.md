# MineScroll

Neon-styled endless-scroll minesweeper built with **Next.js** and a **Canvas 2D** game client. Play classic, hex, and endless modes in the browser, with ranked leaderboards and internal asset tooling for development.

Package manager: **pnpm** (see `packageManager` in `package.json`).

## Features

- **Classic** — configurable board size and mine count, chord reveals, first-click safety
- **Hex** — hexagonal grid with 6-neighbor logic
- **Endless** — scrolling board, dynamic mine density, lives, combo scoring, and manual scroll
- **Ranked leaderboard** — server-backed top scores with anti-cheat hooks (KV / Redis)
- **Admin tools** — asset lab, UI lab, responsive matrix (auth required)

## Quick start

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to `/play` for the game shell.

## Scripts

| Command          | Description                             |
| ---------------- | --------------------------------------- |
| `pnpm dev`       | Next.js dev server                      |
| `pnpm build`     | Optimize boot assets + production build |
| `pnpm start`     | Serve production build                  |
| `pnpm test`      | Jest unit tests                         |
| `pnpm typecheck` | TypeScript check                        |
| `pnpm ok`        | format + lint + build + test            |

## Project layout

```
app/              Next.js App Router (pages, API routes, auth)
game-client/      Canvas runtime, HUD, boot loader, admin chrome
shared/core/      Pure game logic (no DOM)
services/         Auth, leaderboard, KV storage
public/assets/    Game sprites, audio, brand assets
docs/             Specs, architecture, iteration notes
```

Game rules and mode details live in `docs/SPEC.md` and `docs/MODES.md`.

## Admin authentication

Routes under `/admin/*` (asset lab, UI lab, responsive matrix) require sign-in.

| Environment | Method                                              |
| ----------- | --------------------------------------------------- |
| Production  | Signet (`SIGNET_SDK_URL`)                           |
| Local dev   | Signet and/or `ACCESS_USERNAME` + `ACCESS_PASSWORD` |

Required: `JWT_SECRET`, `JWT_EXPIRES_IN`. Register this callback in the auth center:

```
https://<your-domain>/auth/vercel-2fa/callback
```

Copy `.env.example` to `.env.local` and fill in values. For ranked runs in production, link Vercel KV or Upstash Redis (`KV_REST_API_*` or `UPSTASH_REDIS_REST_*`).

## Documentation

| Doc                            | Contents                          |
| ------------------------------ | --------------------------------- |
| `docs/PROJECT.md`              | Current task and iteration status |
| `docs/SPEC.md`                 | Classic minesweeper rules         |
| `docs/MODES.md`                | Classic, hex, and endless modes   |
| `docs/ARCHITECTURE.md`         | Stack and layering                |
| `docs/NEXTJS-PLATFORM-PLAN.md` | Next.js platform split            |

## License

Private project.
