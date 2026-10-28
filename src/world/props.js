import * as THREE from 'three';
import { part, merge } from './utils.js';

// Low-poly модели, собранные из примитивов. Каждая функция возвращает одну геометрию с цветами вершин.

export function palmGeometry() {
  const top = new THREE.Vector3(2.2, 11, 0);
  const trunk = new THREE.TubeGeometry(
    new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 6, 0), top),
    6, 0.45, 5,
  );
  const parts = [part(trunk, '#8a6440')];
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.ConeGeometry(1.5, 8, 3);
    leaf.translate(0, 4, 0);
    const a = (i / 7) * Math.PI * 2;
    parts.push(part(leaf, i % 2 ? '#3f9a4a' : '#2f8040', {
      scale: [0.3, 1, 1],
      rotation: [0, a, -1.95 - (i % 3) * 0.12],
      position: [top.x, top.y, top.z],
    }));
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    parts.push(part(new THREE.IcosahedronGeometry(0.45, 0), '#5a3b1e', {
      position: [top.x + Math.cos(a) * 0.6, top.y - 0.6, top.z + Math.sin(a) * 0.6],
    }));
  }
  return merge(parts);
}

export function bungalowGeometry() {
  const parts = [];
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    parts.push(part(new THREE.CylinderGeometry(0.25, 0.25, 6, 5), '#6b4a2e', { position: [x, 1, z] }));
  }
  parts.push(part(new THREE.BoxGeometry(10, 0.5, 9), '#b98a5e', { position: [0, 4, 0] }));
  parts.push(part(new THREE.BoxGeometry(6, 3.4, 6), '#f3e6cf', { position: [-0.8, 5.9, 0] }));
  parts.push(part(new THREE.BoxGeometry(2.6, 0.2, 3.4), '#3ec4d6', { position: [3.4, 4.3, 0] })); // мини-бассейн
  parts.push(part(new THREE.ConeGeometry(5.6, 3.8, 4), '#c9a46a', { rotation: [0, Math.PI / 4, 0], position: [-0.8, 9.5, 0] }));
  return merge(parts);
}

export function pierGeometry(length) {
  const parts = [part(new THREE.BoxGeometry(length, 0.4, 3), '#b98a5e', { position: [length / 2, 3.8, 0] })];
  for (let x = 2; x < length; x += 8) {
    parts.push(part(new THREE.CylinderGeometry(0.2, 0.2, 6, 4), '#6b4a2e', { position: [x, 1, 1.6] }));
    parts.push(part(new THREE.CylinderGeometry(0.2, 0.2, 6, 4), '#6b4a2e', { position: [x, 1, -1.6] }));
  }
  return merge(parts);
}

export function sailboatGeometry() {
  const sail = new THREE.Shape();
  sail.moveTo(0, 0);
  sail.lineTo(0, 9);
  sail.lineTo(4.5, 0.5);
  sail.lineTo(0, 0);
  return merge([
    part(new THREE.CylinderGeometry(1.4, 0.7, 7, 6, 1), '#ffffff', { rotation: [Math.PI / 2, 0, 0], scale: [1, 1, 0.5], position: [0, 0.6, 0] }),
    part(new THREE.CylinderGeometry(0.12, 0.12, 11, 4), '#7a5a3a', { position: [0, 6, 0] }),
    part(new THREE.ShapeGeometry(sail), '#fff8ee', { rotation: [0, Math.PI / 2, 0], position: [0, 1.6, 0.2] }),
  ]);
}

export function pyramidGeometry(radius, height, withCap = false) {
  const parts = [part(new THREE.ConeGeometry(radius, height, 4, 3), '#d8b47a', { rotation: [0, Math.PI / 4, 0], position: [0, height / 2, 0] })];
  if (withCap) {
    const k = 0.08;
    parts.push(part(new THREE.ConeGeometry(radius * k, height * k, 4), '#ffd25e', {
      rotation: [0, Math.PI / 4, 0],
      position: [0, height * (1 - k / 2) + 0.05, 0],
    }));
  }
  return merge(parts);
}

export function sphinxGeometry() {
  const c = '#c9a26b';
  return merge([
    part(new THREE.BoxGeometry(7, 6, 20), c, { position: [0, 3, 0] }),
    part(new THREE.BoxGeometry(6, 7, 6), c, { position: [0, 8.5, 8] }),
    part(new THREE.BoxGeometry(5, 5, 4.5), '#b8915c', { position: [0, 9.2, 10.5] }),
    part(new THREE.ConeGeometry(4.6, 6, 4), '#3d6ea8', { rotation: [0, Math.PI / 4, 0], position: [0, 8.5, 8] }),
    part(new THREE.BoxGeometry(2, 2, 9), c, { position: [-2.4, 1, 13] }),
    part(new THREE.BoxGeometry(2, 2, 9), c, { position: [2.4, 1, 13] }),
  ]);
}

export function obeliskGeometry() {
  return merge([
    part(new THREE.CylinderGeometry(0.9, 1.4, 16, 4), '#c2985e', { rotation: [0, Math.PI / 4, 0], position: [0, 8, 0] }),
    part(new THREE.ConeGeometry(1.25, 2, 4), '#ffd25e', { rotation: [0, Math.PI / 4, 0], position: [0, 17, 0] }),
  ]);
}

export function camelGeometry() {
  const c = '#a87a4a';
  return merge([
    part(new THREE.BoxGeometry(1.4, 1.6, 3.6), c, { position: [0, 3, 0] }),
    part(new THREE.IcosahedronGeometry(0.9, 0), c, { position: [0, 4, 0] }),
    part(new THREE.BoxGeometry(0.6, 2.2, 0.6), c, { rotation: [-0.5, 0, 0], position: [0, 4.2, 2.1] }),
    part(new THREE.BoxGeometry(0.7, 0.7, 1.3), c, { position: [0, 5.3, 2.8] }),
    ...[[-0.5, -1.3], [0.5, -1.3], [-0.5, 1.3], [0.5, 1.3]].map(([x, z]) =>
      part(new THREE.BoxGeometry(0.35, 2.4, 0.35), '#8a6038', { position: [x, 1.2, z] })),
  ]);
}

export function pineGeometry(snowy = false) {
  const parts = [part(new THREE.CylinderGeometry(0.4, 0.6, 3, 5), '#5a3d26', { position: [0, 1.5, 0] })];
  const tiers = [[4, 6, 5], [3.2, 5, 8], [2.2, 4, 10.6]];
  tiers.forEach(([r, h, y], i) => {
    parts.push(part(new THREE.ConeGeometry(r, h, 6), i % 2 ? '#2d6b45' : '#24583a', { position: [0, y, 0] }));
  });
  if (snowy) parts.push(part(new THREE.ConeGeometry(1.2, 1.8, 6), '#f4f8ff', { position: [0, 12.2, 0] }));
  return merge(parts);
}

export function chaletGeometry() {
  const roof = new THREE.CylinderGeometry(5.2, 5.2, 11, 3, 1);
  return merge([
    part(new THREE.BoxGeometry(8, 3, 10), '#d7cdbd', { position: [0, 1.5, 0] }),
    part(new THREE.BoxGeometry(8, 3, 10), '#8b5a34', { position: [0, 4.5, 0] }),
    part(roof, '#5b3624', { scale: [1, 1, 0.6], rotation: [-Math.PI / 2, 0, 0], position: [0, 7.56, 0] }),
    part(new THREE.BoxGeometry(1.2, 3, 1.2), '#7a7a7a', { position: [2, 9.5, -2.5] }),
    part(new THREE.BoxGeometry(2.2, 1.6, 0.2), '#ffd98a', { position: [0, 4.6, 5.05] }),
    part(new THREE.BoxGeometry(8.8, 0.3, 2), '#6e4529', { position: [0, 3, 5.6] }),
  ]);
}
