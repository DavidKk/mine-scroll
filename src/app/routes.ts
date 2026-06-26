export const ROUTES = {
  game: '/',
  assets: '/assets',
  lab: '/lab',
  responsive: '/responsive',
} as const;

export type AssetLabSection = 'sources' | 'sprites' | 'animations' | 'game-ui' | 'background' | 'audio';

export type AppRoute = 'game' | 'assets' | 'lab' | 'responsive';

const ASSET_SECTIONS: AssetLabSection[] = ['sources', 'sprites', 'animations', 'game-ui', 'background', 'audio'];

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

export function assetLabSectionPath(section: AssetLabSection): string {
  return `${ROUTES.assets}/${section}`;
}

export function isAssetLabSection(value: string): value is AssetLabSection {
  return (ASSET_SECTIONS as string[]).includes(value);
}

/** Resolve /assets and /assets/:section. Bare /assets maps to source sheets. */
export function resolveAssetLabSection(pathname = window.location.pathname): AssetLabSection | null {
  const path = normalizePath(pathname);
  if (path === ROUTES.assets) return 'sources';
  if (!path.startsWith(`${ROUTES.assets}/`)) return null;

  const segment = path.slice(`${ROUTES.assets}/`.length).split('/')[0] ?? '';
  return isAssetLabSection(segment) ? segment : null;
}

/** Resolve which page to mount from the URL pathname. */
export function resolveRoute(pathname = window.location.pathname): AppRoute {
  const path = normalizePath(pathname);

  if (import.meta.env.DEV) {
    if (resolveAssetLabSection(path) !== null || path === ROUTES.assets) return 'assets';
    if (path === ROUTES.lab) return 'lab';
    if (path === ROUTES.responsive) return 'responsive';
  }

  return 'game';
}

/** Canonical URL for an asset lab section (redirect bare /assets here). */
export function canonicalAssetLabPath(pathname = window.location.pathname): string | null {
  const path = normalizePath(pathname);
  if (path === ROUTES.assets) return assetLabSectionPath('sources');
  if (path.startsWith(`${ROUTES.assets}/`) && resolveAssetLabSection(path) === null) {
    return assetLabSectionPath('sources');
  }
  return null;
}
