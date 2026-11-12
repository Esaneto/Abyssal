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
  {id:'reef',label:'RECIFE VIVO',x:560,y:650,rx:790,ry:540,fauna:['reefshark','hammerhead','hawksbill','butterflyray','eagleray'],resources:['coralSample','seaMineral']},
  {id:'kelp',label:'FLORESTA DE ALGAS',x:1810,y:680,rx:850,ry:510,fauna:['leatherback','stingray','zebramoray'],resources:['kelpFiber','seaMineral']},
  {id:'rocks',label:'COSTA ROCHOSA',x:3780,y:710,rx:850,ry:640,fauna:['spidercrab','nautilus','zebramoray','ribbonmoray','greenland'],resources:['salvageMetal','seaMineral']},
  {id:'canyon',label:'CÂNION SUBMARINO',x:820,y:2240,rx:900,ry:670,fauna:['goblin','frilled','bigfin','whiplash'],resources:['deepCrystal','salvageMetal']},
  {id:'deep',label:'ÁGUAS PROFUNDAS',x:2740,y:2230,rx:940,ry:670,fauna:['angler','viperfish','blackdragon','seapig'],resources:['deepCrystal','bioSample']},
 ]);
 const REGION_VARIANTS=Object.freeze({
  open:{id:'open',label:'ÁGUAS LIVRES',fauna:['leatherback','eagleray','butterflyray','hawksbill','stingray'],resources:['seaMineral','bioSample']},
  twilight:{id:'twilight',label:'ZONA CREPUSCULAR',fauna:['nautilus','bigfin','frilled','goblin'],resources:['bioSample','deepCrystal']},
  abyss:{id:'abyss',label:'PLANÍCIE ABISSAL',fauna:['seapig','yeticrab','whiplash','angler'],resources:['abyssCrystal','bioSample']}
 });
 // Only curated shop species. Different visual regions have different populations.
 const VISUAL_FAUNA=Object.freeze({
  coastal:Object.freeze({
   shelf:['hawksbill','leatherback','butterflyray','eagleray','stingray'],
   twilight:['nautilus','bigfin','whiplash'],
   deep:['seapig','yeticrab','bigfin']
  }),
  cinematic:Object.freeze({
   shelf:['eagleray','butterflyray','hawksbill','stingray','reefshark','hammerhead'],
   twilight:['nautilus','bigfin','whiplash','frilled','goblin'],
   deep:['bigfin','whiplash','angler','viperfish','blackdragon']
  }),
  geological:Object.freeze({
   shelf:['stingray','spidercrab','zebramoray','nautilus'],
   twilight:['nautilus','ribbonmoray','spidercrab','goblin','frilled'],
   deep:['seapig','yeticrab','whiplash','angler','blackdragon','viperfish']
  })
 });
 const PREDATORS=new Set(['reefshark','hammerhead','abysscroc','greenland','goblin','frilled','viperfish','blackdragon','angler','zebramoray']);
 // Shallow predators start exclusively east of the safe western entry zone.
 function predatorAllowedAt(id,x,y){
  if(!PREDATORS.has(String(id||'')))return true;
  const depth=geo?.metersAt?.(y)||Math.max(0,Number(y)||0)*9000/21000;
  return Number(y)>0&&(depth>=260||(Number(x)>=6000&&depth>=75));
 }
 const SMART=new Set(['bigfin','whiplash','nautilus','spidercrab']);
 const SCHOOLING=new Set(['butterflyray','eagleray','viperfish','hatchetfish']);
 const PREDATOR_STRENGTH=Object.freeze({reefshark:4,hammerhead:4,abysscroc:4,greenland:5,goblin:5,frilled:4,viperfish:3,blackdragon:5,angler:5,zebramoray:3,whiplash:2,bigfin:2});
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
  return {...base,depthBand,visualId:geo?.visualBiomeAt?.(x,y)?.id||'coastal',province:Math.floor(x/4800)+':'+Math.floor(y/3000),
   x:Number(x)||0,y:Number(y)||0};
 }
 function speciesAt(x,y,random=Math.random){
  const zone=habitatAt(x,y),roll=clamp(Number(random())||0,0,.999999);
  // Rare giants and gelatinous filter-feeders remain passive and non-farming.
  if((zone.id==='open'||zone.id==='twilight')&&roll<.007)return 'leviathan';
  if(zone.depthBand!=='shelf'&&roll<.024)return 'siphonophore';
  const bottomClearance=(geo?.floorAt?.(x)||21000)-y;
  // Benthic sea pigs and crabs live on the bottom; they do not drift in midwater.
  const regional=VISUAL_FAUNA[zone.visualId]?.[zone.depthBand];
  const candidates=(regional||zone.fauna||REGION_VARIANTS.open.fauna)
   .filter(id=>(!['seapig','yeticrab','spidercrab','zebramoray','ribbonmoray'].includes(id)||bottomClearance<420)&&predatorAllowedAt(id,x,y));
  const fauna=candidates.length?candidates:REGION_VARIANTS.open.fauna.filter(id=>predatorAllowedAt(id,x,y));
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
   for(let attempt=0;attempt<20&&!chosen;attempt++){
    const seed=(hash+Math.imul(index+attempt,2654435761))>>>0;
    const angle=(seed%6283)/1000;
    const radius=(group?540:680)+((seed>>>8)%860);
    const vertical=.42+((seed>>>17)%45)/100;
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
  if(Array.isArray(neighbors)){
   let count=0,averageX=0,averageY=0,repulseX=0,repulseY=0;
   const ownKey=creatureId(entity);
   for(const mate of neighbors){
    if(!mate||mate===entity||mate.hp<=0||!Number.isFinite(mate.x)||!Number.isFinite(mate.y))continue;
    const dx=entity.x-mate.x,dy=entity.y-mate.y,d=Math.hypot(dx,dy);
    if(d>410)continue;
    const sameSchool=group&&mate.schoolId===entity.schoolId&&mate.specimenSkinId===entity.specimenSkinId;
    if(sameSchool){averageX+=mate.x;averageY+=mate.y;count++;}
    // Schoolmates leave generous room, while other wildlife does not collide.
    const personalSpace=sameSchool?185:125;
    if(d>=personalSpace)continue;
    let ux=dx/Math.max(d,.0001),uy=dy/Math.max(d,.0001);
    if(d<.0001){
     // Exact overlaps must push a PAIR in opposite deterministic directions.
     const otherKey=creatureId(mate),low=ownKey<otherKey?ownKey:otherKey,high=ownKey<otherKey?otherKey:ownKey;
     let pairHash=0;
     for(const char of low+':'+high)pairHash=(Math.imul(pairHash,33)+char.charCodeAt(0))>>>0;
     const angle=pairHash/4294967296*Math.PI*2,sign=ownKey<otherKey?1:-1;
     ux=Math.cos(angle)*sign;uy=Math.sin(angle)*sign;
    }
    const force=Math.min(170,(personalSpace-d)*1.5);
    repulseX+=ux*force;repulseY+=uy*force;
   }
   // Loose cohesion, never converge on another creature's actual center.
   if(count){formationX=formationX*.975+(averageX/count)*.025;formationY=formationY*.975+(averageY/count)*.025;}
   formationX+=clamp(repulseX,-230,230);formationY+=clamp(repulseY,-230,230);
  }
  // Filter rapidly alternating avoidance vectors to prevent shivering.
  if(Number.isFinite(entity.aiFormationX)&&Number.isFinite(entity.aiFormationY)){
   const elapsed=Math.max(0,now-(Number(entity.aiFormationAt)||now));
   const alpha=clamp(elapsed/320,.06,.5);
   formationX=entity.aiFormationX+(formationX-entity.aiFormationX)*alpha;
   formationY=entity.aiFormationY+(formationY-entity.aiFormationY)*alpha;
  }
  entity.aiFormationX=formationX;entity.aiFormationY=formationY;entity.aiFormationAt=now;
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
 // Small physical contact correction complements the formation target. It is
 // applied AFTER the normal navigation step in both Solo and Online: bodies
 // may travel together, but cannot occupy the same space indefinitely.
 function separateContact(entity,neighbors,dt=.05){
  const x=Number(entity?.x),y=Number(entity?.y);
  if(!entity?.wildlifeMode||!Number.isFinite(x)||!Number.isFinite(y)||!Array.isArray(neighbors)||dt<=0)return {x,y};
  const own=creatureId(entity);
  let fx=0,fy=0,nearest=Infinity;
  for(const other of neighbors){
   if(!other||other===entity||!other.wildlifeMode||other.hp<=0||!Number.isFinite(other.x)||!Number.isFinite(other.y))continue;
   const otherId=creatureId(other);
   // Do not override the bite/contact mechanic during legitimate predation.
   if((entity.aiMode==='forage'&&entity.aiPreyId===otherId)||
      (other.aiMode==='forage'&&other.aiPreyId===own))continue;
   const sameSchool=entity.schoolId===other.schoolId&&entity.specimenSkinId===other.specimenSkinId;
   const distance=Math.hypot(x-other.x,y-other.y),limit=sameSchool?100:75;
   if(distance>=limit)continue;
   let ux=(x-other.x)/Math.max(distance,.0001),uy=(y-other.y)/Math.max(distance,.0001);
   if(distance<.0001){
    const first=own<otherId?own:otherId,second=own<otherId?otherId:own;
    let h=0;for(const c of first+':'+second)h=(Math.imul(h,33)+c.charCodeAt(0))>>>0;
    const angle=h/4294967296*Math.PI*2,sign=own<otherId?1:-1;
    ux=Math.cos(angle)*sign;uy=Math.sin(angle)*sign;
   }
   const weight=(limit-distance)/limit;fx+=ux*weight;fy+=uy*weight;
   nearest=Math.min(nearest,limit-distance);
  }
  const strength=Math.hypot(fx,fy);
  if(strength<.001){
   const decay=Math.exp(-Math.min(.1,dt)*10);
   entity.aiSeparationX=(Number(entity.aiSeparationX)||0)*decay;
   entity.aiSeparationY=(Number(entity.aiSeparationY)||0)*decay;
   return {x,y};
  }
  const desiredX=fx/strength,desiredY=fy/strength,blend=1-Math.exp(-Math.min(.1,dt)*13);
  entity.aiSeparationX=(Number.isFinite(entity.aiSeparationX)?entity.aiSeparationX:desiredX)+(desiredX-(Number.isFinite(entity.aiSeparationX)?entity.aiSeparationX:desiredX))*blend;
  entity.aiSeparationY=(Number.isFinite(entity.aiSeparationY)?entity.aiSeparationY:desiredY)+(desiredY-(Number.isFinite(entity.aiSeparationY)?entity.aiSeparationY:desiredY))*blend;
  const smoothLength=Math.hypot(entity.aiSeparationX,entity.aiSeparationY)||1;
  const step=Math.min(95*Math.min(.1,dt),Math.max(0,nearest)*.45);
  if(step<=0)return {x,y};
  const nx=x+entity.aiSeparationX/smoothLength*step,ny=y+entity.aiSeparationY/smoothLength*step;
  // The same solid-collision geometry used for navigation guards the push.
  const radius=clamp(Number(entity.r)*.55||18,10,45);
  const moved=geo?.resolveMove?.(x,y,nx,ny,radius);
  return moved&&Number.isFinite(moved.x)&&Number.isFinite(moved.y)?{x:moved.x,y:moved.y}:{x:nx,y:ny};
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
 // Hot-path containers are reused instead of rebuilding filter/map chains.
 const predationIndex=new Map(),predationHits=[];
 function simulatePredation(entities,delta=0,now=Date.now()){
  predationIndex.clear();predationHits.length=0;
  if(!Array.isArray(entities)||!entities.length||delta<=0)return predationHits;
  for(const entity of entities)if(entity?.wildlifeMode&&entity.hp>0)predationIndex.set(creatureId(entity),entity);
  const index=predationIndex,hits=predationHits;
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
 return Object.freeze({ZONES,HABITAT_DEPTH,VISUAL_FAUNA,habitatAt,speciesAt,speciesHabitat,temperament,isSchooling,predatorAllowedAt,comparePredators,canSee,decide,navigationTarget,separateContact,activateAgainstPlayer,simulatePredation});
});
