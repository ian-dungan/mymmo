const canvas = document.getElementById('application-canvas');
const app = new pc.Application(canvas, {
  mouse: new pc.Mouse(canvas),
  touch: new pc.TouchDevice(canvas),
});

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
window.addEventListener('resize', () => app.resizeCanvas());

// Basic rendering setup
app.scene.gammaCorrection = pc.GAMMA_SRGB;
app.scene.toneMapping = pc.TONEMAP_ACES;
app.scene.exposure = 1.2;
app.scene.skyboxMip = 2;

// Player entity (camera)
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
  clearColor: new pc.Color(0.02, 0.04, 0.08),
  fov: 70,
});
app.root.addChild(camera);

// Light
const light = new pc.Entity('sun');
light.addComponent('light', {
  type: 'directional',
  color: new pc.Color(1, 0.97, 0.9),
  intensity: 2.4,
  castShadows: true,
  shadowDistance: 200,
  shadowResolution: 1024,
});
light.setLocalEulerAngles(55, 45, 0);
app.root.addChild(light);

// Ground chunk system
const CHUNK_SIZE = 140;
const VIEW_RADIUS = 1; // load surrounding chunks in a 3x3 grid
const chunkStore = new Map();
const chunkColor = new pc.Color(0.17, 0.35, 0.23);
const accentColor = new pc.Color(0.23, 0.44, 0.62);

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function createChunkEntity(cx, cz) {
  const chunk = new pc.Entity(`chunk-${cx}-${cz}`);
  chunk.addComponent('model', { type: 'plane' });
  chunk.setLocalScale(CHUNK_SIZE, 1, CHUNK_SIZE);
  chunk.setLocalPosition(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);

  // subtle color tint via a basic material
  const material = new pc.StandardMaterial();
  material.diffuse = chunkColor.clone();
  material.ambient = chunkColor.clone();
  material.update();
  chunk.model.material = material;

  // Add a few decorative pillars so streaming is visible
  const pillarCount = 5;
  for (let i = 0; i < pillarCount; i++) {
    const pillar = new pc.Entity(`pillar-${i}`);
    pillar.addComponent('model', { type: 'box' });

    const px = (Math.random() - 0.5) * (CHUNK_SIZE * 0.7);
    const pz = (Math.random() - 0.5) * (CHUNK_SIZE * 0.7);
    const height = 4 + Math.random() * 12;

    pillar.setLocalScale(2 + Math.random() * 2, height, 2 + Math.random() * 2);
    pillar.setLocalPosition(px, height / 2, pz);

    const pillarMat = new pc.StandardMaterial();
    pillarMat.diffuse = accentColor.clone();
    pillarMat.ambient = accentColor.clone();
    pillarMat.metalness = 0.05;
    pillarMat.useMetalness = true;
    pillarMat.update();

    pillar.model.material = pillarMat;
    chunk.addChild(pillar);
  }

  return chunk;
}

function ensureChunksAround(position) {
  const cx = Math.floor(position.x / CHUNK_SIZE);
  const cz = Math.floor(position.z / CHUNK_SIZE);

  for (let x = cx - VIEW_RADIUS; x <= cx + VIEW_RADIUS; x++) {
    for (let z = cz - VIEW_RADIUS; z <= cz + VIEW_RADIUS; z++) {
      const key = chunkKey(x, z);
      if (!chunkStore.has(key)) {
        const chunk = createChunkEntity(x, z);
        chunkStore.set(key, chunk);
        app.root.addChild(chunk);
      }
    }
  }

  // prune far chunks
  for (const [key, chunk] of chunkStore.entries()) {
    const [x, z] = key.split(',').map(Number);
    if (Math.abs(x - cx) > VIEW_RADIUS || Math.abs(z - cz) > VIEW_RADIUS) {
      chunk.destroy();
      chunkStore.delete(key);
    }
  }
}

// Player movement handling
const moveSpeed = 10;
const sprintMultiplier = 1.8;
const rotSpeed = 0.0022;
let yaw = 0;
let pitch = 0;
const velocity = new pc.Vec3();
const direction = new pc.Vec3();

const keys = { w: false, a: false, s: false, d: false, shift: false };
window.addEventListener('keydown', (e) => {
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
});
window.addEventListener('keyup', (e) => {
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
});

// Pointer lock for mouselook
canvas.addEventListener('click', () => {
  if (!document.pointerLockElement) {
    canvas.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  app.mouse.enabled = locked;
});

app.mouse.on(pc.EVENT_MOUSEMOVE, (e) => {
  if (!document.pointerLockElement) return;
  yaw -= e.dx * rotSpeed;
  pitch -= e.dy * rotSpeed;
  pitch = pc.math.clamp(pitch, -1.2, 1.2);
});

camera.setLocalPosition(0, 6, 10);
yaw = 0;
pitch = -0.1;

// UI helpers
const chunkLabel = document.getElementById('chunkCount');
const posLabel = document.getElementById('playerPos');
function updateHud() {
  chunkLabel.textContent = `${chunkStore.size}`;
  const p = camera.getPosition();
  posLabel.textContent = `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
}

app.on('update', (dt) => {
  // build local basis
  const forward = camera.forward.clone();
  forward.y = 0;
  forward.normalize();
  const right = camera.right.clone();
  right.y = 0;
  right.normalize();

  direction.set(0, 0, 0);
  if (keys.w) direction.add(forward);
  if (keys.s) direction.sub(forward);
  if (keys.a) direction.sub(right);
  if (keys.d) direction.add(right);
  if (direction.lengthSq() > 0) direction.normalize();

  const speed = keys.shift ? moveSpeed * sprintMultiplier : moveSpeed;
  velocity.copy(direction).scale(speed * dt);

  camera.translate(velocity);
  camera.setLocalEulerAngles(pc.math.radToDeg(pitch), pc.math.radToDeg(yaw), 0);

  ensureChunksAround(camera.getPosition());
  updateHud();
});

ensureChunksAround(camera.getPosition());
updateHud();
app.start();
