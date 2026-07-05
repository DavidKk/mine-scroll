import { cn } from '@/lib/cn'
import { NEON_BACKDROP } from '@/lib/neon-backdrop'

type AdminBackdropProps = {
  className?: string
}

/** Login and standalone admin pages — same neon layers as the landing page. */
export function AdminBackdrop({ className }: AdminBackdropProps) {
  return (
    <div className={cn(NEON_BACKDROP.root, 'pointer-events-none absolute inset-0 z-0 overflow-hidden', className)} aria-hidden="true">
      <div className={NEON_BACKDROP.aurora} />
      <div className={NEON_BACKDROP.orbs}>
        <span className={NEON_BACKDROP.orbA} aria-hidden="true" />
        <span className={NEON_BACKDROP.orbB} aria-hidden="true" />
        <span className={NEON_BACKDROP.orbC} aria-hidden="true" />
      </div>
      <div className={NEON_BACKDROP.starsFar} />
      <div className={NEON_BACKDROP.starsNear} />
      <div className={NEON_BACKDROP.grid} />
      <div className={NEON_BACKDROP.scan} />
      <div className={NEON_BACKDROP.vignette} />
    </div>
  )
}
