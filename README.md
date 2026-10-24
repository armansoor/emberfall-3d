# 🔥 Emberfall 3D — A 3D Open World Adventure

**▶ Play the game: https://armansoor.github.io/emberfall-3d/**

A complete, playable 3D open-world RPG that runs entirely in the browser. No build step, no backend — just HTML, CSS and JavaScript with Three.js (pinned CDN global build, `three.min.js` 0.158.0) for the 3D world, plus the HTML UI screens.

**🆓 Play free — no account needed, no purchase, no paywall.** There is no payment code in this game.

**Created by Abdur Rahman Mansoor · Built by Nyx / Muse**

**Also try the original 2D version: https://armansoor.github.io/emberfall-open-world/**

## The Story

Long ago, the Ember Crystal kept the seven lands in balance. Then Malachar, the Ashen King, shattered it and fled to the Shadowlands. Three shards survived — hidden in the **Whispering Forest**, the **Sunscorch Desert** and the **Frostbite Snowfields**, each watched by a guardian. You are the last Emberbearer. Gather the shards, break the seal, and face Malachar.

## Features

- **Full A–Z flow:** title screen → character creation → intro → open world → main quest chain → final boss → ending → scrolling end credits → free-roam or **New Game+**
- **3D world:** third-person follow camera (smooth, fixed angle behind/above the player), biome-coloured terrain, trees/palms/peaks as 3D props, buildings with roofs, coloured 3D figures for NPCs and enemies, rotating floating shard octahedrons, glowing projectile spheres. If Three.js fails to load, a clear in-page error is shown instead of a blank screen.
- **A much bigger world (7680 × 5760):** Ember Village + countryside, Whispering Forest (hidden paths, clearings, the Hidden Clearing, Fern Lake), Sunscorch Desert, Frostbite Snowfields, the Shadowlands, **Sunset Coast** (beaches, cliffs, fishing spots, Saltwind Fishing Village), **Stormpeak Highlands** (caves, narrow trails, ruins, Stormpeak Outpost) and the new **Moonlit Vale** to the far east — Moonhaven settlement, Moonlit Lake, Vale Ruins and Starfall Observatory, connected by roads from the coast, with willow trees, Moonlit Wisp enemies and a Vale treasure chest. Roads connect all regions, and landmarks include the Old Ember Ruins, Spider Cave and Shadow Camp. Off-path exploration is rewarded with treasure chests. Distant scenery props are culled outside the viewport (chunk-style) so the bigger world keeps its performance; the fog-of-war minimap and world map cover the full 7680 × 5760 world.
- **Character creation:** name, 3 classes (**Knight** — melee tank, **Mage** — ranged firebolts costing MP, **Ranger** — fast arrows), **12 appearance colours** with a live preview, 3 difficulties (Story / Normal / Hardcore). Appearance persists in saves.
- **NPCs — men and women, each with a role and quest-aware dialogue:** Elder Mara, Bram the Shopkeeper, Farmer Lio, Scout Renn, Healer Sana, plus **Doran the Blacksmith** (weapons/armour shop), **Mira the Baker** (hints), **Garrick the Guard** (quest info), **Finn the Fisherman** (coast quest), **Ivy the Herbalist** (potions quest) and **Selene the Traveller** (rumours and secret-area hints). NPCs bob idly; the guard patrols. Press **E** near an NPC (or the 💬 mobile button) to talk.
- **Main quest:** collect 3 elemental shards, each guarded, then unlock and defeat the final boss.
- **Side quests (all tracked in the quest journal, with rewards and persistent state):**
  - *Slime Menace* (Farmer Lio) — defeat 5 slimes. Reward: 60 gold + potion.
  - *The Lost Amulet* (Scout Renn) — fetch quest in the Forest. Reward: 80 gold + elixir.
  - *Herbalist's Rare Remedy* (Ivy) — gather 3 rare herbs from the dangerous Stormpeak Highlands. Reward: 90 gold + mega potion.
  - *A Fisherman's Catch* (Finn) — fish at 3 spots on the Sunset Coast. Reward: 100 gold + elixir.
  - *The Missing Fisherman* (Garrick) — follow 3 clues along the coast, defeat the Coast Brute, return the evidence. Reward: 120 gold + Steel Armour.
- **Enemies with genuinely different behaviour, not just recolors:** fast melee rusher (Mountain Spider), ranged attacker (Goblin Archer — keeps its distance and shoots), heavily armoured tactical enemy (Stone Golem — slow, telegraphed attacks, 5 damage reduction per hit), plus slimes, wolves, scorpions, wraiths, imps, crabs and goblins. Enemies have health bars, hit reactions, damage numbers, death animations, i-frames on the player so damage is never applied every frame, and stuck-enemy recovery. Melee attacks cannot hit through walls.
- **Treasure chests:** 8 chests across the world (village, forest, desert, snowfields, coast, highlands, hidden clearing, Moonlit Vale). Open with **E** / the mobile interact button. Closed and open visual states, real gold/potion rewards, claimable once only, and opened state **persists after save/load**.
- **Equipment & armour (real, documented formula):** weapons (Steel Sword +6 attack, Ember Blade +10) and armour (Iron Armour +3 defence, Steel Armour +6) bought at Doran's Forge, managed in the inventory screen (equip/unequip, tooltips with effects and prices). **Damage taken = max(1, enemy damage − total defence)** — armour never makes damage negative and never grants invulnerability. Failed purchases (not enough gold, already owned) change nothing, and equipping/unequipping never double-applies a bonus.
- **Progression loop:** explore → discover → NPC → quest → fight → reward → upgrade → harder regions, with XP/levelling, gold/loot, healing and resource management, and tougher enemies in dangerous regions.
- **Map:** fog-of-war minimap covering the whole world (biome colours, roads, settlements, player position + heading, quest/landmark markers, unexplored areas dark) plus a larger world-map screen (**M** key or 🗺️ button). Discovered landmarks are saved.
- **Save system (localStorage only, no backend, no account, no cloud saves):** character appearance, progression, currency, inventory + equipped items, quest progress, opened chests, discovered regions/landmarks and world state. Manual save from the pause menu, validated load with defaults for missing/corrupt/outdated saves, and a clearly labelled Reset Save with confirmation. A new game asks for confirmation if a save exists.
- **Mobile:** virtual joystick, dedicated attack/interact/potion buttons, large touch targets in inventory/quest/shop/map, no hover dependence, scrolling/gestures suppressed during play, and tab-blur auto-pauses the game.
- **UI compatibility (all screens, all sizes):** title, character creation, intro, HUD, dialogue, shop/forge, quest journal, inventory, world map, pause, death, ending and credits were audited for small mobile (~360px), tablet (~768px) and desktop (~1280px), portrait and short landscape: buttons are at least ~44px tall, dialogue and shop/quest/inventory lists scroll inside their panels, the minimap shrinks on small screens so it does not cover HUD buttons, and no control depends on hover. Automated checks cover the responsive rules, touch buttons and scrollable panels; 3D rendering is verified via a THREE stub in tests, not in a real browser with real WebGL, and the game has not been tested on a physical device.
- **Adult Story Mode (optional, 21+ only, off by default):** turn it on from the title or pause menu. Enabling opens an age gate: enter a birth year showing you are 21 or older and explicitly confirm “I am 21 or older”. Under-21 stays locked and no adult dialogue is accessible. Only a yes/no flag is saved — a birth year is never stored. Content warning on enable: mature themes (romance, alcohol in the tavern, violence, moral choices). Two romanceable adult NPCs — Elara, 27, innkeeper of Ember Village, and Kael, 29, caravan guard of Moonhaven — with progression from meeting to flirting to dates (tavern, Fern Lake, Moonlit Lake) to partnership, plus a mature side quest, *The Tavern Dilemma*. Romance is adult-to-adult and consensual only, can be declined or ended at any time, and intimate moments are suggestive dialogue with a fade-to-black only. Adult dialogue is completely hidden while the mode is off, and the main story (3 shards → Malachar → ending → credits) works the same with the mode on or off. There are no child characters in this game.
- **Audio/visual polish:** WebAudio sound effects (combat, pickup, quest, purchase, discovery, chest) plus a soft ambient soundscape, day/night lighting cycle, swaying foliage, flickering village fire, smooth menu states, and a sound toggle (autoplay-safe: audio starts on your first in-game action).

## Controls

| Action | Keyboard / Mouse | Mobile |
|---|---|---|
| Move | WASD / Arrow keys | Virtual joystick |
| Attack | Space, J, or mouse click | ⚔️ button |
| Interact | E | 💬 button |
| Drink health potion | H | 🧪 button |
| Mega potion | 💊 button | 💊 button |
| Quest journal | Q | 📜 Quests button |
| Inventory | I | 🎒 Inventory button |
| World map | M | 🗺️ Map button |
| Pause | Esc / P | ⏸ Pause button |

## How to Run Locally

```bash
git clone https://github.com/armansoor/emberfall-3d.git
cd emberfall-3d
python3 -m http.server 8000
# open http://localhost:8000 in your browser
```

(An internet connection is needed for the Three.js CDN script; everything else is local.)

## Tests

A scripted end-to-end playthrough suite (Node + jsdom + a THREE stub, so no WebGL is needed) covers the whole flow: all 3 classes, shop success/failure, shard guards, boss, ending, credits, save/load, death/respawn, pause, touch controls — plus the 3D scene, expanded world, new NPCs, new quests, chests, blacksmith/armour formula, new enemy behaviours, fog of war, world map and inventory — plus the expansion: Moonlit Vale, the 21+ age gate (blocks under-21 and unconfirmed, allows 21+), adult dialogue hidden when off, romance progression and fade-to-black, the Tavern Dilemma quest, adult-flag save/load persistence (missing/corrupt defaults to off), and responsive-UI rules.

```bash
npm install --prefix /tmp/ef-test jsdom   # once
node tests/e2e.js   # 152 checks (111 baseline + 41 new: Vale expansion, age gate, romance, adult quest, save persistence, responsive UI)
```

## Project Layout

```
index.html      — all screens (title, creation, HUD, shop, quests, inventory, world map, pause, death, ending, credits)
css/style.css   — styling, responsive + mobile layout, credits roll, damage numbers
js/audio.js     — WebAudio sound effects + ambient soundscape (no audio files)
js/world.js     — world data: biomes, regions, roads, landmarks, props/collision, NPCs, shards, chests, herb/fish/clue spots, enemy & shop tables
js/game.js      — 3D engine: Three.js scene, camera, movement, combat, quests, shop/inventory, save/load, rendering, minimap/world map, input
tests/e2e.js    — scripted end-to-end playthrough tests
.github/workflows/deploy-pages.yml — push to main = auto-deploy to GitHub Pages
```

## Also Try

- **Emberfall 2D (the original): https://armansoor.github.io/emberfall-open-world/**
