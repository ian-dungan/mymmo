if (typeof window.pc === 'undefined') {
  throw new Error('PlayCanvas engine failed to load. Please verify the CDN URL.');
}

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
app.scene.exposure = 1.1;
app.scene.skyboxMip = 2;
app.scene.ambientLight = new pc.Color(0.25, 0.28, 0.35);

// Player entity (camera)
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
  clearColor: new pc.Color(0.13, 0.18, 0.26),
  fov: 70,
});
app.root.addChild(camera);

// Light
const light = new pc.Entity('sun');
light.addComponent('light', {
  type: 'directional',
  color: new pc.Color(1, 0.98, 0.93),
  intensity: 2.1,
  castShadows: true,
  shadowDistance: 200,
  shadowResolution: 1024,
});
light.setLocalEulerAngles(55, 35, 0);
app.root.addChild(light);

// Materials
function makeMaterial(color, metalness = 0, roughness = 0.65) {
  const material = new pc.StandardMaterial();
  material.diffuse = color.clone();
  material.metalness = metalness;
  material.useMetalness = true;
  material.roughness = roughness;
  material.update();
  return material;
}

const palette = {
  sand: new pc.Color(0.63, 0.58, 0.48),
  stone: new pc.Color(0.52, 0.5, 0.46),
  plaster: new pc.Color(0.74, 0.72, 0.66),
  roof: new pc.Color(0.33, 0.18, 0.16),
  water: new pc.Color(0.17, 0.36, 0.52),
  wood: new pc.Color(0.43, 0.28, 0.18),
};

// Helpers for spawning primitives
function addBox(name, size, position, material) {
  const entity = new pc.Entity(name);
  entity.addComponent('model', { type: 'box' });
  entity.setLocalScale(size.x, size.y, size.z);
  entity.setLocalPosition(position.x, position.y, position.z);
  entity.model.material = material;
  app.root.addChild(entity);
  return entity;
}

function addCylinder(name, radius, height, position, material) {
  const entity = new pc.Entity(name);
  entity.addComponent('model', { type: 'cylinder' });
  entity.setLocalScale(radius, height, radius);
  entity.setLocalPosition(position.x, position.y, position.z);
  entity.model.material = material;
  app.root.addChild(entity);
  return entity;
}

function addPlane(name, size, position, material) {
  const entity = new pc.Entity(name);
  entity.addComponent('model', { type: 'plane' });
  entity.setLocalScale(size.x, 1, size.z);
  entity.setLocalPosition(position.x, position.y, position.z);
  entity.model.material = material;
  app.root.addChild(entity);
  return entity;
}

// Build the Freeport-inspired zone
function buildFreeportLanding() {
  // Ground and harbor water
  addPlane('ground', new pc.Vec3(280, 1, 280), new pc.Vec3(0, 0, 0), makeMaterial(palette.sand, 0, 0.9));
  const water = addPlane('harbor-water', new pc.Vec3(200, 1, 160), new pc.Vec3(120, -0.3, 80), makeMaterial(palette.water, 0.1, 0.4));
  water.model.castShadows = false;

  // City walls
  const wallMat = makeMaterial(palette.stone, 0, 0.7);
  const wallHeight = 12;
  const wallThickness = 4;
  const extent = 120;
  addBox('north-wall', new pc.Vec3(extent * 2, wallHeight, wallThickness), new pc.Vec3(0, wallHeight / 2, -extent), wallMat);
  addBox('south-wall', new pc.Vec3(extent * 2, wallHeight, wallThickness), new pc.Vec3(0, wallHeight / 2, extent), wallMat);
  addBox('west-wall', new pc.Vec3(wallThickness, wallHeight, extent * 2), new pc.Vec3(-extent, wallHeight / 2, 0), wallMat);

  // Gate and watchtowers facing the harbor
  addBox('gate', new pc.Vec3(18, wallHeight * 0.75, wallThickness), new pc.Vec3(extent, wallHeight * 0.75 * 0.5, 10), wallMat);
  addCylinder('north-tower', 6, 18, new pc.Vec3(extent - 8, 9, -extent + 8), makeMaterial(palette.plaster, 0, 0.6));
  addCylinder('south-tower', 6, 18, new pc.Vec3(extent - 8, 9, extent - 8), makeMaterial(palette.plaster, 0, 0.6));

  // Docks and pier
  const dockMat = makeMaterial(palette.wood, 0.05, 0.65);
  addBox('main-dock', new pc.Vec3(60, 1.2, 12), new pc.Vec3(extent + 24, 0.6, 24), dockMat);
  addBox('pier-a', new pc.Vec3(10, 1, 40), new pc.Vec3(extent + 40, 0.5, 44), dockMat);
  addBox('pier-b', new pc.Vec3(10, 1, 40), new pc.Vec3(extent + 8, 0.5, 44), dockMat);

  // Central plaza
  addPlane('plaza', new pc.Vec3(80, 1, 80), new pc.Vec3(-20, 0.05, 10), makeMaterial(palette.plaster, 0, 0.95));
  addCylinder('plaza-statue', 3.4, 10, new pc.Vec3(-20, 5, 10), makeMaterial(palette.roof, 0.15, 0.4));

  // Inns and market stalls
  const houseMat = makeMaterial(palette.plaster, 0, 0.82);
  const roofMat = makeMaterial(palette.roof, 0, 0.55);
  const homes = [
    { pos: new pc.Vec3(-40, 3, -10), size: new pc.Vec3(16, 6, 14) },
    { pos: new pc.Vec3(-68, 3, 30), size: new pc.Vec3(18, 6, 16) },
    { pos: new pc.Vec3(10, 3, -34), size: new pc.Vec3(20, 7, 16) },
    { pos: new pc.Vec3(30, 3, 30), size: new pc.Vec3(22, 7, 16) },
  ];
  homes.forEach((home, i) => {
    const base = addBox(`home-${i}`, home.size, home.pos, houseMat);
    addBox(`home-${i}-roof`, new pc.Vec3(home.size.x * 1.05, home.size.y * 0.3, home.size.z * 1.05), new pc.Vec3(home.pos.x, home.pos.y + home.size.y * 0.6, home.pos.z), roofMat);
    base.model.castShadows = true;
  });

  // Hall and barracks near the gate
  addBox('hall', new pc.Vec3(32, 10, 18), new pc.Vec3(60, 5, -20), houseMat);
  addBox('hall-roof', new pc.Vec3(34, 3, 20), new pc.Vec3(60, 11.5, -20), roofMat);
  addBox('barracks', new pc.Vec3(28, 8, 14), new pc.Vec3(40, 4, 24), houseMat);
  addBox('barracks-roof', new pc.Vec3(30, 2.5, 16), new pc.Vec3(40, 9, 24), roofMat);

  // Pathways
  const pathMat = makeMaterial(new pc.Color(0.46, 0.43, 0.38), 0, 0.95);
  addPlane('main-road', new pc.Vec3(20, 1, 200), new pc.Vec3(60, 0.04, 0), pathMat);
  addPlane('plaza-road', new pc.Vec3(60, 1, 16), new pc.Vec3(0, 0.04, 0), pathMat);
  addPlane('plaza-road-west', new pc.Vec3(16, 1, 80), new pc.Vec3(-40, 0.04, 10), pathMat);
}

buildFreeportLanding();

// Player movement handling
const moveSpeed = 10;
const sprintMultiplier = 1.8;
const rotSpeed = 0.0022;
let yaw = 0;
let pitch = -0.1;
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

camera.setLocalPosition(-120, 5.5, 0);
camera.setLocalEulerAngles(pc.math.radToDeg(pitch), pc.math.radToDeg(yaw), 0);

// UI helpers
const posLabel = document.getElementById('playerPos');
function updateHud() {
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
  updateHud();
});

updateHud();
app.start();
