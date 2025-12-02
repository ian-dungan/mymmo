# Full Source Listings

Copy-paste these into fresh files to restore the working prototype.

---
## index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Freeport Landing - PlayCanvas</title>
  <link
    rel="icon"
    href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%2313181a'/%3E%3Cpath d='M12 48L32 12l20 36H12z' fill='%23d7c38a'/%3E%3Cpath d='M24 40h16l-8-14-8 14z' fill='%23335c85'/%3E%3C/svg%3E"
  />
  <link rel="stylesheet" href="styles.css" />
  <script src="https://code.playcanvas.com/playcanvas-stable.min.js"></script>
</head>
<body>
  <div class="hud">
    <h1>Freeport Landing (Prototype)</h1>
    <p>Click the canvas to lock the mouse. Use WASD + mouse, a gamepad, or touch controls to move. Shift/RB/south button to sprint.</p>
    <p class="stats">Zone: Freeport · Position <span id="playerPos">0,0,0</span></p>
  </div>
  <div class="touch-ui">
    <div id="move-joystick" class="joystick"><div class="joystick-handle"></div></div>
    <div id="look-joystick" class="joystick"><div class="joystick-handle"></div></div>
  </div>
  <canvas id="application-canvas"></canvas>
  <script src="scripts/main.js"></script>
</body>
</html>
```

---
## styles.css
```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #e7f0ff;
  background: radial-gradient(circle at 25% 25%, #0f172a 0%, #0b1022 45%, #050814 100%);
  overflow: hidden;
}

canvas {
  width: 100vw;
  height: 100vh;
  display: block;
}

.hud {
  position: fixed;
  top: 16px;
  left: 16px;
  background: rgba(6, 12, 24, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 12px 16px;
  max-width: 420px;
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.hud h1 {
  margin: 0 0 8px 0;
  font-size: 18px;
  letter-spacing: 0.5px;
}

.hud p {
  margin: 0 0 6px 0;
  line-height: 1.4;
  color: #c7d4eb;
}

.stats {
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 13px;
}

.touch-ui {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.joystick {
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.08);
  pointer-events: auto;
  touch-action: none;
}

#move-joystick {
  left: 20px;
  bottom: 20px;
}

#look-joystick {
  right: 20px;
  bottom: 20px;
}

.joystick-handle {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

@media (max-width: 600px) {
  .hud {
    max-width: calc(100vw - 32px);
  }
}
```

---
## scripts/main.js
```javascript
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
const colliders = [];

function registerBoxCollider(position, size, padding = 0.6) {
  colliders.push({
    center: position.clone(),
    halfExtents: new pc.Vec3(size.x * 0.5, size.y * 0.5, size.z * 0.5),
    padding,
  });
}

function addBox(name, size, position, material, withCollider = false) {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type: 'box' });
  entity.setLocalScale(size.x, size.y, size.z);
  entity.setLocalPosition(position.x, position.y, position.z);
  entity.render.material = material;
  app.root.addChild(entity);
  if (withCollider) registerBoxCollider(position, size);
  return entity;
}

function addCylinder(name, radius, height, position, material, withCollider = false) {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type: 'cylinder' });
  entity.setLocalScale(radius, height, radius);
  entity.setLocalPosition(position.x, position.y, position.z);
  entity.render.material = material;
  app.root.addChild(entity);
  if (withCollider)
    registerBoxCollider(position, new pc.Vec3(radius * 2, height, radius * 2), 0.4);
  return entity;
}

function addPlane(name, size, position, material, withCollider = false) {
  const entity = new pc.Entity(name);
  entity.addComponent('render', { type: 'plane' });
  entity.setLocalScale(size.x, 1, size.z);
  entity.setLocalPosition(position.x, position.y, position.z);
  entity.render.material = material;
  app.root.addChild(entity);
  if (withCollider) registerBoxCollider(position, size, 0.2);
  return entity;
}

// Build the Freeport-inspired zone
function buildFreeportLanding() {
  // Ground and harbor water
  addPlane('ground', new pc.Vec3(280, 1, 280), new pc.Vec3(0, 0, 0), makeMaterial(palette.sand, 0, 0.9));
  const water = addPlane('harbor-water', new pc.Vec3(200, 1, 160), new pc.Vec3(120, -0.3, 80), makeMaterial(palette.water, 0.1, 0.4));
  water.render.castShadows = false;

  // City walls
  const wallMat = makeMaterial(palette.stone, 0, 0.7);
  const wallHeight = 12;
  const wallThickness = 4;
  const extent = 120;
  addBox('north-wall', new pc.Vec3(extent * 2, wallHeight, wallThickness), new pc.Vec3(0, wallHeight / 2, -extent), wallMat, true);
  addBox('south-wall', new pc.Vec3(extent * 2, wallHeight, wallThickness), new pc.Vec3(0, wallHeight / 2, extent), wallMat, true);
  addBox('west-wall', new pc.Vec3(wallThickness, wallHeight, extent * 2), new pc.Vec3(-extent, wallHeight / 2, 0), wallMat, true);

  // Gate and watchtowers facing the harbor
  addBox('gate', new pc.Vec3(18, wallHeight * 0.75, wallThickness), new pc.Vec3(extent, wallHeight * 0.75 * 0.5, 10), wallMat, true);
  addCylinder('north-tower', 6, 18, new pc.Vec3(extent - 8, 9, -extent + 8), makeMaterial(palette.plaster, 0, 0.6), true);
  addCylinder('south-tower', 6, 18, new pc.Vec3(extent - 8, 9, extent - 8), makeMaterial(palette.plaster, 0, 0.6), true);

  // Docks and pier
  const dockMat = makeMaterial(palette.wood, 0.05, 0.65);
  addBox('main-dock', new pc.Vec3(60, 1.2, 12), new pc.Vec3(extent + 24, 0.6, 24), dockMat, true);
  addBox('pier-a', new pc.Vec3(10, 1, 40), new pc.Vec3(extent + 40, 0.5, 44), dockMat, true);
  addBox('pier-b', new pc.Vec3(10, 1, 40), new pc.Vec3(extent + 8, 0.5, 44), dockMat, true);

  // Central plaza
  addPlane('plaza', new pc.Vec3(80, 1, 80), new pc.Vec3(-20, 0.05, 10), makeMaterial(palette.plaster, 0, 0.95));
  addCylinder('plaza-statue', 3.4, 10, new pc.Vec3(-20, 5, 10), makeMaterial(palette.roof, 0.15, 0.4), true);

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
    const base = addBox(`home-${i}`, home.size, home.pos, houseMat, true);
    addBox(`home-${i}-roof`, new pc.Vec3(home.size.x * 1.05, home.size.y * 0.3, home.size.z * 1.05), new pc.Vec3(home.pos.x, home.pos.y + home.size.y * 0.6, home.pos.z), roofMat);
    base.render.castShadows = true;
  });

  // Hall and barracks near the gate
  addBox('hall', new pc.Vec3(32, 10, 18), new pc.Vec3(60, 5, -20), houseMat, true);
  addBox('hall-roof', new pc.Vec3(34, 3, 20), new pc.Vec3(60, 11.5, -20), roofMat);
  addBox('barracks', new pc.Vec3(28, 8, 14), new pc.Vec3(40, 4, 24), houseMat, true);
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
const gamepadLookSpeed = 2.4;
const touchLookSpeed = 0.75; // slower mobile look to reduce sensitivity
let yaw = Math.PI / 2; // face toward the city from the west gate
let pitch = -0.1;
const velocity = new pc.Vec3();
const direction = new pc.Vec3();
const radToDeg = (radians) => (radians * 180) / Math.PI;

const keys = { w: false, a: false, s: false, d: false, shift: false };
window.addEventListener('keydown', (e) => {
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
});
window.addEventListener('keyup', (e) => {
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
});

// Gamepad state
function readGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  return pads && pads.length ? pads[0] : null;
}

function applyGamepadLook(dt) {
  const pad = readGamepad();
  if (!pad) return;
  const lx = pad.axes[2] || 0;
  const ly = pad.axes[3] || 0;
  const dead = 0.15;
  const lookX = Math.abs(lx) > dead ? lx : 0;
  const lookY = Math.abs(ly) > dead ? ly : 0;
  yaw -= lookX * gamepadLookSpeed * dt;
  pitch -= lookY * gamepadLookSpeed * dt;
}

function readGamepadMove() {
  const pad = readGamepad();
  if (!pad) return { x: 0, y: 0, sprint: false };
  const dx = pad.axes[0] || 0;
  const dy = pad.axes[1] || 0;
  const dead = 0.15;
  const x = Math.abs(dx) > dead ? dx : 0;
  const y = Math.abs(dy) > dead ? dy : 0;
  const sprint = (pad.buttons[5] && pad.buttons[5].pressed) || (pad.buttons[0] && pad.buttons[0].pressed);
  return { x, y, sprint };
}

// Touch joysticks
const moveStickEl = document.getElementById('move-joystick');
const lookStickEl = document.getElementById('look-joystick');
const joystickRadius = 50;
const touchState = {
  move: { id: null, start: null, delta: { x: 0, y: 0 } },
  look: { id: null, start: null, delta: { x: 0, y: 0 } },
};

function resetStick(type) {
  touchState[type].id = null;
  touchState[type].start = null;
  touchState[type].delta = { x: 0, y: 0 };
  const handle = (type === 'move' ? moveStickEl : lookStickEl).querySelector('.joystick-handle');
  handle.style.transform = 'translate(-50%, -50%)';
}

function updateStickVisual(type) {
  const handle = (type === 'move' ? moveStickEl : lookStickEl).querySelector('.joystick-handle');
  const { delta } = touchState[type];
  handle.style.transform = `translate(calc(-50% + ${delta.x}px), calc(-50% + ${delta.y}px))`;
}

function clampStick(delta) {
  const mag = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
  if (mag > joystickRadius) {
    const scale = joystickRadius / mag;
    delta.x *= scale;
    delta.y *= scale;
  }
}

function handleTouchStart(e) {
  for (const touch of e.changedTouches) {
    const isLeft = touch.clientX < window.innerWidth / 2;
    const type = isLeft ? 'move' : 'look';
    if (touchState[type].id !== null) continue;
    touchState[type].id = touch.identifier;
    touchState[type].start = { x: touch.clientX, y: touch.clientY };
  }
}

function handleTouchMove(e) {
  for (const touch of e.changedTouches) {
    if (touch.identifier === touchState.move.id) {
      const delta = {
        x: touch.clientX - touchState.move.start.x,
        y: touch.clientY - touchState.move.start.y,
      };
      clampStick(delta);
      touchState.move.delta = delta;
      updateStickVisual('move');
    }
    if (touch.identifier === touchState.look.id) {
      const delta = {
        x: touch.clientX - touchState.look.start.x,
        y: touch.clientY - touchState.look.start.y,
      };
      clampStick(delta);
      touchState.look.delta = delta;
      updateStickVisual('look');
    }
  }
  e.preventDefault();
}

function handleTouchEnd(e) {
  for (const touch of e.changedTouches) {
    if (touch.identifier === touchState.move.id) resetStick('move');
    if (touch.identifier === touchState.look.id) resetStick('look');
  }
}

['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((evt) => {
  document.addEventListener(evt, (e) => {
    if (evt === 'touchstart') handleTouchStart(e);
    else if (evt === 'touchmove') handleTouchMove(e);
    else handleTouchEnd(e);
  }, { passive: false });
});

function getTouchMoveVector() {
  const { delta } = touchState.move;
  return {
    x: delta.x / joystickRadius,
    y: -delta.y / joystickRadius,
  };
}

function applyTouchLook(dt) {
  const { delta } = touchState.look;
  if (!delta.x && !delta.y) return;
  yaw -= (delta.x / joystickRadius) * touchLookSpeed * dt * 60;
  pitch -= (delta.y / joystickRadius) * touchLookSpeed * dt * 60;
}

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

camera.setLocalPosition(10, 5.5, 0);
camera.setLocalEulerAngles(radToDeg(pitch), radToDeg(yaw), 0);

// UI helpers
const posLabel = document.getElementById('playerPos');
function updateHud() {
  const p = camera.getPosition();
  posLabel.textContent = `${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
}

function collides(position) {
  for (const collider of colliders) {
    const dx = Math.abs(position.x - collider.center.x);
    const dz = Math.abs(position.z - collider.center.z);
    const hx = collider.halfExtents.x + collider.padding;
    const hz = collider.halfExtents.z + collider.padding;
    if (dx <= hx && dz <= hz) return true;
  }
  return false;
}

app.on('update', (dt) => {
  // Gamepad/touch look first so we clamp after
  applyGamepadLook(dt);
  applyTouchLook(dt);

  // build local basis
  const forward = camera.forward.clone();
  forward.y = 0;
  forward.normalize();
  const right = camera.right.clone();
  right.y = 0;
  right.normalize();

  const gamepadMove = readGamepadMove();
  const touchMove = getTouchMoveVector();

  direction.set(0, 0, 0);
  if (keys.w) direction.add(forward);
  if (keys.s) direction.sub(forward);
  if (keys.a) direction.sub(right);
  if (keys.d) direction.add(right);

  if (gamepadMove.x || gamepadMove.y) {
    direction.add(right.clone().scale(gamepadMove.x));
    direction.add(forward.clone().scale(-gamepadMove.y));
  }

  if (touchMove.x || touchMove.y) {
    direction.add(right.clone().scale(touchMove.x));
    direction.add(forward.clone().scale(touchMove.y));
  }

  if (direction.lengthSq() > 0) direction.normalize();

  const sprintKey = keys.shift || gamepadMove.sprint;
  const speed = sprintKey ? moveSpeed * sprintMultiplier : moveSpeed;
  velocity.copy(direction).scale(speed * dt);

  const current = camera.getPosition();
  const next = current.clone().add(velocity);
  let finalPos = current.clone();

  const stepX = current.clone();
  stepX.x = next.x;
  if (!collides(stepX)) finalPos.x = next.x;

  const stepZ = current.clone();
  stepZ.z = next.z;
  if (!collides(stepZ)) finalPos.z = next.z;

  camera.setLocalPosition(finalPos);

  pitch = pc.math.clamp(pitch, -1.2, 1.2);
  camera.setLocalEulerAngles(radToDeg(pitch), radToDeg(yaw), 0);
  updateHud();
});

updateHud();
app.start();
```
