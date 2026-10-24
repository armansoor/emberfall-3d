'use strict';
/* Emberfall — world data: biomes, props/collision, NPCs, shards, spawns. */
const WORLD = { W: 7680, H: 5760, TILE: 64 };
const VILLAGE = { x: 1440, y: 1980, w: 960, h: 820 }; // south-centre (unchanged)
const SPAWN = { x: 1900, y: 2420 }; // village square (unchanged)

function getBiome(x, y) {
  if (x >= VILLAGE.x && x < VILLAGE.x + VILLAGE.w && y >= VILLAGE.y && y < VILLAGE.y + VILLAGE.h) return 'village';
  // NEW territory only — every original coordinate keeps its original biome.
  // Moonlit Vale is the new eastern strip (x >= 5760), beyond the old world's edge.
  if (x >= 5760) return 'vale';        // Moonlit Vale: new in this expansion
  if (x >= 4200) return 'coast';       // Sunset Coast: east of the old world
  if (y >= 3100) return 'highlands';   // Stormpeak Highlands: south of the old world
  if (y < 1400) return x < 1920 ? 'forest' : 'desert';
  return x < 1920 ? 'snow' : 'shadow';
}
const BIOME_COLORS = {
  village: ['#6aa84f', '#639c49'], forest: ['#2d5a27', '#285120'],
  desert: ['#d9b36c', '#cfa95f'], snow: ['#dfe9f2', '#d2e0ee'], shadow: ['#3a2b4a', '#342744'],
  coast: ['#a8d8e8', '#9ccfe0'], highlands: ['#8a9ba8', '#7d8e9c'], vale: ['#5b7a6e', '#527063']
};

const SHARD_SPOTS = [
  { id: 'forest', name: 'Verdant Shard', icon: '🟢', x: 520, y: 460, biome: 'forest', guardian: 'Treant Guardian' },
  { id: 'desert', name: 'Solar Shard', icon: '🟡', x: 3320, y: 460, biome: 'desert', guardian: 'Dune Guardian' },
  { id: 'snow', name: 'Frost Shard', icon: '🔵', x: 520, y: 2380, biome: 'snow', guardian: 'Frost Guardian' }
];
const BOSS_SPOT = { x: 3320, y: 2260 };
const AMULET_SPOT = { x: 980, y: 900 };
const HERB_SPOTS = [
  { id: 'herb1', x: 1100, y: 3750 }, { id: 'herb2', x: 2400, y: 3900 }, { id: 'herb3', x: 3400, y: 3500 }
];
/* Missing Fisherman clues: a broken net, a beached boat, footprints — all on the coast. */
const CLUE_SPOTS = [
  { id: 'clue_net', name: 'Broken Net', x: 4800, y: 800 },
  { id: 'clue_boat', name: 'Beached Boat', x: 5200, y: 1900 },
  { id: 'clue_tracks', name: 'Strange Tracks', x: 4600, y: 2400 }
];
const LANDMARKS = [
  { id: 'village', name: 'Ember Village', x: 1900, y: 2420, type: 'settlement' },
  { id: 'outpost', name: 'Stormpeak Outpost', x: 1500, y: 3700, type: 'settlement' },
  { id: 'fishing_village', name: 'Saltwind Fishing Village', x: 4700, y: 1200, type: 'settlement' },
  { id: 'hidden_clearing', name: 'Hidden Clearing', x: 1200, y: 700, type: 'secret' },
  { id: 'fern_lake', name: 'Fern Lake', x: 1000, y: 1100, type: 'water' },
  { id: 'ruins', name: 'Old Ember Ruins', x: 3400, y: 1200, type: 'ruins' },
  { id: 'cave', name: 'Spider Cave', x: 2800, y: 3800, type: 'dungeon' },
  { id: 'enemy_camp', name: 'Shadow Camp', x: 3000, y: 2600, type: 'camp' },
  { id: 'cliffs', name: 'Salt Cliffs', x: 5400, y: 2200, type: 'landmark' },
  { id: 'moonhaven', name: 'Moonhaven', x: 6600, y: 1200, type: 'settlement' },
  { id: 'moonlit_lake', name: 'Moonlit Lake', x: 6400, y: 2000, type: 'water' },
  { id: 'vale_ruins', name: 'Vale Ruins', x: 7000, y: 800, type: 'ruins' },
  { id: 'observatory', name: 'Starfall Observatory', x: 6800, y: 2600, type: 'landmark' }
];
/* Roads: walkable, drawn on the ground and on the maps. Points are [x, y] in world space. */
const ROADS = [
  { points: [[1900, 2420], [1900, 1500], [1200, 700], [520, 460]] },
  { points: [[1900, 2420], [2800, 2000], [3800, 1600], [4700, 1200]] },
  { points: [[1900, 2420], [1900, 3000], [1500, 3700]] },
  { points: [[1900, 2420], [3000, 2600], [3320, 2260]] },
  { points: [[4700, 1200], [5600, 1200], [6600, 1200]] },
  { points: [[6600, 1200], [6400, 2000], [6800, 2600]] }
];
const FISH_SPOTS = [
  { id: 'fish1', x: 5450, y: 900 }, { id: 'fish2', x: 5450, y: 1800 }, { id: 'fish3', x: 5000, y: 2700 }
];
const CHESTS = [
  { id: 'chest_village', x: 1500, y: 2750, gold: 50, potion: 'hp' },
  { id: 'chest_forest', x: 900, y: 1300, gold: 75, potion: 'hp' },
  { id: 'chest_desert', x: 2900, y: 800, gold: 100, potion: 'mp' },
  { id: 'chest_snow', x: 900, y: 2600, gold: 100, potion: 'hp' },
  { id: 'chest_coast', x: 5200, y: 1400, gold: 150, potion: 'mega' },
  { id: 'chest_highlands', x: 2600, y: 3900, gold: 150, potion: 'elixir' },
  { id: 'chest_hidden', x: 1200, y: 700, gold: 200, potion: 'mega' },
  { id: 'chest_vale', x: 6600, y: 1500, gold: 200, potion: 'elixir' }
];
const BIOME_NAMES = { village: 'Ember Village', forest: 'Whispering Forest', desert: 'Sunscorch Desert', snow: 'Frostbite Snowfields', shadow: 'The Shadowlands', coast: 'Sunset Coast', highlands: 'Stormpeak Highlands', vale: 'Moonlit Vale' };

/* Deterministic seeded RNG so the world is identical on every load. */
function mulberry32(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const PROPS = []; // {x,y,w,h,kind,biome,solid}
(function buildProps() {
  const rnd = mulberry32(1337);
  const kinds = { forest: 'tree', desert: 'cactus', snow: 'pine', shadow: 'dead', village: 'flower', coast: 'palm', highlands: 'peak', vale: 'willow' };
  const clearOf = (x, y) => (
    Math.hypot(x - SPAWN.x, y - SPAWN.y) < 170 ||
    SHARD_SPOTS.some(s => Math.hypot(x - s.x, y - s.y) < 120) ||
    Math.hypot(x - BOSS_SPOT.x, y - BOSS_SPOT.y) < 200 ||
    Math.hypot(x - AMULET_SPOT.x, y - AMULET_SPOT.y) < 90 ||
    HERB_SPOTS.some(s => Math.hypot(x - s.x, y - s.y) < 90) ||
    CLUE_SPOTS.some(s => Math.hypot(x - s.x, y - s.y) < 90) ||
    FISH_SPOTS.some(s => Math.hypot(x - s.x, y - s.y) < 90) ||
    CHESTS.some(s => Math.hypot(x - s.x, y - s.y) < 90) ||
    // new NPC clearings (see NPCS below)
    [[1950,2700],[1750,2350],[4700,1200],[2250,2400],[1450,2300],[1500,3700],[2050,2500],[6500,1350],[6600,1200],[6400,2000],[6600,1500]].some(p => Math.hypot(x - p[0], y - p[1]) < 90)
  );
  for (let i = 0; i < 1400; i++) {
    const x = 40 + rnd() * (WORLD.W - 80), y = 40 + rnd() * (WORLD.H - 80);
    const b = getBiome(x, y);
    if (clearOf(x, y)) continue;
    const solid = b !== 'village';
    PROPS.push({ x, y, w: 30, h: 30, kind: kinds[b], biome: b, solid });
  }
  // Village buildings (solid, with labels)
  const buildings = [
    { x: 1560, y: 2080, w: 150, h: 110, kind: 'house', label: 'Shop' },
    { x: 2100, y: 2080, w: 150, h: 110, kind: 'house', label: 'Inn' },
    { x: 1830, y: 2100, w: 170, h: 120, kind: 'hall', label: 'Elder Hall' },
    { x: 1620, y: 2560, w: 130, h: 100, kind: 'house', label: 'Farm' },
    { x: 2080, y: 2560, w: 130, h: 100, kind: 'house', label: 'Cottage' },
    { x: 1350, y: 3600, w: 130, h: 100, kind: 'house', label: 'Outpost' },
    { x: 1680, y: 3600, w: 130, h: 100, kind: 'house', label: 'Outpost' },
    { x: 4550, y: 1080, w: 130, h: 100, kind: 'house', label: 'Fish Hut' },
    { x: 4880, y: 1080, w: 130, h: 100, kind: 'house', label: 'Fish Hut' },
    { x: 6450, y: 1080, w: 130, h: 100, kind: 'house', label: 'Moonhaven Inn' },
    { x: 6750, y: 1080, w: 130, h: 100, kind: 'house', label: 'Moonhaven Hall' }
  ];
  buildings.forEach(b => PROPS.push(Object.assign({ biome: 'village', solid: true }, b)));
  // Border rocks keep the player inside the world
  for (let x = 0; x < WORLD.W; x += 64) { PROPS.push({ x, y: 8, w: 40, h: 24, kind: 'rock', biome: 'forest', solid: true }); PROPS.push({ x, y: WORLD.H - 32, w: 40, h: 24, kind: 'rock', biome: 'forest', solid: true }); }
  for (let y = 0; y < WORLD.H; y += 64) { PROPS.push({ x: 8, y, w: 24, h: 40, kind: 'rock', biome: 'forest', solid: true }); PROPS.push({ x: WORLD.W - 32, y, w: 24, h: 40, kind: 'rock', biome: 'forest', solid: true }); }
})();

const NPCS = [
  { id: 'mara', name: 'Elder Mara', icon: '🧙‍♀️', x: 1915, y: 2280, color: '#8e44ad', role: 'elder', gender: 'woman' },
  { id: 'bram', name: 'Bram the Shopkeeper', icon: '🧔', x: 1635, y: 2230, color: '#b9770e', role: 'shop', gender: 'man' },
  { id: 'lio', name: 'Farmer Lio', icon: '🌾', x: 1700, y: 2680, color: '#229954', role: 'side_slimes', gender: 'man' },
  { id: 'renn', name: 'Scout Renn', icon: '🧭', x: 2180, y: 2680, color: '#2471a3', role: 'side_amulet', gender: 'woman' },
  { id: 'sana', name: 'Healer Sana', icon: '💖', x: 2160, y: 2230, color: '#e84393', role: 'healer', gender: 'woman' },
  // --- Expansion NPCs: 3 men, 3 women ---
  { id: 'doran', name: 'Doran the Blacksmith', icon: '🔨', x: 1950, y: 2700, color: '#7f8c8d', role: 'blacksmith', gender: 'man' },
  { id: 'mira', name: 'Mira the Baker', icon: '🍞', x: 1750, y: 2350, color: '#d35400', role: 'baker', gender: 'woman' },
  { id: 'finn', name: 'Finn the Fisherman', icon: '🎣', x: 4700, y: 1200, color: '#2980b9', role: 'side_fish', gender: 'man' },
  { id: 'ivy', name: 'Ivy the Herbalist', icon: '🌿', x: 2250, y: 2400, color: '#27ae60', role: 'side_herbs', gender: 'woman' },
  { id: 'garrick', name: 'Garrick the Guard', icon: '🛡️', x: 1450, y: 2300, color: '#2c3e50', role: 'guard', gender: 'man' },
  { id: 'selene', name: 'Selene the Traveller', icon: '🧳', x: 1500, y: 3700, color: '#8e44ad', role: 'traveller', gender: 'woman' },
  // --- Adult Story Mode romance NPCs (adults only; ages stated in adult dialogue) ---
  { id: 'elara', name: 'Elara the Innkeeper', icon: '🏮', x: 2050, y: 2500, color: '#e67e22', role: 'romance_elara', gender: 'woman', adult: true, age: 27 },
  { id: 'kael', name: 'Kael the Caravan Guard', icon: '🐎', x: 6500, y: 1350, color: '#2e86c1', role: 'romance_kael', gender: 'man', adult: true, age: 29 }
];

const ENEMY_TYPES = {
  slime:   { name: 'Slime',        icon: '🟢', hp: 24,  dmg: 6,  speed: 55,  xp: 14, gold: [3, 9],   r: 15, color: '#58d68d', biomes: ['village', 'forest'] },
  wolf:    { name: 'Dire Wolf',    icon: '🐺', hp: 38,  dmg: 9,  speed: 105, xp: 22, gold: [5, 12],  r: 16, color: '#808b96', biomes: ['forest'] },
  scorpion:{ name: 'Sand Scorpion',icon: '🦂', hp: 44,  dmg: 11, speed: 85,  xp: 28, gold: [7, 15],  r: 16, color: '#ca6f1e', biomes: ['desert'] },
  wraith:  { name: 'Snow Wraith',  icon: '👻', hp: 52,  dmg: 13, speed: 80,  xp: 34, gold: [9, 18],  r: 16, color: '#aed6f1', biomes: ['snow'] },
  imp:     { name: 'Shadow Imp',   icon: '😈', hp: 60,  dmg: 15, speed: 95,  xp: 42, gold: [12, 22], r: 16, color: '#7d3c98', biomes: ['shadow'] },
  crab:    { name: 'Snapper Crab', icon: '🦀', hp: 40,  dmg: 10, speed: 70,  xp: 26, gold: [6, 14],  r: 15, color: '#e74c3c', biomes: ['coast'] },
  goblin:  { name: 'Highland Goblin', icon: '🧌', hp: 48, dmg: 13, speed: 90,  xp: 32, gold: [8, 16],  r: 16, color: '#27ae60', biomes: ['highlands'] },
  spider:  { name: 'Mountain Spider', icon: '🕷️', hp: 45, dmg: 13, speed: 145, xp: 38, gold: [9, 18],  r: 15, color: '#2c3e50', biomes: ['highlands'], behaviour: 'rusher' },
  archer:  { name: 'Goblin Archer', icon: '🏹', hp: 50, dmg: 12, speed: 80,  xp: 40, gold: [10, 18], r: 15, color: '#8e6e2e', biomes: ['highlands', 'shadow'], behaviour: 'ranged' },
  golem:   { name: 'Stone Golem', icon: '🗿', hp: 190, dmg: 20, speed: 45,  xp: 70, gold: [20, 35], r: 24, color: '#7f8c8d', biomes: ['highlands'], behaviour: 'armoured', armour: 5 },
  wisp:    { name: 'Moonlit Wisp', icon: '✨', hp: 55,  dmg: 14, speed: 110, xp: 40, gold: [10, 20], r: 15, color: '#9b59b6', biomes: ['vale'] },
  guardian:{ name: 'Guardian',     icon: '🗿', hp: 150, dmg: 16, speed: 60,  xp: 90, gold: [30, 50], r: 26, color: '#935116', biomes: [] },
  boss:    { name: 'Malachar, the Ashen King', icon: '👹', hp: 420, dmg: 22, speed: 72, xp: 300, gold: [200, 200], r: 34, color: '#641e16', biomes: [] }
};
const SHOP_ITEMS = [
  { id: 'hp_potion', name: 'Health Potion', icon: '🧪', price: 25, desc: 'Restores 50 HP' },
  { id: 'mp_potion', name: 'Mana Potion', icon: '🔷', price: 20, desc: 'Restores 40 MP' },
  { id: 'elixir', name: 'Ember Elixir', icon: '✨', price: 80, desc: 'Fully restores HP & MP' },
  { id: 'sword_up', name: 'Sharpening Stone', icon: '🗡️', price: 120, desc: '+4 attack, permanently' },
  { id: 'mega_potion', name: 'Mega Health Potion', icon: '💊', price: 50, desc: 'Restores 100 HP' }
];
const BLACKSMITH_ITEMS = [
  { id: 'steel_sword', name: 'Steel Sword', icon: '⚔️', price: 150, desc: 'Weapon: +6 attack while equipped' },
  { id: 'iron_armour', name: 'Iron Armour', icon: '🛡️', price: 140, desc: 'Armour: +3 defence while equipped. Damage taken = max(1, enemy damage − total defence)' },
  { id: 'ember_blade', name: 'Ember Blade', icon: '🔥', price: 260, desc: 'Weapon: +10 attack while equipped' },
  { id: 'steel_armour', name: 'Steel Armour', icon: '🛡️', price: 280, desc: 'Armour: +6 defence while equipped. Damage taken = max(1, enemy damage − total defence)' }
];
if (typeof window !== 'undefined') { window.WORLD = WORLD; window.getBiome = getBiome; }
