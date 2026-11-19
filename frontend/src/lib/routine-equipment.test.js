import { describe, expect, it } from 'vitest'
import { ACC_V } from './equipment.js'
import { availableRoutineState, routineAvailable, routineEquipmentProfile, routineIdsAvailable } from './routine-equipment.js'
import { effectiveRoutineIds, nextTrainingDay } from './history.js'
import { queueView } from './queue.js'
import { copyRoutine } from './routines.js'
import { mergeStates, stampChange } from './sync-merge.js'

const profiles = [
  { id: 'home', name: 'Home', equipment: ['dumbbell'], accV: ACC_V },
  { id: 'gym', name: 'Gym', equipment: ['dumbbell', 'barbell', 'bench', 'pull-up bar'], accV: ACC_V },
]
const customEx = [
  { id: 'curl', n: 'standing curl', eq: 'dumbbell' },
  { id: 'press', n: 'bench press', eq: 'dumbbell' },
  { id: 'pull', n: 'pull-up', eq: 'body weight' },
  { id: 'push', n: 'push-up', eq: 'body weight' },
]
const routine = (id, ex, equipmentProfileId) => ({ id, name: id, ex: ex.map(id => ({ id })), ...(equipmentProfileId ? { equipmentProfileId } : {}) })
const routines = [routine('home-curl', ['curl'], 'home'), routine('gym-curl', ['curl'], 'gym'), routine('bench', ['press']), routine('body', ['push'])]
const state = over => ({ routines: structuredClone(routines), customEx, equipProfiles: structuredClone(profiles), equipFilterOn: true, activeEquipId: 'home', week: {}, dayPlan: {}, workouts: [], ...over })

describe('routine equipment compatibility', () => {
  it('checks an explicit tag as well as every exercise, without hiding untagged compatible routines', () => {
    const S = state()
    expect(availableRoutineState(S).routines.map(r => r.id)).toEqual(['home-curl', 'body'])
    expect(routineAvailable(S, routine('tagged-but-missing-bench', ['press'], 'home'))).toBe(false)
    expect(routineAvailable(S, routine('mixed', ['push', 'press']))).toBe(false)
  })

  it('uses accessories for bodyweight and free-weight exercises', () => {
    expect(routineAvailable(state(), routine('pull', ['pull']))).toBe(false)
    const S = state({ activeEquipId: 'gym' })
    expect(routineAvailable(S, routine('pull', ['pull']))).toBe(true)
    expect(routineAvailable(S, routine('bench', ['press']))).toBe(true)
  })

  it('keeps legacy profiles compatible until their accessory checklist is saved', () => {
    const S = state({ equipProfiles: [{ ...profiles[0], accV: undefined }] })
    expect(routineAvailable(S, routine('legacy-bench', ['press']))).toBe(true)
  })

  it('shows everything with the filter off, a missing active profile, or no saved profiles', () => {
    for (const over of [{ equipFilterOn: false }, { activeEquipId: 'gone' }, { equipProfiles: [] }]) {
      const S = state(over)
      expect(availableRoutineState(S)).toBe(S)
    }
  })

  it('falls back to automatic matching if the tagged profile is deleted', () => {
    const r = routine('old-tag', ['curl'], 'deleted')
    expect(routineEquipmentProfile(state(), r)).toBeNull()
    expect(routineAvailable(state(), r)).toBe(true)
  })

  it('still respects owning no dumbbells when all equipment is selected', () => {
    const S = state({ equipFilterOn: false, dumbbells: { none: { on: true, _ts: 1 } } })
    expect(availableRoutineState(S).routines.map(r => r.id)).toEqual(['body'])
  })

  it('tolerates empty routines and exercises without catalogue metadata', () => {
    expect(routineAvailable(state(), routine('empty', []))).toBe(true)
    expect(routineAvailable(state(), routine('unknown', ['missing']))).toBe(true)
  })

  it('filters a combined planned day without changing the saved schedule, logs or active session', () => {
    const iso = '2026-11-10'
    const S = state({ week: { 2: routines.map(r => r.id) }, active: { name: 'Already running' } })
    const before = structuredClone(S)
    const training = availableRoutineState(S)
    expect(effectiveRoutineIds(training, iso, iso)).toEqual(['home-curl', 'body'])
    expect(training.active).toBe(S.active)
    expect(training.workouts).toBe(S.workouts)
    expect(S).toEqual(before)
  })

  it('skips incompatible queue sessions without completing or deleting them', () => {
    const iso = '2026-11-10'
    const S = state({ queue: { ids: ['gym-curl', 'home-curl', 'bench', 'body'], since: 1, startsOn: iso } })
    const training = availableRoutineState(S)
    expect(effectiveRoutineIds(training, iso, iso)).toEqual(['home-curl'])
    expect(queueView(training, iso).items.map(x => x.id)).toEqual(['home-curl', 'body'])
    expect(S.queue.ids).toHaveLength(4)
    expect(S.workouts).toEqual([])
    expect(queueView(availableRoutineState({ ...S, activeEquipId: 'gym' }), iso).items.map(x => x.id)).toEqual(['gym-curl', 'bench', 'body'])
  })

  it('does not offer a blocked date override or next training day', () => {
    const S = state({ dayPlan: { '2026-11-10': 'gym-curl' }, week: { 3: ['bench'], 4: ['home-curl'] } })
    const training = availableRoutineState(S)
    expect(effectiveRoutineIds(training, '2026-11-10', '2026-11-10')).toEqual([])
    expect(nextTrainingDay(training, '2026-11-10').routine.id).toBe('home-curl')
    expect(nextTrainingDay(availableRoutineState(state({ routines: [routines[1]], week: { 3: ['gym-curl'] } })), '2026-11-10')).toBeNull()
  })

  it('rejects a stale start, but allows freestyle and existing unknown routine handling', () => {
    expect(routineIdsAvailable(state(), ['home-curl', 'gym-curl'])).toBe(false)
    expect(routineIdsAvailable(state(), 'gym-curl')).toBe(false)
    expect(routineIdsAvailable(state(), ['home-curl'])).toBe(true)
    expect(routineIdsAvailable(state(), [])).toBe(true)
    expect(routineIdsAvailable(state(), 'removed')).toBe(true)
  })

  it('keeps a copied tag and syncs changing and clearing it independently of the exercise list', () => {
    const before = state()
    const tagged = structuredClone(before)
    tagged.routines[0].equipmentProfileId = 'gym'
    stampChange(before, tagged, 100)
    const remote = structuredClone(before)
    remote.routines[0].name = 'Renamed elsewhere'
    stampChange(before, remote, 200)
    const merged = mergeStates(tagged, remote)
    expect(merged.routines[0]).toMatchObject({ name: 'Renamed elsewhere', equipmentProfileId: 'gym' })
    expect(copyRoutine(merged.routines[0]).equipmentProfileId).toBe('gym')
    const cleared = structuredClone(merged)
    cleared.routines[0].equipmentProfileId = ''
    stampChange(merged, cleared, 300)
    expect(mergeStates(cleared, tagged).routines[0].equipmentProfileId).toBe('')
  })
})
