import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Детерминированный генератор случайных чисел: сцена выглядит одинаково при каждой загрузке.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Готовит деталь модели: не индексированная геометрия + цвет вершин + трансформация.
export function part(geometry, color, { position, rotation, scale } = {}) {
  let g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (scale) g.scale(...scale);
  if (rotation) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
  if (position) g.translate(...position);
  g.deleteAttribute('uv');
  const c = new THREE.Color(color);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = c.r;
    colors[i + 1] = c.g;
    colors[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

export function merge(parts) {
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

export const flatMaterial = (opts = {}) =>
  new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, ...opts });

// Расставляет копии геометрии через InstancedMesh: одна отрисовка на сотни объектов.
export function scatter(geometry, material, transforms) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  transforms.forEach(({ x, y, z, rotY = 0, tilt = 0, scale = 1 }, i) => {
    q.setFromEuler(new THREE.Euler(tilt, rotY, tilt * 0.5));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(scale, scale, scale));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// Плоскость-ландшафт с цветами вершин и плоским (low-poly) освещением.
export function terrain({ size, segments, height, color, center }) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + center.x;
    const z = pos.getZ(i) + center.z;
    pos.setY(i, height(x, z));
  }
  const flat = geo.toNonIndexed();
  const p = flat.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const n = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    n.crossVectors(c.clone().sub(b), a.clone().sub(b)).normalize();
    const y = (a.y + b.y + c.y) / 3;
    const cx = (a.x + b.x + c.x) / 3 + center.x;
    const cz = (a.z + b.z + c.z) / 3 + center.z;
    color(col, y, n.y, cx, cz);
    for (let k = 0; k < 3; k++) col.toArray(colors, (i + k) * 3);
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  flat.computeVertexNormals();
  const mesh = new THREE.Mesh(flat, flatMaterial());
  mesh.position.set(center.x, 0, center.z);
  return mesh;
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
