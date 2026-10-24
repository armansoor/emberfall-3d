'use strict';
/* Emberfall 3D — main game engine. Three.js (global CDN build) + HTML UI.
   World coordinates: x = east, z = south (world.js stores south as `y`, so z = y).
   If Three.js fails to load, a clear in-page error is shown instead of a blank screen. */
(function () {
const $ = id => document.getElementById(id);
const canvas = $('game'), mm = $('minimap'), mmCtx = mm ? mm.getContext('2d') : null;
const SAVE_KEY = 'emberfall3d_save_v1';
const HAS_THREE = typeof THREE !== 'undefined';
const CLASSES = {
  Knight: { hp: 130, mp: 40, atk: 16, speed: 175, range: 90, cooldown: 380, projectile: false, icon: '🛡️' },
  Mage:   { hp: 85,  mp: 110, atk: 21, speed: 160, range: 360, cooldown: 420, projectile: true, mpCost: 8, icon: '🔮' },
  Ranger: { hp: 105, mp: 60, atk: 14, speed: 205, range: 320, cooldown: 240, projectile: true, mpCost: 0, icon: '🏹' }
};
const DIFF = { Story: { hp: 0.7, dmg: 0.6 }, Normal: { hp: 1, dmg: 1 }, Hardcore: { hp: 1.45, dmg: 1.6 } };
const ARMOUR_FORMULA = 'Damage taken = max(1, enemy damage − total defence)';

let S = null;
let mode = 'title';
let keys = {}, joyVec = { x: 0, y: 0 };
let lastTime = 0, lastAttack = -100000, mmTimer = 0, toastTimer = null;
let selClass = 'Knight', selColor = '#e74c3c', selDiff = 'Normal';
let currentShop = 'general';
let pendingAdult = false; // in-memory only: never stored, never a birth year
let propCullTimer = 0;
let scene = null, camera = null, renderer = null, sun = null, ambient = null;
let playerMesh = null, fireMesh = null;
let groundTileCount = 0, propMeshes = [], treeMeshes = [];
let npcMeshes = {}, shardMeshes = {}, chestMeshes = {}, herbMeshes = {}, fishMeshes = {}, clueMeshes = {};

function hexNum(hex) { return parseInt(String(hex).replace('#', ''), 16); }
function mat(color) { return new THREE.MeshLambertMaterial({ color: hexNum(color) }); }
function makeFigure(color, scale, withMarker) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(14, 18, 36, 8), mat(color)); body.position.y = 18; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(11, 10, 8), mat('#f5cba7')); head.position.y = 48; g.add(head);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 6), mat(color)); nose.position.set(20, 18, 0); g.add(nose);
  if (withMarker) { const mk = new THREE.Mesh(new THREE.ConeGeometry(8, 18, 4), mat('#ffeb3b')); mk.position.y = 72; g.add(mk); }
  if (scale && scale !== 1) { g.scale.set(scale, scale, scale); }
  return g;
}
function makeHealthBar() {
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.BoxGeometry(44, 4, 2), mat('#222222')); back.position.y = 68; g.add(back);
  const front = new THREE.Mesh(new THREE.BoxGeometry(44, 4, 3), mat('#e74c3c')); front.position.y = 68; g.add(front);
  return { group: g, front };
}
function makePropMesh(pr) {
  const g = new THREE.Group();
  if (pr.kind === 'house' || pr.kind === 'hall') {
    const w = pr.w, h = 60;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.7), mat('#8d6e63')); base.position.y = h / 2; g.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.7, 40, 4), mat('#b03a2e')); roof.position.y = h + 20; roof.rotation.y = Math.PI / 4; g.add(roof);
  } else if (pr.kind === 'tree') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 18, 6), mat('#6d4c41')); trunk.position.y = 9; g.add(trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(20, 38, 8), mat('#1e8449')); top.position.y = 34; g.add(top);
  } else if (pr.kind === 'palm') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 26, 6), mat('#6d4c41')); trunk.position.y = 13; g.add(trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(18, 22, 8), mat('#27ae60')); top.position.y = 32; g.add(top);
  } else if (pr.kind === 'willow') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 26, 6), mat('#5d4037')); trunk.position.y = 13; g.add(trunk);
    const top = new THREE.Mesh(new THREE.SphereGeometry(20, 8, 6), mat('#7fb069')); top.position.y = 36; g.add(top);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 6), mat('#9b59b6')); glow.position.y = 36; g.add(glow);
  } else if (pr.kind === 'pine') {
    const top = new THREE.Mesh(new THREE.ConeGeometry(17, 42, 8), mat('#dfe9f2')); top.position.y = 24; g.add(top);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 10, 6), mat('#6d4c41')); trunk.position.y = 5; g.add(trunk);
  } else if (pr.kind === 'peak') {
    const top = new THREE.Mesh(new THREE.ConeGeometry(22, 48, 4), mat('#7f8c8d')); top.position.y = 24; g.add(top);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(10, 16, 4), mat('#ffffff')); cap.position.y = 42; g.add(cap);
  } else if (pr.kind === 'cactus') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(10, 34, 10), mat('#229954')); b.position.y = 17; g.add(b);
  } else if (pr.kind === 'dead') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 30, 6), mat('#4a235a')); b.position.y = 15; g.add(b);
  } else if (pr.kind === 'rock') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(13, 8, 6), mat('#7f8c8d')); b.position.y = 6; b.scale.y = 0.6; g.add(b);
  } else {
    const b = new THREE.Mesh(new THREE.SphereGeometry(4, 6, 5), mat('#e91e63')); b.position.y = 4; g.add(b);
  }
  g.position.set(pr.x, 0, pr.y);
  return g;
}
function initScene() {
  if (!HAS_THREE) {
    const err = $('webgl-error'); if (err) err.classList.remove('hidden');
    const load = $('loading'); if (load) load.classList.add('hidden');
    return false;
  }
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, (canvas.width || 960) / (canvas.height || 600), 1, 12000);
  camera.position.set(SPAWN.x, 340, SPAWN.y + 420);
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    if (renderer.setPixelRatio) renderer.setPixelRatio(1);
    renderer.setSize(canvas.width || 960, canvas.height || 600);
  } catch (e) {
    const err = $('webgl-error'); if (err) { err.textContent = '3D could not start on this device/browser: ' + e.message; err.classList.remove('hidden'); }
    return false;
  }
  ambient = new THREE.AmbientLight(0xffffff, 0.65); scene.add(ambient);
  sun = new THREE.DirectionalLight(0xfff2cc, 0.9); sun.position.set(1000, 2000, 500); scene.add(sun);
  const TS = 640;
  for (let tz = 0; tz < Math.ceil(WORLD.H / TS); tz++) for (let tx = 0; tx < Math.ceil(WORLD.W / TS); tx++) {
    const cx = tx * TS + TS / 2, cz = tz * TS + TS / 2, b = getBiome(cx, cz);
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(TS, TS), mat(BIOME_COLORS[b][0]));
    tile.rotation.x = -Math.PI / 2; tile.position.set(cx, 0, cz); scene.add(tile); groundTileCount++;
  }
  ROADS.forEach(road => {
    for (let i = 0; i < road.points.length - 1; i++) {
      const [x1, z1] = road.points[i], [x2, z2] = road.points[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(len, 2, 26), mat('#8d6e63'));
      strip.position.set((x1 + x2) / 2, 1, (z1 + z2) / 2);
      strip.rotation.y = -Math.atan2(z2 - z1, x2 - x1); scene.add(strip);
    }
  });
  const lake = new THREE.Mesh(new THREE.CylinderGeometry(220, 220, 3, 20), mat('#3498db'));
  lake.position.set(1000, 2, 1100); scene.add(lake);
  const moonLake = new THREE.Mesh(new THREE.CylinderGeometry(170, 170, 3, 20), mat('#7d8fb3'));
  moonLake.position.set(6400, 2, 2000); scene.add(moonLake);
  PROPS.forEach(pr => {
    const m = makePropMesh(pr); scene.add(m);
    propMeshes.push({ mesh: m, x: pr.x, z: pr.y, kind: pr.kind });
    if (pr.kind === 'tree' || pr.kind === 'palm') treeMeshes.push(m);
  });
  fireMesh = new THREE.Mesh(new THREE.ConeGeometry(16, 34, 8), mat('#ff6a00'));
  fireMesh.position.set(VILLAGE.x + 490, 17, VILLAGE.y + 410); scene.add(fireMesh);
  NPCS.forEach(n => { const m = makeFigure(n.color, 1, true); m.position.set(n.x, 0, n.y); scene.add(m); npcMeshes[n.id] = m; });
  SHARD_SPOTS.forEach(s => {
    const col = s.id === 'forest' ? '#2ecc71' : s.id === 'desert' ? '#f1c40f' : '#5dade2';
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(26), mat(col)); m.position.set(s.x, 60, s.y); scene.add(m); shardMeshes[s.id] = m;
  });
  CHESTS.forEach(c => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(36, 22, 26), mat('#8d6e63')); base.position.y = 11; g.add(base);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(36, 8, 26), mat('#b9770e')); lid.position.y = 26; g.add(lid);
    g.position.set(c.x, 0, c.y); scene.add(g); chestMeshes[c.id] = { group: g, lid };
  });
  HERB_SPOTS.forEach(s => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(6, 6, 5), mat('#27ae60')); leaf.position.set((i - 1) * 10, 8, 0); g.add(leaf); }
    g.position.set(s.x, 0, s.y); scene.add(g); herbMeshes[s.id] = g;
  });
  FISH_SPOTS.forEach(s => {
    const g = new THREE.Group();
    const spot = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 4, 12), mat('#2980b9')); spot.position.y = 2; g.add(spot);
    g.position.set(s.x, 0, s.y); scene.add(g); fishMeshes[s.id] = g;
  });
  CLUE_SPOTS.forEach(s => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(16), mat('#ffeb3b')); m.position.set(s.x, 30, s.y); scene.add(m); clueMeshes[s.id] = m;
  });
  const load = $('loading'); if (load) load.classList.add('hidden');
  return true;
}
function syncDynamicMeshes() {
  if (!S || !scene) return;
  SHARD_SPOTS.forEach(s => { if (shardMeshes[s.id]) shardMeshes[s.id].visible = !S.quests.main.shards[s.id]; });
  CHESTS.forEach(c => {
    const cm = chestMeshes[c.id]; if (!cm) return;
    cm.lid.rotation.x = (S.chestsOpened || []).includes(c.id) ? -1.1 : 0;
  });
  HERB_SPOTS.forEach(s => { if (herbMeshes[s.id]) herbMeshes[s.id].visible = S.quests.herbs && S.quests.herbs.state === 1 && !(S.quests.herbs.collected || []).includes(s.id); });
  FISH_SPOTS.forEach(s => { if (fishMeshes[s.id]) fishMeshes[s.id].visible = S.quests.fish && S.quests.fish.state === 1 && !(S.quests.fish.spots || []).includes(s.id); });
  CLUE_SPOTS.forEach(s => { if (clueMeshes[s.id]) clueMeshes[s.id].visible = S.quests.missing && S.quests.missing.state === 1 && !(S.quests.missing.clues || []).includes(s.id); });
}
function setMeshPos(m, x, z, face) {
  if (!m) return;
  m.position.set(x, 0, z);
  if (typeof face === 'number') m.rotation.y = -face;
}

/* ---------- State ---------- */
function defaultQuests() {
  return {
    main: { stage: 0, shards: { forest: false, desert: false, snow: false } },
    slimes: { state: 0, kills: 0, need: 5 },
    amulet: { state: 0, has: false },
    herbs: { state: 0, collected: [] },
    fish: { state: 0, caught: 0, need: 3, spots: [] },
    missing: { state: 0, clues: [], bruteDead: false },
    romance: { elara: 0, kael: 0 },
    adultQuest: { state: 0, choice: null }
  };
}
function newPlayer(cfg) {
  const c = CLASSES[cfg.cls];
  return {
    name: cfg.name, cls: cfg.cls, color: cfg.color, diff: cfg.diff, icon: c.icon,
    x: SPAWN.x, z: SPAWN.y, y: SPAWN.y, r: 17, level: 1, xp: 0, xpNext: 80, gold: 40,
    maxHp: c.hp, hp: c.hp, maxMp: c.mp, mp: c.mp, atk: c.atk, atkBonus: 0, defence: 0,
    speed: c.speed, face: -Math.PI / 2, ngPlus: 0, invulnUntil: 0,
    potions: { hp: 2, mp: 1, elixir: 0, mega: 0 },
    inventory: [], equipped: { weapon: null, armour: null }
  };
}
function totalDefence(p) {
  let d = p.defence || 0;
  const arm = (p.inventory || []).find(i => i.id === p.equipped.armour);
  if (arm) d += arm.defence || 0;
  return d;
}
function totalAttack(p) {
  let a = p.atk + (p.atkBonus || 0);
  const w = (p.inventory || []).find(i => i.id === p.equipped.weapon);
  if (w) a += w.atk || 0;
  return a;
}
function enemyScale() { const d = S ? DIFF[S.player.diff] || DIFF.Normal : DIFF.Normal; const ng = S ? S.player.ngPlus : 0; return { hp: d.hp * (1 + 0.5 * ng), dmg: d.dmg * (1 + 0.35 * ng) }; }
function makeEnemy(typeKey, x, z, extra) {
  const t = ENEMY_TYPES[typeKey], sc = enemyScale();
  const e = Object.assign({
    type: typeKey, name: t.name, icon: t.icon, color: t.color, x, z, y: z, r: t.r,
    maxHp: Math.round(t.hp * sc.hp), hp: Math.round(t.hp * sc.hp),
    dmg: Math.round(t.dmg * sc.dmg), speed: t.speed, xp: t.xp,
    goldMin: t.gold[0], goldMax: t.gold[1], atkCd: 0, homeX: x, homeZ: z, homeY: z,
    dead: false, respawnIn: 0, behaviour: t.behaviour || 'melee', armour: t.armour || 0,
    telegraphing: false, telegraph: 0, stuck: 0, lastX: x, lastZ: z, dying: 0, mesh: null, barFront: null, face: 0
  }, extra || {});
  if (scene) {
    const scale = typeKey === 'boss' ? 1.8 : typeKey === 'golem' ? 1.4 : 1;
    const fig = makeFigure(t.color, scale, false);
    const bar = makeHealthBar(); fig.add(bar.group); e.barFront = bar.front;
    fig.position.set(x, 0, z); scene.add(fig); e.mesh = fig;
  }
  return e;
}
function spawnWorldEnemies() {
  S.enemies = [];
  const rnd = mulberry32(4242 + (S.player.ngPlus * 97));
  const plan = [['slime', 14, 'forest'], ['slime', 6, 'village'], ['wolf', 10, 'forest'], ['scorpion', 12, 'desert'], ['wraith', 12, 'snow'], ['imp', 10, 'shadow'], ['crab', 10, 'coast'], ['goblin', 10, 'highlands'], ['spider', 8, 'highlands'], ['archer', 8, 'highlands'], ['golem', 4, 'highlands'], ['wisp', 10, 'vale']];
  plan.forEach(([type, n, biome]) => {
    for (let i = 0; i < n; i++) {
      let x, z, tries = 0;
      do { x = 120 + rnd() * (WORLD.W - 240); z = 120 + rnd() * (WORLD.H - 240); tries++; } while ((getBiome(x, z) !== biome || Math.hypot(x - SPAWN.x, z - SPAWN.y) < 260) && tries < 60);
      if (getBiome(x, z) === biome) S.enemies.push(makeEnemy(type, x, z, { respawns: true }));
    }
  });
  [[2950, 2550], [3050, 2650], [3000, 2500]].forEach(p => S.enemies.push(makeEnemy('imp', p[0], p[1], { respawns: true })));
  [[2750, 3750], [2850, 3850]].forEach(p => S.enemies.push(makeEnemy('spider', p[0], p[1], { respawns: true })));
  SHARD_SPOTS.forEach(s => S.enemies.push(makeEnemy('guardian', s.x + 70, s.y + 40, { name: s.guardian, guardShard: s.id, respawns: false })));
  S.enemies.push(makeEnemy('crab', 4700, 2100, { name: 'Coast Brute', brute: true, respawns: false, maxHp: 160, hp: 160, dmg: 18 }));
}
function spawnBoss() {
  if (S.enemies.some(e => e.type === 'boss' && !e.dead)) return;
  S.enemies.push(makeEnemy('boss', BOSS_SPOT.x, BOSS_SPOT.y, { respawns: false }));
  EmberAudio.boss(); toast('👹 Malachar has awakened in the Shadowlands!');
}
function makePlayerMesh() {
  if (!scene || !S) return;
  if (playerMesh) { try { scene.remove(playerMesh); } catch (e) {} }
  playerMesh = makeFigure(S.player.color, 1, false);
  playerMesh.position.set(S.player.x, 0, S.player.z); scene.add(playerMesh);
}

/* ---------- UI helpers ---------- */
const SCREENS = ['screen-title', 'screen-how', 'screen-create', 'screen-intro', 'screen-shop', 'screen-quests', 'screen-inventory', 'screen-map', 'screen-pause', 'screen-death', 'screen-ending', 'screen-credits', 'screen-agegate'];
function showScreen(id) { SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== id)); if (!id) SCREENS.forEach(s => $(s).classList.add('hidden')); }
function toast(msg, ms) {
  const t = $('toast'); if (!t) return; t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 2600);
}
function updateHUD() {
  if (!S) return; const p = S.player;
  $('hud-name').textContent = `${p.name} · ${p.cls} · Lv ${p.level}` + (p.ngPlus ? ` · NG+${p.ngPlus}` : '');
  $('hp-fill').style.width = Math.max(0, p.hp / p.maxHp * 100) + '%'; $('hp-text').textContent = `HP ${Math.ceil(p.hp)}/${p.maxHp}`;
  $('mp-fill').style.width = Math.max(0, p.mp / p.maxMp * 100) + '%'; $('mp-text').textContent = `MP ${Math.floor(p.mp)}/${p.maxMp}`;
  $('xp-fill').style.width = Math.max(0, p.xp / p.xpNext * 100) + '%'; $('xp-text').textContent = `XP ${p.xp}/${p.xpNext}`;
  $('hud-gold').textContent = p.gold;
  const sc = shardCount(); $('hud-shards').textContent = `💎 ${sc}/3 shards`;
  $('hud-potions').textContent = `${p.potions.hp} HP · ${p.potions.mp} MP` + (p.potions.elixir ? ` · ${p.potions.elixir} ✨` : '') + (p.potions.mega ? ` · ${p.potions.mega} 💊` : '');
  const q = S.quests; let track = '';
  if (q.main.stage === 0) track = '📜 Talk to Elder Mara in Ember Village';
  else if (q.main.stage === 1) track = `📜 Shards: ${sc}/3 — Forest, Desert, Snowfields`;
  else if (q.main.stage === 2) track = '📜 Face Malachar in the Shadowlands (SE)';
  else track = '📜 The Ember is restored. Free-roam!';
  if (q.slimes.state === 1) track += `<br>🌾 Slimes: ${q.slimes.kills}/${q.slimes.need}`;
  if (q.amulet.state === 1) track += `<br>🧭 ${q.amulet.has ? 'Return the amulet to Scout Renn' : 'Find the lost amulet in the Forest'}`;
  if (q.herbs && q.herbs.state === 1) track += `<br>🌿 Herbs: ${(q.herbs.collected || []).length}/3 (Stormpeak Highlands)`;
  if (q.fish && q.fish.state === 1) track += `<br>🎣 Fish: ${q.fish.caught}/${q.fish.need} (Sunset Coast)`;
  if (q.missing && q.missing.state === 1) track += `<br>🔍 Clues: ${(q.missing.clues || []).length}/3 + Coast Brute`;
  if (S.adultMode && q.romance) track += `<br>💕 Elara: ${romanceLabel(q.romance.elara)} · Kael: ${romanceLabel(q.romance.kael)}`;
  if (S.adultMode && q.adultQuest && q.adultQuest.state === 1) track += '<br>🍺 Tavern Dilemma: resolve it at the inn';
  $('quest-tracker').innerHTML = track;
}
function shardCount() { const s = S.quests.main.shards; return (s.forest ? 1 : 0) + (s.desert ? 1 : 0) + (s.snow ? 1 : 0); }

/* ---------- Game flow ---------- */
function startNewGame(cfg) {
  S = { player: newPlayer(cfg), quests: defaultQuests(), enemies: [], projectiles: [], amuletOut: false, chestsOpened: [], explored: new Set(), discovered: new Set(), kills: 0, playSeconds: 0, adultMode: pendingAdult === true };
  spawnWorldEnemies(); makePlayerMesh(); syncDynamicMeshes();
  mode = 'intro';
  $('intro-hero-line').textContent = `You are ${cfg.name}, a ${cfg.cls} — the last Emberbearer. Elder Mara is waiting for you in Ember Village.`;
  showScreen('screen-intro'); $('hud').classList.add('hidden');
  updateHUD(); return S;
}
function enterWorld() {
  mode = 'playing'; showScreen(null); $('hud').classList.remove('hidden'); updateAdultButtons();
  if ('ontouchstart' in window) $('touch-controls').classList.remove('hidden');
  toast(`Welcome to Ember Village, ${S.player.name}! Talk to Elder Mara 🧙‍♀️`);
  if (EmberAudio.startAmbient) EmberAudio.startAmbient();
  updateHUD();
}
function startNGPlus() {
  const keepAdult = S.adultMode === true;
  const p = S.player; p.ngPlus++; p.hp = p.maxHp; p.mp = p.maxMp; p.x = SPAWN.x; p.z = SPAWN.y; p.y = SPAWN.y;
  S.quests = defaultQuests(); S.projectiles = []; S.amuletOut = false; S.chestsOpened = []; S.explored = new Set(); S.discovered = new Set();
  if (playerMesh && scene) { try { scene.remove(playerMesh); } catch (e) {} playerMesh = null; }
  S.enemies.forEach(e => { if (e.mesh && scene) { try { scene.remove(e.mesh); } catch (err) {} } });
  S.adultMode = keepAdult; spawnWorldEnemies(); makePlayerMesh(); syncDynamicMeshes(); enterWorld();
  toast(`⭐ New Game+ ${p.ngPlus} — enemies are stronger. The shards have scattered again!`);
  EmberAudio.quest();
}

/* ---------- Save / load (validated) ---------- */
function saveGame() {
  if (!S) return false;
  try {
    const data = { player: S.player, quests: S.quests, adultMode: S.adultMode === true, chestsOpened: S.chestsOpened || [], explored: [...(S.explored || [])], discovered: [...(S.discovered || [])], kills: S.kills, savedAt: Date.now(),
      deadGuards: S.enemies.filter(e => e.guardShard && e.dead).map(e => e.guardShard),
      bossDead: S.quests.main.stage >= 3 };
    const text = JSON.stringify(data);
    localStorage.setItem(SAVE_KEY, text); toast('💾 Game saved'); return true;
  } catch (e) { toast('Save failed: storage unavailable'); return false; }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !d.player || typeof d.player.name !== 'string' || !CLASSES[d.player.cls] || !d.quests) return false;
    const dq = defaultQuests();
    const quests = Object.assign({}, dq, d.quests);
    ['herbs', 'fish', 'missing', 'slimes', 'amulet', 'romance', 'adultQuest'].forEach(k => { quests[k] = Object.assign({}, dq[k], d.quests[k] || {}); });
    const player = Object.assign({ defence: 0, inventory: [], equipped: { weapon: null, armour: null }, invulnUntil: 0 }, d.player);
    player.potions = Object.assign({ hp: 0, mp: 0, elixir: 0, mega: 0 }, d.player.potions || {});
    player.z = (typeof d.player.z === 'number') ? d.player.z : d.player.y;
    player.y = player.z; player.x = d.player.x;
    S = { player, quests, enemies: [], projectiles: [], amuletOut: d.quests.amulet && d.quests.amulet.state === 1 && !d.quests.amulet.has, chestsOpened: d.chestsOpened || [], explored: new Set(d.explored || []), discovered: new Set(d.discovered || []), kills: d.kills || 0, playSeconds: 0, adultMode: d.adultMode === true };
    // Validate adult state: missing/corrupt values default to OFF / stage 0. Never trust a stored flag blindly.
    ['elara', 'kael'].forEach(id => { const v = S.quests.romance[id]; S.quests.romance[id] = (Number.isInteger(v) && v >= 0 && v <= 4) ? v : 0; });
    if (![0, 1, 2].includes(S.quests.adultQuest.state)) S.quests.adultQuest.state = 0;
    spawnWorldEnemies(); makePlayerMesh(); syncDynamicMeshes();
    (d.deadGuards || []).forEach(id => { const g = S.enemies.find(e => e.guardShard === id); if (g) { g.dead = true; if (g.mesh) g.mesh.visible = false; } });
    if (S.quests.main.stage === 2) spawnBoss();
    enterWorld(); toast(`Welcome back, ${S.player.name}!`); return true;
  } catch (e) { return false; }
}
function resetSave() {
  if (typeof window.confirm === 'function' && !window.confirm('Delete your saved game? This cannot be undone.')) return false;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  $('btn-continue').classList.add('hidden'); toast('Saved game deleted.'); return true;
}

/* ---------- Combat & progression ---------- */
function gainXP(n) {
  const p = S.player; p.xp += n;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext; p.level++; p.xpNext = Math.round(p.xpNext * 1.45);
    p.maxHp += 14; p.maxMp += 6; p.atk += 3; p.hp = p.maxHp; p.mp = p.maxMp;
    EmberAudio.levelup(); toast(`⭐ LEVEL UP! You are now level ${p.level}. HP/MP restored!`);
  }
}
function spawnDamageNumber(x, z, text, color) {
  try {
    if (!camera || typeof THREE === 'undefined' || !THREE.Vector3) return;
    const v = new THREE.Vector3(x, 70, z).project(camera);
    const layer = $('damage-layer'); if (!layer) return;
    const r = canvas.getBoundingClientRect();
    const d = document.createElement('div'); d.className = 'dmg-num'; d.textContent = text;
    d.style.color = color || '#ffd54f';
    d.style.left = ((v.x * 0.5 + 0.5) * r.width) + 'px'; d.style.top = ((-v.y * 0.5 + 0.5) * r.height) + 'px';
    layer.appendChild(d); setTimeout(() => { try { d.remove(); } catch (e) {} }, 900);
  } catch (e) {}
}
function killEnemy(e) {
  if (e.dead) return; e.dead = true; e.dying = 0.5; e.respawnIn = 22; S.kills++;
  const p = S.player; const gold = e.goldMin + Math.floor(Math.random() * (e.goldMax - e.goldMin + 1));
  p.gold += gold; EmberAudio.coin();
  toast(`Defeated ${e.name}! +${e.xp} XP, +${gold} gold`); gainXP(e.xp);
  if (e.type === 'slime' && S.quests.slimes.state === 1) { S.quests.slimes.kills++; if (S.quests.slimes.kills >= S.quests.slimes.need) toast('🌾 Slime quest complete — return to Farmer Lio!'); }
  if (e.guardShard) toast(`${e.name} has fallen! The shard is unguarded — go claim it.`);
  if (e.brute) { S.quests.missing.bruteDead = true; toast('🔍 The Coast Brute is defeated — return to Garrick with the clues!'); }
  if (e.type === 'boss') onBossDefeated();
  updateHUD();
}
function onBossDefeated() {
  S.quests.main.stage = 3;
  setTimeout(() => { if (mode === 'playing' || mode === 'dialogue') { mode = 'ending'; showScreen('screen-ending'); } }, 900);
}
function damagePlayer(rawAmount) {
  if (!S || mode !== 'playing') return;
  const p = S.player;
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (now < (p.invulnUntil || 0)) return; // i-frames: no damage every frame
  // DOCUMENTED formula: damage taken = max(1, enemy damage − total defence). Never negative, never zero-damage invulnerability from armour alone.
  const amount = Math.max(1, rawAmount - totalDefence(p));
  p.hp -= amount; p.invulnUntil = now + 800; EmberAudio.hurt();
  spawnDamageNumber(p.x, p.z, '-' + amount, '#ff6b6b');
  if (p.hp <= 0) { p.hp = 0; die(); }
  updateHUD();
}
function die() { mode = 'dead'; EmberAudio.die(); showScreen('screen-death'); }
function respawn() {
  const p = S.player; const lost = Math.floor(p.gold * 0.10); p.gold -= lost;
  p.hp = p.maxHp; p.mp = p.maxMp; p.x = SPAWN.x; p.z = SPAWN.y; p.y = SPAWN.y; p.invulnUntil = 0; S.projectiles = [];
  showScreen(null); mode = 'playing'; toast(`You wake in Ember Village. Lost ${lost} gold.`); updateHUD();
}
function segmentBlocked(x1, z1, x2, z2) {
  for (let t = 0.2; t < 0.9; t += 0.2) {
    if (collides(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, 4)) return true;
  }
  return false;
}
function playerAttack() {
  if (!S || mode !== 'playing') return false;
  const now = performance.now(), p = S.player, c = CLASSES[p.cls];
  if (now - lastAttack < c.cooldown) return false;
  if (c.mpCost && p.mp < c.mpCost) { toast('Not enough MP!'); return false; }
  lastAttack = now;
  if (c.mpCost) p.mp -= c.mpCost;
  const dmg = totalAttack(p);
  if (c.projectile) {
    EmberAudio.shoot();
    S.projectiles.push({ x: p.x, z: p.z, y: p.z, vx: Math.cos(p.face) * 520, vz: Math.sin(p.face) * 520, dmg, life: c.range / 520, from: 'player', mesh: null });
    if (scene) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), mat('#ffd54f')); m.position.set(p.x, 30, p.z); scene.add(m);
      S.projectiles[S.projectiles.length - 1].mesh = m;
    }
  } else {
    EmberAudio.attack(); let hitAny = false;
    S.enemies.forEach(e => {
      if (e.dead) return; const d = Math.hypot(e.x - p.x, e.z - p.z);
      let da = Math.atan2(e.z - p.z, e.x - p.x) - p.face; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      if (d <= c.range + e.r && Math.abs(da) < 1.25 && !segmentBlocked(p.x, p.z, e.x, e.z)) { hitEnemy(e, dmg); hitAny = true; }
    });
    if (hitAny) EmberAudio.hit();
  }
  updateHUD(); return true;
}
function hitEnemy(e, dmg) {
  if (e.dead) return;
  const eff = Math.max(1, dmg - (e.armour || 0)); // armoured enemies shrug off part of every hit
  e.hp -= eff; EmberAudio.hit();
  spawnDamageNumber(e.x, e.z, '-' + eff, '#ffffff');
  if (e.mesh) { e.flash = 0.15; }
  if (e.hp <= 0) killEnemy(e); updateHUD();
}
function usePotion(kind) {
  if (!S) return false; const p = S.player;
  kind = kind || (p.hp / p.maxHp <= p.mp / p.maxMp ? 'hp' : 'mp');
  if (kind === 'elixir') { if (p.potions.elixir <= 0) { toast('No elixirs left'); return false; } p.potions.elixir--; p.hp = p.maxHp; p.mp = p.maxMp; }
  else if (kind === 'mega') { if (p.potions.mega <= 0) { toast('No mega potions left'); return false; } if (p.hp >= p.maxHp) { toast('HP already full'); return false; } p.potions.mega--; p.hp = Math.min(p.maxHp, p.hp + 100); }
  else if (kind === 'hp') { if (p.potions.hp <= 0) { toast('No health potions left — buy more at Bram\'s shop'); return false; } if (p.hp >= p.maxHp) { toast('HP already full'); return false; } p.potions.hp--; p.hp = Math.min(p.maxHp, p.hp + 50); }
  else { if (p.potions.mp <= 0) { toast('No mana potions left'); return false; } if (p.mp >= p.maxMp) { toast('MP already full'); return false; } p.potions.mp--; p.mp = Math.min(p.maxMp, p.mp + 40); }
  EmberAudio.potion(); toast('🧪 Potion used'); updateHUD(); return true;
}

/* ---------- Shop & inventory ---------- */
function shopList() { return currentShop === 'blacksmith' ? BLACKSMITH_ITEMS : SHOP_ITEMS; }
function buyItem(id) {
  // Current shop first, then the other shop — a valid item must never fail
  // merely because the player last visited the other shop.
  const item = shopList().find(i => i.id === id) || [...SHOP_ITEMS, ...BLACKSMITH_ITEMS].find(i => i.id === id); if (!item || !S) return false;
  const p = S.player;
  if (p.inventory && p.inventory.some(i => i.id === id)) { toast('You already own that — equip it from your inventory.'); return false; }
  if (p.gold < item.price) { toast(`Not enough gold! Need ${item.price}, you have ${p.gold}.`); EmberAudio.hit(); return false; }
  p.gold -= item.price;
  if (id === 'hp_potion') p.potions.hp++;
  else if (id === 'mp_potion') p.potions.mp++;
  else if (id === 'mega_potion') p.potions.mega++;
  else if (id === 'elixir') p.potions.elixir++;
  else if (id === 'sword_up') p.atkBonus += 4;
  else if (id === 'steel_sword') { p.inventory.push({ id, name: item.name, icon: item.icon, kind: 'weapon', atk: 6, desc: item.desc }); p.equipped.weapon = id; }
  else if (id === 'ember_blade') { p.inventory.push({ id, name: item.name, icon: item.icon, kind: 'weapon', atk: 10, desc: item.desc }); p.equipped.weapon = id; }
  else if (id === 'iron_armour') { p.inventory.push({ id, name: item.name, icon: item.icon, kind: 'armour', defence: 3, desc: item.desc }); p.equipped.armour = id; }
  else if (id === 'steel_armour') { p.inventory.push({ id, name: item.name, icon: item.icon, kind: 'armour', defence: 6, desc: item.desc }); p.equipped.armour = id; }
  EmberAudio.coin(); if (EmberAudio.purchase) EmberAudio.purchase(); toast(`Bought ${item.name}!`); renderShop(); updateHUD(); return true;
}
function renderShop() {
  $('shop-title').textContent = currentShop === 'blacksmith' ? '🔨 Doran\'s Forge' : '🛒 Bram\'s General Store';
  $('shop-gold').textContent = S.player.gold;
  $('shop-items').innerHTML = shopList().map(i =>
    `<div class="shop-row"><span title="${i.desc}">${i.icon} <b>${i.name}</b> — ${i.desc}</span><button class="mini-btn" data-buy="${i.id}">Buy ${i.price}🪙</button></div>`).join('');
  $('shop-items').querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => buyItem(b.dataset.buy)));
}
function openShop() { currentShop = 'general'; mode = 'shop'; renderShop(); showScreen('screen-shop'); }
function openBlacksmith() { currentShop = 'blacksmith'; mode = 'shop'; renderShop(); showScreen('screen-shop'); }
function closeShop() { showScreen(null); mode = 'playing'; }
function equipItem(id) {
  const p = S.player; const item = (p.inventory || []).find(i => i.id === id); if (!item) return false;
  if (item.kind === 'weapon') p.equipped.weapon = id; else if (item.kind === 'armour') p.equipped.armour = id;
  toast(`Equipped ${item.name}`); renderInventory(); updateHUD(); return true;
}
function unequipItem(kind) {
  const p = S.player;
  if (kind === 'weapon') p.equipped.weapon = null; else p.equipped.armour = null;
  renderInventory(); updateHUD(); return true;
}
function renderInventory() {
  const p = S.player;
  let h = `<p><b>Attack:</b> ${totalAttack(p)} (base ${p.atk} + stone ${p.atkBonus || 0} + weapon) &nbsp; <b>Defence:</b> ${totalDefence(p)}<br><small>${ARMOUR_FORMULA}</small></p>`;
  h += `<p>🧪 Potions — HP: ${p.potions.hp} · MP: ${p.potions.mp} · Mega: ${p.potions.mega} · Elixir: ${p.potions.elixir} &nbsp; 🪙 Gold: ${p.gold}</p>`;
  if (!p.inventory || !p.inventory.length) h += '<p>No equipment yet — buy a sword or armour at Doran\'s Forge in Ember Village.</p>';
  (p.inventory || []).forEach(item => {
    const eq = (item.kind === 'weapon' ? p.equipped.weapon : p.equipped.armour) === item.id;
    h += `<div class="shop-row"><span title="${item.desc}">${item.icon} <b>${item.name}</b> — ${item.desc}</span><button class="mini-btn" data-eq="${item.id}" data-kind="${item.kind}">${eq ? 'Unequip' : 'Equip'}</button></div>`;
  });
  $('inventory-list').innerHTML = h;
  $('inventory-list').querySelectorAll('[data-eq]').forEach(b => b.addEventListener('click', () => {
    const item = p.inventory.find(i => i.id === b.dataset.eq);
    const eq = (item.kind === 'weapon' ? p.equipped.weapon : p.equipped.armour) === item.id;
    if (eq) unequipItem(item.kind); else equipItem(item.id);
  }));
}
function openInventory() { if (mode !== 'playing') return; mode = 'inventory'; renderInventory(); showScreen('screen-inventory'); }
function closeInventory() { showScreen(null); mode = 'playing'; }

/* ---------- Quests / shards / chests / pickups ---------- */
function collectShard(id) {
  if (!S || S.quests.main.stage !== 1) return false;
  if (S.quests.main.shards[id]) return false;
  const guard = S.enemies.find(e => e.guardShard === id);
  if (guard && !guard.dead) { toast(`The ${guard.name} still guards this shard! Defeat it first.`); return false; }
  S.quests.main.shards[id] = true; EmberAudio.pickup();
  const spot = SHARD_SPOTS.find(s => s.id === id);
  toast(`${spot.icon} You claimed the ${spot.name}! (${shardCount()}/3)`);
  if (shardCount() >= 3) { S.quests.main.stage = 2; spawnBoss(); toast('All shards claimed! The way to Malachar is open — Shadowlands, far south-east.'); }
  EmberAudio.quest(); syncDynamicMeshes(); updateHUD(); return true;
}
function pickupAmulet() {
  if (!S || S.quests.amulet.state !== 1 || S.quests.amulet.has) return false;
  S.quests.amulet.has = true; S.amuletOut = false; EmberAudio.pickup();
  toast('🧭 You found the Lost Amulet! Return it to Scout Renn.'); updateHUD(); return true;
}
function collectHerb(id) {
  if (!S || !S.quests.herbs || S.quests.herbs.state !== 1) return false;
  if ((S.quests.herbs.collected || []).includes(id)) return false;
  S.quests.herbs.collected.push(id); EmberAudio.pickup();
  toast(`🌿 Rare herb collected! (${S.quests.herbs.collected.length}/3)`);
  if (S.quests.herbs.collected.length >= 3) toast('🌿 All rare herbs gathered — return to Ivy the Herbalist!');
  syncDynamicMeshes(); updateHUD(); return true;
}
function catchFish(id) {
  if (!S || !S.quests.fish || S.quests.fish.state !== 1) return false;
  if ((S.quests.fish.spots || []).includes(id)) return false;
  S.quests.fish.spots.push(id); S.quests.fish.caught++; EmberAudio.pickup();
  toast(`🎣 Caught a fish! (${S.quests.fish.caught}/${S.quests.fish.need})`);
  if (S.quests.fish.caught >= S.quests.fish.need) toast('🎣 Full catch! Return to Finn the Fisherman.');
  syncDynamicMeshes(); updateHUD(); return true;
}
function collectClue(id) {
  if (!S || !S.quests.missing || S.quests.missing.state !== 1) return false;
  if ((S.quests.missing.clues || []).includes(id)) return false;
  S.quests.missing.clues.push(id); EmberAudio.pickup();
  const spot = CLUE_SPOTS.find(s => s.id === id);
  toast(`🔍 Clue found: ${spot ? spot.name : id} (${S.quests.missing.clues.length}/3)`);
  syncDynamicMeshes(); updateHUD(); return true;
}
function openChest(id) {
  if (!S) return false;
  const chest = CHESTS.find(c => c.id === id); if (!chest) return false;
  if ((S.chestsOpened || []).includes(id)) return false;
  S.chestsOpened.push(id); const p = S.player;
  p.gold += chest.gold;
  if (chest.potion === 'hp') p.potions.hp++;
  else if (chest.potion === 'mp') p.potions.mp++;
  else if (chest.potion === 'mega') p.potions.mega++;
  else if (chest.potion === 'elixir') p.potions.elixir++;
  if (EmberAudio.chest) EmberAudio.chest(); else EmberAudio.coin();
  toast(`📦 Treasure! +${chest.gold} gold` + (chest.potion ? ` + 1 ${chest.potion} potion` : ''));
  syncDynamicMeshes(); updateHUD(); return true;
}
function renderQuests() {
  const q = S.quests, sc = shardCount();
  const row = (t, st, d) => `<div class="quest-row"><b>${t}</b><span>${d}</span><span class="q-status">${st}</span></div>`;
  let h = '';
  h += row('🔥 The Shattered Ember (Main)', q.main.stage === 0 ? 'Not started — speak to Elder Mara' : q.main.stage === 1 ? `In progress — ${sc}/3 shards` : q.main.stage === 2 ? 'Boss unlocked — defeat Malachar!' : '✅ Complete', 'Collect the Verdant (Forest NW), Solar (Desert NE) and Frost (Snowfields SW) shards, then face Malachar in the Shadowlands (SE).');
  h += row('🌾 Slime Menace (Farmer Lio)', q.slimes.state === 0 ? 'Not started' : q.slimes.state === 1 ? `In progress — ${q.slimes.kills}/${q.slimes.need} slimes` : '✅ Complete', `Defeat ${q.slimes.need} slimes. Reward: 60 gold + potion.`);
  h += row('🧭 The Lost Amulet (Scout Renn)', q.amulet.state === 0 ? 'Not started' : q.amulet.state === 1 ? (q.amulet.has ? 'Amulet found — return to Renn' : 'In progress — search the Forest') : '✅ Complete', 'Find Renn\'s amulet in the Whispering Forest. Reward: 80 gold + elixir.');
  h += row('🌿 Herbalist\'s Rare Remedy (Ivy)', !q.herbs || q.herbs.state === 0 ? 'Not started' : q.herbs.state === 1 ? `In progress — ${(q.herbs.collected || []).length}/3 rare herbs` : '✅ Complete', 'Gather 3 rare herbs from the dangerous Stormpeak Highlands. Reward: 90 gold + mega potion.');
  h += row('🎣 A Fisherman\'s Catch (Finn)', !q.fish || q.fish.state === 0 ? 'Not started' : q.fish.state === 1 ? `In progress — ${q.fish.caught}/${q.fish.need} fish` : '✅ Complete', 'Fish at 3 spots on the Sunset Coast. Reward: 100 gold + elixir.');
  h += row('🔍 The Missing Fisherman (Garrick)', !q.missing || q.missing.state === 0 ? 'Not started' : q.missing.state === 1 ? `In progress — ${(q.missing.clues || []).length}/3 clues, brute ${q.missing.bruteDead ? 'defeated' : 'at large'}` : '✅ Complete', 'Tomas the fisherman vanished on the coast. Find 3 clues, defeat the Coast Brute, return the evidence to Garrick. Reward: 120 gold + Steel Armour.');
  if (S.adultMode && q.romance) {
    h += row('💕 Romance — Elara (21+ mode)', romanceLabel(q.romance.elara), 'Elara, 27, innkeeper of Ember Village. Progress is optional and can be ended at any time.');
    h += row('💕 Romance — Kael (21+ mode)', romanceLabel(q.romance.kael), 'Kael, 29, caravan guard of Moonhaven in the Moonlit Vale. Progress is optional and can be ended at any time.');
    h += row('🍺 The Tavern Dilemma (21+ mode)', !q.adultQuest || q.adultQuest.state === 0 ? 'Not started — ask Elara' : q.adultQuest.state === 1 ? 'In progress — choose a resolution' : '✅ Complete', 'A mature tavern dispute: choose how to resolve it. Reward depends on the choice (60–80 gold).');
  }
  $('quest-list').innerHTML = h;
}
function openQuests() { if (mode !== 'playing') return; mode = 'quests'; renderQuests(); showScreen('screen-quests'); }
function closeQuests() { showScreen(null); mode = 'playing'; }


/* ---------- Adult Story Mode (21+, OFF by default) ----------
   HARD RULES: no minor characters exist in this game; romance is adult-to-adult
   and consensual only, and can be declined or ended at any point. Only a boolean
   adultMode flag is ever stored — a birth year is checked transiently in
   verifyAge() and is never assigned to state, a save, or localStorage.
   Intimate moments are suggestive dialogue + fade-to-black ONLY, never graphic. */
function romanceLabel(stage) {
  return ['Not met', 'Acquaintances', 'Flirting', 'Dating', 'Partners'][stage] || 'Not met';
}
function isAdultOn() { return !!(S && S.adultMode === true); }
function romanceStage(id) { return (S && S.quests && S.quests.romance) ? (S.quests.romance[id] || 0) : 0; }
function setRomance(id, stage) {
  if (!S) return false;
  S.quests.romance[id] = Math.max(0, Math.min(4, stage));
  updateHUD(); return true;
}
function endRomance(id) {
  if (!S) return false;
  S.quests.romance[id] = 0; EmberAudio.quest();
  toast('You part as friends. The romance can be started again any time.');
  closeDialogue(); updateHUD(); return true;
}
function updateAdultButtons() {
  const on = isAdultOn() || pendingAdult === true;
  const t = $('btn-adult-mode'); if (t) t.textContent = on ? '🔞 Adult Story Mode: ON (tap to turn off)' : '🔞 Adult Story Mode: OFF (21+)';
  const tt = $('btn-adult-title'); if (tt) tt.textContent = on ? '🔞 Adult Story Mode: ON' : '🔞 Adult Story Mode (21+)';
}
function openAgeGate() {
  const g = $('screen-agegate'); if (!g) return false;
  const err = $('age-error'); if (err) err.textContent = '';
  g.classList.remove('hidden'); return true;
}
function closeAgeGate() { const g = $('screen-agegate'); if (g) g.classList.add('hidden'); }
function verifyAge(birthYear, confirmed) {
  // Transient check only: birthYear lives in this local scope and is never stored.
  const currentYear = new Date().getFullYear();
  const y = parseInt(birthYear, 10);
  if (!confirmed || !Number.isInteger(y) || y < 1900 || y > currentYear) return false;
  if (currentYear - y < 21) return false;
  pendingAdult = true;
  if (S) S.adultMode = true;
  updateAdultButtons(); updateHUD();
  toast('🔞 Adult Story Mode enabled. Content warning: mature themes — romance, alcohol in the tavern, violence, and moral choices.');
  return true;
}
function disableAdultMode() {
  pendingAdult = false; if (S) S.adultMode = false;
  updateAdultButtons(); updateHUD(); toast('Adult Story Mode turned off. Adult dialogue is hidden again.');
  return true;
}
function talkRomance(id, npc) {
  const p = S.player, q = S.quests, stage = romanceStage(id);
  const isElara = id === 'elara';
  const name = isElara ? 'Elara' : 'Kael';
  const age = isElara ? 27 : 29;
  const place = isElara ? 'the inn' : 'Moonhaven';
  const endBtn = { label: '💔 End this romance — just friends', fn: () => endRomance(id) };
  const dilemmaBtns = [];
  if (isElara && q.adultQuest.state === 0) dilemmaBtns.push({ label: '🍺 Hear about the tavern dilemma', fn: () => {
    showDialogue(name, 'A regular has been drinking too much, owes coin, and is getting loud with other guests. I could use a steady hand — will you help me sort it out?', [
      { label: '✅ Help with the dilemma', fn: () => { q.adultQuest.state = 1; EmberAudio.quest(); toast('🍺 Tavern Dilemma accepted'); closeDialogue(); updateHUD(); } },
      { label: 'Not now', fn: () => talkRomance(id, npc) }]);
  }});
  if (isElara && q.adultQuest.state === 1) dilemmaBtns.push({ label: '🍺 Resolve the tavern dilemma', fn: () => {
    showDialogue(name, 'He is at the bar now. How should we handle it? A kind talk costs nothing — but the guard will back us if it turns ugly.', [
      { label: '🕊️ Talk it out peacefully', fn: () => { q.adultQuest.state = 2; q.adultQuest.choice = 'peaceful'; p.gold += 80; p.potions.elixir++; EmberAudio.coin(); toast('🍺 Dilemma resolved peacefully: +80 gold, +1 elixir'); closeDialogue(); updateHUD(); } },
      { label: '🛡️ Ask the guard to step in', fn: () => { q.adultQuest.state = 2; q.adultQuest.choice = 'guard'; p.gold += 60; EmberAudio.coin(); toast('🍺 Dilemma resolved with the guard: +60 gold'); closeDialogue(); updateHUD(); } },
      { label: 'Not yet', fn: () => talkRomance(id, npc) }]);
  }});
  if (stage === 0) {
    showDialogue(npc.name, `Hello, traveller. I am ${name}, ${age} years old, and I keep ${place}. The road is long — a friendly face and a warm meal go a long way out here. Care to get to know me a little?`, [
      { label: '💬 Get to know ' + name, fn: () => { setRomance(id, 1); EmberAudio.quest(); toast(`You and ${name} exchange stories.`); closeDialogue(); } },
      { label: 'Just passing through', fn: closeDialogue }].concat(dilemmaBtns));
  } else if (stage === 1) {
    showDialogue(npc.name, `It is good to see you again. ${isElara ? 'The stew is on, and I saved you a seat by the fire.' : 'The caravan road is quiet today — a good day for company.'} What brings you back to me?`, [
      { label: '💕 Give a warm compliment', fn: () => { setRomance(id, 2); toast(`${name} smiles. The two of you are clearly flirting now.`); closeDialogue(); } },
      { label: '💬 Share a story from the road', fn: () => { setRomance(id, 2); toast(`${name} laughs at your story. The two of you are clearly flirting now.`); closeDialogue(); } },
      endBtn, { label: 'Close', fn: closeDialogue }].concat(dilemmaBtns));
  } else if (stage === 2) {
    const datePlace = isElara ? 'a quiet table at the tavern' : 'a walk by Moonlit Lake';
    const datePlace2 = isElara ? 'a stroll to Fern Lake' : 'a quiet table at the Moonhaven tavern';
    showDialogue(npc.name, `I have enjoyed our talks. Would you like to go on a proper date? We could meet at ${datePlace} — or, if you prefer, ${datePlace2}. No pressure at all; say the word and it is a date, or say no and we stay friends.`, [
      { label: '💕 Yes — a date at ' + datePlace, fn: () => { setRomance(id, 3); p.gold += 0; EmberAudio.quest(); toast(`💕 A lovely date with ${name}. You are dating now.`); closeDialogue(); updateHUD(); } },
      { label: '💕 Yes — a date at ' + datePlace2, fn: () => { setRomance(id, 3); EmberAudio.quest(); toast(`💕 A lovely date with ${name}. You are dating now.`); closeDialogue(); updateHUD(); } },
      { label: 'Not yet', fn: closeDialogue }, endBtn ].concat(dilemmaBtns));
  } else if (stage === 3) {
    showDialogue(npc.name, `These dates have meant a lot to me. I would like us to be partners — properly, openly, and only if you want that too. What do you say?`, [
      { label: '💖 Yes — become partners', fn: () => { setRomance(id, 4); p.gold += 50; EmberAudio.quest(); toast(`💖 You and ${name} are partners now! Gift: +50 gold.`); closeDialogue(); updateHUD(); } },
      { label: 'Not yet', fn: closeDialogue }, endBtn ].concat(dilemmaBtns));
  } else {
    showDialogue(npc.name, `My partner. Whatever the road brings — shards, storms, or quiet mornings — I am glad we walk it together.`, [
      { label: '🌙 Spend a quiet evening together', fn: () => {
        showDialogue(npc.name, `You share a quiet evening together — good food, honest talk, and laughter. The scene fades to black, and morning finds you both smiling over breakfast. Nothing more is shown.`, [{ label: '☀️ Morning', fn: () => talkRomance(id, npc) }]);
      } },
      endBtn, { label: 'Close', fn: closeDialogue }].concat(dilemmaBtns));
  }
  updateHUD(); return true;
}

/* ---------- Dialogue & interaction ---------- */
function showDialogue(name, text, actions) {
  mode = 'dialogue'; $('dlg-name').textContent = name; $('dlg-text').textContent = text;
  const box = $('dlg-actions'); box.innerHTML = '';
  (actions && actions.length ? actions : [{ label: 'Close', fn: closeDialogue }]).forEach(a => {
    const b = document.createElement('button'); b.className = 'mini-btn'; b.textContent = a.label;
    b.addEventListener('click', a.fn); box.appendChild(b);
  });
  $('dialogue').classList.remove('hidden');
}
function closeDialogue() { $('dialogue').classList.add('hidden'); if (mode === 'dialogue') mode = 'playing'; }
function talkTo(npc) {
  if (!npc || !S) return false;
  const q = S.quests, p = S.player;
  if (npc.role === 'romance_elara' || npc.role === 'romance_kael') {
    const id = npc.role === 'romance_elara' ? 'elara' : 'kael';
    if (!isAdultOn()) {
      // Adult dialogue is completely hidden while the mode is OFF.
      const generic = id === 'elara'
        ? 'Welcome to the inn, traveller. Warm bread, hot stew, and a bed for the night — all at fair prices. Rest well before the road calls again.'
        : 'Keep to the roads after dark, traveller. Moonhaven is quiet, but the Vale rewards the careful. Safe travels.';
      showDialogue(npc.name, generic, [
        { label: '🔞 About Adult Story Mode (21+)', fn: () => { closeDialogue(); openAgeGate(); } },
        { label: 'Close', fn: closeDialogue }]);
      return true;
    }
    return talkRomance(id, npc);
  }
  if (npc.role === 'elder') {
    if (q.main.stage === 0) showDialogue(npc.name, 'The Ember Crystal is shattered, child. Three shards lie guarded across the Forest, the Desert and the Snowfields. Claim them all, and the Ashen King\'s seal will break. Will you carry this burden?', [
      { label: '✅ Accept the quest', fn: () => { q.main.stage = 1; EmberAudio.quest(); toast('📜 Main quest started: The Shattered Ember'); closeDialogue(); updateHUD(); } },
      { label: 'Not yet', fn: closeDialogue }]);
    else if (q.main.stage === 1) showDialogue(npc.name, `You hold ${shardCount()} of 3 shards. Forest to the north-west, Desert to the north-east, Snowfields to the south-west. Each shard has a guardian — come prepared, and keep potions handy.`, [{ label: 'Close', fn: closeDialogue }]);
    else if (q.main.stage === 2) showDialogue(npc.name, 'All three shards sing together — the seal is broken! Malachar waits in the Shadowlands, far to the south-east. End this.', [{ label: 'Close', fn: closeDialogue }]);
    else showDialogue(npc.name, 'You did it. The lanterns burn bright because of you, Emberbearer.', [{ label: 'Close', fn: closeDialogue }]);
  } else if (npc.role === 'shop') {
    showDialogue(npc.name, 'Welcome to Bram\'s! Potions, elixirs, and the finest sharpening stones this side of the desert.', [
      { label: '🛒 Browse the shop', fn: () => { closeDialogue(); openShop(); } }, { label: 'Just looking', fn: closeDialogue }]);
  } else if (npc.role === 'blacksmith') {
    showDialogue(npc.name, 'Doran\'s Forge — the hardest steel in Emberfall. A good blade and solid armour will carry you through the Highlands. Remember: damage taken = max(1, enemy damage − your total defence).', [
      { label: '🔨 Browse the forge', fn: () => { closeDialogue(); openBlacksmith(); } }, { label: 'Just looking', fn: closeDialogue }]);
  } else if (npc.role === 'baker') {
    showDialogue(npc.name, 'Fresh bread, warm from the oven! Travellers say the Sunset Coast to the east is beautiful — and the Stormpeak Highlands to the south hide a secret clearing. Keep your eyes open off the roads.', [{ label: 'Close', fn: closeDialogue }]);
  } else if (npc.role === 'guard') {
    if (q.missing.state === 0) showDialogue(npc.name, 'Guard duty is no joke lately. Tomas the fisherman vanished from the Sunset Coast — we found nothing but questions. Follow the coast, find 3 clues, and deal with whatever is out there. Bring me proof and I will pay you 120 gold and a set of Steel Armour.', [
      { label: '✅ Accept', fn: () => { q.missing.state = 1; EmberAudio.quest(); closeDialogue(); syncDynamicMeshes(); updateHUD(); } }, { label: 'Decline', fn: closeDialogue }]);
    else if (q.missing.state === 1 && q.missing.clues.length >= 3 && q.missing.bruteDead) showDialogue(npc.name, 'Three clues and the Brute defeated — that is the proof we needed. Tomas\'s family will finally have answers. Here is your reward.', [
      { label: '🎁 Claim reward', fn: () => { q.missing.state = 2; p.gold += 120; if (!p.inventory.some(i => i.id === 'steel_armour')) { p.inventory.push({ id: 'steel_armour', name: 'Steel Armour', icon: '🛡️', kind: 'armour', defence: 6, desc: 'Armour: +6 defence while equipped.' }); p.equipped.armour = 'steel_armour'; } EmberAudio.coin(); closeDialogue(); updateHUD(); } }]);
    else if (q.missing.state === 1) showDialogue(npc.name, `So far: ${(q.missing.clues || []).length}/3 clues, and the Coast Brute is ${q.missing.bruteDead ? 'defeated' : 'still at large near the coast'}. Keep searching the beaches.`, [{ label: 'Close', fn: closeDialogue }]);
    else showDialogue(npc.name, 'The coast is safer because of you. Thank you.', [{ label: 'Close', fn: closeDialogue }]);
  } else if (npc.role === 'traveller') {
    showDialogue(npc.name, 'I have walked every road in Emberfall. Rumour says a hidden clearing in the Whispering Forest holds a rich chest, and the Spider Cave in the Highlands guards another. The brave find more than the careful — but the careful live longer.', [{ label: 'Close', fn: closeDialogue }]);
  } else if (npc.role === 'side_slimes') {
    if (q.slimes.state === 0) showDialogue(npc.name, 'Slimes ate half my crop! Squash 5 of the blighters — they bounce around the village edges and the forest — and I\'ll pay you 60 gold and a potion.', [
      { label: '✅ Accept', fn: () => { q.slimes.state = 1; EmberAudio.quest(); closeDialogue(); updateHUD(); } }, { label: 'Decline', fn: closeDialogue }]);
    else if (q.slimes.state === 1 && q.slimes.kills >= q.slimes.need) showDialogue(npc.name, 'Ha! Serves them right. Here — 60 gold and a fresh potion, as promised.', [
      { label: '🎁 Claim reward', fn: () => { q.slimes.state = 2; p.gold += 60; p.potions.hp++; EmberAudio.coin(); closeDialogue(); updateHUD(); } }]);
    else if (q.slimes.state === 1) showDialogue(npc.name, `You've squashed ${q.slimes.kills} of 5 slimes. Keep at it!`, [{ label: 'Close', fn: closeDialogue }]);
    else showDialogue(npc.name, 'My crops have never looked better. Thank you!', [{ label: 'Close', fn: closeDialogue }]);
  } else if (npc.role === 'side_amulet') {
    if (q.amulet.state === 0) showDialogue(npc.name, 'I dropped my lucky amulet scouting the Whispering Forest — north-west of here, off the path. Find it and I\'ll give you 80 gold and an Ember Elixir.', [
      { label: '✅ Accept', fn: () => { q.amulet.state = 1; S.amuletOut = true; EmberAudio.quest(); closeDialogue(); updateHUD(); } }, { label: 'Decline', fn: closeDialogue }]);
    else if (q.amulet.state === 1 && q.amulet.has) showDialogue(npc.name, 'That\'s it! My amulet! You\'re a true friend of the road. Take this — you\'ve earned it.', [
      { label: '🎁 Claim reward', fn: () => { q.amulet.state = 2; q.amulet.has = false; p.gold += 80; p.potions.elixir++; EmberAudio.coin(); closeDialogue(); updateHUD(); } }]);
    else if (q.amulet.state === 1) showDialogue(npc.name, 'No luck yet? Search the Forest, north-west. It glints gold — you can\'t miss it once you\'re close.', [{ label: 'Close', fn: closeDialogue }]);
    else showDialogue(npc.name, 'The amulet shines again, thanks to you.', [{ label: 'Close', fn: closeDialogue }]);
  } else if (npc.role === 'side_herbs') {
    if (q.herbs.state === 0) showDialogue(npc.name, 'I need rare herbs for a remedy — they only grow in the dangerous Stormpeak Highlands, where goblins and spiders prowl. Gather 3 and I will pay 90 gold and give you a mega potion.', [
      { label: '✅ Accept', fn: () => { q.herbs.state = 1; EmberAudio.quest(); closeDialogue(); syncDynamicMeshes(); updateHUD(); } }, { label: 'Decline', fn: closeDialogue }]);
    else if (q.herbs.state === 1 && (q.herbs.collected || []).length >= 3) showDialogue(npc.name, 'All three herbs! The remedy is saved. Here is your reward.', [
      { label: '🎁 Claim reward', fn: () => { q.herbs.state = 2; p.gold += 90; p.potions.mega++; EmberAudio.coin(); closeDialogue(); syncDynamicMeshes(); updateHUD(); } }]);
    else if (q.herbs.state === 1) showDialogue(npc.name, `You have ${(q.herbs.collected || []).length}/3 rare herbs. They grow in the Highlands — watch for spiders.`, [{ label: 'Close', fn: closeDialogue }]);
    else showDialogue(npc.name, 'The remedy worked, thanks to you.', [{ label: 'Close', fn: closeDialogue }]);
  } else if (npc.role === 'side_fish') {
    if (q.fish.state === 0) showDialogue(npc.name, 'The coast is generous if you are patient. Fish at 3 spots along the Sunset Coast and I will pay 100 gold and an elixir.', [
      { label: '✅ Accept', fn: () => { q.fish.state = 1; EmberAudio.quest(); closeDialogue(); syncDynamicMeshes(); updateHUD(); } }, { label: 'Decline', fn: closeDialogue }]);
    else if (q.fish.state === 1 && q.fish.caught >= q.fish.need) showDialogue(npc.name, 'A fine catch! Here is your pay, as promised.', [
      { label: '🎁 Claim reward', fn: () => { q.fish.state = 2; p.gold += 100; p.potions.elixir++; EmberAudio.coin(); closeDialogue(); syncDynamicMeshes(); updateHUD(); } }]);
    else if (q.fish.state === 1) showDialogue(npc.name, `You have caught ${q.fish.caught}/${q.fish.need} fish. The spots shimmer blue on the coast.`, [{ label: 'Close', fn: closeDialogue }]);
    else showDialogue(npc.name, 'The sea provides. Thank you.', [{ label: 'Close', fn: closeDialogue }]);
  } else if (npc.role === 'healer') {
    showDialogue(npc.name, 'Sit, rest. The Ember\'s warmth mend your wounds — free, always.', [
      { label: '💖 Heal fully (free)', fn: () => { p.hp = p.maxHp; p.mp = p.maxMp; EmberAudio.potion(); toast('Fully healed!'); closeDialogue(); updateHUD(); } }, { label: 'Close', fn: closeDialogue }]);
  }
  updateHUD(); return true;
}
function nearestInteractable() {
  if (!S) return null; const p = S.player;
  for (const n of NPCS) if (Math.hypot(n.x - p.x, n.y - p.z) < 78) return { kind: 'npc', npc: n };
  for (const s of SHARD_SPOTS) if (!S.quests.main.shards[s.id] && Math.hypot(s.x - p.x, s.y - p.z) < 72) return { kind: 'shard', spot: s };
  if (S.amuletOut && Math.hypot(AMULET_SPOT.x - p.x, AMULET_SPOT.y - p.z) < 66) return { kind: 'amulet' };
  if (S.quests.herbs && S.quests.herbs.state === 1) for (const s of HERB_SPOTS) if (!S.quests.herbs.collected.includes(s.id) && Math.hypot(s.x - p.x, s.y - p.z) < 66) return { kind: 'herb', spot: s };
  if (S.quests.fish && S.quests.fish.state === 1) for (const s of FISH_SPOTS) if (!S.quests.fish.spots.includes(s.id) && Math.hypot(s.x - p.x, s.y - p.z) < 66) return { kind: 'fish', spot: s };
  if (S.quests.missing && S.quests.missing.state === 1) for (const s of CLUE_SPOTS) if (!S.quests.missing.clues.includes(s.id) && Math.hypot(s.x - p.x, s.y - p.z) < 66) return { kind: 'clue', spot: s };
  for (const c of CHESTS) if (!(S.chestsOpened || []).includes(c.id) && Math.hypot(c.x - p.x, c.y - p.z) < 66) return { kind: 'chest', chest: c };
  return null;
}
function doInteract() {
  const t = nearestInteractable(); if (!t) return false;
  if (t.kind === 'npc') return talkTo(t.npc);
  if (t.kind === 'shard') return collectShard(t.spot.id);
  if (t.kind === 'amulet') return pickupAmulet();
  if (t.kind === 'herb') return collectHerb(t.spot.id);
  if (t.kind === 'fish') return catchFish(t.spot.id);
  if (t.kind === 'clue') return collectClue(t.spot.id);
  if (t.kind === 'chest') return openChest(t.chest.id);
  return false;
}

/* ---------- Movement, collision, update ---------- */
function collides(x, z, r) {
  if (x < r || z < r || x > WORLD.W - r || z > WORLD.H - r) return true;
  for (const pr of PROPS) { if (!pr.solid) continue; if (x + r > pr.x - pr.w / 2 && x - r < pr.x + pr.w / 2 && z + r > pr.y - pr.h / 2 && z - r < pr.y + pr.h / 2) return true; }
  return false;
}
function tryMove(dt) {
  const p = S.player; let dx = joyVec.x, dz = joyVec.y;
  if (keys['arrowup'] || keys['w']) dz -= 1; if (keys['arrowdown'] || keys['s']) dz += 1;
  if (keys['arrowleft'] || keys['a']) dx -= 1; if (keys['arrowright'] || keys['d']) dx += 1;
  const len = Math.hypot(dx, dz); if (!len) return;
  dx /= Math.max(1, len); dz /= Math.max(1, len);
  p.face = Math.atan2(dz, dx);
  const nx = p.x + dx * p.speed * dt, nz = p.z + dz * p.speed * dt;
  if (!collides(nx, p.z, p.r)) p.x = nx;
  if (!collides(p.x, nz, p.r)) p.z = nz;
  p.y = p.z;
}
function markExplored() {
  if (!S) return; const p = S.player;
  const TS = 360;
  const tx = Math.floor(p.x / TS), tz = Math.floor(p.z / TS);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) S.explored.add((tx + dx) + ',' + (tz + dz));
  LANDMARKS.forEach(l => {
    if (Math.hypot(l.x - p.x, l.y - p.z) < 500 && !S.discovered.has(l.id)) { S.discovered.add(l.id); toast(`📍 Discovered: ${l.name}`); if (EmberAudio.discovery) EmberAudio.discovery(); }
  });
}
function update(dt) {
  if (!S || mode !== 'playing') return;
  S.playSeconds += dt; tryMove(dt); markExplored();
  const p = S.player;
  p.mp = Math.min(p.maxMp, p.mp + 3.2 * dt);
  S.enemies.forEach(e => {
    if (e.dead) {
      if (e.dying > 0) { e.dying -= dt; if (e.mesh) { e.mesh.position.y = -30 * (1 - Math.max(0, e.dying) / 0.5); e.mesh.rotation.z = -0.9 * (1 - Math.max(0, e.dying) / 0.5); } if (e.dying <= 0 && e.mesh) e.mesh.visible = false; }
      else if (e.respawns) { e.respawnIn -= dt; if (e.respawnIn <= 0) { e.dead = false; e.hp = e.maxHp; e.x = e.homeX; e.z = e.homeZ; e.y = e.homeZ; if (e.mesh) { e.mesh.visible = true; e.mesh.position.set(e.x, 0, e.z); e.mesh.rotation.z = 0; } } }
      return;
    }
    const d = Math.hypot(p.x - e.x, p.z - e.z);
    e.atkCd -= dt;
    if (e.flash > 0) e.flash -= dt;
    // Stuck recovery: if an enemy cannot move for 3s, send it home.
    if (Math.hypot(e.x - e.lastX, e.z - e.lastZ) < 1 && d < 340) { e.stuck += dt; if (e.stuck > 3) { e.x = e.homeX; e.z = e.homeZ; e.y = e.homeZ; e.stuck = 0; } } else { e.stuck = 0; }
    e.lastX = e.x; e.lastZ = e.z;
    e.face = Math.atan2(p.z - e.z, p.x - e.x);
    const inRange = d <= e.r + p.r + 6;
    if (e.behaviour === 'ranged') {
      if (d > 360) { const a = e.face; const nx = e.x + Math.cos(a) * e.speed * dt, nz = e.z + Math.sin(a) * e.speed * dt; if (!collides(nx, nz, e.r)) { e.x = nx; e.z = nz; e.y = nz; } }
      else if (d < 200) { const a = e.face + Math.PI; const nx = e.x + Math.cos(a) * e.speed * dt, nz = e.z + Math.sin(a) * e.speed * dt; if (!collides(nx, nz, e.r)) { e.x = nx; e.z = nz; e.y = nz; } }
      else if (e.atkCd <= 0) {
        e.atkCd = 2.0;
        S.projectiles.push({ x: e.x, z: e.z, y: e.z, vx: Math.cos(e.face) * 300, vz: Math.sin(e.face) * 300, dmg: e.dmg, life: 1.6, from: 'enemy', mesh: null });
        if (scene) { const m = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), mat('#ff6b6b')); m.position.set(e.x, 30, e.z); scene.add(m); S.projectiles[S.projectiles.length - 1].mesh = m; }
        EmberAudio.shoot();
      }
    } else if (e.behaviour === 'armoured') {
      if (!inRange && d < 340) { const a = e.face; const nx = e.x + Math.cos(a) * e.speed * dt, nz = e.z + Math.sin(a) * e.speed * dt; if (!collides(nx, nz, e.r)) { e.x = nx; e.z = nz; e.y = nz; } }
      else if (inRange) {
        if (!e.telegraphing && e.atkCd <= 0) { e.telegraphing = true; e.telegraph = 0.6; }
        else if (e.telegraphing) { e.telegraph -= dt; if (e.telegraph <= 0) { e.telegraphing = false; e.atkCd = 1.4; damagePlayer(e.dmg); } }
      }
    } else {
      const speed = (e.behaviour === 'rusher' && d < 200) ? e.speed * 1.4 : e.speed;
      if (d < 340 && !inRange) { const a = e.face; const nx = e.x + Math.cos(a) * speed * dt, nz = e.z + Math.sin(a) * speed * dt; if (!collides(nx, nz, e.r)) { e.x = nx; e.z = nz; e.y = nz; } }
      else if (inRange && e.atkCd <= 0) { e.atkCd = 0.9; damagePlayer(e.dmg); }
    }
    if (e.barFront) { const f = Math.max(0.01, e.hp / e.maxHp); e.barFront.scale.x = f; e.barFront.position.x = -(1 - f) * 22; }
    if (e.mesh) setMeshPos(e.mesh, e.x, e.z, e.face);
  });
  S.projectiles = S.projectiles.filter(pr => {
    pr.x += pr.vx * dt; pr.z += pr.vz * dt; pr.y = pr.z; pr.life -= dt;
    if (pr.mesh) pr.mesh.position.set(pr.x, 30, pr.z);
    if (pr.life <= 0 || collides(pr.x, pr.z, 4)) { if (pr.mesh && scene) { try { scene.remove(pr.mesh); } catch (e) {} } return false; }
    if (pr.from === 'player') {
      for (const e of S.enemies) { if (!e.dead && Math.hypot(e.x - pr.x, e.z - pr.z) < e.r + 6) { hitEnemy(e, pr.dmg); if (pr.mesh && scene) { try { scene.remove(pr.mesh); } catch (err) {} } return false; } }
    } else {
      if (Math.hypot(p.x - pr.x, p.z - pr.z) < p.r + 6) { damagePlayer(pr.dmg); if (pr.mesh && scene) { try { scene.remove(pr.mesh); } catch (e) {} } return false; }
    }
    return true;
  });
  const t = nearestInteractable();
  $('interact-prompt').classList.toggle('hidden', !t);
  if (t) $('interact-prompt').innerHTML = t.kind === 'npc' ? `Press <b>E</b> — talk to ${t.npc.name}` : t.kind === 'shard' ? `Press <b>E</b> — claim the ${t.spot.name}` : t.kind === 'chest' ? 'Press <b>E</b> — open treasure chest' : t.kind === 'herb' ? 'Press <b>E</b> — pick rare herb' : t.kind === 'fish' ? 'Press <b>E</b> — fish here' : t.kind === 'clue' ? `Press <b>E</b> — examine ${t.spot.name}` : 'Press <b>E</b> — pick up the Lost Amulet';
  syncDynamicMeshes();
  updateHUD();
}

/* ---------- 3D rendering, minimap & world map ---------- */
function render3d(dt) {
  if (!scene || !camera || !renderer || !S) return;
  const p = S.player;
  setMeshPos(playerMesh, p.x, p.z, p.face);
  // Viewport/chunk culling (throttled): hide distant props so the bigger world
  // does not collapse performance. Buildings, NPCs, shards and chests are never culled.
  propCullTimer += dt;
  if (propCullTimer > 0.25) {
    propCullTimer = 0;
    propMeshes.forEach(pm => {
      if (pm.kind === 'house' || pm.kind === 'hall') { pm.mesh.visible = true; return; }
      pm.mesh.visible = Math.hypot(pm.x - p.x, pm.z - p.z) < 1500;
    });
  }
  // NPC idle animation: gentle bobbing, guards patrol a short loop.
  NPCS.forEach(n => {
    const m = npcMeshes[n.id]; if (!m) return;
    const t = (S.playSeconds || 0);
    m.position.y = Math.sin(t * 1.6 + n.x * 0.01) * 2;
    if (n.role === 'guard') { m.position.x = n.x + Math.sin(t * 0.4) * 60; }
  });
  SHARD_SPOTS.forEach(s => { const m = shardMeshes[s.id]; if (m) { m.rotation.y += dt * 1.5; m.position.y = 60 + Math.sin((S.playSeconds || 0) * 2 + s.x) * 8; } });
  CLUE_SPOTS.forEach(s => { const m = clueMeshes[s.id]; if (m) m.rotation.y += dt; });
  if (fireMesh) fireMesh.scale.set(1 + Math.sin((S.playSeconds || 0) * 9) * 0.12, 1 + Math.sin((S.playSeconds || 0) * 11) * 0.18, 1);
  treeMeshes.forEach(m => { m.rotation.z = Math.sin((S.playSeconds || 0) * 1.2 + m.position.x * 0.01) * 0.02; });
  // Smooth follow camera: fixed third-person angle behind/above the player.
  const tx = p.x, tz = p.z + 420, ty = 340;
  const k = Math.min(1, dt * 5);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (ty - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(p.x, 20, p.z);
  // Day/night lighting (gentle cycle, never dark enough to lose the player).
  if (sun) sun.intensity = 0.7 + 0.3 * Math.sin((S.playSeconds || 0) / 45);
  if (ambient) ambient.intensity = 0.55 + 0.15 * Math.sin((S.playSeconds || 0) / 45);
  renderer.render(scene, camera);
}
function drawMapOn(ctx2, W, H) {
  if (!ctx2 || !S) return;
  const sx = W / WORLD.W, sy = H / WORLD.H;
  const TS = 360, cols = Math.ceil(WORLD.W / TS), rows = Math.ceil(WORLD.H / TS);
  for (let tz = 0; tz < rows; tz++) for (let tx = 0; tx < cols; tx++) {
    const key = tx + ',' + tz;
    const cx = tx * TS + TS / 2, cz = tz * TS + TS / 2, b = getBiome(cx, cz);
    ctx2.fillStyle = S.explored.has(key) ? BIOME_COLORS[b][0] : '#111318';
    ctx2.fillRect(tx * TS * sx, tz * TS * sy, TS * sx + 1, TS * sy + 1);
  }
  ctx2.fillStyle = '#6aa84f'; ctx2.fillRect(VILLAGE.x * sx, VILLAGE.y * sy, VILLAGE.w * sx, VILLAGE.h * sy);
  ROADS.forEach(road => {
    ctx2.strokeStyle = 'rgba(141,110,99,0.9)'; ctx2.lineWidth = 2; ctx2.beginPath();
    road.points.forEach((pt, i) => { if (i === 0) ctx2.moveTo(pt[0] * sx, pt[1] * sy); else ctx2.lineTo(pt[0] * sx, pt[1] * sy); });
    ctx2.stroke();
  });
  LANDMARKS.forEach(l => {
    if (S.discovered.has(l.id)) { ctx2.fillStyle = '#ffeb3b'; ctx2.fillRect(l.x * sx - 3, l.y * sy - 3, 6, 6); }
  });
  SHARD_SPOTS.forEach(s => { if (!S.quests.main.shards[s.id]) { ctx2.fillStyle = '#ffeb3b'; ctx2.fillRect(s.x * sx - 2, s.y * sy - 2, 4, 4); } });
  if (S.quests.main.stage === 2) { ctx2.fillStyle = '#ff1744'; ctx2.fillRect(BOSS_SPOT.x * sx - 3, BOSS_SPOT.y * sy - 3, 6, 6); }
  const p = S.player;
  ctx2.fillStyle = '#ffffff'; ctx2.beginPath(); ctx2.arc(p.x * sx, p.z * sy, 4, 0, 7); ctx2.fill();
  ctx2.strokeStyle = '#ffffff'; ctx2.beginPath(); ctx2.moveTo(p.x * sx, p.z * sy); ctx2.lineTo((p.x + Math.cos(p.face) * 60) * sx, (p.z + Math.sin(p.face) * 60) * sy); ctx2.stroke();
}
function drawMinimap() { if (mmCtx) drawMapOn(mmCtx, mm.width, mm.height); }
function drawWorldMap() { const c = $('worldmap'); if (c) drawMapOn(c.getContext('2d'), c.width, c.height); }
function openMap() { if (mode !== 'playing') return; mode = 'map'; drawWorldMap(); showScreen('screen-map'); }
function closeMap() { showScreen(null); mode = 'playing'; }
function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTime) / 1000 || 0); lastTime = ts;
  if (mode === 'playing') { update(dt); render3d(dt); mmTimer += dt; if (mmTimer > 0.2) { mmTimer = 0; drawMinimap(); } }
  else if (mode === 'map') { drawWorldMap(); }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(loop);
}

/* ---------- Pause ---------- */
function pauseGame() { if (mode !== 'playing') return; mode = 'paused'; showScreen('screen-pause'); }
function resumeGame() { if (mode !== 'paused') return; showScreen(null); mode = 'playing'; }
function quitToTitle() {
  showScreen('screen-title'); mode = 'title'; $('hud').classList.add('hidden'); $('touch-controls').classList.add('hidden');
  $('btn-continue').classList.toggle('hidden', !hasSave()); closeDialogue();
}

/* ---------- Input ---------- */
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (mode === 'playing') {
    if (k === ' ' || k === 'j') playerAttack();
    if (k === 'e') doInteract();
    if (k === 'h') usePotion('hp');
    if (k === 'm') openMap();
    if (k === 'i') openInventory();
    if (k === 'q') openQuests();
    if (k === 'escape' || k === 'p') pauseGame();
  } else if (mode === 'paused' && (k === 'escape' || k === 'p')) resumeGame();
  else if (mode === 'quests' && (k === 'q' || k === 'escape')) closeQuests();
  else if (mode === 'inventory' && (k === 'i' || k === 'escape')) closeInventory();
  else if (mode === 'map' && (k === 'm' || k === 'escape')) closeMap();
  else if (mode === 'dialogue' && k === 'escape') closeDialogue();
});
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousedown', e => { if (mode === 'playing') playerAttack(); });
canvas.addEventListener('touchstart', e => { if (mode === 'playing' && e.target === canvas) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', e => { if (mode === 'playing' && e.target === canvas) e.preventDefault(); }, { passive: false });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pauseGame(); });

/* Touch joystick */
(function wireJoystick() {
  const joy = $('joystick'), knob = $('joy-knob'); if (!joy) return; let active = null;
  function setFromEvent(e) {
    const r = joy.getBoundingClientRect(), t = e.touches ? [...e.touches].find(x => x.identifier === active) : e; if (!t) return;
    let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    joyVec = { x: dx, y: dy }; knob.style.left = (32 + dx * 30) + 'px'; knob.style.top = (32 + dy * 30) + 'px';
  }
  joy.addEventListener('touchstart', e => { active = e.changedTouches[0].identifier; setFromEvent(e); e.preventDefault(); }, { passive: false });
  joy.addEventListener('touchmove', e => { setFromEvent(e); e.preventDefault(); }, { passive: false });
  const end = () => { active = null; joyVec = { x: 0, y: 0 }; knob.style.left = '32px'; knob.style.top = '32px'; };
  joy.addEventListener('touchend', end); joy.addEventListener('touchcancel', end);
  joy.addEventListener('mousedown', e => { active = 'mouse'; setFromEvent(e); });
  document.addEventListener('mousemove', e => { if (active === 'mouse') setFromEvent(e); });
  document.addEventListener('mouseup', () => { if (active === 'mouse') end(); });
})();
function bindTap(id, fn) { const el = $(id); if (!el) return; el.addEventListener('click', fn); el.addEventListener('touchend', e => { e.preventDefault(); fn(); }, { passive: false }); }
bindTap('touch-attack', () => playerAttack());
bindTap('touch-interact', () => doInteract());
bindTap('touch-potion', () => usePotion('hp'));

/* ---------- UI wiring ---------- */
function updatePreview() {
  const pv = $('cc-preview'); if (!pv) return;
  const c = CLASSES[selClass];
  pv.textContent = `${c.icon} ${selClass}`;
  pv.style.background = selColor; pv.style.color = '#fff';
}
function pickIn(containerId, attr, cb) { $(containerId).querySelectorAll('[data-' + attr + ']').forEach(b => b.addEventListener('click', () => { $(containerId).querySelectorAll('[data-' + attr + ']').forEach(x => x.classList.remove('selected')); b.classList.add('selected'); cb(b.dataset[attr]); updatePreview(); })); }
pickIn('cc-classes', 'class', v => selClass = v);
pickIn('cc-colors', 'color', v => selColor = v);
pickIn('cc-difficulty', 'diff', v => selDiff = v);
$('btn-new').addEventListener('click', () => {
  if (hasSave() && typeof window.confirm === 'function' && !window.confirm('Start a new game? Your saved game will not be deleted until you save over it.')) return;
  showScreen('screen-create'); mode = 'create'; updatePreview();
});
$('btn-how').addEventListener('click', () => showScreen('screen-how'));
document.querySelectorAll('[data-back-title]').forEach(b => b.addEventListener('click', quitToTitle));
$('btn-continue').addEventListener('click', () => { if (!loadGame()) toast('No save found'); });
$('btn-reset-save').addEventListener('click', resetSave);
$('btn-start').addEventListener('click', () => {
  const name = $('cc-name').value.trim() || 'Emberbearer';
  $('cc-name').value = name;
  startNewGame({ name, cls: selClass, color: selColor, diff: selDiff });
});
$('btn-intro-go').addEventListener('click', enterWorld);
$('btn-respawn').addEventListener('click', respawn);
$('btn-pause').addEventListener('click', pauseGame);
$('btn-resume').addEventListener('click', resumeGame);
$('btn-save').addEventListener('click', () => { saveGame(); });
$('btn-quit-title').addEventListener('click', quitToTitle);
$('btn-quests').addEventListener('click', openQuests);
$('btn-quests-close').addEventListener('click', closeQuests);
$('btn-inventory').addEventListener('click', openInventory);
$('btn-inventory-close').addEventListener('click', closeInventory);
$('btn-map').addEventListener('click', openMap);
$('btn-map-close').addEventListener('click', closeMap);
$('btn-shop-close').addEventListener('click', closeShop);
$('btn-potion').addEventListener('click', () => usePotion('hp'));
$('btn-mega').addEventListener('click', () => usePotion('mega'));
function toggleSound() { const on = EmberAudio.toggle(); toast(on ? '🔊 Sound on' : '🔇 Sound off'); $('btn-sound').textContent = on ? '🔊 Sound' : '🔇 Sound'; }
$('btn-sound').addEventListener('click', toggleSound);
$('btn-sound2').addEventListener('click', toggleSound);
$('btn-credits').addEventListener('click', () => {
  mode = 'credits'; showScreen('screen-credits');
  $('credits-hero').textContent = `${S.player.name}, the ${S.player.cls} of Ember Village`;
  const sc = $('credits-scroll'); sc.classList.remove('scrolling'); void sc.offsetWidth; sc.classList.add('scrolling');
});
$('btn-freeroam').addEventListener('click', () => { showScreen(null); mode = 'playing'; toast('🗺️ Free-roam — the world is yours.'); });
$('btn-ngplus').addEventListener('click', startNGPlus);

/* ---------- Adult mode UI wiring ---------- */
$('btn-adult-title').addEventListener('click', openAgeGate);
$('btn-adult-mode').addEventListener('click', () => {
  if (isAdultOn()) { disableAdultMode(); return; }
  openAgeGate();
});
$('btn-age-confirm').addEventListener('click', () => {
  const year = $('age-birth-year').value;
  const confirmed = $('age-confirm').checked;
  if (verifyAge(year, confirmed)) { closeAgeGate(); }
  else {
    const err = $('age-error');
    if (err) err.textContent = 'Adult Story Mode stays locked: you must enter a birth year showing you are 21 or older AND tick “I am 21 or older”. No birth year is stored.';
  }
});
$('btn-age-cancel').addEventListener('click', closeAgeGate);

/* ---------- Boot ---------- */
$('btn-continue').classList.toggle('hidden', !hasSave());
initScene();
if (typeof requestAnimationFrame === 'function') requestAnimationFrame(loop);

/* Test / automation hooks. */
window.__EMBERFALL__ = {
  get state() { return S; }, get mode() { return mode; },
  get scene() { return scene; }, get camera() { return camera; }, get renderer() { return renderer; },
  get playerMesh() { return playerMesh; }, get groundTileCount() { return groundTileCount; },
  get hasThree() { return HAS_THREE; }, ARMOUR_FORMULA,
  setMode: m => { mode = m; },
  classes: CLASSES, difficulties: DIFF,
  newPlayer, defaultQuests, startNewGame, enterWorld, startNGPlus,
  saveGame, loadGame, hasSave, resetSave, SAVE_KEY,
  talkTo, buyItem, equipItem, unequipItem, totalDefence, totalAttack, usePotion, playerAttack, hitEnemy, killEnemy, damagePlayer, die, respawn,
  collectShard, pickupAmulet, collectHerb, catchFish, collectClue, openChest, shardCount, doInteract, nearestInteractable,
  pauseGame, resumeGame, quitToTitle, openShop, openBlacksmith, closeShop, openQuests, closeQuests, openInventory, closeInventory, openMap, closeMap,
  collides, getBiome, tryMove, markExplored, drawMinimap, drawWorldMap, render3d,
  setKeys: k => { keys = Object.assign({}, k); }, setJoy: v => { joyVec = v; },
  spawnBoss, gainXP, update, NPCS_ref: NPCS, verifyAge, openAgeGate, closeAgeGate, disableAdultMode, endRomance, setRomance, romanceStage, isAdultOn, getAdultMode: () => (S ? S.adultMode === true : pendingAdult === true), SHOP_ITEMS_ref: SHOP_ITEMS, BLACKSMITH_ITEMS_ref: BLACKSMITH_ITEMS,
  CHESTS_ref: CHESTS, HERB_SPOTS_ref: HERB_SPOTS, FISH_SPOTS_ref: FISH_SPOTS, CLUE_SPOTS_ref: CLUE_SPOTS, LANDMARKS_ref: LANDMARKS
};
})();
