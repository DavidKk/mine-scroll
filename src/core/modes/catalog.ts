import type { GameModeId } from '../types.ts';

export interface ModeEntry {
  id: GameModeId;
  name: string;
  tag: string;
  description: string;
}

export const MODE_ENTRIES: ModeEntry[] = [
  {
    id: 'endless',
    name: '无尽模式',
    tag: '卷轴',
    description: '视窗随时间上移；底行未插旗的雷离屏扣血，顶部持续生成。',
  },
];

export function getModeEntry(_id: GameModeId = 'endless'): ModeEntry {
  return MODE_ENTRIES[0]!;
}
