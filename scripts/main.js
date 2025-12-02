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
app.scene.fog = pc.FOG_EXP;
app.scene.fogColor = new pc.Color(0.54, 0.66, 0.78);
app.scene.fogDensity = 0.0038;

// Player entity (camera)
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
  clearColor: new pc.Color(0.13, 0.18, 0.26),
  fov: 70,
});
camera.camera.nearClip = 0.25;
camera.camera.farClip = 1800;
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
  sand: new pc.Color(0.58, 0.52, 0.43),
  stone: new pc.Color(0.48, 0.47, 0.43),
  plaster: new pc.Color(0.78, 0.74, 0.68),
  roof: new pc.Color(0.32, 0.16, 0.12),
  water: new pc.Color(0.12, 0.32, 0.48),
  wood: new pc.Color(0.39, 0.26, 0.18),
  cloth: new pc.Color(0.64, 0.52, 0.3),
  noble: new pc.Color(0.52, 0.26, 0.52),
  sailor: new pc.Color(0.22, 0.44, 0.68),
  desertSand: new pc.Color(0.7, 0.62, 0.48),
  oasisWater: new pc.Color(0.09, 0.42, 0.5),
};

const fogDayColor = new pc.Color(0.56, 0.7, 0.82);
const fogNightColor = new pc.Color(0.08, 0.1, 0.15);
const fogDayDensity = 0.0032;
const fogNightDensity = 0.0062;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function mixColor(a, b, t, out = new pc.Color()) {
  out.r = lerp(a.r, b.r, t);
  out.g = lerp(a.g, b.g, t);
  out.b = lerp(a.b, b.b, t);
  return out;
}

const lanterns = [];
const rotatingBeacons = [];
const waterSurfaces = [];
let waterTime = 0;
let timeOfDay = 85; // seconds into the day cycle
const dayDuration = 260; // seconds per full day/night
const dayColor = new pc.Color(0.54, 0.66, 0.86);
const duskColor = new pc.Color(0.13, 0.1, 0.18);
const ambientDay = new pc.Color(0.32, 0.35, 0.4);
const ambientNight = new pc.Color(0.08, 0.1, 0.14);
const tmpColor = new pc.Color();
const waterTint = new pc.Color();

const freeportScale = 20;
const desertStartX = 1800;

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

const equipmentSlots = {
  head: null,
  chest: null,
  legs: null,
  feet: null,
  hands: null,
  mainhand: null,
  offhand: null,
  charm: null,
};

const bagCapacity = 28; // WoW-like backpack sizing for early game
const inventory = [];
let itemInstanceCounter = 0;

function instantiateItem(template, overrides = {}) {
  return {
    ...template,
    ...overrides,
    instanceId: `itm-${++itemInstanceCounter}`,
  };
}

function addToInventory(template, overrides = {}) {
  if (inventory.length >= bagCapacity) {
    showDialogue('Bags are full', 'Free up space or sell to a merchant before picking up more.');
    return null;
  }
  const instance = instantiateItem(template, overrides);
  inventory.push(instance);
  updateInventoryPanel();
  return instance;
}

const itemTemplates = {
  'rusty-cutlass': {
    id: 'rusty-cutlass',
    name: 'Rusty Cutlass',
    slot: 'mainhand',
    stats: { STR: 2, DEX: 1 },
    damage: '7-12',
    note: 'Well-worn blade suited for dock skirmishes.',
    value: 85,
  },
  'oak-buckler': {
    id: 'oak-buckler',
    name: 'Oak Buckler',
    slot: 'offhand',
    stats: { AC: 8, STA: 1 },
    note: 'Light shield carved by Freeport carpenters.',
    value: 60,
  },
  'leather-tunic': {
    id: 'leather-tunic',
    name: 'Ranger Leather Tunic',
    slot: 'chest',
    stats: { AC: 12, STA: 3, AGI: 1 },
    note: 'Comfortable travelwear common among scouts.',
    value: 95,
  },
  'soft-boots': {
    id: 'soft-boots',
    name: 'Soft Leather Boots',
    slot: 'feet',
    stats: { AGI: 2, DEX: 1 },
    note: 'Quiet soles ideal for stalking prey.',
    value: 55,
  },
  'mariner-gloves': {
    id: 'mariner-gloves',
    name: 'Mariner Gloves',
    slot: 'hands',
    stats: { STR: 1, DEX: 2 },
    note: 'Salt-cured gloves favored on the docks.',
    value: 65,
  },
  'scout-cap': {
    id: 'scout-cap',
    name: 'Scout Cap',
    slot: 'head',
    stats: { AC: 6, AGI: 1 },
    note: 'A stitched leather cap worn by scouts.',
    value: 45,
  },
  'sapphire-charm': {
    id: 'sapphire-charm',
    name: 'Sapphire Charm',
    slot: 'charm',
    stats: { CHA: 3, WIS: 2, Mana: 12 },
    note: 'A calming trinket from distant merchants.',
    value: 120,
  },
  'dock-rations': {
    id: 'dock-rations',
    name: 'Dock Rations',
    slot: null,
    stats: {},
    note: 'Hearty dried meats and bread. Sellable to merchants.',
    value: 30,
  },
  'desert-spices': {
    id: 'desert-spices',
    name: 'Desert Caravan Spices',
    slot: null,
    stats: {},
    note: 'Rare spice pouch from the oasis caravans.',
    value: 150,
  },
  'linen-satchel': {
    id: 'linen-satchel',
    name: 'Linen Satchel',
    slot: null,
    stats: {},
    note: 'A tidy 6-slot bag you can carry or sell.',
    value: 90,
  },
  'harbor-ring': {
    id: 'harbor-ring',
    name: 'Harbor Signet Ring',
    slot: 'hands',
    stats: { CHA: 2, STA: 1 },
    note: 'Marks you as a friend of Freeport merchants.',
    value: 110,
  },
};

const starterInventory = [
  'leather-tunic',
  'soft-boots',
  'mariner-gloves',
  'rusty-cutlass',
  'oak-buckler',
  'sapphire-charm',
  'scout-cap',
].map((id) => itemTemplates[id]);

function seedInventory() {
  starterInventory.forEach((item) => addToInventory(item));
}

let currency = { gold: 0, silver: 75, copper: 25 };

function copperTotal() {
  return currency.gold * 10000 + currency.silver * 100 + currency.copper;
}

function setCurrencyFromCopper(total) {
  const gold = Math.floor(total / 10000);
  const silver = Math.floor((total % 10000) / 100);
  const copper = total % 100;
  currency = { gold, silver, copper };
}

function adjustCurrency(delta) {
  const total = Math.max(0, copperTotal() + delta);
  setCurrencyFromCopper(total);
  renderCurrency();
  updateInventoryPanel();
  renderVendorPanel();
}

function formatCurrency(cur = currency) {
  return `${cur.gold}g ${cur.silver}s ${cur.copper}c`;
}

function formatValueCopper(amount) {
  const gold = Math.floor(amount / 10000);
  const silver = Math.floor((amount % 10000) / 100);
  const copper = amount % 100;
  const parts = [];
  if (gold) parts.push(`${gold}g`);
  if (silver || gold) parts.push(`${silver}s`);
  parts.push(`${copper}c`);
  return parts.join(' ');
}

function renderCurrency() {
  if (currencyDisplayEl) currencyDisplayEl.textContent = formatCurrency();
}

const playerProfile = {
  name: 'Adventurer',
  classKey: 'Ranger',
  level: 8,
};

const abilityBook = {
  slash: {
    id: 'slash',
    name: 'Skirmish Slash',
    type: 'melee',
    range: 4,
    cooldown: 1.6,
    staminaCost: 0,
    manaCost: 0,
    minDamage: 7,
    maxDamage: 12,
  },
  emberBolt: {
    id: 'emberBolt',
    name: 'Ember Bolt',
    type: 'magic',
    range: 16,
    cooldown: 3.5,
    manaCost: 15,
    minDamage: 11,
    maxDamage: 16,
  },
  enemyBite: {
    id: 'enemyBite',
    name: 'Rake',
    type: 'melee',
    range: 3.5,
    cooldown: 2.2,
    minDamage: 5,
    maxDamage: 9,
  },
};

function gearBonuses() {
  const totals = { STR: 0, STA: 0, AGI: 0, DEX: 0, INT: 0, WIS: 0, CHA: 0, AC: 0, HP: 0, Mana: 0 };
  Object.values(equipmentSlots).forEach((item) => {
    if (!item || !item.stats) return;
    Object.entries(item.stats).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + value;
    });
  });
  return totals;
}

function buildPlayerStats() {
  const cls = eqClasses[playerProfile.classKey];
  const gear = gearBonuses();
  const hp = cls.baseHP + playerProfile.level * 12 + (gear.HP || 0) + (gear.STA || 0) * 2;
  const mana = cls.baseMana + playerProfile.level * 8 + (gear.Mana || 0) + (gear.WIS || 0) * 1.5;
  return {
    STR: cls.stats.STR + gear.STR,
    STA: cls.stats.STA + gear.STA,
    AGI: cls.stats.AGI + gear.AGI,
    DEX: cls.stats.DEX + gear.DEX,
    INT: cls.stats.INT + gear.INT,
    WIS: cls.stats.WIS + gear.WIS,
    CHA: cls.stats.CHA + gear.CHA,
    HP: hp,
    Mana: mana,
    AC: 120 + Math.floor(playerProfile.level * 2.5) + (gear.AC || 0),
  };
}

// Helpers for spawning primitives
const colliders = [];
const npcs = [];
const actors = [];
const actorRegistry = new Map();
let actorIdCounter = 0;
const questCrates = [];
const combatState = {
  abilityCooldowns: new Map(),
};

const supplyQuest = {
  id: 'dock-supply-run',
  name: 'Dock Supply Run',
  description: 'Gather three marked supply crates for Quartermaster Ryn.',
  required: 3,
  progress: 0,
  state: 'available', // available | active | ready
  reward: '2s + harbor favor',
};

function grantLoot(templateId, source = 'Loot') {
  const template = itemTemplates[templateId];
  if (!template) return;
  const added = addToInventory(template);
  if (added) {
    showDialogue(source, `You receive ${template.name}.`);
  }
}

function resetCrateAppearance() {
  questCrates.forEach((c) => {
    c.collected = false;
    c.entity.render.material = makeMaterial(new pc.Color(0.55, 0.33, 0.19), 0.05, 0.6);
  });
}

function unequip(slot) {
  const equipped = equipmentSlots[slot];
  if (!equipped) return;
  addToInventory(equipped);
  equipmentSlots[slot] = null;
}

function equipItem(item) {
  if (!item || !item.slot) return;
  const previous = equipmentSlots[item.slot];
  equipmentSlots[item.slot] = item;
  const index = inventory.findIndex((i) => i.instanceId === item.instanceId);
  if (index !== -1) inventory.splice(index, 1);
  if (previous) addToInventory(previous);
  syncVitalsToGear();
}

function syncVitalsToGear() {
  const stats = buildPlayerStats();
  playerState.maxHealth = stats.HP;
  playerState.maxMana = stats.Mana;
  playerState.health = playerState.maxHealth;
  playerState.mana = playerState.maxMana;
  playerActor.health = playerState.health;
  playerActor.maxHealth = playerState.maxHealth;
  playerActor.mana = playerState.mana;
  playerActor.maxMana = playerState.maxMana;
  renderClassPanel();
}

function registerBoxCollider(position, size, padding = 0.6) {
  colliders.push({
    center: position.clone(),
    halfExtents: new pc.Vec3(size.x * 0.5, size.y * 0.5, size.z * 0.5),
    padding,
  });
}

function createActor(config) {
  const id = config.id || `${config.type || 'actor'}-${++actorIdCounter}`;
  const maxHealth = config.maxHealth ?? config.health ?? 120;
  const actor = {
    id,
    type: config.type || 'npc',
    name: config.name || 'Unnamed',
    entity: config.entity,
    head: config.head || config.entity,
    level: config.level ?? 1,
    role: config.role || 'wanderer',
    faction: config.faction || 'neutral',
    tags: config.tags || [],
    maxHealth,
    health: config.health ?? maxHealth,
    maxMana: config.maxMana ?? 0,
    mana: config.mana ?? 0,
    abilities: config.abilities || [],
    respawn: config.respawn || null,
    aggro: config.aggro || { passive: true },
    target: null,
    dead: false,
  };
  actors.push(actor);
  actorRegistry.set(id, actor);
  return actor;
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

function addWaterSurface(name, size, position, color) {
  const material = makeMaterial(color, 0.35, 0.22);
  const entity = addPlane(name, size, position, material, false);
  entity.render.castShadows = false;
  waterSurfaces.push({ material, baseColor: color.clone() });
  return entity;
}

function addLantern(name, position, height = 7, range = 24) {
  const post = new pc.Entity(`${name}-post`);
  post.addComponent('render', { type: 'cylinder' });
  post.setLocalScale(0.45, height, 0.45);
  post.setLocalPosition(position.x, height / 2, position.z);
  post.render.material = makeMaterial(palette.wood, 0.05, 0.6);

  const cap = new pc.Entity(`${name}-cap`);
  cap.addComponent('render', { type: 'cone' });
  cap.setLocalScale(1, 1.2, 1);
  cap.setLocalPosition(0, height * 0.55, 0);
  cap.render.material = makeMaterial(palette.roof, 0, 0.45);
  post.addChild(cap);

  const glow = new pc.Entity(`${name}-glow`);
  glow.addComponent('light', {
    type: 'omni',
    color: new pc.Color(1, 0.85, 0.63),
    intensity: 0,
    range,
    castShadows: false,
  });
  glow.setLocalPosition(0, height * 0.65, 0);
  post.addChild(glow);

  lanterns.push(glow);
  app.root.addChild(post);
  return post;
}

function addLighthouse(name, position) {
  const tower = addCylinder(name, 8, 38, new pc.Vec3(position.x, 19, position.z), makeMaterial(palette.stone, 0, 0.65), true);
  addCylinder(`${name}-cap`, 10, 4, new pc.Vec3(position.x, 38, position.z), makeMaterial(palette.roof, 0, 0.4));
  const beacon = new pc.Entity(`${name}-beacon`);
  beacon.addComponent('light', {
    type: 'spot',
    color: new pc.Color(1, 0.92, 0.8),
    intensity: 0,
    range: 140,
    innerConeAngle: 20,
    outerConeAngle: 36,
    castShadows: false,
  });
  beacon.setLocalPosition(position.x, 38, position.z);
  beacon.setLocalEulerAngles(0, 35, 0);
  rotatingBeacons.push({ entity: beacon, speed: 18 });
  app.root.addChild(beacon);
  return tower;
}

function addRockCluster(name, center, count, radius, heightRange = [1.8, 3.6]) {
  for (let i = 0; i < count; i += 1) {
    const offset = new pc.Vec3(
      (Math.random() * 2 - 1) * radius,
      0,
      (Math.random() * 2 - 1) * radius
    );
    const scaleY = lerp(heightRange[0], heightRange[1], Math.random());
    const scaleXZ = scaleY * lerp(0.8, 1.4, Math.random());
    const pos = center.clone().add(offset);
    const rock = addBox(
      `${name}-${i}`,
      new pc.Vec3(scaleXZ * 1.2, scaleY, scaleXZ),
      new pc.Vec3(pos.x, scaleY * 0.5, pos.z),
      makeMaterial(palette.stone, 0.05, 0.6),
      true
    );
    rock.setLocalEulerAngles(0, Math.random() * 360, 0);
  }
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
  const actor = createActor({
    type: 'npc',
    name,
    entity: humanoid.root,
    head: humanoid.head,
    health: options.health || 140,
    maxHealth: options.health || 140,
    level: options.level || 6,
    role: options.role || 'citizen',
    faction: options.faction || 'Freeport',
    tags: ['npc'],
  });

  npcs.push({
    entity: humanoid.root,
    name,
    dialogLines,
    lineIndex: 0,
    actorId: actor.id,
    ...options,
  });
}

function addBat(name, position) {
  const root = new pc.Entity(name);
  root.setLocalPosition(position.x, position.y, position.z);

  const body = new pc.Entity(`${name}-body`);
  body.addComponent('render', { type: 'sphere' });
  body.setLocalScale(1.6, 1, 1.6);
  body.render.material = makeMaterial(new pc.Color(0.2, 0.2, 0.24), 0.05, 0.45);

  const wingL = new pc.Entity(`${name}-wingL`);
  wingL.addComponent('render', { type: 'box' });
  wingL.setLocalScale(2.6, 0.2, 0.8);
  wingL.setLocalPosition(-1.8, 0.2, 0);
  wingL.render.material = makeMaterial(new pc.Color(0.16, 0.16, 0.18), 0.05, 0.5);

  const wingR = new pc.Entity(`${name}-wingR`);
  wingR.addComponent('render', { type: 'box' });
  wingR.setLocalScale(2.6, 0.2, 0.8);
  wingR.setLocalPosition(1.8, 0.2, 0);
  wingR.render.material = makeMaterial(new pc.Color(0.16, 0.16, 0.18), 0.05, 0.5);

  root.addChild(body);
  root.addChild(wingL);
  root.addChild(wingR);
  app.root.addChild(root);

  registerBoxCollider(position.clone().add(new pc.Vec3(0, 0.5, 0)), new pc.Vec3(3, 1.2, 3), 0.6);

  const actor = createActor({
    type: 'enemy',
    name,
    entity: root,
    head: body,
    health: 20,
    maxHealth: 20,
    level: 2,
    role: 'wildlife',
    faction: 'Freeport Wildlife',
    tags: ['enemy', 'bat'],
    abilities: [abilityBook.enemyBite],
    aggro: { passive: true, assistsOnHit: true },
    respawn: { delay: 30, spawnPoint: position.clone() },
  });

  return actor;
}

function addDesertSkitter(name, position) {
  const root = new pc.Entity(name);
  root.setLocalPosition(position.x, position.y, position.z);

  const shell = new pc.Entity(`${name}-shell`);
  shell.addComponent('render', { type: 'sphere' });
  shell.setLocalScale(1.6, 0.9, 1.6);
  shell.setLocalPosition(0, 0.9, 0);
  shell.render.material = makeMaterial(new pc.Color(0.58, 0.48, 0.32), 0.05, 0.48);
  shell.castShadows = true;

  const legs = new pc.Entity(`${name}-legs`);
  legs.addComponent('render', { type: 'cylinder' });
  legs.setLocalScale(2.2, 0.2, 2.2);
  legs.setLocalPosition(0, 0.35, 0);
  legs.render.material = makeMaterial(new pc.Color(0.4, 0.32, 0.2), 0.05, 0.4);

  root.addChild(shell);
  root.addChild(legs);
  app.root.addChild(root);

  registerBoxCollider(position.clone().add(new pc.Vec3(0, 0.4, 0)), new pc.Vec3(2.2, 1, 2.2), 0.4);

  const actor = createActor({
    type: 'enemy',
    name,
    entity: root,
    head: shell,
    health: 20,
    maxHealth: 20,
    level: 5,
    role: 'wanderer',
    faction: 'Freeport Wildlife',
    tags: ['enemy', 'desert'],
    abilities: [abilityBook.enemyBite],
    aggro: { passive: true, assistsOnHit: true },
    respawn: { delay: 30, spawnPoint: position.clone() },
  });

  return actor;
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
  const areaScale = Math.sqrt(freeportScale);
  const scaleSize = (vec) => new pc.Vec3(vec.x * areaScale, vec.y, vec.z * areaScale);
  const scalePos = (vec) => new pc.Vec3(vec.x * areaScale, vec.y, vec.z * areaScale);
  const freeportExtent = 120 * areaScale;

  // Ground and harbor water
  addPlane('ground', scaleSize(new pc.Vec3(280, 1, 280)), new pc.Vec3(0, 0, 0), makeMaterial(palette.sand, 0.02, 0.82));
  addPlane('north-fields', scaleSize(new pc.Vec3(280, 1, 140)), new pc.Vec3(0, 0.02, -220 * areaScale), makeMaterial(palette.sand, 0.02, 0.82));
  addWaterSurface('harbor-water', scaleSize(new pc.Vec3(200, 1, 160)), scalePos(new pc.Vec3(120, -0.3, 80)), palette.water);
  addLighthouse('harbor-lighthouse', scalePos(new pc.Vec3(168, 0, -48)));
  addLantern('dock-lantern-a', scalePos(new pc.Vec3(freeportExtent + 14, 0, 46)));
  addLantern('dock-lantern-b', scalePos(new pc.Vec3(freeportExtent + 52, 0, 30)));
  addLantern('dock-lantern-c', scalePos(new pc.Vec3(freeportExtent + 24, 0, -12)));
  addRockCluster('shore-rocks', scalePos(new pc.Vec3(freeportExtent + 80, 0, -80)), 8, 28, [1.4, 3.2]);
  addRockCluster('bluff-rocks', scalePos(new pc.Vec3(-freeportExtent + 12, 0, 88)), 6, 26, [1.8, 3.8]);

  // City walls
  const wallMat = makeMaterial(palette.stone, 0, 0.7);
  const wallHeight = 12;
  const wallThickness = 4;
  addBox('north-wall', new pc.Vec3(freeportExtent * 2, wallHeight, wallThickness), new pc.Vec3(0, wallHeight / 2, -freeportExtent), wallMat, true);
  addBox('south-wall', new pc.Vec3(freeportExtent * 2, wallHeight, wallThickness), new pc.Vec3(0, wallHeight / 2, freeportExtent), wallMat, true);
  addBox('west-wall', new pc.Vec3(wallThickness, wallHeight, freeportExtent * 2), new pc.Vec3(-freeportExtent, wallHeight / 2, 0), wallMat, true);

  // Gate and watchtowers facing the harbor
  addBox('gate', new pc.Vec3(18, wallHeight * 0.75, wallThickness), new pc.Vec3(freeportExtent, wallHeight * 0.75 * 0.5, 10 * areaScale), wallMat, false);
  addCylinder('north-tower', 6, 18, new pc.Vec3(freeportExtent - 8, 9, -freeportExtent + 8), makeMaterial(palette.plaster, 0, 0.6), true);
  addCylinder('south-tower', 6, 18, new pc.Vec3(freeportExtent - 8, 9, freeportExtent - 8), makeMaterial(palette.plaster, 0, 0.6), true);

  // Docks and pier
  const dockMat = makeMaterial(palette.wood, 0.05, 0.65);
  addBox('main-dock', new pc.Vec3(60 * areaScale, 1.2, 12 * areaScale), new pc.Vec3(freeportExtent + 24 * areaScale, 0.6, 24 * areaScale), dockMat, true);
  addBox('pier-a', new pc.Vec3(10 * areaScale, 1, 40 * areaScale), new pc.Vec3(freeportExtent + 40 * areaScale, 0.5, 44 * areaScale), dockMat, true);
  addBox('pier-b', new pc.Vec3(10 * areaScale, 1, 40 * areaScale), new pc.Vec3(freeportExtent + 8 * areaScale, 0.5, 44 * areaScale), dockMat, true);

  // Central plaza
  const plazaPos = scalePos(new pc.Vec3(-20, 0.05, 10));
  addPlane('plaza', scaleSize(new pc.Vec3(80, 1, 80)), plazaPos, makeMaterial(palette.plaster, 0, 0.95));
  addCylinder('plaza-statue', 3.4, 10, new pc.Vec3(plazaPos.x, 5, plazaPos.z), makeMaterial(palette.roof, 0.15, 0.4), true);
  addLantern('plaza-lantern-a', new pc.Vec3(plazaPos.x + 12, 0, plazaPos.z + 18));
  addLantern('plaza-lantern-b', new pc.Vec3(plazaPos.x - 16, 0, plazaPos.z - 22));
  addLantern('plaza-lantern-c', new pc.Vec3(plazaPos.x + 24, 0, plazaPos.z - 6));

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
    const pos = scalePos(home.pos);
    const size = scaleSize(home.size);
    const base = addBox(`home-${i}`, size, pos, houseMat, true);
    addBox(
      `home-${i}-roof`,
      new pc.Vec3(size.x * 1.05, size.y * 0.3, size.z * 1.05),
      new pc.Vec3(pos.x, pos.y + size.y * 0.6, pos.z),
      roofMat
    );
    base.render.castShadows = true;
  });

  // Outlying districts for scale
  const districtOffsets = [
    new pc.Vec3(240, 0, -260),
    new pc.Vec3(-320, 0, 180),
    new pc.Vec3(420, 0, 220),
    new pc.Vec3(-180, 0, -360),
    new pc.Vec3(620, 0, -120),
  ];
  districtOffsets.forEach((offset, idx) => {
    const anchor = scalePos(offset);
    addPlane(`district-${idx}-road`, new pc.Vec3(40, 1, 90), new pc.Vec3(anchor.x, 0.04, anchor.z), makeMaterial(palette.plaster, 0, 0.9));
    addBox(`district-${idx}-hall`, new pc.Vec3(28, 8, 14), new pc.Vec3(anchor.x + 12, 4, anchor.z + 12), houseMat, true);
    addBox(`district-${idx}-hall-roof`, new pc.Vec3(30, 2.5, 16), new pc.Vec3(anchor.x + 12, 9, anchor.z + 12), roofMat);
    addBox(`district-${idx}-home`, new pc.Vec3(18, 7, 16), new pc.Vec3(anchor.x - 14, 3.5, anchor.z - 8), houseMat, true);
    addBox(`district-${idx}-home-roof`, new pc.Vec3(20, 2.4, 18), new pc.Vec3(anchor.x - 14, 9.2, anchor.z - 8), roofMat);
    addCylinder(`district-${idx}-tower`, 5, 14, new pc.Vec3(anchor.x + 20, 7, anchor.z - 24), makeMaterial(palette.stone, 0, 0.6), true);
  });

  // Hall and barracks near the gate
  addBox('hall', new pc.Vec3(32, 10, 18), scalePos(new pc.Vec3(60, 5, -20)), houseMat, true);
  addBox('hall-roof', new pc.Vec3(34, 3, 20), scalePos(new pc.Vec3(60, 11.5, -20)), roofMat);
  addBox('barracks', new pc.Vec3(28, 8, 14), scalePos(new pc.Vec3(40, 4, 24)), houseMat, true);
  addBox('barracks-roof', new pc.Vec3(30, 2.5, 16), scalePos(new pc.Vec3(40, 9, 24)), roofMat);

  // Pathways and highways toward the desert
  const pathMat = makeMaterial(new pc.Color(0.46, 0.43, 0.38), 0, 0.95);
  addPlane('main-road', new pc.Vec3(20, 1, 200 * areaScale), new pc.Vec3(freeportExtent * 0.6, 0.04, 0), pathMat);
  addPlane('plaza-road', new pc.Vec3(60 * areaScale, 1, 16), new pc.Vec3(0, 0.04, 0), pathMat);
  addPlane('plaza-road-west', new pc.Vec3(16, 1, 80 * areaScale), scalePos(new pc.Vec3(-40, 0.04, 10)), pathMat);
  addPlane('desert-road', new pc.Vec3(desertStartX - freeportExtent, 1, 18), new pc.Vec3((desertStartX + freeportExtent) * 0.5, 0.04, -8), pathMat);

  // NPCs and interactables
  addNPC('Dockhand Mira', scalePos(new pc.Vec3(110, 0, 30)), { torso: palette.sailor, legs: palette.stone, skin: new pc.Color(0.93, 0.83, 0.7) }, [
    'Busy day at the docks. Ships from Qeynos arrived at dawn.',
    'If you head inland, watch for the market patrols—they keep things tidy.',
  ]);
  addNPC(
    'Quartermaster Ryn',
    scalePos(new pc.Vec3(40, 0, -14)),
    { torso: palette.cloth, legs: palette.sand, skin: new pc.Color(0.86, 0.73, 0.55) },
    [
      'The Freeport docks run on crates and coin. Want work? I pay for secured cargo.',
      'Claim three marked supply crates and you will have my thanks and silver.',
    ],
    { questGiver: true }
  );
  addNPC('Archivist Rella', scalePos(new pc.Vec3(-10, 0, 32)), { torso: palette.noble, legs: palette.cloth, skin: new pc.Color(0.78, 0.66, 0.62) }, [
    'Our maps are rough sketches—the desert east of here is undercharted.',
    'If you explore the dunes, mark the oasis on your map for us.',
  ]);
  addNPC('Guard Veylan', scalePos(new pc.Vec3(-12, 0, 6)), { torso: palette.stone, legs: palette.roof, skin: new pc.Color(0.72, 0.63, 0.55) }, [
    'Stay clear of troublemaker alleys—my patrol covers the plaza.',
    'If you spot loose crates, report back to Quartermaster Ryn.',
  ], { health: 180 });
  addNPC(
    'Merchant Selene',
    scalePos(new pc.Vec3(26, 0, 20)),
    { torso: palette.sailor, legs: palette.plaster, skin: new pc.Color(0.88, 0.76, 0.66) },
    [
      'Fresh gear from Freeport ships—bags, bucklers, and trinkets.',
      'If your packs are full, I pay silver for clean goods.',
    ],
    {
      vendor: {
        stock: ['harbor-ring', 'linen-satchel', 'dock-rations', 'desert-spices'],
        sellMultiplier: 0.35,
        buyMultiplier: 1.05,
      },
    }
  );

  addQuestCrate('Supply Crate A', scalePos(new pc.Vec3(70, 0, -6)));
  addQuestCrate('Supply Crate B', scalePos(new pc.Vec3(94, 0, 34)));
  addQuestCrate('Supply Crate C', scalePos(new pc.Vec3(54, 0, 46)));

  const dummy = addCylinder('Training Dummy', 3, 8, scalePos(new pc.Vec3(-28, 4, 12)), makeMaterial(new pc.Color(0.45, 0.32, 0.2), 0.05, 0.6), true);
  createActor({
    type: 'enemy',
    name: 'Training Dummy',
    entity: dummy,
    head: dummy, // top of cylinder works for nameplate
    health: 80,
    maxHealth: 80,
    level: 3,
    role: 'practice target',
    faction: 'neutral',
    tags: ['enemy'],
  });

  addBat('Dockside Bat', scalePos(new pc.Vec3(108, 1.2, 64)));
}

buildFreeportLanding();
function buildFreeportDesert() {
  const areaScale = Math.sqrt(freeportScale);
  const desertBase = new pc.Vec3(desertStartX, 0, 0);
  const oasisOffset = new pc.Vec3(900, 0, 420);

  addPlane('desert-ground', new pc.Vec3(260 * areaScale, 1, 260 * areaScale), desertBase, makeMaterial(palette.desertSand, 0, 0.95));
  addPlane('dune-ridge', new pc.Vec3(240 * areaScale, 2.5, 30 * areaScale), new pc.Vec3(desertBase.x + 240, 1.2, desertBase.z - 80), makeMaterial(palette.desertSand, 0, 0.92));

  const oasisCenter = desertBase.clone().add(oasisOffset);
  addWaterSurface('oasis-water', new pc.Vec3(60, 1, 60), new pc.Vec3(oasisCenter.x, -0.4, oasisCenter.z), palette.oasisWater);
  addPlane('oasis-grass', new pc.Vec3(80, 1, 80), new pc.Vec3(oasisCenter.x, 0.02, oasisCenter.z), makeMaterial(new pc.Color(0.32, 0.44, 0.3), 0.02, 0.78));
  addCylinder('oasis-palm', 1.2, 12, new pc.Vec3(oasisCenter.x - 6, 6, oasisCenter.z + 4), makeMaterial(palette.wood, 0.05, 0.55), true);
  addCylinder('oasis-palm-2', 1, 11, new pc.Vec3(oasisCenter.x + 8, 5.5, oasisCenter.z - 3), makeMaterial(palette.wood, 0.05, 0.55), true);
  addLantern('oasis-lantern-a', new pc.Vec3(oasisCenter.x + 14, 0, oasisCenter.z + 6), 6, 20);
  addLantern('oasis-lantern-b', new pc.Vec3(oasisCenter.x - 12, 0, oasisCenter.z - 10), 6, 20);

  const campSpot = new pc.Vec3(oasisCenter.x - 22, 0, oasisCenter.z - 26);
  addBox('oasis-tent-1', new pc.Vec3(12, 6, 10), new pc.Vec3(campSpot.x, 3, campSpot.z), makeMaterial(palette.cloth, 0, 0.5), true);
  addBox('oasis-tent-2', new pc.Vec3(10, 5, 9), new pc.Vec3(campSpot.x + 18, 2.6, campSpot.z + 8), makeMaterial(palette.cloth, 0, 0.52), true);
  addPlane('oasis-campfire', new pc.Vec3(6, 1, 6), new pc.Vec3(campSpot.x + 10, 0.12, campSpot.z + 2), makeMaterial(new pc.Color(0.4, 0.18, 0.1), 0, 0.4));
  addLantern('oasis-campfire-light', new pc.Vec3(campSpot.x + 10, 0, campSpot.z + 2), 3.6, 16);

  const boulders = [
    new pc.Vec3(desertBase.x + 160, 1, desertBase.z + 30),
    new pc.Vec3(desertBase.x + 320, 1, desertBase.z - 120),
    new pc.Vec3(desertBase.x + 520, 1, desertBase.z + 180),
  ];
  boulders.forEach((pos, i) => addBox(`desert-boulder-${i}`, new pc.Vec3(18, 12, 14), pos, makeMaterial(palette.stone, 0.05, 0.6), true));
  addRockCluster('dune-rocks', new pc.Vec3(desertBase.x + 260, 0, desertBase.z + 60), 10, 44, [1.6, 3.4]);
  addRockCluster('oasis-rim-rocks', new pc.Vec3(oasisCenter.x - 42, 0, oasisCenter.z + 30), 7, 30, [1.4, 2.8]);

  addDesertSkitter('Oasis Scarab', new pc.Vec3(oasisCenter.x + 12, 0.6, oasisCenter.z + 18));
  addDesertSkitter('Dune Forager', new pc.Vec3(desertBase.x + 260, 0.6, desertBase.z - 90));
  addDesertSkitter('Sand Hopper', new pc.Vec3(desertBase.x + 420, 0.6, desertBase.z + 210));
}

buildFreeportDesert();


// Player movement handling
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const moveSpeed = 10;
const sprintMultiplier = 1.8;
const rotSpeed = 0.0022;
const gamepadLookSpeed = 2.4;
const touchLookSpeed = 0.075; // slower mobile look to reduce sensitivity
let yaw = Math.PI / 2; // face toward the city from the west gate
let pitch = -0.1;
const velocity = new pc.Vec3();
const direction = new pc.Vec3();
const radToDeg = (radians) => (radians * 180) / Math.PI;
const interactRadius = 5.5;
let interactionQueued = false;
let queuedAbility = null;
let selectedTarget = null;
let menuOpen = false;
const screenPos = new pc.Vec3();
const playerStats = buildPlayerStats();
const playerState = {
  health: playerStats.HP,
  mana: playerStats.Mana,
  maxHealth: playerStats.HP,
  maxMana: playerStats.Mana,
};
const playerActor = createActor({
  type: 'player',
  name: `${playerProfile.name} (You)`,
  entity: camera,
  head: null,
  health: playerState.health,
  maxHealth: playerState.maxHealth,
  mana: playerState.mana,
  maxMana: playerState.maxMana,
  level: playerProfile.level,
  role: playerProfile.classKey,
  tags: ['player'],
  abilities: [abilityBook.slash, abilityBook.emberBolt],
});

// UI helpers (defined early so stat sync/render calls have valid references)
const posLabel = document.getElementById('playerPos');
const interactionHint = document.getElementById('interactionHint');
const dialogueEl = document.getElementById('dialogue');
const dialogueNameEl = dialogueEl.querySelector('.dialogue-name');
const dialogueTextEl = dialogueEl.querySelector('.dialogue-text');
const attackButton = document.getElementById('attack-button');
const interactButton = document.getElementById('interact-button');
const classPanelEl = document.getElementById('classPanel');
const questStatusEl = document.getElementById('questStatus');
const helpContentEl = document.getElementById('helpContent');
const inventoryContentEl = document.getElementById('inventoryContent');
const equipmentContentEl = document.getElementById('equipmentContent');
const currencyDisplayEl = document.getElementById('currencyDisplay');
const nameplateEl = document.getElementById('nameplate');
const nameplateNameEl = nameplateEl.querySelector('.nameplate-name');
const nameplateHealthBar = nameplateEl.querySelector('.health-bar');
const nameplateHealthText = nameplateEl.querySelector('.nameplate-health-text');
const menuOverlay = document.getElementById('gameMenu');
const menuToggleBtn = document.getElementById('menuToggle');
const menuCloseBtn = document.getElementById('menuClose');
const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
const hotkeyOverlay = document.getElementById('hotkeyOverlay');
const actionMenuEl = document.getElementById('actionMenu');
const actionButtons = [
  document.getElementById('action-talk'),
  document.getElementById('action-attack'),
  document.getElementById('action-item'),
  document.getElementById('action-check'),
];
const vendorPanel = document.getElementById('vendorPanel');
const vendorStockEl = document.getElementById('vendorStock');
const vendorPlayerItemsEl = document.getElementById('vendorPlayerItems');
const vendorCloseBtn = document.getElementById('vendorClose');
let previousTabIndex = 0;
let actionMenuOpen = false;
let actionMenuTarget = null;
let actionFocusIndex = 0;
let vendorOpen = false;
let activeVendor = null;

function equipStarterSet() {
  ['leather-tunic', 'soft-boots', 'mariner-gloves', 'rusty-cutlass', 'oak-buckler', 'sapphire-charm'].forEach((id) => {
    const item = inventory.find((i) => i.id === id);
    if (item) equipItem(item);
  });
}

seedInventory();
equipStarterSet();
syncVitalsToGear();
renderCurrency();

const keys = { w: false, a: false, s: false, d: false, shift: false };
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm') {
    toggleMenu();
  }
  if (menuOpen && (e.key.toLowerCase() === 'q' || e.key.toLowerCase() === 'e')) {
    e.preventDefault();
    stepTab(e.key.toLowerCase() === 'e' ? 1 : -1);
  }
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
  if (e.key.toLowerCase() === 'e') interactionQueued = true;
  if (e.key === 'Tab') {
    e.preventDefault();
    selectFromCrosshair();
  }
  if (e.key === 'Escape') {
    if (vendorOpen) closeVendor();
    else if (menuOpen) closeMenu();
    else clearTarget();
  }
  if (e.key === '1') queuePrimaryAttack();
  if (e.key === '2') queueSecondaryAttack();
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

let previousGamepadA = false;
let previousGamepadB = false;
let previousGamepadX = false;
let previousGamepadY = false;
let previousGamepadLB = false;
let previousGamepadRB = false;
let previousGamepadDpadX = 0;
let previousGamepadDpadY = 0;
let hotkeyOverlayTimer = null;

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

function pollGamepadConfirmCancel() {
  const pad = readGamepad();
  if (!pad || !pad.buttons || !pad.buttons.length) {
    previousGamepadA = false;
    previousGamepadB = false;
    previousGamepadX = false;
    previousGamepadY = false;
    previousGamepadLB = false;
    previousGamepadRB = false;
    previousGamepadDpadX = 0;
    previousGamepadDpadY = 0;
    return;
  }

  const buttons = pad.buttons;
  const aPressed = !!buttons[0]?.pressed;
  const bPressed = !!buttons[1]?.pressed;
  const xPressed = !!buttons[2]?.pressed;
  const yPressed = !!buttons[3]?.pressed;
  const lbPressed = !!buttons[4]?.pressed;
  const rbPressed = !!buttons[5]?.pressed;
  const dpadLeft = !!buttons[14]?.pressed;
  const dpadRight = !!buttons[15]?.pressed;
  const dpadUp = !!buttons[12]?.pressed;
  const dpadDown = !!buttons[13]?.pressed;

  const axisX = dpadRight ? 1 : dpadLeft ? -1 : 0;
  const axisY = dpadDown ? 1 : dpadUp ? -1 : 0;

  if (axisX !== 0 && previousGamepadDpadX === 0) {
    if (actionMenuOpen) {
      setActionFocus(axisX);
    } else if (menuOpen) {
      stepTab(axisX);
    } else {
      cycleEnemyTarget(axisX);
    }
  }

  if (axisY !== 0 && previousGamepadDpadY === 0 && actionMenuOpen) {
    setActionFocus(axisY);
  }

  if (aPressed && !previousGamepadA) {
    if (actionMenuOpen) {
      handleActionSelection(actionButtons[actionFocusIndex]?.id.replace('action-', ''));
    } else if (menuOpen) {
      // Confirm within menu reserved for future use
    } else if (selectedTarget) {
      openActionMenu(selectedTarget);
    } else {
      const nearest = findNearestInteractable();
      if (nearest?.type === 'npc') {
        const actor = actorForEntity(nearest.ref.entity);
        if (actor) {
          selectActor(actor);
          openActionMenu(actor);
        }
      } else if (nearest?.type === 'crate') {
        interactWithCrate(nearest.ref);
      } else {
        openMenu();
      }
    }
  }

  if (bPressed && !previousGamepadB) {
    if (vendorOpen) closeVendor();
    else if (actionMenuOpen) closeActionMenu();
    else if (menuOpen) closeMenu();
    else clearTarget();
  }

  if (xPressed && !previousGamepadX) {
    closeActionMenu();
    toggleMenu();
  }

  if (yPressed && !previousGamepadY) {
    queuedAbility = 'slash';
  }

  if (lbPressed && !previousGamepadLB) showHotkeyOverlay('left');
  if (rbPressed && !previousGamepadRB) showHotkeyOverlay('right');

  previousGamepadA = aPressed;
  previousGamepadB = bPressed;
  previousGamepadX = xPressed;
  previousGamepadY = yPressed;
  previousGamepadLB = lbPressed;
  previousGamepadRB = rbPressed;
  previousGamepadDpadX = axisX;
  previousGamepadDpadY = axisY;
}

function readGamepadMove() {
  const pad = readGamepad();
  if (!pad) return { x: 0, y: 0, sprint: false };
  const dx = pad.axes[0] || 0;
  const dy = pad.axes[1] || 0;
  const dead = 0.15;
  const x = Math.abs(dx) > dead ? dx : 0;
  const y = Math.abs(dy) > dead ? dy : 0;
  const sprint = (pad.buttons[6] && pad.buttons[6].pressed) || (pad.buttons[7] && pad.buttons[7].pressed);
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
    const isMove = touch.identifier === touchState.move.id;
    const isLook = touch.identifier === touchState.look.id;
    const ref = isMove ? touchState.move : isLook ? touchState.look : null;
    const delta = ref && ref.start ? { x: touch.clientX - ref.start.x, y: touch.clientY - ref.start.y } : { x: 0, y: 0 };
    if (isMove) resetStick('move');
    if (isLook) resetStick('look');

    const tapDistance = Math.hypot(delta.x, delta.y);
    const tapThreshold = isTouchDevice ? 26 : 12;
    const tapped =
      tapDistance < tapThreshold &&
      !menuOpen &&
      !touch.target.closest('.menu, .menu-toggle, #interact-button, #attack-button');
    if (tapped) {
      handlePointerSelect(touch.clientX, touch.clientY);
    }
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
    const isMove = touch.identifier === touchState.move.id;
    const isLook = touch.identifier === touchState.look.id;
    if (isMove || isLook || menuOpen) continue;
    if (touch.target.closest('.menu, .menu-toggle, #interact-button')) continue;
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

const queueInteract = () => {
  interactionQueued = true;
};
const triggerAttack = () => {
  queuePrimaryAttack();
};

['click', 'touchstart'].forEach((evt) => {
  interactButton.addEventListener(evt, (e) => {
    e.preventDefault();
    queueInteract();
  });
  attackButton.addEventListener(evt, (e) => {
    e.preventDefault();
    triggerAttack();
  });
});

menuToggleBtn.addEventListener('click', () => toggleMenu());
menuToggleBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  toggleMenu();
});
menuCloseBtn.addEventListener('click', () => closeMenu());
menuCloseBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  closeMenu();
});

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => setTab(btn.dataset.tab));
});

actionButtons.forEach((btn) => {
  btn.addEventListener('click', () => handleActionSelection(btn.id.replace('action-', '')));
});

vendorCloseBtn.addEventListener('click', () => closeVendor());
vendorCloseBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  closeVendor();
});
vendorStockEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-stock]');
  if (!btn) return;
  const id = btn.dataset.stock;
  buyItemFromVendor(id);
});
vendorPlayerItemsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.bag-btn');
  if (!btn) return;
  const instanceId = btn.dataset.instance;
  const action = btn.dataset.action;
  const item = inventory.find((i) => i.instanceId === instanceId);
  if (!item) return;
  if (action === 'sell') sellItemToVendor(item, activeVendor);
  if (action === 'equip') {
    equipItem(item);
    renderEquipmentPanel();
    updateInventoryPanel();
    renderVendorPanel();
  }
});

inventoryContentEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.bag-btn');
  if (!btn) return;
  const instanceId = btn.dataset.instance;
  const action = btn.dataset.action;
  const item = inventory.find((i) => i.instanceId === instanceId);
  if (!item) return;

  if (action === 'equip') {
    equipItem(item);
    renderEquipmentPanel();
    updateInventoryPanel();
    renderVendorPanel();
  }

  if (action === 'sell' && activeVendor) {
    sellItemToVendor(item, activeVendor);
  }
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
  previousTabIndex = tabButtons.findIndex((b) => b.dataset.tab === tab);
}

function stepTab(direction) {
  const nextIndex = (previousTabIndex + direction + tabButtons.length) % tabButtons.length;
  const nextTab = tabButtons[nextIndex];
  if (nextTab) setTab(nextTab.dataset.tab);
}

function openMenu() {
  if (menuOpen) return;
  closeActionMenu();
  if (vendorOpen) closeVendor();
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

function showHotkeyOverlay(side = 'left') {
  const label = side === 'right' ? 'Right hotkeys (RB)' : 'Left hotkeys (LB)';
  hotkeyOverlay.textContent = `${label} coming soon.`;
  hotkeyOverlay.classList.remove('hidden');
  clearTimeout(hotkeyOverlayTimer);
  hotkeyOverlayTimer = setTimeout(() => hotkeyOverlay.classList.add('hidden'), 1500);
}

function setActionFocus(indexDelta = 0) {
  const enabledButtons = actionButtons.filter((btn) => !btn.disabled);
  if (!enabledButtons.length) return;
  if (indexDelta !== 0) {
    actionFocusIndex = (actionFocusIndex + indexDelta + enabledButtons.length) % enabledButtons.length;
  } else {
    actionFocusIndex = 0;
  }
  enabledButtons[actionFocusIndex].focus({ preventScroll: true });
}

function closeActionMenu() {
  actionMenuOpen = false;
  actionMenuTarget = null;
  actionMenuEl.classList.add('hidden');
}

function openActionMenu(target) {
  if (!target) return;
  actionMenuTarget = target;
  actionMenuOpen = true;
  actionMenuEl.classList.remove('hidden');
  actionButtons[0].disabled = target.type !== 'npc';
  actionButtons[1].disabled = false;
  actionButtons[2].disabled = false;
  actionButtons[3].disabled = false;
  setActionFocus(0);
}

function renderHelpPanel() {
  helpContentEl.innerHTML = `
    <div><strong>Keyboard</strong>: WASD to move, Mouse to look, Shift to sprint, E to interact, <strong>Tab</strong> to target at crosshair, <strong>1</strong> for melee, <strong>2</strong> for magic, M to open menu, <strong>Esc</strong> to cancel/clear target.</div>
    <div><strong>Gamepad</strong>: Left stick move, Right stick look, hold triggers to sprint, <strong>A</strong> opens the action submenu for the current target, <strong>B</strong> cancels/closes menus and clears targets, <strong>X</strong> toggles the main menu, <strong>Y</strong> triggers a quick attack, LB/RB pop hotkey overlays, and d-pad left/right cycles enemies or tabs (when menus are open).</div>
    <div><strong>Mobile</strong>: Left joystick to move, right joystick to look, tap targets or crates to open actions, <strong>Attack</strong> for combat, enlarged top menu button for panels.</div>
    <div><strong>Vendors</strong>: Talk to Merchant Selene (or any vendor-tagged NPC) then use Buy/Sell buttons. Your coin total mirrors WoW-style gold/silver/copper and updates as you trade or loot.</div>
    <div><strong>Menu Tabs</strong>: Use mouse/touch to click tabs, press Q/E on keyboard to cycle, or d-pad left/right on gamepad when the menu is visible.</div>
  `;
}

function statLine(stats = {}) {
  const parts = Object.entries(stats).map(([k, v]) => `${k} +${v}`);
  return parts.length ? parts.join(' · ') : 'No bonuses';
}

function renderEquipmentPanel() {
  const lines = Object.entries(equipmentSlots).map(([slot, item]) => {
    if (!item) return `<li><strong>${slot}</strong>: Empty</li>`;
    return `<li><strong>${slot}</strong>: ${item.name} <span class="subtle">(${statLine(item.stats)})</span></li>`;
  });
  equipmentContentEl.innerHTML = `
    <div class="card-body">Equipped gear applies bonuses to your stats. Swap pieces to see totals update instantly.</div>
    <ul class="stack-list">${lines.join('')}</ul>
  `;
}

function updateInventoryPanel() {
  const questLine =
    supplyQuest.state === 'active' || supplyQuest.state === 'ready'
      ? `<div class="card-body subtle">Supply crates secured: ${supplyQuest.progress}/${supplyQuest.required}</div>`
      : `<div class="card-body subtle">Pick up marked crates around the docks to fill this quest.</div>`;

  const slots = [];
  for (let i = 0; i < bagCapacity; i++) {
    const item = inventory[i];
    if (item) {
      const equipButton = item.slot
        ? `<button class="bag-btn equip" data-action="equip" data-instance="${item.instanceId}">Equip</button>`
        : '';
      const sellButton = vendorOpen && activeVendor
        ? `<button class="bag-btn sell" data-action="sell" data-instance="${item.instanceId}">Sell (${formatValueCopper(
            Math.max(5, Math.floor((item.value || 10) * (activeVendor.vendor?.sellMultiplier || 0.25)))
          )})</button>`
        : '';
      slots.push(`
        <div class="bag-slot">
          <div>
            <div class="bag-item-name">${item.name}</div>
            <div class="bag-item-slot">${item.slot ? `Equip: ${item.slot}` : 'Carry/Use'} · ${formatValueCopper(item.value || 0)}</div>
            <div class="subtle">${item.note || ''}</div>
            <div class="statline">${statLine(item.stats)}</div>
          </div>
          <div class="bag-actions">${equipButton}${sellButton}</div>
        </div>
      `);
    } else {
      slots.push('<div class="bag-slot empty">Empty slot</div>');
    }
  }

  inventoryContentEl.innerHTML = `
    <div class="currency-row">
      <span>Bags: ${inventory.length}/${bagCapacity}</span>
      <span class="currency-value">${formatCurrency()}</span>
    </div>
    <div class="card-body">Backpack slots ready for loot and spare gear. Equip pieces to move them into your worn set.</div>
    ${questLine}
    <div class="bag-grid">${slots.join('')}</div>
  `;
}

function openVendor(npc) {
  if (!npc?.vendor) return;
  activeVendor = npc;
  vendorOpen = true;
  vendorPanel.classList.remove('hidden');
  closeActionMenu();
  renderVendorPanel();
}

function closeVendor() {
  vendorOpen = false;
  activeVendor = null;
  vendorPanel.classList.add('hidden');
  renderInventoryPanel();
}

function sellItemToVendor(item, npc) {
  if (!npc?.vendor) return;
  const multiplier = npc.vendor.sellMultiplier ?? 0.25;
  const payout = Math.max(5, Math.floor((item.value || 10) * multiplier));
  const idx = inventory.findIndex((i) => i.instanceId === item.instanceId);
  if (idx !== -1) inventory.splice(idx, 1);
  adjustCurrency(payout);
  renderCurrency();
  renderInventoryPanel();
  renderVendorPanel();
  showDialogue(npc.name, `Sold ${item.name} for ${formatValueCopper(payout)}.`);
}

function buyItemFromVendor(templateId) {
  if (!activeVendor?.vendor) return;
  const template = itemTemplates[templateId];
  if (!template) return;
  const cost = Math.max(5, Math.floor((template.value || 10) * (activeVendor.vendor.buyMultiplier ?? 1)));
  if (copperTotal() < cost) {
    showDialogue('Not enough coin', 'You need more coin to purchase that.');
    return;
  }
  if (!addToInventory(template)) return;
  adjustCurrency(-cost);
  renderCurrency();
  renderVendorPanel();
  showDialogue(activeVendor.name, `You bought ${template.name} for ${formatValueCopper(cost)}.`);
}

function renderVendorPanel() {
  if (!vendorOpen || !activeVendor) return;
  const npc = activeVendor;
  if (currencyDisplayEl) currencyDisplayEl.textContent = formatCurrency();

  const playerSlots = inventory.map((item) => {
    const payout = Math.max(5, Math.floor((item.value || 10) * (npc.vendor?.sellMultiplier ?? 0.25)));
    return `
      <div class="bag-slot">
        <div>
          <div class="bag-item-name">${item.name}</div>
          <div class="bag-item-slot">${item.slot ? `Equip: ${item.slot}` : 'Carry/Use'} · ${formatValueCopper(item.value || 0)}</div>
          <div class="subtle">${item.note || ''}</div>
          <div class="statline">${statLine(item.stats)}</div>
        </div>
        <div class="bag-actions">
          <button class="bag-btn sell" data-action="sell" data-instance="${item.instanceId}">Sell (${formatValueCopper(payout)})</button>
          ${item.slot ? `<button class="bag-btn equip" data-action="equip" data-instance="${item.instanceId}">Equip</button>` : ''}
        </div>
      </div>
    `;
  });

  const stock = (npc.vendor?.stock || []).map((id) => {
    const template = itemTemplates[id];
    if (!template) return '';
    const cost = Math.max(5, Math.floor((template.value || 10) * (npc.vendor.buyMultiplier ?? 1)));
    return `
      <div class="bag-slot">
        <div>
          <div class="bag-item-name">${template.name}</div>
          <div class="bag-item-slot">${template.slot ? `Equip: ${template.slot}` : 'Carry/Use'} · ${formatValueCopper(template.value || 0)}</div>
          <div class="subtle">${template.note || ''}</div>
          <div class="statline">${statLine(template.stats)}</div>
        </div>
        <div class="bag-actions">
          <button class="bag-btn" data-stock="${template.id}" data-cost="${cost}">Buy (${formatValueCopper(cost)})</button>
        </div>
      </div>
    `;
  });

  vendorPlayerItemsEl.innerHTML = playerSlots.join('') || '<div class="bag-slot empty">Nothing to sell.</div>';
  vendorStockEl.innerHTML = stock.join('') || '<div class="bag-slot empty">Stock coming soon.</div>';
}

function updateHud() {
  const p = camera.getPosition();
  const zone = p.x > desertStartX - 120 ? 'Freeport Desert' : 'Freeport';
  posLabel.textContent = `${zone} · ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`;
}

function renderClassPanel() {
  const stats = buildPlayerStats();
  const gear = gearBonuses();
  const lines = [
    `<strong>${playerProfile.name}</strong> — Level ${playerProfile.level} ${playerProfile.classKey}`,
    `HP ${Math.round(playerState.health)}/${stats.HP} · Mana ${Math.round(playerState.mana)}/${stats.Mana} · AC ${stats.AC}`,
    `STR ${stats.STR} · STA ${stats.STA} · AGI ${stats.AGI} · DEX ${stats.DEX}`,
    `INT ${stats.INT} · WIS ${stats.WIS} · CHA ${stats.CHA}`,
    `<span class="subtle">Gear bonuses: ${statLine(gear)}</span>`,
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
  if (actor.head && actor.head.getPosition) return actor.head.getPosition().clone();
  if (actor.entity && actor.entity.getPosition) return actor.entity.getPosition().clone();
  return new pc.Vec3();
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
  nameplateHealthText.textContent = `${Math.round(selectedTarget.health)}/${Math.round(selectedTarget.maxHealth)} HP`;
  nameplateEl.classList.remove('hidden');
}

function selectActor(actor) {
  selectedTarget = actor;
  updateNameplatePosition();
}

function clearTarget() {
  selectedTarget = null;
  closeActionMenu();
  updateNameplatePosition();
}

function cycleEnemyTarget(direction) {
  const enemies = actors.filter((a) => a.type === 'enemy' && !a.dead && a.health > 0);
  if (!enemies.length) return;
  let index = 0;
  if (selectedTarget && selectedTarget.type === 'enemy') {
    const currentIndex = enemies.findIndex((e) => e.id === selectedTarget.id);
    index = currentIndex === -1 ? 0 : (currentIndex + direction + enemies.length) % enemies.length;
  } else if (direction < 0) {
    index = enemies.length - 1;
  }
  selectActor(enemies[index]);
}

function selectFromCrosshair() {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  handlePointerSelect(cx, cy);
}

function pickTargetAtScreen(clientX, clientY) {
  let closest = null;
  const selectionRadius = isTouchDevice ? 260 : 160;
  let closestDist = selectionRadius;

  actors.forEach((actor) => {
    const worldPos = getHeadPosition(actor);
    camera.camera.worldToScreen(worldPos, screenPos);
    if (screenPos.z < 0) return;
    const dx = screenPos.x - clientX;
    const dy = screenPos.y - clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) {
      closest = { type: 'actor', ref: actor, dist };
      closestDist = dist;
    }
  });

  questCrates.forEach((crate) => {
    if (crate.collected && supplyQuest.state !== 'active') return;
    const worldPos = crate.entity.getPosition().clone();
    worldPos.y += 1.6;
    camera.camera.worldToScreen(worldPos, screenPos);
    if (screenPos.z < 0) return;
    const dx = screenPos.x - clientX;
    const dy = screenPos.y - clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) {
      closest = { type: 'crate', ref: crate, dist };
      closestDist = dist;
    }
  });

  return closest;
}

function handlePointerSelect(clientX, clientY) {
  const target = pickTargetAtScreen(clientX, clientY);
  if (!target) return;

  if (target.type === 'actor') {
    selectActor(target.ref);
    openActionMenu(target.ref);
  }

  if (target.type === 'crate') {
    interactWithCrate(target.ref);
  }
}

function actorForEntity(entity) {
  return actors.find((a) => a.entity === entity) || null;
}

function npcForActor(actor) {
  return npcs.find((n) => n.actorId === actor.id) || null;
}

function handleActionSelection(actionKey) {
  const target = actionMenuTarget || selectedTarget;
  if (!target) return;

  if (actionKey === 'talk') {
    if (target.type === 'npc') {
      const npc = npcForActor(target);
      if (npc?.vendor) {
        openVendor(npc);
      } else if (npc) interactWithNPC(npc);
    } else {
      showDialogue('Action', 'You can only talk to townsfolk.');
    }
    closeActionMenu();
    return;
  }

  if (actionKey === 'attack') {
    selectActor(target);
    if (target.type === 'enemy') {
      queuedAbility = 'slash';
    } else if (target.type === 'npc') {
      showDialogue('Friendly', `${target.name} is not looking for a fight.`);
    } else {
      showDialogue('Action', 'Find a hostile target to attack.');
    }
    closeActionMenu();
    return;
  }

  if (actionKey === 'item') {
    if (target.type === 'npc') {
      const npc = npcForActor(target);
      if (npc?.vendor) {
        openVendor(npc);
        closeActionMenu();
        return;
      }
    }
    showDialogue(target.name || 'Target', 'Using items on targets will arrive soon.');
    closeActionMenu();
    return;
  }

  if (actionKey === 'check') {
    const hpLine = target.maxHealth
      ? `${Math.round(target.health)}/${Math.round(target.maxHealth)} HP`
      : 'Unknown vitality';
    showDialogue(target.name || 'Target', `Level ${target.level || '?'} · ${hpLine}`);
    closeActionMenu();
  }
}

function abilityKey(actor, ability) {
  return `${actor.id}:${ability.id}`;
}

function abilityReady(actor, ability) {
  const key = abilityKey(actor, ability);
  const last = combatState.abilityCooldowns.get(key) || 0;
  return performance.now() - last >= ability.cooldown * 1000;
}

function markAbilityUsed(actor, ability) {
  combatState.abilityCooldowns.set(abilityKey(actor, ability), performance.now());
}

function randomDamage(ability) {
  return ability.minDamage + Math.random() * (ability.maxDamage - ability.minDamage);
}

function actorPosition(actor) {
  return actor.entity.getPosition();
}

function distanceBetweenActors(a, b) {
  return actorPosition(a).distance(actorPosition(b));
}

function applyDamage(attacker, target, amount) {
  if (!target || target.health <= 0) return;
  const newHp = Math.max(0, target.health - amount);
  target.health = newHp;
  if (target.type === 'player') {
    playerState.health = newHp;
    if (playerState.health <= 0) {
      playerState.health = playerState.maxHealth;
      target.health = playerState.maxHealth;
      playerState.mana = playerState.maxMana;
      target.mana = playerState.maxMana;
      camera.setLocalPosition(10, 5.5, 0);
      showDialogue('You come to.', 'You awaken at the plaza after collapsing.');
    }
  }

  if (target.health <= 0) {
    handleDeath(target);
  }
  updateNameplatePosition();
  renderClassPanel();
}

function respawnActor(actor) {
  if (!actor.respawn) return;
  actor.health = actor.maxHealth;
  actor.mana = actor.maxMana || 0;
  actor.dead = false;
  actor.target = null;
  actor.entity.enabled = true;
  if (actor.respawn.spawnPoint) {
    actor.entity.setLocalPosition(actor.respawn.spawnPoint);
  }
}

function handleDeath(actor) {
  actor.dead = true;
  actor.target = null;
  if (selectedTarget === actor) {
    updateNameplatePosition();
  }
  if (actor.type === 'enemy') {
    actor.entity.enabled = false;
    if (actor.tags?.includes('bat')) {
      grantLoot('dock-rations', actor.name);
    }
    if (actor.tags?.includes('desert')) {
      if (Math.random() > 0.5) grantLoot('desert-spices', actor.name);
    }
    if (actor.respawn) {
      setTimeout(() => respawnActor(actor), actor.respawn.delay * 1000);
    }
  }
}

function ensureAggroOnHit(defender, attacker) {
  if (defender.type !== 'enemy') return;
  defender.target = attacker;
}

function useAbility(actor, ability, target) {
  if (!ability || !actor || !target) return false;
  if (target.health <= 0 || actor.health <= 0) return false;
  if (!abilityReady(actor, ability)) return false;

  const dist = distanceBetweenActors(actor, target);
  if (dist > ability.range) {
    showDialogue('Out of range', `${ability.name} needs to be closer.`);
    return false;
  }

  if (ability.manaCost && actor.mana !== undefined) {
    if (actor.mana < ability.manaCost) {
      showDialogue('Not enough mana', `${ability.name} requires ${ability.manaCost} mana.`);
      return false;
    }
    actor.mana -= ability.manaCost;
    if (actor === playerActor) {
      playerState.mana = actor.mana;
      renderClassPanel();
    }
  }

  const dmg = randomDamage(ability);
  applyDamage(actor, target, dmg);
  markAbilityUsed(actor, ability);

  if (target.type === 'enemy') {
    ensureAggroOnHit(target, actor);
  }

  return true;
}

function queuePrimaryAttack() {
  queuedAbility = 'slash';
}

function queueSecondaryAttack() {
  queuedAbility = 'emberBolt';
}

function ensureSupplyQuestActive() {
  if (supplyQuest.state === 'available') {
    supplyQuest.state = 'active';
    supplyQuest.progress = 0;
    resetCrateAppearance();
    updateQuestStatus();
  }
}

function interactWithCrate(crate) {
  ensureSupplyQuestActive();
  if (crate.collected || supplyQuest.state !== 'active') return;
  crate.collected = true;
  crate.entity.render.material = makeMaterial(new pc.Color(0.32, 0.24, 0.2), 0, 0.8);
  supplyQuest.progress = Math.min(supplyQuest.required, supplyQuest.progress + 1);
  showDialogue('Supply Crate', `You secure a crate. ${supplyQuest.progress}/${supplyQuest.required} gathered.`);
  if (Math.random() > 0.45) {
    grantLoot('dock-rations', 'Supply Crate');
  }
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

  if (npc.vendor) {
    openVendor(npc);
    return;
  }

  if (npc.questGiver) {
    if (supplyQuest.state === 'available') {
      ensureSupplyQuestActive();
    } else if (supplyQuest.state === 'ready') {
      supplyQuest.state = 'available';
      supplyQuest.progress = 0;
      resetCrateAppearance();
      adjustCurrency(250);
      showDialogue(npc.name, 'Well done. Here is your silver. Crates arrive often—keep them coming.');
      updateQuestStatus();
      return;
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
    if (crate.collected || (supplyQuest.state !== 'active' && supplyQuest.state !== 'available')) return;
    const dist = crate.entity.getPosition().distance(playerPos);
    if (dist <= nearestDist) {
      nearest = { type: 'crate', ref: crate };
      nearestDist = dist;
    }
  });

  return nearest;
}

function findCombatTarget() {
  if (selectedTarget && selectedTarget.health > 0 && selectedTarget.type !== 'npc') return selectedTarget;
  let fallback = null;
  let nearestDist = 18;
  actors.forEach((actor) => {
    if (actor.type !== 'enemy' || actor.health <= 0 || actor.dead) return;
    const d = actorPosition(actor).distance(camera.getPosition());
    if (d < nearestDist) {
      fallback = actor;
      nearestDist = d;
    }
  });
  return fallback;
}

function handleQueuedAbility() {
  if (!queuedAbility) return;
  const ability = abilityBook[queuedAbility];
  const target = findCombatTarget();
  if (!target) {
    showDialogue('No target', 'Select or tap a foe to use abilities.');
    queuedAbility = null;
    return;
  }
  if (useAbility(playerActor, ability, target)) {
    selectActor(target);
  }
  queuedAbility = null;
}

function updateEnemyAI() {
  actors.forEach((actor) => {
    if (actor.type !== 'enemy' || actor.health <= 0 || actor.dead) return;
    if (!actor.target || actor.target.health <= 0) {
      actor.target = null;
      return;
    }
    const ability = actor.abilities[0] || abilityBook.enemyBite;
    if (!abilityReady(actor, ability)) return;
    if (distanceBetweenActors(actor, actor.target) <= ability.range + 0.5) {
      useAbility(actor, ability, actor.target);
    }
  });
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

function updateDayNight(dt) {
  timeOfDay = (timeOfDay + dt) % dayDuration;
  const phase = (timeOfDay / dayDuration) * Math.PI * 2;
  const elevation = clamp01(Math.sin(phase));
  const daylight = clamp01(elevation);

  const sunPitch = lerp(10, 75, daylight);
  const sunYaw = (phase * 180) / Math.PI;
  light.setLocalEulerAngles(sunPitch, sunYaw, 0);
  light.light.intensity = lerp(0.2, 2.2, daylight);

  mixColor(ambientNight, ambientDay, daylight, tmpColor);
  app.scene.ambientLight.copy(tmpColor);
  app.scene.exposure = lerp(0.8, 1.25, daylight);

  mixColor(duskColor, dayColor, daylight, tmpColor);
  camera.camera.clearColor.copy(tmpColor);

  mixColor(fogNightColor, fogDayColor, daylight, tmpColor);
  app.scene.fogColor.copy(tmpColor);
  app.scene.fogDensity = lerp(fogNightDensity, fogDayDensity, daylight);

  lanterns.forEach((lantern) => {
    const targetIntensity = lerp(3.1, 0, daylight);
    lantern.light.intensity = targetIntensity;
    lantern.enabled = targetIntensity > 0.05;
  });
}

function updateWaterSurfaces(dt) {
  waterTime += dt;
  const surfacePulse = Math.sin(waterTime * 0.8) * 0.05 + Math.cos(waterTime * 0.35) * 0.03;
  const daylight = clamp01(Math.sin((timeOfDay / dayDuration) * Math.PI * 2));
  waterSurfaces.forEach((surface) => {
    const brighten = clamp01(0.85 + daylight * 0.25 + surfacePulse * 0.2);
    waterTint.r = surface.baseColor.r * brighten;
    waterTint.g = surface.baseColor.g * brighten;
    waterTint.b = surface.baseColor.b * brighten;
    surface.material.diffuse.copy(waterTint);
    surface.material.update();
  });
}

function updateBeacons(dt) {
  rotatingBeacons.forEach((beacon) => {
    const euler = beacon.entity.getLocalEulerAngles();
    euler.y += beacon.speed * dt;
    beacon.entity.setLocalEulerAngles(euler);
    const daylight = clamp01(Math.sin((timeOfDay / dayDuration) * Math.PI * 2));
    beacon.entity.light.intensity = lerp(3, 0.6, daylight);
  });
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
  updateDayNight(dt);
  updateBeacons(dt);
  updateWaterSurfaces(dt);
  pollGamepadConfirmCancel();
  if (menuOpen) {
    updateNameplatePosition();
    return;
  }

  // Gamepad/touch look first so we clamp after
  applyGamepadLook(dt);
  applyTouchLook(dt);
  handleQueuedAbility();

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

  // Lightweight regen to keep testing flowing
  if (playerState.health < playerState.maxHealth) {
    playerState.health = Math.min(playerState.maxHealth, playerState.health + dt * 2.5);
    playerActor.health = playerState.health;
  }
  if (playerState.mana < playerState.maxMana) {
    playerState.mana = Math.min(playerState.maxMana, playerState.mana + dt * 3);
    playerActor.mana = playerState.mana;
  }

  updateEnemyAI(dt);

  pitch = pc.math.clamp(pitch, -1.2, 1.2);
  camera.setLocalEulerAngles(radToDeg(pitch), radToDeg(yaw), 0);

  const nearest = findNearestInteractable();
  if (nearest?.type === 'npc') {
    interactionHint.innerHTML = `Press <strong>E</strong> / A (actions) / tap Interact to open options for ${nearest.ref.name}.`;
    interactionHint.classList.remove('hidden');
    if (interactionQueued) {
      interactWithNPC(nearest.ref);
    }
  } else if (nearest?.type === 'crate') {
    interactionHint.innerHTML = 'Press <strong>E</strong> / A (actions) / tap Interact to secure this supply crate.';
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
renderEquipmentPanel();
setTab('stats');
updateHud();
app.start();
