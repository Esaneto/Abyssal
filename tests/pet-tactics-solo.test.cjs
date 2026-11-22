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

test('Aggressive keeps its engaged enemy across small distance changes instead of indecision',()=>{
 const a={id:'a',...enemy(70,0)},b={id:'b',...enemy(65,5)},orb={id:'o',x:42,y:0};
 const target=ai.choose({mode:'aggressive',pet,player,enemies:[a,b],orbs:[orb],collectionRange:300,attackRange:180,preferredEnemyId:'a',preferredType:'enemy'});
 assert.equal(target.type,'enemy');assert.equal(target.enemy.id,'a');
});
test('Guardian retains the protected threat until it actually leaves the defense envelope',()=>{
 const a={id:'guarded',...enemy(220,0)},b={id:'new',...enemy(210,10)};
 const target=ai.choose({mode:'guardian',pet,player,enemies:[a,b],guardRange:240,preferredEnemyId:'guarded',preferredType:'enemy'});
 assert.equal(target.type,'enemy');assert.equal(target.enemy.id,'guarded');
});
test('Passive ignores preferred enemy state and never attacks',()=>{
 const e={id:'old',...enemy(15,0)};
 assert.notEqual(ai.choose({mode:'passive',pet,player,enemies:[e],preferredEnemyId:'old',preferredType:'enemy'}).type,'enemy');
});

test('Guardian chooses the nearest threat to the diver even when another enemy blocks the route',()=>{
 const front={id:'front',x:90,y:0,r:14,hp:100},rear={id:'rear',x:175,y:0,r:14,hp:100};
 const c=ai.choose({mode:'guardian',pet:{x:0,y:0},player:{x:175,y:0},enemies:[front,rear],guardRange:255});
 assert.equal(c.type,'enemy');assert.equal(c.enemy.id,'rear'); // The defender acquires the nearest threat to the diver.
 assert.equal(ai.choose({mode:'passive',pet:{x:0,y:0},player:{x:175,y:0},enemies:[front,rear]}).type,'follow');
});
test('Shark attack position is inside reliable mouth contact and allows stable combat',()=>{
 const enemy={id:1,x:100,y:0,r:15,kind:'drifter',hp:100},profile=ai.attackProfile('reefshark','shark',41);
 const goal=ai.attackGoal({x:0,y:0},enemy,profile),at={x:goal.x,y:goal.y};
 assert.equal(ai.attackContact(at,enemy,profile,0,0),true);
 assert.equal(ai.attackStance(at,enemy,profile),true);
 assert.equal(ai.attackStance({x:0,y:0},enemy,profile),false);
});

test('Eco bites a target overlapping its frontal body without having to back away first',()=>{
 const shark=ai.attackProfile('reefshark','shark',41),pet={x:0,y:0};
 const close={id:'close',x:10,y:0,r:15,kind:'drifter',hp:100};
 const behind={...close,x:-70};
 assert.equal(ai.attackContact(pet,close,shark,0,0),true,'immediate frontal contact is a hit');
 assert.equal(ai.attackContact(pet,behind,shark,0,0),false,'rear target cannot be bitten facing forward');
});
