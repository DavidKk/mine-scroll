import type { GameCanvasRuntime } from '../runtime/context.ts';
import { RUNTIME_CONSTANTS } from '../runtime/state.ts';
import { HUD_FEEDBACK_ASSETS } from '../assets/hud-feedback-assets.ts';
import { getDifficultyAlertAnchor } from '../../game-stage-layout.ts';
import { drawFeedbackAsset } from '../hud/canvas-primitives.ts';
import { FONTS } from '../../theme.ts';
import type { ScrollPressureState } from '../../renderer/index.ts';

export function difficultyAlertProgress(_rt: GameCanvasRuntime,
  startedAt: number,
): { t: number; alpha: number; impact: number; strobe: number; pulse: number } | null {
  const elapsedMs = performance.now() - startedAt;
  const t = Math.max(0, Math.min(1, elapsedMs / RUNTIME_CONSTANTS.DIFFICULTY_ALERT_MS));
  if (t >= 1) return null;
  const enter = Math.min(1, t / 0.16);
  const exit = t > 0.76 ? Math.min(1, (t - 0.76) / 0.24) : 0;
  const alpha = Math.sin(enter * Math.PI * 0.5) * (1 - exit);
  const impact = t < 0.22 ? 1 - t / 0.22 : 0;
  const strobe = t < 0.58 ? Math.pow(Math.abs(Math.sin(t * Math.PI * 6.5)), 1.55) * 0.72 : 0;
  const pulse = Math.pow(Math.sin(t * Math.PI), 0.85);
  return { t, alpha, impact, strobe, pulse };
}

export function resolveDifficultyAlertOrigin(rt: GameCanvasRuntime,
  shellW: number,
  shellH: number,
): { ox: number; oy: number; reach: number } {
  const stageScale = rt.state.stageLayout?.scale ?? 1;
  const alertAnchor = rt.state.stageLayout ? getDifficultyAlertAnchor(rt.state.stageLayout) : null;
  const ox = alertAnchor?.x ?? shellW / 2;
  const oy = alertAnchor?.y ?? 92 * stageScale;
  const reach =
    Math.hypot(Math.max(ox, shellW - ox), Math.max(oy, shellH - oy)) * 1.12;
  return { ox, oy, reach };
}

export function drawDifficultyAlertFullscreenFlash(rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  shellW: number,
  shellH: number,
): void {
  if (!rt.state.activeDifficultyAlert) return;
  const progress = difficultyAlertProgress(rt, rt.state.activeDifficultyAlert.startedAt);
  if (!progress) return;

  const { t, alpha, impact, strobe, pulse } = progress;
  const stageScale = rt.state.stageLayout?.scale ?? 1;
  const kind = rt.state.activeDifficultyAlert.kind;
  const isDanger = kind === 'danger-rise';
  const main = isDanger ? '255, 76, 86' : '255, 190, 55';
  const soft = isDanger ? '251, 113, 36' : '45, 236, 255';
  const flash = alpha * (0.11 + strobe * 0.22 + impact * 0.16);
  const { ox, oy, reach } = resolveDifficultyAlertOrigin(rt, shellW, shellH);
  const coreR = Math.max(18, 28 * stageScale);

  shellCtx.save();

  if (impact > 0.05) {
    const burst = shellCtx.createRadialGradient(ox, oy, 0, ox, oy, coreR * (1.4 + impact * 0.8));
    burst.addColorStop(0, `rgba(${soft}, ${flash * (0.55 + impact * 0.35)})`);
    burst.addColorStop(0.45, `rgba(${main}, ${flash * (0.32 + impact * 0.22)})`);
    burst.addColorStop(1, 'rgba(0,0,0,0)');
    shellCtx.fillStyle = burst;
    shellCtx.fillRect(0, 0, shellW, shellH);
  }

  if (strobe > 0.28) {
    const washR = coreR + reach * (0.35 + strobe * 0.55);
    const wash = shellCtx.createRadialGradient(ox, oy, coreR * 0.4, ox, oy, washR);
    wash.addColorStop(0, `rgba(${soft}, ${(strobe - 0.28) * alpha * 0.16})`);
    wash.addColorStop(0.55, `rgba(${main}, ${(strobe - 0.28) * alpha * (isDanger ? 0.12 : 0.09)})`);
    wash.addColorStop(1, 'rgba(0,0,0,0)');
    shellCtx.fillStyle = wash;
    shellCtx.fillRect(0, 0, shellW, shellH);
  }

  shellCtx.globalCompositeOperation = 'lighter';
  for (let wave = 0; wave < 3; wave += 1) {
    const wp = (t * 1.45 + wave * 0.28) % 1;
    const ringR = coreR + reach * wp;
    const ringAlpha = flash * (1 - wp) * 0.48;
    if (ringAlpha <= 0.004) continue;
    const ringInner = Math.max(coreR * 0.5, ringR - reach * 0.07);
    const ring = shellCtx.createRadialGradient(ox, oy, ringInner, ox, oy, ringR);
    ring.addColorStop(0, 'rgba(0,0,0,0)');
    ring.addColorStop(0.62, `rgba(${soft}, ${ringAlpha * 0.42})`);
    ring.addColorStop(0.88, `rgba(${main}, ${ringAlpha})`);
    ring.addColorStop(1, 'rgba(0,0,0,0)');
    shellCtx.fillStyle = ring;
    shellCtx.fillRect(0, 0, shellW, shellH);
  }

  const edgeGlow = shellCtx.createRadialGradient(ox, oy, reach * 0.52, ox, oy, reach);
  edgeGlow.addColorStop(0, 'rgba(0,0,0,0)');
  edgeGlow.addColorStop(0.72, `rgba(${main}, ${flash * 0.08 * pulse})`);
  edgeGlow.addColorStop(1, `rgba(${main}, ${flash * 0.38 * pulse})`);
  shellCtx.fillStyle = edgeGlow;
  shellCtx.fillRect(0, 0, shellW, shellH);
  shellCtx.globalCompositeOperation = 'source-over';

  const rayCount = isDanger ? 14 : 12;
  for (let i = 0; i < rayCount; i += 1) {
    const baseAngle = isDanger
      ? -Math.PI / 2 + ((i / rayCount) - 0.5) * Math.PI * 1.35
      : (i / rayCount) * Math.PI * 2;
    const travel = (t * 1.5 + i * 0.07) % 1;
    const dist = coreR * 0.6 + reach * travel * 0.92;
    const bx = ox + Math.cos(baseAngle) * dist;
    const by = oy + Math.sin(baseAngle) * dist;
    const blobR = Math.max(reach * 0.11, 56 * stageScale) * (0.72 + (1 - travel) * 0.35);
    const blobAlpha = flash * (0.18 + (1 - travel) * 0.34);
    const blob = shellCtx.createRadialGradient(bx, by, 0, bx, by, blobR);
    blob.addColorStop(0, `rgba(${soft}, ${blobAlpha * 0.5})`);
    blob.addColorStop(0.4, `rgba(${main}, ${blobAlpha * 0.24})`);
    blob.addColorStop(1, 'rgba(0,0,0,0)');
    shellCtx.fillStyle = blob;
    shellCtx.beginPath();
    shellCtx.arc(bx, by, blobR, 0, Math.PI * 2);
    shellCtx.fill();
  }

  const moteCount = isDanger ? 22 : 26;
  shellCtx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < moteCount; i += 1) {
    const angle =
      ((i * 9973 + (isDanger ? 90 : 0)) % 360) / 360 * Math.PI * 2 +
      Math.sin(i * 1.7) * 0.18;
    const drift = (t * (isDanger ? 0.95 : 1.15) + i * 0.041) % 1;
    const dist = coreR * 0.35 + reach * drift * 0.96;
    const x = ox + Math.cos(angle) * dist;
    const y = oy + Math.sin(angle) * dist;
    const r = (10 + (i % 7) * 3.5) * stageScale;
    const twinkle = 0.4 + 0.6 * (1 - Math.abs(((i * 0.17 + t * 1.6) % 1) * 2 - 1));
    const moteAlpha = flash * twinkle * (isDanger ? 0.72 : 0.62) * (1 - drift * 0.35);
    const glow = shellCtx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, `rgba(${soft}, ${moteAlpha * 0.55})`);
    glow.addColorStop(0.35, `rgba(${main}, ${moteAlpha * 0.28})`);
    glow.addColorStop(1, `rgba(${main}, 0)`);
    shellCtx.fillStyle = glow;
    shellCtx.beginPath();
    shellCtx.arc(x, y, r, 0, Math.PI * 2);
    shellCtx.fill();
  }

  shellCtx.restore();
  rt.scheduleAnimationFrame();
}

export function drawDifficultyAlert(rt: GameCanvasRuntime, shellCtx: CanvasRenderingContext2D, shellW: number): void {
  if (!rt.state.activeDifficultyAlert) return;
  const progress = difficultyAlertProgress(rt, rt.state.activeDifficultyAlert.startedAt);
  if (!progress) {
    rt.state.activeDifficultyAlert = null;
    return;
  }

  const { t, alpha, impact } = progress;
  const stageScale = rt.state.stageLayout?.scale ?? 1;
  const kind = rt.state.activeDifficultyAlert.kind;
  const isDanger = kind === 'danger-rise';
  const image = isDanger ? HUD_FEEDBACK_ASSETS.dangerRiseAlert : HUD_FEEDBACK_ASSETS.speedUpAlert;
  const label = isDanger ? 'DANGER RISE' : 'SPEED UP';
  const main = isDanger ? '255, 76, 86' : '255, 190, 55';
  const soft = isDanger ? '251, 113, 36' : '45, 236, 255';
  const textColor = isDanger ? '#ffe4e6' : '#fef3c7';
  const shake = isDanger ? Math.sin(t * Math.PI * 18) * impact * 3 * stageScale : 0;
  const alertAnchor = rt.state.stageLayout ? getDifficultyAlertAnchor(rt.state.stageLayout) : null;
  const cx = (alertAnchor?.x ?? shellW / 2) + shake;
  const cy = alertAnchor?.y ?? 92 * stageScale;
  const maxW = Math.min(shellW * 0.58, 300 * stageScale);
  const maxH = 60 * stageScale;
  const asset = drawFeedbackAsset(rt, shellCtx, image, cx, cy, maxW, maxH, 0.98 + impact * 0.035, alpha);
  if (!asset) return;

  shellCtx.save();
  shellCtx.globalAlpha = alpha;
  shellCtx.globalCompositeOperation = 'lighter';
  const scanX = asset.x + ((t * 1.35) % 1) * asset.w;
  const scan = shellCtx.createLinearGradient(scanX - asset.w * 0.12, 0, scanX + asset.w * 0.12, 0);
  scan.addColorStop(0, 'rgba(255,255,255,0)');
  scan.addColorStop(0.5, `rgba(${soft}, ${0.2 + impact * 0.16})`);
  scan.addColorStop(1, 'rgba(255,255,255,0)');
  shellCtx.fillStyle = scan;
  shellCtx.fillRect(asset.x + asset.w * 0.1, asset.y + asset.h * 0.24, asset.w * 0.8, asset.h * 0.52);

  for (let i = 0; i < 10; i += 1) {
    const p = (t + i * 0.083) % 1;
    const px = asset.x + asset.w * (0.2 + p * 0.6);
    const py = asset.y + asset.h * (isDanger ? 0.74 - p * 0.44 : 0.38 + Math.sin(i) * 0.1);
    shellCtx.fillStyle = i % 3 === 0 ? `rgba(${main}, ${alpha * (1 - p)})` : `rgba(${soft}, ${alpha * 0.7 * (1 - p)})`;
    shellCtx.fillRect(px, py, Math.max(1, 1.4 * stageScale), Math.max(1, 1.3 * stageScale + (isDanger ? p * 7 * stageScale : 0)));
    if (!isDanger) shellCtx.fillRect(px - 10 * stageScale, py, 9 * stageScale, Math.max(1, 1.2 * stageScale));
  }

  shellCtx.globalCompositeOperation = 'source-over';
  shellCtx.textAlign = 'center';
  shellCtx.textBaseline = 'middle';
  shellCtx.font = `1000 ${Math.min(19 * stageScale, asset.h * 0.28)}px ${FONTS.mono}`;
  shellCtx.lineWidth = Math.max(2, asset.h * 0.04);
  shellCtx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
  shellCtx.shadowColor = `rgba(${main}, ${0.72 + impact * 0.18})`;
  shellCtx.shadowBlur = asset.h * (0.12 + impact * 0.07);
  shellCtx.strokeText(label, asset.x + asset.w / 2, asset.y + asset.h * 0.52);
  shellCtx.fillStyle = textColor;
  shellCtx.fillText(label, asset.x + asset.w / 2, asset.y + asset.h * 0.52);
  shellCtx.restore();

  rt.scheduleAnimationFrame();
}

export function drawFullscreenScrollWarning(rt: GameCanvasRuntime,
  shellCtx: CanvasRenderingContext2D,
  pressure: ScrollPressureState | undefined,
  shellW: number,
  shellH: number,
): void {
  if (!pressure) return;

  const urgentPulse = pressure.urgent ? 0.5 + Math.sin(Date.now() / 90) * 0.5 : 0;
  const alpha = pressure.urgent
    ? 0.12 + urgentPulse * 0.1
    : Math.max(0, pressure.progress - 0.55) * 0.12;
  if (alpha > 0) {
    shellCtx.save();
    const top = shellCtx.createLinearGradient(0, 0, 0, shellH);
    top.addColorStop(0, `rgba(239, 68, 68, ${alpha * 0.25})`);
    top.addColorStop(0.7, 'rgba(239, 68, 68, 0)');
    top.addColorStop(1, `rgba(239, 68, 68, ${alpha})`);
    shellCtx.fillStyle = top;
    shellCtx.fillRect(0, 0, shellW, shellH);
    shellCtx.restore();
  }

  if (pressure.urgent) rt.scheduleAnimationFrame();
}
