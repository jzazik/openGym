import { describe, expect, it } from 'vitest'
import { trainingAvatar } from './training-avatar.js'

describe('training avatar', () => {
  it('welcomes a new profile with the strong dog', () => {
    expect(trainingAvatar([], '2026-11-09')).toBe('strong')
    expect(trainingAvatar(undefined, '2026-11-09')).toBe('strong')
  })

  it('switches after seven calendar days without a workout', () => {
    const workouts = [{ d: '2026-11-02' }]
    expect(trainingAvatar(workouts, '2026-11-08')).toBe('strong')
    expect(trainingAvatar(workouts, '2026-11-09')).toBe('rest')
    expect(trainingAvatar(workouts, '2026-12-01')).toBe('rest')
  })

  it('returns to the strong dog as soon as a new workout is saved', () => {
    const workouts = [{ d: '2026-10-01' }]
    expect(trainingAvatar(workouts, '2026-11-09')).toBe('rest')
    expect(trainingAvatar([...workouts, { d: '2026-11-09' }], '2026-11-09')).toBe('strong')
  })

  it('uses the most recent valid logged day regardless of import order', () => {
    expect(trainingAvatar([{ d: '2026-11-08' }, { d: '2026-10-01' }], '2026-11-09')).toBe('strong')
  })

  it('does not let future or malformed dates hide a seven-day gap', () => {
    const workouts = [{ d: '2026-11-02' }, { d: '2026-12-01' }, { d: '2026-11-32' }, { d: '2026-11-09junk' }, null]
    expect(trainingAvatar(workouts, '2026-11-09')).toBe('rest')
    expect(trainingAvatar([{ d: '2026-02-30' }], '2026-03-09')).toBe('strong')
  })

  it('counts calendar days across daylight-saving and year changes', () => {
    expect(trainingAvatar([{ d: '2026-03-23' }], '2026-03-30')).toBe('rest')
    expect(trainingAvatar([{ d: '2026-10-19' }], '2026-10-26')).toBe('rest')
    expect(trainingAvatar([{ d: '2026-12-29' }], '2027-01-05')).toBe('rest')
  })
})
