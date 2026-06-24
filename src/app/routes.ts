export const ROUTES = {
  game: '/',
  assets: '/assets',
  lab: '/lab',
  responsive: '/responsive',
} as const;

export type AppRoute = keyof typeof ROUTES;

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

/** Resolve which page to mount from the URL pathname. */
export function resolveRoute(pathname = window.location.pathname): AppRoute {
  const path = normalizePath(pathname);

  if (import.meta.env.DEV) {
    if (path === ROUTES.assets) return 'assets';
    if (path === ROUTES.lab) return 'lab';
    if (path === ROUTES.responsive) return 'responsive';
  }

  return 'game';
}
