# VOYAGE — сайт туристического агентства (прототип)

Сайт сделан как полёт над реальными местами. Скролл управляет дрон-съёмкой, между локациями идут кинематографичные WebGL-переходы, а к объектам в кадре привязаны метки и 3D-карточки с информацией и турами.

## Маршрут

1. **Над облаками.** Большой заголовок, скролл запускает полёт, камера ныряет сквозь облака.
2. **Мальдивы.** Облёт острова, катер по лагуне, виллы над водой. Карточки: «О направлении», «Впечатления», «Пакеты».
3. **Переход «вода».** Камера уходит вниз в лагуну и «выныривает» из песчаной бури.
4. **Египет.** Подлёт к пирамидам Гизы, метки на пирамидах, карточки.
5. **Переход «песок → снег».** Песчаная буря превращается в метель.
6. **Альпы.** Маттерхорн, карточки.
7. **Финал.** Сквозь облака к закату, затем форма заявки.

## Запуск

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # статическая сборка в dist/
```

## Как устроено

| Что | Где |
| --- | --- |
| Тексты, цены, пакеты, контакты | `src/data.js` |
| Порядок сцен, длина в скролле, когда показывать карточки и метки, точки остановки камеры | `src/timeline.js` |
| Пошаговая навигация: колесо, свайп, стрелки → плавный перелёт к следующей точке | `src/navigator.js` |
| Кадры видео: WebP 1280×720, склеены в один файл на клип | `public/packs/<клип>.bin` + индекс `src/packs.json` |
| Потоковая загрузка кадров с кешем вокруг текущего кадра | `src/frames.js` |
| WebGL-шейдер: смешивание кадров и переходы | `src/stage.js` |
| Метки и 3D-карточки, привязанные к объектам | `src/overlay.js` |
| Координаты объектов по кадрам (трекинг) | `src/tracks.json`, генерирует `tools/track.py` |
| Отправка заявок | `bindForm` в `src/ui.js` |

### Как заменить видео

1. Нарежьте ролик на кадры (папка `media/` в git не попадает):
   ```bash
   ffmpeg -i video.mp4 -vf "fps=<N/длительность>,scale=1280:-2" -c:v libwebp -quality 62 media/frames/<имя>/%03d.webp
   ```
2. Склейте кадры: `python3 tools/pack_frames.py media/frames`.
3. Укажите число кадров в `CLIPS` (`src/timeline.js`).
4. Задайте объекты для меток в `ANCHORS` (`tools/track.py`): кадр и координаты в пикселях 1280×720. Затем запустите:
   ```bash
   pip install opencv-python-headless numpy
   python3 tools/track.py
   ```

## Деплой

При каждом пуше в рабочую ветку GitHub Actions (`.github/workflows/deploy.yml`) собирает сайт и публикует его на GitHub Pages: https://djeda1.github.io/travel/

## Источники видео

Все ролики с [Pexels](https://www.pexels.com/license/), бесплатная лицензия с разрешением коммерческого использования.

| Сцена | Ролик |
| --- | --- |
| Облака | [3129752](https://www.pexels.com/video/video-footage-of-flying-above-and-over-the-clouds-3129752/) |
| Мальдивы, остров | [8356897](https://www.pexels.com/video/aerial-footage-of-a-beautiful-resort-in-an-island-8356897/) |
| Мальдивы, лагуна | [4010941](https://www.pexels.com/video/maldives-free-download-drone-video-beach-island-4010941/) |
| Гиза | [10717893](https://www.pexels.com/video/aerial-view-on-pyramids-in-cairo-10717893/) |
| Маттерхорн | [7397652](https://www.pexels.com/video/drone-footage-of-snow-capped-mountains-7397652/) |
| Закат | [8861334](https://www.pexels.com/video/aerial-footage-of-the-mountain-top-above-the-clouds-8861334/) |
