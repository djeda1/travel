import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { terrain, flatMaterial, scatter, rng, smoothstep } from './utils.js';
import { pyramidGeometry, sphinxGeometry, obeliskGeometry, palmGeometry, camelGeometry } from './props.js';

const noise = new ImprovedNoise();
const OASIS = { x: -190, z: 150, r: 45 };

function duneHeight(x, z) {
  const d = Math.hypot(x, z);
  const warp = noise.noise(x * 0.004, 1.7, z * 0.004) * 3;
  const ridges = Math.pow(Math.abs(Math.sin(x * 0.009 + z * 0.004 + warp)), 1.6) * 34
    + Math.pow(Math.abs(Math.sin(z * 0.013 - x * 0.003 + warp * 0.6)), 2) * 16;
  const plateau = smoothstep(170, 420, d);
  const ripples = noise.noise(x * 0.05, 0.2, z * 0.05) * 1.2;
  let h = ridges * plateau + ripples + 1;
  const od = Math.hypot(x - OASIS.x, z - OASIS.z);
  h -= 6 * (1 - smoothstep(OASIS.r * 0.4, OASIS.r * 1.3, od));
  return h;
}

export function buildDesert(center) {
  const group = new THREE.Group();
  const random = rng(21);
  const at = (x, z) => new THREE.Vector3(center.x + x, duneHeight(x, z), center.z + z);

  const light = new THREE.Color('#f3cf92');
  const dark = new THREE.Color('#c98e52');
  group.add(terrain({
    size: 2600,
    segments: 170,
    center,
    height: (x, z) => duneHeight(x - center.x, z - center.z),
    color: (col, y, ny) => {
      if (y < -1.5) col.set('#8fbf6a');
      else col.lerpColors(dark, light, smoothstep(0.75, 1, ny) * 0.7 + smoothstep(0, 40, y) * 0.3);
    },
  }));

  // Плато Гиза: три пирамиды, пирамиды цариц и Сфинкс.
  const pyramids = [
    [-40, -70, 62, 80, true],
    [65, -10, 55, 72, false],
    [140, 60, 30, 38, false],
    [180, 40, 10, 13, false],
    [182, 78, 10, 13, false],
    [-112, -20, 12, 15, false],
  ];
  for (const [x, z, r, h, cap] of pyramids) {
    const m = new THREE.Mesh(pyramidGeometry(r, h, cap), flatMaterial());
    m.position.copy(at(x, z)).y -= 1.2;
    group.add(m);
  }
  const sphinx = new THREE.Mesh(sphinxGeometry(), flatMaterial());
  sphinx.position.copy(at(-20, 70)).y -= 0.5;
  sphinx.rotation.y = 0.5;
  group.add(sphinx);
  for (const [x, z] of [[30, 110], [44, 102]]) {
    const o = new THREE.Mesh(obeliskGeometry(), flatMaterial());
    o.position.copy(at(x, z));
    group.add(o);
  }

  // Оазис с пальмами и водой.
  const pond = new THREE.Mesh(new THREE.CircleGeometry(OASIS.r * 0.85, 18), new THREE.MeshStandardMaterial({ color: '#2aa5b5', roughness: 0.2, flatShading: true }));
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(center.x + OASIS.x, -2.4, center.z + OASIS.z);
  group.add(pond);
  const palms = [];
  for (let i = 0; i < 26; i++) {
    const a = random() * Math.PI * 2;
    const r = OASIS.r * (0.95 + random() * 0.7);
    const p = at(OASIS.x + Math.cos(a) * r, OASIS.z + Math.sin(a) * r);
    palms.push({ x: p.x, y: p.y - 0.4, z: p.z, rotY: random() * 6.28, tilt: (random() - 0.5) * 0.2, scale: 0.9 + random() * 0.5 });
  }
  group.add(scatter(palmGeometry(), flatMaterial(), palms));

  // Караван верблюдов.
  const camels = [];
  for (let i = 0; i < 6; i++) {
    const p = at(-150 + i * 9, 230 - i * 6);
    camels.push({ x: p.x, y: p.y - 0.2, z: p.z, rotY: 2.1, scale: 1.4 });
  }
  const caravan = scatter(camelGeometry(), flatMaterial(), camels);
  group.add(caravan);

  return {
    group,
    update(t) {
      caravan.position.x = Math.sin(t * 0.05) * 6;
    },
  };
}
