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
 const ATTRIBUTE_LABELS_EN=Object.freeze({
  damage:'damage',movement:'movement speed',fireRate:'fire rate',range:'range',
  defense:'damage resistance',experience:'experience gain',bossDamage:'damage against bosses',
  activeCooldown:'active ability cooldown'
 });
 const ACTIVE=Object.freeze({
  dash:{name:'Investida',nameEn:'Dash',cooldown:10,duration:.65,color:'#78eaff',damage:70,range:465,effect:'O espécime nada até 465 unidades na direção apontada em 0,65 s, imune durante a investida e envolto por um arco azul de corte da água. Obstáculos interrompem o avanço.',effectEn:'The specimen swims up to 465 units forward over 0.65 seconds, invulnerable during its dash, with a blue water-cutting arc. Walls stop the charge.'},
  cloud:{name:'Nuvem Tóxica',nameEn:'Toxic Cloud',cooldown:10,color:'#7dff73',damage:50,dotDamage:5,tickMs:500,range:300,effect:'A nuvem irregular se expande até 300 unidades, causando dano e veneno a inimigos dentro da área. Inimigos dentro dela sofrem dano e veneno por alguns segundos.',effectEn:'The irregular cloud expands to a 300-unit radius, dealing damage and temporary poison to enemies within it.'},
  trail:{name:'Rastro Abissal',nameEn:'Abyssal Trail',cooldown:10,duration:10,life:10,color:'#79dfff',damage:5,tickMs:500,range:0,effect:'Por 10 segundos, deixa um rastro enquanto se movimenta. Cada trecho dura 10 segundos e causa dano; a recarga começa ao terminar a emissão.',effectEn:'Deposits a trail while moving for 10 seconds. Each section lasts 10 seconds and damages on contact. Cooldown starts after the emission ends.'},
  push:{name:'Impacto de Pressão',nameEn:'Pressure Impact',cooldown:10,color:'#ffc978',damage:60,range:330,effect:'Pulso em área com alcance de 330 unidades: causa dano e empurra inimigos com 50% mais força que antes.',effectEn:'Area pulse with 330-unit range: deals damage and knocks enemies back 50% farther than before.'},
  poison:{name:'Veneno Concentrado',nameEn:'Concentrated Venom',cooldown:10,duration:10,color:'#b46bfa',damage:5,tickMs:500,range:175,effect:'Imbui a arma do mergulhador com veneno por 10 segundos. Disparos atingidos aplicam veneno. A recarga de 10 segundos começa ao terminar o efeito.',effectEn:'Infuses the diver weapon with poison for 10 seconds. Hits apply venom. The 10-second cooldown starts when the infusion ends.'},
  paralysis:{name:'Descarga Bioelétrica',nameEn:'Bioelectric Discharge',cooldown:10,duration:10,color:'#62edff',damage:4,range:165,effect:'Imbui a arma do mergulhador com raios por 10 segundos. Cada disparo que acerta paralisa por 0,1 segundo; a recarga de 10 segundos inicia após a duração.',effectEn:'Infuses the diver weapon with lightning for 10 seconds. Hits paralyze for 0.1 second. The 10-second cooldown begins after the infusion ends.'},
  shot:{name:'Disparo Colossal',nameEn:'Colossal Shot',cooldown:10,color:'#ff779b',damage:80,range:360,effect:'Dispara um projétil pesado na direção apontada, com alto dano em alvo único.',effectEn:'Fires a heavy projectile in the aimed direction for high single-target damage.'},
  pulse:{name:'Pulso Abissal',nameEn:'Abyssal Pulse',cooldown:10,color:'#b99cff',damage:60,range:360,effect:'Pulso circular com alcance de 360 unidades: atinge os inimigos dentro da área. Não atravessa paredes.',effectEn:'Circular pulse with 360-unit range: hits enemies within the area, but does not pass through walls.'},
  slowShot:{name:'Projétil Hipotérmico',nameEn:'Hypothermic Projectile',cooldown:10,color:'#9bd9ff',damage:7,range:320,effect:'Dispara um projétil gelado que causa dano e reduz temporariamente a velocidade do alvo.',effectEn:'Fires a chilling projectile that deals damage and temporarily slows the target.'},
  shield:{name:'Escudo de Pressão',nameEn:'Pressure Shield',cooldown:10,color:'#8ff4e8',damage:0,range:0,duration:2,effect:'Cria por 2 segundos uma única bolha translúcida em volta do mergulhador e do espécime; ambos ficam protegidos de dano.',effectEn:'For 2 seconds, one translucent bubble surrounds the diver and specimen, protecting both from damage.'}
 });
 const INK_TRAIL_SKINS=new Set(['kraken','aberration','dumbo','blanket','mimic','glassoctopus','jewelsquid','bigfin','whiplash']);
 function isInkTrailSkin(id){return INK_TRAIL_SKINS.has(String(id||''));}
 function trailColor(id){return isInkTrailSkin(id)?'#05060b':ACTIVE.trail.color;}
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
 const paid199=new Set(['violet','phantomjelly','bloodmoon','toxic','butterflyray','hawksbill','greenland']);
 const paid499=new Set(['reefshark','hammerhead','saltcroc','blackcaiman','abysscroc','armoredgator','electriceellegacy']);
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
 const PROFILE_ASSIGNMENTS=Object.freeze({
  default:['dash','damage'],
  violet:['pulse','range'],
  solar:['dash','movement'],
  toxic:['cloud','experience'],
  leviathan:['shot','bossDamage'],
  thorn:['dash','fireRate'],
  abyssking:['dash','experience'],
  royal:['dash','bossDamage'],
  glacier:['slowShot','range'],
  coral:['dash','activeCooldown'],
  bloodmoon:['cloud','movement'],
  voidwing:['cloud','fireRate'],
  abyssaleye:['cloud','range'],
  deepwarden:['cloud','defense'],
  riftSmileRelic:['shield','defense'],
  kraken:['push','bossDamage'],
  aberration:['trail','activeCooldown'],
  angler:['dash','range'],
  maw:['cloud','damage'],
  devourer:['pulse','bossDamage'],
  saltcroc:['push','damage'],
  blackcaiman:['shield','movement'],
  reefshark:['trail','movement'],
  hammerhead:['pulse','experience'],
  abysscroc:['dash','defense'],
  armoredgator:['push','defense'],
  greensnake:['poison','damage'],
  electriceel:['paralysis','fireRate'],
  electriceellegacy:['paralysis','movement'],
  eagleray:['cloud','bossDamage'],
  ribbonmoray:['cloud','activeCooldown'],
  dumbo:['trail','damage'],
  blanket:['trail','fireRate'],
  atolla:['trail','range'],
  phantomjelly:['trail','defense'],
  yeticrab:['trail','experience'],
  nautilus:['trail','bossDamage'],
  gharial:['push','movement'],
  goblin:['push','fireRate'],
  frilled:['push','range'],
  greenland:['push','experience'],
  butterflyray:['push','activeCooldown'],
  stingray:['poison','movement'],
  guitarfish:['poison','fireRate'],
  sawtootheel:['poison','range'],
  zebramoray:['poison','defense'],
  dogtootheel:['poison','experience'],
  mimic:['poison','bossDamage'],
  glassoctopus:['poison','activeCooldown'],
  combjelly:['shot','damage'],
  helmetjelly:['shot','movement'],
  siphonophore:['shot','fireRate'],
  spidercrab:['shot','range'],
  deeplobster:['shot','defense'],
  pistolshrimp:['shot','experience'],
  scalyfoot:['shot','activeCooldown'],
  bluedragon:['pulse','damage'],
  whelk:['pulse','movement'],
  leatherback:['pulse','fireRate'],
  seasnake:['pulse','defense'],
  hawksbill:['pulse','activeCooldown'],
  jewelsquid:['slowShot','damage'],
  bigfin:['slowShot','movement'],
  whiplash:['slowShot','fireRate'],
  viperfish:['slowShot','defense'],
  blackdragon:['slowShot','experience'],
  hatchetfish:['slowShot','bossDamage'],
  basketstar:['slowShot','activeCooldown'],
  crinoid:['shield','damage'],
  seapig:['shield','fireRate']
 });
 const all=[...legacy,...curated],profiles=Object.create(null);
 for(const id of all){
  const pair=PROFILE_ASSIGNMENTS[id];
  if(!pair)throw new Error('Missing locked specimen profile: '+id);
  const [active,attribute]=pair,tier=tierFor(id),percent=id==='electriceel'?TIER_PERCENT.brl999:TIER_PERCENT[tier];
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
  return Object.freeze({...base,id:p.active,cooldown,color:p.active==='trail'?trailColor(p.id):base.color,ink:p.active==='trail'&&isInkTrailSkin(p.id),skinId:p.id,percent:p.percent,attribute:p.attribute});
 }
 function describe(id,language='pt'){
  const p=profile(id),a=activeSpec(id),english=String(language).toLowerCase().startsWith('en');
  const sign=p.attribute==='defense'?'-':'+';
  const attr=english?ATTRIBUTE_LABELS_EN[p.attribute]:ATTRIBUTE_LABELS[p.attribute];
  const effect=english?(a.effectEn||a.effect):a.effect;
  const ability=english?(a.nameEn||a.name):a.name;
  const recovery=a.cooldown.toFixed(1).replace('.0','');
  const period=a.id==='trail'?(english?'10s emission, then cooldown':'10s de emissão, depois a recarga'):
   a.id==='shield'?(english?'2s protection':'2s de proteção'):
   a.id==='push'||a.id==='pulse'?(english?'Area: '+a.range+' units':'Área: '+a.range+' unidades'):'';
  if(english)return `Passive: ${sign}${p.percent}% ${attr}. Specimen Active [R]: ${ability}. ${effect} ${period?period+'. ':''}Cooldown: ${recovery}s.`;
  return `Passiva: ${sign}${p.percent}% de ${attr}. Ativa do Espécime [R]: ${ability}. ${effect} ${period?period+'. ':''}Recarga: ${recovery}s.`;
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
 return Object.freeze({TIER_PERCENT,ATTRIBUTE_LABELS,ATTRIBUTE_LABELS_EN,ACTIVE,ATTRIBUTES,ACTIVE_KEYS,PROFILE_ASSIGNMENTS,profiles,profile,passiveMultiplier,activeSpec,describe,validate,isInkTrailSkin,trailColor,bossPaid,paid199,paid499,mission,promo});
});