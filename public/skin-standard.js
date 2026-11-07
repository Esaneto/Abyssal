(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalSkinStandard=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';

 const TIER_PERCENT=Object.freeze({coins:10,brl199:12,brl499:14,brl999:16,mission:16,promo:10});
 const ATTRIBUTE_LABELS=Object.freeze({
  damage:'dano',movement:'velocidade',fireRate:'cadência',range:'alcance',
  defense:'resistência',experience:'experiência',bossDamage:'dano contra bosses',
  activeCooldown:'recarga da habilidade ativa'
 });
 const ACTIVE=Object.freeze({
  dash:{name:'Investida',cooldown:10,color:'#78eaff',damage:8,range:155},
  cloud:{name:'Nuvem Tóxica',cooldown:12,color:'#7dff73',damage:5,range:150},
  trail:{name:'Rastro Abissal',cooldown:11,color:'#79dfff',damage:4,range:0},
  push:{name:'Impacto de Pressão',cooldown:11,color:'#ffc978',damage:5,range:165},
  poison:{name:'Veneno Concentrado',cooldown:10,color:'#9dff68',damage:3,range:175},
  paralysis:{name:'Descarga Bioelétrica',cooldown:12,color:'#62edff',damage:4,range:165},
  shot:{name:'Disparo Colossal',cooldown:10,color:'#ff779b',damage:12,range:360},
  pulse:{name:'Pulso Abissal',cooldown:11,color:'#b99cff',damage:7,range:180},
  slowShot:{name:'Projétil Hipotérmico',cooldown:10,color:'#9bd9ff',damage:7,range:320},
  shield:{name:'Escudo de Pressão',cooldown:14,color:'#8ff4e8',damage:0,range:0}
 });
 const ATTRIBUTES=Object.freeze(['damage','movement','fireRate','range','defense','experience','bossDamage','activeCooldown']);
 const ACTIVE_KEYS=Object.freeze(Object.keys(ACTIVE));

 const legacy=[
  'default','violet','solar','toxic','leviathan','thorn','abyssking','royal','glacier','coral',
  'bloodmoon','voidwing','abyssaleye','deepwarden','riftSmileRelic','kraken','aberration','angler',
  'maw','devourer','saltcroc','blackcaiman','reefshark','hammerhead','abysscroc','armoredgator',
  'greensnake','electriceel','electriceellegacy'
 ];
 const curated=[
  'eagleray','ribbonmoray','dumbo','blanket','atolla','phantomjelly','yeticrab','nautilus','gharial',
  'goblin','frilled','greenland','butterflyray','stingray','guitarfish','sawtootheel','zebramoray',
  'dogtootheel','mimic','glassoctopus','combjelly','helmetjelly','siphonophore','spidercrab',
  'deeplobster','pistolshrimp','scalyfoot','bluedragon','whelk','leatherback','seasnake','hawksbill',
  'jewelsquid','bigfin','whiplash','viperfish','blackdragon','hatchetfish','basketstar','crinoid','seapig'
 ];
 const bossPaid=new Set(['leviathan','kraken','aberration','angler','maw','devourer']);
 const paid199=new Set(['violet','reefshark','hammerhead']);
 const paid499=new Set(['saltcroc','blackcaiman','abysscroc','armoredgator','electriceellegacy']);
 const mission=new Set(['greensnake','riftSmileRelic']);
 const promo=new Set(['electriceel']);

 function tierFor(id){
  if(bossPaid.has(id))return 'brl999';
  if(paid499.has(id))return 'brl499';
  if(paid199.has(id))return 'brl199';
  if(mission.has(id))return 'mission';
  if(promo.has(id))return 'promo';
  return 'coins';
 }
 const forced=Object.freeze({
  violet:['pulse','range'],
  toxic:['cloud','experience'],
  reefshark:['trail','movement'],
  saltcroc:['push','damage'],
  armoredgator:['push','defense'],
  greensnake:['poison','damage'],
  electriceel:['paralysis','fireRate'],
  electriceellegacy:['paralysis','movement'],
  leviathan:['shot','bossDamage'],
  glacier:['slowShot','range'],
  abysscroc:['dash','defense'],
  hammerhead:['pulse','experience'],
  kraken:['push','bossDamage'],
  aberration:['trail','activeCooldown'],
  angler:['dash','range'],
  maw:['cloud','damage'],
  devourer:['pulse','bossDamage'],
  riftSmileRelic:['shield','defense'],
  blackcaiman:['shield','movement']
 });
 const all=[...legacy,...curated],used=new Set(),profiles=Object.create(null);
 for(const [id,pair] of Object.entries(forced))used.add(pair.join('|'));
 let cursor=0;
 function nextPair(){
  while(cursor<ACTIVE_KEYS.length*ATTRIBUTES.length){
   const active=ACTIVE_KEYS[Math.floor(cursor/ATTRIBUTES.length)],attribute=ATTRIBUTES[cursor%ATTRIBUTES.length];cursor++;
   if(active==='paralysis')continue;
   const key=active+'|'+attribute;if(!used.has(key)){used.add(key);return [active,attribute];}
  }
  throw new Error('Skin profile combinations exhausted');
 }
 for(const id of all){
  const [active,attribute]=forced[id]||nextPair(),tier=tierFor(id),percent=TIER_PERCENT[tier];
  profiles[id]=Object.freeze({id,tier,percent,attribute,active,cooldown:ACTIVE[active].cooldown});
 }
 function profile(id){return profiles[String(id||'default')]||profiles.default;}
 function passiveMultiplier(id,attribute){
  const p=profile(id);if(p.attribute!==attribute)return 1;
  const amount=p.percent/100;
  return attribute==='defense'?1-amount:1+amount;
 }
 function activeSpec(id){
  const p=profile(id),base=ACTIVE[p.active],cooldown=p.attribute==='activeCooldown'?base.cooldown*(1-p.percent/100):base.cooldown;
  return Object.freeze({...base,id:p.active,cooldown,skinId:p.id,percent:p.percent,attribute:p.attribute});
 }
 function describe(id){
  const p=profile(id),a=activeSpec(id),sign=p.attribute==='defense'?'-':'+';
  return `${sign}${p.percent}% de ${ATTRIBUTE_LABELS[p.attribute]} · Ativa: ${a.name} (${a.cooldown.toFixed(1).replace('.0','')} s)`;
 }
 function validate(){
  const pairs=new Set();
  for(const p of Object.values(profiles)){
   if(p.active==='paralysis'&&!['electriceel','electriceellegacy'].includes(p.id))throw new Error('Paralysis is electric-only: '+p.id);
   const key=p.active+'|'+p.attribute;
   if(pairs.has(key))throw new Error('Duplicate active + attribute pair: '+key);
   pairs.add(key);
  }
  return true;
 }
 validate();
 return Object.freeze({TIER_PERCENT,ATTRIBUTE_LABELS,ACTIVE,ATTRIBUTES,ACTIVE_KEYS,profiles,profile,passiveMultiplier,activeSpec,describe,validate,bossPaid,paid199,paid499,mission,promo});
});