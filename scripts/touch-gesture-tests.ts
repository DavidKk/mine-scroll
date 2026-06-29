import assert from 'node:assert/strict'

import {
  isDesktopInputProfile,
  isDualInputDebugEnabled,
  isMobileInputProfile,
  useDesktopMouseInput,
  useTouchPointerInput,
} from '../game-client/ui/game-canvas/input/input-profile.ts'
import { classifyPointerEnd, computeGestureThresholds, detectSwipeDuringMove, isDoubleTap, useTouchGestureInput } from '../game-client/ui/game-canvas/input/touch-gesture.ts'

export function testGestureThresholdsScaleWithCellSize(): void {
  const small = computeGestureThresholds(18)
  const large = computeGestureThresholds(40)
  assert.equal(small.swipeThresholdY, 20)
  assert.equal(large.swipeThresholdY, 20)
  assert.equal(small.tapSlop, 10)
  assert.equal(large.tapSlop, 10)
  const scaled = computeGestureThresholds(80)
  assert.ok(scaled.swipeThresholdY > 20)
  assert.ok(scaled.tapSlop > 10)
}

export function testClassifyPointerEndTap(): void {
  const t = computeGestureThresholds(28)
  assert.equal(classifyPointerEnd(2, 3, 'idle', t), 'tap')
}

export function testClassifyPointerEndSwipe(): void {
  const t = computeGestureThresholds(28)
  assert.equal(classifyPointerEnd(4, 24, 'idle', t), 'swipe-flag')
  assert.equal(classifyPointerEnd(4, -24, 'idle', t), 'swipe-flag')
}

export function testClassifyPointerEndCancelOnSmallDiagonal(): void {
  const t = computeGestureThresholds(28)
  assert.equal(classifyPointerEnd(18, 12, 'idle', t), 'cancel')
}

export function testCommittedSwipeMode(): void {
  const t = computeGestureThresholds(28)
  assert.equal(classifyPointerEnd(2, 2, 'swipe-flag', t), 'swipe-flag')
}

export function testDetectSwipeDuringMove(): void {
  const t = computeGestureThresholds(28)
  assert.equal(detectSwipeDuringMove(5, 'idle', t), 'idle')
  assert.equal(detectSwipeDuringMove(21, 'idle', t), 'swipe-flag')
  assert.equal(detectSwipeDuringMove(-21, 'idle', t), 'swipe-flag')
}

export function testDoubleTapWindow(): void {
  const now = 1000
  assert.equal(isDoubleTap({ row: 1, col: 2 }, now + 250, { lastCellKey: '1,2', lastTapAt: now }), true)
  assert.equal(isDoubleTap({ row: 1, col: 2 }, now + 301, { lastCellKey: '1,2', lastTapAt: now }), false)
  assert.equal(isDoubleTap({ row: 1, col: 3 }, now + 100, { lastCellKey: '1,2', lastTapAt: now }), false)
}

export function testInputProfileDetection(): void {
  assert.equal(isMobileInputProfile(390), true)
  assert.equal(isMobileInputProfile(1280), false)
  assert.equal(isDesktopInputProfile(1280), true)
  assert.equal(isDesktopInputProfile(390), false)
  assert.equal(useTouchGestureInput(390), true)
  assert.equal(useTouchGestureInput(1280), isDualInputDebugEnabled())
  assert.equal(useDesktopMouseInput(390), false)
  assert.equal(useDesktopMouseInput(1280), true)
  assert.equal(useTouchPointerInput(390), true)
  assert.equal(useTouchPointerInput(1280), isDualInputDebugEnabled())
}
