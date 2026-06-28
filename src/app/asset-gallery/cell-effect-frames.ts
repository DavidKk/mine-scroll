export function createStaticFrameCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  label: string,
  index: number,
  size: { w: number; h: number; wide?: boolean } = { w: 88, h: 88 },
): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'asset-lab__frame-cell';
  cell.title = label;

  const thumb = document.createElement('div');
  thumb.className = `asset-lab__frame-thumb asset-lab__checker${size.wide ? ' asset-lab__frame-thumb--wide' : ''}`;

  const canvas = document.createElement('canvas');
  canvas.className = 'asset-lab__frame-canvas';
  canvas.width = size.w;
  canvas.height = size.h;
  canvas.style.width = `${size.w}px`;
  canvas.style.height = `${size.h}px`;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    draw(ctx, size.w, size.h);
    const startedAt = performance.now();
    const redrawWhileAssetsLoad = (): void => {
      draw(ctx, size.w, size.h);
      if (performance.now() - startedAt < 2200) {
        window.requestAnimationFrame(redrawWhileAssetsLoad);
      }
    };
    window.requestAnimationFrame(redrawWhileAssetsLoad);
  }

  thumb.append(canvas);

  const num = document.createElement('span');
  num.className = 'asset-lab__frame-num';
  num.textContent = String(index + 1).padStart(2, '0');
  thumb.append(num);

  const cap = document.createElement('span');
  cap.className = 'asset-lab__frame-caption';
  cap.textContent = label;

  cell.append(thumb, cap);
  return cell;
}
