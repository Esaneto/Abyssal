'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const WorldSimulation=require('../world-simulation');

test('classic Online is released and defaults to the Solo-equivalent room',()=>{
 const gate=read('public/abyssal-feature-gates.js');
 const online=read('public/online.js');
 const menu=read('public/abyssal-menu-ocean.js');
 const server=read('server.js');
 assert.match(gate,/const LOCKED=new Set\(\['sea','rift'\]\)/);
 assert.doesNotMatch(gate,/['"]online['"]\s*\]/);
 assert.match(online,/MERGULHO-ONLINE/);
 assert.match(online,/AbyssalPreferredRoomMode='coop'/);
 assert.match(menu,/AbyssalPreferredRoomMode='coop'/);
 assert.match(server,/CLASSIC_ROOM_ID = 'MERGULHO-ONLINE'/);
 assert.match(server,/name:'Mergulho Online'.*mode:'coop'/);
});

test('Online submarine matches Solo hull but repairs in exactly 15 seconds',()=>{
 const world=WorldSimulation.createWorldState(Date.now(),'classic');
 assert.equal(WorldSimulation.ONLINE_SUBMARINE_SECTION_HP,1000);
 assert.equal(WorldSimulation.ONLINE_SUBMARINE_REPAIR_SECONDS,15);
 assert.equal(world.submarine.sections.length,3);
 assert.deepEqual(world.submarine.sections.map(s=>s.hp),[1000,1000,1000]);
 const game=read('public/game.js');
 const server=read('server.js');
 assert.match(game,/ONLINE_HULL_REPAIR_SECONDS=15/);
 assert.match(server,/ONLINE_SUBMARINE_REPAIR_SECONDS\*1000/);
 assert.match(server,/submarine-repair/);
});

test('classic Online uses Solo cavern geometry and Solo enemy cap',()=>{
 const game=read('public/game.js');
 const world=read('world-simulation.js');
 assert.match(game,/isClassicShooterRun\(\)&&onlineRoomMode!=='pvp'&&SOLO_CAVERN/);
 assert.match(world,/const CLASSIC_ENEMY_CAP=50/);
 assert.match(world,/const CLASSIC_COMMON_CAP=49/);
 assert.match(world,/SoloCavern\.buildRocks/);
 assert.match(world,/SoloCavern\.navigationTarget/);
 assert.match(world,/SoloCavern\.resolve/);
});

test('energized Online submarine is an authoritative enemy-priority target',()=>{
 const world=read('world-simulation.js');
 const server=read('server.js');
 assert.match(world,/poweredSubmarine=world\.mode==='classic'/);
 assert.match(world,/actualTarget=\{x:Number\(section\.x\).*submarine:true,section\}/);
 assert.match(world,/section\.hp=Math\.max/);
 assert.match(world,/classicHullContact\(world,enemy,now\)/);
 assert.match(server,/submarine-power/);
 assert.match(server,/powerSeconds/);
});

test('submarine weapon damage has a single Online controller and shared loadout',()=>{
 const game=read('public/game.js');
 const server=read('server.js');
 assert.match(server,/controllerId:\[\.\.\.room\.players\.keys\(\)\]\[0\]/);
 assert.match(server,/submarineWeapons/);
 assert.match(game,/onlineSubmarineControllerId/);
 assert.match(game,/options\.submarineShot&&window\.AbyssalOnline\?\.getSocketId\?\.\(\)!==onlineSubmarineControllerId/);
 assert.match(server,/submarine-section-destroyed/);
 assert.match(game,/onlineSubmarineWeapons/);
});

test('authoritative cavern hull opens only the destroyed section',()=>{
 const w=WorldSimulation.createWorldState(Date.now(),'classic');
 const before=WorldSimulation.classicCavernRocks(w);
 assert.equal(before.filter(r=>r.submarineHull).length,3);
 w.submarine.sections[0].hp=0;
 const after=WorldSimulation.classicCavernRocks(w);
 assert.deepEqual(after.filter(r=>r.submarineHull).map(r=>r.sectionId),[1,2]);
 assert.deepEqual(after.filter(r=>!r.submarineHull),before.filter(r=>!r.submarineHull));
});
