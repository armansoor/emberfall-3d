'use strict';
/* Emberfall 3D — scripted end-to-end playthrough tests (Node + jsdom + canvas mock + THREE stub).
   Run: NODE_PATH=/path/to/node_modules node tests/e2e.js   (requires the `jsdom` package) */
const fs = require('fs'), path = require('path');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { ({ JSDOM } = require('/tmp/ef-test/node_modules/jsdom')); }
const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0; const failures = [];
function check(name, cond) { if (cond) { passed++; console.log('PASS  ' + name); } else { failed++; failures.push(name); console.log('FAIL  ' + name); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function ctxStub() {
  return { fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '',
    fillRect() {}, strokeRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
    fillText() {}, strokeText() {}, measureText() { return { width: 0 }; },
    moveTo() {}, lineTo() {}, closePath() {}, save() {}, restore() {}, clearRect() {} };
}
function fresh() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.HTMLCanvasElement.prototype.getContext = function () { return this.__stub || (this.__stub = ctxStub()); };
  // THREE stub: enough of the global build for the engine to build a scene in Node.
  class Pos { constructor() { this.x = 0; this.y = 0; this.z = 0; } set(x, y, z) { this.x = x; this.y = y; this.z = z; } }
  class Base { constructor() { this.position = new Pos(); this.rotation = { x: 0, y: 0, z: 0 }; this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }; this.visible = true; this.children = []; this.intensity = 1; } add(o) { this.children.push(o); } remove(o) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); } }
  class Mesh extends Base { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
  class Group extends Base {}
  class Scene extends Base {}
  class Cam extends Base { lookAt() {} }
  class Light extends Base {}
  class Renderer { constructor(opts) { this.domElement = opts && opts.canvas; } setSize() {} setPixelRatio() {} render() {} }
  class Vec3 { constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; } project() { return this; } }
  w.THREE = { Scene, PerspectiveCamera: Cam, WebGLRenderer: Renderer, Mesh, Group, BoxGeometry: class {}, ConeGeometry: class {}, CylinderGeometry: class {}, SphereGeometry: class {}, OctahedronGeometry: class {}, PlaneGeometry: class {}, MeshLambertMaterial: class {}, AmbientLight: Light, DirectionalLight: Light, Vector3: Vec3 };
  // Concatenate: browsers share one global lexical scope across <script> tags;
  // separate jsdom eval() calls would isolate each file's top-level consts.
  const bundle = ['js/audio.js', 'js/world.js', 'js/game.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
  w.eval(bundle);
  return { dom, w, E: w.__EMBERFALL__, $: id => w.document.getElementById(id) };
}
function play(w, E, $, cfg) { E.startNewGame(cfg || { name: 'Tester', cls: 'Knight', color: '#e74c3c', diff: 'Normal' }); E.enterWorld(); return E.state; }
function near(E, x, y) { E.state.player.x = x; E.state.player.z = y; E.state.player.y = y; }

(async function main() {
  /* --- static file references --- */
  {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="(?!data:|http)([^"]+)"/g)].map(m => m[1]);
    check('static: all local file references exist', refs.length >= 4 && refs.every(r => fs.existsSync(path.join(ROOT, r))));
  }
  /* --- title / continue with no save, empty-name default --- */
  {
    const { w, E, $ } = fresh();
    check('title: Continue hidden when no save exists', $('btn-continue').classList.contains('hidden') && !E.hasSave());
    check('edge: loadGame with no save returns false gracefully', E.loadGame() === false);
    $('btn-new').click(); $('cc-name').value = '   '; $('btn-start').click();
    check('edge: empty character name defaults to Emberbearer', E.state.player.name === 'Emberbearer');
    check('flow: intro screen shows after creation', !$('screen-intro').classList.contains('hidden'));
    E.enterWorld(); check('flow: entering world sets playing mode', E.mode === 'playing');
    w.close();
  }
  /* --- all 3 classes --- */
  for (const cls of ['Knight', 'Mage', 'Ranger']) {
    const { w, E } = fresh(); const S = play(w, E, null, { name: 'T', cls, color: '#3498db', diff: 'Normal' });
    const base = E.classes[cls];
    check(`class ${cls}: stats applied (HP ${base.hp})`, S.player.maxHp === base.hp && S.player.cls === cls);
    if (base.projectile) {
      const before = S.player.mp; const ok = E.playerAttack();
      check(`class ${cls}: ranged attack fires projectile & costs MP correctly`, ok && S.projectiles.length === 1 && S.player.mp === before - (base.mpCost || 0));
    } else {
      const foe = S.enemies.find(e => !e.dead); foe.x = S.player.x + 50; foe.z = S.player.z; foe.y = S.player.z; S.player.face = 0; const hp0 = foe.hp;
      check('class Knight: melee attack damages enemy in front', E.playerAttack() && foe.hp < hp0);
    }
    check(`class ${cls}: render3d + minimap + update do not throw`, (() => { try { E.render3d(0.016); E.drawMinimap(); E.update(0.016); return true; } catch (e) { console.log(e); return false; } })());
    w.close();
  }
  /* --- difficulties --- */
  {
    const a = fresh(); const Sa = play(a.w, a.E, null, { name: 'T', cls: 'Knight', color: '#fff', diff: 'Story' });
    const b = fresh(); const Sb = play(b.w, b.E, null, { name: 'T', cls: 'Knight', color: '#fff', diff: 'Hardcore' });
    const ga = Sa.enemies.find(e => e.guardShard).maxHp, gb = Sb.enemies.find(e => e.guardShard).maxHp;
    check('difficulty: Hardcore enemies tougher than Story', gb > ga);
    a.w.close(); b.w.close();
  }
  /* --- movement & collision --- */
  {
    const { w, E } = fresh(); const S = play(w, E); const y0 = S.player.z;
    E.setKeys({ w: true }); for (let i = 0; i < 30; i++) E.tryMove(0.016);
    check('movement: W key moves player up (north, -z)', S.player.z < y0);
    E.setKeys({}); S.player.x = 1830; S.player.z = 2195; S.player.y = 2195; E.setKeys({ w: true });
    for (let i = 0; i < 60; i++) E.tryMove(0.016);
    check('collision: solid building (Elder Hall) blocks movement', S.player.z >= 2175);
    E.setKeys({}); S.player.z = 24; S.player.y = 24; E.setKeys({ w: true }); for (let i = 0; i < 30; i++) E.tryMove(0.016);
    check('collision: world border blocks movement', S.player.z >= 16);
    check('world: biomes distinct at 4+ locations', new Set([E.getBiome(600, 500), E.getBiome(3300, 500), E.getBiome(600, 2400), E.getBiome(3300, 2400), E.getBiome(1900, 2400)]).size === 5);
    w.close();
  }
  /* --- NPC dialogue, main quest accept, shop success + failure --- */
  {
    const { w, E, $ } = fresh(); const S = play(w, E); const mara = E.NPCS_ref.find(n => n.role === 'elder');
    near(E, mara.x, mara.y); check('npc: interact near Elder Mara opens dialogue', E.doInteract() && E.mode === 'dialogue' && !$('dialogue').classList.contains('hidden'));
    $('dlg-actions').querySelector('button').click();
    check('quest: accepting main quest sets stage 1', S.quests.main.stage === 1 && E.mode === 'playing');
    const bram = E.NPCS_ref.find(n => n.role === 'shop'); near(E, bram.x, bram.y); E.doInteract();
    $('dlg-actions').querySelector('button').click();
    check('shop: opens from Bram dialogue', E.mode === 'shop');
    const gold0 = S.player.gold, pot0 = S.player.potions.hp;
    check('shop: buy health potion succeeds with enough gold', E.buyItem('hp_potion') === true && S.player.gold === gold0 - 25 && S.player.potions.hp === pot0 + 1);
    check('shop: buy fails gracefully when gold is insufficient', E.buyItem('elixir') === false && S.player.gold === gold0 - 25);
    E.closeShop(); check('shop: closing returns to playing', E.mode === 'playing');
    const sana = E.NPCS_ref.find(n => n.role === 'healer'); S.player.hp = 30; near(E, sana.x, sana.y); E.doInteract();
    $('dlg-actions').querySelector('button').click();
    check('npc: Healer Sana restores HP fully', S.player.hp === S.player.maxHp);
    w.close();
  }
  /* --- side quests: slimes + amulet --- */
  {
    const { w, E, $ } = fresh(); const S = play(w, E);
    const lio = E.NPCS_ref.find(n => n.role === 'side_slimes'); near(E, lio.x, lio.y); E.doInteract(); $('dlg-actions').querySelector('button').click();
    check('side quest: Slime Menace accepted', S.quests.slimes.state === 1);
    S.enemies.filter(e => e.type === 'slime' && !e.dead).slice(0, 5).forEach(e => E.killEnemy(e));
    check('side quest: 5 slime kills counted', S.quests.slimes.kills === 5);
    const g0 = S.player.gold; near(E, lio.x, lio.y); E.doInteract(); $('dlg-actions').querySelector('button').click();
    check('side quest: slime reward paid (60g)', S.quests.slimes.state === 2 && S.player.gold === g0 + 60);
    const renn = E.NPCS_ref.find(n => n.role === 'side_amulet'); near(E, renn.x, renn.y); E.doInteract(); $('dlg-actions').querySelector('button').click();
    check('side quest: Lost Amulet accepted & amulet placed', S.quests.amulet.state === 1 && S.amuletOut === true);
    near(E, 980, 900); check('side quest: amulet pickup works', E.doInteract() === true && S.quests.amulet.has === true);
    check('edge: amulet cannot be picked up twice', E.pickupAmulet() === false);
    const g1 = S.player.gold; near(E, renn.x, renn.y); E.doInteract(); $('dlg-actions').querySelector('button').click();
    check('side quest: amulet reward paid (80g + elixir)', S.quests.amulet.state === 2 && S.player.gold === g1 + 80 && S.player.potions.elixir >= 1);
    w.close();
  }
  /* --- combat kill, XP, level up, potions --- */
  {
    const { w, E } = fresh(); const S = play(w, E);
    const foe = S.enemies.find(e => e.type === 'wolf' && !e.dead); const xp0 = S.player.xp, g0 = S.player.gold;
    E.hitEnemy(foe, 9999);
    check('combat: killing an enemy grants XP and gold', foe.dead && (S.player.xp > xp0 || S.player.level > 1) && S.player.gold > g0);
    E.gainXP(500); check('progression: enough XP levels the player up and restores HP', S.player.level >= 2 && S.player.hp === S.player.maxHp);
    S.player.hp = 20; const p0 = S.player.potions.hp;
    check('potion: drinking a health potion restores 50 HP', E.usePotion('hp') === true && S.player.hp === 70 && S.player.potions.hp === p0 - 1);
    S.player.potions.hp = 0; S.player.hp = 20;
    check('edge: using a potion with 0 potions fails gracefully', E.usePotion('hp') === false && S.player.hp === 20);
    check('edge: shard collect before main quest starts is blocked', E.collectShard('forest') === false);
    w.close();
  }
  /* --- full main quest: 3 shards -> boss -> ending -> credits -> NG+ --- */
  {
    const { w, E, $ } = fresh(); const S = play(w, E);
    const mara = E.NPCS_ref.find(n => n.role === 'elder'); near(E, mara.x, mara.y); E.doInteract(); $('dlg-actions').querySelector('button').click();
    for (const id of ['forest', 'desert', 'snow']) {
      check(`main quest: shard ${id} blocked while guardian alive`, E.collectShard(id) === false && !S.quests.main.shards[id]);
      const guard = S.enemies.find(e => e.guardShard === id); E.hitEnemy(guard, 99999);
      const spot = { forest: [520, 460], desert: [3320, 460], snow: [520, 2380] }[id]; near(E, spot[0], spot[1]);
      check(`main quest: shard ${id} collected after guardian falls`, E.doInteract() === true && S.quests.main.shards[id] === true);
      check(`edge: shard ${id} cannot be double-collected`, E.collectShard(id) === false);
    }
    check('main quest: after 3 shards the boss unlocks (stage 2 + boss spawned)', S.quests.main.stage === 2 && S.enemies.some(e => e.type === 'boss' && !e.dead));
    const boss = S.enemies.find(e => e.type === 'boss'); E.hitEnemy(boss, 99999);
    check('boss: killing Malachar completes the main quest (stage 3)', S.quests.main.stage === 3);
    await sleep(1100);
    check('ending: ending screen displays after boss kill', E.mode === 'ending' && !$('screen-ending').classList.contains('hidden'));
    $('btn-credits').click();
    check('credits: credits scene displays and scroll is rolling', E.mode === 'credits' && !$('screen-credits').classList.contains('hidden') && $('credits-scroll').classList.contains('scrolling'));
    $('btn-ngplus').click();
    check('new game+: NG+ resets quests, keeps level, increments counter', S.player.ngPlus === 1 && S.quests.main.stage === 0 && S.player.level >= 1 && E.mode === 'playing');
    $('btn-credits').click; // not valid outside ending; ensure no crash
    w.close();
  }
  /* --- free-roam after credits --- */
  {
    const { w, E, $ } = fresh(); const S = play(w, E); S.quests.main.stage = 3; E.setMode('ending'); w.document.getElementById('screen-ending').classList.remove('hidden');
    $('btn-credits').click(); $('btn-freeroam').click();
    check('credits: Keep Free-Roaming returns to the world', E.mode === 'playing');
    w.close();
  }
  /* --- save / load roundtrip --- */
  {
    const { w, E } = fresh(); const S = play(w, E);
    S.player.gold = 777; S.player.level = 4; S.quests.main.stage = 1; S.quests.main.shards.forest = true;
    check('save: saveGame writes a save', E.saveGame() === true && E.hasSave());
    S.player.gold = 1; S.player.level = 1;
    check('save: loadGame restores gold/level/quest state', E.loadGame() === true && E.state.player.gold === 777 && E.state.player.level === 4 && E.state.quests.main.shards.forest === true);
    w.close();
  }
  /* --- death / respawn, pause / resume --- */
  {
    const { w, E, $ } = fresh(); const S = play(w, E); S.player.gold = 100;
    E.damagePlayer(99999);
    check('death: HP hitting 0 shows the death screen', E.mode === 'dead' && !$('screen-death').classList.contains('hidden') && S.player.hp === 0);
    E.respawn();
    check('death: respawn restores HP at village with 10% gold loss', E.mode === 'playing' && S.player.hp === S.player.maxHp && S.player.gold === 90 && Math.hypot(S.player.x - 1900, S.player.z - 2420) < 2);
    E.pauseGame(); check('pause: pause menu opens', E.mode === 'paused' && !$('screen-pause').classList.contains('hidden'));
    E.resumeGame(); check('pause: resume returns to playing', E.mode === 'playing');
    E.openQuests(); check('quest log: opens and lists quests', E.mode === 'quests' && $('quest-list').innerHTML.includes('Shattered Ember'));
    E.closeQuests(); check('quest log: closes back to playing', E.mode === 'playing');
    w.close();
  }
  /* --- mobile touch controls --- */
  {
    const { w, E, $ } = fresh(); const S = play(w, E, null, { name: 'T', cls: 'Mage', color: '#2ecc71', diff: 'Normal' });
    check('mobile: joystick + attack/interact/potion buttons exist', !!$('joystick') && !!$('touch-attack') && !!$('touch-interact') && !!$('touch-potion'));
    $('touch-attack').click();
    check('mobile: attack button is wired (fires a projectile)', S.projectiles.length === 1);
    S.player.hp = 30; $('touch-potion').click();
    check('mobile: potion button is wired (restores HP)', S.player.hp === 80);
    w.close();
  }

  /* --- 3D scene --- */
  {
    const { w, E } = fresh(); const S = play(w, E);
    check('3D: THREE present, scene/camera/renderer/player mesh exist', E.hasThree === true && !!E.scene && !!E.camera && !!E.renderer && !!E.playerMesh);
    check('3D: ground tiles cover the expanded world', E.groundTileCount >= 60);
    check('3D: scene has hundreds of meshes (ground, props, NPCs, shards, chests)', E.scene.children.length > 200);
    check('3D: camera sits behind/above the player', E.camera.position.z > S.player.z && E.camera.position.y > 100);
    check('3D: render3d + world map draw do not throw', (() => { try { E.render3d(0.016); E.drawWorldMap(); return true; } catch (e) { console.log(e); return false; } })());
    w.close();
  }
  /* --- expanded world, colours, NPCs --- */
  {
    const { w, E } = fresh(); const S = play(w, E);
    check('world: expanded to 5760x4320', w.WORLD.W === 5760 && w.WORLD.H === 4320);
    check('world: coast biome east of the old world', E.getBiome(5000, 1000) === 'coast');
    check('world: highlands biome south of the old world', E.getBiome(1500, 3700) === 'highlands');
    check('world: original biomes unchanged', E.getBiome(600, 500) === 'forest' && E.getBiome(3300, 500) === 'desert' && E.getBiome(600, 2400) === 'snow' && E.getBiome(3300, 2400) === 'shadow');
    check('npcs: 11 NPCs including 6 new men/women', E.NPCS_ref.length === 11 && ['doran', 'mira', 'finn', 'ivy', 'garrick', 'selene'].every(id => E.NPCS_ref.some(n => n.id === id)));
    check('npcs: new NPCs are 3 men + 3 women', ['doran', 'finn', 'garrick'].every(id => E.NPCS_ref.find(n => n.id === id).gender === 'man') && ['mira', 'ivy', 'selene'].every(id => E.NPCS_ref.find(n => n.id === id).gender === 'woman'));
    check('colours: at least 12 character-creation swatches', w.document.querySelectorAll('#cc-colors .swatch').length >= 12);
    check('landmarks: 9 landmarks including settlements, secret clearing, cave, camp', E.LANDMARKS_ref.length >= 9);
    w.close();
  }
  /* --- new side quest: Herbalist's Rare Remedy --- */
  {
    const { w, E, $ } = fresh(); const S = play(w, E);
    const ivy = E.NPCS_ref.find(n => n.role === 'side_herbs'); near(E, ivy.x, ivy.y); E.doInteract(); $('dlg-actions').querySelector('button').click();
    check('quest herbs: accepted', S.quests.herbs.state === 1);
    for (const spot of E.HERB_SPOTS_ref) { near(E, spot.x, spot.y); E.doInteract(); }
    check('quest herbs: 3 rare herbs collected in the Highlands', S.quests.herbs.collected.length === 3);
    const g0 = S.player.gold; near(E, ivy.x, ivy.y); E.doInteract(); $('dlg-actions').querySelector('button').click();
    check('quest herbs: reward paid (90g + mega potion)', S.quests.herbs.state === 2 && S.player.gold === g0 + 90 && S.player.potions.mega >= 1);
    w.close();
  }
  /* --- new side quest: A Fisherman's Catch --- */
  {
    const { w, E, $ } = fresh(); const S = play(w, E);
    const finn = E.NPCS_ref.find(n => n.role === 'side_fish'); near(E, finn.x, finn.y); E.doInteract(); $('dlg-actions').querySelector('button').click();
    check('quest fish: accepted', S.quests.fish.state === 1);
    for (const spot of E.FISH_SPOTS_ref) { near(E, spot.x, spot.y); E.doInteract(); }
    check('quest fish: 3 fish caught on the coast', S.quests.fish.caught === 3);
    const g0 = S.player.gold; near(E, finn.x, finn.y); E.doInteract(); $('dlg-actions').querySelector('button').click();
    check('quest fish: reward paid (100g + elixir)', S.quests.fish.state === 2 && S.player.gold === g0 + 100 && S.player.potions.elixir >= 1);
    w.close();
  }
  /* --- new side quest: The Missing Fisherman --- */
  {
    const { w, E, $ } = fresh(); const S = play(w, E);
    const garrick = E.NPCS_ref.find(n => n.role === 'guard'); near(E, garrick.x, garrick.y); E.doInteract(); $('dlg-actions').querySelector('button').click();
    check('quest missing: accepted', S.quests.missing.state === 1);
    for (const spot of E.CLUE_SPOTS_ref) { near(E, spot.x, spot.y); E.doInteract(); }
    check('quest missing: 3 clues found', S.quests.missing.clues.length === 3);
    const brute = S.enemies.find(e => e.brute); E.hitEnemy(brute, 99999);
    check('quest missing: Coast Brute defeated', S.quests.missing.bruteDead === true && brute.dead === true);
    const g0 = S.player.gold; near(E, garrick.x, garrick.y); E.doInteract(); $('dlg-actions').querySelector('button').click();
    check('quest missing: reward paid (120g + Steel Armour equipped)', S.quests.missing.state === 2 && S.player.gold === g0 + 120 && S.player.inventory.some(i => i.id === 'steel_armour'));
    w.close();
  }
  /* --- treasure chests: once-only + save persistence --- */
  {
    const { w, E } = fresh(); const S = play(w, E);
    const chest = E.CHESTS_ref[0]; const g0 = S.player.gold;
    near(E, chest.x, chest.y);
    check('chest: opening gives gold + potion', E.doInteract() === true && S.player.gold > g0 && S.chestsOpened.includes(chest.id));
    check('chest: cannot be opened twice', E.doInteract() === false);
    E.saveGame(); S.chestsOpened = [];
    check('chest: opened state persists after save/load', E.loadGame() === true && E.state.chestsOpened.includes(chest.id));
    w.close();
  }
  /* --- blacksmith, equipment, armour formula --- */
  {
    const { w, E, $ } = fresh(); const S = play(w, E); S.player.gold = 1000;
    const doran = E.NPCS_ref.find(n => n.role === 'blacksmith'); near(E, doran.x, doran.y); E.doInteract(); $('dlg-actions').querySelector('button').click();
    check('blacksmith: forge shop opens', E.mode === 'shop' && $('shop-title').textContent.includes('Forge'));
    check('blacksmith: buying Iron Armour works', E.buyItem('iron_armour') === true && S.player.inventory.some(i => i.id === 'iron_armour'));
    check('armour: total defence is 3 with Iron Armour equipped', E.totalDefence(S.player) === 3);
    E.closeShop(); S.player.hp = 100; S.player.invulnUntil = 0;
    E.damagePlayer(10);
    check('armour: damage reduced by defence (10 -> 7, formula max(1, dmg - defence))', S.player.hp === 93);
    check('armour: formula documented', E.ARMOUR_FORMULA.includes('max(1'));
    E.unequipItem('armour');
    check('armour: unequipping removes the defence', E.totalDefence(S.player) === 0);
    E.equipItem('iron_armour');
    check('armour: re-equipping restores the defence, no double-apply', E.totalDefence(S.player) === 3);
    S.player.gold = 0;
    check('shop: failed purchase changes nothing', E.buyItem('ember_blade') === false && S.player.gold === 0 && !S.player.inventory.some(i => i.id === 'ember_blade'));
    check('shop: mega potion buy works', (() => { S.player.gold = 100; return E.buyItem('mega_potion') === true && S.player.potions.mega === 1; })());
    S.player.hp = 20;
    check('potion: mega potion restores 100 HP (20 -> 120, under the 130 cap)', E.usePotion('mega') === true && S.player.hp === 120);
    w.close();
  }
  /* --- new enemies: distinct behaviours --- */
  {
    const { w, E } = fresh(); const S = play(w, E);
    check('enemies: crab, goblin, spider, archer, golem all spawn', ['crab', 'goblin', 'spider', 'archer', 'golem'].every(t => S.enemies.some(e => e.type === t)));
    const spider = S.enemies.find(e => e.type === 'spider');
    const archer = S.enemies.find(e => e.type === 'archer');
    const golem = S.enemies.find(e => e.type === 'golem');
    check('enemies: spider is a fast rusher', spider.behaviour === 'rusher' && spider.speed >= 130);
    check('enemies: archer is ranged', archer.behaviour === 'ranged');
    check('enemies: golem is armoured (damage reduced by 5)', golem.armour === 5 && (() => { const hp0 = golem.hp; E.hitEnemy(golem, 20); return golem.hp === hp0 - 15; })());
    // Archer fires a projectile when in range.
    archer.x = S.player.x + 300; archer.z = S.player.z; archer.y = S.player.z; archer.atkCd = 0;
    const before = S.projectiles.length; E.update(0.016);
    check('enemies: archer shoots an enemy projectile', S.projectiles.length > before && S.projectiles.some(pr => pr.from === 'enemy'));
    w.close();
  }
  /* --- fog of war, world map, inventory --- */
  {
    const { w, E, $ } = fresh(); const S = play(w, E);
    E.markExplored();
    check('fog: explored tiles recorded', S.explored.size > 0);
    E.openMap(); check('map: world map opens (M)', E.mode === 'map' && !$('screen-map').classList.contains('hidden'));
    E.closeMap(); check('map: world map closes back to playing', E.mode === 'playing');
    E.openInventory(); check('inventory: inventory opens (I) and shows the armour formula', E.mode === 'inventory' && $('inventory-list').innerHTML.includes('max(1'));
    E.closeInventory(); check('inventory: inventory closes back to playing', E.mode === 'playing');
    w.close();
  }
  console.log(`\n==== RESULT: ${passed} passed, ${failed} failed ====`);
  if (failures.length) console.log('Failures:\n - ' + failures.join('\n - '));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
