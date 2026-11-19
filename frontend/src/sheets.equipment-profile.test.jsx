// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { equipmentProfileSheet } from './sheets.jsx'
import { ALL_EQUIPMENT, ACC_V } from './lib/equipment.js'
import { MACHINE_EQ } from './lib/machine-kinds.js'
import { setLang } from './lib/i18n.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host
beforeEach(() => {
  localStorage.clear()
  setLang('en')
  useUI.setState({ sheets: [] })
  useStore.setState({ S: structuredClone(DEF), user: null })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})
const open = profile => {
  equipmentProfileSheet(profile)
  const sheet = useUI.getState().sheets.at(-1)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
}
const option = label => [...host.querySelectorAll('.equipment-option')].find(button => button.querySelector('[lang="en"]')?.textContent === label)
const save = () => act(() => [...host.querySelectorAll('button')].find(button => button.textContent === 'Save').click())

it('creates a settings profile with bilingual choices and the original equipment identifiers', () => {
  open(null)
  const cards = [...host.querySelectorAll('.equipment-option')]
  const choices = ALL_EQUIPMENT.filter(k => !MACHINE_EQ.includes(k))
  expect(cards).toHaveLength(choices.length)
  expect(host.querySelectorAll('.equipment-option-image')).toHaveLength(choices.length - 1)
  expect([...host.querySelectorAll('.equipment-option-compact')].map(card => card.textContent)).toEqual(['adjustable bench'])
  for (const card of cards.filter(card => !card.classList.contains('equipment-option-compact'))) {
    expect(card.querySelector('[lang="ru"]').textContent).toMatch(/[А-Яа-яЁё]/)
    expect(card.querySelector('[lang="en"]').textContent).toBeTruthy()
  }
  host.querySelector('input').value = '  Home QA  '
  act(() => option('Dumbbell').click())
  act(() => option('Bench').click())
  act(() => option('Pull-up Bar').click())
  save()
  const state = useStore.getState().S
  expect(state.equipProfiles).toHaveLength(1)
  expect(state.equipProfiles[0]).toMatchObject({ name: 'Home QA', equipment: ['dumbbell', 'bench', 'pull-up bar'], accV: ACC_V })
  expect(state.activeEquipId).toBe(state.equipProfiles[0].id)
})

it('preserves legacy accessories and another gym when editing the illustrated profile', () => {
  const profile = { id: 'legacy', name: 'Old gym', equipment: ['dumbbell', 'roller'] }
  const other = { id: 'other', name: 'Travel', equipment: ['kettlebell'], accV: ACC_V }
  useStore.setState({ S: { ...structuredClone(DEF), equipProfiles: [profile, other], activeEquipId: 'other' } })
  open(profile)
  for (const label of ['Bench', 'Pull-up Bar', 'Massage Ball']) expect(option(label).getAttribute('aria-pressed')).toBe('true')
  act(() => option('Dumbbell').click())
  act(() => option('Cable').click())
  save()
  const state = useStore.getState().S
  expect(state.equipProfiles.find(p => p.id === 'legacy')).toMatchObject({ name: 'Old gym', accV: ACC_V })
  expect(state.equipProfiles.find(p => p.id === 'legacy').equipment).toEqual(['roller', 'bench', 'adjustable bench', 'pull-up bar', 'massage ball', 'cable'])
  expect(state.equipProfiles.find(p => p.id === 'other').equipment).toEqual(['kettlebell'])
  expect(state.activeEquipId).toBe('other')
})
