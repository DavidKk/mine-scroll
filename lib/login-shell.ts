import { cn } from '@/lib/cn'

export const LOGIN_PAGE_SHELL = 'relative grid min-h-dvh place-items-center overflow-hidden p-6 font-sans text-slate-200 bg-landing-scroll-host'

export const LOGIN_PANEL_SHELL = cn(
  'relative z-[1] grid w-full max-w-[420px] gap-3.5 rounded-2xl bg-admin-panel px-6 pb-[22px] pt-7',
  'shadow-[0_0_0_1px_rgba(45,236,255,0.12),0_24px_64px_rgba(0,0,0,0.55)]'
)

export const LOGIN_FIELD_LABEL = 'text-[0.72rem] font-bold uppercase tracking-[0.08em] text-admin-muted'

export const LOGIN_INPUT_CLASS = cn(
  'w-full rounded-[10px] border border-white/10 bg-[rgba(10,14,24,0.92)] px-3 py-[11px] font-[inherit] text-[0.95rem] text-zinc-50',
  'transition-[border-color,box-shadow] duration-150 focus:border-landing-cyan/25 focus:outline-none focus:shadow-[0_0_0_2px_rgba(45,236,255,0.12)]'
)

export const LOGIN_OAUTH_BUTTON_CLASS = cn(
  'flex w-full min-h-12 cursor-pointer items-center justify-center gap-2.5 rounded-[10px] border border-white/15',
  'bg-gradient-to-b from-white/[0.08] to-white/[0.03] font-[inherit] font-bold tracking-[0.04em] text-admin-text',
  'transition-[box-shadow,border-color] duration-150 hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.06)]',
  'disabled:cursor-wait disabled:opacity-65'
)

export const LOGIN_SIGNET_BUTTON_CLASS = cn(
  'flex w-full min-h-12 cursor-pointer items-center justify-center gap-2.5 rounded-[10px] border border-landing-cyan/30',
  'bg-gradient-to-b from-landing-cyan/15 to-landing-cyan/[0.06] font-[inherit] font-bold tracking-[0.06em] text-admin-text',
  'transition-[box-shadow,border-color] duration-150 hover:border-landing-cyan/45 hover:shadow-[0_0_24px_rgba(45,236,255,0.18)]'
)
