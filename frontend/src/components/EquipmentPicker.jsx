import { t } from '../lib/i18n.js'
import './EquipmentPicker.css'

const EQUIPMENT = {
  'body weight': ['Собственный вес', 'Body Weight', 20, 87, 335, 207],
  dumbbell: ['Гантели', 'Dumbbell', 375, 87, 335, 207],
  cable: ['Блочный тренажёр', 'Cable', 730, 87, 335, 207],
  barbell: ['Штанга', 'Barbell', 20, 387, 335, 198],
  'leverage machine': ['Рычажный тренажёр', 'Leverage Machine', 375, 387, 335, 198],
  band: ['Резинки', 'Band', 730, 387, 335, 198],
  kettlebell: ['Гиря', 'Kettlebell', 20, 675, 335, 199],
  'resistance band': ['Эспандеры / резинки', 'Resistance Band', 375, 675, 335, 199],
  weighted: ['Дополнительный вес', 'Weighted', 730, 675, 335, 199],
  'suspension trainer': ['Подвесные петли', 'Suspension Trainer', 20, 958, 335, 218],
  'smith machine': ['Тренажёр Смита', 'Smith Machine', 375, 958, 335, 218],
  'stability ball': ['Фитбол', 'Stability Ball', 730, 958, 335, 218],
  'medicine ball': ['Медбол', 'Medicine Ball', 20, 1260, 335, 127],
  'ez barbell': ['EZ-гриф', 'Ez Barbell', 375, 1260, 335, 127],
  assisted: ['Поддержка / гравитрон', 'Assisted', 'assisted'],
  'bosu ball': ['Полусфера BOSU', 'Bosu Ball', 'bosu-ball'],
  'elliptical machine': ['Эллиптический тренажёр', 'Elliptical Machine', 'elliptical-machine'],
  hammer: ['Кувалда', 'Hammer', 'hammer'],
  landmine: ['Крепление для штанги (лэндмайн)', 'Landmine', 'landmine'],
  macebell: ['Булава', 'Macebell', 'macebell'],
  'massage ball': ['Массажный мяч', 'Massage Ball', 'massage-ball'],
  'olympic barbell': ['Олимпийская штанга', 'Olympic Barbell', 'olympic-barbell'],
  roller: ['Массажный ролик', 'Roller', 'roller'],
  rope: ['Канат', 'Rope', 'rope'],
  sandbag: ['Мешок с песком', 'Sandbag', 'sandbag'],
  'skierg machine': ['Лыжный тренажёр', 'SkiErg Machine', 'skierg-machine'],
  'sled machine': ['Сани / платформенный тренажёр', 'Sled Machine', 'sled-machine'],
  'stationary bike': ['Велотренажёр', 'Stationary Bike', 'stationary-bike'],
  'stepmill machine': ['Лестничный тренажёр', 'Stepmill Machine', 'stepmill-machine'],
  tire: ['Покрышка', 'Tire', 'tire'],
  'trap bar': ['Трэп-гриф', 'Trap Bar', 'trap-bar'],
  'upper body ergometer': ['Ручной велотренажёр', 'Upper Body Ergometer', 'upper-body-ergometer'],
  'weight plate': ['Диск для штанги', 'Weight Plate', 'weight-plate'],
  'wheel roller': ['Ролик для пресса', 'Wheel Roller', 'wheel-roller'],
  clubbell: ['Гимнастическая булава', 'Clubbell', 'clubbell'],
  bench: ['Скамья', 'Bench', 'bench'],
  'pull-up bar': ['Турник', 'Pull-up Bar', 'pull-up-bar']
}

export default function EquipmentPicker({ options, value, onToggle }) {
  const choice = id => {
    const item = EQUIPMENT[id]
    const hasImage = item?.length >= 3
    const selected = value.includes(id)
    return <button key={id} type="button" className={'equipment-option' + (hasImage ? '' : ' equipment-option-compact')} aria-pressed={selected} onClick={() => onToggle(id)}>
      {hasImage && <span className="equipment-option-image">
        {item.length === 6 ? <svg viewBox={'0 0 ' + item[4] + ' ' + item[5]} aria-hidden="true" focusable="false">
          <svg width={item[4]} height={item[5]} viewBox={item.slice(2).join(' ')} overflow="hidden">
            <image href={import.meta.env.BASE_URL + 'equipment-guide-v1.png'} width="1086" height="1448" />
          </svg>
        </svg> : <img src={import.meta.env.BASE_URL + 'equipment-v1/' + item[2] + '.webp'} alt="" width="512" height="512" loading="lazy" decoding="async" />}
      </span>}
      <span className="equipment-option-check" aria-hidden="true">{selected ? '✓' : ''}</span>
      <span className="equipment-option-label">
        <span lang={item ? 'ru' : undefined}>{item ? item[0] : t(id)}</span>
        {item && <small lang="en">{item[1]}</small>}
      </span>
    </button>
  }
  return <div className="equipment-picker">
    {options.map(choice)}
  </div>
}
