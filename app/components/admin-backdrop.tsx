import { ADMIN_BACKDROP } from '@/lib/admin-backdrop'

export function AdminBackdrop() {
  return (
    <div className={ADMIN_BACKDROP.root} aria-hidden="true">
      <div className={ADMIN_BACKDROP.aurora} />
      <div className={ADMIN_BACKDROP.starsFar} />
      <div className={ADMIN_BACKDROP.starsNear} />
      <div className={ADMIN_BACKDROP.grid} />
      <div className={ADMIN_BACKDROP.vignette} />
    </div>
  )
}
