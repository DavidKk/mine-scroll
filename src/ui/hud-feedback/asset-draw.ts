export function measureContainedAsset(
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  image: HTMLImageElement | null,
  scale = 1,
): { x: number; y: number; w: number; h: number } | null {
  if (!image || !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return null;
  const fit = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight) * scale;
  const w = image.naturalWidth * fit;
  const h = image.naturalHeight * fit;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function drawContainedFeedbackAsset(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  scale = 1,
  alpha = 1,
): { x: number; y: number; w: number; h: number } | null {
  const bounds = measureContainedAsset(cx, cy, maxW, maxH, image, scale);
  if (!bounds || !image) return null;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h);
  ctx.restore();
  return bounds;
}

export function drawFilteredContainedFeedbackAsset(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  filter: string,
  scale = 1,
  alpha = 1,
): { x: number; y: number; w: number; h: number } | null {
  if (!image || filter === 'none') {
    return drawContainedFeedbackAsset(ctx, image, cx, cy, maxW, maxH, scale, alpha);
  }
  ctx.save();
  ctx.filter = filter;
  const bounds = drawContainedFeedbackAsset(ctx, image, cx, cy, maxW, maxH, scale, alpha);
  ctx.restore();
  return bounds;
}
