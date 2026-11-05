'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');

function loadDamageFeedback(){
 const start=game.indexOf('const SKIN_DAMAGE_SKILLS=new Set(');
 const end=game.indexOf('function spawnDamageNumber(',start);
 assert.ok(start>0&&end>start,'source-based damage feedback helpers must be defined');
 let now=1000;
 const ctx={RESONANCE_CATEGORIES:{passive:['bleed-passive']},performance:{now:()=>now}};
 const api=vm.runInNewContext(game.slice(start,end)+';({damageTone,showPeriodicSkinDamageNumber})',ctx);
 return {...api,setNow(value){now=value;}};
}

test('skin-inflicted damage numbers are green while normal shots and other passives retain their colors',()=>{
 const {damageTone}=loadDamageFeedback();
 for(const id of ['violet-resonance','toxic-cloud','blue-ring-ink','pelagic-wake','poison-dot','kraken-contact','kraken-sweep','abysscroc-lunge','armoredgator-spin']){
  assert.equal(damageTone(id),'skin',id);
 }
 assert.equal(damageTone('electric'),'shot');
 assert.equal(damageTone('photonRay'),'shot');
 assert.equal(damageTone('bleed-passive'),'passive');
 assert.equal(damageTone('gravitationalRupture'),'passive');
 assert.match(game,/number\.tone==='skin'\?'#52ff86':number\.tone==='passive'\?'#32cfff':'#ff174d'/);
});

test('green periodic skin damage appears without creating a new label every tick',()=>{
 const {showPeriodicSkinDamageNumber,setNow}=loadDamageFeedback();
 const enemy={};
 setNow(1000);assert.equal(showPeriodicSkinDamageNumber(enemy),true);
 setNow(1300);assert.equal(showPeriodicSkinDamageNumber(enemy),false);
 setNow(1849);assert.equal(showPeriodicSkinDamageNumber(enemy),false);
 setNow(1850);assert.equal(showPeriodicSkinDamageNumber(enemy),true);
 assert.match(game,/visual:showPeriodicSkinDamageNumber\(e\)/);
 assert.match(game,/visual: showPeriodicSkinDamageNumber\(e\)/);
});

test('multiplayer combat and blue-ring ink PvP carry skin damage tone into floating numbers',()=>{
 assert.match(game,/spawnDamageNumber\(enemy\.x,enemy\.y,damage,damageTone\(skillId\)\)/);
 assert.match(game,/spawnDamageNumber\(Number\(data\.enemyX\)\|\|enemy\.x,Number\(data\.enemyY\)\|\|enemy\.y,Number\(data\.damage\),damageTone\(data\.skillId\)\)/);
 assert.match(game,/damageTone\(data\.skillId\|\|data\.source\)/);
 assert.match(game,/damageTone\(d\.skillId\|\|d\.source\)/);
});
