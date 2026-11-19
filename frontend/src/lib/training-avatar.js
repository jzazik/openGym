import { todayISO } from './format.js'

const dayOf = iso => {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const day = Date.parse(iso + 'T00:00:00Z')
  return Number.isFinite(day) && new Date(day).toISOString().slice(0, 10) === iso ? day / 86400000 : null
}

export function trainingAvatar(workouts, today = todayISO()) {
  const now = dayOf(today)
  if (now === null) return 'strong'
  let latest = null
  for (const workout of Array.isArray(workouts) ? workouts : []) {
    const day = dayOf(workout?.d)
    if (day !== null && day <= now && (latest === null || day > latest)) latest = day
  }
  return latest !== null && now - latest >= 7 ? 'rest' : 'strong'
}
