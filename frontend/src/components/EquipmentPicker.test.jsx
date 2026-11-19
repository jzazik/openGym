// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ALL_EQUIPMENT } from '../lib/equipment.js'
import EquipmentPicker from './EquipmentPicker.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root
let host
afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
})

const options = ['body weight', 'dumbbell', 'cable', 'barbell', 'leverage machine', 'band', 'kettlebell', 'resistance band', 'weighted', 'suspension trainer', 'smith machine', 'stability ball', 'medicine ball', 'ez barbell']
const mount = element => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root.render(element))
}

it('gives all intake choices a Russian name, English subtitle and illustration', () => {
  mount(<EquipmentPicker options={options} value={['body weight', 'dumbbell']} onToggle={() => {}} />)
  const cards = [...host.querySelectorAll('button')]
  expect(cards).toHaveLength(14)
  expect(cards.filter(card => card.getAttribute('aria-pressed') === 'true')).toHaveLength(2)
  for (const card of cards) {
    expect(card.querySelector('[lang="ru"]').textContent).toMatch(/[А-Яа-яЁё]/)
    expect(card.querySelector('[lang="en"]').textContent).toMatch(/[A-Za-z]/)
    expect(card.querySelector('svg image').getAttribute('href')).toContain('equipment-guide-v1.png')
  }
  expect(cards[2].textContent).toContain('Блочный тренажёр')
  expect(cards[11].textContent).toContain('Фитбол')
})

it('toggles the original equipment identifiers without losing another selection', () => {
  const saved = vi.fn()
  function Profile() {
    const [value, setValue] = useState(['body weight', 'dumbbell'])
    return <EquipmentPicker options={options} value={value} onToggle={id => {
      const next = value.includes(id) ? value.filter(item => item !== id) : [...value, id]
      setValue(next)
      saved(next)
    }} />
  }
  mount(<Profile />)
  const cards = [...host.querySelectorAll('button')]
  act(() => cards[7].click())
  expect(saved).toHaveBeenLastCalledWith(['body weight', 'dumbbell', 'resistance band'])
  expect(cards[7].getAttribute('aria-pressed')).toBe('true')
  act(() => cards[1].click())
  expect(saved).toHaveBeenLastCalledWith(['body weight', 'resistance band'])
  expect(cards[1].getAttribute('aria-pressed')).toBe('false')
  expect(cards[0].getAttribute('aria-pressed')).toBe('true')
})

it('gives every equipment profile choice an image available in the offline shell', () => {
  const toggled = vi.fn()
  mount(<EquipmentPicker options={ALL_EQUIPMENT} value={['bench']} onToggle={toggled} />)
  const cards = [...host.querySelectorAll('button')]
  expect(cards).toHaveLength(ALL_EQUIPMENT.length)
  const plain = cards.filter(card => !card.querySelector('.equipment-option-image'))
  expect(plain.map(card => card.textContent)).toEqual(['adjustable bench'])
  const images = [...host.querySelectorAll('img')]
  expect(images).toHaveLength(23)
  expect(new Set(images.map(img => img.getAttribute('src'))).size).toBe(23)
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
  for (const img of images) {
    const src = img.getAttribute('src')
    expect(img.alt).toBe('')
    expect(html).toContain('href="' + src.replace(/^\//, '') + '"')
    const bytes = readFileSync(resolve(process.cwd(), 'public', src.replace(/^\//, '')))
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF')
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP')
  }
  const bench = cards.find(card => card.querySelector('[lang="en"]').textContent === 'Bench')
  expect(bench.getAttribute('aria-pressed')).toBe('true')
  act(() => bench.querySelector('img').click())
  expect(toggled).toHaveBeenCalledWith('bench')
})
