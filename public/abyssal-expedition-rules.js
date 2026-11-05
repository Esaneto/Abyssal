(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AbyssalExpeditionRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const COMMON_KINDS=Object.freeze(['drifter','stinger','brute','lurker','whiteShark']);

  const ZONES=Object.freeze([
    Object.freeze({
      id:'twilight',minBosses:0,name:'LIMIAR DA LUZ',shortName:'LIMIAR',
      subtitle:'A última zona em que o oceano ainda lembra a superfície.',
      accent:'#78e8e4',eliteChance:.02,
      weights:Object.freeze({drifter:.46,stinger:.20,brute:.12,lurker:.10,whiteShark:.12})
    }),
    Object.freeze({
      id:'mesopelagic',minBosses:1,name:'ZONA MESOPELÁGICA',shortName:'MESOPELÁGICA',
      subtitle:'A luz desaparece. O movimento abaixo de você não.',
      accent:'#73bfff',eliteChance:.045,
      weights:Object.freeze({drifter:.28,stinger:.32,brute:.18,lurker:.19,whiteShark:.03})
    }),
    Object.freeze({
      id:'midnight',minBosses:3,name:'ZONA DA MEIA-NOITE',shortName:'MEIA-NOITE',
      subtitle:'Predadores maiores começam a seguir o seu sinal.',
      accent:'#9d79ff',eliteChance:.075,
      weights:Object.freeze({drifter:.20,stinger:.31,brute:.24,lurker:.24,whiteShark:.01})
    }),
    Object.freeze({
      id:'hadal',minBosses:5,name:'FENDA HADAL',shortName:'HADAL',
      subtitle:'A pressão muda a anatomia de tudo que continua vivo.',
      accent:'#d165ff',eliteChance:.11,
      weights:Object.freeze({drifter:.12,stinger:.25,brute:.32,lurker:.31,whiteShark:0})
    }),
    Object.freeze({
      id:'unknown',minBosses:7,name:'SETOR INSONDÁVEL',shortName:'INSONDÁVEL',
      subtitle:'Nenhuma expedição deveria registrar atividade abaixo daqui.',
      accent:'#ff5c84',eliteChance:.145,
      weights:Object.freeze({drifter:.08,stinger:.22,brute:.34,lurker:.36,whiteShark:0})
    })
  ]);

  const ELITES=Object.freeze({
    carapace:Object.freeze({
      id:'carapace',name:'CARAPAÇA NEGRA',shortName:'CARAPAÇA',
      accent:'#9ed9d2',hp:1.78,damage:1.14,speed:.90,value:2.0,radius:1.08
    }),
    frenzy:Object.freeze({
      id:'frenzy',name:'FOME RUBRA',shortName:'RUBRA',
      accent:'#ff647e',hp:1.28,damage:1.42,speed:1.22,value:1.9,radius:1.03
    }),
    spectral:Object.freeze({
      id:'spectral',name:'ECO ESPECTRAL',shortName:'ESPECTRAL',
      accent:'#b995ff',hp:1.42,damage:1.22,speed:1.08,value:2.25,radius:1.05
    })
  });

  const EVENTS=Object.freeze({
    predator_migration:Object.freeze({
      id:'predator_migration',name:'MIGRAÇÃO DE PREDADORES',
      subtitle:'O sonar detectou uma coluna de caça atravessando a sua rota.',
      accent:'#ff718b',duration:22,eliteBonus:.02,spawnIntervalMultiplier:.80,xpMultiplier:1.12
    }),
    black_current:Object.freeze({
      id:'black_current',name:'CORRENTE NEGRA',
      subtitle:'A água perdeu o brilho. Organismos anômalos estão emergindo no escuro.',
      accent:'#aa83ff',duration:20,eliteBonus:.085,spawnIntervalMultiplier:.94,xpMultiplier:1.08
    }),
    resonance_bloom:Object.freeze({
      id:'resonance_bloom',name:'FLORESCÊNCIA DE RESSONÂNCIA',
      subtitle:'O fundo está devolvendo energia. Tudo ficou mais valioso e mais agressivo.',
      accent:'#62f5dc',duration:18,eliteBonus:.035,spawnIntervalMultiplier:.86,xpMultiplier:1.35
    })
  });

  function normalizeBosses(value){
    return Math.max(0,Math.floor(Number(value)||0));
  }

  function depthForBosses(value){
    return 350+normalizeBosses(value)*650;
  }

  function zoneForBosses(value){
    const bosses=normalizeBosses(value);
    let zone=ZONES[0];
    for(const candidate of ZONES){
      if(bosses>=candidate.minBosses)zone=candidate;
      else break;
    }
    return zone;
  }

  function eventConfig(id){
    return EVENTS[String(id||'')]||null;
  }

  function eliteConfig(id){
    return ELITES[String(id||'')]||null;
  }

  function commonWeights(bosses,eventId){
    const zone=zoneForBosses(bosses);
    const weights={...zone.weights};
    if(eventId==='predator_migration'){
      // A pelagic migration can force a rare surface predator deeper than normal, but
      // white sharks never become the default hadal fauna.
      const sharkIncursion=zone.id==='twilight'?.24:zone.id==='mesopelagic'?.10:zone.id==='midnight'?.045:.02;
      weights.whiteShark=Math.max(weights.whiteShark*2.2,sharkIncursion);weights.stinger*=1.25;weights.drifter*=.55;
    }else if(eventId==='black_current'){
      weights.lurker*=1.85;weights.brute*=1.45;weights.drifter*=.72;
    }else if(eventId==='resonance_bloom'){
      weights.stinger*=1.18;weights.brute*=1.12;
    }
    return weights;
  }

  function chooseCommonKind(random=Math.random,bosses=0,eventId=null){
    const weights=commonWeights(bosses,eventId);
    let total=0;
    for(const kind of COMMON_KINDS)total+=Math.max(0,Number(weights[kind])||0);
    if(total<=0)return 'drifter';
    let roll=clamp(Number(random())||0,0,.999999999)*total;
    for(const kind of COMMON_KINDS){
      roll-=Math.max(0,Number(weights[kind])||0);
      if(roll<0)return kind;
    }
    return COMMON_KINDS[COMMON_KINDS.length-1];
  }

  function eliteChance(bosses=0,eventId=null){
    const zone=zoneForBosses(bosses);
    const event=eventConfig(eventId);
    return clamp(zone.eliteChance+(event?.eliteBonus||0),0,.24);
  }

  function chooseElite(random=Math.random,bosses=0,eventId=null,kind='drifter'){
    if(!COMMON_KINDS.includes(String(kind)))return null;
    if((Number(random())||0)>=eliteChance(bosses,eventId))return null;
    const zone=zoneForBosses(bosses);
    const roll=clamp(Number(random())||0,0,.999999999);
    if(eventId==='black_current')return roll<.46?'spectral':roll<.73?'carapace':'frenzy';
    if(eventId==='predator_migration')return roll<.52?'frenzy':roll<.78?'carapace':'spectral';
    if(zone.id==='hadal'||zone.id==='unknown')return roll<.38?'carapace':roll<.70?'spectral':'frenzy';
    return roll<.42?'carapace':roll<.72?'frenzy':'spectral';
  }

  function applyEliteStats(stats,eliteId){
    const elite=eliteConfig(eliteId);
    if(!elite||!stats)return {...(stats||{})};
    return {
      ...stats,
      r:Math.max(1,(Number(stats.r)||1)*elite.radius),
      hp:Math.max(1,Math.round((Number(stats.hp)||1)*elite.hp)),
      speed:Math.max(1,(Number(stats.speed)||1)*elite.speed),
      damage:Math.max(1,Math.round((Number(stats.damage)||1)*elite.damage)),
      value:Math.max(1,Math.round((Number(stats.value)||1)*elite.value))
    };
  }

  function chooseEvent(random=Math.random,bosses=0){
    const count=normalizeBosses(bosses);
    if(count<1)return null;
    const zone=zoneForBosses(count);
    const zoneIndex=Math.max(0,ZONES.findIndex(item=>item.id===zone.id));
    const chance=clamp(.50+zoneIndex*.055,0,.72);
    if((Number(random())||0)>=chance)return null;
    const roll=clamp(Number(random())||0,0,.999999999);
    if(zone.id==='twilight'||zone.id==='mesopelagic'){
      return roll<.45?'predator_migration':roll<.72?'resonance_bloom':'black_current';
    }
    if(zone.id==='midnight'){
      return roll<.34?'predator_migration':roll<.66?'black_current':'resonance_bloom';
    }
    return roll<.42?'black_current':roll<.72?'predator_migration':'resonance_bloom';
  }

  function eventSpawnIntervalMultiplier(id){
    return eventConfig(id)?.spawnIntervalMultiplier||1;
  }

  function eventXpMultiplier(id){
    return eventConfig(id)?.xpMultiplier||1;
  }

  return Object.freeze({
    ZONES,ELITES,EVENTS,COMMON_KINDS,
    depthForBosses,zoneForBosses,eventConfig,eliteConfig,
    commonWeights,chooseCommonKind,eliteChance,chooseElite,applyEliteStats,
    chooseEvent,eventSpawnIntervalMultiplier,eventXpMultiplier
  });
});
