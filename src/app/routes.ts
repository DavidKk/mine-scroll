export const ROUTES = {
  game: '/',
  assets: '/assets',
  lab: '/lab',
  responsive: '/responsive',
} as const;

export type AssetLabSection = 'sources' | 'sprites' | 'animations' | 'game-ui' | 'background' | 'audio';

export type AppRoute = 'game' | 'assets' | 'lab' | 'responsive';

const ASSET_SECTIONS: AssetLabSection[] = ['sources', 'sprites', 'animations', 'game-ui', 'background', 'audio'];

export interface AssetLabRoute {
  section: AssetLabSection;
  panelId: string | null;
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

export function assetLabSectionPath(section: AssetLabSection): string {
  return `${ROUTES.assets}/${section}`;
}

export function assetLabPanelPath(section: AssetLabSection, panelId: string): string {
  return `${assetLabSectionPath(section)}/${encodeURIComponent(panelId)}`;
}

export function isAssetLabSection(value: string): value is AssetLabSection {
  return (ASSET_SECTIONS as string[]).includes(value);
}

/** Resolve /assets and /assets/:section[/:panel]. Bare /assets maps to source sheets. */
export function resolveAssetLabSection(pathname = window.location.pathname): AssetLabSection | null {
  const path = normalizePath(pathname);
  if (path === ROUTES.assets) return 'sources';
  if (!path.startsWith(`${ROUTES.assets}/`)) return null;

  const segment = path.slice(`${ROUTES.assets}/`.length).split('/')[0] ?? '';
  return isAssetLabSection(segment) ? segment : null;
}

export function resolveAssetLabPanelId(pathname = window.location.pathname): string | null {
  const path = normalizePath(pathname);
  if (!path.startsWith(`${ROUTES.assets}/`)) return null;

  const rest = path.slice(`${ROUTES.assets}/`.length);
  const parts = rest.split('/').filter(Boolean);
  if (parts.length < 2) return null;

  try {
    return decodeURIComponent(parts.slice(1).join('/'));
  } catch {
    return null;
  }
}

export function parseAssetLabRoute(pathname = window.location.pathname): AssetLabRoute | null {
  const section = resolveAssetLabSection(pathname);
  if (!section) return null;
  return { section, panelId: resolveAssetLabPanelId(pathname) };
}

export function syncAssetLabPanelPath(
  section: AssetLabSection,
  panelId: string,
  mode: 'push' | 'replace' = 'push',
): void {
  const path = assetLabPanelPath(section, panelId);
  const current = normalizePath(window.location.pathname);
  if (path === current) return;
  if (mode === 'replace') window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
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
