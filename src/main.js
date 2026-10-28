import * as THREE from 'three';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import './style.css';
import { createSky, createClouds, makeEnv } from './world/atmosphere.js';
import { buildTropical } from './world/tropical.js';
import { buildDesert } from './world/desert.js';
import { buildAlps } from './world/alps.js';
import { STATIONS, sample } from './journey.js';
import { createPanels } from './panels.js';
import { initUI } from './ui.js';

const stage = document.getElementById('stage');
const track = document.getElementById('track');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.appendChild(renderer.domElement);

const cssRenderer = new CSS3DRenderer();
cssRenderer.domElement.className = 'css3d';
stage.appendChild(cssRenderer.domElement);

const scene = new THREE.Scene();
const cssScene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#ffffff', 0.001);
const camera = new THREE.PerspectiveCamera(50, 1, 1, 6000);

const sky = createSky();
scene.add(sky.mesh);
const hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1.1);
const sun = new THREE.DirectionalLight('#ffffff', 2.5);
scene.add(hemi, sun, sun.target);

// Три локации живут в одной сцене, далеко друг от друга; между ними камера летит сквозь облака.
const zones = [buildTropical(STATIONS[0].center), buildDesert(STATIONS[1].center), buildAlps(STATIONS[2].center)];
zones.forEach((z) => scene.add(z.group));

const mid = (a, b) => STATIONS[a].center.clone().lerp(STATIONS[b].center, 0.5);
scene.add(createClouds([
  { center: new THREE.Vector3(0, 0, 500), size: { x: 3600, z: 2600 }, y: [240, 330], count: 190, scale: [110, 230] },
  { center: mid(0, 1), size: { x: 2200, z: 2200 }, y: [200, 360], count: 110, scale: [120, 240] },
  { center: mid(1, 2), size: { x: 2200, z: 2200 }, y: [200, 360], count: 110, scale: [120, 240] },
  { center: STATIONS[2].center.clone().add(new THREE.Vector3(0, 0, -300)), size: { x: 3200, z: 2600 }, y: [330, 390], count: 150, scale: [110, 220] },
]));

const panels = createPanels(cssScene);
const ui = initUI();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  // На портретных экранах шире угол обзора, чтобы локация помещалась целиком.
  camera.fov = camera.aspect < 1 ? 68 : 50;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  cssRenderer.setSize(w, h);
  panels.resize(camera);
}
window.addEventListener('resize', resize);
resize();

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const env = makeEnv();
const target = new THREE.Vector3();
const pointer = new THREE.Vector2();
const sway = new THREE.Vector2();
window.addEventListener('pointermove', (e) => {
  pointer.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
});

const scrollProgress = () => {
  const max = track.offsetHeight - window.innerHeight;
  return Math.min(1, Math.max(0, window.scrollY / max));
};
let progress = scrollProgress();
const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  // Плавное «догоняющее» движение камеры за скроллом.
  const goal = scrollProgress();
  progress += (goal - progress) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 3.2));
  if (Math.abs(goal - progress) < 1e-5) progress = goal;

  const { seg, t: segT, k } = sample(progress, camera.position, target, env);
  // Лёгкое «дыхание» камеры и реакция на курсор.
  if (!reduceMotion) {
    sway.lerp(pointer, 1 - Math.exp(-dt * 2));
    camera.position.y += Math.sin(t * 0.6) * 0.8;
    target.x += sway.x * 14;
    target.y -= sway.y * 8;
  }
  camera.lookAt(target);

  sky.mesh.position.copy(camera.position);
  sky.uniforms.top.value.copy(env.top);
  sky.uniforms.horizon.value.copy(env.horizon);
  sky.uniforms.bottom.value.copy(env.bottom);
  sky.uniforms.sunColor.value.copy(env.sunColor);
  sky.uniforms.sunDir.value.copy(env.sun);
  scene.fog.color.copy(env.horizon);
  scene.fog.density = env.fog;
  sun.color.copy(env.light);
  sun.intensity = env.lightI;
  sun.position.copy(camera.position).addScaledVector(env.sun, 500);
  sun.target.position.copy(camera.position);
  hemi.color.copy(env.hemiSky);
  hemi.groundColor.copy(env.hemiGround);

  // Рисуем только локации рядом с камерой.
  zones.forEach((z, i) => {
    z.group.visible = camera.position.distanceTo(STATIONS[i].center) < 2600;
    if (z.group.visible) z.update(t);
  });

  const orbit = seg.type === 'orbit';
  panels.update(orbit ? seg.station : -1, orbit ? k : null);

  // HUD: активный пункт маршрута и большой заголовок локации.
  let title = { index: -1, opacity: 0 };
  if (orbit) title = { index: seg.station, opacity: 1 - THREE.MathUtils.smoothstep(segT, 0.06, 0.13) };
  else if (seg.type === 'fly') title = { index: seg.b, opacity: THREE.MathUtils.smoothstep(segT, 0.82, 1) };
  else if (seg.type === 'intro') title = { index: 0, opacity: THREE.MathUtils.smoothstep(segT, 0.85, 1) };
  let active = 0;
  if (orbit) active = seg.station + 1;
  else if (seg.type === 'fly') active = segT > 0.5 ? seg.b + 1 : seg.a + 1;
  else if (seg.type === 'outro') active = segT > 0.5 ? 4 : 3;
  if (window.scrollY > track.offsetHeight - window.innerHeight * 0.5) active = 4;
  ui.update({
    active,
    title,
    heroOpacity: 1 - THREE.MathUtils.smoothstep(progress, 0.005, 0.035),
    progress: goal,
  });

  renderer.render(scene, camera);
  cssRenderer.render(cssScene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(() => {
  frame();
  document.getElementById('loader').classList.add('is-hidden');
});
