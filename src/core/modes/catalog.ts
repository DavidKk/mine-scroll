import type { GameModeId } from '../types.ts';

export type ModeCategory = 'classic' | 'variant';

export interface ModeEntry {
  id: GameModeId;
  name: string;
  tag: string;
  category: ModeCategory;
  description: string;
  /** 隐藏难度配置（固定盘面） */
  hideSettings?: boolean;
}

export const MODE_ENTRIES: ModeEntry[] = [
  {
    id: 'classic',
    name: '经典扫雷',
    tag: '方形',
    category: 'classic',
    description: '完整经典规则：配置难度、Chord、首击安全。',
  },
  {
    id: 'hex',
    name: '六边形扫雷',
    tag: '六边形',
    category: 'variant',
    description: '正六边形盘，每格 6 邻；经典规则，91 格 / 10 雷。',
    hideSettings: true,
  },
  {
    id: 'endless',
    name: '无尽模式',
    tag: '卷轴',
    category: 'variant',
    description: '视窗随时间上移；底行未插旗的雷离屏扣血，顶部持续生成。',
    hideSettings: true,
  },
];

export function getModeEntry(id: GameModeId): ModeEntry {
  return MODE_ENTRIES.find((m) => m.id === id) ?? MODE_ENTRIES[0]!;
}
