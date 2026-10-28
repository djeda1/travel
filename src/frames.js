import PACKS from './packs.json';

// Загрузка последовательностей кадров.
// Кадры клипа склеены в один файл packs/<клип>.bin (см. tools/pack_frames.py) в прогрессивном
// порядке и читаются потоком: кадр доступен, как только докачались его байты.
// Сжатые кадры держим в памяти целиком (≈ 37 МБ на весь сайт), а декодированные ImageBitmap —
// только вокруг текущей позиции, чтобы не съесть видеопамять.

const BASE = `${import.meta.env.BASE_URL}packs`;
const KEEP = 12; // сколько декодированных кадров держать по обе стороны от текущего

class Clip {
  constructor(name, count) {
    this.name = name;
    this.count = count;
    this.index = PACKS[name];
    this.blobs = new Array(count);
    this.bitmaps = new Map();
    this.decoding = new Set();
    this.loaded = 0;
    this.started = false;
  }

  load() {
    if (this.started) return this.ready;
    this.started = true;
    this.ready = this.stream().catch((err) => console.warn('Клип не загрузился', this.name, err));
    // Первый кадр нужен сразу.
    this.first = (async () => {
      while (!this.blobs[0]) await new Promise((r) => setTimeout(r, 30));
      await this.decode(0);
    })();
    return this.ready;
  }

  async stream() {
    const res = await fetch(`${BASE}/${this.name}.bin`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const last = this.index[this.index.length - 1];
    const buffer = new Uint8Array(last[1] + last[2]);
    let received = 0;
    let next = 0; // следующий по порядку кадр в файле
    const publish = () => {
      while (next < this.index.length) {
        const [frame, offset, length] = this.index[next];
        if (offset + length > received) break;
        this.blobs[frame] = new Blob([buffer.subarray(offset, offset + length)], { type: 'image/webp' });
        this.loaded++;
        next++;
      }
    };
    if (!res.body) {
      buffer.set(new Uint8Array(await res.arrayBuffer()));
      received = buffer.length;
      return publish();
    }
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer.set(value, received);
      received += value.length;
      publish();
    }
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
      const B = b || a;
      return {
        a: a.bitmap, b: B.bitmap,
        keyA: `${name}:${a.index}`, keyB: `${name}:${B.index}`,
        mix: exact ? position - i0 : 0,
      };
    },
    // Освобождает декодированные кадры клипов, которые сейчас не нужны.
    keepOnly(names) {
      for (const [name, clip] of Object.entries(store)) if (!names.includes(name)) clip.release();
    },
  };
}
