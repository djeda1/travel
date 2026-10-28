import * as THREE from 'three';
import { rng } from './utils.js';

// Небо — градиентная сфера с солнечным ореолом, которая всегда движется вместе с камерой.
export function createSky() {
  const uniforms = {
    top: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    bottom: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 0.2, -1).normalize() },
    sunColor: { value: new THREE.Color() },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(4000, 32, 16),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top, horizon, bottom, sunDir, sunColor;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          vec3 c = mix(horizon, top, smoothstep(0.0, 0.55, d.y));
          c = mix(c, bottom, smoothstep(0.0, -0.25, d.y));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          c += sunColor * (pow(s, 900.0) * 2.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

function puffTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const random = rng(3);
  for (let i = 0; i < 14; i++) {
    const x = size * (0.3 + random() * 0.4);
    const y = size * (0.35 + random() * 0.35);
    const r = size * (0.14 + random() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Облака-спрайты: «море облаков» в начале и плотные слои на маршрутах перелётов.
export function createClouds(regions) {
  const group = new THREE.Group();
  const material = new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, opacity: 0.95 });
  const random = rng(11);
  for (const { center, size, y, count, scale } of regions) {
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(material);
      s.position.set(
        center.x + (random() - 0.5) * size.x,
        y[0] + random() * (y[1] - y[0]),
        center.z + (random() - 0.5) * size.z,
      );
      const k = scale[0] + random() * (scale[1] - scale[0]);
      s.scale.set(k * 1.6, k, 1);
      group.add(s);
    }
  }
  return group;
}

// Пресеты освещения/неба для каждой точки маршрута; между ними всё плавно смешивается.
export const ENV = {
  dawn: { top: '#2c4f8f', horizon: '#ffc59a', bottom: '#f6d2b8', sun: [0.0, 0.08, -1], sunColor: '#ffb070', light: '#ffd2a8', lightI: 2.2, hemiSky: '#ffd9c2', hemiGround: '#5a6b8a', fog: 0.00055 },
  tropical: { top: '#1f78d1', horizon: '#bfe9f7', bottom: '#d8f3fb', sun: [0.6, 0.75, -0.4], sunColor: '#fff4d6', light: '#fff3dc', lightI: 2.6, hemiSky: '#cfefff', hemiGround: '#6ab3a0', fog: 0.0011 },
  desert: { top: '#4a6fb3', horizon: '#ffd3a1', bottom: '#f3d5ae', sun: [-0.7, 0.28, -0.6], sunColor: '#ffb35e', light: '#ffcf96', lightI: 2.8, hemiSky: '#ffe0b8', hemiGround: '#9c6b44', fog: 0.0009 },
  alps: { top: '#2a63bd', horizon: '#dcecfa', bottom: '#eef5fc', sun: [0.4, 0.55, 0.7], sunColor: '#fff6e4', light: '#fff8ee', lightI: 2.4, hemiSky: '#e3f0ff', hemiGround: '#4f6b55', fog: 0.0006 },
  cloud: { top: '#7fa6d6', horizon: '#eef3f8', bottom: '#f4f7fb', sun: [0.2, 0.6, -0.5], sunColor: '#ffffff', light: '#ffffff', lightI: 2.0, hemiSky: '#ffffff', hemiGround: '#9aa9bb', fog: 0.0045 },
  dusk: { top: '#1b2452', horizon: '#ff9d6e', bottom: '#f3b08f', sun: [0.0, 0.05, -1], sunColor: '#ff8a4c', light: '#ffb184', lightI: 1.8, hemiSky: '#ffb9a0', hemiGround: '#3c4466', fog: 0.0005 },
};

const parsed = Object.fromEntries(Object.entries(ENV).map(([k, e]) => [k, {
  ...e,
  top: new THREE.Color(e.top), horizon: new THREE.Color(e.horizon), bottom: new THREE.Color(e.bottom),
  sun: new THREE.Vector3(...e.sun).normalize(), sunColor: new THREE.Color(e.sunColor),
  light: new THREE.Color(e.light), hemiSky: new THREE.Color(e.hemiSky), hemiGround: new THREE.Color(e.hemiGround),
}]));

const COLOR_KEYS = ['top', 'horizon', 'bottom', 'sunColor', 'light', 'hemiSky', 'hemiGround'];
export function blendEnv(out, a, b, t) {
  const A = parsed[a], B = parsed[b];
  for (const k of COLOR_KEYS) out[k].lerpColors(A[k], B[k], t);
  out.sun.lerpVectors(A.sun, B.sun, t).normalize();
  out.lightI = A.lightI + (B.lightI - A.lightI) * t;
  out.fog = A.fog + (B.fog - A.fog) * t;
  return out;
}
export const makeEnv = () => ({
  top: new THREE.Color(), horizon: new THREE.Color(), bottom: new THREE.Color(), sunColor: new THREE.Color(),
  light: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), sun: new THREE.Vector3(), lightI: 1, fog: 0.001,
});

// Подмешивает пресет `name` с весом w к уже рассчитанному окружению.
export function mixEnv(out, name, w) {
  const B = parsed[name];
  for (const k of COLOR_KEYS) out[k].lerp(B[k], w);
  out.sun.lerp(B.sun, w).normalize();
  out.lightI += (B.lightI - out.lightI) * w;
  out.fog += (B.fog - out.fog) * w;
  return out;
}
