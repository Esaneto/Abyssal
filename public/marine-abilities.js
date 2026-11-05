(function(root){
'use strict';
const RARITY_ORDER=Object.freeze(['common','uncommon','rare','epic','legendary','mythic']);
const RARITY_LABELS=Object.freeze({common:'COMUM',uncommon:'INCOMUM',rare:'RARO',epic:'ÉPICO',legendary:'LENDÁRIO',mythic:'MÍTICO'});
const rarityForVariant=v=>v<=1?'common':v<=3?'uncommon':v<=5?'rare':v<=6?'epic':v<=7?'legendary':'mythic';

const titles={
 shark:['Corte Pelágico','Emboscada Listrada','Maré-Filtro','Garganta de Plâncton','Lança Mako','Foice Caudal','Rostro Fantasma','Serpente Fóssil','Lanterna Ventral','Muralha Ártica'],
 ray:['Asas de Pressão','Voo de Recife','Chuva de Pintas','Arco de Águia','Disco Borboleta','Manto Espinhoso','Investida Viola','Pulso Circular','Fenda de Seis Guelras','Véu Ártico'],
 eel:['Mordida Zebra','Caça Pintada','Fita Cortante','Mandíbula Dragão','Agulha de Jardim','Carga do Congro','Boca Abissal','Serra de Fenda','Estocada de Nariz','Garganta Negra'],
 squid:['Jato de Recife','Constelação Viva','Fúria de Humboldt','Diamante de Pressão','Sino de Vidro','Olhos de Morango','Capa Vampira','Braços do Vazio','Lança Gigante','Ganchos Colossais'],
 octopus:['Nuvem Comum','Mimetismo Predador','Armadilha de Coco','Anéis Neurotóxicos','Manto-Cobertor','Núcleo de Vidro','Orelhas de Dumbo','Sino Grimpoteuthis','Sétimo Braço','Abraço do Pacífico'],
 jelly:['Maré Lunar','Rosa dos Ventos','Núcleo Solar','Juba Incandescente','Cristal Vivo','Anel Atolla','Cone Periphylla','Fantasma Gigante','Fogos Abissais','Capuz de Pressão'],
 crustacean:['Lança Espinhosa','Pinça Americana','Antenas Limpadoras','Estalo Pistola','Martelo Mantis','Passos-Aranha','Braços Yeti','Placas Isópodes','Salto Hadal','Pulso Hidrotermal'],
 fish:['Coroa Leão','Disco Solar','Testa de Napoleão','Mandala Mandarim','Lâmina Machado','Dragão Negro','Presas Víbora','Mandíbula Ogro','Corpo de Gel','Tripé Hadal'],
 benthic:['Pele Leopardo','Passos do Porco','Nado Holotúrio','Cesto de Fendas','Braços Serpente','Coroa Estelar','Agulhas Diadema','Lápis de Pedra','Leque Crinoide','Harpa Abissal'],
 mollusc:['Espiral Náutilo','Escudo Argonauta','Pulso de Sépia','Chama Cromática','Orelhas de Mar','Asas do Dragão Azul','Ascensão Angelical','Borboleta Abissal','Armadura Escamosa','Placas do Quitão']
};
const kinds={
 shark:['dash','cone','aura','cone','dash','sweep','lance','chain','pulse','armor'],
 ray:['pulse','dash','multi','lance','pulse','spines','dash','pulse','chain','armor'],
 eel:['cone','chain','dash','cone','lance','dash','pull','sweep','lance','pull'],
 squid:['dash','multi','rage','pulse','veil','mark','veil','multi','lance','sweep'],
 octopus:['veil','mark','trap','pulse','veil','armor','dash','pulse','grasp','grasp'],
 jelly:['pulse','multi','pulse','spines','veil','pulse','lance','aura','multi','armor'],
 crustacean:['spines','armor','aura','blast','sweep','dash','armor','armor','dash','pulse'],
 fish:['spines','pulse','armor','multi','lance','mark','cone','cone','veil','lance'],
 benthic:['aura','dash','veil','multi','sweep','spines','spines','spines','multi','trap'],
 mollusc:['armor','veil','pulse','rage','dash','multi','dash','multi','armor','armor']
};
const descriptionFor=(kind,title,damage,radius,cooldown,beams)=>({
 dash:`${title}: avança até ${radius}px e causa ${damage} de dano aos inimigos atravessados. Recarga ${cooldown}s.`,
 cone:`${title}: golpeia um cone frontal de ${radius}px por ${damage} de dano. Recarga ${cooldown}s.`,
 aura:`${title}: libera um campo de ${radius}px que causa ${damage} de dano ao redor. Recarga ${cooldown}s.`,
 multi:`${title}: dispara ${beams} feixes contra alvos próximos, até ${damage} de dano por acerto inicial. Recarga ${cooldown}s.`,
 lance:`${title}: perfura uma linha de até ${radius}px causando ${damage} de dano. Recarga ${cooldown}s.`,
 sweep:`${title}: varre o entorno em arco e causa ${damage} de dano em até ${radius}px. Recarga ${cooldown}s.`,
 armor:`${title}: rompe a pressão ao redor em ${radius}px e causa ${damage} de dano às ameaças próximas. Recarga ${cooldown}s.`,
 pulse:`${title}: detona uma onda radial de ${radius}px causando ${damage} de dano. Recarga ${cooldown}s.`,
 chain:`${title}: salta por até ${beams} alvos próximos, começando com ${damage} de dano. Recarga ${cooldown}s.`,
 veil:`${title}: abre um véu bioluminescente de ${radius}px e causa ${damage} de dano em área. Recarga ${cooldown}s.`,
 mark:`${title}: marca o alvo mais próximo e detona ${damage} de dano a até ${radius}px. Recarga ${cooldown}s.`,
 trap:`${title}: cria uma zona de ${radius}px que causa ${damage} de dano e mantém pressão no local. Recarga ${cooldown}s.`,
 pull:`${title}: puxa a ameaça para um campo de ${radius}px e causa ${damage} de dano. Recarga ${cooldown}s.`,
 grasp:`${title}: projeta ${beams} braços contra inimigos próximos, causando ${damage} de dano no primeiro impacto. Recarga ${cooldown}s.`,
 rage:`${title}: descarrega até ${Math.max(4,beams+2)} impactos ao redor, com ${damage} de dano-base. Recarga ${cooldown}s.`,
 blast:`${title}: explode em curto alcance por ${damage} de dano dentro de ${radius}px. Recarga ${cooldown}s.`,
 spines:`${title}: lança espinhos em todas as direções e causa ${damage} de dano em até ${radius}px. Recarga ${cooldown}s.`
}[kind]||title);

const profiles=Object.create(null);
const catalog=root.AbyssalMarineSpecies||(typeof module!=='undefined'&&module.exports?require('./marine-species'):null);
for(const species of catalog?.species||[]){
 const v=Math.max(0,Math.min(9,Number(species.variant)||0)),family=species.family;
 const kind=kinds[family]?.[v]||'pulse',title=titles[family]?.[v]||species.name;
 const rarity=species.rarity||rarityForVariant(v);
 const rank=RARITY_ORDER.indexOf(rarity),paid=Boolean(species.paid);
 const cooldown=Number(Math.max(3.2,8.6-v*.42-rank*.28-(paid?0.35:0)).toFixed(1));
 const damage=Math.round(12+v*3.1+rank*6.5+(paid?8:0));
 const radius=Math.round(155+v*11+rank*20+(paid?18:0));
 const beams=2+(v%3)+Math.floor(Math.max(0,rank)/2)+(paid?1:0);
 const powerScore=Math.round((damage*1.9)+(radius*.16)+(beams*7)+(10-cooldown)*10);
 profiles[species.id]=Object.freeze({
  id:'ability_'+species.art.key,title,kind,rarity,rarityRank:rank,cooldown,damage,radius,powerScore,paid,
  beams,duration:.42+rank*.1+(paid?0.12:0),
  color:species.art?.tone||species.color,
  description:descriptionFor(kind,title,damage,radius,cooldown,beams)
 });
}
const api=Object.freeze({profiles:Object.freeze(profiles),RARITY_ORDER,RARITY_LABELS,profileFor:id=>profiles[id]||null});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.AbyssalMarineAbilities=api;
})(typeof globalThis!=='undefined'?globalThis:this);
