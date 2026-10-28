// Загрузка последовательностей кадров.
// Сжатые файлы держим в памяти целиком (≈ 40 МБ на весь сайт), а декодированные ImageBitmap —
// только вокруг текущей позиции, чтобы не съесть видеопамять.

const BASE = `${import.meta.env.BASE_URL}frames`;
const KEEP = 18; // сколько декодированных кадров держать по обе стороны от текущего

class Clip {
  constructor(name, count) {
    this.name = name;
    this.count = count;
    this.blobs = new Array(count);
    this.bitmaps = new Map();
    this.decoding = new Set();
    this.loaded = 0;
    this.started = false;
    this.focus = 0;
  }

  url(i) {
    return `${BASE}/${this.name}/${String(i + 1).padStart(3, '0')}.webp`;
  }

  // Прогрессивная загрузка: сначала каждый 8-й кадр, затем 4-й, 2-й и остальные,
  // чтобы скролл работал сразу, а плавность догружалась.
  load(concurrency = 6) {
    if (this.started) return this.ready;
    this.started = true;
    const order = [];
    const seen = new Set();
    for (const step of [8, 4, 2, 1]) {
      for (let i = 0; i < this.count; i += step) {
        if (!seen.has(i)) {
          seen.add(i);
          order.push(i);
        }
      }
    }
    if (!seen.has(this.count - 1)) order.push(this.count - 1);
    let cursor = 0;
    const worker = async () => {
      while (cursor < order.length) {
        const i = order[cursor++];
        try {
          const res = await fetch(this.url(i));
          this.blobs[i] = await res.blob();
          this.loaded++;
        } catch (err) {
          console.warn('Кадр не загрузился', this.url(i), err);
        }
      }
    };
    this.ready = Promise.all(Array.from({ length: concurrency }, worker));
    // Первый кадр нужен сразу.
    this.first = (async () => {
      while (!this.blobs[0]) await new Promise((r) => setTimeout(r, 30));
      await this.decode(0);
    })();
    return this.ready;
  }

  async decode(i) {
    if (this.bitmaps.has(i) || this.decoding.has(i) || !this.blobs[i]) return;
    this.decoding.add(i);
    try {
      const bmp = await createImageBitmap(this.blobs[i]);
      this.bitmaps.set(i, bmp);
    } finally {
      this.decoding.delete(i);
    }
  }

  // Готовит кадры вокруг позиции и освобождает далёкие.
  prepare(position) {
    this.focus = position;
    const c = Math.round(position);
    for (let d = 0; d <= KEEP; d++) {
      for (const i of [c + d, c - d]) if (i >= 0 && i < this.count) this.decode(i);
    }
    for (const [i, bmp] of this.bitmaps) {
      if (Math.abs(i - c) > KEEP + 6) {
        bmp.close();
        this.bitmaps.delete(i);
      }
    }
  }

  // Ближайший доступный декодированный кадр к индексу i.
  nearest(i) {
    i = Math.max(0, Math.min(this.count - 1, i));
    for (let d = 0; d < this.count; d++) {
      if (this.bitmaps.has(i - d)) return { index: i - d, bitmap: this.bitmaps.get(i - d) };
      if (this.bitmaps.has(i + d)) return { index: i + d, bitmap: this.bitmaps.get(i + d) };
    }
    return null;
  }

  release() {
    for (const bmp of this.bitmaps.values()) bmp.close();
    this.bitmaps.clear();
  }
}

export function createFrameStore(clips) {
  const store = Object.fromEntries(Object.entries(clips).map(([name, { frames }]) => [name, new Clip(name, frames)]));
  return {
    clips: store,
    get: (name) => store[name],
    // Возвращает пару соседних кадров и долю смешивания для дробной позиции.
    sample(name, position) {
      const clip = store[name];
      clip.prepare(position);
      const i0 = Math.floor(position);
      const a = clip.nearest(i0);
      const b = clip.nearest(Math.min(clip.count - 1, i0 + 1));
      if (!a) return null;
      const exact = a.index === i0 && b && b.index === i0 + 1;
      return { a: a.bitmap, b: (b || a).bitmap, mix: exact ? position - i0 : 0 };
    },
    // Освобождает декодированные кадры клипов, которые сейчас не нужны.
    keepOnly(names) {
      for (const [name, clip] of Object.entries(store)) if (!names.includes(name)) clip.release();
    },
  };
}
