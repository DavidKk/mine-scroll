# Minesweeper SFX Prompt Pack

无尽卷轴扫雷的音效生成提示词合集。风格定位：**soft · tactile · minimal · digital · clean · indie puzzle · subtle**。

**进度：11 / 12 已生成 · 11 / 12 已接线**（`public/assets/game/audio/` + `game-audio.ts`）

> 每条音效含 **触发时机** 与 **代码接入**。图例：✅ 文件 + 接线 · ⬜ 待生成 · ❌ 不需要

---

## 1. 格子交互

### ✅ 左键开格 / 单格翻开

|              |                                                           |
| ------------ | --------------------------------------------------------- |
| **状态**     | ✅ CHECKED                                                |
| **文件名**   | `sfx-cell-reveal-01`                                      |
| **时长**     | 0.05–0.15 s                                               |
| **触发时机** | 左键点击**未翻开**格子，且本次只新开 **1 格**（非 flood） |
| **代码接入** | ✅ `playRevealAudio` → `cellReveal`                       |

> Single puzzle grid cell reveal sound effect, short tactile digital click, soft mechanical button press, subtle glassy UI texture, clean modern indie game interface, satisfying but minimal, dark futuristic puzzle HUD style, very short 0.05-0.15 seconds, no music, isolated sound effect, no harsh frequencies

### ✅ 空白格 Flood 连锁展开

|              |                                                                                       |
| ------------ | ------------------------------------------------------------------------------------- |
| **状态**     | ✅ CHECKED                                                                            |
| **文件名**   | `sfx-cell-flood-reveal`                                                               |
| **时长**     | 0.3–0.6 s                                                                             |
| **触发时机** | 左键开格或 Chord 展开后，本次**一次性新开 ≥2 格**（0 区 flood fill 或多邻格同时翻开） |
| **代码接入** | ✅ `playRevealAudio` → `cellFlood`                                                    |

> Cascading puzzle grid reveal sound effect, multiple cells opening in sequence, soft digital ticks combined with gentle airy sweep, smooth chain reaction, calm and satisfying, elegant minimalist game UI, modern indie puzzle aesthetic, 0.3-0.6 seconds, isolated sound effect, no music, no aggressive sounds

### ❌ ~~数字格点击确认~~（不需要）

|            |                                  |
| ---------- | -------------------------------- |
| **状态**   | ❌ 不需要                        |
| **文件名** | ~~`sfx-cell-number-confirm`~~    |
| **结论**   | **本游戏无此独立操作，无需生成** |

**说明：** 已翻开的数字格左键无效果（`docs/SPEC.md` §3.2）。数字格相关操作只有 **Chord（双线）**：旗数 = N 时双击或左右键同按 → 翻开邻格，由 **`sfx-chord-action`** + `playRevealAudio` 覆盖。旗数不匹配时静默无反馈。

---

## 2. 标记系统

### ✅ 插旗

|              |                                         |
| ------------ | --------------------------------------- |
| **状态**     | ✅ CHECKED                              |
| **文件名**   | `sfx-flag-place`                        |
| **时长**     | 0.08–0.12 s                             |
| **触发时机** | 右键点击**未翻开**格子，由无标记 → 插旗 |
| **代码接入** | ✅ `playFlagToggleAudio` → `flagPlace`  |

> Puzzle game flag placement sound effect, tiny fabric snap mixed with soft digital click, crisp but quiet, satisfying placement feedback, modern minimalist UI, subtle tactile feeling, no military sound, no harsh impact, 0.08-0.12 seconds

### ✅ 取消插旗

|              |                                         |
| ------------ | --------------------------------------- |
| **状态**     | ✅ CHECKED                              |
| **文件名**   | `sfx-flag-remove`                       |
| **时长**     | 0.06–0.1 s                              |
| **触发时机** | 右键点击**已插旗**格子，旗 → 无标记     |
| **代码接入** | ✅ `playFlagToggleAudio` → `flagRemove` |

> Soft flag removal sound effect, gentle reverse snap, tiny digital pop, clean puzzle interface feedback, quiet and minimal, short 0.06-0.1 seconds, isolated sound effect

---

## 3. Chord 操作

### ✅ 双线翻开

|              |                                                                                      |
| ------------ | ------------------------------------------------------------------------------------ |
| **状态**     | ✅ CHECKED                                                                           |
| **文件名**   | `sfx-chord-action`                                                                   |
| **时长**     | 0.15–0.25 s                                                                          |
| **触发时机** | Chord **生效且未踩雷**时播放起手确认；展开邻格仍走 `playRevealAudio`（单格 / flood） |
| **代码接入** | ✅ `mount.ts` / `ai-loop.ts` → `chordAction`                                         |

> Puzzle chord action sound, two quick soft digital clicks in sequence, confident mechanic confirmation, clean UI feedback, subtle electronic texture, satisfying but restrained, 0.15-0.25 seconds, isolated sound effect

---

## 4. 游戏状态

### ✅ 踩雷 / 扣生命

> ⚠️ **不要做爆炸音效**——会破坏长期游玩的体验。  
> ⚠️ **不要做成脚步 / 闷踩**——像靴子踩地会被理解成「走路」，和踩雷、扣命语义无关。

|              |                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| **状态**     | ✅ CHECKED                                                                                                  |
| **文件名**   | `sfx-mine-hit`                                                                                              |
| **时长**     | 0.4–0.8 s                                                                                                   |
| **听感目标** | 「系统判定：扣一条命」——**数字/UI penalty**（错误提示、生命条扣减），不是物理踩踏、不是炸弹、不是 Game Over |
| **与视觉**   | 画面是 stylized mine burst（光晕 + 粒子）；**声音跟 HUD 扣命走**，跟爆炸画面同步时间点即可，音色不必像爆炸  |
| **触发时机** | 左键开雷或 Chord 踩雷，`lastLifeLoss.cause` 为 `mine-reveal` / `chord-mine` 时                              |
| **代码接入** | ✅ `playLifeLossAudio` → `mineHit`                                                                          |

| **Prompt** | 见下方一行，整段复制进 TEXTAREA |

```
Soft digital health-minus-one UI penalty for a dark minimalist puzzle game, brief downward synth bend with tiny glassy crackle, calm life-lost feedback not game over, 0.4-0.8 seconds, isolated sound effect, no music, no explosion, no footsteps, no foley
```

**反例（已淘汰）：** 类似靴子走路、踩下去一下的 physical thump — 语义像 locomotion，和 puzzle penalty 不符。

### ✅ 生命减少警告

|              |                                                                 |
| ------------ | --------------------------------------------------------------- |
| **状态**     | ✅ CHECKED                                                      |
| **文件名**   | `sfx-life-warning`                                              |
| **时长**     | 0.2–0.4 s                                                       |
| **听感目标** | 「要注意了」——**卷轴底行漏雷**时的 HUD 提醒，让玩家警觉但不焦虑 |
| **触发时机** | 卷轴底行漏雷扣命时（`lastLifeLoss.cause === 'scroll-bottom'`）  |
| **代码接入** | ✅ `playLifeLossAudio` → `lifeWarning`                          |

| **Prompt** | 见下方一行，整段复制进 TEXTAREA |

```
Soft double-pulse low-health HUD warning for a calm survival puzzle game, two muted synth tones low then slightly higher, subtle urgency not alarm, 0.2-0.4 seconds, isolated sound effect, no music, no siren, no harsh beep
```

---

## 5. 结果反馈

### ⬜ 胜利

|              |                                               |
| ------------ | --------------------------------------------- |
| **状态**     | ⬜ 待生成                                     |
| **文件名**   | `sfx-win`                                     |
| **时长**     | 1–2 s                                         |
| **触发时机** | `status` 变为 **`won`**（清盘胜利），计时停止 |
| **代码接入** | ⬜ 未接入（`mount.ts` 胜负分支）              |

> Minimal puzzle game victory sound effect, soft digital chime sequence, gentle major chord resolution, satisfying completion feeling, modern indie UI style, calm and elegant, no arcade fanfare, 1-2 seconds

### ⬜ 失败

|              |                                                    |
| ------------ | -------------------------------------------------- |
| **状态**     | ⬜ 待生成                                          |
| **文件名**   | `sfx-game-over`                                    |
| **时长**     | 1–2 s                                              |
| **触发时机** | `status` 变为 **`lost`**（命耗尽），计时与卷轴停止 |
| **代码接入** | ⬜ 未接入（`mount.ts` 胜负分支）                   |

> Puzzle game failure sound effect, soft descending digital tone, subtle glitch texture, calm disappointment, dark minimalist interface, no explosion, no horror, no dramatic impact, 1-2 seconds

### ⬜ 新局开始

|              |                                                                |
| ------------ | -------------------------------------------------------------- |
| **状态**     | ⬜ 待生成                                                      |
| **文件名**   | `sfx-new-game`                                                 |
| **时长**     | 0.3–0.5 s                                                      |
| **触发时机** | 点击 **Start 遮罩**、**重开 / Reset**、或 **Retry** 开始新局时 |
| **代码接入** | ⬜ 未接入（`startArcadeRun` / `restartGame`）                  |

> Fresh puzzle game start sound effect, clean reset click with soft upward digital sweep, feeling of new beginning, modern interface feedback, minimal and elegant, 0.3-0.5 seconds

---

## 6. 卷轴与生存

### ✅ 卷轴上移

|              |                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **状态**     | ✅ CHECKED                                                                                                                          |
| **文件名**   | `sfx-scroll-up`                                                                                                                     |
| **时长**     | 0.3–0.5 s                                                                                                                           |
| **听感目标** | 核心就一个 **「啪！」**——极短、极脆、极响的单击；像手指弹响 / Tetris 消行 / 音游 Perfect 敲键；后面可带 **0.1 s 内** 的短上扬 chime |
| **触发时机** | 卷轴定时器触发 **scroll tick**，棋盘向上滚动                                                                                        |
| **代码接入** | ✅ `onScrollTick` → `scrollUp`                                                                                                      |

| **Prompt（主打啪）** | 见下方，整段复制进 TEXTAREA |

```
Single loud crisp snap pop hit like finger snap or Tetris line clear thock, ultra-sharp attack under 30ms, one percussive slap transient then tiny bright rising chime within 0.1 seconds, bold prominent volume, uplifting achievement cathartic release, no whoosh no rumble no long tail, puzzle scroll tick, 0.3-0.5 seconds total, isolated sound effect, no music
```

| **Prompt（还不够啪时加后缀）** | 生成太软、太散时，在原 Prompt 末尾追加 |

```
, harder snap, louder transient, dryer, shorter tail, more percussive slap, less ambient
```

**怎么听才算「啪对了」：** 波形开头是 **一根竖刺**（attack 极陡），不是坡；总时长 **≤0.5 s**；重复听 10 次仍清脆、不糊。

### ✅ 回血 / 消雷奖励

|              |                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| **状态**     | ✅ CHECKED                                                                                            |
| **文件名**   | `sfx-heal-reward`                                                                                     |
| **时长**     | 0.4–0.7 s                                                                                             |
| **触发时机** | 消雷数达标 **自动回血**，或 **主动兑换 +1 命**（`exchangeMinesForLife`）；与 HUD 心形 refill 动画同步 |
| **代码接入** | ✅ `playHealRewardAudio` → `healReward`                                                               |

> Positive puzzle survival reward sound effect, gentle rising digital chime, soft energy restoration feeling, subtle warm synth tone, calm satisfying feedback, modern indie game UI, 0.4-0.7 seconds

---

## 7. UI

### ✅ Hover

|              |                                                                            |
| ------------ | -------------------------------------------------------------------------- |
| **状态**     | ✅ CHECKED                                                                 |
| **文件名**   | `ui-hover`                                                                 |
| **时长**     | 0.03–0.08 s                                                                |
| **触发时机** | 鼠标移入 Canvas 内**可交互 UI 热区**（Start / Retry / Reset / Dev 按钮等） |
| **代码接入** | ✅ `onUiHover` → `uiHover`                                                 |

> Minimal UI hover sound effect, tiny soft digital tick, barely audible interface texture, modern dark game menu, extremely short 0.03-0.08 seconds, clean and subtle

### ✅ Button Click

|              |                                                          |
| ------------ | -------------------------------------------------------- |
| **状态**     | ✅ CHECKED                                               |
| **文件名**   | `ui-click`                                               |
| **时长**     | 0.05–0.1 s                                               |
| **触发时机** | 点击 Canvas HUD 按钮（Start、Retry、Reset、Dev Auto 等） |
| **代码接入** | ✅ `onUiClick` → `uiClick`                               |

> Modern game UI button click sound, soft tactile digital tap, clean interface feedback, dark minimalist style, short and subtle, 0.05-0.1 seconds

### ❌ ~~设置 Toggle~~（不需要）

|            |                                                                        |
| ---------- | ---------------------------------------------------------------------- |
| **状态**   | ❌ 不需要                                                              |
| **文件名** | ~~`ui-toggle`~~                                                        |
| **结论**   | **当前无独立设置面板 / toggle 控件；Dev Auto 等按钮已复用 `ui-click`** |

---

## 额外建议（很重要）

你的游戏不是动作游戏，SFX 设计请遵循以下原则：

**避免**

- 高频过多
- `beep` 类尖锐提示音
- `laser` 科幻激光感
- `explosion` 爆炸冲击
- `arcade` 街机式夸张反馈

**统一关键词**

`soft` · `tactile` · `minimal` · `digital` · `clean` · `indie puzzle` · `subtle`

---

## 速查表

| 状态 | 分类      | 场景           | 文件名                        | 时长        | 触发时机（摘要）     |
| ---- | --------- | -------------- | ----------------------------- | ----------- | -------------------- |
| ✅   | 格子交互  | 单格翻开       | `sfx-cell-reveal-01`          | 0.05–0.15 s | 左键新开 1 格        |
| ✅   | 格子交互  | Flood 连锁     | `sfx-cell-flood-reveal`       | 0.3–0.6 s   | 一次新开 ≥2 格       |
| ❌   | —         | ~~数字格确认~~ | ~~`sfx-cell-number-confirm`~~ | —           | **不需要**           |
| ✅   | 标记      | 插旗           | `sfx-flag-place`              | 0.08–0.12 s | 右键插旗             |
| ✅   | 标记      | 取消插旗       | `sfx-flag-remove`             | 0.06–0.1 s  | 右键取消旗           |
| ✅   | Chord     | 双线翻开       | `sfx-chord-action`            | 0.15–0.25 s | Chord 生效（未踩雷） |
| ✅   | 游戏状态  | 踩雷 / 扣生命  | `sfx-mine-hit`                | 0.4–0.8 s   | 开雷 / Chord 踩雷    |
| ✅   | 游戏状态  | 卷轴漏雷警告   | `sfx-life-warning`            | 0.2–0.4 s   | 底行 scroll 扣命     |
| ⬜   | 结果      | 胜利           | `sfx-win`                     | 1–2 s       | 清盘 `won`           |
| ⬜   | 结果      | 失败           | `sfx-game-over`               | 1–2 s       | 命尽 `lost`          |
| ⬜   | 结果      | 新局开始       | `sfx-new-game`                | 0.3–0.5 s   | Start / 重开         |
| ✅   | 卷轴/生存 | 卷轴上移       | `sfx-scroll-up`               | 0.3–0.5 s   | Scroll tick（啪）    |
| ✅   | 卷轴/生存 | 回血奖励       | `sfx-heal-reward`             | 0.4–0.7 s   | +1 命 / 消雷兑换     |
| ✅   | UI        | Hover          | `ui-hover`                    | 0.03–0.08 s | UI 热区 hover        |
| ✅   | UI        | 按钮点击       | `ui-click`                    | 0.05–0.1 s  | HUD 按钮点击         |
| ❌   | —         | ~~Toggle~~     | ~~`ui-toggle`~~               | —           | **不需要**           |

---

## 待办清单（3 项）

1. `sfx-win` / `sfx-game-over` — 胜负结算
2. `sfx-new-game` — 新局开始
