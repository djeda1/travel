import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { STATIONS, STOPS, dwell, orbitAngle, orbitPose } from './journey.js';
import { LOCATIONS } from './data.js';

const PANEL_W = 400;
const PANEL_H = 520;

const price = (n) => `$${n.toLocaleString('ru-RU')}`;

function aboutPanel(loc) {
  return `
    <p class="panel__eyebrow">${loc.index} · О направлении</p>
    <h3 class="panel__title">${loc.name}</h3>
    <p class="panel__text">${loc.about}</p>
    <dl class="facts">
      ${loc.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
    </dl>`;
}

function highlightsPanel(loc) {
  return `
    <p class="panel__eyebrow">${loc.index} · Что посмотреть</p>
    <h3 class="panel__title">Впечатления</h3>
    <ol class="highlights">
      ${loc.highlights.map(([t, d], i) => `<li><span>${String(i + 1).padStart(2, '0')}</span><div><b>${t}</b><small>${d}</small></div></li>`).join('')}
    </ol>`;
}

function packagesPanel(loc) {
  return `
    <p class="panel__eyebrow">${loc.index} · Туры</p>
    <h3 class="panel__title">Пакеты</h3>
    <div class="packages">
      ${loc.packages.map((p) => `
        <button class="package${p.featured ? ' package--featured' : ''}" data-book="${loc.id}" data-package="${p.name}">
          <span class="package__head"><b>${p.name}</b><em>${p.nights} ночей</em></span>
          <span class="package__features">${p.features.join(' · ')}</span>
          <span class="package__price">от ${price(p.price)}<small> / чел.</small></span>
        </button>`).join('')}
    </div>
    <p class="panel__note">Перелёт и страховка включены</p>`;
}

export function createPanels(scene) {
  const panels = [];
  const pose = new THREE.Vector3(), tmp = new THREE.Vector3();

  STATIONS.forEach((st, si) => {
    const loc = LOCATIONS[si];
    const dirSign = Math.sign(st.to - st.from);
    [aboutPanel, highlightsPanel, packagesPanel].forEach((render, pi) => {
      const el = document.createElement('article');
      el.className = `panel panel--${loc.id}`;
      el.style.width = `${PANEL_W}px`;
      el.style.height = `${PANEL_H}px`;
      el.innerHTML = render(loc);

      const obj = new CSS3DObject(el);
      obj.userData = { station: si, stop: dwell(STOPS[pi]), dirSign };
      obj.visible = false;
      scene.add(obj);
      panels.push(obj);
    });
  });

  return {
    panels,
    // Расставляет и масштабирует панели под соотношение сторон экрана.
    resize(camera) {
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const portrait = camera.aspect < 1;
      for (const p of panels) {
        const st = STATIONS[p.userData.station];
        // На широком экране панель стоит сбоку и чуть впереди по ходу камеры, локация видна рядом.
        // На узком — почти по центру, ближе к камере.
        const a = orbitAngle(st, p.userData.stop) + p.userData.dirSign * (portrait ? 0.04 : 0.24);
        const r = st.radius * (portrait ? 0.5 : 0.62);
        // По высоте — на линии взгляда камеры, чтобы панель оказалась по центру экрана.
        const y = st.height - (st.height - st.lookY) * (1 - r / st.radius);
        p.position.set(st.center.x + Math.cos(a) * r, y, st.center.z + Math.sin(a) * r);
        orbitPose(st, p.userData.stop, pose, tmp);
        p.lookAt(pose);
        p.userData.distance = pose.distanceTo(p.position);
        const visH = 2 * p.userData.distance * tan;
        const visW = visH * camera.aspect;
        p.scale.setScalar(Math.min((0.62 * visH) / PANEL_H, (0.86 * visW) / PANEL_W));
      }
    },
    // f — прогресс облёта текущей станции (или null, если камера в полёте).
    update(stationIndex, f) {
      for (const p of panels) {
        let o = 0;
        if (p.userData.station === stationIndex && f !== null) {
          const d = Math.abs(f - p.userData.stop);
          o = 1 - THREE.MathUtils.smoothstep(d, 0.1, 0.17);
        }
        p.visible = o > 0.01;
        p.element.style.opacity = o.toFixed(3);
        p.element.style.pointerEvents = o > 0.6 ? 'auto' : 'none';
      }
    },
  };
}
