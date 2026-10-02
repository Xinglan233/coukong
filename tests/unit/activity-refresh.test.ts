import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createActivityRefresh } from '../../src/online/activity/activity-refresh'

const minute = 60_000
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

describe('活动刷新频率、退避和取消', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0) })
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

  it('可见且在线的同一控制器每60秒最多一次，重复start和主动恢复不增加请求', async () => {
    const starts: number[] = [], received: number[] = []
    const controller = createActivityRefresh({ run: async () => { starts.push(Date.now()); return starts.length }, onSuccess: value => received.push(value) })
    controller.start(); controller.start(); controller.refreshNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(starts).toEqual([0]); expect(received).toEqual([1])
    await vi.advanceTimersByTimeAsync(minute - 1)
    controller.refreshNow(); controller.setEnvironment({ visible: true, online: true })
    expect(starts).toEqual([0])
    await vi.advanceTimersByTimeAsync(1)
    expect(starts).toEqual([0, minute])
    controller.stop()
  })

  it('已有hydrate时start(false)先等一分钟', async () => {
    const starts: number[] = []
    const controller = createActivityRefresh({ run: async () => { starts.push(Date.now()); return 1 }, onSuccess: () => {} })
    controller.start(false)
    await vi.advanceTimersByTimeAsync(minute - 1); expect(starts).toEqual([])
    await vi.advanceTimersByTimeAsync(1); expect(starts).toEqual([minute])
    controller.stop()
  })

  it('连续失败依次退避1/2/4/8/15分钟，成功后回到一分钟', async () => {
    const starts: number[] = [], errors: unknown[] = []
    const controller = createActivityRefresh({ run: async () => { starts.push(Date.now()); if (starts.length <= 6) throw new Error('网络失败'); return 'ok' }, onSuccess: () => {}, onError: error => errors.push(error) })
    controller.start(); await vi.advanceTimersByTimeAsync(0)
    for (const delay of [1, 2, 4, 8, 15, 15]) {
      const count = starts.length
      await vi.advanceTimersByTimeAsync(delay * minute - 1); expect(starts).toHaveLength(count)
      await vi.advanceTimersByTimeAsync(1); expect(starts).toHaveLength(count + 1)
    }
    expect(starts).toEqual([0, 1, 3, 7, 15, 30, 45].map(n => n * minute))
    expect(errors).toHaveLength(6)
    await vi.advanceTimersByTimeAsync(minute)
    expect(starts[starts.length - 1]).toBe(46 * minute)
    controller.stop()
  })

  it('失败后重复online/visibility事件不能绕过退避', async () => {
    let calls = 0
    const controller = createActivityRefresh({ run: async () => { calls++; throw new Error('故障') }, onSuccess: () => {} })
    controller.start(); await vi.advanceTimersByTimeAsync(minute)
    expect(calls).toBe(2)
    controller.setEnvironment({ visible: false, online: false })
    await vi.advanceTimersByTimeAsync(30_000)
    for (let n = 0; n < 10; n++) { controller.setEnvironment({ visible: true, online: true }); controller.refreshNow() }
    await vi.advanceTimersByTimeAsync(89_999); expect(calls).toBe(2)
    await vi.advanceTimersByTimeAsync(1); expect(calls).toBe(3)
    controller.stop()
  })

  it('隐藏期间无定时器，重新可见只恢复一个请求', async () => {
    const starts: number[] = []
    const controller = createActivityRefresh({ run: async () => { starts.push(Date.now()); return 1 }, onSuccess: () => {} })
    controller.start(); await vi.advanceTimersByTimeAsync(0)
    controller.setEnvironment({ visible: false, online: true })
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(5 * minute); expect(starts).toEqual([0])
    controller.setEnvironment({ visible: true, online: true }); controller.setEnvironment({ visible: true, online: true })
    await vi.advanceTimersByTimeAsync(0); expect(starts).toEqual([0, 5 * minute])
    expect(vi.getTimerCount()).toBe(1)
    controller.stop()
  })

  it('初始离线不请求，联网事件进入同一个频率闸门', async () => {
    let calls = 0
    const controller = createActivityRefresh({ online: false, run: async () => ++calls, onSuccess: () => {} })
    controller.start(); await vi.advanceTimersByTimeAsync(5 * minute)
    expect(calls).toBe(0); expect(vi.getTimerCount()).toBe(0)
    controller.setEnvironment({ visible: true, online: true })
    await vi.advanceTimersByTimeAsync(0); expect(calls).toBe(1)
    controller.setEnvironment({ visible: true, online: false })
    controller.setEnvironment({ visible: true, online: true })
    await vi.advanceTimersByTimeAsync(minute - 1); expect(calls).toBe(1)
    await vi.advanceTimersByTimeAsync(1); expect(calls).toBe(2)
    controller.stop()
  })

  it('慢请求不并发，完成后从完成时刻等待一分钟而非追赶遗漏轮次', async () => {
    const pending = deferred<string>(), starts: number[] = [], received: string[] = []
    const controller = createActivityRefresh({ run: () => { starts.push(Date.now()); return starts.length === 1 ? pending.promise : Promise.resolve('next') }, onSuccess: value => received.push(value) })
    controller.start(); await vi.advanceTimersByTimeAsync(3 * minute)
    controller.refreshNow(); expect(starts).toEqual([0])
    pending.resolve('first'); await vi.advanceTimersByTimeAsync(0)
    expect(received).toEqual(['first'])
    await vi.advanceTimersByTimeAsync(minute - 1); expect(starts).toEqual([0])
    await vi.advanceTimersByTimeAsync(1); expect(starts).toEqual([0, 4 * minute])
    controller.stop()
  })

  it('隐藏取消慢请求且拒绝迟到数据，忽略abort的请求结束前也不并发', async () => {
    const pending = deferred<string>(), received: string[] = [], signals: AbortSignal[] = []
    const controller = createActivityRefresh({ run: signal => { signals.push(signal); return signals.length === 1 ? pending.promise : Promise.resolve('fresh') }, onSuccess: value => received.push(value) })
    controller.start(); await vi.advanceTimersByTimeAsync(0)
    controller.setEnvironment({ visible: false, online: true })
    expect(signals).toHaveLength(1); expect(signals[0].aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(2 * minute)
    controller.setEnvironment({ visible: true, online: true }); await vi.advanceTimersByTimeAsync(0)
    expect(signals).toHaveLength(1)
    pending.resolve('stale'); await vi.advanceTimersByTimeAsync(0)
    expect(received).toEqual(['fresh']); expect(signals).toHaveLength(2)
    controller.stop()
  })

  it('切活动stop取消信号、清定时器，迟到成功和失败都不写回', async () => {
    for (const failed of [false, true]) {
      const pending = deferred<string>(), received: string[] = [], errors: unknown[] = []
      let signal: AbortSignal | undefined
      const controller = createActivityRefresh({ run: value => { signal = value; return pending.promise }, onSuccess: value => received.push(value), onError: error => errors.push(error) })
      controller.start(); await vi.advanceTimersByTimeAsync(0); controller.stop()
      expect(signal?.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0)
      if (failed) pending.reject(new Error('迟到错误')); else pending.resolve('旧活动')
      await vi.advanceTimersByTimeAsync(15 * minute)
      controller.start(); controller.refreshNow()
      expect(received).toEqual([]); expect(errors).toEqual([]); expect(vi.getTimerCount()).toBe(0)
    }
  })
})
