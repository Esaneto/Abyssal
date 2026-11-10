/* Abyssal exploration rules. One source of truth for later game/server integration.
 * Gameplay progression data is declarative, separate from combat, pricing and UI.
 * No persisted profile is changed by loading this module.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalExplorationConfig=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
 const VERSION=1;
 const MODES=Object.freeze({solo:{id:'solo',world:'openSea',party:1},online:{id:'online',world:'openSea',cooperative:true},rift:{id:'rift',world:'rift'},pvp:{id:'pvp',world:'arena',survival:false}});
 const HABITATS=Object.freeze({
  reef:{label:'Recifes de coral',minDepth:0,maxDepth:80,creatures:['reefshark','hawksbill','butterflyray'],resources:['coralSample','seaMineral']},
  kelp:{label:'Florestas de algas',minDepth:5,maxDepth:80,creatures:['leatherback','stingray','reefshark'],resources:['kelpFiber','seaMineral']},
  rocks:{label:'Regiões rochosas',minDepth:15,maxDepth:220,creatures:['zebramoray','spidercrab','nautilus'],resources:['seaMineral','salvageMetal']},
  canyon:{label:'Cânions submarinos',minDepth:120,maxDepth:950,creatures:['goblin','frilled','bigfin'],resources:['salvageMetal','deepCrystal']},
  deep:{label:'Águas profundas',minDepth:200,maxDepth:3500,creatures:['angler','viperfish','blackdragon'],resources:['deepCrystal','bioSample']},
  abyss:{label:'Regiões abissais',minDepth:3500,maxDepth:11000,creatures:['seapig','yeticrab','whiplash'],resources:['abyssCrystal','bioSample']}
 });
 const RESOURCES=Object.freeze({
  // Existing identifiers remain valid for researched technologies and old saves.
  seaMineral:{name:'Minério submarino',habitats:['reef','kelp','rocks'],kind:'ore'},
  kelpFiber:{name:'Fibra de algas',habitats:['kelp']},
  coralSample:{name:'Amostra de coral',habitats:['reef']},
  salvageMetal:{name:'Metal recuperado',habitats:['rocks','canyon'],tool:'salvageTool'},
  deepCrystal:{name:'Cristal profundo',habitats:['canyon','deep'],tool:'extractor'},
  abyssCrystal:{name:'Cristal abissal',habitats:['abyss'],tool:'extractor'},
  bioSample:{name:'Amostra biológica',habitats:['deep','abyss'],tool:'sampler'},
  // Geological Mar Aberto exploration deposits (not shooter mode).
  phosphorite:{name:'Fosforita',habitats:['rocks','canyon'],kind:'ore'},
  ferromanganeseCrust:{name:'Crosta ferromanganesífera',habitats:['rocks','canyon','deep','abyss'],kind:'ore'},
  polymetallicNodule:{name:'Nódulo polimetálico',habitats:['deep','abyss'],kind:'ore'},
  hydrothermalSulfide:{name:'Sulfeto polimetálico',habitats:['canyon','deep','abyss'],kind:'ore'},
  oilSeep:{name:'Exsudação de petróleo',habitats:['canyon','deep','abyss'],kind:'seep',filled:'oilCylinder'},
  gasSeep:{name:'Exsudação de gás natural',habitats:['canyon','deep','abyss'],kind:'seep',filled:'gasCylinder'},
  abyssWeapon:{name:'Rifle abissal',habitats:[],kind:'weapon'},
  abyssPickaxe:{name:'Picareta abissal',habitats:[],kind:'tool'},
  emptyCylinder:{name:'Cilindro vazio',habitats:[],kind:'container'},
  oilCylinder:{name:'Cilindro de petróleo',habitats:[],kind:'container'},
  gasCylinder:{name:'Cilindro de gás natural',habitats:[],kind:'container'}
 });
 // Legacy IDs are mapped without deleting owned shop data.
 const RESEARCH=Object.freeze({
  photonStarter:{id:'photonStarter',name:'Lança de Fótons',group:'starter',max:1,requires:[],cost:{},effect:'starterShot',starter:true,description:'Emissor fotônico básico. Disparo direto, sem efeito secundário.'},

  oxygenTank:{id:'oxygenTank',name:'Cilindro de autonomia',group:'equipment',max:5,requires:[],cost:{seaMineral:3},effect:'oxygenCapacity'},
  pressureSuit:{id:'pressureSuit',name:'Traje de profundidade',group:'equipment',max:5,requires:[],cost:{seaMineral:4,salvageMetal:1},effect:'depthRating'},
  salvageTool:{id:'salvageTool',name:'Ferramenta de salvamento',group:'equipment',max:1,requires:[],cost:{seaMineral:2},effect:'salvage'},
  sampler:{id:'sampler',name:'Coletor biológico',group:'equipment',max:1,requires:[],cost:{seaMineral:2},effect:'sample'},
  extractor:{id:'extractor',name:'Extrator cristalino',group:'equipment',max:1,requires:['salvageTool'],cost:{salvageMetal:3},effect:'extract'},
  sonar:{id:'sonar',name:'Sonar de exploração',group:'equipment',max:3,requires:['sampler'],cost:{salvageMetal:2,bioSample:1},effect:'detection'},
  pulse:{id:'pulse',name:'Pulso de Maré',group:'active',slot:'Q',max:1,requires:['sonar'],cost:{deepCrystal:2,bioSample:2},legacyMeta:'pulse'},
  dash:{id:'dash',name:'Passo Fantasma',group:'active',slot:'E',max:1,requires:['pressureSuit'],cost:{deepCrystal:2,salvageMetal:3},legacyMeta:'dash'},
  bulkhead:{id:'bulkhead',name:'Costelas de Basalto',group:'passive',max:3,requires:['pressureSuit'],cost:{seaMineral:4},legacyMeta:'bulkhead'},
  focuser:{id:'focuser',name:'Lente de Fótons',group:'passive',max:3,requires:['sonar'],cost:{deepCrystal:1,salvageMetal:2},legacyMeta:'focuser'},
  current:{id:'current',name:'Aletas de Corrente',group:'passive',max:3,requires:['oxygenTank'],cost:{kelpFiber:4,seaMineral:2},legacyMeta:'current'},
  startShield:{id:'startShield',name:'Casulo de Pressão',group:'passive',max:1,requires:['pressureSuit'],cost:{deepCrystal:2},legacyMeta:'startShield'},
  power:{id:'power',name:'Pulso Intenso',group:'passive',max:1,requires:['oxygenTank'],cost:{seaMineral:3,kelpFiber:1}},
  rate:{id:'rate',name:'Ressonância Veloz',group:'passive',max:1,requires:['oxygenTank'],cost:{seaMineral:4,kelpFiber:2}},
  speed:{id:'speed',name:'Propulsão Abissal',group:'passive',max:1,requires:['oxygenTank'],cost:{seaMineral:5,kelpFiber:3}},
  range:{id:'range',name:'Olho Profundo',group:'essential',max:1,requires:[],cost:{},starter:true,effect:'range',description:'Óptica essencial do traje para enxergar e combater no Mar Aberto.'},
  magnet:{id:'magnet',name:'Campo Magnético',group:'passive',max:1,requires:['oxygenTank'],cost:{seaMineral:3,kelpFiber:2}},
  regen:{id:'regen',name:'Membrana Viva',group:'essential',max:1,requires:[],cost:{},starter:true,effect:'regen',description:'Sistema biotecnológico básico de recuperação do mergulhador.'},
  shield:{id:'shield',name:'Escudo Espectral',group:'passive',max:1,requires:['oxygenTank'],cost:{seaMineral:5,kelpFiber:1}},
  shell:{id:'shell',name:'Carapaça Abissal',group:'passive',max:1,requires:['pressureSuit'],cost:{seaMineral:6,kelpFiber:2}},
  ward:{id:'ward',name:'Véu de Maré',group:'passive',max:1,requires:['pressureSuit'],cost:{seaMineral:3,kelpFiber:3}},
  lastStand:{id:'lastStand',name:'Último Fôlego',group:'passive',max:1,requires:['pressureSuit'],cost:{seaMineral:4,kelpFiber:1}},
  pressureCocoon:{id:'pressureCocoon',name:'Casulo de Pressão Ambiental',group:'passive',max:1,requires:['pressureSuit'],cost:{seaMineral:5,kelpFiber:2}},
  vitality:{id:'vitality',name:'Reserva Vital',group:'passive',max:1,requires:['pressureSuit'],cost:{seaMineral:6,kelpFiber:3}},
  predator:{id:'predator',name:'Instinto Predatório',group:'passive',max:1,requires:['pressureSuit'],cost:{seaMineral:3,kelpFiber:1}},
  closePressure:{id:'closePressure',name:'Pressão de Caça',group:'passive',max:1,requires:['pressureSuit'],cost:{seaMineral:4,kelpFiber:2}},
  burst:{id:'burst',name:'Pulso de Ruptura',group:'passive',max:1,requires:['sonar'],cost:{seaMineral:5,deepCrystal:3}},
  ricochet:{id:'ricochet',name:'Ricochete Caótico',group:'passive',max:1,requires:['sonar'],cost:{seaMineral:6,deepCrystal:1}},
  spread:{id:'spread',name:'Rajada Prismática',group:'passive',max:1,requires:['sonar'],cost:{seaMineral:3,deepCrystal:2}},
  pierce:{id:'pierce',name:'Lança do Abismo',group:'shot',max:1,requires:['sonar'],cost:{seaMineral:4,deepCrystal:3}},
  photon:{id:'photon',name:'Lança de Fótons',group:'shot',max:1,requires:['sonar'],cost:{seaMineral:5,deepCrystal:1}},
  photonRay:{id:'photonRay',name:'Raio de Fótons',group:'shot',max:1,requires:['sonar'],cost:{seaMineral:6,deepCrystal:2}},
  nova:{id:'nova',name:'Nova Gravitacional',group:'shot',max:1,requires:['sonar'],cost:{seaMineral:3,deepCrystal:3}},
  echoShot:{id:'echoShot',name:'Eco de Maré',group:'shot',max:1,requires:['sonar'],cost:{seaMineral:4,deepCrystal:1}}
 });
 function depthAt(y,worldHeight=3000,maximumMeters=100){
  return clamp(y,0,Math.max(1,worldHeight))/Math.max(1,worldHeight)*maximumMeters;
 }
 function pressureAt(depthMeters){return 1+Math.max(0,Number(depthMeters)||0)/10;}
 // Gas usage rises with ambient pressure. This is a gameplay budget, not a
 // decompression simulation or a claim that ordinary wetsuits withstand pressure.
 function gasConsumption(depthMeters,exertion=1){return pressureAt(depthMeters)*clamp(exertion,.5,2);}
 function oxygenCapacity(level=0){return 900*(1+clamp(Math.floor(level),0,5)*.22);}
 function safeDepth(level=0){return 300+clamp(Math.floor(level),0,5)*180;}
 // Pressure danger scales above suit rating and outpaces natural health regeneration.
 function pressureDamage(depthMeters,limitMeters){const excess=Math.max(0,(Number(depthMeters)||0)-(Number(limitMeters)||0));return Math.min(160,3*Math.pow(excess/10,1.55));}
 function oxygenDamage(secondsWithoutGas){const seconds=Math.max(0,Number(secondsWithoutGas)||0);return seconds>0?Math.min(160,9+3*seconds):0;}
 function environmentDamage(depthMeters,limitMeters,secondsWithoutGas=0){return pressureDamage(depthMeters,limitMeters)+oxygenDamage(secondsWithoutGas);}
 function canResearch(id,levels={},inventory={}){
  const item=RESEARCH[id];if(!item)return {ok:false,reason:'unknown-research'};
  if((Number(levels[id])||0)>=item.max)return {ok:false,reason:'max-level'};
  if(item.requires.some(prerequisite=>(Number(levels[prerequisite])||0)<1))return {ok:false,reason:'prerequisite'};
  if(Object.entries(item.cost).some(([resource,cost])=>(Number(inventory[resource])||0)<cost))return {ok:false,reason:'resources'};
  return {ok:true};
 }
 function habitatFor(depthMeters){
  const depth=Math.max(0,Number(depthMeters)||0);
  return Object.entries(HABITATS).filter(([,h])=>depth>=h.minDepth&&depth<=h.maxDepth).map(([id])=>id);
 }
 const STARTER_RESEARCH=Object.freeze(['photonStarter','range','regen']);
 return Object.freeze({VERSION,MODES,HABITATS,RESOURCES,RESEARCH,STARTER_RESEARCH,depthAt,pressureAt,gasConsumption,oxygenCapacity,safeDepth,pressureDamage,oxygenDamage,environmentDamage,canResearch,habitatFor});
});
