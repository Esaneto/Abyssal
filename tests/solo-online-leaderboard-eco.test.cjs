'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const source=path=>fs.readFileSync(require('node:path').join(ROOT,path),'utf8');
const ai=require('../public/abyssal-pet-tactics.js');
const live=(id,x,y)=>({id,x,y,r:12,hp:100});

test('Passive and Aggressive collect orbs regardless of distance to diver',()=>{
 const pet={x:0,y:0},diver={x:0,y:0};
 for(const mode of ['passive','aggressive']){
  const orb={id:'distant-orb',x:4800,y:2500};
  const choice=ai.choose({mode,pet,player:diver,enemies:[],orbs:[orb],collectionRange:100});
  assert.equal(choice.type,'orb',mode);
  assert.equal(choice.orb.id,'distant-orb');
 }
 const guardian=ai.choose({mode:'guardian',pet,player:diver,enemies:[],orbs:[{id:'distant-orb',x:4800,y:2500}],collectionRange:100});
 assert.equal(guardian.type,'follow','Guardian must preserve its original acquisition distance for orbs');
 const solo=source('public/game.js'),server=source('server.js');
 assert.doesNotMatch(solo,/orbs\.filter\(o=>Math\.hypot\(o\.x-player\.x,o\.y-player\.y\)<=collectionRange\)/);
 assert.doesNotMatch(server,/orbs\|\|\[\]\)\.filter\(o=>Math\.hypot\(o\.x-peer\.x,o\.y-peer\.y\)<=acquisitionRange\)/);
});

test('Guardian chooses closest threat to diver, stays locked even if target exits radius, and changes only on death',()=>{
 const pet={x:0,y:0},diver={x:120,y:0},a=live('initial',180,0),b=live('other',145,0);
 const first=ai.choose({mode:'guardian',pet,player:diver,enemies:[a],orbs:[],guardRange:100});
 assert.equal(first.type,'enemy');assert.equal(first.enemy.id,'initial');
 a.x=670;
 const kept=ai.choose({mode:'guardian',pet,player:diver,enemies:[a,b],orbs:[],guardRange:100,preferredEnemyId:'initial',preferredType:'enemy'});
 assert.equal(kept.enemy.id,'initial');
 a.hp=0;
 const next=ai.choose({mode:'guardian',pet,player:diver,enemies:[a,b],orbs:[],guardRange:100,preferredEnemyId:'initial',preferredType:'enemy'});
 assert.equal(next.enemy.id,'other');
 assert.equal(ai.choose({mode:'guardian',pet,player:diver,enemies:[],orbs:[]}).type,'follow');
 const server=source('server.js'),solo=source('public/game.js');
 assert.match(server,/habit==='guardian'\?true:false/);
 assert.match(server,/String\(e\.id\)===String\(peer\.specimenChoiceEnemyId\)/);
 assert.match(solo,/String\(e\.id\)===String\(s\.tacticalChoice\?\.enemy\?\.id\)/);
});

function boardHarness(legacy={}){
 const server=source('server.js');
 const begin=server.indexOf('function rankedEntries(board)'),end=server.indexOf('function onlineCount()',begin);
 assert.ok(begin>0&&end>begin);
 const body=server.slice(begin,end);
 let rankings=JSON.parse(JSON.stringify(legacy));
 const users={alice:{nickname:'alice',energy:0},bob:{nickname:'bob',energy:0}};
 let persist=0;
 const get=new Function('rankings','users','isDeveloperUser','GMAdmin','dayKey','weekKey','monthKey','saveUsers','saveRanks',
   body+'\nreturn {migrateRankingBoards,settlePeriods,rankedEntries,freshRankingBoard};');
 const funcs=get(rankings,users,()=>false,{blocked:()=>false},()=> 'new-day',()=> 'new-week',()=> 'new-month',()=>{persist++},()=>{persist++});
 return {rankings,users,funcs,get persisted(){return persist;}};
}
const entry=(key,bossesKilled,score=100)=>({key,nickname:key,bossesKilled,score,survival:100});

test('legacy mixed rankings are archived; new Solo and Online start independently',()=>{
 const old={eternal:{alice:entry('alice',8)},daily:{old:{alice:entry('alice',3)}},settled:{day:'old'}};
 const h=boardHarness(old);h.funcs.migrateRankingBoards();
 assert.equal(h.rankings.version,2);
 assert.equal(h.rankings.legacy.eternal.alice.bossesKilled,8);
 assert.deepEqual(h.rankings.online.eternal,{});
 assert.deepEqual(h.rankings.solo.eternal,{});
 h.rankings.online.eternal.alice=entry('alice',5);h.rankings.solo.eternal.bob=entry('bob',9);
 assert.equal(h.funcs.rankedEntries(h.rankings.online.eternal)[0].key,'alice');
 assert.equal(h.funcs.rankedEntries(h.rankings.solo.eternal)[0].key,'bob');
 h.funcs.migrateRankingBoards();assert.equal(h.rankings.online.eternal.alice.bossesKilled,5);
});

test('Solo and Online pay identical period rewards independently, one payment per rollover',()=>{
 const h=boardHarness();h.funcs.migrateRankingBoards();
 for(const mode of ['online','solo']){
  const b=h.rankings[mode];
  b.settled={day:'old',week:'old',month:'old'};
  for(const k of ['daily','weekly','monthly'])b[k].old={alice:entry('alice',2)};
 }
 h.funcs.settlePeriods(true);
 assert.equal(h.users.alice.energy,2*(100+1000+5000));
 const once=h.users.alice.energy;
 h.funcs.settlePeriods(true);assert.equal(h.users.alice.energy,once);
 assert.equal(h.rankings.online.settled.day,'new-day');
 assert.equal(h.rankings.solo.settled.day,'new-day');
});

test('Hall Eterno SOLO titles are temporary and server-authorized by exact rank',()=>{
 const server=source('server.js');
 const begin=server.indexOf(' const HALL_TITLE_PATTERN='),end=server.indexOf(' function ensureAccountId(',begin);
 assert.ok(begin>0&&end>begin);
 const h=boardHarness();h.funcs.migrateRankingBoards();
 const users=h.users,rankings=h.rankings;
 const make=new Function('rankings','users','rankedEntries','TITLE_DEFINITIONS','titleProgress','rooms','io','channelFor','broadcastCardumeRosters','saveUsers',
   server.slice(begin,end)+'\nreturn {unlockedTitleIds,reconcileHallTitles,normalizeHallTitle,hallPosition};');
 const helper=make(rankings,users,h.funcs.rankedEntries,[{id:'abyss-drifter',kind:'starter',required:1}],()=>0,new Map(),{sockets:{sockets:new Map()},to:()=>({emit:()=>{}})},()=>'',()=>{},()=>{});
 rankings.solo.eternal={alice:entry('alice',4),bob:entry('bob',3)};
 helper.reconcileHallTitles({persist:false});
 assert.ok(helper.unlockedTitleIds(users.alice).includes('solo-hall-top-1'));
 assert.ok(helper.unlockedTitleIds(users.bob).includes('solo-hall-top-2'));
 users.alice.equippedTitle='solo-hall-top-1';
 rankings.solo.eternal.bob=entry('bob',5);
 helper.reconcileHallTitles({persist:false});
 assert.equal(users.alice.equippedTitle,'abyss-drifter');
 assert.ok(!helper.unlockedTitleIds(users.alice).includes('solo-hall-top-1'));
 assert.ok(helper.unlockedTitleIds(users.bob).includes('solo-hall-top-1'));
});

test('ranking UI exposes two accessible tabs and three temporary Solo titles',()=>{
 const html=source('public/index.html'),ui=source('public/online.js'),css=source('public/abyssal-ranking-rewards.css'),server=source('server.js');
 for(const mode of ['solo','online'])assert.match(html,new RegExp('data-ranking-mode="'+mode+'"'));
 for(const label of ['Rei Solitário','Príncipe Solitário','Valete Solitário'])assert.ok(ui.includes(label),label);
 assert.match(ui,/activeRankingMode/);
 assert.match(ui,/soloHallPosition/);
 assert.match(css,/ranking-mode-switch/);
 assert.match(server,/const board=rankings\[isolatedRun\?'solo':'online'\]/);
 assert.match(server,/soloHallPosition:hallPosition\(u,'solo'\)/);
 assert.match(server,/migrateRankingBoards\(\);/);
});
