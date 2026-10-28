import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { terrain, flatMaterial, scatter, rng, smoothstep } from './utils.js';
import { pineGeometry, chaletGeometry } from './props.js';

const noise = new ImprovedNoise();
const LAKE = { x: 10, z: 10, r: 75 };

function ridged(x, z) {
  let sum = 0, amp = 1, freq = 0.0032, norm = 0;
  for (let i = 0; i < 5; i++) {
    const n = 1 - Math.abs(noise.noise(x * freq, i * 7.3, z * freq));
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return sum / norm;
}

function mountainHeight(x, z) {
  const d = Math.hypot(x, z);
  const valley = smoothstep(110, 520, d);
  let h = 6 + ridged(x, z) * 330 * valley + noise.noise(x * 0.03, 9, z * 0.03) * 3;
  // Отдельная «главная» вершина за озером — узнаваемый силуэт.
  const pd = Math.hypot(x + 60, z + 520);
  h += 260 * Math.exp(-(pd * pd) / (2 * 150 * 150));
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  h -= 10 * (1 - smoothstep(LAKE.r * 0.6, LAKE.r * 1.15, ld));
  return h;
}

export function buildAlps(center) {
  const group = new THREE.Group();
  const random = rng(42);

  const grass = new THREE.Color('#5f9a45');
  const grassHigh = new THREE.Color('#7b8f4e');
  const rock = new THREE.Color('#6d6a6a');
  const snow = new THREE.Color('#f4f8ff');
  group.add(terrain({
    size: 3000,
    segments: 210,
    center,
    height: (x, z) => mountainHeight(x - center.x, z - center.z),
    color: (col, y, ny, x, z) => {
      const n = noise.noise(x * 0.01, 4.2, z * 0.01) * 40;
      if (y + n > 150 && ny > 0.45) col.copy(snow);
      else if (ny < 0.72 || y > 120) col.lerpColors(rock, snow, smoothstep(140, 260, y + n) * 0.5);
      else col.lerpColors(grass, grassHigh, smoothstep(10, 110, y));
      if (y < 0) col.set('#3e7c5c');
    },
  }));

  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(LAKE.r * 1.05, 24),
    new THREE.MeshStandardMaterial({ color: '#5aa7c4', roughness: 0.35, metalness: 0.1, flatShading: true }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(center.x + LAKE.x, 1.2, center.z + LAKE.z);
  group.add(lake);

  // Хвойный лес на склонах.
  const pines = [], snowy = [];
  for (let i = 0; i < 4000 && pines.length + snowy.length < 650; i++) {
    const x = (random() - 0.5) * 1100;
    const z = (random() - 0.5) * 1100;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r * 1.25) continue;
    const y = mountainHeight(x, z);
    const slope = Math.abs(mountainHeight(x + 4, z) - y) + Math.abs(mountainHeight(x, z + 4) - y);
    if (y < 3 || y > 135 || slope > 7) continue;
    const t = { x: x + center.x, y: y - 0.5, z: z + center.z, rotY: random() * 6.28, scale: 0.8 + random() * 0.8 };
    (y > 85 ? snowy : pines).push(t);
  }
  group.add(scatter(pineGeometry(false), flatMaterial(), pines));
  group.add(scatter(pineGeometry(true), flatMaterial(), snowy));

  // Деревня из шале у озера.
  const chalets = [];
  for (const [x, z, r] of [[-95, 40, 0.3], [-85, 75, 0.9], [-60, 105, 1.5], [95, -45, -0.4], [110, -10, 2], [70, 100, 1.1], [-40, -80, 0.2]]) {
    chalets.push({ x: center.x + x, y: mountainHeight(x, z) - 0.5, z: center.z + z, rotY: r, scale: 1.2 });
  }
  group.add(scatter(chaletGeometry(), flatMaterial(), chalets));

  return { group, update() {} };
}
