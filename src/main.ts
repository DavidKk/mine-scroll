import { mountApp } from './app/app.ts';
import { attachPageScrollbar } from './ui/custom-scrollbar.ts';
import {
  bindBootScreen,
  BOOT_AUTO_RETRY_DELAY_MS,
  BOOT_RETRY_UI_DELAY_MS,
  preloadGameAudio,
  resetBootSequence,
  retryBootSequence,
  runBootSequence,
} from './ui/boot/index.ts';
import { loadGameAssets } from './ui/game-assets.ts';
import { loadHudSprites } from './ui/hud-sprites.ts';
import { loadTileSprites } from './ui/tile-sprites.ts';
import './styles/main.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('Root element #app not found');
}

const appRoot: HTMLElement = root;

attachPageScrollbar();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function bootWithProgress(bootScreen: ReturnType<typeof bindBootScreen>) {
  resetBootSequence();
  return runBootSequence({
    onProgress: (progress) => bootScreen.update(progress),
  });
}

async function bootUntilReady(bootScreen: ReturnType<typeof bindBootScreen>) {
  let result = await bootWithProgress(bootScreen);
  let failureStartedAt = 0;

  while (!result.ok) {
    if (failureStartedAt === 0) failureStartedAt = performance.now();
    const elapsed = performance.now() - failureStartedAt;

    if (elapsed >= BOOT_RETRY_UI_DELAY_MS) {
      await bootScreen.waitForRetry('Load failed — check your connection');
      failureStartedAt = 0;
    } else {
      bootScreen.showRetrying();
      await sleep(BOOT_AUTO_RETRY_DELAY_MS);
    }

    result = await bootWithProgress(bootScreen);
  }

  bootScreen.clearRetryState();
}

async function startApp(): Promise<void> {
  const bootScreen = bindBootScreen();

  await bootUntilReady(bootScreen);

  await Promise.all([loadTileSprites(), loadHudSprites(), loadGameAssets()]);
  await bootScreen.dismiss();

  mountApp(appRoot);
  window.addEventListener('popstate', () => mountApp(appRoot));
  preloadGameAudio();
}

void startApp().catch(async (error) => {
  console.error('Failed to start app', error);
  try {
    const bootScreen = bindBootScreen();
    await bootScreen.waitForRetry('Startup failed — refresh the page');
    void retryBootSequence().then(() => window.location.reload());
  } catch {
    // Boot shell missing — nothing else to show.
  }
});
