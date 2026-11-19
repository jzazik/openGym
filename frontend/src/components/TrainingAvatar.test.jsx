// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import TrainingAvatar from './TrainingAvatar.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root
let host
afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  vi.useRealTimers()
})

it('updates the displayed dog when a workout is saved', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 9, 12))
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root.render(<TrainingAvatar workouts={[{ d: '2026-11-02' }]} />))
  expect(host.querySelector('img').getAttribute('src')).toContain('doge-rest-v1.png')
  act(() => root.render(<TrainingAvatar workouts={[{ d: '2026-11-02' }, { d: '2026-11-09' }]} />))
  expect(host.querySelector('img').getAttribute('src')).toContain('doge-strong-v1.png')
})

it('refreshes the avatar when an open app crosses the seventh day', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 8, 23, 59, 30))
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root.render(<TrainingAvatar workouts={[{ d: '2026-11-02' }]} />))
  expect(host.querySelector('img').dataset.trainingAvatar).toBe('strong')
  act(() => vi.advanceTimersByTime(60000))
  expect(host.querySelector('img').dataset.trainingAvatar).toBe('rest')
})
