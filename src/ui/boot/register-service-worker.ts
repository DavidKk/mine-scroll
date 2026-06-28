/** Register the static asset service worker after boot completes (production only). */
export function registerBootServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
    console.warn('[boot] Service worker registration failed', error);
  });
}
