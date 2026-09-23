import * as THREE from 'three';
import markWhite from './photos/mark.png';
import howrahPhoto from './photos/howrah.jpg';
import victoriaPhoto from './photos/victoria.jpg';

/**
 * SuperPro opening — Kolkata, then the strike, then the mark.
 *
 * Six acts in 3.9 s of wall clock:
 *   0.00–1.05  Howrah Bridge draws itself on, camera easing in
 *   1.05–2.05  Victoria Memorial takes over
 *   2.05–2.58  a paddle swings in and meets the ball — no player, just the shot
 *   2.58–3.08  the ball rushes the camera and fills the frame
 *   3.08–3.45  the screen cracks where it hit
 *   3.45–3.90  shards fall away and the mark settles
 *
 * No monument captions and no wordmark anywhere: the brief was the logo alone,
 * moving, and a landmark reads faster without a label on it.
 */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** Smoothstep between two times — the workhorse for every fade and slide. */
const sm = (a, b, t) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
/** Ease out cubic, for things that arrive and settle. */
const out = x => 1 - (1 - clamp(x, 0, 1)) ** 3;
/** Overshoot, for the mark landing. */
const back = x => { const c = 1.9; const p = clamp(x, 0, 1) - 1; return 1 + c * p ** 3 + c * p ** 2; };

export const SPAN = 3.9;

const T = {
  bridgeIn: 0.06, bridgeDrawn: 0.84, bridgeOut: 1.02,
  vicIn: 1.00, vicDrawn: 1.82, vicOut: 2.00,
  // The strike only begins once the last monument has cleared.
  paddleIn: 2.00, contact: 2.52,
  rushEnd: 3.02,
  crackIn: 3.02, crackFull: 3.38,
  shards: 3.34, markIn: 3.38, markSettled: 3.82,
};

const smallScreen = () => innerWidth < 650 || matchMedia('(pointer: coarse)').matches;

/**
 * One photographic shot.
 *
 * The plate sits under a grade and a vignette rather than being shown raw: a
 * daylight snapshot dropped straight into this sequence would read as a
 * different piece of film from the ball and the mark that follow it. The grade
 * pulls the whites toward the brand's teal and crushes the sky, which is enough
 * to make a photograph and a rendered ball feel shot on the same stock.
 */
function shotFor(src, cls) {
  return `<div class="shot ${cls}" aria-hidden="true">` +
    `<img src="${src}" alt="" />` +
    `<div class="grade"></div><div class="tint"></div><div class="bloom"></div><div class="scrim"></div>` +
    `</div>`;
}

const CSS = `
#sp-open{position:fixed;inset:0;width:100%;height:100%;height:100dvh;z-index:2147483600;overflow:hidden;
  background:#02121d;font-family:Arial,Helvetica,sans-serif;isolation:isolate}
#sp-open *{box-sizing:border-box}
#sp-open .sky{position:absolute;inset:0;
  background:radial-gradient(ellipse at 50% 62%,#0d3a4e 0%,#051f2e 46%,#010d16 100%)}
#sp-open .haze{position:absolute;inset:0;opacity:.5;
  background:radial-gradient(ellipse at 50% 78%,rgba(0,229,95,.20) 0%,transparent 62%)}
#sp-open .stars{position:absolute;inset:0;opacity:.5}
#sp-open canvas{position:absolute;inset:0;width:100%;height:100%}

/* Monument line art. Stroked so each path can draw itself on. */
/* A photographic plate, its grade, and a scrim that keeps the frame readable
   under whatever follows it. */
#sp-open .shot{position:absolute;inset:0;overflow:hidden;opacity:0;will-change:opacity}
#sp-open .shot img{position:absolute;left:50%;top:50%;min-width:100%;min-height:100%;
  width:auto;height:auto;transform:translate(-50%,-50%);object-fit:cover;
  will-change:transform;filter:contrast(1.34) saturate(.94) brightness(.98)}
/* Teal over the whites, so marble and steel land in the brand palette. */
#sp-open .shot .grade{position:absolute;inset:0;mix-blend-mode:soft-light;
  background:linear-gradient(158deg,#2ee39a 0%,#0e93ad 44%,#06294a 100%);opacity:1}
/* A second pass in colour, low and slow, to pull the sky and the marble off
   neutral without crushing the luminance the soft-light pass preserved. */
#sp-open .shot .tint{position:absolute;inset:0;mix-blend-mode:color;
  background:linear-gradient(170deg,#1aa888 0%,#0f7f9a 60%,#0a3f60 100%);opacity:.42}
#sp-open .shot .bloom{position:absolute;inset:0;mix-blend-mode:screen;
  background:radial-gradient(ellipse at 50% 34%,rgba(0,229,95,.18) 0%,rgba(0,140,180,.10) 42%,transparent 72%)}
#sp-open .shot .scrim{position:absolute;inset:0;
  background:radial-gradient(ellipse at 50% 48%,rgba(2,18,29,0) 30%,rgba(2,18,29,.46) 72%,rgba(2,18,29,.92) 100%),
             linear-gradient(to bottom,rgba(2,18,29,.66) 0%,rgba(2,18,29,.05) 26%,rgba(2,18,29,.05) 62%,rgba(2,18,29,.86) 100%)}

/* The crack. Drawn as strokes from the impact point, plus shard fills. */
#sp-open .crack{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#sp-open .crack .ln{fill:none;stroke:#eafff5;stroke-linecap:round;vector-effect:non-scaling-stroke}
#sp-open .crack .ln.p{stroke-width:1.4;filter:drop-shadow(0 0 5px rgba(190,255,225,.75))}
#sp-open .crack .ln.s{stroke-width:.7;stroke:#bfe9d8;opacity:.7}
/* The dark twin sits under each bright line and is offset by half a pixel, so
   a fracture reads as a gap with two lit edges rather than a drawn stroke. */
#sp-open .crack .ln.dk{stroke-width:2.6;stroke:rgba(2,18,29,.62);transform:translate(.35px,.45px)}
#sp-open .crack .shard{opacity:0;will-change:transform,opacity}
#sp-open .crack .core{mix-blend-mode:screen}

#sp-open .flash{position:absolute;inset:0;background:#dffff0;opacity:0;mix-blend-mode:screen}
#sp-open .grain{position:absolute;inset:0;pointer-events:none;opacity:.055;
  mix-blend-mode:overlay;background-repeat:repeat;background-size:180px 180px;will-change:transform}
#sp-open .vig{position:absolute;inset:0;pointer-events:none;
  box-shadow:inset 0 0 200px 60px rgba(0,8,14,.85)}
#sp-open .markWrap{position:absolute;left:50%;top:50%;width:min(26vw,380px);
  transform:translate(-50%,-50%);will-change:transform,opacity}
#sp-open .mark{display:block;width:100%;height:auto;opacity:0;
  filter:drop-shadow(0 14px 44px rgba(0,0,0,.6))}
/* The shine is masked to the logo silhouette, so the sweep travels across the
   mark itself instead of a rectangle sitting on top of it. */
#sp-open .shine{position:absolute;inset:0;opacity:0;mix-blend-mode:screen;pointer-events:none;
  -webkit-mask-image:var(--m);mask-image:var(--m);
  -webkit-mask-size:100% 100%;mask-size:100% 100%;
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  background:linear-gradient(105deg,transparent 32%,rgba(255,255,255,.5) 46%,
    rgba(0,229,95,.95) 52%,rgba(255,255,255,.5) 58%,transparent 72%);
  background-size:280% 100%}
#sp-open .pulse{position:absolute;left:50%;top:50%;width:150%;aspect-ratio:1;
  transform:translate(-50%,-50%) scale(.2);border:2px solid rgba(0,229,95,.9);
  border-radius:50%;opacity:0}
#sp-open .ring{position:absolute;left:50%;top:50%;width:200px;height:200px;
  border:2px solid rgba(0,229,95,.85);border-radius:50%;opacity:0;will-change:transform}
#sp-open .skip{position:absolute;right:max(20px,env(safe-area-inset-right));
  bottom:max(18px,env(safe-area-inset-bottom));border:1px solid rgba(145,179,198,.35);
  background:rgba(5,23,33,.72);color:#c4d8e3;border-radius:22px;padding:9px 15px;
  font:11px Arial;cursor:pointer;pointer-events:auto}
/* In portrait the drawing is wide and the screen is not, so it has to be
   scaled up and allowed to run past the edges — otherwise the monument sits as
   a small band in the middle of a tall empty frame. */
@media (max-aspect-ratio: 3/4) {
  #sp-open .mark{width:min(48vw,230px)}
}
@media (prefers-reduced-motion: reduce) {#sp-open .shot img{transform:translate(-50%,-50%) scale(1.1) !important}#sp-open .crack{display:none}}
`;

/**
 * A glass shatter, built once.
 *
 * Three things make broken glass read as broken glass rather than as a drawn
 * star: the fragments are irregular quads rather than equal wedges, each one
 * catches light differently, and the cracks have thickness — a bright line with
 * a dark one beside it, because a fracture is a gap with two lit edges.
 *
 * The plate is tessellated properly: every spoke and every ring band gets a
 * fragment, so when they separate the whole screen comes apart instead of a
 * ring of chips around an intact middle.
 */
function crackMarkup() {
  const cx = 50, cy = 50;
  const spokes = 20;
  const rings = [0, 6, 15, 30, 54, 96];   // centre outwards, last one past the edge
  const rnd = i => Math.abs((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1);

  // Jittered polar grid. Each node wanders a little so no two fragments match.
  const node = (i, k) => {
    const a = (i % spokes) / spokes * Math.PI * 2 + 0.17 + (rnd(i * 7 + k * 13) - 0.5) * 0.11;
    const r = rings[k] * (0.84 + rnd(i * 31 + k * 17) * 0.32);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };

  const shards = [];
  const cracks = [];

  for (let i = 0; i < spokes; i++) {
    for (let k = 0; k < rings.length - 1; k++) {
      const p = k === 0
        ? [[cx, cy], node(i, 1), node(i + 1, 1)]
        : [node(i, k), node(i + 1, k), node(i + 1, k + 1), node(i, k + 1)];
      const pts = p.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
      // Ring index rides along so the fall can be staggered outwards.
      shards.push(`<polygon class="shard" data-ring="${k}" data-i="${i}" points="${pts}" fill="url(#g${(i + k) % 3})" />`);
    }
  }

  // Cracks run along the fragment edges, so the lines and the pieces agree.
  for (let i = 0; i < spokes; i++) {
    let d = `M ${cx} ${cy}`;
    for (let k = 1; k < rings.length; k++) {
      const [x, y] = node(i, k);
      d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    cracks.push(`<path class="ln p" d="${d}" />`);
    cracks.push(`<path class="ln dk" d="${d}" />`);

    for (let k = 1; k < rings.length - 1; k++) {
      const [ax, ay] = node(i, k);
      const [bx, by] = node(i + 1, k);
      cracks.push(`<path class="ln tie ${k === 1 ? 'p' : 's'}" data-ring="${k}" d="M ${ax.toFixed(2)} ${ay.toFixed(2)} L ${bx.toFixed(2)} ${by.toFixed(2)}" />`);
    }
  }

  const defs =
    `<defs>` +
    `<linearGradient id="g0" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="#eafff7" stop-opacity=".95"/><stop offset="1" stop-color="#5fd9c0" stop-opacity=".22"/></linearGradient>` +
    `<linearGradient id="g1" x1="1" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#bff4ff" stop-opacity=".72"/><stop offset="1" stop-color="#0f6f86" stop-opacity=".18"/></linearGradient>` +
    `<linearGradient id="g2" x1="0" y1="1" x2="1" y2="0">` +
      `<stop offset="0" stop-color="#ffffff" stop-opacity=".85"/><stop offset="1" stop-color="#1b8f7a" stop-opacity=".12"/></linearGradient>` +
    `<radialGradient id="core"><stop offset="0" stop-color="#ffffff" stop-opacity="1"/>` +
      `<stop offset="1" stop-color="#9dffd0" stop-opacity="0"/></radialGradient>` +
    `</defs>`;

  return `<svg class="crack" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
    `${defs}${shards.join('')}${cracks.join('')}` +
    `<circle class="core" cx="${cx}" cy="${cy}" r="9" fill="url(#core)" opacity="0" />` +
    `</svg>`;
}

/** A faint starfield, so the empty sky is not flat. */
function starsMarkup() {
  let dots = '';
  for (let i = 0; i < 70; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 12345.6789) % 1;
    const r = 0.06 + ((i % 5) * 0.03);
    dots += `<circle cx="${(Math.abs(x) * 100).toFixed(2)}" cy="${(Math.abs(y) * 62).toFixed(2)}" r="${r}" fill="#bfe9ff" opacity="${(0.25 + (i % 4) * 0.16).toFixed(2)}" />`;
  }
  return `<svg class="stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${dots}</svg>`;
}

export async function createOpening() {
  window.superproOpening?.dispose?.();

  const root = document.createElement('div');
  root.id = 'sp-open';
  root.innerHTML =
    `<style>${CSS}</style>` +
    `<div class="sky"></div>${starsMarkup()}<div class="haze"></div>` +
    shotFor(howrahPhoto, 'howrah') +
    shotFor(victoriaPhoto, 'victoria') +
    `<div class="ring"></div>` +
    crackMarkup() +
    `<div class="flash"></div><div class="grain"></div><div class="vig"></div>` +
    `<div class="markWrap">` +
      `<div class="pulse"></div>` +
      `<img class="mark" src="${markWhite}" alt="" />` +
      `<div class="shine" style="--m:url(${markWhite})"></div>` +
    `</div>`;
  document.body.append(root);

  const $ = s => root.querySelector(s);
  const howrah = $('.howrah');
  const victoria = $('.victoria');
  const howrahImg = howrah.querySelector('img');
  const victoriaImg = victoria.querySelector('img');
  const crack = $('.crack');
  const flash = $('.flash');
  const ring = $('.ring');
  const mark = $('.mark');
  const markWrap = $('.markWrap');
  const shine = $('.shine');
  const pulse = $('.pulse');
  const grain = $('.grain');

  // Monochrome noise tile, generated once. A repeating tile is invisible as a
  // pattern at this opacity, and jittering its offset each frame is what makes
  // it read as film grain rather than a static dirty overlay.
  (() => {
    const N = 180;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(N, N);
    for (let i = 0; i < N * N; i++) {
      const v = 118 + Math.random() * 74;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    grain.style.backgroundImage = `url(${c.toDataURL('image/png')})`;
  })();
  const stars = $('.stars');
  const haze = $('.haze');

  const skip = document.createElement('button');
  skip.className = 'skip';
  skip.textContent = 'Skip';
  root.appendChild(skip);

  const crackSpokes = [...crack.querySelectorAll('.ln:not(.tie)')].map(p => {
    const len = p.getTotalLength() || 1;
    p.style.strokeDasharray = String(len);
    p.style.strokeDashoffset = String(len);
    return { path: p, len };
  });
  const crackTies = [...crack.querySelectorAll('.ln.tie')].map(p => ({
    path: p, ring: Number(p.dataset.ring || 0),
  }));
  const shardEls = [...crack.querySelectorAll('.shard')].map(el => ({
    el,
    ring: Number(el.dataset.ring || 0),
    // A stable direction and spin per fragment, so nothing pulses in unison.
    dir: (Number(el.dataset.i || 0) / 20) * Math.PI * 2 + 0.17,
    spin: ((Number(el.dataset.i || 0) % 7) - 3) * 9,
    lag: ((Number(el.dataset.i || 0) * 37) % 11) / 11,
  }));
  const core = crack.querySelector('.core');

  await Promise.allSettled([...root.querySelectorAll('img')].map(i => i.decode()));

  // ── The strike, in three dimensions ────────────────────────────────────────
  // Only a paddle and a ball. The brief was to drop the player, and without a
  // body to carry the swing the paddle has to do it all — so it arrives fast,
  // rotates through the ball, and leaves.
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 120);
  camera.position.set(0, 0, 9);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !smallScreen(), alpha: true });
  } catch {
    renderer = null;
  }
  if (renderer) {
    renderer.setPixelRatio(Math.max(2, Math.min(devicePixelRatio * 2, 3)));
    renderer.setSize(innerWidth, innerHeight);
    root.insertBefore(renderer.domElement, crack);
  }

  scene.add(new THREE.AmbientLight(0xbfe6ff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(-4, 6, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6cffc0, 2.0);
  rim.position.set(5, -2, -6);
  scene.add(rim);

  // The 40 apertures of an outdoor ball, discarded in the shader so the holes
  // are real openings rather than painted dots.
  const holes = [];
  for (let i = 0; i < 40; i++) {
    const y = 1 - (2 * (i + 0.5)) / 40;
    const r = Math.sqrt(1 - y * y);
    const a = i * Math.PI * (3 - Math.sqrt(5));
    holes.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xc9fa35, roughness: 0.36 });
  ballMat.onBeforeCompile = sh => {
    sh.uniforms.spHoles = { value: holes };
    sh.vertexShader = 'varying vec3 spN;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nspN = normalize(position);');
    sh.fragmentShader = 'varying vec3 spN; uniform vec3 spHoles[40];\n' + sh.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\nfor(int i=0;i<40;i++){ if(dot(normalize(spN),spHoles[i])>.985) discard; }');
  };

  const ball = new THREE.Group();
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 56, 40), ballMat));
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(0.43, 28, 20),
    new THREE.MeshStandardMaterial({ color: 0x24330c, roughness: 0.95 })));
  scene.add(ball);

  // Paddle: a bevelled face, a volt edge guard and a wrapped grip.
  const paddle = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.62, 0.62); shape.lineTo(0.62, 0.62);
  shape.quadraticCurveTo(0.99, 0.72, 0.99, 1.24);
  shape.lineTo(0.94, 2.62);
  shape.quadraticCurveTo(0.90, 2.98, 0.52, 3.04);
  shape.lineTo(-0.52, 3.04);
  shape.quadraticCurveTo(-0.90, 2.98, -0.94, 2.62);
  shape.lineTo(-0.99, 1.24);
  shape.quadraticCurveTo(-0.99, 0.72, -0.62, 0.62);

  const face = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.1, bevelSegments: 3, steps: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x1d4557, roughness: 0.38, metalness: 0.3 }));
  paddle.add(face);
  const edge = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.13, bevelSegments: 3, steps: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x00e55f, roughness: 0.35, metalness: 0.2 }));
  edge.position.z = -0.06;
  paddle.add(edge);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.05, 18),
    new THREE.MeshStandardMaterial({ color: 0xe9f5f6, roughness: 0.6 }));
  grip.position.y = 0.13;
  paddle.add(grip);
  for (let y = -0.28; y < 0.56; y += 0.12) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.212, 0.016, 5, 18),
      new THREE.MeshStandardMaterial({ color: 0x06263d, roughness: 0.6 }));
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = y;
    paddle.add(wrap);
  }
  paddle.scale.setScalar(0.92);
  scene.add(paddle);

  // Contact ring and sparks, sold entirely by timing.
  const glow = new THREE.MeshBasicMaterial({ color: 0x9dffd0 });
  const sparks = Array.from({ length: 22 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.04 + (i % 3) * 0.018, 6, 5), glow);
    m.visible = false;
    scene.add(m);
    return m;
  });
  const trail = Array.from({ length: 7 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.34 - i * 0.03, 12, 9),
      new THREE.MeshBasicMaterial({ color: 0xc9fa35, transparent: true, opacity: 0.1, depthWrite: false }));
    m.visible = false;
    scene.add(m);
    return m;
  });

  let raf = 0, started = 0, playing = false, disposed = false, guard = 0;

  /** Where the ball sits at time t. Left of frame, struck, then at the lens. */
  function ballAt(t) {
    if (t < T.contact) {
      const f = out(clamp((t - T.paddleIn) / (T.contact - T.paddleIn), 0, 1));
      return new THREE.Vector3(-7.5 + f * 7.5, 3.4 - f * 3.4, -3 + f * 3);
    }
    const f = clamp((t - T.contact) / (T.rushEnd - T.contact), 0, 1);
    // Accelerating at the camera: most of the travel in the last third.
    return new THREE.Vector3(0, 0, f * f * 7.7);
  }

  function render(t) {
    if (disposed) return;
    root.dataset.t = t.toFixed(3);
    const w = innerWidth, h = innerHeight;

    // ── Act 1 and 2: the city ───────────────────────────────────────────────
    // Each plate fades up, drifts and pushes in — a still photograph held dead
    // still for a second reads as a stall, and the drift is what keeps it alive
    // next to everything moving around it.
    const bridgeIn = sm(T.bridgeIn, T.bridgeIn + 0.34, t);
    const bridgeGone = sm(T.bridgeOut - 0.26, T.bridgeOut, t);
    const vicIn = sm(T.vicIn, T.vicIn + 0.30, t);
    const vicGone = sm(T.vicOut - 0.24, T.vicOut, t);

    howrah.style.opacity = String(bridgeIn * (1 - bridgeGone));
    victoria.style.opacity = String(vicIn * (1 - vicGone));

    const bp = clamp((t - T.bridgeIn) / (T.bridgeOut - T.bridgeIn), 0, 1);
    const vp = clamp((t - T.vicIn) / (T.vicOut - T.vicIn), 0, 1);
    // Push in across the shot, and track a little the other way on each, so the
    // cut between them has some direction to it.
    howrahImg.style.transform =
    victoriaImg.style.transform =
      `translate(-50%,-50%) scale(${(1.20 - vp * 0.11).toFixed(4)}) translate(${(vp * -1.8).toFixed(2)}%, ${(vp * 0.9).toFixed(2)}%)`;

    // The starfield is backdrop for the empty frames only — over a daylight
    // photograph it reads as dust on the lens.
    const overPhoto = Math.max(howrah.style.opacity ? Number(howrah.style.opacity) : 0,
                               victoria.style.opacity ? Number(victoria.style.opacity) : 0);
    stars.style.opacity = String(0.5 * (1 - overPhoto) * (1 - sm(2.2, 2.7, t)));
    haze.style.opacity = String(0.5 + sm(T.paddleIn, T.contact, t) * 0.5);

    // ── Act 3 and 4: the shot ───────────────────────────────────────────────
    const pos = ballAt(t);
    ball.position.copy(pos);
    ball.rotation.set(t * 5.5, t * 7.2, -t * 2.6);
    const grow = t < T.contact ? 1 : 1 + sm(T.contact, T.rushEnd, t) * 3.1;
    // Squash for a couple of frames at contact, released immediately after.
    const squash = sm(T.contact - 0.03, T.contact, t) * (1 - sm(T.contact, T.contact + 0.12, t));
    ball.scale.set(grow * (1 - squash * 0.3), grow * (1 + squash * 0.2), grow * (1 + squash * 0.2));
    ball.visible = t >= T.paddleIn && t < T.rushEnd + 0.04;

    trail.forEach((m, i) => {
      m.visible = t > T.contact && t < T.rushEnd;
      if (!m.visible) return;
      m.position.copy(ballAt(t - (i + 1) * 0.022));
      m.scale.setScalar(grow * 0.9);
      m.material.opacity = 0.16 * (1 - i / trail.length);
    });

    // The paddle swings through from the right and exits after contact.
    const swing = clamp((t - T.paddleIn) / (T.contact - T.paddleIn), 0, 1);
    const past = clamp((t - T.contact) / 0.26, 0, 1);
    paddle.visible = t >= T.paddleIn && t < T.contact + 0.3;
    if (paddle.visible) {
      const s = out(swing);
      paddle.position.set(6.4 - s * 5.2 - past * 3.4, -3.6 + s * 3.0 - past * 1.2, -1 + s * 1);
      // Rotating through the ball, not stopping at it.
      paddle.rotation.set(-0.35 + s * 0.5, -0.9 + s * 0.9 + past * 1.1, 1.5 - s * 1.35 - past * 1.5);
      const fade = 1 - past;
      face.material.opacity = fade; edge.material.opacity = fade;
      face.material.transparent = past > 0; edge.material.transparent = past > 0;
    }

    const hit = sm(T.contact - 0.02, T.contact + 0.05, t) * (1 - sm(T.contact + 0.05, T.contact + 0.3, t));
    ring.style.opacity = String(hit * 0.9);
    if (hit > 0) {
      // Where the ball actually is on screen, not the middle of it.
      const at = ballAt(T.contact).project(camera);
      ring.style.left = `${((at.x + 1) / 2) * 100}%`;
      ring.style.top = `${((1 - at.y) / 2) * 100}%`;
    }
    ring.style.transform = `translate(-50%,-50%) scale(${(0.3 + hit * 2.4).toFixed(2)})`;

    sparks.forEach((m, i) => {
      const f = clamp((t - T.contact) / 0.4, 0, 1);
      m.visible = t > T.contact && f < 1;
      if (!m.visible) return;
      const a = i * 2.399;
      m.position.set(Math.cos(a) * f * 3.2, Math.sin(a) * f * 3.2 - f * f * 1.1, f * 1.6);
      m.scale.setScalar(Math.max(0.01, 1 - f));
    });

    // ── Act 5: the glass gives way ──────────────────────────────────────────
    const impact = sm(T.crackIn - 0.04, T.crackIn + 0.05, t) * (1 - sm(T.crackIn + 0.05, T.crackIn + 0.34, t));
    flash.style.opacity = String(impact * 0.92);

    const crackP = sm(T.crackIn, T.crackFull, t);
    crack.style.opacity = String(crackP > 0 ? 1 - sm(T.markSettled - 0.18, T.markSettled + 0.06, t) : 0);
    // The seams belong to an intact pane. Once it comes apart they go with it.
    const seams = 1 - clamp((t - T.shards) / 0.30, 0, 1);
    for (const { path } of crackSpokes) path.style.strokeOpacity = String(seams);
    for (const { path } of crackTies) path.style.strokeOpacity = String(seams);
    crackSpokes.forEach(({ path, len }, i) => {
      // Spokes race outward at slightly different speeds; glass is not uniform.
      const local = clamp((crackP - (i % 5) * 0.05) / 0.72, 0, 1);
      path.style.strokeDashoffset = String(len * (1 - out(local)));
    });
    // Ties appear once the spokes reaching them have passed, innermost first.
    crackTies.forEach(({ path, ring }) => {
      const at = 0.18 + ring * 0.22;
      path.style.opacity = String(clamp((crackP - at) / 0.2, 0, 1) * (ring === 0 ? 1 : 0.7));
    });

    // The fragments light up as the cracks reach them, hold for a beat, then
    // let go — drifting out along their own bearing, tipping, and dropping.
    // Inner pieces go first: that is the order a struck pane actually fails in.
    const fall = clamp((t - T.shards) / 0.44, 0, 1);
    shardEls.forEach(({ el, ring, dir, spin, lag }) => {
      const lit = clamp((crackP - ring * 0.14) / 0.3, 0, 1);
      const f = clamp((fall - (ring * 0.08 + lag * 0.1)) / 0.7, 0, 1);
      const ease = f * f;
      el.style.opacity = String(lit * (1 - f) * 0.13);
      // Outward drift plus gravity, in viewBox units so it tracks the artwork.
      const dx = Math.cos(dir) * f * 6 + (ring - 1) * f * 1.4;
      const dy = Math.sin(dir) * f * 4 + ease * 46;
      el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${(spin * f).toFixed(1)}deg)`;
      el.style.transformOrigin = '50px 50px';
      el.style.transformBox = 'view-box';
    });

    // A hot core at the point of impact, gone almost immediately.
    const coreLit = sm(T.crackIn - 0.03, T.crackIn + 0.04, t) * (1 - sm(T.crackIn + 0.04, T.crackIn + 0.26, t));
    core.setAttribute('opacity', String(coreLit));
    core.setAttribute('r', String(6 + coreLit * 16));

    // ── Act 6: the mark ─────────────────────────────────────────────────────
    // The logo alone, per the brief — no wordmark anywhere in this sequence.
    //
    // It arrives through the break rather than fading up: oversized and soft at
    // first, as if it were behind the glass, then snapping to its own size as
    // the fragments clear. A shine crosses it on landing and a ring carries the
    // energy outward, so the sequence ends on a beat instead of a dissolve.
    const raw = clamp((t - T.markIn) / (T.markSettled - T.markIn), 0, 1);
    const markP = sm(T.markIn, T.markIn + 0.14, t);
    const land = back(raw);
    const scale = 2.15 - land * 1.15;
    const blur = Math.max(0, (1 - raw * 2.6)) * 9;
    const tilt = (1 - out(raw)) * 22;

    mark.style.opacity = String(markP);
    mark.style.filter = `drop-shadow(0 14px 44px rgba(0,0,0,.6)) blur(${blur.toFixed(2)}px)`;
    markWrap.style.transform =
      `translate(-50%,-50%) perspective(1100px) rotateX(${tilt.toFixed(2)}deg) ` +
      `rotateZ(${((1 - out(raw)) * -7).toFixed(2)}deg) scale(${scale.toFixed(3)})`;

    // The sweep runs once, just after it lands.
    const sweep = clamp((t - (T.markIn + 0.16)) / 0.34, 0, 1);
    shine.style.opacity = String(sweep > 0 && sweep < 1 ? Math.sin(sweep * Math.PI) * 0.95 : 0);
    shine.style.backgroundPosition = `${(120 - sweep * 240).toFixed(1)}% 0`;

    // One ring out of the impact point as the mark seats.
    const ringP = clamp((t - (T.markIn + 0.08)) / 0.46, 0, 1);
    pulse.style.opacity = String(ringP > 0 && ringP < 1 ? (1 - ringP) * 0.55 : 0);
    pulse.style.transform = `translate(-50%,-50%) scale(${(0.25 + out(ringP) * 1.5).toFixed(3)})`;

    if (renderer) {
      camera.aspect = w / h;
      // A small shake on impact, gone within a fifth of a second.
      const shake = hit * 0.08 + impact * 0.05;
      camera.position.set(Math.sin(t * 83) * shake, Math.sin(t * 61) * shake, 9);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      renderer.domElement.style.opacity = String(1 - sm(T.rushEnd - 0.04, T.rushEnd + 0.06, t));
      // The canvas is only drawn during its own act, which also keeps the
      // monuments free of a stray ball and costs nothing while they play.
      renderer.domElement.style.visibility = t >= T.paddleIn && t < T.rushEnd + 0.1 ? 'visible' : 'hidden';
      if (t >= T.paddleIn && t < T.rushEnd + 0.1) renderer.render(scene, camera);
    }

    // Grain resamples every frame; a still grain plate reads as dirt on the lens.
    grain.style.transform = `translate(${((t * 97) % 7 - 3) * 12}px, ${((t * 131) % 5 - 2) * 14}px)`;

    root.style.display = t >= SPAN ? 'none' : 'block';
  }

  function stop() { cancelAnimationFrame(raf); clearTimeout(guard); playing = false; }
  function seek(t) { stop(); render(clamp(t, 0, SPAN)); }
  function finish() { stop(); render(SPAN); }

  function play() {
    stop();
    root.style.display = 'block';
    started = performance.now();
    playing = true;
    // Never leave the overlay up if a tab stalls mid-sequence.
    guard = setTimeout(finish, SPAN * 1000 + 250);
    const tick = now => {
      const t = (now - started) / 1000;
      render(t);
      if (t < SPAN && !disposed) raf = requestAnimationFrame(tick);
      else { playing = false; clearTimeout(guard); }
    };
    raf = requestAnimationFrame(tick);
  }

  function resize() {
    if (renderer) renderer.setSize(innerWidth, innerHeight);
    if (!playing) render(Number(root.dataset.t || 0));
  }

  function dispose() {
    stop();
    disposed = true;
    removeEventListener('resize', resize);
    removeEventListener('keydown', onKey);
    root.remove();
    scene.traverse(o => {
      o.geometry?.dispose?.();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      ms.forEach(m => m.dispose());
    });
    renderer?.dispose();
  }

  const onKey = e => { if (e.key === 'Escape') finish(); };
  addEventListener('resize', resize);
  addEventListener('keydown', onKey);
  skip.onclick = finish;

  const api = {
    play, seek, dispose, duration: SPAN,
    get playing() { return playing; },
    version: 'opening-1',
    mode: renderer ? 'threejs' : 'flat',
  };
  window.superproOpening = api;
  render(0);
  return api;
}

window.createSuperproOpening = createOpening;
