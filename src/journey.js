import * as THREE from 'three';
import { smoothstep } from './world/utils.js';
import { blendEnv, mixEnv } from './world/atmosphere.js';

// Станции маршрута: центр локации и параметры облёта камеры вокруг неё.
export const STATIONS = [
  { env: 'tropical', center: new THREE.Vector3(0, 0, 0), radius: 200, height: 58, lookY: 6, from: 1.95, to: -0.15 },
  { env: 'desert', center: new THREE.Vector3(2600, 0, -2400), radius: 240, height: 62, lookY: 26, from: 2.55, to: 0.55 },
  { env: 'alps', center: new THREE.Vector3(-1200, 0, -5200), radius: 185, height: 62, lookY: 58, from: 0.75, to: 2.45 },
];

// Таймлайн по прогрессу скролла 0..1.
export const TIMELINE = [
  { type: 'intro', from: 0, to: 0.1 },
  { type: 'orbit', station: 0, from: 0.1, to: 0.32 },
  { type: 'fly', a: 0, b: 1, from: 0.32, to: 0.42 },
  { type: 'orbit', station: 1, from: 0.42, to: 0.64 },
  { type: 'fly', a: 1, b: 2, from: 0.64, to: 0.74 },
  { type: 'orbit', station: 2, from: 0.74, to: 0.95 },
  { type: 'outro', from: 0.95, to: 1 },
];

const HERO_POS = new THREE.Vector3(0, 430, 1350);
const HERO_TARGET = new THREE.Vector3(0, 405, 0);

// Точки облёта (по прогрессу сегмента), где камера притормаживает напротив инфо-панелей.
export const STOPS = [0.2, 0.5, 0.8];
const DWELL = 0.8;
const wave = (t) => Math.sin((2 * Math.PI * (t - STOPS[0])) / (STOPS[1] - STOPS[0]));
const rawDwell = (t) => t - (DWELL * (STOPS[1] - STOPS[0]) / (2 * Math.PI)) * (wave(t) - wave(0));
// Неравномерный облёт: скорость камеры падает возле каждой панели.
export const dwell = (t) => rawDwell(t) / rawDwell(1);

export function orbitAngle(station, f) {
  return station.from + (station.to - station.from) * f;
}

export function orbitPose(station, f, pos, target) {
  const a = orbitAngle(station, f);
  pos.set(
    station.center.x + Math.cos(a) * station.radius,
    station.height,
    station.center.z + Math.sin(a) * station.radius,
  );
  target.set(station.center.x, station.lookY, station.center.z);
}

const bezier = (out, p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return out.set(0, 0, 0)
    .addScaledVector(p0, u * u * u)
    .addScaledVector(p1, 3 * u * u * t)
    .addScaledVector(p2, 3 * u * t * t)
    .addScaledVector(p3, t * t * t);
};
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);

const v = Array.from({ length: 8 }, () => new THREE.Vector3());

// Возвращает положение камеры, точку взгляда и окружение для прогресса p.
export function sample(p, pos, target, env) {
  const seg = TIMELINE.find((s) => p <= s.to) || TIMELINE[TIMELINE.length - 1];
  const t = Math.min(1, Math.max(0, (p - seg.from) / (seg.to - seg.from)));
  const [a0, a1, b0, b1, c1, c2, look] = v;

  if (seg.type === 'intro') {
    // Первые мгновения камера висит над облаками, затем ныряет вниз к острову.
    const k = ease(smoothstep(0.12, 1, t));
    orbitPose(STATIONS[0], 0, b0, b1);
    c1.set(0, 420, 750);
    c2.copy(b0).add(look.set(0, 190, 260));
    bezier(pos, HERO_POS, c1, c2, b0, k);
    target.lerpVectors(HERO_TARGET, b1, smoothstep(0.15, 0.85, k));
    blendEnv(env, 'dawn', 'tropical', smoothstep(0.3, 0.8, k));
    mixEnv(env, 'cloud', Math.sin(Math.PI * smoothstep(0.25, 0.75, k)) * 0.7);
    return { seg, t, k };
  }

  if (seg.type === 'orbit') {
    const st = STATIONS[seg.station];
    const k = dwell(t);
    orbitPose(st, k, pos, target);
    blendEnv(env, st.env, st.env, 0);
    return { seg, t, k };
  }

  if (seg.type === 'fly') {
    const A = STATIONS[seg.a], B = STATIONS[seg.b];
    const k = ease(t);
    orbitPose(A, 1, a0, a1);
    orbitPose(B, 0, b0, b1);
    const dir = look.subVectors(b0, a0).setY(0).normalize();
    c1.copy(a0).addScaledVector(dir, 500).setY(500);
    c2.copy(b0).addScaledVector(dir, -500).setY(500);
    bezier(pos, a0, c1, c2, b0, k);
    // Смотрим чуть вперёд по траектории, в начале и в конце — на саму локацию.
    bezier(look, a0, c1, c2, b0, Math.min(1, k + 0.06));
    look.y -= 40;
    target.lerpVectors(a1, look, smoothstep(0, 0.25, k));
    target.lerp(b1, smoothstep(0.7, 1, k));
    blendEnv(env, A.env, B.env, smoothstep(0.35, 0.65, k));
    mixEnv(env, 'cloud', Math.pow(Math.sin(Math.PI * k), 4) * 0.6);
    return { seg, t, k };
  }

  // outro: взлёт над облаками навстречу закату.
  const st = STATIONS[2];
  const k = ease(t);
  orbitPose(st, 1, a0, a1);
  b0.copy(a0).add(look.set(0, 420, 300));
  c1.copy(a0).add(look.set(0, 120, 120));
  bezier(pos, a0, c1, b0, b0, k);
  look.copy(b0).add(c2.set(0, -10, -1000));
  target.lerpVectors(a1, look, smoothstep(0.1, 0.9, k));
  blendEnv(env, 'alps', 'dusk', smoothstep(0.2, 1, k));
  return { seg, t, k };
}

// Прогресс скролла, на который нужно прокрутить, чтобы попасть к началу локации.
export const stationProgress = (i) => {
  const seg = TIMELINE.find((s) => s.type === 'orbit' && s.station === i);
  return seg.from + (seg.to - seg.from) * 0.02;
};
