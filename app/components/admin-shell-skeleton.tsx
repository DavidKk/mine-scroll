import { BRAND_MARK_PATH } from '@/lib/brand'
import { cn } from '@/lib/cn'

export interface AdminShellSkeletonProps {
  withSubnav?: boolean
  withRail?: boolean
}

const shimmerBlock = cn(
  'rounded-lg bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.1)_45%,rgba(255,255,255,0.04)_90%)] bg-[length:220%_100%] animate-admin-skeleton-shimmer'
)

function Block({ className = '' }: { className?: string }) {
  return <div className={cn(shimmerBlock, className)} aria-hidden="true" />
}

export function AdminShellSkeleton({ withSubnav = true, withRail = true }: AdminShellSkeletonProps) {
  return (
    <div
      className="app app--admin pointer-events-none fixed inset-0 z-[100] flex flex-col overflow-hidden bg-admin-bg text-admin-text"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading admin"
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(45,236,255,0.08),transparent_55%),linear-gradient(180deg,#07080f_0%,#05060c_100%)] opacity-90"
        aria-hidden="true"
      />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        <header className="flex min-h-[52px] shrink-0 items-center gap-3 border-b border-white/[0.08] bg-[rgba(8,10,18,0.92)] px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <img
              className="h-7 w-7 rounded-lg border border-landing-cyan/[0.22] object-cover shadow-[0_0_16px_rgba(45,236,255,0.12)]"
              src={BRAND_MARK_PATH}
              alt=""
              width={28}
              height={28}
              decoding="async"
            />
            <div className="flex flex-col gap-1.5">
              <Block className="h-2.5 w-[88px] rounded" />
              <Block className="h-2.5 w-[42px] rounded" />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex h-[38px] gap-1 rounded-[10px] border border-white/[0.08] bg-[rgba(6,8,14,0.78)] p-[3px]">
              <Block className="h-8 w-14 rounded-[7px]" />
            </div>
            <Block className="h-[38px] w-[38px] rounded-[10px]" />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {withRail ? (
            <aside className="flex w-[52px] shrink-0 flex-col gap-1.5 border-r border-white/[0.08] bg-[rgba(6,8,14,0.55)] px-1.5 py-2.5" aria-hidden="true">
              {Array.from({ length: 8 }, (_, index) => (
                <Block key={index} className="h-9 w-full rounded-lg" />
              ))}
            </aside>
          ) : null}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3.5 pt-3.5 pb-3">
            <header className="mb-3.5 flex flex-col gap-2">
              <Block className="h-[9px] w-[72px] rounded" />
              <Block className="h-[22px] w-[min(280px,55%)] rounded-md" />
              <Block className="h-[11px] w-[min(420px,72%)] rounded" />
            </header>

            <div className="flex min-h-0 flex-1 gap-3">
              {withSubnav ? (
                <aside
                  className="hidden w-[196px] shrink-0 flex-col gap-1.5 rounded-xl border border-white/[0.08] bg-[rgba(8,10,18,0.55)] p-2.5 min-[901px]:flex"
                  aria-hidden="true"
                >
                  {Array.from({ length: 8 }, (_, index) => (
                    <Block key={index} className="h-[34px] rounded-lg" />
                  ))}
                </aside>
              ) : null}

              <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-xl border border-white/[0.08] bg-[rgba(8,10,18,0.45)] p-3">
                {withSubnav ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
                    {Array.from({ length: 6 }, (_, index) => (
                      <Block key={index} className="aspect-[4/3] rounded-[10px] border border-white/[0.08]" />
                    ))}
                  </div>
                ) : (
                  <Block className="min-h-[120px] flex-1 rounded-[10px] border border-white/[0.08]" />
                )}
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
