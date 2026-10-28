"""Склеивает кадры каждого клипа в один файл public/packs/<клип>.bin.

Кадры записываются в прогрессивном порядке (каждый 8-й, затем 4-й, 2-й, остальные), поэтому
при потоковой загрузке сайт сначала получает «грубую» версию полёта, а плавность догружается.
Индекс (номер кадра, смещение, длина) пишется в src/packs.json.

Запуск: python3 tools/pack_frames.py <папка с подпапками кадров>
Каждая подпапка — клип, внутри файлы 001.webp, 002.webp, ...
"""
import json, os, sys

ROOT = os.path.join(os.path.dirname(__file__), '..')


def progressive(count):
    order, seen = [], set()
    for step in (8, 4, 2, 1):
        for i in range(0, count, step):
            if i not in seen:
                seen.add(i)
                order.append(i)
    return order


def main(src):
    out_dir = os.path.join(ROOT, 'public', 'packs')
    os.makedirs(out_dir, exist_ok=True)
    index = {}
    for clip in sorted(os.listdir(src)):
        files = sorted(f for f in os.listdir(os.path.join(src, clip)) if f.endswith('.webp'))
        if not files:
            continue
        entries, offset = [], 0
        with open(os.path.join(out_dir, f'{clip}.bin'), 'wb') as fh:
            for i in progressive(len(files)):
                data = open(os.path.join(src, clip, files[i]), 'rb').read()
                fh.write(data)
                entries.append([i, offset, len(data)])
                offset += len(data)
        index[clip] = entries
        print(f'{clip}: {len(files)} кадров, {offset / 1e6:.1f} МБ')
    with open(os.path.join(ROOT, 'src', 'packs.json'), 'w') as fh:
        json.dump(index, fh, separators=(',', ':'))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'media', 'frames'))
