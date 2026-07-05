import Link from 'next/link'

import { cn } from '@/lib/cn'
import type { LeaderboardEntry } from '@/services/leaderboard/types'

import { LANDING_LB_LIST_HEIGHT, LANDING_LB_PANEL_HEIGHT, LANDING_LB_SHELL_HEIGHT, LANDING_LB_TOPBAR_HEIGHT, LANDING_LB_VISIBLE_ROWS } from './landing-leaderboard.constants'

export const LEADERBOARD_TABS = [
  { id: 'endless' as const, label: 'Endless', href: '/play' },
  { id: 'puzzle-rush' as const, label: 'Rush', href: '/play/rush' },
] as const

export type LeaderboardTabId = (typeof LEADERBOARD_TABS)[number]['id']

export type LeaderboardBoardStatus = 'idle' | 'loading' | 'ready' | 'error'

export type LeaderboardBoardState = {
  entries: LeaderboardEntry[]
  status: LeaderboardBoardStatus
  error?: string
}

export function formatLeaderboardScore(score: number): string {
  return score.toLocaleString('en-US')
}

export function leaderboardRankClass(rank: number): string | undefined {
  if (rank === 1) return 'text-amber-200'
  if (rank === 2) return 'text-slate-300'
  if (rank === 3) return 'text-orange-300'
  return undefined
}

export function leaderboardBoardBadge(status: LeaderboardBoardStatus, selected: boolean): string | null {
  if (!selected) return null
  if (status === 'loading' || status === 'idle') return 'Loading'
  if (status === 'error') return 'Unavailable'
  return null
}

const shellStyle = { height: LANDING_LB_SHELL_HEIGHT, minHeight: LANDING_LB_SHELL_HEIGHT }
const listStyle = { height: LANDING_LB_LIST_HEIGHT, minHeight: LANDING_LB_LIST_HEIGHT }

type LandingLeaderboardViewProps = {
  activeTab: LeaderboardTabId
  boards: Record<LeaderboardTabId, LeaderboardBoardState>
  onTabChange?: (tabId: LeaderboardTabId) => void
}

export function LandingLeaderboardView({ activeTab, boards, onTabChange }: LandingLeaderboardViewProps) {
  const activeBoard = boards[activeTab]
  const activeTabConfig = LEADERBOARD_TABS.find((tab) => tab.id === activeTab)!
  const activeBadge = leaderboardBoardBadge(activeBoard.status, true)
  const pending = activeBoard.status === 'loading' || activeBoard.status === 'idle'
  const showEmptySlot = activeBoard.status === 'ready' || activeBoard.status === 'error'
  const topEntry = activeBoard.entries[0]
  const interactive = Boolean(onTabChange)

  return (
    <aside className="w-full max-w-none" aria-labelledby="landing-lb-title" aria-busy={pending}>
      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[rgba(10,14,24,0.55)] backdrop-blur-sm" style={shellStyle}>
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.05] px-2.5 py-2" style={{ minHeight: LANDING_LB_TOPBAR_HEIGHT }}>
          <div className="flex min-w-0 items-center gap-2">
            <h2 id="landing-lb-title" className="m-0 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Top {LANDING_LB_VISIBLE_ROWS}
            </h2>
            <span className="inline-flex min-h-[1.125rem] min-w-[4.75rem] items-center" aria-hidden={!activeBadge}>
              {activeBadge ? (
                <span
                  className={cn(
                    'rounded-full border px-[7px] py-0.5 font-mono text-[0.55rem] font-semibold uppercase tracking-[0.08em]',
                    activeBoard.status === 'error' ? 'border-red-400/35 bg-red-400/10 text-red-300' : 'border-landing-cyan/20 bg-landing-cyan/[0.08] text-landing-cyan'
                  )}
                >
                  {activeBadge}
                </span>
              ) : null}
            </span>
          </div>
          <div className="inline-flex gap-0.5 rounded-full bg-white/[0.04] p-0.5" role="tablist" aria-label="Leaderboard mode">
            {LEADERBOARD_TABS.map((tab) => {
              const selected = tab.id === activeTab
              const tabStatus = boards[tab.id].status

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`landing-lb-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls="landing-lb-panel-active"
                  className={cn(
                    'inline-flex min-h-[26px] cursor-pointer appearance-none items-center justify-center rounded-full border-0 bg-transparent px-2.5 font-[inherit] text-[0.62rem] font-semibold uppercase leading-none tracking-[0.05em] text-slate-500 transition-colors duration-150 hover:text-slate-300 disabled:pointer-events-none disabled:cursor-default motion-reduce:transition-none',
                    selected && 'bg-landing-cyan/[0.14] text-slate-200 shadow-[inset_0_0_0_1px_rgba(45,236,255,0.22)]'
                  )}
                  disabled={!interactive}
                  onClick={interactive ? () => onTabChange?.(tab.id) : undefined}
                >
                  {tab.label}
                  {selected && (tabStatus === 'loading' || tabStatus === 'idle') ? (
                    <span
                      className="ml-1 inline-block h-[5px] w-[5px] animate-landing-lb-pulse rounded-full bg-landing-cyan align-middle motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div
          id="landing-lb-panel-active"
          role="tabpanel"
          aria-labelledby={`landing-lb-tab-${activeTab}`}
          className="flex flex-col px-2 pb-2 pt-1.5"
          style={{ height: LANDING_LB_PANEL_HEIGHT }}
        >
          <p className="sr-only" role="status">
            {pending ? 'Loading leaderboard…' : null}
            {activeBoard.status === 'error' ? 'Leaderboard unavailable' : null}
            {activeBoard.status === 'ready' && activeBoard.entries.length === 0 ? 'No scores yet' : null}
          </p>

          <ol className="m-0 grid list-none gap-0.5 p-0" style={listStyle} aria-busy={pending}>
            {Array.from({ length: LANDING_LB_VISIBLE_ROWS }, (_, index) => {
              const rank = index + 1
              const entry = activeBoard.entries[index]

              return (
                <li
                  key={entry?.id ?? `${activeTab}-row-${rank}`}
                  className={cn(
                    'grid min-h-[22px] grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-1.5 rounded-md px-1.5 py-[3px]',
                    entry && rank === 1 && 'bg-landing-cyan/[0.06]'
                  )}
                >
                  <span className={cn('text-center font-mono text-[0.62rem] font-bold text-slate-500', entry ? leaderboardRankClass(rank) : undefined)}>{rank}</span>
                  {pending ? (
                    <>
                      <span className="block h-2.5 max-w-[9rem] w-[min(72%,9rem)] rounded bg-white/[0.06]" aria-hidden="true" />
                      <span className="ml-auto block h-2.5 w-10 rounded bg-white/[0.06]" aria-hidden="true" />
                    </>
                  ) : entry ? (
                    <>
                      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.76rem] font-medium text-slate-200" title={entry.name}>
                        {entry.name}
                      </span>
                      <span className="text-right font-mono text-[0.68rem] font-semibold text-landing-cyan">{formatLeaderboardScore(entry.score)}</span>
                    </>
                  ) : showEmptySlot ? (
                    <>
                      <span className="text-[0.76rem] text-slate-600">—</span>
                      <span className="text-right font-mono text-[0.68rem] text-slate-600">—</span>
                    </>
                  ) : (
                    <>
                      <span className="block h-2.5 max-w-[9rem] w-[min(72%,9rem)] rounded bg-white/[0.06]" aria-hidden="true" />
                      <span className="ml-auto block h-2.5 w-10 rounded bg-white/[0.06]" aria-hidden="true" />
                    </>
                  )}
                </li>
              )
            })}
          </ol>

          <div className="mt-auto flex h-[33px] min-h-[33px] items-center justify-between gap-2 border-t border-white/[0.05] px-1.5 pb-0.5 pt-1.5">
            <span className="min-w-0 font-mono text-[0.6rem] tracking-[0.04em] text-slate-500">
              {topEntry ? (
                <>
                  Beat <strong className="font-semibold text-slate-400">{formatLeaderboardScore(topEntry.score)}</strong>
                </>
              ) : (
                <>Claim #1</>
              )}
            </span>
            {interactive ? (
              <Link
                href={activeTabConfig.href}
                className="shrink-0 rounded-full border border-landing-cyan/30 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.04em] text-landing-cyan no-underline hover:bg-landing-cyan/[0.08]"
              >
                Play
              </Link>
            ) : (
              <span className="pointer-events-none shrink-0 rounded-full border border-landing-cyan/30 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.04em] text-landing-cyan opacity-65">
                Play
              </span>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
