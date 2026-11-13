'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const g=fs.readFileSync('public/game.js','utf8');
const code=g.slice(g.indexOf('function weaponAngleDelta'),g.indexOf('function setWeaponHeading'));
const {weaponAngleDelta,smoothWeaponAngle,weaponAligned}=new Function(code+';return {weaponAngleDelta,smoothWeaponAngle,weaponAligned};')();
test('weapon rotates along shortest arc and converges without snapping',()=>{const a=Math.PI-.1,b=-Math.PI+.1;assert.ok(Math.abs(weaponAngleDelta(a,b)-.2)<1e-8);let x=a;for(let i=0;i<12;i++)x=smoothWeaponAngle(x,b,1/60,32);assert.ok(weaponAligned(x,b));assert.ok(Math.abs(weaponAngleDelta(a,smoothWeaponAngle(a,b,1/60,32)))<.2);});
test('automatic firing waits for alignment and cursor controls only weapon',()=>{assert.match(g,/if\(!aimedMode&&!weaponAligned/);assert.match(g,/if\(fire\(\)\)player.fireTimer/);assert.match(g,/tracking\?aimAtEnemy\(target\):cursorAvailable\?controlAimAngle/);assert.match(g,/drawDiver\(player.x,player.y,player.r,player.bodyAngle/);});
