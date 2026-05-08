const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('createRoom', ({ name, skin }) => {
    const code = generateCode();
    rooms[code] = {
      code,
      players: {},
      gameState: null,
    };
    socket.join(code);
    rooms[code].players[socket.id] = { id: socket.id, name, skin, x: 400, y: 300, hp: 100, maxHp: 100, ready: false };
    socket.emit('roomCreated', code);
    socket.emit('roomUpdate', rooms[code]);
    console.log(`Room ${code} created by ${name}`);
  });

  socket.on('joinRoom', ({ code, name, skin }) => {
    const room = rooms[code];
    if (!room) return socket.emit('error', 'Комната не найдена');
    if (Object.keys(room.players).length >= 4) return socket.emit('error', 'Комната полна (макс 4)');
    socket.join(code);
    room.players[socket.id] = { id: socket.id, name, skin, x: 400, y: 300, hp: 100, maxHp: 100, ready: false };
    io.to(code).emit('roomUpdate', room);
    console.log(`${name} joined room ${code}`);
  });

  socket.on('toggleReady', ({ code }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].ready = !room.players[socket.id].ready;
    io.to(code).emit('roomUpdate', room);

    const allReady = Object.values(room.players).every(p => p.ready);
    if (allReady && Object.keys(room.players).length >= 1) {
      io.to(code).emit('gameStart');
    }
  });

  socket.on('startGame', ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    room.gameState = {
      world: generateWorld(),
      enemies: [],
      bosses: [],
      droppedItems: [],
      plants: {},
      time: 0,
    };
    const spawn = { x: 200, y: 200 };
    Object.keys(room.players).forEach(id => {
      room.players[id].x = spawn.x + Math.random() * 100;
      room.players[id].y = spawn.y + Math.random() * 100;
      room.players[id].inventory = [];
      room.players[id].orbs = 3;
      room.players[id].plants = [];
      room.players[id].equipment = { weapon: null, armor: null, accessory: null };
      room.players[id].ingredients = { radiation_berry: 2, mutant_root: 1, slime: 0 };
    });
    spawnBoss(room);
    io.to(code).emit('gameStart', room.gameState);
    io.to(code).emit('roomUpdate', room);
  });

  socket.on('playerMove', ({ code, x, y, dir }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    room.players[socket.id].x = x;
    room.players[socket.id].y = y;
    room.players[socket.id].dir = dir;
    socket.to(code).emit('playerMoved', { id: socket.id, x, y, dir });
  });

  socket.on('attack', ({ code, tx, ty }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    socket.to(code).emit('playerAttacked', { id: socket.id, x: p.x, y: p.y, tx, ty });
    const enemies = room.gameState?.enemies || [];
    const bosses = room.gameState?.bosses || [];
    for (let e of enemies) {
      const dx = e.x - tx, dy = e.y - ty;
      if (dx * dx + dy * dy < 1600) {
        e.hp -= 15;
        io.to(code).emit('enemyHit', { id: e.id, hp: e.hp });
      }
    }
    for (let b of bosses) {
      const dx = b.x - tx, dy = b.y - ty;
      if (dx * dx + dy * dy < 2500) {
        b.hp -= 10;
        io.to(code).emit('bossHit', { id: b.id, hp: b.hp });
      }
    }
  });

  socket.on('openOrb', ({ code }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    if (!p.orbs || p.orbs < 1) return;
    p.orbs--;
    const rarities = ['common', 'common', 'common', 'rare', 'rare', 'epic'];
    const rarity = rarities[Math.floor(Math.random() * rarities.length)];
    const plants = {
      common: [
        { name: 'Радиационный плющ', ability: 'radiation_wave', color: '#4f4', desc: 'Испускает радиационную волну' },
        { name: 'Шипастый кактус', ability: 'spike_shot', color: '#4a4', desc: 'Стреляет шипами' },
        { name: 'Мутировавший мох', ability: 'heal_aura', color: '#4a8', desc: 'Медленно лечит игрока' },
      ],
      rare: [
        { name: 'Огненный цветок', ability: 'fire_blast', color: '#f44', desc: 'Взрыв огня вокруг' },
        { name: 'Ядовитый гриб', ability: 'poison_cloud', color: '#f4f', desc: 'Облако яда' },
      ],
      epic: [
        { name: 'Электрическая лоза', ability: 'chain_lightning', color: '#ff4', desc: 'Цепная молния' },
        { name: 'Кристальный кактус', ability: 'crystal_shield', color: '#4ff', desc: 'Создаёт щит' },
      ],
    };
    const pool = plants[rarity];
    const plant = pool[Math.floor(Math.random() * pool.length)];
    plant.rarity = rarity;
    plant.hp = rarity === 'common' ? 30 : rarity === 'rare' ? 50 : 80;
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
    const enemies = room.gameState?.enemies || [];
    const bosses = room.gameState?.bosses || [];
    if (targetType === 'enemy') {
      const e = enemies.find(en => en.id === targetId);
      if (e) {
        const dmg = 10 + plant.level * 2;
        e.hp -= dmg;
        if (e.hp <= 0) {
          p.orbs = (p.orbs || 0) + 1;
          p.ingredients.slime = (p.ingredients.slime || 0) + 1;
          socket.emit('enemyDefeated', { id: targetId, orbs: 1, slime: 1 });
        }
        io.to(code).emit('enemyHit', { id: targetId, hp: e.hp });
      }
    } else if (targetType === 'boss') {
      const b = bosses.find(bo => bo.id === targetId);
      if (b) {
        const dmg = 8 + plant.level * 2;
        b.hp -= dmg;
        if (b.hp <= 0) {
          p.orbs = (p.orbs || 0) + 3;
          p.ingredients.radiation_berry = (p.ingredients.radiation_berry || 0) + 2;
          socket.emit('bossDefeated', { id: targetId, orbs: 3, berries: 2 });
          setTimeout(() => spawnBoss(room), 10000);
          io.to(code).emit('bossDefeated', { id: targetId });
        }
        io.to(code).emit('bossHit', { id: targetId, hp: b.hp });
      }
    }
    plant.exp += 10;
    if (plant.exp >= plant.level * 30) {
      plant.level++;
      plant.exp = 0;
      socket.emit('plantLevelUp', { idx: plantIdx, level: plant.level });
    }
    io.to(code).emit('roomUpdate', room);
  });

  socket.on('updateState', ({ code, state }) => {
    const room = rooms[code];
    if (!room) return;
    if (state) Object.assign(room.gameState || {}, state);
    socket.to(code).emit('stateUpdate', { id: socket.id, state });
  });

  socket.on('craft', ({ code, recipe }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    const recipes = {
      health_potion: { ingredients: { radiation_berry: 2 }, result: { name: 'Зелье здоровья', heal: 40 } },
      armor_scrap: { ingredients: { mutant_root: 2, slime: 1 }, result: { name: 'Броня из хлама', def: 10 } },
      weapon_spike: { ingredients: { mutant_root: 1, slime: 2 }, result: { name: 'Шипастая дубина', dmg: 20 } },
    };
    const r = recipes[recipe];
    if (!r) return;
    for (const [ing, qty] of Object.entries(r.ingredients)) {
      if (!p.ingredients[ing] || p.ingredients[ing] < qty) return socket.emit('error', 'Не хватает ингредиентов');
    }
    for (const [ing, qty] of Object.entries(r.ingredients)) {
      p.ingredients[ing] -= qty;
    }
    if (recipe === 'health_potion') {
      p.hp = Math.min(p.maxHp, p.hp + 40);
      socket.emit('stateUpdate', { hp: p.hp });
    } else if (recipe === 'armor_scrap') {
      p.equipment.armor = r.result;
    } else if (recipe === 'weapon_spike') {
      p.equipment.weapon = r.result;
    }
    socket.emit('craftSuccess', { recipe, result: r.result });
    io.to(code).emit('roomUpdate', room);
  });

  socket.on('collectResource', ({ code, type }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const p = room.players[socket.id];
    if (!p.ingredients) p.ingredients = {};
    p.ingredients[type] = (p.ingredients[type] || 0) + 1;
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
      p.hp = p.maxHp / 2;
      p.x = 200 + Math.random() * 100;
      p.y = 200 + Math.random() * 100;
      socket.emit('stateUpdate', { hp: p.hp, x: p.x, y: p.y });
      io.to(code).emit('playerRespawned', { id: socket.id, x: p.x, y: p.y });
    }
  });

  socket.on('disconnect', () => {
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(code).emit('roomUpdate', room);
        io.to(code).emit('playerLeft', socket.id);
        if (Object.keys(room.players).length === 0) {
          delete rooms[code];
        }
      }
    }
    console.log('Player disconnected:', socket.id);
  });
});

function generateWorld() {
  return {
    width: 1600,
    height: 1200,
    resources: [
      { x: 500, y: 400, type: 'radiation_berry', color: '#4f4', respawn: 0 },
      { x: 700, y: 600, type: 'mutant_root', color: '#a4f', respawn: 0 },
      { x: 300, y: 800, type: 'radiation_berry', color: '#4f4', respawn: 0 },
      { x: 900, y: 300, type: 'mutant_root', color: '#a4f', respawn: 0 },
      { x: 1100, y: 700, type: 'radiation_berry', color: '#4f4', respawn: 0 },
      { x: 200, y: 1000, type: 'mutant_root', color: '#a4f', respawn: 0 },
      { x: 1300, y: 500, type: 'radiation_berry', color: '#4f4', respawn: 0 },
    ],
    obstacles: [
      { x: 300, y: 200, w: 60, h: 60 },
      { x: 600, y: 300, w: 80, h: 40 },
      { x: 400, y: 700, w: 50, h: 80 },
      { x: 800, y: 500, w: 70, h: 70 },
      { x: 1000, y: 200, w: 60, h: 60 },
      { x: 200, y: 600, w: 80, h: 50 },
      { x: 1200, y: 800, w: 50, h: 50 },
    ],
  };
}

function spawnBoss(room) {
  if (!room.gameState) return;
  const bosses = [
    { name: 'Мутировавший медведь', color: '#a55', hp: 300, maxHp: 300, dmg: 15, speed: 1.5, size: 40 },
    { name: 'Радиационный червь', color: '#5a5', hp: 400, maxHp: 400, dmg: 20, speed: 1, size: 50 },
    { name: 'Корень-убийца', color: '#55a', hp: 500, maxHp: 500, dmg: 12, speed: 2, size: 35 },
  ];
  const boss = bosses[Math.floor(Math.random() * bosses.length)];
  boss.id = 'boss_' + Date.now();
  boss.x = 800 + Math.random() * 600;
  boss.y = 600 + Math.random() * 400;
  room.gameState.bosses.push(boss);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
