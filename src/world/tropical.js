import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { terrain, flatMaterial, scatter, rng, smoothstep } from './utils.js';
import { palmGeometry, bungalowGeometry, pierGeometry, sailboatGeometry } from './props.js';

const noise = new ImprovedNoise();

// Главный остров и два маленьких островка вокруг лагуны.
const ISLANDS = [
  { x: 0, z: 0, r: 85, h: 7 },
  { x: 270, z: -150, r: 38, h: 4 },
  { x: -230, z: 170, r: 28, h: 3.5 },
  { x: -120, z: -260, r: 18, h: 2.5 },
];

export function islandHeight(x, z) {
  let h = -9;
  for (const is of ISLANDS) {
    const warp = noise.noise(x * 0.02, 3.1, z * 0.02) * 22;
    const d = Math.hypot(x - is.x, z - is.z) + warp;
    const bump = is.h * (1 - smoothstep(is.r * 0.25, is.r, d)) - 3 * smoothstep(is.r, is.r * 2.4, d);
    h = Math.max(h, bump);
  }
  return h + noise.noise(x * 0.08, 0.5, z * 0.08) * 0.6;
}

function makeWater(center, time) {
  const geo = new THREE.PlaneGeometry(3200, 3200, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const deep = new THREE.Color('#0b4f8a');
  const mid = new THREE.Color('#1497b8');
  const shallow = new THREE.Color('#5fe0d6');
  const foam = new THREE.Color('#e9fbf7');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = islandHeight(pos.getX(i) + center.x, pos.getZ(i) + center.z);
    if (h > -0.6) c.copy(foam);
    else if (h > -3.2) c.lerpColors(mid, shallow, smoothstep(-3.2, -1, h));
    else c.lerpColors(deep, mid, smoothstep(-9, -3.2, h));
    c.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = flatMaterial({ roughness: 0.25, metalness: 0.05 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 wp = modelMatrix * vec4(transformed, 1.0);
      transformed.y += sin(wp.x * 0.06 + uTime * 1.1) * 0.55
                     + cos(wp.z * 0.08 + uTime * 0.8) * 0.45
                     + sin((wp.x + wp.z) * 0.13 + uTime * 1.6) * 0.22;`,
    );
  };
  const water = new THREE.Mesh(geo, mat);
  water.position.set(center.x, 0, center.z);
  return water;
}

export function buildTropical(center) {
  const group = new THREE.Group();
  const time = { value: 0 };
  const random = rng(7);

  group.add(makeWater(center, time));
  group.add(terrain({
    size: 800,
    segments: 120,
    center,
    height: (x, z) => islandHeight(x - center.x, z - center.z),
    color: (col, y) => {
      if (y > 3.2) col.set('#4f9a4a');
      else if (y > 2.2) col.lerpColors(new THREE.Color('#f2e3bd'), new THREE.Color('#6fae55'), (y - 2.2));
      else col.set(y > -0.5 ? '#f6e9c8' : '#e3d3a8');
    },
  }));

  // Пальмы на островах.
  const palms = [];
  while (palms.length < 70) {
    const is = ISLANDS[palms.length < 45 ? 0 : 1 + Math.floor(random() * 3)];
    const a = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * is.r * 0.8;
    const x = is.x + Math.cos(a) * r;
    const z = is.z + Math.sin(a) * r;
    const y = islandHeight(x, z);
    if (y < 0.8) continue;
    palms.push({ x: x + center.x, y: y - 0.3, z: z + center.z, rotY: random() * 6.28, tilt: (random() - 0.5) * 0.25, scale: 0.8 + random() * 0.5 });
  }
  group.add(scatter(palmGeometry(), flatMaterial(), palms));

  // Пирс с виллами над водой.
  const pierStart = new THREE.Vector3(62, 0, 18);
  const pier = new THREE.Mesh(pierGeometry(150), flatMaterial());
  pier.position.copy(pierStart).add(center);
  pier.rotation.y = -0.35;
  group.add(pier);
  const dir = new THREE.Vector3(Math.cos(0.35), 0, Math.sin(0.35));
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const villas = [];
  for (let i = 0; i < 6; i++) {
    for (const s of [-1, 1]) {
      const p = pierStart.clone().addScaledVector(dir, 30 + i * 21).addScaledVector(side, s * 10).add(center);
      villas.push({ x: p.x, y: -0.2, z: p.z, rotY: -0.35 + (s > 0 ? Math.PI / 2 : -Math.PI / 2) });
    }
  }
  group.add(scatter(bungalowGeometry(), flatMaterial(), villas));

  // Парусники покачиваются на волнах.
  const boatGeo = sailboatGeometry();
  const boatMat = flatMaterial({ side: THREE.DoubleSide });
  const boats = [[-140, 60, 0.4], [150, -170, 2.2], [-60, 220, -1]].map(([x, z, r]) => {
    const b = new THREE.Mesh(boatGeo, boatMat);
    b.position.set(center.x + x, 0, center.z + z);
    b.rotation.y = r;
    b.scale.setScalar(1.3);
    group.add(b);
    return b;
  });

  return {
    group,
    update(t) {
      time.value = t;
      boats.forEach((b, i) => {
        b.position.y = Math.sin(t * 1.3 + i) * 0.4;
        b.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.06;
      });
    },
  };
}
