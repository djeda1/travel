import * as THREE from 'three';

// Полноэкранный WebGL-слой: показывает кадры видео (со смешиванием соседних кадров
// для плавности) и рисует кинематографичные переходы между локациями.

export const MODES = { none: 0, clouds: 1, dive: 2, water: 3, sand: 4 };
export const IMG_ASPECT = 16 / 9;
export const PARALLAX = 0.012;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tA0, tA1, tB0, tB1;
  uniform float uMixA, uMixB, uT, uTime, uAspect, uImgAspect, uZoom;
  uniform int uMode;
  uniform vec2 uMouse, uView;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
    return s;
  }

  // Масштаб «cover»: кадр 16:9 заполняет экран любой формы.
  vec2 cover(vec2 p) {
    vec2 c = p - 0.5;
    if (uAspect > uImgAspect) c.y *= uImgAspect / uAspect; else c.x *= uAspect / uImgAspect;
    return c + 0.5;
  }

  vec3 tex(sampler2D a, sampler2D b, float m, vec2 q) {
    q = clamp(q, 0.001, 0.999);
    q.y = 1.0 - q.y;
    return mix(texture2D(a, q).rgb, texture2D(b, q).rgb, m);
  }

  // Камера «уходит вниз»: картинка сдвигается вверх, приближается и размывается по вертикали.
  vec3 view(sampler2D a, sampler2D b, float m, vec2 uv, float shift, float zoom, float blur) {
    vec2 q = (uv - 0.5) / zoom + 0.5;
    q.y -= shift;
    q = cover(q);
    if (blur < 0.001) return tex(a, b, m, q);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 9; i++) {
      float k = float(i) / 8.0 - 0.5;
      acc += tex(a, b, m, q + vec2(0.0, k * blur));
    }
    return acc / 9.0;
  }

  // Частицы: пузыри, песчинки, снежинки.
  float particles(vec2 uv, float scale, vec2 vel, float size) {
    vec2 p = vec2(uv.x * uAspect, uv.y) * scale + vel * uTime;
    vec2 i = floor(p), f = fract(p);
    vec2 c = vec2(hash(i + 3.1), hash(i + 7.7));
    float on = step(0.55, hash(i));
    return on * smoothstep(size, size * 0.3, length(f - c));
  }

  void main() {
    vec2 uv = vUv;
    vec2 base = uv + uMouse * ${PARALLAX.toFixed(3)};
    float zoom = uZoom;
    vec3 col;

    if (uMode == 0) {
      col = view(tA0, tA1, uMixA, base, 0.0, zoom, 0.0);
    } else {
      float t = uT;
      float leave = smoothstep(0.0, 0.5, t);
      float arrive = 1.0 - smoothstep(0.5, 1.0, t);
      float veil = smoothstep(0.0, 1.0, 1.0 - abs(t - 0.5) * 2.0);

      vec2 dist = vec2(0.0);
      if (uMode == 3) dist = vec2(fbm(uv * 5.0 + uTime * 0.5) - 0.5, fbm(uv * 5.0 + 7.3 - uTime * 0.4) - 0.5) * 0.09 * veil;
      if (uMode == 4) dist = vec2(fbm(uv * vec2(2.0, 14.0) + vec2(uTime * 1.5, 0.0)) - 0.5, 0.0) * 0.05 * veil;

      vec3 A = view(tA0, tA1, uMixA, base + dist, leave * leave * 0.38, zoom * (1.0 + leave * 0.28), leave * 0.05);
      vec3 B = view(tB0, tB1, uMixB, base + dist, -arrive * arrive * 0.38, zoom * (1.0 + arrive * 0.28), arrive * 0.05);
      float n = fbm(uv * 3.0 + uTime * 0.05);
      col = mix(A, B, smoothstep(0.4, 0.6, t + (n - 0.5) * 0.3));

      vec3 vc = vec3(1.0);
      float vm = 0.0;
      if (uMode == 1) {
        // Пролёт сквозь облака.
        float c = fbm(uv * vec2(2.2, 3.0) + vec2(0.0, t * 2.5 - uTime * 0.05));
        vc = mix(vec3(0.82, 0.88, 0.96), vec3(1.0), c);
        vm = smoothstep(0.25, 0.7, c * 0.7 + veil * 0.8);
      } else if (uMode == 2) {
        vc = vec3(0.85, 1.0, 0.97);
        vm = veil * 0.22;
      } else if (uMode == 3) {
        // Ныряем в лагуну и «выныриваем» из песчаной бури.
        // Мягкие каустики и лучи света сверху, сквозь которые видно размытую картинку.
        float caustic = smoothstep(0.62, 0.9, fbm(uv * vec2(3.0, 4.0) + vec2(uTime * 0.08, -uTime * 0.12)) + fbm(uv * 6.0 - uTime * 0.1) * 0.3);
        float rays = pow(max(0.0, sin(uv.x * 9.0 + sin(uv.y * 2.0 + uTime * 0.4))), 6.0) * uv.y;
        vec3 water = mix(vec3(0.0, 0.16, 0.26), vec3(0.1, 0.6, 0.64), uv.y);
        water = mix(water, col * vec3(0.35, 0.85, 0.9), 0.35) + caustic * 0.12 + rays * 0.1;
        vec3 sand = mix(vec3(0.62, 0.45, 0.28), vec3(0.9, 0.74, 0.52), uv.y);
        float s = smoothstep(0.45, 0.7, t + (n - 0.5) * 0.2);
        vc = mix(water, sand, s);
        vc += particles(uv, 9.0, vec2(0.0, -1.6), 0.07) * (1.0 - s) * 0.35;
        vc += particles(uv, 22.0, vec2(-6.0, 0.4), 0.05) * s * 0.35;
        vm = smoothstep(0.05, 0.85, veil) * 0.94;
      } else if (uMode == 4) {
        // Песчаная буря превращается в снежную метель.
        float s = smoothstep(0.42, 0.68, t + (n - 0.5) * 0.2);
        vec3 sand = mix(vec3(0.7, 0.52, 0.32), vec3(0.92, 0.77, 0.55), uv.y);
        vec3 snow = mix(vec3(0.8, 0.86, 0.94), vec3(0.97, 0.98, 1.0), uv.y);
        vc = mix(sand, snow, s);
        float streak = noise(vec2(uv.x * 30.0 - uTime * 18.0, uv.y * 260.0));
        vc += (streak - 0.5) * 0.08;
        vc += particles(uv, 18.0, mix(vec2(-7.0, 0.5), vec2(-1.5, 2.2), s), 0.06) * 0.5;
        vm = clamp(veil * 0.95 + (streak - 0.5) * 0.2 * veil, 0.0, 1.0);
      }
      col = mix(col, vc, vm);
    }

    // Лёгкая «плёнка»: виньетка и зерно.
    float vig = smoothstep(1.25, 0.35, length((uv - 0.5) * vec2(uAspect, 1.0) * 0.85));
    col *= mix(0.8, 1.0, vig);
    col += (hash(uv * uView + fract(uTime)) - 0.5) * 0.03;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function makeTexture() {
  const t = new THREE.Texture();
  t.flipY = false;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  container.appendChild(renderer.domElement);

  const textures = { tA0: makeTexture(), tA1: makeTexture(), tB0: makeTexture(), tB1: makeTexture() };
  const uniforms = {
    ...Object.fromEntries(Object.entries(textures).map(([k, v]) => [k, { value: v }])),
    uMixA: { value: 0 }, uMixB: { value: 0 }, uT: { value: 0 }, uTime: { value: 0 },
    uAspect: { value: 1 }, uImgAspect: { value: IMG_ASPECT }, uZoom: { value: 1.04 },
    uMode: { value: 0 }, uMouse: { value: new THREE.Vector2() }, uView: { value: new THREE.Vector2(1, 1) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const camera = new THREE.Camera();

  const bind = (key, bitmap) => {
    const tex = textures[key];
    if (bitmap && tex.image !== bitmap) {
      tex.image = bitmap;
      tex.needsUpdate = true;
    }
  };

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    uniforms.uAspect.value = w / h;
    uniforms.uView.value.set(w, h);
  }
  resize();
  window.addEventListener('resize', resize);

  return {
    uniforms,
    // a, b — результаты frameStore.sample(); mode/t — тип и прогресс перехода.
    render({ a, b, mode = 0, t = 0, time, mouse, zoom }) {
      if (a) {
        bind('tA0', a.a);
        bind('tA1', a.b);
        uniforms.uMixA.value = a.mix;
      }
      if (b) {
        bind('tB0', b.a);
        bind('tB1', b.b);
        uniforms.uMixB.value = b.mix;
      }
      uniforms.uMode.value = mode;
      uniforms.uT.value = t;
      uniforms.uTime.value = time;
      uniforms.uMouse.value.copy(mouse);
      uniforms.uZoom.value = zoom;
      renderer.render(scene, camera);
    },
    // Переводит нормированные координаты кадра (0..1, y вниз) в пиксели экрана — для меток.
    project(x, y, mouse, zoom) {
      const aspect = uniforms.uAspect.value;
      let cx = x - 0.5, cy = 1 - y - 0.5;
      if (aspect > IMG_ASPECT) cy /= IMG_ASPECT / aspect; else cx /= aspect / IMG_ASPECT;
      const px = cx * zoom + 0.5 - mouse.x * PARALLAX;
      const py = cy * zoom + 0.5 - mouse.y * PARALLAX;
      return { x: px * window.innerWidth, y: (1 - py) * window.innerHeight };
    },
  };
}
