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
  cloth: new pc.Color(0.66, 0.52, 0.24),
  noble: new pc.Color(0.52, 0.24, 0.52),
  sailor: new pc.Color(0.24, 0.46, 0.74),
};

const eqClasses = {
  Warrior: {
    stats: { STR: 90, STA: 85, AGI: 80, DEX: 75, INT: 55, WIS: 60, CHA: 65 },
    baseHP: 150,
    baseMana: 40,
  },
  Cleric: {
    stats: { STR: 65, STA: 75, AGI: 65, DEX: 60, INT: 70, WIS: 95, CHA: 75 },
    baseHP: 110,
    baseMana: 180,
  },
  Ranger: {
    stats: { STR: 75, STA: 75, AGI: 85, DEX: 85, INT: 60, WIS: 70, CHA: 70 },
    baseHP: 125,
    baseMana: 120,
  },
};

const playerProfile = {
  name: 'Adventurer',
  classKey: 'Ranger',
  level: 8,
};

function buildPlayerStats() {
  const cls = eqClasses[playerProfile.classKey];
  const hp = cls.baseHP + playerProfile.level * 12;
  const mana = cls.baseMana + playerProfile.level * 8;
  return {
    ...cls.stats,
    HP: hp,
    Mana: mana,
    AC: 120 + Math.floor(playerProfile.level * 2.5),
  };
}

// Helpers for spawning primitives
const colliders = [];
const npcs = [];
const actors = [];
const questCrates = [];

const supplyQuest = {
  id: 'dock-supply-run',
  name: 'Dock Supply Run',
  description: 'Gather three marked supply crates for Quartermaster Ryn.',
  required: 3,
  progress: 0,
  state: 'available', // available | active | ready
  reward: '2s + harbor favor',
};

function registerBoxCollider(position, size, padding = 0.6) {
  colliders.push({
    center: position.clone(),
    halfExtents: new pc.Vec3(size.x * 0.5, size.y * 0.5, size.z * 0.5),
    padding,
  });
}

function registerActor(actor) {
  actors.push(actor);
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

function buildHumanoid(name, position, colors) {
  const root = new pc.Entity(name);
  root.setLocalPosition(position.x, position.y, position.z);

  const torso = new pc.Entity(`${name}-torso`);
  torso.addComponent('render', { type: 'box' });
  torso.setLocalScale(1.1, 1.6, 0.8);
  torso.setLocalPosition(0, 1.4, 0);
  torso.render.material = makeMaterial(colors.torso, 0, 0.55);
  torso.castShadows = true;

  const head = new pc.Entity(`${name}-head`);
  head.addComponent('render', { type: 'sphere' });
  head.setLocalScale(0.6, 0.6, 0.6);
  head.setLocalPosition(0, 2.3, 0);
  head.render.material = makeMaterial(colors.skin, 0, 0.5);
  head.castShadows = true;

  const legs = new pc.Entity(`${name}-legs`);
  legs.addComponent('render', { type: 'cylinder' });
  legs.setLocalScale(0.7, 1.4, 0.7);
  legs.setLocalPosition(0, 0.6, 0);
  legs.render.material = makeMaterial(colors.legs, 0, 0.6);
  legs.castShadows = true;

  const arms = new pc.Entity(`${name}-arms`);
  arms.addComponent('render', { type: 'cylinder' });
  arms.setLocalScale(1.4, 0.35, 0.35);
  arms.setLocalEulerAngles(0, 0, 90);
  arms.setLocalPosition(0, 1.6, 0);
  arms.render.material = makeMaterial(colors.torso, 0, 0.55);
  arms.castShadows = true;

  root.addChild(torso);
  root.addChild(head);
  root.addChild(legs);
  root.addChild(arms);
  app.root.addChild(root);

  registerBoxCollider(position.clone().add(new pc.Vec3(0, 1.1, 0)), new pc.Vec3(1.4, 2.6, 1.4), 0.25);

  return { root, head };
}

function addNPC(name, position, colors, dialogLines, options = {}) {
  const humanoid = buildHumanoid(name, position, colors);
  npcs.push({
    entity: humanoid.root,
    name,
    dialogLines,
    lineIndex: 0,
    ...options,
  });

  registerActor({
    type: 'npc',
    name,
    entity: humanoid.root,
    head: humanoid.head,
    health: options.health || 140,
    maxHealth: options.health || 140,
  });
}

function addQuestCrate(label, position) {
  const crate = new pc.Entity(label);
  crate.addComponent('render', { type: 'box' });
  crate.setLocalScale(2.2, 2.2, 2.2);
  crate.setLocalPosition(position.x, position.y + 1.1, position.z);
  crate.render.material = makeMaterial(new pc.Color(0.55, 0.33, 0.19), 0.05, 0.6);
  crate.castShadows = true;
  app.root.addChild(crate);

  questCrates.push({ entity: crate, collected: false });
  registerBoxCollider(position.clone().add(new pc.Vec3(0, 1.1, 0)), new pc.Vec3(2.2, 2.2, 2.2), 0.3);
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

  // NPCs and interactables
  addNPC('Dockhand Mira', new pc.Vec3(110, 0, 30), { torso: palette.sailor, legs: palette.stone, skin: new pc.Color(0.93, 0.83, 0.7) }, [
    'Busy day at the docks. Ships from Qeynos arrived at dawn.',
    'If you head inland, watch for the market patrols—they keep things tidy.',
  ]);
  addNPC(
    'Quartermaster Ryn',
    new pc.Vec3(40, 0, -14),
    { torso: palette.cloth, legs: palette.stone, skin: new pc.Color(0.86, 0.76, 0.64) },
    [
      'Supplies are thin, but the Freeport guard always gets first pick.',
      'Need armor? The smithy by the north wall can size you up.',
    ],
    { questGiver: true }
  );
  addNPC('Harbor Sage Lyra', new pc.Vec3(10, 0, 32), { torso: palette.noble, legs: palette.roof, skin: new pc.Color(0.9, 0.8, 0.72) }, [
    'The sea breeze carries whispers of distant isles.',
    'When the bells toll at dusk, the harbor gates close—plan your return.',
  ]);

  addNPC('Guard Veylan', new pc.Vec3(-12, 0, 6), { torso: palette.stone, legs: palette.roof, skin: new pc.Color(0.72, 0.63, 0.55) }, [
    'Stay clear of troublemaker alleys—my patrol covers the plaza.',
    'If you spot loose crates, report back to Quartermaster Ryn.',
  ], { health: 180 });

  addQuestCrate('Supply Crate A', new pc.Vec3(70, 0, -6));
  addQuestCrate('Supply Crate B', new pc.Vec3(94, 0, 34));
  addQuestCrate('Supply Crate C', new pc.Vec3(54, 0, 46));

  const dummy = addCylinder('Training Dummy', 3, 8, new pc.Vec3(-28, 4, 12), makeMaterial(new pc.Color(0.45, 0.32, 0.2), 0.05, 0.6), true);
  registerActor({
    type: 'enemy',
    name: 'Training Dummy',
    entity: dummy,
    head: dummy, // top of cylinder works for nameplate
    health: 80,
    maxHealth: 80,
  });
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
const interactRadius = 5.5;
let interactionQueued = false;
let selectedTarget = null;
let menuOpen = false;
const screenPos = new pc.Vec3();
const playerStats = buildPlayerStats();
const playerActor = {
  type: 'player',
  name: `${playerProfile.name} (You)`,
  entity: camera,
  head: null,
  health: playerStats.HP,
  maxHealth: playerStats.HP,
};
registerActor(playerActor);

const keys = { w: false, a: false, s: false, d: false, shift: false };
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm') {
    toggleMenu();
  }
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
  if (e.key.toLowerCase() === 'e') interactionQueued = true;
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

let previousGamepadSouth = false;
let previousGamepadY = false;

function applyGamepadLook(dt) {
  if (menuOpen) return;
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

function pollGamepadInteract() {
  const pad = readGamepad();
  if (!pad || !pad.buttons || !pad.buttons.length) {
    previousGamepadSouth = false;
    return;
  }
  const south = !!(pad.buttons[0] && pad.buttons[0].pressed);
  if (south && !previousGamepadSouth) interactionQueued = true;
  previousGamepadSouth = south;
}

function pollGamepadMenuToggle() {
  const pad = readGamepad();
  if (!pad || !pad.buttons || !pad.buttons.length) {
    previousGamepadY = false;
    return;
  }
  const yPressed = !!(pad.buttons[3] && pad.buttons[3].pressed);
  if (yPressed && !previousGamepadY) toggleMenu();
  previousGamepadY = yPressed;
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
  if (menuOpen) return;
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

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (!document.pointerLockElement) {
    handlePointerSelect(e.clientX, e.clientY);
  } else {
    handlePointerSelect(window.innerWidth / 2, window.innerHeight / 2);
  }
});

canvas.addEventListener('touchend', (e) => {
  for (const touch of e.changedTouches) {
    handlePointerSelect(touch.clientX, touch.clientY);
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
const interactionHint = document.getElementById('interactionHint');
const dialogueEl = document.getElementById('dialogue');
const dialogueNameEl = dialogueEl.querySelector('.dialogue-name');
const dialogueTextEl = dialogueEl.querySelector('.dialogue-text');
const interactButton = document.getElementById('interact-button');
const classPanelEl = document.getElementById('classPanel');
const questStatusEl = document.getElementById('questStatus');
const helpContentEl = document.getElementById('helpContent');
const inventoryContentEl = document.getElementById('inventoryContent');
const nameplateEl = document.getElementById('nameplate');
const nameplateNameEl = nameplateEl.querySelector('.nameplate-name');
const nameplateHealthBar = nameplateEl.querySelector('.health-bar');
const menuOverlay = document.getElementById('gameMenu');
const menuToggleBtn = document.getElementById('menuToggle');
const menuCloseBtn = document.getElementById('menuClose');
const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

interactButton.addEventListener('click', () => {
  interactionQueued = true;
});

menuToggleBtn.addEventListener('click', () => toggleMenu());
menuCloseBtn.addEventListener('click', () => closeMenu());

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => setTab(btn.dataset.tab));
});

function setTab(tab) {
  tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tab}`);
  });
}

function openMenu() {
  if (menuOpen) return;
  menuOpen = true;
  menuOverlay.classList.remove('hidden');
  menuToggleBtn.classList.add('hidden');
  interactionHint.classList.add('hidden');
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
}

function closeMenu() {
  if (!menuOpen) return;
  menuOpen = false;
  menuOverlay.classList.add('hidden');
  menuToggleBtn.classList.remove('hidden');
}

function toggleMenu() {
  if (menuOpen) closeMenu();
  else openMenu();
}

function renderHelpPanel() {
  helpContentEl.innerHTML = `
    <div><strong>Keyboard</strong>: WASD to move, Mouse to look, Shift to sprint, E to interact, M to open menu.</div>
    <div><strong>Gamepad</strong>: Left stick move, Right stick look, South face to interact/sprint, Y to open menu.</div>
    <div><strong>Mobile</strong>: Left joystick to move, right joystick to look, Interact button for talking/picking up, top menu button for panels.</div>
  `;
}

function updateInventoryPanel() {
  if (supplyQuest.state === 'active' || supplyQuest.state === 'ready') {
    inventoryContentEl.textContent = `Supply crates secured: ${supplyQuest.progress}/${supplyQuest.required}`;
  } else {
    inventoryContentEl.textContent = 'Your satchel is light. Pick up supply crates to see loot tracked here.';
  }
}

function updateHud() {
  const p = camera.getPosition();
  posLabel.textContent = `Freeport · ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
}

function renderClassPanel() {
  const stats = buildPlayerStats();
  const lines = [
    `<strong>${playerProfile.name}</strong> — Level ${playerProfile.level} ${playerProfile.classKey}`,
    `HP ${stats.HP} · Mana ${stats.Mana} · AC ${stats.AC}`,
    `STR ${stats.STR} · STA ${stats.STA} · AGI ${stats.AGI} · DEX ${stats.DEX}`,
    `INT ${stats.INT} · WIS ${stats.WIS} · CHA ${stats.CHA}`,
  ];
  classPanelEl.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
}

function updateQuestStatus() {
  if (supplyQuest.state === 'available') {
    questStatusEl.textContent = `${supplyQuest.name}: ${supplyQuest.description}`;
  } else if (supplyQuest.state === 'active') {
    questStatusEl.textContent = `${supplyQuest.name}: ${supplyQuest.progress}/${supplyQuest.required} crates gathered.`;
  } else if (supplyQuest.state === 'ready') {
    questStatusEl.textContent = `${supplyQuest.name}: Return to Quartermaster Ryn for your reward.`;
  }
  updateInventoryPanel();
}

function getHeadPosition(actor) {
  if (actor.type === 'player') {
    return camera.getPosition().clone().add(new pc.Vec3(0, 1.8, 0));
  }
  if (actor.head) return actor.head.getWorldPosition();
  return actor.entity.getPosition();
}

function updateNameplatePosition() {
  if (!selectedTarget) {
    nameplateEl.classList.add('hidden');
    return;
  }
  const worldPos = getHeadPosition(selectedTarget);
  camera.camera.worldToScreen(worldPos, screenPos);
  if (screenPos.z < 0) {
    nameplateEl.classList.add('hidden');
    return;
  }
  nameplateEl.style.left = `${screenPos.x}px`;
  nameplateEl.style.top = `${screenPos.y - 28}px`;
  nameplateNameEl.textContent = `${selectedTarget.name}`;
  const ratio = selectedTarget.health / selectedTarget.maxHealth;
  nameplateHealthBar.style.width = `${Math.max(5, ratio * 100)}%`;
  nameplateEl.classList.remove('hidden');
}

function selectActor(actor) {
  selectedTarget = actor;
  updateNameplatePosition();
}

function handlePointerSelect(clientX, clientY) {
  let closest = null;
  let closestDist = 90;
  actors.forEach((actor) => {
    const worldPos = getHeadPosition(actor);
    camera.camera.worldToScreen(worldPos, screenPos);
    if (screenPos.z < 0) return;
    const dx = screenPos.x - clientX;
    const dy = screenPos.y - clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) {
      closest = actor;
      closestDist = dist;
    }
  });
  if (closest) selectActor(closest);
}

function actorForEntity(entity) {
  return actors.find((a) => a.entity === entity) || null;
}

function interactWithCrate(crate) {
  if (crate.collected || supplyQuest.state !== 'active') return;
  crate.collected = true;
  crate.entity.render.material = makeMaterial(new pc.Color(0.32, 0.24, 0.2), 0, 0.8);
  supplyQuest.progress = Math.min(supplyQuest.required, supplyQuest.progress + 1);
  showDialogue('Supply Crate', `You secure a crate. ${supplyQuest.progress}/${supplyQuest.required} gathered.`);
  if (supplyQuest.progress >= supplyQuest.required) {
    supplyQuest.state = 'ready';
  }
  updateQuestStatus();
}

function questDialogueForRyn() {
  if (supplyQuest.state === 'available') {
    return `${supplyQuest.name}: ${supplyQuest.description} Reward: ${supplyQuest.reward}.`;
  }
  if (supplyQuest.state === 'active') {
    return `${supplyQuest.progress}/${supplyQuest.required} crates gathered. Keep looking around the docks.`;
  }
  if (supplyQuest.state === 'ready') {
    return `Well done. Here's your pay. Crates will keep arriving—check again soon.`;
  }
  return '';
}

function interactWithNPC(npc) {
  const actor = actorForEntity(npc.entity);
  if (actor) selectActor(actor);

  if (npc.questGiver) {
    if (supplyQuest.state === 'available') {
      supplyQuest.state = 'active';
      supplyQuest.progress = 0;
      questCrates.forEach((c) => (c.collected = false));
      questCrates.forEach((c) => (c.entity.render.material = makeMaterial(new pc.Color(0.55, 0.33, 0.19), 0.05, 0.6)));
    } else if (supplyQuest.state === 'ready') {
      supplyQuest.state = 'available';
      supplyQuest.progress = 0;
      questCrates.forEach((c) => (c.collected = false));
      questCrates.forEach((c) => (c.entity.render.material = makeMaterial(new pc.Color(0.55, 0.33, 0.19), 0.05, 0.6)));
    }
    updateQuestStatus();
    showDialogue(npc.name, questDialogueForRyn());
    return;
  }

  const line = npc.dialogLines[npc.lineIndex % npc.dialogLines.length];
  npc.lineIndex += 1;
  showDialogue(npc.name, line);
}

function findNearestInteractable() {
  const playerPos = camera.getPosition();
  let nearest = null;
  let nearestDist = interactRadius;

  for (const npc of npcs) {
    const dist = npc.entity.getPosition().distance(playerPos);
    if (dist <= nearestDist) {
      nearest = { type: 'npc', ref: npc };
      nearestDist = dist;
    }
  }

  questCrates.forEach((crate) => {
    if (crate.collected || supplyQuest.state !== 'active') return;
    const dist = crate.entity.getPosition().distance(playerPos);
    if (dist <= nearestDist) {
      nearest = { type: 'crate', ref: crate };
      nearestDist = dist;
    }
  });

  return nearest;
}

function showDialogue(name, line) {
  if (!name || !line) {
    dialogueEl.classList.add('hidden');
    return;
  }
  dialogueNameEl.textContent = name;
  dialogueTextEl.textContent = line;
  dialogueEl.classList.remove('hidden');
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
  pollGamepadMenuToggle();
  if (menuOpen) {
    updateNameplatePosition();
    return;
  }

  // Gamepad/touch look first so we clamp after
  applyGamepadLook(dt);
  applyTouchLook(dt);
  pollGamepadInteract();

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

  const nearest = findNearestInteractable();
  if (nearest?.type === 'npc') {
    interactionHint.innerHTML = `Press <strong>E</strong> / south face / tap Interact to talk to ${nearest.ref.name}.`;
    interactionHint.classList.remove('hidden');
    if (interactionQueued) {
      interactWithNPC(nearest.ref);
    }
  } else if (nearest?.type === 'crate') {
    interactionHint.innerHTML = 'Press <strong>E</strong> / south face / tap Interact to secure this supply crate.';
    interactionHint.classList.remove('hidden');
    if (interactionQueued) interactWithCrate(nearest.ref);
  } else {
    interactionHint.classList.add('hidden');
  }
  interactionQueued = false;
  updateHud();
  updateNameplatePosition();
});

renderClassPanel();
renderHelpPanel();
updateQuestStatus();
setTab('stats');
updateHud();
app.start();
