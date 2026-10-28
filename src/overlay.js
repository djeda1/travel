import { LOCATIONS } from './data.js';
import { PINS } from './timeline.js';
import tracks from './tracks.json';

const price = (n) => `$${n.toLocaleString('ru-RU')}`;

const RENDER = {
  about: (loc) => `
    <p class="card__eyebrow">${loc.index} · О направлении</p>
    <h3 class="card__title">${loc.name}</h3>
    <p class="card__text">${loc.about}</p>
    <dl class="facts">${loc.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`,
  highlights: (loc) => `
    <p class="card__eyebrow">${loc.index} · Что посмотреть</p>
    <h3 class="card__title">Впечатления</h3>
    <ol class="highlights">${loc.highlights.map(([t, d], i) =>
      `<li><span>${String(i + 1).padStart(2, '0')}</span><div><b>${t}</b><small>${d}</small></div></li>`).join('')}</ol>`,
  packages: (loc) => `
    <p class="card__eyebrow">${loc.index} · Туры</p>
    <h3 class="card__title">Пакеты</h3>
    <div class="packages">${loc.packages.map((p) => `
      <button class="package${p.featured ? ' package--featured' : ''}" data-book="${loc.id}" data-package="${p.name}">
        <span class="package__head"><b>${p.name}</b><em>${p.nights} ночей</em></span>
        <span class="package__features">${p.features.join(' · ')}</span>
        <span class="package__price">от ${price(p.price)}<small> / чел.</small></span>
      </button>`).join('')}</div>
    <p class="card__note">Перелёт и страховка включены</p>`,
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Плавное появление/исчезновение внутри окна [from, to].
const windowAlpha = (t, from, to, fade = 0.05) =>
  clamp(Math.min((t - from) / fade, (to - t) / fade), 0, 1);

export function createOverlay(root, stage) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('leaders');
  root.appendChild(svg);

  const pins = {};
  for (const [id, label] of Object.entries(PINS)) {
    const el = document.createElement('div');
    el.className = 'pin';
    el.innerHTML = `<i></i><span>${label}</span>`;
    root.appendChild(el);
    pins[id] = { el, x: 0, y: 0, vx: 0, shown: 0 };
  }

  const cards = {};
  LOCATIONS.forEach((loc, li) => {
    for (const kind of Object.keys(RENDER)) {
      const el = document.createElement('article');
      el.className = `card card--${kind}`;
      el.innerHTML = RENDER[kind](loc);
      root.appendChild(el);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      svg.appendChild(line);
      cards[`${li}:${kind}`] = { el, line, tilt: 0 };
    }
  });

  return {
    // shot — текущий шот таймлайна (или null во время перехода), t — его прогресс.
    update(shot, t, framePos, mouse, zoom, dt) {
      const W = window.innerWidth, H = window.innerHeight;
      const mobile = W < 720;
      const clipTracks = shot ? tracks[shot.shot] || {} : {};
      const frame = Math.round(framePos);

      // Метки на объектах.
      const activePins = new Map((shot?.pins || []).map(([id, from, to]) => [id, windowAlpha(t, from, to)]));
      for (const [id, pin] of Object.entries(pins)) {
        const p = clipTracks[id]?.[frame];
        const a = p ? activePins.get(id) || 0 : 0;
        pin.shown = a;
        if (a > 0) {
          const s = stage.project(p[0], p[1], mouse, zoom);
          pin.vx = dt > 0 ? (s.x - pin.x) / dt : 0;
          pin.x = s.x;
          pin.y = s.y;
          // Подпись переносится влево от точки, если не помещается справа.
          const width = pin.el.offsetWidth;
          const flip = s.x + width + 16 > W;
          pin.el.classList.toggle('pin--flip', flip);
          pin.el.style.transform = `translate3d(${flip ? s.x - width : s.x}px, ${s.y}px, 0)`;
        }
        pin.el.style.opacity = a.toFixed(3);
      }

      // Панели: летят из глубины, висят рядом с объектом и поворачиваются вместе с камерой.
      const activeCards = new Map((shot?.cards || []).map(([kind, anchor, from, to]) =>
        [`${shot.location}:${kind}`, { anchor, a: windowAlpha(t, from, to, 0.06) }]));
      for (const [key, card] of Object.entries(cards)) {
        const info = activeCards.get(key);
        const pin = info && pins[info.anchor];
        const a = info && pin.shown > 0 ? info.a : 0;
        card.el.style.opacity = a.toFixed(3);
        card.el.style.pointerEvents = a > 0.8 ? 'auto' : 'none';
        card.el.style.visibility = a > 0.001 ? 'visible' : 'hidden';
        card.line.style.opacity = (a * 0.9).toFixed(3);
        if (a <= 0.001) continue;

        const cw = card.el.offsetWidth, ch = card.el.offsetHeight;
        let left, top, side;
        if (mobile) {
          left = (W - cw) / 2;
          top = H - ch - 20;
          side = 0;
        } else {
          side = pin.x < W * 0.55 ? 1 : -1;
          left = side > 0 ? pin.x + 90 : pin.x - 90 - cw;
          left = clamp(left, 24, W - cw - 80);
          top = clamp(pin.y - ch * 0.45, 96, H - ch - 32);
        }
        card.tilt += (clamp(-pin.vx * 0.012, -10, 10) - card.tilt) * Math.min(1, dt * 4);
        const enter = 1 - a;
        card.el.style.transform =
          `translate3d(${left}px, ${top}px, 0) perspective(1400px) ` +
          `rotateY(${(-side * 9 + card.tilt).toFixed(2)}deg) rotateX(${(enter * 14).toFixed(2)}deg) ` +
          `translateZ(${(-enter * 260).toFixed(1)}px)`;

        const ex = mobile ? W / 2 : side > 0 ? left : left + cw;
        const ey = mobile ? top : top + Math.min(ch * 0.45, 120);
        card.line.setAttribute('x1', pin.x);
        card.line.setAttribute('y1', pin.y);
        card.line.setAttribute('x2', ex);
        card.line.setAttribute('y2', ey);
      }
    },
  };
}
