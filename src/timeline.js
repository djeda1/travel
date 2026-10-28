// Сценарий страницы: последовательность «кадров-полётов» (shots) и переходов между ними.
// Длина каждого участка задаётся в vh скролла.

export const CLIPS = {
  clouds: { frames: 60 },
  island: { frames: 40 },
  lagoon: { frames: 130 },
  giza: { frames: 140 },
  matterhorn: { frames: 120 },
  sunset: { frames: 60 },
};

// Метки на реальных объектах; координаты берутся из src/tracks.json (трекинг OpenCV).
export const PINS = {
  atoll: 'Атолл Баа',
  boat: 'Трансфер на катере',
  villa: 'Виллы над водой',
  khufu: 'Хефрен и Хеопс · 4 500 лет',
  menkaure: 'Пирамида Менкаура',
  peak: 'Маттерхорн · 4 478 м',
};

// cards: [panel, anchor, from, to] — панель локации, к какой метке она привязана и в каком
// интервале прогресса шота (0..1) показывается.
export const SEQUENCE = [
  { shot: 'clouds', length: 170, hero: true },
  { transition: 'clouds', length: 80 },
  { shot: 'island', length: 120, location: 0, title: [0.05, 0.85], pins: [['atoll', 0.15, 1]] },
  { transition: 'dive', length: 60 },
  {
    shot: 'lagoon', length: 360, location: 0,
    pins: [['boat', 0.04, 0.66], ['villa', 0.72, 1]],
    cards: [['about', 'boat', 0.06, 0.32], ['highlights', 'boat', 0.38, 0.64], ['packages', 'villa', 0.72, 1]],
  },
  { transition: 'water', length: 100 },
  {
    shot: 'giza', length: 420, location: 1, title: [0, 0.12],
    pins: [['khufu', 0.1, 1], ['menkaure', 0.36, 0.66]],
    cards: [['about', 'khufu', 0.14, 0.36], ['highlights', 'menkaure', 0.42, 0.64], ['packages', 'khufu', 0.72, 1]],
  },
  { transition: 'sand', length: 100 },
  {
    shot: 'matterhorn', length: 420, location: 2, title: [0, 0.12],
    pins: [['peak', 0.1, 1]],
    cards: [['about', 'peak', 0.14, 0.36], ['highlights', 'peak', 0.42, 0.64], ['packages', 'peak', 0.72, 1]],
  },
  { transition: 'clouds', length: 90 },
  { shot: 'sunset', length: 130, finale: true },
];

// Раскладка: абсолютные интервалы в vh для каждого элемента.
let acc = 0;
export const LAYOUT = SEQUENCE.map((item) => {
  const entry = { ...item, start: acc, end: acc + item.length };
  acc += item.length;
  return entry;
});
export const TOTAL_VH = acc;

// Возвращает состояние для позиции скролла (в vh).
export function stateAt(vh) {
  let idx = LAYOUT.findIndex((e) => vh < e.end);
  if (idx === -1) idx = LAYOUT.length - 1;
  const e = LAYOUT[idx];
  const t = Math.min(1, Math.max(0, (vh - e.start) / e.length));
  if (e.transition) {
    return { kind: 'transition', type: e.transition, t, from: LAYOUT[idx - 1], to: LAYOUT[idx + 1] };
  }
  return { kind: 'shot', t, entry: e };
}

// Позиция (vh), с которой начинается локация — для навигации.
export function locationStart(index) {
  const e = LAYOUT.find((x) => x.location === index);
  return e.start + 2;
}
