import {
  COMBO_BURST_FX_MS,
  SCORE_POP_FX_MS,
} from '../../ui/hud-feedback-fx.ts';

export type EffectPanelId =
  | 'cells'
  | 'board-interactions-v3'
  | 'digits'
  | 'flag'
  | 'flag-place-v3'
  | 'wrong-flag-v3'
  | 'mine'
  | 'mine-hit-v3'
  | 'heart-refill-v3'
  | 'heart-loss-v3'
  | 'start-panel-v3'
  | 'game-over-panel-v3'
  | 'score-hud-v3'
  | 'combo-hud-v3'
  | 'score-pop-v3'
  | 'combo-burst-v3'
  | 'life-loss-popup-v3'
  | 'speed-up-alert-v3'
  | 'speed-up-chevron-v3'
  | 'danger-rise-alert-v3';

interface EffectCardSpec {
  id: EffectPanelId;
  title: string;
  description: string;
  cycleMs: number;
  frameCount: number;
  defaultFps: number;
  loop: boolean;
  interactive?: boolean;
}

const BREATH_CYCLE_MS = 2400;
const BOARD_INTERACTION_V3_MS = 1680;
const BOARD_INTERACTION_V3_ACTION_MS = 1280;
const FLAG_WAVE_MS = 1500;
const FLAG_PLACE_MS = 1180;
const FLAG_PLACE_ACTION_MS = 430;
const WRONG_FLAG_V3_MS = 1180;
const WRONG_FLAG_V3_ACTION_MS = 520;
const DIGIT_PARTICLE_MS = 1800;
const MINE_EXPLOSION_MS = 720;
const MINE_HIT_V3_MS = 980;
const MINE_HIT_V3_ACTION_MS = 620;
const HEART_REFILL_V3_MS = 1180;
const HEART_REFILL_V3_ACTION_MS = 560;
const PANEL_V3_MS = 1480;
const PANEL_V3_ACTION_MS = 620;
const HUD_FEEDBACK_V3_MS = 1600;
const SCORE_POP_V3_MS = SCORE_POP_FX_MS;
const COMBO_BURST_V3_MS = COMBO_BURST_FX_MS;
const LIFE_LOSS_POPUP_V3_MS = 820;
const HUD_ALERT_V3_MS = 1260;

const EFFECT_SPECS: EffectCardSpec[] = [
  {
    id: 'cells',
    title: 'Cell states',
    description: 'Procedural hover, breath, and reveal overlays rendered on the board cell sprites.',
    cycleMs: BREATH_CYCLE_MS,
    frameCount: 4,
    defaultFps: 8,
    loop: true,
    interactive: true,
  },
  {
    id: 'board-interactions-v3',
    title: 'Board interactions v3',
    description: 'Candidate v3 tile interaction: hover glow, press/reveal flash, and clue number pop-in driven by Canvas overlays.',
    cycleMs: BOARD_INTERACTION_V3_MS,
    frameCount: 6,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'digits',
    title: 'Digit particles',
    description: 'Orbit particles around clue digits. Loops seamlessly at phase 0/1.',
    cycleMs: DIGIT_PARTICLE_MS,
    frameCount: 8,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'flag',
    title: 'Flag wave (current)',
    description: 'Current looping flag idle treatment: cloth wave deformation with additive spark trail.',
    cycleMs: FLAG_WAVE_MS,
    frameCount: 8,
    defaultFps: 10,
    loop: true,
  },
  {
    id: 'flag-place-v3',
    title: 'Flag place v3',
    description: 'Candidate interaction motion: static v3 flag cutout planted by Canvas transform, ring, and small impact sparks.',
    cycleMs: FLAG_PLACE_MS,
    frameCount: 4,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'wrong-flag-v3',
    title: 'Wrong flag v3',
    description: 'Candidate error motion: v3 flag cutout with Canvas shake, red denial ring, X slash, and break sparks.',
    cycleMs: WRONG_FLAG_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'mine',
    title: 'Mine explosion (current)',
    description: 'Current one-shot blast sequence with smoke and settled cracked mine. Click preview to replay.',
    cycleMs: MINE_EXPLOSION_MS,
    frameCount: 8,
    defaultFps: 12,
    loop: false,
    interactive: true,
  },
  {
    id: 'mine-hit-v3',
    title: 'Mine hit v3',
    description: 'Candidate mine interaction using v3 static cutouts plus Canvas shake, red core flash, shock ring, and smoke.',
    cycleMs: MINE_HIT_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'heart-refill-v3',
    title: 'Heart refill v3',
    description: 'Click-to-preview life refill: static empty heart, Canvas refill burst, then full v3 heart hold.',
    cycleMs: HEART_REFILL_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: false,
    interactive: true,
  },
  {
    id: 'heart-loss-v3',
    title: 'Heart loss v3',
    description: 'Click-to-preview damage state: full v3 heart switches directly to the empty-heart cutout.',
    cycleMs: 1,
    frameCount: 2,
    defaultFps: 1,
    loop: false,
    interactive: true,
  },
  {
    id: 'start-panel-v3',
    title: 'Start panel v3',
    description: 'Candidate animated start overlay: clean panel art plus Canvas scanline, edge spark, button press, and start pulse.',
    cycleMs: PANEL_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
    interactive: true,
  },
  {
    id: 'game-over-panel-v3',
    title: 'Game over panel v3',
    description: 'Candidate animated fail overlay: clean panel art plus Canvas red alert flash, shake, scanlines, and retry press feedback.',
    cycleMs: PANEL_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
    interactive: true,
  },
  {
    id: 'score-hud-v3',
    title: 'Score HUD v3',
    description: 'Candidate score data chip: compact metal base, cyan edge light, score pulse, and scan flash on gain.',
    cycleMs: HUD_FEEDBACK_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'combo-hud-v3',
    title: 'Combo HUD v3',
    description: 'Candidate combo chip with four escalating states: cyan, gold, hot, and red overload at x50+.',
    cycleMs: HUD_FEEDBACK_V3_MS,
    frameCount: 4,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'score-pop-v3',
    title: 'Score pop v3',
    description: 'Candidate score gain popup: +score rises from the score chip, flashes, and dissolves into scan particles.',
    cycleMs: SCORE_POP_V3_MS,
    frameCount: 5,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'combo-burst-v3',
    title: 'Combo burst v3',
    description: 'Candidate high-impact combo popup with shock rings, tier colors, particles, and stronger x10/x20/x50 beats.',
    cycleMs: COMBO_BURST_V3_MS,
    frameCount: 6,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'life-loss-popup-v3',
    title: 'Life loss popup v3',
    description: 'Candidate damage popup: red sci-fi HUD chip, LIFE -1 text, light impact shake, scan streaks, and small sparks.',
    cycleMs: LIFE_LOSS_POPUP_V3_MS,
    frameCount: 4,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'speed-up-alert-v3',
    title: 'Speed up alert v3',
    description: 'Full runtime SPEED UP alert: badge art, Canvas text, scan streaks, and chevron acceleration particles.',
    cycleMs: HUD_ALERT_V3_MS,
    frameCount: 4,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'speed-up-chevron-v3',
    title: 'Speed up chevrons v3',
    description: 'Isolated Canvas chevron streaks from the runtime SPEED UP alert: paired rects that read as right-pointing triangles.',
    cycleMs: HUD_ALERT_V3_MS,
    frameCount: 4,
    defaultFps: 12,
    loop: true,
  },
  {
    id: 'danger-rise-alert-v3',
    title: 'Danger rise alert v3',
    description: 'Candidate difficulty alert: danger-rise badge base plus Canvas text, warning pulse, and vertical pressure sparks.',
    cycleMs: HUD_ALERT_V3_MS,
    frameCount: 4,
    defaultFps: 12,
    loop: true,
  },
];

export {
  BREATH_CYCLE_MS,
  BOARD_INTERACTION_V3_MS,
  BOARD_INTERACTION_V3_ACTION_MS,
  FLAG_WAVE_MS,
  FLAG_PLACE_MS,
  FLAG_PLACE_ACTION_MS,
  WRONG_FLAG_V3_MS,
  WRONG_FLAG_V3_ACTION_MS,
  DIGIT_PARTICLE_MS,
  MINE_EXPLOSION_MS,
  MINE_HIT_V3_MS,
  MINE_HIT_V3_ACTION_MS,
  HEART_REFILL_V3_MS,
  HEART_REFILL_V3_ACTION_MS,
  PANEL_V3_MS,
  PANEL_V3_ACTION_MS,
  HUD_FEEDBACK_V3_MS,
  SCORE_POP_V3_MS,
  COMBO_BURST_V3_MS,
  LIFE_LOSS_POPUP_V3_MS,
  HUD_ALERT_V3_MS,
  EFFECT_SPECS,
};
export type { EffectCardSpec };
