/* Open-sea ecology, deterministic and shared by solo and multiplayer.
 * This module owns habitat selection and decisions, never networking or damage.
 */
(function(root,factory){
 const geo=typeof module==='object'&&module.exports?require('./abyssal-ocean-geography.js'):root.AbyssalOceanGeography;
 const standard=typeof module==='object'&&module.exports?require('./skin-standard.js'):root.AbyssalSkinStandard;
 const api=factory(geo,standard);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalOpenSeaEcology=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(geo,standard){
 'use strict';
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const ZONES=Object.freeze([
  {id:'reef',label:'RECIFE VIVO',x:560,y:650,rx:790,ry:540,fauna:['reefshark','hawksbill','butterflyray','eagleray'],resources:['coralSample','seaMineral']},
  {id:'kelp',label:'FLORESTA DE ALGAS',x:1810,y:680,rx:850,ry:510,fauna:['leatherback','stingray','zebramoray'],resources:['kelpFiber','seaMineral']},
  {id:'rocks',label:'COSTA ROCHOSA',x:3780,y:710,rx:850,ry:640,fauna:['spidercrab','nautilus','zebramoray'],resources:['salvageMetal','seaMineral']},
  {id:'canyon',label:'CÂNION SUBMARINO',x:820,y:2240,rx:900,ry:670,fauna:['goblin','frilled','bigfin','whiplash'],resources:['deepCrystal','salvageMetal']},
  {id:'deep',label:'ÁGUAS PROFUNDAS',x:2740,y:2230,rx:940,ry:670,fauna:['angler','viperfish','blackdragon','seapig'],resources:['deepCrystal','bioSample']},
 ]);
 const REGION_VARIANTS=Object.freeze({
  open:{id:'open',label:'ÁGUAS LIVRES',fauna:['leatherback','eagleray','butterflyray'],resources:['seaMineral','bioSample']},
  twilight:{id:'twilight',label:'ZONA CREPUSCULAR',fauna:['nautilus','bigfin','frilled','goblin'],resources:['bioSample','deepCrystal']},
  abyss:{id:'abyss',label:'PLANÍCIE ABISSAL',fauna:['seapig','yeticrab','whiplash','angler'],resources:['abyssCrystal','bioSample']}
 });
 const PREDATORS=new Set(['reefshark','goblin','frilled','viperfish','blackdragon','angler','zebramoray']);
 const SMART=new Set(['bigfin','whiplash','nautilus','spidercrab']);
 const SCHOOLING=new Set(['butterflyray','eagleray','viperfish','hatchetfish','reefshark']);
 const PREDATOR_STRENGTH=Object.freeze({reefshark:4,goblin:5,frilled:4,viperfish:3,blackdragon:5,angler:5,zebramoray:3,whiplash:2,bigfin:2});
 const HABITAT_DEPTH=Object.freeze({
  reef:[0,200],kelp:[0,200],rocks:[0,800],canyon:[400,1800],
  deep:[850,2200],abyss:[1600,2200],open:[0,850],twilight:[200,1050]
 });
 function isSchooling(id){return SCHOOLING.has(String(id||''));}
 function speciesHabitat(id){
  const species=String(id||'');
  const matches=[...ZONES,...Object.values(REGION_VARIANTS)].filter(zone=>zone.fauna.includes(species));
  if(species==='siphonophore')matches.push(REGION_VARIANTS.twilight,REGION_VARIANTS.abyss);
  if(species==='leviathan')matches.push(REGION_VARIANTS.open,REGION_VARIANTS.twilight);
  if(!matches.length)return null;
  const labels=[...new Set(matches.map(z=>z.label))];
  const min=Math.min(...matches.map(z=>HABITAT_DEPTH[z.id]?.[0]??0));
  const max=Math.max(...matches.map(z=>HABITAT_DEPTH[z.id]?.[1]??600));
  return Object.freeze({name:labels.join(' / '),minDepth:min,maxDepth:max});
 }
 function comparePredators(hunter,prey){
  const h=String(hunter?.specimenSkinId||''),p=String(prey?.specimenSkinId||'');
  if(h===p)return false;
  const strength=PREDATOR_STRENGTH[h]||0,opponent=PREDATOR_STRENGTH[p]||0;
  // Even apex predators sometimes hunt smaller predators; healthy targets can retaliate.
  return strength>0&&(opponent===0||strength>=opponent+1);
 }
 function habitatAt(x,y){
  // Side-view geological habitats replace the repeated six-ellipse pattern.
  const type=geo?.classify?.(x,y)||'open';
  const base=ZONES.find(z=>z.id===type)||REGION_VARIANTS[type]||REGION_VARIANTS.open;
  const depth=geo?.metersAt?.(y)||0,depthBand=depth>1000?'deep':depth>200?'twilight':'shelf';
  return {...base,depthBand,province:Math.floor(x/4800)+':'+Math.floor(y/3000),
   x:Number(x)||0,y:Number(y)||0};
 }
 function speciesAt(x,y,random=Math.random){
  const zone=habitatAt(x,y),roll=clamp(Number(random())||0,0,.999999);
  // Rare giants and gelatinous filter-feeders remain passive and non-farming.
  if((zone.id==='open'||zone.id==='twilight')&&roll<.007)return 'leviathan';
  if(zone.depthBand!=='shelf'&&roll<.024)return 'siphonophore';
  const bottomClearance=(geo?.floorAt?.(x)||21000)-y;
  // Benthic sea pigs and crabs live on the bottom; they do not drift in midwater.
  const candidates=(zone.fauna||REGION_VARIANTS.open.fauna).filter(id=>!['seapig','yeticrab','spidercrab'].includes(id)||bottomClearance<400);
  const fauna=candidates.length?candidates:REGION_VARIANTS.twilight.fauna;
  return fauna[Math.min(fauna.length-1,Math.floor(clamp(Number(random())||0,0,.999999)*fauna.length))];
 }
 function temperament(id){
  return PREDATORS.has(id)?'aggressive':SMART.has(id)?'smart':'passive';
 }
 function canSee(entity,target,range=530,halfAngle=Math.PI*.44){
  const dx=target.x-entity.x,dy=target.y-entity.y,d2=dx*dx+dy*dy;if(d2>range*range)return false;
  const a=Math.atan2(dy,dx)-(Number(entity.angle)||0);
  return Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<=halfAngle&&(!geo||geo.segmentClear(entity.x,entity.y,target.x,target.y,2));
 }

 // Hold obstacle bypass headings briefly so active swimmers do not ping-pong
 // between opposite sides of a rock on successive 20 Hz AI ticks.
 function navigationTarget(entity,goal,padding=24,now=Date.now()){
  if(!entity||!goal||!geo||!Number.isFinite(goal.x)||!Number.isFinite(goal.y))return goal;
  const radius=clamp(Number(padding)||24,4,70);
  const close=Math.hypot(goal.x-entity.x,goal.y-entity.y);
  if(close<8||geo.segmentClear(entity.x,entity.y,goal.x,goal.y,radius)){
   entity.aiNavGoal=null;entity.aiNavUntil=0;return goal;
  }
  const cached=entity.aiNavGoal;
  if(cached&&entity.aiNavMode===entity.aiMode&&now<(Number(entity.aiNavUntil)||0)&&
    Math.hypot(cached.x-entity.x,cached.y-entity.y)>44&&
    Math.hypot((Number(entity.aiNavDestinationX)||0)-goal.x,(Number(entity.aiNavDestinationY)||0)-goal.y)<340&&
    geo.segmentClear(entity.x,entity.y,cached.x,cached.y,radius)){
    return {x:cached.x,y:cached.y,direct:false};
  }
  const next=geo.steer(entity.x,entity.y,goal.x,goal.y,radius,entity.id||0);
  entity.aiNavGoal={x:next.x,y:next.y};
  entity.aiNavMode=entity.aiMode;
  entity.aiNavDestinationX=goal.x;
  entity.aiNavDestinationY=goal.y;
  entity.aiNavUntil=now+1500;
  return next;
 }
 function creatureId(entity){return String(entity?.id??entity?.streamId??'');}
 function hashSchool(entity){
  let seed=0;for(const ch of String(entity?.schoolId||entity?.id||1))seed=(Math.imul(seed,31)+ch.charCodeAt(0))>>>0;
  return seed;
 }
 function commit(entity,decision,now,force=false){
  const current=entity.aiMode,mode=decision.mode;
  const locked=(Number(entity.aiDecisionUntil)||0)>now;
  // Keep intent stable briefly. Never retain live player objects on server enemies:
  // enemies are serialized into room snapshots and would otherwise leak player state.
  if(locked&&!force&&current&&current!==mode){
   if(current==='flee'||current==='evade-predator')return {...decision,target:entity.aiGoal||decision.target,mode:current,aggressive:false};
   if(current==='alert'&&mode==='patrol')return {...decision,target:entity.aiGoal||decision.target,mode:current,aggressive:false};
  }
  if(current!==mode){
   entity.aiMode=mode;
   entity.aiDecisionUntil=now+(mode==='attack'?1150:mode==='flee'||mode==='evade-predator'?920:mode==='forage'?1200:720);
  }
  entity.aiGoal=decision.target?{x:Number(decision.target.x)||0,y:Number(decision.target.y)||0,alive:true,moveSpeed:Number(decision.target.moveSpeed)||110}:null;
  entity.aiIndicator=(mode==='attack'||mode==='forage')?'attack':
   (mode==='flee'||mode==='evade-predator')?'flee':mode==='alert'?'evaluate':null;
  return decision;
 }
 function decide(entity,players,seconds=0,now=Date.now(),neighbors=[]){
  const nature=entity.wildlifeMode||temperament(entity.specimenSkinId);
  if(entity.aiNature!==nature){entity.aiNature=nature;entity.aiMode=null;entity.aiDecisionUntil=0;}
  const hash=hashSchool(entity);
  const centerX=Number.isFinite(entity.homeX)?entity.homeX:entity.x;
  const centerY=Number.isFinite(entity.homeY)?entity.homeY:entity.y;
  const group=isSchooling(entity.specimenSkinId);
  const habitat=habitatAt(centerX,centerY),worldW=geo?.WIDTH||24000,worldH=geo?.HEIGHT||21000;
  // Wildlife owns a persistent roaming waypoint inside its habitat. The old tiny
  // sinusoid changed direction continuously and made animals shiver around spawn.
  const reached=!entity.aiPatrolGoal||Math.hypot(entity.x-entity.aiPatrolGoal.x,entity.y-entity.aiPatrolGoal.y)<70;
  const expired=now>=(Number(entity.aiPatrolUntil)||0);
  if(reached||expired){
   const index=(Number(entity.aiPatrolIndex)||0)+1;entity.aiPatrolIndex=index;
   let chosen=null;
   for(let attempt=0;attempt<10&&!chosen;attempt++){
    const seed=(hash+Math.imul(index+attempt,2654435761))>>>0;
    const angle=(seed%6283)/1000;
    const radius=(group?360:430)+((seed>>>8)%420);
    const vertical=.48+((seed>>>17)%30)/100;
    const x=clamp(centerX+Math.cos(angle)*radius,45,worldW-45);
    const y=clamp(centerY+Math.sin(angle)*radius*vertical,45,worldH-45);
    const sameHabitat=habitatAt(x,y).id===habitat.id;
    if(sameHabitat&&!geo?.isSolid?.(x,y,38))chosen={x,y};
   }
   if(!chosen)chosen={x:centerX,y:centerY};
   entity.aiPatrolGoal=chosen;
   entity.aiPatrolUntil=now+6500+(hash%4500);
  }
  let formationX=entity.aiPatrolGoal.x,formationY=entity.aiPatrolGoal.y;
  if(group&&Array.isArray(neighbors)){
   let count=0,averageX=0,averageY=0,repulseX=0,repulseY=0;
   for(const mate of neighbors){
    if(!mate||mate===entity||mate.hp<=0||mate.schoolId!==entity.schoolId||mate.specimenSkinId!==entity.specimenSkinId)continue;
    const dx=entity.x-mate.x,dy=entity.y-mate.y,d=Math.hypot(dx,dy);
    if(d>420||d<.0001)continue;
    averageX+=mate.x;averageY+=mate.y;count++;
    if(d<48){repulseX+=dx/d*(48-d);repulseY+=dy/d*(48-d);}
   }
   if(count){formationX=formationX*.82+(averageX/count)*.18+repulseX*1.15;formationY=formationY*.82+(averageY/count)*.18+repulseY*1.15;}
  }
  const patrol={x:clamp(formationX,34,worldW-34),y:clamp(formationY,34,worldH-34),alive:true,moveSpeed:group?118:102};
  const crowd=Array.isArray(neighbors)?neighbors:[];
  const provoked=(Number(entity.provokedUntil)||0)>now;
  let target=null,distance=Infinity,visibleTarget=false;
  for(const p of players||[]){
   if(!p||p.alive===false||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
   const d=Math.hypot(p.x-entity.x,p.y-entity.y);
   // A predator that has committed to a chase remembers the diver briefly
   // when its turning animation moves the prey outside the view cone.
   // Solid geology still blocks memory-based pursuit.
   const visible=canSee(entity,p,530,Math.PI*.46);
   const remembered=entity.aiMode==='attack'&&now<(Number(entity.aiChaseUntil)||0)
      &&d<410&&(!geo||geo.segmentClear(entity.x,entity.y,p.x,p.y,6));
   if(d<distance&&(visible||remembered||(provoked&&d<300))){
    target=p;distance=d;visibleTarget=visible;
   }
  }
  let predator=null,prey=null,predatorDistance=Infinity,preyDistance=Infinity;
  for(const other of crowd){
   if(!other||other===entity||other.hp<=0||other.schoolId===entity.schoolId||
     !Number.isFinite(other.x)||!Number.isFinite(other.y))continue;
   const d=Math.hypot(other.x-entity.x,other.y-entity.y);
   if(d>340)continue;
   const looksDangerous=comparePredators(other,entity);
   if(looksDangerous&&d<predatorDistance&&canSee(entity,other,340,Math.PI*.94)){predator=other;predatorDistance=d;}
   if(nature==='aggressive'&&comparePredators(entity,other)&&d<preyDistance&&canSee(entity,other,340,Math.PI*.94)){prey=other;preyDistance=d;}
  }
  const lowHealth=(Number(entity.hp)||0)<(Number(entity.maxHp)||Math.max(1,Number(entity.hp)||1))*.42;
  if(predator&&(nature!=='aggressive'||predatorDistance<95||lowHealth)){
   const dx=entity.x-predator.x,dy=entity.y-predator.y,d=Math.hypot(dx,dy)||1;
   entity.aiPreyId=null;
   return commit(entity,{mode:'evade-predator',target:{x:clamp(entity.x+dx/d*310,35,(geo?.WIDTH||24000)-35),y:clamp(entity.y+dy/d*310,35,(geo?.HEIGHT||21000)-35),alive:true,moveSpeed:185},aggressive:false},now,lowHealth);
  }
  if(target){
   const escape=nature==='passive'&&!provoked||(nature==='smart'&&(lowHealth||distance<140)&&!provoked);
   if(escape){
    const dx=entity.x-target.x,dy=entity.y-target.y,d=Math.hypot(dx,dy)||1;
    entity.aiPreyId=null;
    return commit(entity,{mode:'flee',target:{x:clamp(entity.x+dx/d*320,35,(geo?.WIDTH||24000)-35),y:clamp(entity.y+dy/d*320,35,(geo?.HEIGHT||21000)-35),alive:true,moveSpeed:200},aggressive:false},now,lowHealth);
   }
   const maintainingChase=entity.aiMode==='attack'&&now<(Number(entity.aiChaseUntil)||0)&&distance<410;
   if((nature==='aggressive'&&!provoked&&distance>245&&!maintainingChase)||
      (nature==='smart'&&!provoked&&distance>175&&!maintainingChase)){
    entity.aiPreyId=null;
    return commit(entity,{mode:'alert',target:patrol,aggressive:false},now);
   }
   entity.aiPreyId=null;
   // Sight refreshes chase memory. A remembered sighting does not perpetually
   // refresh itself, so hiding behind terrain eventually ends pursuit.
   if(visibleTarget||provoked){
    entity.aiChaseUntil=now+1800;
    entity.aiLastSeenX=target.x;entity.aiLastSeenY=target.y;
   }
   return commit(entity,{mode:'attack',target,aggressive:true},now,true);
  }
  if(prey&&nature==='aggressive'){
   entity.aiPreyId=creatureId(prey);
   return commit(entity,{mode:'forage',target:{x:prey.x,y:prey.y,alive:true,moveSpeed:130},aggressive:false,preyId:creatureId(prey)},now);
  }
  entity.aiPreyId=null;
  return commit(entity,{mode:'patrol',target:patrol,aggressive:false},now);
 }
 // Specimens are the single authoritative active-skill catalog for living fauna.
 // A cast returns intent only; Solo/Online apply hits through their existing damage code.
 function activateAgainstPlayer(entity,player,now=Date.now()){
  if(!entity||!player||player.alive===false||entity.hp<=0||entity.aiMode!=='attack')return null;
  if(now<(Number(entity.wildlifeAbilityReadyAt)||0))return null;
  const skill=standard?.activeSpec?.(entity.specimenSkinId);
  if(!skill)return null;
  const distance=Math.hypot(Number(player.x)-Number(entity.x),Number(player.y)-Number(entity.y));
  const radius=Math.max(90,Math.min(285,(Number(skill.range)||0)*.72));
  if(distance>radius||!geo.segmentClear(entity.x,entity.y,player.x,player.y,8))return null;
  entity.wildlifeAbilityReadyAt=now+Math.max(3500,(Number(skill.cooldown)||10)*1000);
  entity.wildlifeAbilityUntil=now+820;
  entity.wildlifeAbilityId=skill.id;
  if(skill.id==='shield')entity.wildlifeShieldUntil=now+2000;
  const damage=skill.id==='shield'?0:Math.min(22,Math.max(2,Math.round((Number(skill.damage)||0)*.24)+2));
  return {id:skill.id,damage,range:radius,color:skill.color||'#76e7e3',
   neurotoxinMs:skill.id==='paralysis'?100:skill.id==='poison'?2500:skill.id==='slowShot'?1400:0};
 }
 // Separate wildlife-versus-wildlife combat from player kill/reward accounting.
 // Every active is sourced from the already configured Specimens ability registry.
 function simulatePredation(entities,delta=0,now=Date.now()){
  if(!Array.isArray(entities)||!entities.length||delta<=0)return [];
  const index=new Map(entities.filter(e=>e?.wildlifeMode&&e.hp>0).map(e=>[creatureId(e),e]));
  const hits=[];
  for(const attacker of index.values()){
   if(attacker.aiMode!=='forage'||!attacker.aiPreyId||attacker.hp<=0)continue;
   const prey=index.get(attacker.aiPreyId);if(!prey||!comparePredators(attacker,prey)||prey.hp<=0)continue;
   const distance=Math.hypot(attacker.x-prey.x,attacker.y-prey.y);
   const reach=Math.max(22,(Number(attacker.r)||12)*.55+(Number(prey.r)||12)*.55);
   const active=standard?.activeSpec?.(attacker.specimenSkinId);
   const ready=now>=(Number(attacker.wildlifeAbilityReadyAt)||0);
   const abilityReach=Math.max(reach,Math.min(200,(Number(active?.range)||0)*.35));
   let damage=0,abilityId=null;
   if(ready&&active&&distance<=abilityReach){
    abilityId=active.id;
    attacker.wildlifeAbilityReadyAt=now+Math.max(2600,(Number(active.cooldown)||10)*1000);
    attacker.wildlifeAbilityUntil=now+800;
    attacker.wildlifeAbilityId=abilityId;
    if(abilityId==='shield')attacker.wildlifeShieldUntil=now+2000;
    else {
     damage=Math.min(50,Math.max(0,(Number(active.damage)||0)*.35));
     if(abilityId==='paralysis')prey.paralyzedUntil=Math.max(Number(prey.paralyzedUntil)||0,now+100);
     if(abilityId==='poison')prey.wildlifePoisonUntil=Math.max(Number(prey.wildlifePoisonUntil)||0,now+3000);
     if(abilityId==='slowShot')prey.wildlifeSlowUntil=Math.max(Number(prey.wildlifeSlowUntil)||0,now+1400);
    }
   }
   // Tick-rate-independent bite cadence: no 20 Hz damage events or excessive
   // networking when two large cardumes fight. Special abilities have separate cooldowns.
   if(distance<=reach&&now>=(Number(attacker.wildlifeBiteReadyAt)||0)){
    damage+=Math.max(2,(Number(attacker.damage)||6)*.28);
    attacker.wildlifeBiteReadyAt=now+650;
   }
   if(damage<=0)continue;
   if((Number(prey.wildlifeShieldUntil)||0)>now)damage*=.35;
   prey.hp=Math.max(0,(Number(prey.hp)||0)-damage);
   prey.damageRevision=(Number(prey.damageRevision)||0)+1;
   prey.provokedUntil=now+2500;
   hits.push({hunterId:attacker.id,preyId:prey.id,damage,abilityId,killed:prey.hp<=0});
  }
  return hits;
 }
 return Object.freeze({ZONES,HABITAT_DEPTH,habitatAt,speciesAt,speciesHabitat,temperament,isSchooling,comparePredators,canSee,decide,navigationTarget,activateAgainstPlayer,simulatePredation});
});
