export interface ActivityRefreshOptions<T> {
  run: (signal: AbortSignal) => Promise<T>
  onSuccess: (value: T) => void
  onError?: (error: unknown) => void
  visible?: boolean
  online?: boolean
  clock?: ActivityRefreshClock
}

export interface ActivityRefreshClock {
  now: () => number
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void
}

const minute = 60_000
const backoffMinutes = [1, 2, 4, 8, 15]

/**
 * One activity owns one controller. run must fetch only; onSuccess is the
 * guarded write-back point. stop permanently disposes it when activity changes.
 * Browser event listeners belong to the caller and call setEnvironment.
 */
export function createActivityRefresh<T>(options: ActivityRefreshOptions<T>) {
  const clock = options.clock ?? {
    now: () => Date.now(),
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
  }
  let visible = options.visible ?? true
  let online = options.online ?? true
  let started = false
  let stopped = false
  let failures = 0
  let generation = 0
  let nextAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let active: AbortController | undefined

  const enabled = () => started && !stopped && visible && online
  function clearTimer() {
    if (timer !== undefined) clock.clearTimeout(timer)
    timer = undefined
  }
  function schedule() {
    clearTimer()
    if (!enabled() || active) return
    const delay = Math.max(0, nextAt - clock.now())
    if (delay === 0) void refresh()
    else timer = clock.setTimeout(() => { timer = undefined; void refresh() }, delay)
  }
  async function refresh() {
    if (!enabled() || active) return
    if (clock.now() < nextAt) { schedule(); return }
    clearTimer()
    const request = new AbortController()
    const requestGeneration = generation
    active = request
    nextAt = clock.now() + minute
    const current = () => enabled() && generation === requestGeneration && !request.signal.aborted
    try {
      const value = await options.run(request.signal)
      if (current()) {
        options.onSuccess(value)
        failures = 0
        nextAt = clock.now() + minute
      }
    } catch (error) {
      if (current()) {
        failures = Math.min(failures + 1, backoffMinutes.length)
        nextAt = clock.now() + backoffMinutes[failures - 1] * minute
        // A display callback cannot reject this fire-and-forget request.
        try { options.onError?.(error) } catch { /* Retry remains scheduled. */ }
      }
    } finally {
      if (active === request) active = undefined
      schedule()
    }
  }

  return {
    start(immediate = true) {
      if (started || stopped) return
      started = true
      nextAt = clock.now() + (immediate ? 0 : minute)
      schedule()
    },
    setEnvironment(environment: { visible: boolean; online: boolean }) {
      if (stopped || (visible === environment.visible && online === environment.online)) return
      visible = environment.visible
      online = environment.online
      if (!visible || !online) {
        clearTimer()
        generation++
        active?.abort()
      } else schedule()
    },
    /** Requests an earlier check, but never bypasses the same retry budget. */
    refreshNow() { schedule() },
    stop() {
      if (stopped) return
      stopped = true
      generation++
      clearTimer()
      active?.abort()
    },
  }
}
