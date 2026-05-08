const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const ENEMY_TYPES = [
  { name: 'Крыса-мутант', color: '#a88', hp: 40, dmg: 5, speed: 2, size: 12, exp: 10, drops: { slime: 1 } },
  { name: 'Радио-таракан', color: '#8a4', hp: 25, dmg: 3, speed: 3, size: 8, exp: 5, drops: { slime: 1 } },
  { name: 'Зомби-фермер', color: '#6a6', hp: 80, dmg: 10, speed: 1, size: 20, exp: 20, drops: { radiation_berry: 1 } },
  { name: 'Плюющаяся акация', color: '#4a4', hp: 60, dmg: 8, speed: 0, size: 16, exp: 15, drops: { mutant_root: 1 } },
  { name: 'Мутировавший пёс', color: '#a64', hp: 100, dmg: 12, speed: 2.5, size: 22, exp: 25, drops: { slime: 2 } },
  { name: 'Радиационный слизень', color: '#4f4', hp: 50, dmg: 6, speed: 0.8, size: 18, exp: 12, drops: { slime: 2 } },
  { name: 'Ядовитый цветок', color: '#f4f', hp: 35, dmg: 15, speed: 0, size: 14, exp: 18, drops: { mutant_root: 2 } },
  { name: 'Мутант-охотник', color: '#a44', hp: 150, dmg: 18, speed: 1.8, size: 26, exp: 35, drops: { radiation_berry: 2, slime: 1 } },
];

const BOSS_TYPES = [
  { name: 'Мутировавший медведь', color: '#a55', hp: 500, dmg: 20, speed: 1.5, size: 44, exp: 100, drops: { radiation_berry: 5, mutant_root: 3, slime: 5 } },
  { name: 'Радиационный червь', color: '#5a5', hp: 700, dmg: 25, speed: 1, size: 54, exp: 150, drops: { radiation_berry: 8, slime: 8 } },
  { name: 'Корень-убийца', color: '#55a', hp: 400, dmg: 18, speed: 2.2, size: 38, exp: 120, drops: { mutant_root: 8, slime: 3 } },
  { name: 'Королева муравьёв', color: '#a4a', hp: 1000, dmg: 15, speed: 0.8, size: 60, exp: 200, drops: { radiation_berry: 10, mutant_root: 10, slime: 10 } },
  { name: 'Троглодит-гигант', color: '#a84', hp: 800, dmg: 30, speed: 1.2, size: 50, exp: 180, drops: { radiation_berry: 6, mutant_root: 6, slime: 6 } },
];

const PLANTS_DATA = [
  { name: 'Радиационный плющ', ability: 'radiation_wave', color: '#4f4', desc: 'Испускает волну радиации', rarity: 'common', dmg: 8 },
  { name: 'Шипастый кактус', ability: 'spike_shot', color: '#a4a', desc: 'Стреляет шипами', rarity: 'common', dmg: 10 },
  { name: 'Мутировавший мох', ability: 'heal_aura', color: '#4a8', desc: 'Лечит игрока', rarity: 'common', dmg: 0 },
  { name: 'Светящийся гриб', ability: 'light', color: '#ff8', desc: 'Освещает путь', rarity: 'common', dmg: 5 },
  { name: 'Колючая лоза', ability: 'thorn_whip', color: '#8a4', desc: 'Хлестает врагов', rarity: 'common', dmg: 12 },
  { name: 'Мухомор-бомба', ability: 'spore_explosion', color: '#f44', desc: 'Взрывается спорами', rarity: 'rare', dmg: 20 },
  { name: 'Огненный цветок', ability: 'fire_blast', color: '#f84', desc: 'Огненный взрыв', rarity: 'rare', dmg: 25 },
  { name: 'Ядовитый гриб', ability: 'poison_cloud', color: '#f4f', desc: 'Ядовитое облако', rarity: 'rare', dmg: 18 },
  { name: 'Ледяной папоротник', ability: 'freeze', color: '#4ff', desc: 'Замораживает врагов', rarity: 'rare', dmg: 15 },
  { name: 'Железное дерево', ability: 'shield', color: '#a84', desc: 'Защищает игрока', rarity: 'rare', dmg: 5 },
  { name: 'Электрическая лоза', ability: 'chain_lightning', color: '#ff4', desc: 'Цепная молния', rarity: 'epic', dmg: 35 },
  { name: 'Кристальный кактус', ability: 'crystal_shield', color: '#4ff', desc: 'Хрустальный щит', rarity: 'epic', dmg: 10 },
  { name: 'Адская роза', ability: 'hellfire', color: '#f00', desc: 'Адский огонь', rarity: 'epic', dmg: 40 },
  { name: 'Космический гриб', ability: 'void_blast', color: '#a0f', desc: 'Удар пустотой', rarity: 'epic', dmg: 45 },
];

const RECIPES = {
  health_potion: { ingredients: { radiation_berry: 2 }, result: { name: '💚 Зелье здоровья', type: 'consumable', heal: 50 } },
  big_health_potion: { ingredients: { radiation_berry: 3, mutant_root: 1 }, result: { name: '💚 Большое зелье', type: 'consumable', heal: 100 } },
  armor_scrap: { ingredients: { mutant_root: 2, slime: 1 }, result: { name: '🛡️ Броня из хлама', type: 'armor', def: 15 } },
  armor_metal: { ingredients: { mutant_root: 4, slime: 3 }, result: { name: '🛡️ Металл-броня', type: 'armor', def: 30 } },
  weapon_spike: { ingredients: { mutant_root: 1, slime: 2 }, result: { name: '🗡️ Шипастая дубина', type: 'weapon', dmg: 25 } },
  weapon_sword: { ingredients: { mutant_root: 3, slime: 4 }, result: { name: '🗡️ Радиационный меч', type: 'weapon', dmg: 45 } },
  weapon_bow: { ingredients: { mutant_root: 2, slime: 2, radiation_berry: 1 }, result: { name: '🏹 Мутант-лук', type: 'weapon', dmg: 35 } },
  accessory_ring: { ingredients: { radiation_berry: 3, mutant_root: 3, slime: 3 }, result: { name: '💍 Кольцо выжившего', type: 'accessory', hp: 50 } },
  orb_potion: { ingredients: { radiation_berry: 5, slime: 5 }, result: { name: '🔮 Зелье орба', type: 'consumable', orbs: 1 } },
  bomb: { ingredients: { radiation_berry: 2, slime: 3 }, result: { name: '💣 Радиационная бомба', type: 'consumable', dmg: 60 } },
};

const WORLD_RESOURCES = [
  { x: 500, y: 400, type: 'radiation_berry', color: '#4f4' },
  { x: 700, y: 600, type: 'mutant_root', color: '#a4f' },
  { x: 300, y: 800, type: 'radiation_berry', color: '#4f4' },
  { x: 900, y: 300, type: 'mutant_root', color: '#a4f' },
  { x: 1100, y: 700, type: 'radiation_berry', color: '#4f4' },
  { x: 200, y: 1000, type: 'mutant_root', color: '#a4f' },
  { x: 1300, y: 500, type: 'radiation_berry', color: '#4f4' },
  { x: 400, y: 200, type: 'radiation_berry', color: '#4f4' },
  { x: 1000, y: 900, type: 'mutant_root', color: '#a4f' },
  { x: 600, y: 1100, type: 'radiation_berry', color: '#4f4' },
  { x: 1400, y: 300, type: 'mutant_root', color: '#a4f' },
  { x: 1500, y: 800, type: 'radiation_berry', color: '#4f4' },
];

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  let playerRoom = null;

  socket.on('createRoom', ({ name, skin }) => {
    const code = generateCode();
    rooms[code] = {
      code, players: {}, gameState: null, enemyTimer: null, bossTimer: null,
    };
    socket.join(code);
    playerRoom = code;
    const p = createPlayer(name, skin);
    p.id = socket.id;
    rooms[code].players[socket.id] = p;
    socket.emit('roomCreated', code);
    socket.emit('roomUpdate', rooms[code]);
  });

  socket.on('joinRoom', ({ code, name, skin }) => {
    const room = rooms[code];
    if (!room) return socket.emit('error', 'Комната не найдена');
    if (Object.keys(room.players).length >= 6) return socket.emit('error', 'Комната полна (макс 6)');
    socket.join(code);
    playerRoom = code;
    const p2 = createPlayer(name, skin);
    p2.id = socket.id;
    room.players[socket.id] = p2;
    io.to(code).emit('roomUpdate', room);
  });

  socket.on('toggleReady', ({ code }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].ready = !room.players[socket.id].ready;
    io.to(code).emit('roomUpdate', room);
    const allReady = Object.values(room.players).every(p => p.ready);
    if (allReady && Object.keys(room.players).length >= 1) {
      startGame(room, code);
    }
  });

  socket.on('playerMove', ({ code, x, y, dir, inBasement }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].x = x;
    room.players[socket.id].y = y;
    room.players[socket.id].dir = dir;
    room.players[socket.id].inBasement = inBasement;
    socket.to(code).emit('playerMoved', { id: socket.id, x, y, dir, inBasement });
  });

  socket.on('attack', ({ code, tx, ty }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    const baseDmg = 15 + (p.equipment?.weapon?.dmg || 0);
    socket.to(code).emit('playerAttacked', { id: socket.id, x: p.x, y: p.y, tx, ty });
    const enemies = room.gameState?.enemies || [];
    const bosses = room.gameState?.bosses || [];
    for (let e of enemies) {
      const dx = e.x - tx, dy = e.y - ty;
      if (dx * dx + dy * dy < 1600) {
        e.hp -= baseDmg;
        e.target = socket.id;
        io.to(code).emit('enemyHit', { id: e.id, hp: e.hp, dmg: baseDmg });
        if (e.hp <= 0) enemyDefeated(room, code, socket, e);
      }
    }
    for (let b of bosses) {
      const dx = b.x - tx, dy = b.y - ty;
      if (dx * dx + dy * dy < 2500) {
        b.hp -= Math.floor(baseDmg * 0.7);
        b.target = socket.id;
        io.to(code).emit('bossHit', { id: b.id, hp: b.hp, dmg: Math.floor(baseDmg * 0.7) });
        if (b.hp <= 0) bossDefeated(room, code, socket, b);
      }
    }
  });

  socket.on('openOrb', ({ code }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    if (!p.orbs || p.orbs < 1) return;
    p.orbs--;
    const roll = Math.random();
    let rarity, pool;
    if (roll < 0.5) { rarity = 'common'; pool = PLANTS_DATA.filter(pl => pl.rarity === 'common'); }
    else if (roll < 0.8) { rarity = 'rare'; pool = PLANTS_DATA.filter(pl => pl.rarity === 'rare'); }
    else { rarity = 'epic'; pool = PLANTS_DATA.filter(pl => pl.rarity === 'epic'); }
    const plant = JSON.parse(JSON.stringify(pool[Math.floor(Math.random() * pool.length)]));
    plant.hp = rarity === 'common' ? 40 : rarity === 'rare' ? 70 : 120;
    plant.maxHp = plant.hp;
    plant.level = 1;
    plant.exp = 0;
    if (!p.plants) p.plants = [];
    p.plants.push(plant);
    socket.emit('orbResult', { plant, rarity, orbsLeft: p.orbs });
    io.to(code).emit('roomUpdate', room);
  });

  socket.on('plantAttack', ({ code, plantIdx, targetId, targetType }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    if (!p.plants || !p.plants[plantIdx]) return;
    const plant = p.plants[plantIdx];
    const dmg = (plant.dmg || 10) + plant.level * 3;
    const enemies = room.gameState?.enemies || [];
    const bosses = room.gameState?.bosses || [];
    if (targetType === 'enemy') {
      const e = enemies.find(en => en.id === targetId);
      if (e) {
        e.hp -= dmg;
        if (e.hp <= 0) enemyDefeated(room, code, socket, e);
        io.to(code).emit('enemyHit', { id: targetId, hp: e.hp, dmg });
      }
    } else if (targetType === 'boss') {
      const b = bosses.find(bo => bo.id === targetId);
      if (b) {
        b.hp -= Math.floor(dmg * 0.6);
        if (b.hp <= 0) bossDefeated(room, code, socket, b);
        io.to(code).emit('bossHit', { id: targetId, hp: b.hp, dmg: Math.floor(dmg * 0.6) });
      }
    }
    plant.exp += dmg;
    if (plant.exp >= plant.level * 50) {
      plant.level++;
      plant.exp = 0;
      plant.dmg = (plant.dmg || 10) + 5;
      socket.emit('plantLevelUp', { idx: plantIdx, level: plant.level });
    }
    io.to(code).emit('roomUpdate', room);
  });

  socket.on('craft', ({ code, recipe }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    const r = RECIPES[recipe];
    if (!r) return;
    for (const [ing, qty] of Object.entries(r.ingredients)) {
      if (!p.ingredients[ing] || p.ingredients[ing] < qty) return socket.emit('error', 'Не хватает ингредиентов');
    }
    for (const [ing, qty] of Object.entries(r.ingredients)) {
      p.ingredients[ing] -= qty;
    }
    const result = r.result;
    if (result.type === 'consumable') {
      if (result.heal) {
        p.hp = Math.min(p.maxHp, p.hp + result.heal);
        socket.emit('stateUpdate', { hp: p.hp });
      }
      if (result.orbs) {
        p.orbs = (p.orbs || 0) + result.orbs;
        socket.emit('stateUpdate', { orbs: p.orbs });
      }
    } else if (result.type === 'armor') {
      p.equipment.armor = { name: result.name, def: result.def };
    } else if (result.type === 'weapon') {
      p.equipment.weapon = { name: result.name, dmg: result.dmg };
    } else if (result.type === 'accessory') {
      p.equipment.accessory = { name: result.name, hp: result.hp };
      p.maxHp = 100 + (result.hp || 0);
    }
    socket.emit('craftSuccess', { recipe, result });
    io.to(code).emit('roomUpdate', room);
  });

  socket.on('collectResource', ({ code, type }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    if (!p.ingredients) p.ingredients = {};
    p.ingredients[type] = (p.ingredients[type] || 0) + 2;
    socket.emit('stateUpdate', { ingredients: p.ingredients });
    io.to(code).emit('roomUpdate', room);
  });

  socket.on('playerHit', ({ code, dmg }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    const def = p.equipment?.armor?.def || 0;
    const dealt = Math.max(1, dmg - def);
    p.hp = Math.max(0, p.hp - dealt);
    socket.emit('stateUpdate', { hp: p.hp });
    if (p.hp <= 0) {
      p.hp = p.maxHp;
      p.x = 400; p.y = 300;
      p.inBasement = true;
      socket.emit('stateUpdate', { hp: p.hp, x: p.x, y: p.y });
      io.to(code).emit('playerRespawned', { id: socket.id, x: p.x, y: p.y });
      socket.emit('died');
    }
  });

  socket.on('equip', ({ code, item }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    if (item.type === 'armor') p.equipment.armor = item;
    else if (item.type === 'weapon') p.equipment.weapon = item;
    else if (item.type === 'accessory') { p.equipment.accessory = item; p.maxHp = 100 + (item.hp || 0); }
    io.to(code).emit('roomUpdate', room);
  });

  socket.on('chat', ({ code, msg }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    io.to(code).emit('chatMsg', { id: socket.id, name: p.name, msg, skin: p.skin });
  });

  socket.on('disconnect', () => {
    if (playerRoom && rooms[playerRoom]) {
      const room = rooms[playerRoom];
      delete room.players[socket.id];
      io.to(playerRoom).emit('roomUpdate', room);
      io.to(playerRoom).emit('playerLeft', socket.id);
      if (Object.keys(room.players).length === 0) {
        clearInterval(room.enemyTimer);
        clearInterval(room.bossTimer);
        delete rooms[playerRoom];
      }
    }
  });
});

function createPlayer(name, skin) {
  return {
    id: null, name, skin, x: 400, y: 300, dir: 'down',
    hp: 100, maxHp: 100, ready: false, orbs: 3,
    inventory: [], plants: [], inBasement: true,
    equipment: { weapon: null, armor: null, accessory: null },
    ingredients: { radiation_berry: 3, mutant_root: 2, slime: 0 },
    level: 1, exp: 0, kills: 0,
  };
}

function startGame(room, code) {
  room.gameState = {
    world: generateWorld(),
    enemies: [], bosses: [], droppedItems: [], time: 0,
  };
  Object.keys(room.players).forEach(id => {
    const p = room.players[id];
    p.x = 380 + Math.random() * 40;
    p.y = 280 + Math.random() * 40;
    p.inBasement = true;
    p.hp = p.maxHp;
  });
  for (let i = 0; i < 4; i++) spawnEnemy(room);
  spawnBoss(room);
  room.enemyTimer = setInterval(() => {
    if (room.gameState && room.gameState.enemies.length < 8) spawnEnemy(room);
  }, 8000);
  room.bossTimer = setInterval(() => {
    if (room.gameState) spawnBoss(room);
  }, 45000);
  io.to(code).emit('gameStart', room.gameState);
  io.to(code).emit('roomUpdate', room);
}

function spawnEnemy(room) {
  if (!room.gameState) return;
  const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
  const enemy = JSON.parse(JSON.stringify(type));
  enemy.id = 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  enemy.maxHp = enemy.hp;
  enemy.x = 200 + Math.random() * 1200;
  enemy.y = 200 + Math.random() * 800;
  room.gameState.enemies.push(enemy);
  io.to(Object.keys(rooms).find(k => rooms[k] === room)).emit('enemySpawned', enemy);
}

function spawnBoss(room) {
  if (!room.gameState) return;
  const type = BOSS_TYPES[Math.floor(Math.random() * BOSS_TYPES.length)];
  const boss = JSON.parse(JSON.stringify(type));
  boss.id = 'boss_' + Date.now();
  boss.maxHp = boss.hp;
  boss.x = 600 + Math.random() * 800;
  boss.y = 400 + Math.random() * 600;
  room.gameState.bosses.push(boss);
  const code = Object.keys(rooms).find(k => rooms[k] === room);
  io.to(code).emit('bossSpawned', boss);
  io.to(code).emit('chatMsg', { id: 'system', name: '🌍', msg: `⚠️ Босс "${boss.name}" появился в мире!`, skin: -1 });
}

function enemyDefeated(room, code, socket, enemy) {
  const p = room.players[socket.id];
  if (!p) return;
  room.gameState.enemies = room.gameState.enemies.filter(e => e.id !== enemy.id);
  const drops = enemy.drops || { slime: 1 };
  const orbsReward = 1 + Math.floor(Math.random() * 2);
  p.orbs = (p.orbs || 0) + orbsReward;
  p.exp = (p.exp || 0) + (enemy.exp || 10);
  p.kills = (p.kills || 0) + 1;
  for (const [ing, qty] of Object.entries(drops)) {
    p.ingredients[ing] = (p.ingredients[ing] || 0) + qty;
  }
  if (p.exp >= p.level * 50) {
    p.level++;
    p.exp = 0;
    p.maxHp += 10;
    p.hp = Math.min(p.hp + 20, p.maxHp);
    socket.emit('levelUp', { level: p.level });
  }
  socket.emit('enemyDefeated', { id: enemy.id, orbs: orbsReward, drops });
  io.to(code).emit('enemyDied', { id: enemy.id, x: enemy.x, y: enemy.y });
}

function bossDefeated(room, code, socket, boss) {
  const p = room.players[socket.id];
  if (!p) return;
  room.gameState.bosses = room.gameState.bosses.filter(b => b.id !== boss.id);
  const drops = boss.drops || { radiation_berry: 3, mutant_root: 3, slime: 3 };
  const orbsReward = 3 + Math.floor(Math.random() * 3);
  p.orbs = (p.orbs || 0) + orbsReward;
  p.exp = (p.exp || 0) + (boss.exp || 100);
  p.kills = (p.kills || 0) + 1;
  for (const [ing, qty] of Object.entries(drops)) {
    p.ingredients[ing] = (p.ingredients[ing] || 0) + qty;
  }
  if (p.exp >= p.level * 50) {
    p.level++;
    p.exp = 0;
    p.maxHp += 10;
    p.hp = Math.min(p.hp + 20, p.maxHp);
    socket.emit('levelUp', { level: p.level });
  }
  socket.emit('bossDefeated', { id: boss.id, orbs: orbsReward, drops });
  io.to(code).emit('bossDied', { id: boss.id, x: boss.x, y: boss.y, name: boss.name });
  setTimeout(() => spawnBoss(room), 15000);
}

function generateWorld() {
  const obstacles = [];
  for (let i = 0; i < 20; i++) {
    obstacles.push({
      x: 100 + Math.random() * 1400,
      y: 100 + Math.random() * 900,
      w: 30 + Math.random() * 60,
      h: 30 + Math.random() * 60,
    });
  }
  return { width: 1600, height: 1200, resources: WORLD_RESOURCES, obstacles };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server on port ${PORT}`));
