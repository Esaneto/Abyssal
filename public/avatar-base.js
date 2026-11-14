/* Shared, allowlisted cosmetic model. No attributes or equipment privileges. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.AbyssalAvatarBase=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const slots=Object.freeze({
  hair:Object.freeze([{id:'classic',name:'Original'},{id:'short',name:'Curto'},{id:'long',name:'Longo'},{id:'shaved',name:'Raspado'}]),
  hairColor:Object.freeze([{id:'black',name:'Preto',swatch:'#151b25'},{id:'brown',name:'Castanho',swatch:'#76503b'},{id:'silver',name:'Prateado',swatch:'#a8bac5'}]),
  outfit:Object.freeze([{id:'navy',name:'Abissal / MK-01',swatch:'#244660',description:'Traje pressurizado padrão, placas segmentadas e perfil equilibrado.'},{id:'rust',name:'Industrial / MK-02',swatch:'#ae643c',description:'Armadura de trabalho, proteção de juntas e bolsos técnicos.'},{id:'ice',name:'Polar / MK-03',swatch:'#a6cbd1',description:'Isolamento térmico, carapaça clara e gola reforçada.'},{id:'olive',name:'Explorador / MK-04',swatch:'#637956',description:'Neoprene flexível, colete de campo e armazenamento compacto.'}]),
  visor:Object.freeze([{id:'cyan',name:'Ciano',swatch:'#78dbe8'},{id:'amber',name:'Âmbar',swatch:'#eab36b'},{id:'violet',name:'Violeta',swatch:'#b4a3ee'}]),
  back:Object.freeze([{id:'standard',name:'Duplo padrão',swatch:'#4c8095'},{id:'titanium',name:'Titânio',swatch:'#b7c6cc'},{id:'dark',name:'Grafite',swatch:'#49515e'}]),
  fins:Object.freeze([{id:'standard',name:'Abissais',swatch:'#79b9ce'},{id:'amber',name:'Resgate',swatch:'#dba45f'},{id:'white',name:'Árticas',swatch:'#c5e4e8'}])
 });
 const DEFAULT=Object.freeze({hair:'classic',hairColor:'black',outfit:'navy',visor:'cyan',back:'standard',fins:'standard'});
 const KEY='abyssalAvatarAppearanceV1';
 function normalize(value){const out={};for(const key of Object.keys(DEFAULT)){const v=value&&value[key];out[key]=slots[key].some(item=>item.id===v)?v:DEFAULT[key];}return out;}
 function same(a,b){return Object.keys(DEFAULT).every(k=>a?.[k]===b?.[k]);}
 let current={...DEFAULT};
 try{current=normalize(JSON.parse(globalThis.localStorage?.getItem(KEY)||'null'));}catch{}
 function get(){return {...current};}
 function apply(value,{persist=true}={}){const next=normalize(value);if(same(current,next))return get();current=next;if(persist)try{globalThis.localStorage?.setItem(KEY,JSON.stringify(current));}catch{}return get();}
 function select(value,key,id){return normalize({...normalize(value),[key]:id});}
 const colors={
  outfit:{navy:null,rust:['#301b16','#69402d','#944f29','#c88455','#edb28b'],ice:['#142c37','#456675','#749da7','#b9d7da','#e3f4f2'],olive:['#18291f','#3c5038','#586e44','#8ba47c','#c0d3a8']},
  visor:{cyan:null,amber:['rgba(255,231,165,.83)','rgba(222,148,54,.66)','rgba(95,53,18,.86)','rgba(42,27,18,.93)'],violet:['rgba(232,219,255,.83)','rgba(157,117,230,.66)','rgba(57,35,103,.86)','rgba(28,22,54,.93)']},
  back:{standard:null,titanium:['#293943','#b7c6cc','#758993','#40525b','#17252e'],dark:['#11171e','#596674','#3e4752','#252e39','#111820']},
  fins:{standard:null,amber:['#30241c','#dba45f','#f4c889'],white:['#253b47','#c5e4e8','#e0faff']},
  hairColor:{black:null,brown:['#38251c','#76503b','#4d3021'],silver:['#54636d','#c4d0d6','#879ca8']}
 };
 function palette(value){const v=normalize(value);return {outfitId:v.outfit,outfit:colors.outfit[v.outfit],visor:colors.visor[v.visor],back:colors.back[v.back],fins:colors.fins[v.fins],hair:colors.hairColor[v.hairColor],hairStyle:v.hair};}
 return Object.freeze({slots,DEFAULT,normalize,same,get,apply,select,palette,KEY});
});