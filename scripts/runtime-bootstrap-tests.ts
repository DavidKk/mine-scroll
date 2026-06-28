import assert from 'node:assert/strict';
import { toCellViews } from '../src/core/modes/engine.ts';
import { createInitialRuntimeState } from '../src/ui/game-canvas/runtime/state.ts';
import { createEndlessSession, endlessBeginRun, ENDLESS_COLS, ENDLESS_VISIBLE_ROWS } from '../src/core/modes/endless/index.ts';

type GlobalKey = 'document' | 'window' | 'performance' | 'Image';
type StubCanvas = {
  className: string;
  width: number;
  height: number;
};

function stubImage(): void {
  if (typeof globalThis.Image !== 'undefined') return;
  class StubImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    complete = false;
    naturalWidth = 0;
    naturalHeight = 0;
    private _src = '';

    get src(): string {
      return this._src;
    }

    set src(value: string) {
      this._src = value;
      queueMicrotask(() => {
        this.complete = true;
        this.naturalWidth = 64;
        this.naturalHeight = 64;
        this.onload?.();
      });
    }
  }
  (globalThis as Record<string, unknown>).Image = StubImage;
}

function installMinimalDom(): { restore: () => void; getLastCanvas: () => StubCanvas | null } {
  stubImage();

  const originals = new Map<GlobalKey, unknown>();
  let lastCanvas: StubCanvas | null = null;
  const stub = (key: GlobalKey, value: unknown) => {
    originals.set(key, (globalThis as Record<string, unknown>)[key]);
    (globalThis as Record<string, unknown>)[key] = value;
  };

  const noop = () => undefined;
  const createMockCtx = () => ({
    setTransform: noop,
    scale: noop,
    clearRect: noop,
    save: noop,
    restore: noop,
    translate: noop,
    drawImage: noop,
    fillText: noop,
    strokeText: noop,
    measureText: (text: string) => ({ width: text.length * 6 }),
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    font: '',
    shadowColor: '',
    shadowBlur: 0,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arcTo: noop,
    arc: noop,
    ellipse: noop,
    rect: noop,
    fill: noop,
    stroke: noop,
    clip: noop,
    closePath: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    fillRect: noop,
    strokeRect: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}),
  });
  const canvasEl: StubCanvas & Record<string, unknown> = {
    className: '',
    width: 0,
    height: 0,
    style: {},
    setAttribute: noop,
    addEventListener: noop,
    removeEventListener: noop,
    appendChild: noop,
    remove: noop,
    getContext: () => createMockCtx(),
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 400,
      height: 600,
      right: 400,
      bottom: 600,
    }),
  };

  stub('document', {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        lastCanvas = canvasEl;
        return canvasEl;
      }
      return {
        appendChild(node: StubCanvas) {
          if (node && 'width' in node) lastCanvas = node;
        },
        replaceChildren: noop,
        className: '',
        style: {},
      };
    },
  });

  if (!globalThis.performance) {
    stub('performance', { now: () => Date.now() });
  }

  stub('window', {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 1,
    requestAnimationFrame: (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0) as unknown as number,
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    setInterval: (cb: () => void) => setInterval(cb, 1000) as unknown as number,
    clearInterval: (id: number) => clearInterval(id),
    setTimeout: (cb: () => void, ms = 0) => setTimeout(cb, ms) as unknown as number,
    clearTimeout: (id: number) => clearTimeout(id),
    addEventListener: noop,
    removeEventListener: noop,
  });

  return {
    getLastCanvas: () => lastCanvas,
    restore: () => {
      for (const [key, value] of originals) {
        if (value === undefined) {
          delete (globalThis as Record<string, unknown>)[key];
        } else {
          (globalThis as Record<string, unknown>)[key] = value;
        }
      }
    },
  };
}

export function testCreateInitialRuntimeStateWithNullLayout(): void {
  const state = createInitialRuntimeState(12, 9, undefined, null, 0, 0);
  assert.equal(state.squareLayout, null);
  assert.equal(state.boardWidth, 0);
  assert.equal(state.boardHeight, 0);
  assert.equal(state.currentStatus, 'idle');
}

export async function testCreateGameCanvasBootstrapsLayout(): Promise<void> {
  const dom = installMinimalDom();
  try {
    const { createGameCanvas } = await import('../src/ui/game-canvas/create.ts');
    const container = document.createElement('div') as HTMLElement;
    const controller = createGameCanvas(
      container,
      ENDLESS_VISIBLE_ROWS,
      ENDLESS_COLS,
      0,
      {},
      { fixedCellSize: 28 },
    );

    const mountedCanvas = dom.getLastCanvas();
    assert.ok(mountedCanvas, 'canvas should mount into container');
    assert.ok(mountedCanvas!.width > 0, 'canvas width should be set after bootstrap');
    assert.ok(mountedCanvas!.height > 0, 'canvas height should be set after bootstrap');

    controller.render([], 'idle', 0, { rows: ENDLESS_VISIBLE_ROWS, cols: ENDLESS_COLS });
    controller.destroy();
  } finally {
    dom.restore();
  }
}

export async function testEndlessSessionMountsThroughGameCanvas(): Promise<void> {
  const dom = installMinimalDom();
  try {
    const { createGameCanvas } = await import('../src/ui/game-canvas/create.ts');
    const session = endlessBeginRun(createEndlessSession());
    assert.equal(session.state.status, 'playing');

    const container = document.createElement('div') as HTMLElement;
    const controller = createGameCanvas(
      container,
      ENDLESS_VISIBLE_ROWS,
      ENDLESS_COLS,
      0,
      {},
      {
        fixedCellSize: 28,
        fixedGridRows: ENDLESS_VISIBLE_ROWS,
      },
    );

    const views = toCellViews(session);

    controller.render(views, session.state.status, 0, {
      rows: ENDLESS_VISIBLE_ROWS,
      cols: ENDLESS_COLS,
      hudLeftDisplay: 'Score 0',
      hudRightDisplay: '♥♥♥♡♡',
    });
    controller.repaint();
    controller.destroy();
  } finally {
    dom.restore();
  }
}
