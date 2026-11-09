// Bassline 3D: a nightclub dance floor that lights up on the beat, a speaker for you, 3D creatures for the
// Silence, and weapons made of light. The game plays on a flat plane (x right, y down); here X = x, Y = -y, Z up.
// A tilted camera looks at it at the game's own zoom; the 2D canvas on top keeps the HUD and the damage
// numbers, placed through World3D.project.
import * as THREE from './three.module.min.js';

const H = window.BL3D;
const TAU = Math.PI * 2;
const FOV = 38, TILT = 34 * Math.PI / 180;

const glCanvas = document.getElementById('gl');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
if (!renderer || !H) dispatchEvent(new Event('world3dfail'));

if (renderer && H){
const lowEnd = (navigator.hardwareConcurrency || 4) <= 4 && matchMedia('(pointer: coarse)').matches;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;          // neon stays saturated

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07051a);
scene.fog = new THREE.Fog(0x07051a, 900, 2600);
const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 6000);
camera.up.set(0, 0, 1);
const col = c => new THREE.Color(c);

scene.add(new THREE.HemisphereLight(0x9a8cff, 0x140a30, .9));
const key = new THREE.DirectionalLight(0xffffff, 1.4); scene.add(key, key.target);
// the player is a light: the creatures nearest you glow cyan on their near side
const pLight = new THREE.PointLight(0x3df2ff, 0, 520, 1.6); scene.add(pLight);

const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.5)'); r.addColorStop(.6, 'rgba(255,255,255,.1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const addMat = () => new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const glowMat = () => new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

// ---------- the dance floor: lit tiles and a wave of light out from you on every beat ----------
const floorUni = { uP: { value: new THREE.Vector2() }, uPulse: { value: 0 }, uWave: { value: 9 }, uBar: { value: 0 }, uCol: { value: col(0x3df2ff) }, uCol2: { value: col(0xff3df2) }, uLow: { value: 0 } };
const floor = new THREE.Mesh(new THREE.PlaneGeometry(5200, 5200), new THREE.ShaderMaterial({
  uniforms: floorUni,
  vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xy; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `
    uniform vec2 uP; uniform float uPulse, uWave, uBar, uLow; uniform vec3 uCol, uCol2; varying vec2 vW;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 cell = floor(vW / 64.0), f = fract(vW / 64.0);
      vec2 e = min(f, 1.0 - f); float edge = min(e.x, e.y);
      float line = 1.0 - smoothstep(0.0, 0.035, edge);
      float tile = smoothstep(0.03, 0.09, edge);
      float d = length(vW - uP);
      float wave = exp(-pow((d - uWave * 900.0) / 70.0, 2.0)) * (1.0 - clamp(uWave, 0.0, 1.0));      // the ring of light out from you
      float r = h(cell + floor(uBar));                                                                // a few tiles lit each bar
      float lit = step(0.93, r) * (0.35 + 0.65 * uPulse);
      float near = exp(-d / 420.0);
      vec3 base = vec3(0.07, 0.05, 0.16) + mix(vec3(0.16, 0.06, 0.3), uCol * 0.3, near) * (0.35 + 0.65 * near) + vec3(0.05, 0.02, 0.1) * uPulse;
      vec3 c = base * tile;
      c += mix(uCol, uCol2, r) * lit * tile * 0.55;
      c += uCol * wave * tile * 0.7;
      c += vec3(0.45, 0.4, 1.0) * line * (0.18 + uPulse * 0.14 + wave * 0.6);
      c += uCol2 * uLow * 0.35 * (1.0 - near);                                                        // low health: the room glows red
      float fade = exp(-d / 2200.0);
      gl_FragColor = vec4(c * fade, 1.0);
    }`,
}));
floor.position.z = -1; scene.add(floor);

// ---------- you: a floating speaker cabinet; the woofer pumps on the beat ----------
const player = new THREE.Group(); scene.add(player);
{
  const cab = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 34), new THREE.MeshStandardMaterial({ color: 0x1a1630, roughness: .45, metalness: .4 })); cab.position.z = 17; player.add(cab);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(31.5, 31.5, 2), new THREE.MeshBasicMaterial({ color: 0x3df2ff, toneMapped: false })); trim.position.z = 34.5; player.add(trim);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xa46bff, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(11, 1.6, 10, 32), ringMat); ring.position.z = 34.8; player.add(ring);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(10, 5, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x0a0814, roughness: .7, side: THREE.DoubleSide })); cone.rotation.x = -Math.PI / 2; cone.position.z = 33; player.add(cone);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(4.4, 20, 12), new THREE.MeshBasicMaterial({ color: 0x3df2ff, toneMapped: false })); cap.position.z = 35; player.add(cap);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), glowMat()); halo.material.color.set(0x3df2ff); halo.material.opacity = .55; halo.position.z = 1; player.add(halo);
  const pick = new THREE.Mesh(new THREE.RingGeometry(.985, 1, 96), new THREE.MeshBasicMaterial({ color: 0xa08cff, transparent: true, opacity: .25, depthWrite: false, toneMapped: false })); pick.position.z = 1.5; player.add(pick);
  player.userData = { cab, trim, ring, cone, cap, halo, pick };
}

// ---------- the Silence: one instanced mesh per creature kind ----------
function bumpy(geo, amt, seed){ const g = geo.toNonIndexed ? geo : geo, p = g.attributes.position; let a = seed; const r = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; const m = new Map(); for (let i = 0; i < p.count; i++){ const k = `${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`; if (!m.has(k)) m.set(k, 1 + (r() - .5) * amt); const s = m.get(k); p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s); } g.computeVertexNormals(); return g; }
const CAP = { static: 360, glitch: 200, brick: 80, spitter: 60, boss: 4 };
const KIND = {
  static:  new THREE.SphereGeometry(1, 20, 14),                                         // a round blob
  glitch:  new THREE.BoxGeometry(1.7, 1.7, 1.7, 1, 1, 1),                               // a cube that jitters
  brick:   new THREE.CapsuleGeometry(.9, .7, 6, 12).rotateX(Math.PI / 2),                // a heavy capsule
  spitter: new THREE.ConeGeometry(1.2, 2.2, 5),                                         // a spiky pyramid
  boss:    bumpy(new THREE.IcosahedronGeometry(1, 2), .14, 7),                          // a lumpy giant
};
KIND.spitter.rotateX(Math.PI / 2);
const kindMat = () => {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .35, metalness: .1 });
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance += vColor * 0.42;\n#endif'); };
  return m;
};
const enemyMesh = {};
for (const k in KIND){ const m = new THREE.InstancedMesh(KIND[k], kindMat(), CAP[k]); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.setColorAt(0, col(0xffffff)); m.count = 0; scene.add(m); enemyMesh[k] = m; }
enemyMesh.glitch.material.flatShading = true; enemyMesh.spitter.material.flatShading = true; enemyMesh.boss.material.flatShading = true;
// eyes: two black spheres per creature, looking at you; bosses get red ones
const EYE_CAP = 1400;
const eyeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), EYE_CAP); eyeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); eyeMesh.frustumCulled = false; eyeMesh.setColorAt(0, col(0x07060f)); scene.add(eyeMesh);
// soft glows under every creature, and under gems and shots
const GLOW_CAP = 1200;
const glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowMat(), GLOW_CAP); glows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); glows.frustumCulled = false; glows.setColorAt(0, col(0xffffff)); glows.renderOrder = 1; scene.add(glows);
// gems: spinning crystals
const GEM_CAP = 300;
const gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), GEM_CAP); gemMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); gemMesh.frustumCulled = false; gemMesh.setColorAt(0, col(0xffffff)); scene.add(gemMesh);
// hearts
const heartShape = new THREE.Shape(); heartShape.moveTo(0, -.6); heartShape.bezierCurveTo(-1.2, .2, -.6, 1.1, 0, .45); heartShape.bezierCurveTo(.6, 1.1, 1.2, .2, 0, -.6);
const heartGeo = new THREE.ExtrudeGeometry(heartShape, { depth: .35, bevelEnabled: true, bevelThickness: .12, bevelSize: .1, bevelSegments: 2 }); heartGeo.center(); heartGeo.rotateX(Math.PI / 2);
const heartMesh = new THREE.InstancedMesh(heartGeo, new THREE.MeshStandardMaterial({ color: 0xff3d9e, emissive: 0xff1f7a, emissiveIntensity: .7, roughness: .3 }), 20); heartMesh.frustumCulled = false; heartMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(heartMesh);
// shots (snare bolts, hi-hat needles), enemy bullets, bass orbs: bright capsules and spheres
const SHOT_CAP = 400;
const shotMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.5, 2, 4, 8).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), SHOT_CAP); shotMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); shotMesh.frustumCulled = false; shotMesh.setColorAt(0, col(0xffffff)); scene.add(shotMesh);
const ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 320); ballMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ballMesh.frustumCulled = false; ballMesh.setColorAt(0, col(0xffffff)); scene.add(ballMesh);
// rings (kick, crash, level-up, getting hurt): flat glowing tori on the floor
const RING_CAP = 40;
const ringMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(1, .035, 6, 96), addMat(), RING_CAP); ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ringMesh.frustumCulled = false; ringMesh.setColorAt(0, col(0xffffff)); scene.add(ringMesh);
// laser beams: long thin glowing boxes
const BEAM_CAP = 30;
const beamMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), addMat(), BEAM_CAP); beamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); beamMesh.frustumCulled = false; beamMesh.setColorAt(0, col(0xffffff)); scene.add(beamMesh);
// sparks from kills
const PART_CAP = lowEnd ? 260 : 520;
const partMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), PART_CAP); partMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); partMesh.frustumCulled = false; partMesh.setColorAt(0, col(0xffffff)); scene.add(partMesh);

// ---------- the menu: a giant spinning record on the floor, and a speaker bobbing over it ----------
const record = new THREE.Group(); scene.add(record);
{
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .04, 96), new THREE.MeshStandardMaterial({ color: 0x0d0b18, roughness: .25, metalness: .6 })); disc.rotation.x = Math.PI / 2; record.add(disc);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .05, 64), new THREE.MeshBasicMaterial({ color: 0xff3df2, toneMapped: false })); label.rotation.x = Math.PI / 2; label.position.z = .005; record.add(label);
  for (let k = 1; k < 6; k++){ const g = new THREE.Mesh(new THREE.TorusGeometry(.42 + k * .1, .004, 4, 96), new THREE.MeshBasicMaterial({ color: 0x5a50a0, toneMapped: false })); g.position.z = .03; record.add(g); }
  const shine = new THREE.Mesh(new THREE.RingGeometry(.45, .95, 64, 1, 0, .9), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .14, depthWrite: false, toneMapped: false })); shine.position.z = .031; record.add(shine);
  record.userData.shine = shine;
}

// ---------- per frame ----------
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S3 = new THREE.Vector3(), E = new THREE.Euler(), TMP = new THREE.Color(), WHITE = col(0xffffff);
let lastNow = 0;
function render(now){
  const G = H.G, VW = innerWidth, VH = innerHeight, dpr = H.dpr, k = H.scale;
  if (!VW || !VH) return;
  const dt = Math.min(.05, Math.max(0, now - lastNow)); lastNow = now;
  governor(now);
  const pr = Math.min(dpr, Qs.maxRes), pw = Math.round(VW * pr), ph = Math.round(VH * pr);
  if (glCanvas.width !== pw || glCanvas.height !== ph){ renderer.setPixelRatio(pr); renderer.setSize(VW, VH, false); }

  // camera: the game's zoom at the point it looks at, leaning back by TILT
  let cx, cy, sh = 0;
  if (G){ cx = G.P.x; cy = G.P.y; sh = G.shake; cx += (Math.random() - .5) * sh / k; cy += (Math.random() - .5) * sh / k; }
  else { cx = now * 30; cy = 0; }
  const focal = (VH / 2) / Math.tan(FOV * Math.PI / 360), dist = focal / k;
  camera.aspect = VW / VH; camera.position.set(cx, -cy - dist * Math.sin(TILT), dist * Math.cos(TILT)); camera.lookAt(cx, -cy, 0); camera.near = dist * .05; camera.far = dist * 6; camera.updateProjectionMatrix();
  scene.fog.near = dist * 1.1; scene.fog.far = dist * 3.4;
  key.position.set(cx - 300, -cy + 500, 800); key.target.position.set(cx, -cy, 0);

  const pulse = G ? G.pulse : (Math.sin(now * 4.4) * .5 + .5) * .6;
  const tr = G ? G.tr : null, trCol = tr ? tr.color : '#3df2ff';
  floor.position.set(Math.round(cx / 64) * 64, -Math.round(cy / 64) * 64, -1);
  floorUni.uP.value.set(G ? G.P.x : cx, G ? -G.P.y : -cy);
  floorUni.uPulse.value = pulse; floorUni.uCol.value.set(trCol); floorUni.uBar.value = G ? Math.floor(G.step / 16) : Math.floor(now * 1.8);
  // a wave of light out from you on each beat: restart when the pulse jumps
  if (pulse > .95 && floorUni.uWave.value > .3) floorUni.uWave.value = 0;
  floorUni.uWave.value += dt * 1.6;
  floorUni.uLow.value += (((G && G.P.hp / H.maxHp() < .3) ? .6 + pulse * .4 : 0) - floorUni.uLow.value) * Math.min(1, dt * 6);

  record.visible = !G; player.visible = !!G || true;
  let ng = 0, nb = 0, ns = 0, np = 0;
  const glowAt = (x, y, z, s, c, a = 1) => { if (ng >= GLOW_CAP) return; M4.compose(V.set(x, -y, z), Q.identity(), S3.set(s, s, s)); glows.setMatrixAt(ng, M4); glows.setColorAt(ng, TMP.set(c).multiplyScalar(a)); ng++; };

  if (!G){
    // the menu: a big record spinning under a bobbing speaker
    const R = 260; record.position.set(cx + 380, -cy - 40, 0); record.scale.set(R, R, R); record.rotation.z = -now * 1.4; record.userData.shine.rotation.z = now * 1.4 + .6;
    player.position.set(cx - 120, -cy + 40, 10 + Math.sin(now * 3) * 6); player.rotation.set(0, 0, Math.sin(now * .7) * .3);
    pLight.intensity = 0;
    for (const m of Object.values(enemyMesh)) m.count = 0;
    eyeMesh.count = gemMesh.count = shotMesh.count = ballMesh.count = ringMesh.count = beamMesh.count = partMesh.count = heartMesh.count = 0;
    glows.count = 0; glows.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera); return;
  }

  const P = G.P, hurtFlash = P.inv > 0 && Math.floor(P.inv * 20) % 2;
  // you
  const pu = player.userData, bob = Math.sin(G.t * 6) * 2;
  player.position.set(P.x, -P.y, 6 + bob); player.rotation.set(-P.fy * .15, P.fx * .15, 0); player.scale.setScalar(1.3);
  const cs = 1 + pulse * .1; pu.cab.scale.set(cs, cs, 1 + pulse * .06);
  pu.cone.position.z = 33 + pulse * 3; pu.cap.position.z = 35 + pulse * 3.5; pu.cap.scale.setScalar(1 + pulse * .5);
  const pc = hurtFlash ? 0xff3d71 : 0x3df2ff; pu.trim.material.color.set(pc); pu.cap.material.color.set(pc); pu.halo.material.color.set(pc);
  pu.halo.scale.setScalar(1 + pulse * .3); pu.halo.material.opacity = .45 + pulse * .25;
  const mr = H.magnetR() * .75; pu.pick.scale.set(mr, mr, 1); pu.pick.material.opacity = .14 + pulse * .1; pu.pick.position.z = 1.5 - player.position.z;
  pLight.position.set(P.x, -P.y, 60); pLight.intensity = 1.3e4 * (1 + pulse * .6); pLight.color.set(pc);

  // the Silence
  const L = P.x - VW / k, R = P.x + VW / k, T = P.y - VH / k * 1.6, B = P.y + VH / k;
  const cnt = { static: 0, glitch: 0, brick: 0, spitter: 0, boss: 0 }; let ne = 0;
  const bounce = 1 + pulse * .14;
  for (const e of G.enemies){
    if (e.x < L || e.x > R || e.y < T || e.y > B) continue;
    const m = enemyMesh[e.kind], i = cnt[e.kind]; if (i >= CAP[e.kind]) continue; cnt[e.kind]++;
    const r = e.r, sq = 1 + (pulse - .5) * .12;                                     // squash and stretch on the beat
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1, face = Math.atan2(-dy, dx);
    let rx = 0, ry = 0, rz = face, z = r * .95 * bounce;
    if (e.kind === 'glitch'){ rx = Math.sin(e.wob + G.t * 9) * .4; ry = Math.cos(e.wob * 1.3 + G.t * 7) * .4; z += Math.abs(Math.sin(G.t * 12 + e.wob)) * 4; }
    if (e.kind === 'spitter'){ rz = face + Math.PI / 2; }
    if (e.kind === 'boss'){ rx = Math.sin(G.t * .7) * .2; ry = G.t * .4; }
    E.set(rx, ry, rz); Q.setFromEuler(E);
    M4.compose(V.set(e.x, -e.y, z), Q, S3.set(r * bounce / sq, r * bounce / sq, r * bounce * sq));
    m.setMatrixAt(i, M4); m.setColorAt(i, e.flash > 0 ? WHITE : TMP.set(e.color));
    glowAt(e.x, e.y, 1, r * (e.boss ? 8 : 5.2), e.color, e.elite || e.boss ? 1.1 : .75);
    // eyes look at you (on the side facing the camera, so they're always visible)
    if (ne < EYE_CAP - 2){
      const ex = dx / d, ey = dy / d, er = Math.max(1.6, r * .17), off = r * .32;
      for (const s of [-1, 1]){
        const px = e.x + ex * r * .3 - ey * off * s, py = e.y + ey * r * .3 + ex * off * s + r * .68;
        M4.compose(V.set(px, -py, z + r * .62), Q.identity(), S3.set(er, er, er)); eyeMesh.setMatrixAt(ne, M4); eyeMesh.setColorAt(ne, TMP.set(e.boss ? 0xff3d71 : 0x07060f)); ne++;
      }
    }
  }
  for (const k2 in cnt){ const m = enemyMesh[k2]; m.count = cnt[k2]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  eyeMesh.count = ne; eyeMesh.instanceMatrix.needsUpdate = true; if (eyeMesh.instanceColor) eyeMesh.instanceColor.needsUpdate = true;

  // gems and hearts
  let gi = 0, hi = 0;
  for (const g of G.gems){
    if (g.x < L || g.x > R || g.y < T || g.y > B) continue;
    if (g.heal){ if (hi < 20){ E.set(0, 0, G.t * 2); Q.setFromEuler(E); M4.compose(V.set(g.x, -g.y, 12 + Math.sin(G.t * 4 + g.x) * 3), Q, S3.set(10, 10, 10)); heartMesh.setMatrixAt(hi++, M4); glowAt(g.x, g.y, 1, 46, '#ff3d9e', .7); } continue; }
    if (gi >= GEM_CAP) continue;
    const c = g.v >= 20 ? '#ff3df2' : g.v >= 4 ? '#ffe14d' : '#3df2ff', z = g.v >= 20 ? 8 : g.v >= 4 ? 6 : 4.5;
    E.set(0, 0, G.t * 3 + g.x * .1); Q.setFromEuler(E); M4.compose(V.set(g.x, -g.y, z * 1.6 + Math.sin(G.t * 5 + g.y) * 1.5), Q, S3.set(z * .75, z * .75, z * 1.15));
    gemMesh.setMatrixAt(gi, M4); gemMesh.setColorAt(gi, TMP.set(c)); gi++;
    glowAt(g.x, g.y, 1, z * 6, c, .55);
  }
  gemMesh.count = gi; gemMesh.instanceMatrix.needsUpdate = true; if (gemMesh.instanceColor) gemMesh.instanceColor.needsUpdate = true;
  heartMesh.count = hi; heartMesh.instanceMatrix.needsUpdate = true;

  // shots: bright capsules along their travel
  for (const s of G.shots){
    if (ns >= SHOT_CAP) break;
    const a = Math.atan2(-s.vy, s.vx); E.set(0, 0, a); Q.setFromEuler(E);
    M4.compose(V.set(s.x, -s.y, 14), Q, S3.set(s.r * 1.4, s.r * .9, s.r * .9)); shotMesh.setMatrixAt(ns, M4); shotMesh.setColorAt(ns, TMP.set(s.c)); ns++;
    glowAt(s.x, s.y, 2, s.r * 7, s.c, .8);
  }
  shotMesh.count = ns; shotMesh.instanceMatrix.needsUpdate = true; if (shotMesh.instanceColor) shotMesh.instanceColor.needsUpdate = true;
  // enemy bullets and bass orbs
  for (const f of G.foes){ if (nb >= 320) break; M4.compose(V.set(f.x, -f.y, 14), Q.identity(), S3.set(f.r, f.r, f.r)); ballMesh.setMatrixAt(nb, M4); ballMesh.setColorAt(nb, TMP.set(0xff3d71)); nb++; glowAt(f.x, f.y, 2, f.r * 6, '#ff3d71', .8); }
  const orbs = H.orbs();
  for (const o of orbs){ if (nb >= 320) break; M4.compose(V.set(o.x, -o.y, 18), Q.identity(), S3.set(o.r, o.r, o.r)); ballMesh.setMatrixAt(nb, M4); ballMesh.setColorAt(nb, TMP.set(0xff3df2)); nb++; glowAt(o.x, o.y, 2, o.r * 6, '#ff3df2', .9); }
  ballMesh.count = nb; ballMesh.instanceMatrix.needsUpdate = true; if (ballMesh.instanceColor) ballMesh.instanceColor.needsUpdate = true;

  // rings on the floor
  let ri = 0;
  for (const r of G.rings){
    if (ri >= RING_CAP) break;
    const thick = (r.thick ? 2.4 : 1.2) * Math.max(.25, r.life);
    M4.compose(V.set(r.x, -r.y, 4), Q.identity(), S3.set(r.r, r.r, r.r * thick)); ringMesh.setMatrixAt(ri, M4); ringMesh.setColorAt(ri, TMP.set(r.c).multiplyScalar(Math.max(0, r.life) * (r.thick ? 1.4 : 1.1))); ri++;
  }
  ringMesh.count = ri; ringMesh.instanceMatrix.needsUpdate = true; if (ringMesh.instanceColor) ringMesh.instanceColor.needsUpdate = true;
  // beams
  let bi = 0;
  for (const b of G.beams){
    if (bi >= BEAM_CAP) break;
    const dx = b.ex - b.x, dy = b.ey - b.y, len = Math.hypot(dx, dy), k2 = b.life / .16;
    E.set(0, 0, Math.atan2(-dy, dx)); Q.setFromEuler(E);
    M4.compose(V.set((b.x + b.ex) / 2, -(b.y + b.ey) / 2, 16), Q, S3.set(len, b.w * k2 + 3, b.w * k2 * .5 + 2)); beamMesh.setMatrixAt(bi, M4); beamMesh.setColorAt(bi, TMP.set(b.c).multiplyScalar(1.4 * k2)); bi++;
  }
  beamMesh.count = bi; beamMesh.instanceMatrix.needsUpdate = true; if (beamMesh.instanceColor) beamMesh.instanceColor.needsUpdate = true;
  // sparks
  for (const p of G.parts){
    if (np >= PART_CAP) break;
    const s = p.s * Math.min(1, p.life * 2.5) * 1.3; E.set(p.x * .1 + G.t * 6, p.y * .1, 0); Q.setFromEuler(E);
    M4.compose(V.set(p.x, -p.y, 10 + p.life * 30), Q, S3.set(s, s, s)); partMesh.setMatrixAt(np, M4); partMesh.setColorAt(np, TMP.set(p.c)); np++;
  }
  partMesh.count = np; partMesh.instanceMatrix.needsUpdate = true; if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;

  glows.count = ng; glows.instanceMatrix.needsUpdate = true; if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
  renderer.render(scene, camera);
}

// world to screen, for the 2D overlay (damage numbers, the health bar, the boss bar)
const PV = new THREE.Vector3();
function project(x, y, z = 0){ PV.set(x, -y, z).project(camera); return { x: (PV.x + 1) / 2 * innerWidth, y: (1 - PV.y) / 2 * innerHeight }; }

// ---------- quality: step down automatically when frames run slow ----------
const Qs = { level: 0, maxRes: 2, ema: 16.7, last: 0, slowFor: 0 };
function setQuality(l){ Qs.level = l; Qs.maxRes = [2, 1.5, 1.25, 1][l]; pLight.visible = l < 3; }
if (/[?&]lowgfx(&|=|$)/.test(location.search)) setQuality(3); else if (lowEnd) setQuality(1);
function governor(now){
  const dt = (now - Qs.last) * 1000; Qs.last = now;
  if (dt <= 0 || dt > 200 || document.hidden) return;
  Qs.ema += (dt - Qs.ema) * .05;
  Qs.slowFor = Qs.ema > 22 ? Qs.slowFor + dt : 0;
  if (Qs.slowFor > 2000 && Qs.level < 3){ setQuality(Qs.level + 1); Qs.slowFor = 0; Qs.ema = 16.7; }
}

glCanvas.addEventListener('webglcontextlost', e => { e.preventDefault(); window.World3D = null; glCanvas.style.display = 'none'; dispatchEvent(new Event('world3dfail')); });
window.World3D = { ok: true, render, project, scene, camera, Q: Qs, setQuality };
dispatchEvent(new Event('world3d'));
}
