# Freeport Landing Prototype: Full Source

This document lists the complete contents of all key files in the prototype so you can copy/paste or verify your local checkout.

## index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Freeport Landing - PlayCanvas</title>
  <link rel="stylesheet" href="styles.css" />
  <script src="https://code.playcanvas.com/playcanvas-stable.min.js"></script>
</head>
<body>
  <div class="hud">
    <h1>Freeport Landing (Prototype)</h1>
    <p>Click the canvas to lock the mouse. Use WASD + mouse to walk. Shift to sprint.</p>
    <p class="stats">Zone: Freeport · Position <span id="playerPos">0,0,0</span></p>
  </div>
  <canvas id="application-canvas"></canvas>
  <script src="scripts/main.js"></script>
</body>
</html>
```

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

@media (max-width: 600px) {
  .hud {
    max-width: calc(100vw - 32px);
  }
}
```

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
function makeLambert(color, emissive = 0) {
  const m = new pc.StandardMaterial();
  m.diffuse = color;
  m.emissive = color.clone().scale(emissive);
  m.useMetalness = false;
  m.gloss = 0.35;
  m.update();
  return m;
}

function makeMetal(color, metalness = 0.5, gloss = 0.5) {
  const m = new pc.StandardMaterial();
  m.diffuse = color;
  m.metalness = metalness;
  m.gloss = gloss;
  m.useMetalness = true;
  m.update();
  return m;
}

const sandMat = makeLambert(new pc.Color(0.82, 0.76, 0.62));
const stoneMat = makeLambert(new pc.Color(0.55, 0.6, 0.67));
const woodMat = makeLambert(new pc.Color(0.39, 0.27, 0.16));
const waterMat = new pc.StandardMaterial();
waterMat.diffuse = new pc.Color(0.15, 0.32, 0.48);
waterMat.opacity = 0.82;
waterMat.blendType = pc.BLEND_NORMAL;
waterMat.useMetalness = true;
waterMat.metalness = 0.02;
waterMat.gloss = 0.9;
waterMat.update();

const lightMat = makeLambert(new pc.Color(1.0, 0.92, 0.78), 0.2);

// Helpers
function addBox(name, size, position, material) {
  const e = new pc.Entity(name);
  e.addComponent('render', { type: 'box', material });
  e.setLocalScale(size.x, size.y, size.z);
  e.setLocalPosition(position.x, position.y, position.z);
  app.root.addChild(e);
  return e;
}

function addPlane(name, size, position, material) {
  const e = new pc.Entity(name);
  e.addComponent('render', { type: 'plane', material });
  e.setLocalScale(size.x, size.y, size.z);
  e.setLocalPosition(position.x, position.y, position.z);
  app.root.addChild(e);
  return e;
}

// Ground and harbor
addPlane('ground', new pc.Vec3(800, 1, 800), new pc.Vec3(0, 0, 0), sandMat);
addPlane('water', new pc.Vec3(400, 1, 400), new pc.Vec3(-120, 0.02, -120), waterMat);

// City walls
const wallHeight = 18;
const wallThickness = 6;
addBox('wall-north', new pc.Vec3(200, wallHeight, wallThickness), new pc.Vec3(0, wallHeight / 2, -120), stoneMat);
addBox('wall-south', new pc.Vec3(200, wallHeight, wallThickness), new pc.Vec3(0, wallHeight / 2, 120), stoneMat);
addBox('wall-east', new pc.Vec3(wallThickness, wallHeight, 200), new pc.Vec3(100, wallHeight / 2, 0), stoneMat);
addBox('wall-west', new pc.Vec3(wallThickness, wallHeight, 200), new pc.Vec3(-100, wallHeight / 2, 0), stoneMat);

// Gate and towers
addBox('gate', new pc.Vec3(30, 14, wallThickness + 1), new pc.Vec3(0, 7, -120), stoneMat);
addBox('tower-ne', new pc.Vec3(18, 28, 18), new pc.Vec3(90, 14, -110), stoneMat);
addBox('tower-nw', new pc.Vec3(18, 28, 18), new pc.Vec3(-90, 14, -110), stoneMat);
addBox('tower-se', new pc.Vec3(18, 28, 18), new pc.Vec3(90, 14, 110), stoneMat);
addBox('tower-sw', new pc.Vec3(18, 28, 18), new pc.Vec3(-90, 14, 110), stoneMat);

// Docks
for (let i = 0; i < 4; i++) {
  const offset = i * 30;
  addBox(`dock-${i}`, new pc.Vec3(12, 2, 40), new pc.Vec3(-140 - offset, 1, -120 - 20), woodMat);
  addBox(`dock-ramp-${i}`, new pc.Vec3(12, 2, 16), new pc.Vec3(-140 - offset, 1, -100), woodMat);
}

// Plaza and market
addBox('plaza', new pc.Vec3(60, 1, 60), new pc.Vec3(0, 0.5, 10), lightMat);
addBox('market-1', new pc.Vec3(18, 10, 12), new pc.Vec3(-25, 5, 10), woodMat);
addBox('market-2', new pc.Vec3(18, 10, 12), new pc.Vec3(0, 5, 10), woodMat);
addBox('market-3', new pc.Vec3(18, 10, 12), new pc.Vec3(25, 5, 10), woodMat);
addBox('inn', new pc.Vec3(30, 16, 20), new pc.Vec3(0, 8, 40), woodMat);

// Roads
addBox('road-main', new pc.Vec3(30, 0.6, 140), new pc.Vec3(0, 0.3, 40), makeLambert(new pc.Color(0.45, 0.42, 0.38)));
addBox('road-side-1', new pc.Vec3(16, 0.6, 60), new pc.Vec3(-30, 0.3, 0), makeLambert(new pc.Color(0.45, 0.42, 0.38)));
addBox('road-side-2', new pc.Vec3(16, 0.6, 60), new pc.Vec3(30, 0.3, 0), makeLambert(new pc.Color(0.45, 0.42, 0.38)));

// Harbor details
for (let i = 0; i < 10; i++) {
  const x = -120 - i * 14;
  addBox(`crate-${i}`, new pc.Vec3(4, 4 + (i % 3) * 2, 4), new pc.Vec3(x, 2 + (i % 3), -100 - (i % 2) * 6), woodMat);
}

// City interior scatter
for (let i = 0; i < 20; i++) {
  const x = pc.math.lerp(-70, 70, Math.random());
  const z = pc.math.lerp(-30, 80, Math.random());
  addBox(`house-${i}`, new pc.Vec3(12 + Math.random() * 8, 8 + Math.random() * 6, 12 + Math.random() * 6), new pc.Vec3(x, 4, z), woodMat);
}

// Simple fog/atmosphere
app.scene.fog = pc.FOG_LINEAR;
app.scene.fogColor = new pc.Color(0.12, 0.16, 0.21);
app.scene.fogStart = 120;
app.scene.fogEnd = 280;

// Controls
const keys = { w: false, a: false, s: false, d: false, shift: false };
const moveSpeed = 22;
const sprintMultiplier = 1.7;
const direction = new pc.Vec3();
const velocity = new pc.Vec3();

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW') keys.w = true;
  if (e.code === 'KeyA') keys.a = true;
  if (e.code === 'KeyS') keys.s = true;
  if (e.code === 'KeyD') keys.d = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') keys.w = false;
  if (e.code === 'KeyA') keys.a = false;
  if (e.code === 'KeyS') keys.s = false;
  if (e.code === 'KeyD') keys.d = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
});

// Mouse look
let yaw = 0;
let pitch = 0;
const rotSpeed = 0.0025;

function lockPointer() {
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
}

canvas.addEventListener('click', lockPointer);
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas) {
    // Unlocking pointer
  }
});

const mouse = app.mouse;
mouse.on('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
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
```
