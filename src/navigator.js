import { CHECKPOINTS } from './timeline.js';

// Пошаговая навигация по маршруту.
// Одно движение колеса, свайп или стрелка — камера плавно летит к следующей точке остановки
// и сама там замирает. Ниже финала начинается обычная страница с формой заявки.

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Длительность перелёта растёт с расстоянием: короткий шаг ~1.6 с, перелёт между странами до 4 с.
const durationFor = (dy) => Math.min(4000, Math.max(1600, 1000 + (Math.abs(dy) / window.innerHeight) * 900));

export function createNavigator(track) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const yOf = (vh) => (vh / 100) * window.innerHeight;
  let trackEnd = 0;
  const measure = () => {
    trackEnd = track.offsetHeight - window.innerHeight;
  };
  measure();
  window.addEventListener('resize', measure);
  const contactTop = () => trackEnd + window.innerHeight;
  const inPage = () => window.scrollY > trackEnd + 4; // зона обычной страницы (форма заявки)

  let anim = null;
  let target = 0; // индекс точки, к которой летим или на которой стоим
  let pending = 0; // шаг, запрошенный во время полёта
  let lastWheel = 0;
  let lastDelta = 0;

  const nearest = () => {
    const vh = (window.scrollY / window.innerHeight) * 100;
    let best = 0;
    CHECKPOINTS.forEach((c, i) => {
      if (Math.abs(c.vh - vh) < Math.abs(CHECKPOINTS[best].vh - vh)) best = i;
    });
    return best;
  };

  function flyToY(y) {
    const from = window.scrollY;
    if (reduceMotion || Math.abs(y - from) < 1) {
      window.scrollTo(0, y);
      anim = null;
      return;
    }
    anim = { from, to: y, start: performance.now(), duration: durationFor(y - from) };
  }

  function goTo(index) {
    target = Math.max(0, Math.min(CHECKPOINTS.length - 1, index));
    flyToY(yOf(CHECKPOINTS[target].vh));
  }

  function step(dir) {
    if (inPage()) {
      // Из формы заявки вверх — обратно к финальному кадру.
      if (dir < 0 && window.scrollY <= contactTop() + 4) goTo(CHECKPOINTS.length - 1);
      return;
    }
    const from = anim ? target : nearest();
    if (dir > 0 && from === CHECKPOINTS.length - 1) {
      flyToY(contactTop());
      return;
    }
    goTo(from + dir);
  }

  // Колесо и тачпад: инерцию тачпада отсекаем — новый шаг только на новый жест
  // (после паузы или при резком усилении прокрутки).
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey || document.querySelector('dialog[open]')) return;
    const dir = Math.sign(e.deltaY);
    const pageNative = inPage() && !(dir < 0 && window.scrollY <= contactTop() + 4);
    if (pageNative || !dir) return;
    e.preventDefault();
    const now = performance.now();
    const size = Math.abs(e.deltaY);
    const fresh = now - lastWheel > 220 || size > lastDelta * 1.8 + 8;
    lastWheel = now;
    lastDelta = size;
    if (!fresh) return;
    if (anim) pending = dir;
    else step(dir);
  }, { passive: false });

  // Свайпы на телефоне.
  let touchY = null;
  // Карточка с длинным содержимым прокручивается пальцем сама, без перелёта камеры.
  const scrollable = (node) => {
    const card = node.closest('.card');
    return card && card.scrollHeight > card.clientHeight + 2;
  };
  window.addEventListener('touchstart', (e) => {
    touchY = e.target.closest('dialog') || scrollable(e.target) ? null : e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!inPage() && !e.target.closest('dialog') && !scrollable(e.target)) e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', (e) => {
    if (touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(dy) < 40) return;
    const dir = Math.sign(dy);
    if (inPage() && !(dir < 0 && window.scrollY <= contactTop() + 4)) return;
    if (anim) pending = dir;
    else step(dir);
  });

  // Клавиатура.
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea, dialog')) return;
    const keys = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 };
    const dir = keys[e.key];
    if (!dir || (inPage() && !(dir < 0 && window.scrollY <= contactTop() + 4))) return;
    e.preventDefault();
    if (anim) pending = dir;
    else step(dir);
  });

  // Если страницу прокрутили иначе (полоса прокрутки, поиск по странице) — доводим до ближайшей точки.
  let idle = null;
  window.addEventListener('scroll', () => {
    if (anim) return;
    clearTimeout(idle);
    idle = setTimeout(() => {
      if (!anim && !inPage()) goTo(nearest());
    }, 200);
  }, { passive: true });

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  return {
    goTo,
    toContact: () => flyToY(contactTop()),
    goToVh(vh) {
      goTo(CHECKPOINTS.findIndex((c) => c.vh === vh));
    },
    // Вызывается из главного цикла анимации.
    tick(now) {
      if (!anim) return;
      const p = Math.min(1, (now - anim.start) / anim.duration);
      window.scrollTo(0, anim.from + (anim.to - anim.from) * easeInOut(p));
      if (p >= 1) {
        anim = null;
        if (pending) {
          const dir = pending;
          pending = 0;
          step(dir);
        }
      }
    },
  };
}
