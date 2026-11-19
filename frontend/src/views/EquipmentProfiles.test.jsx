// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { bindUI } from '../components/ui.jsx'
import { setLang } from '../lib/i18n.js'
import { ACC_V } from '../lib/equipment.js'
import { EXIDX } from '../lib/exercises.js'
import { todayISO } from '../lib/format.js'
import Home from './Home.jsx'
import RoutineEdit from './RoutineEdit.jsx'
import Workout from './Workout.jsx'
import TabBar from '../components/TabBar.jsx'
import { beginWorkout, dayOverrideSheet, addRoutineToSessionSheet, startFlow } from '../sheets.jsx'

vi.mock('../components/Media.jsx', () => ({ default: () => null, Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const roots = [], hosts = []
const curl = Object.values(EXIDX).find(ex => ex.eq === 'dumbbell' && ex.n === 'dumbbell standing biceps curl') || Object.values(EXIDX).find(ex => ex.eq === 'dumbbell' && /standing.*curl/.test(ex.n))
const profiles = [
  { id: 'home', name: 'Home setup', equipment: ['dumbbell', 'bench', 'pull-up bar'], accV: ACC_V },
  { id: 'gym', name: 'Gym setup', equipment: ['dumbbell', 'bench', 'pull-up bar', 'barbell'], accV: ACC_V },
]
const routines = [
  { id: 'home-r', name: 'Home routine', equipmentProfileId: 'home', ex: [{ id: curl.id, sets: 2, reps: 8, weight: 10 }] },
  { id: 'gym-r', name: 'Gym routine', equipmentProfileId: 'gym', ex: [{ id: curl.id, sets: 2, reps: 8, weight: 10 }] },
]
const render = node => {
  const host = document.createElement('div')
  document.body.append(host); hosts.push(host)
  const root = createRoot(host); roots.push(root)
  act(() => root.render(node))
  return host
}
const mount = (node, path = '/home') => render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>)
const sheet = () => {
  const top = useUI.getState().sheets.at(-1)
  return render(top.render(() => useUI.getState().closeSheet(top.id)))
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const profileRow = host => [...host.querySelectorAll('button')].find(b => b.querySelector('.lrow-t')?.textContent === 'Equipment profile')
const choose = (host, label) => {
  act(() => profileRow(host).click())
  const options = sheet()
  act(() => button(options, label).click())
}

beforeEach(() => {
  localStorage.clear(); setLang('en'); bindUI(useUI)
  useUI.setState({ sheets: [], toastMsg: '' })
  const S = { ...structuredClone(DEF), routines: structuredClone(routines), equipProfiles: structuredClone(profiles), activeEquipId: 'home', equipFilterOn: true, weighIn: false,
    week: { [new Date().getDay()]: ['gym-r', 'home-r'] }, dayPlan: {}, workouts: [], active: null }
  useStore.setState({ S, user: null, ready: true })
})
afterEach(() => {
  act(() => roots.splice(0).forEach(root => root.unmount()))
  hosts.splice(0).forEach(host => host.remove())
  useUI.setState({ sheets: [] })
})

it('switches the Home selector, updates today immediately and persists the same choice', () => {
  const host = mount(<Home />)
  expect(host.querySelector('.today-row .ttl').textContent).toBe('Home routine')
  choose(host, 'Gym setup')
  expect(host.querySelector('.today-row .ttl').textContent).toBe('Gym routine')
  const saved = JSON.parse(localStorage.getItem('gym_state_v1'))
  expect(saved).toMatchObject({ activeEquipId: 'gym', equipFilterOn: true, invGym: 'gym' })
  expect(saved.routines).toHaveLength(2)
  choose(host, 'All equipment')
  expect(host.querySelector('.today-row .ttl').textContent).toBe('Gym routine + Home routine')
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).equipFilterOn).toBe(false)
})

it('assigns and clears a routine tag without replacing its exercise configuration', () => {
  const host = mount(<Routes><Route path="/plan/r/:id" element={<RoutineEdit />} /></Routes>, '/plan/r/home-r')
  const exercises = structuredClone(useStore.getState().S.routines[0].ex)
  choose(host, 'Gym setup')
  expect(useStore.getState().S.routines[0]).toMatchObject({ equipmentProfileId: 'gym', ex: exercises })
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).routines[0].equipmentProfileId).toBe('gym')
  choose(host, 'Match exercise equipment automatically')
  expect(useStore.getState().S.routines[0].equipmentProfileId).toBe('')
})

it('does not offer incompatible routines on the Start screen or the day picker', () => {
  const host = mount(<Workout />)
  expect(host.textContent).toContain('Home routine')
  expect(host.textContent).not.toContain('Gym routine')
  act(() => dayOverrideSheet(todayISO()))
  const picker = sheet()
  expect(picker.textContent).toContain('Home routine')
  expect(picker.textContent).not.toContain('Gym routine')
})

it('starts only the compatible part of a combined day from the tab bar', () => {
  useStore.setState({ user: { id: 'qa', name: 'QA' } })
  const onStart = vi.fn()
  const host = mount(<TabBar onStart={onStart} />)
  act(() => host.querySelector('[data-tour="start"]').click())
  expect(onStart).toHaveBeenCalledWith(['home-r'])
})

it('shows an empty result instead of offering an incompatible routine and keeps all routines editable', () => {
  act(() => useStore.setState(s => ({ S: { ...s.S, routines: [s.S.routines[1]] } })))
  const host = mount(<Workout />)
  expect(host.textContent).not.toContain('Gym routine')
  expect(host.querySelector('[role="status"]').textContent).toContain('No routines match')
  expect(useStore.getState().S.routines).toHaveLength(1)
})

it('blocks stale starts and rechecks the profile after the weigh-in sheet', () => {
  act(() => startFlow(['gym-r']))
  expect(useStore.getState().S.active).toBeNull()
  expect(useUI.getState().toastMsg).toBeTruthy()
  act(() => beginWorkout(['gym-r'], null))
  expect(useStore.getState().S.active).toBeNull()
})

it('preserves a running session and filters the add-routine choices', () => {
  const active = { id: 'running', name: 'Existing workout', start: 1, entries: [], cur: 0, routineIds: [] }
  useStore.setState(s => ({ S: { ...s.S, active } }))
  const host = mount(<Home />)
  choose(host, 'Gym setup')
  expect(useStore.getState().S.active).toMatchObject(active)
  act(() => addRoutineToSessionSheet())
  const picker = sheet()
  expect(picker.textContent).toContain('Gym routine')
  expect(picker.textContent).not.toContain('Home routine')
})
