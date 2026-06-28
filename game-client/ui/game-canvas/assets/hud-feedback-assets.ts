import { getCachedImage } from '../../boot/asset-cache.ts'
import { HUD_FEEDBACK_URLS, SCORE_DIGIT_URLS } from '../../boot/asset-registry.ts'
import { loadRuntimeImage } from '../../primitives/index.ts'

export const LIFE_LOSS_POPUP_V3_MS = 820

function runtimeImage(url: string): HTMLImageElement {
  return getCachedImage(url) ?? loadRuntimeImage(url)
}

export const HUD_FEEDBACK_ASSETS = {
  get scoreStrip() {
    return runtimeImage(HUD_FEEDBACK_URLS.scoreStrip)
  },
  get scorePanelV6() {
    return runtimeImage(HUD_FEEDBACK_URLS.scorePanelV6)
  },
  get comboRail() {
    return runtimeImage(HUD_FEEDBACK_URLS.comboRail)
  },
  get scorePopBase() {
    return runtimeImage(HUD_FEEDBACK_URLS.scorePopBase)
  },
  get speedUpAlert() {
    return runtimeImage(HUD_FEEDBACK_URLS.speedUpAlert)
  },
  get dangerRiseAlert() {
    return runtimeImage(HUD_FEEDBACK_URLS.dangerRiseAlert)
  },
  get lifeLossPopupSheet() {
    return runtimeImage(HUD_FEEDBACK_URLS.lifeLossPopupSheet)
  },
}

export const SCORE_DIGIT_ASSETS = new Proxy([] as HTMLImageElement[], {
  get(_target, prop) {
    const index = Number(prop)
    if (!Number.isInteger(index) || index < 0 || index >= SCORE_DIGIT_URLS.length) {
      return undefined
    }
    return runtimeImage(SCORE_DIGIT_URLS[index]!)
  },
})
