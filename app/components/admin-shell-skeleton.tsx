import '@game-client/styles/admin-theme.css'
import './admin-shell-skeleton.css'

import { BRAND_MARK_PATH } from '@/lib/brand'

export interface AdminShellSkeletonProps {
  withSubnav?: boolean
  withRail?: boolean
}

function Block({ className = '' }: { className?: string }) {
  return <div className={`admin-skeleton__block ${className}`.trim()} aria-hidden="true" />
}

export function AdminShellSkeleton({ withSubnav = true, withRail = true }: AdminShellSkeletonProps) {
  return (
    <div className="app app--admin admin-skeleton" role="status" aria-live="polite" aria-busy="true" aria-label="Loading admin">
      <div className="admin-skeleton__backdrop" aria-hidden="true" />
      <div className="admin-skeleton__shell">
        <header className="admin-skeleton__header">
          <div className="admin-skeleton__brand">
            <img className="admin-skeleton__mark" src={BRAND_MARK_PATH} alt="" width={28} height={28} decoding="async" />
            <div className="admin-skeleton__brand-lines">
              <Block className="admin-skeleton__line admin-skeleton__line--title" />
              <Block className="admin-skeleton__line admin-skeleton__line--sub" />
            </div>
          </div>
          <div className="admin-skeleton__toolbar">
            <div className="admin-skeleton__modules">
              <Block className="admin-skeleton__pill" />
            </div>
            <Block className="admin-skeleton__pill admin-skeleton__pill--user" />
          </div>
        </header>

        <div className="admin-skeleton__frame">
          {withRail ? (
            <aside className="admin-skeleton__rail" aria-hidden="true">
              {Array.from({ length: 8 }, (_, index) => (
                <Block key={index} className="admin-skeleton__rail-btn" />
              ))}
            </aside>
          ) : null}

          <div className="admin-skeleton__content">
            <header className="admin-skeleton__page-head">
              <Block className="admin-skeleton__line admin-skeleton__line--eyebrow" />
              <Block className="admin-skeleton__line admin-skeleton__line--heading" />
              <Block className="admin-skeleton__line admin-skeleton__line--desc" />
            </header>

            <div className="admin-skeleton__workspace">
              {withSubnav ? (
                <aside className="admin-skeleton__subnav" aria-hidden="true">
                  {Array.from({ length: 8 }, (_, index) => (
                    <Block key={index} className="admin-skeleton__subnav-item" />
                  ))}
                </aside>
              ) : null}

              <main className="admin-skeleton__main">
                {withSubnav ? (
                  <div className="admin-skeleton__card-row">
                    {Array.from({ length: 6 }, (_, index) => (
                      <Block key={index} className="admin-skeleton__card" />
                    ))}
                  </div>
                ) : (
                  <Block className="admin-skeleton__panel" />
                )}
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
