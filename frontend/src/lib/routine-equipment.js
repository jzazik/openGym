import { activeProfile, exAvailable } from './equipment.js'
import { exOr } from './exercises.js'

export const routineEquipmentProfile = (S, routine) =>
  (S.equipProfiles || []).find(p => p.id === routine.equipmentProfileId) || null

export function routineAvailable(S, routine) {
  const profile = activeProfile(S)
  if (!profile) return true
  const assigned = routineEquipmentProfile(S, routine)
  if (profile.id && assigned && assigned.id !== profile.id) return false
  return (routine.ex || []).every(slot => exAvailable(S,
    (S.customEx || []).find(ex => ex.id === slot.id) || exOr(slot.id)))
}

export function availableRoutineState(S) {
  const routines = S.routines.filter(r => routineAvailable(S, r))
  return routines.length === S.routines.length ? S : { ...S, routines }
}

export function routineIdsAvailable(S, ids) {
  return [].concat(ids || []).every(id => {
    const routine = S.routines.find(r => r.id === id)
    return !routine || routineAvailable(S, routine)
  })
}
