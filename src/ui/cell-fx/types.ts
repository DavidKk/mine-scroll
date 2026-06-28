export interface BoardPointerState {
  row: number;
  col: number;
  pressed: boolean;
}

export interface OrbitParticleStyle {
  radiusBase?: number;
  radiusStep?: number;
  dotBase?: number;
  dotStep?: number;
  alphaBase?: number;
  alphaPulse?: number;
  driftScale?: number;
  shadow?: boolean;
  radiusX?: number;
  radiusY?: number;
}

export type HudFxBudget = 'normal' | 'lite';

export interface PanelV3Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}
