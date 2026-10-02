import type { ReactNode } from "react"

const P: Record<string, string> = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.3-4.3",
  star: "M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9Z",
  map: "M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5M15 6.5V20",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z",
  cal: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm0 3h16M8 3v4M16 3v4",
  people:
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.6 3 2.4 3 5.2",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5",
  chev: "m9 6 6 6-6 6",
  back: "m15 6-6 6 6 6",
  down: "m6 9 6 6 6-6",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  route:
    "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7",
  check: "m5 12.5 4.5 4.5L19 7.5",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  pin: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 2",
  wifi: "M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.3M19 13a10 10 0 0 0-3-2M12 20h.01",
  alert: "M12 4 2.5 20h19L12 4Zm0 6v4.5m0 3h.01",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  swap: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  edit: "M4 20h4L19 9l-4-4L4 16v4Z",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  share: "M12 15V3m0 0L8 7m4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7",
  cloud: "M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5H7Z",
  download: "M12 4v11m0 0-4-4m4 4 4-4M5 20h14",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7m0 3h.01",
  key: "M14 10a4 4 0 1 0-3.5 4L9 15.5V18H6.5v2.5H3.5V18l6.4-6.4A4 4 0 0 0 14 10Zm1-2h.01",
  shield: "M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z",
}
export function I({
  n,
  s = 20,
  fill,
  className = "",
}: {
  n: keyof typeof P | string
  s?: number
  fill?: boolean
  className?: string
}) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={P[n]} />
    </svg>
  )
}

const TONES = {
  neutral: "bg-surface2 text-ink2",
  teal: "bg-tealsoft text-teal",
  warn: "bg-warnsoft text-warn",
  danger: "bg-dangersoft text-danger",
}
export function Badge({
  tone = "neutral",
  children,
  dot,
}: {
  tone?: keyof typeof TONES
  children: ReactNode
  dot?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function Group({
  title,
  footer,
  children,
}: {
  title?: string
  footer?: string
  children: ReactNode
}) {
  return (
    <section className="mb-6">
      {title && (
        <h3 className="mb-2 px-4 text-[13.5px] font-medium tracking-wide text-ink2/80">
          {title}
        </h3>
      )}
      <div className="overflow-hidden rounded-[20px] bg-surface divide-y divide-line shadow-sm ring-1 ring-black/[0.04] dark:ring-white/5">
        {children}
      </div>
      {footer && (
        <p className="mt-2.5 px-4 text-[12px] leading-relaxed text-ink3">
          {footer}
        </p>
      )}
    </section>
  )
}

export function Row({
  icon,
  title,
  sub,
  right,
  onClick,
  tint,
}: {
  icon?: string
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  onClick?: () => void
  tint?: string
}) {
  const C = onClick ? "button" : "div"
  return (
    <C
      onClick={onClick}
      className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors active:bg-surface2"
    >
      {icon && (
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-xl text-white shadow-sm ${tint ?? "bg-teal"}`}
        >
          <I n={icon} s={16} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] font-medium text-ink">
          {title}
        </span>
        {sub && (
          <span className="mt-0.5 block text-[13px] text-ink3">{sub}</span>
        )}
      </span>
      {right}
      {onClick && <I n="chev" s={18} className="text-ink3/50" />}
    </C>
  )
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { v: T l: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-[10px] bg-ink/[0.06] p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-all ${
            value === o.v
              ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
              : "text-ink2"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

export function Btn({
  children,
  kind = "primary",
  onClick,
  className = "",
  disabled,
}: {
  children: ReactNode
  kind?: "primary" | "tinted" | "plain" | "danger"
  onClick?: () => void
  className?: string
  disabled?: boolean
}) {
  const k = {
    primary: "bg-teal text-white shadow-sm hover:brightness-110",
    tinted: "bg-tealsoft text-teal hover:bg-teal/[0.15]",
    plain: "bg-surface2 text-ink hover:bg-ink/[0.08]",
    danger: "bg-dangersoft text-danger hover:bg-danger/[0.15]",
  }[kind]
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-[15px] font-semibold transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${k} ${className}`}
    >
      {children}
    </button>
  )
}

export function Toggle({
  on,
  onChange,
}: {
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!on)
      }}
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors ${
        on ? "bg-teal" : "bg-ink/15"
      }`}
    >
      <span
        className={`absolute top-[2px] size-[26px] rounded-full bg-white shadow transition-all ${
          on ? "left-[22px]" : "left-[2px]"
        }`}
      />
    </button>
  )
}

export function Empty({
  icon,
  title,
  sub,
  action,
}: {
  icon: string
  title: string
  sub: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-surface px-6 py-10 text-center shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      <span className="mb-4 grid size-[52px] place-items-center rounded-full bg-surface2 text-ink3 ring-1 ring-inset ring-black/5 dark:ring-white/5">
        <I n={icon} s={24} />
      </span>
      <p className="text-[16px] font-semibold text-ink">{title}</p>
      <p className="mt-1.5 max-w-[260px] text-[13.5px] leading-relaxed text-ink2">
        {sub}
      </p>
      {action && <div className="mt-5 flex gap-2.5">{action}</div>}
    </div>
  )
}

export function Sample() {
  return (
    <span className="rounded border border-line px-1 text-[10px] font-medium text-ink3">
      示例
    </span>
  )
}
