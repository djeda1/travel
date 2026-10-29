import * as THREE from 'three';
import './style.css';
import { CLIPS, LAYOUT, TOTAL_VH, stateAt } from './timeline.js';
import { createFrameStore } from './frames.js';
import { createStage, MODES } from './stage.js';
import { createOverlay } from './overlay.js';
import { initUI } from './ui.js';
import { createNavigator } from './navigator.js';

const track = document.getElementById('track');
track.style.height = `calc(${TOTAL_VH}vh + 100vh)`;

const stage = createStage(document.getElementById('stage'));
const frames = createFrameStore(CLIPS);
const overlay = createOverlay(document.getElementById('overlay'), stage);
const nav = createNavigator(track);
const ui = initUI(nav);
window.scrollTo(0, 0);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

// Кадры грузим по порядку маршрута; текущую локацию — вне очереди.
const order = LAYOUT.filter((e) => e.shot).map((e) => e.shot);
(async () => {
  for (const name of order) await frames.get(name).load();
})();

const mouse = new THREE.Vector2();
const mouseGoal = new THREE.Vector2();
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') mouseGoal.set(e.clientX / window.innerWidth - 0.5, 0.5 - e.clientY / window.innerHeight);
});

// Высоту трека кешируем: чтение offsetHeight на каждом кадре заставляет браузер пересчитывать раскладку.
let trackEnd = 0;
const measure = () => {
  trackEnd = track.offsetHeight - window.innerHeight;
};
measure();
window.addEventListener('resize', measure);

const scrollVh = () => (window.scrollY / window.innerHeight) * 100;
let vh = scrollVh();
let last = performance.now();

const framePos = (entry, t) => t * (CLIPS[entry.shot].frames - 1);

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const time = now / 1000;

  // Навигатор плавно ведёт скролл к точке остановки, а камера ещё мягко его догоняет.
  nav.tick(now);
  const goal = Math.min(scrollVh(), TOTAL_VH - 0.01);
  vh += (goal - vh) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 7));
  if (Math.abs(goal - vh) < 0.01) vh = goal;
  if (!reduceMotion) mouse.lerp(mouseGoal, 1 - Math.exp(-dt * 2.5));
  const zoom = 1.05 + (reduceMotion ? 0 : Math.sin(time * 0.25) * 0.008);

  const state = stateAt(vh);
  let render;
  let shot = null, shotT = 0, pos = 0;
  if (state.kind === 'shot') {
    shot = state.entry;
    shotT = state.t;
    pos = framePos(shot, shotT);
    frames.get(shot.shot).load();
    render = { a: frames.sample(shot.shot, pos), mode: MODES.none };
    frames.keepOnly([shot.shot]);
  } else {
    const { from, to, type, t } = state;
    frames.get(from.shot).load();
    frames.get(to.shot).load();
    render = {
      a: frames.sample(from.shot, CLIPS[from.shot].frames - 1),
      b: frames.sample(to.shot, 0),
      mode: MODES[type],
      t,
    };
    frames.keepOnly([from.shot, to.shot]);
  }
  stage.render({ ...render, time, mouse, zoom });
  overlay.update(shot, shotT, pos, mouse, zoom, dt);

  // Интерфейс: активный пункт, заголовки, герой и финал.
  const current = shot || (state.t > 0.5 ? state.to : state.from);
  let active = current.location !== undefined ? current.location + 1 : current.finale ? 4 : 0;
  if (window.scrollY > trackEnd + window.innerHeight * 0.4) active = 4;
  // Насколько (в долях экрана) блок заявки уже въехал снизу.
  const contactIn = Math.max(0, window.scrollY - trackEnd) / window.innerHeight;
  let title = { index: -1, opacity: 0 };
  if (shot?.title) {
    const [a, b] = shot.title;
    title = { index: shot.location, opacity: Math.min(smooth(a, a + 0.06, shotT), 1 - smooth(b - 0.08, b, shotT)) };
  }
  ui.update({
    active,
    title,
    heroOpacity: shot?.hero ? 1 - smooth(0.02, 0.2, shotT) : 0,
    finaleOpacity: shot?.finale ? smooth(0.3, 0.6, shotT) * (1 - smooth(0, 0.35, contactIn)) : 0,
    progress: Math.min(1, goal / TOTAL_VH),
  });

  requestAnimationFrame(frame);
}

// Ждём первый клип (небо над облаками), затем убираем экран загрузки.
const first = frames.get(order[0]);
const bar = document.getElementById('loaderBar');
const tick = setInterval(() => {
  bar.style.transform = `scaleX(${first.loaded / first.count})`;
}, 100);
first.load().then(async () => {
  await first.first;
  clearInterval(tick);
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
    document.getElementById('loader').classList.add('is-hidden');
  });
});
