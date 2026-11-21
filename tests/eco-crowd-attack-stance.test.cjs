'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Scale=require('../public/creature-scale.js');
const Pet=require('../public/abyssal-pet-tactics.js');
const Evasion=require('../public/specimen-evasion.js');
const AI=require('../public/enemy-ai.js');

test('real-sized Ecos maintain strike stance through 12 hostile bodies and moving target',()=>{
 for(const [id,family] of [['reefshark','shark'],['default','signature'],['aberration','octopus'],['kraken','squid']]){
  const enemy={id:100,x:75,y:0,r:15,hp:100,kind:'drifter'},profile=Pet.attackProfile(id,family,Scale.visualRadius(id));
  const eco={x:0,y:0,facingAngle:0,approachAngle:0},others=[];
  for(let i=0;i<12;i++){const a=i*Math.PI*2/12;others.push({id:i,x:75+60*Math.cos(a),y:60*Math.sin(a),r:12,hp:100,kind:'drifter'});}
  let holding=0,attacks=0,reversals=0,previous=0;
  for(let tick=0;tick<120;tick++){
   const now=tick*50,dt=.05;
   enemy.x=75+4*Math.sin(tick*.023);enemy.y=3*Math.sin(tick*.021);
   const direct=Math.atan2(enemy.y-eco.y,enemy.x-eco.x);
   const delta=Math.atan2(Math.sin(direct-eco.approachAngle),Math.cos(direct-eco.approachAngle));
   eco.approachAngle+=Math.max(-dt*2.6,Math.min(dt*2.6,delta));
   const goal=Pet.attackGoal(eco,enemy,profile,eco.approachAngle);
   const turn=Math.atan2(Math.sin(goal.angle-eco.facingAngle),Math.cos(goal.angle-eco.facingAngle));
   eco.facingAngle+=turn*(1-Math.exp(-dt*12));
   const contact=Pet.attackContact(eco,enemy,profile,eco.facingAngle,now*.0018,AI.touchesKrakenTentacle);
   if(contact)attacks++;
   if(contact||Pet.attackStance(eco,enemy,profile)){holding++;continue;}
   const move=Evasion.steer({position:eco,target:goal,enemies:others,speed:190,dt,
    radius:Scale.companionCollisionRadius(id),clearance:28/.78,heading:eco.facingAngle,intent:'combat',state:eco});
   const clipped=Pet.limitApproach(eco,move,enemy,goal.stop-1),dx=clipped.x-eco.x;
   if(previous*dx<-.1)reversals++;
   if(Math.abs(dx)>.1)previous=dx;
   eco.x=clipped.x;eco.y=clipped.y;
  }
  assert.ok(holding>95,id+' must keep contact stance instead of retreating into other enemies');
  assert.ok(attacks>20,id+' must actually touch and attack the target');
  assert.ok(reversals<3,id+' must not repeatedly advance and retreat');
 }
});
test('the same attack stance and per-Eco follow state run in Solo and Online',()=>{
 const base=path.join(__dirname,'..');
 const game=fs.readFileSync(path.join(base,'public/game.js'),'utf8');
 const server=fs.readFileSync(path.join(base,'server.js'),'utf8');
 const sw=fs.readFileSync(path.join(base,'public/offline-sw.js'),'utf8');
 const client=fs.readFileSync(path.join(base,'public/client-build.js'),'utf8');
 assert.match(game,/PET_TACTICS\.attackStance\(s,combatTarget,profile\)/);
 assert.match(server,/PetTactics\.attackStance\(pos,combatTarget,profile\)/);
 assert.match(game,/intent:combatTarget\?'combat':orb\?'collect':'follow',state:s/);
 assert.match(server,/intent:combatTarget\?'combat':orb\?'collect':'follow',state:peer/);
 assert.match(sw,/2026-11-21-eco-stance-v306/);
 assert.match(client,/revision:'eco-stance-v306'/);
});
