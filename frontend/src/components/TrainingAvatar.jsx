import { useEffect, useState } from 'react'
import { todayISO } from '../lib/format.js'
import { trainingAvatar } from '../lib/training-avatar.js'

export default function TrainingAvatar({ workouts, size = 64 }) {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const refresh = () => setToday(todayISO())
    const timer = setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const state = trainingAvatar(workouts, today)
  return <img className="training-avatar" data-training-avatar={state} src={`${import.meta.env.BASE_URL}doge-${state}-v1.png`} width={size} height={size} alt="" aria-hidden="true" />
}
