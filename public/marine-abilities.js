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
const descriptionFor=(kind,title)=>({
 dash:title+': avanço explosivo que corta uma linha de inimigos.',
 cone:title+': ataque frontal em cone com forte impacto.',
 aura:title+': campo pulsante que fere criaturas próximas.',
 multi:title+': múltiplos raios bioluminescentes atingem alvos ao redor.',
 lance:title+': descarga linear de grande alcance.',
 sweep:title+': varredura ampla em arco ao redor do corpo.',
 armor:title+': pulso defensivo que repele ameaças e reduz pressão ao redor.',
 pulse:title+': explosão radial periódica de energia.',
 chain:title+': salta entre vários alvos próximos.',
 veil:title+': véu bioluminescente explode ao redor do corpo.',
 mark:title+': marca o alvo mais próximo e detona energia concentrada.',
 trap:title+': cria uma zona persistente de dano.',
 pull:title+': campo de sucção visual seguido por dano em área.',
 grasp:title+': braços espectrais golpeiam vários inimigos.',
 rage:title+': descarga agressiva de múltiplos impactos.',
 blast:title+': detonação curta de alta intensidade.',
 spines:title+': espinhos energéticos irradiam em todas as direções.'
}[kind]||title);

const profiles=Object.create(null);
const catalog=root.AbyssalMarineSpecies||(typeof module!=='undefined'&&module.exports?require('./marine-species'):null);
for(const species of catalog?.species||[]){
 const v=Math.max(0,Math.min(9,Number(species.variant)||0)),family=species.family;
 const kind=kinds[family]?.[v]||'pulse',title=titles[family]?.[v]||species.name;
 const rarity=species.rarity||rarityForVariant(v);
 const rank=RARITY_ORDER.indexOf(rarity);
 const cooldown=Math.max(3.6,8.8-v*.38-rank*.18);
 const damage=10+v*2+rank*4;
 const radius=150+v*9+rank*14;
 profiles[species.id]=Object.freeze({
  id:'ability_'+species.art.key,title,kind,rarity,rarityRank:rank,cooldown,damage,radius,
  beams:2+(v%4),duration:.35+rank*.08,
  color:species.art?.tone||species.color,
  description:descriptionFor(kind,title)
 });
}
const api=Object.freeze({profiles:Object.freeze(profiles),RARITY_ORDER,RARITY_LABELS,profileFor:id=>profiles[id]||null});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.AbyssalMarineAbilities=api;
})(typeof globalThis!=='undefined'?globalThis:this);
