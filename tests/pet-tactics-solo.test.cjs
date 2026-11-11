const test=require('node:test'),assert=require('node:assert/strict');
const ai=require('../public/abyssal-pet-tactics.js');
const pet={x:0,y:0},player={x:20,y:0};
const enemy=(x,y)=>({x,y,hp:100,r:12});
test('Passive selects safe collectible XP and never attacks',()=>{
 const target=ai.choose({mode:'passive',pet,player,enemies:[enemy(20,55)],orbs:[{x:20,y:55},{x:-45,y:0}],collectionRange:120});
 assert.equal(target.type,'orb');assert.equal(target.orb.x,-45);
});
test('Aggressive attacks nearest threat rather than distant orb',()=>{
 const target=ai.choose({mode:'aggressive',pet,player,enemies:[enemy(60,0),enemy(95,0)],orbs:[{x:130,y:0}],collectionRange:300});
 assert.equal(target.type,'enemy');assert.equal(target.enemy.x,60);
});
test('Aggressive collects XP when no nearby hostile is closer',()=>{
 const target=ai.choose({mode:'aggressive',pet,player,enemies:[enemy(260,0)],orbs:[{x:25,y:20}],collectionRange:300});
 assert.equal(target.type,'orb');
});
test('Guardian attacks enemies near player, not unrelated distant enemies',()=>{
 const target=ai.choose({mode:'guardian',pet,player,enemies:[enemy(205,0),enemy(600,0)],orbs:[{x:35,y:30}],collectionRange:300,guardRange:240});
 assert.equal(target.type,'enemy');assert.equal(target.enemy.x,205);
});
test('Guardian collects when threats are outside defense radius',()=>{
 const target=ai.choose({mode:'guardian',pet,player,enemies:[enemy(450,0)],orbs:[{x:35,y:30}],collectionRange:300,guardRange:240});
 assert.equal(target.type,'orb');
});
test('Invalid modes fall back to passive behavior',()=>{
 assert.equal(ai.normalize('cheat'),'passive');
 assert.equal(ai.choose({mode:'cheat',pet,player,enemies:[enemy(25,0)]}).type,'follow');
});
