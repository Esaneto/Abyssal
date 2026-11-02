'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const EnemyAI = require('../public/enemy-ai.js');

test('EnemyAI: whiteShark e whiteSharkBoss existem nas estatísticas e não dão hitkill no jogador', () => {
  const ws = EnemyAI.statsForKind('whiteShark');
  const wsb = EnemyAI.statsForKind('whiteSharkBoss');

  assert.ok(ws, 'Tubarão branco deve existir');
  assert.equal(ws.hp, 300, 'Tubarão branco deve ter 300 de vida');
  assert.ok(ws.damage < 100, 'Dano do tubarão branco não pode matar jogador de vida cheia (100 HP)');

  assert.ok(wsb, 'Boss Tubarão branco deve existir');
  assert.equal(wsb.hp, 6000, 'Boss Tubarão branco deve ter 6000 de vida');
  assert.ok(wsb.damage < 100, 'Dano do Boss Tubarão branco não pode matar jogador de vida cheia (100 HP)');
  assert.ok(EnemyAI.BOSS_KINDS.includes('whiteSharkBoss'), 'whiteSharkBoss deve estar listado em BOSS_KINDS');
});

test('EnemyAI: chooseBossesForSession escalona e ordena corretamente por HP', () => {
  // 1-2 jogadores -> 1 boss
  const b1 = EnemyAI.chooseBossesForSession(1);
  const b2 = EnemyAI.chooseBossesForSession(2);
  assert.equal(b1.length, 1, '1 jogador deve invocar 1 boss');
  assert.equal(b2.length, 1, '2 jogadores devem invocar 1 boss');

  // 3-4 jogadores -> 2 bosses
  const b3 = EnemyAI.chooseBossesForSession(3);
  const b4 = EnemyAI.chooseBossesForSession(4);
  assert.equal(b3.length, 2, '3 jogadores devem invocar 2 bosses');
  assert.equal(b4.length, 2, '4 jogadores devem invocar 2 bosses');

  // 5-6 jogadores -> 3 bosses
  const b5 = EnemyAI.chooseBossesForSession(5);
  const b6 = EnemyAI.chooseBossesForSession(6);
  assert.equal(b5.length, 3, '5 jogadores devem invocar 3 bosses');
  assert.equal(b6.length, 3, '6 jogadores devem invocar 3 bosses');

  // Conferir ordenação por HP crescente
  for (let i = 0; i < b6.length - 1; i++) {
    const hpA = EnemyAI.statsForKind(b6[i]).hp;
    const hpB = EnemyAI.statsForKind(b6[i + 1]).hp;
    assert.ok(hpA <= hpB, `Bosses devem estar ordenados por HP: ${b6[i]} (${hpA}) <= ${b6[i+1]} (${hpB})`);
  }
});

