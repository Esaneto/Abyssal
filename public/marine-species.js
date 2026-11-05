(function(root){
 'use strict';
 // Prices are integer centavos for paid species, integer abyssal coins otherwise.
 const families=[
 ['shark','Caça hidrodinâmica','damage',[
 'Tubarão-azul','Tubarão-tigre','Tubarão-baleia','Tubarão-peregrino','Tubarão-mako','Tubarão-raposa','Tubarão-duende','Tubarão-cobra','Tubarão-lanterna','Tubarão-da-Groenlândia']],
 ['ray','Nado com nadadeiras peitorais','movement',[
 'Jamanta-gigante','Jamanta-de-recife','Raia-chita','Raia-águia','Raia-borboleta','Raia-de-pregos','Raia-viola','Raia-redonda','Raia-de-seis-guelras','Raia-do-Ártico']],
 ['eel','Investida serpentiforme','fireRate',[
 'Moreia-zebra','Moreia-leopardo','Moreia-fita','Moreia-dragão','Enguia-de-jardim','Congro-europeu','Enguia-pelicano','Enguia-serra','Enguia-de-nariz-fino','Enguia-de-boca-larga']],
 ['squid','Propulsão a jato','movement',[
 'Lula-de-recife','Lula-luminescente','Lula-de-Humboldt','Lula-diamante','Lula-cockatoo','Lula-morango','Lula-vampira','Lula-de-braços-longos','Lula-gigante','Lula-colossal']],
 ['octopus','Camuflagem defensiva','defense',[
 'Polvo-comum','Polvo-mímico','Polvo-coco','Polvo-de-anéis-azuis','Polvo-cobertor','Polvo-de-vidro','Polvo-dumbo','Polvo-grimpoteuthis','Polvo-de-sete-braços','Polvo-gigante-do-Pacífico']],
 ['jelly','Rede de filamentos','magnet',[
 'Água-viva-da-lua','Medusa-bússola','Medusa-ovo-frito','Medusa-juba-de-leão','Medusa-de-cristal','Medusa-atolla','Medusa-periphylla','Medusa-fantasma-gigante','Medusa-de-fogos','Medusa-de-capuz']],
 ['crustacean','Exoesqueleto protetor','defense',[
 'Lagosta-espinhosa','Lagosta-americana','Camarão-limpador','Camarão-pistola','Camarão-mantis','Caranguejo-aranha-japonês','Caranguejo-yeti','Isópode-gigante','Anfípode-hadal','Camarão-de-fontes-hidrotermais']],
 ['fish','Percepção da linha lateral','range',[
 'Peixe-leão','Peixe-lua','Peixe-napoleão','Peixe-mandarim','Peixe-machado','Peixe-dragão-negro','Peixe-víbora','Peixe-ogro','Peixe-caracol-das-Marianas','Peixe-tripé']],
 ['benthic','Aproveitamento de detritos','experience',[
 'Pepino-do-mar-leopardo','Porco-do-mar','Holotúria-nadadora','Estrela-cesto','Estrela-serpente','Estrela-do-mar-coroa','Ouriço-diademado','Ouriço-lápis','Lírio-do-mar','Esponja-harpa']],
 ['mollusc','Proteção do manto','defense',[
 'Náutilo-comum','Argonauta','Sépia-comum','Sépia-flamejante','Coelho-do-mar','Dragão-azul','Anjo-do-mar','Borboleta-do-mar','Caracol-de-pé-escamoso','Quitão-gigante']]
 ];
 const labels={damage:'dano',movement:'velocidade',fireRate:'cadência',defense:'redução de dano',magnet:'alcance de coleta',range:'alcance de aquisição',experience:'experiência'};
 const visualProfiles={
  shark:[
   ['blue-sickle','#4ea9d9'],['tiger-bars','#c58a43'],['whale-checker','#5ea7b7'],['basking-gape','#9a8257'],['mako-spear','#4c83d1'],['thresher-whip','#8b6fc7'],['goblin-rostrum','#c06f82'],['frilled-serpent','#78608f'],['lantern-photophore','#46c7ac'],['greenland-heavy','#718c98']
  ],
  ray:[
   ['manta-cephalic','#5c92cb'],['reef-manta','#68b5b2'],['spotted-eagle','#c49c4f'],['eagle-snout','#7f75c4'],['butterfly-disc','#c96f8d'],['thornback-spines','#967358'],['guitarfish-hybrid','#5f9f86'],['round-disc','#b67a98'],['sixgill-deep','#596eab'],['arctic-pale','#89b9c8']
  ],
  eel:[
   ['zebra-bars','#d1b477'],['leopard-spots','#b17a55'],['ribbon-crests','#7b6ee4'],['dragon-jaw','#c94c59'],['garden-thread','#79b88c'],['conger-heavy','#677a8d'],['pelican-gape','#9b68bb'],['saw-rostrum','#d27955'],['snipe-snout','#75a8b3'],['gulper-mouth','#8f5d92']
  ],
  squid:[
   ['reef-arrow','#53a9d8'],['luminous-stars','#53d6d0'],['humboldt-heavy','#c64f4f'],['diamond-fin','#9f80da'],['cockatoo-glass','#7fc3bf'],['strawberry-eyes','#d55f94'],['vampire-cloak','#8b395f'],['longarm-spider','#667bc6'],['giant-lance','#c27055'],['colossal-hooks','#8d3948']
  ],
  octopus:[
   ['common-bulb','#ba6b54'],['mimic-stripes','#c88b4f'],['coconut-shell','#a87554'],['blue-rings','#3fc7e4'],['blanket-web','#a449b7'],['glass-core','#76c9d8'],['dumbo-ears','#c08db8'],['grimpoteuthis-bell','#8b79c8'],['sevenarm-asymmetry','#9b6676'],['pacific-giant','#9b4b3f']
  ],
  jelly:[
   ['moon-fourcore','#70d7de'],['compass-radial','#d4717b'],['friedegg-yolk','#e1ae43'],['lionmane-crown','#bb5a4e'],['crystal-glass','#75dce8'],['atolla-redring','#cc4259'],['periphylla-cone','#9954a7'],['phantom-giant','#6a5898'],['fireworks-branches','#4dc0d4'],['hood-cap','#a073bd']
  ],
  crustacean:[
   ['spiny-lobster','#c67245'],['american-claws','#a8463f'],['cleaner-antennae','#d87389'],['pistol-claw','#c88b58'],['mantis-hammer','#68b875'],['spider-legs','#96765f'],['yeti-fur','#d7d3b9'],['isopod-plates','#6e7c91'],['hadal-amphipod','#8a5eaa'],['vent-shrimp','#b6b0a3']
  ],
  fish:[
   ['lion-spines','#d45e48'],['sun-disc','#aeb3b0'],['napoleon-brow','#5d9e78'],['mandarin-pattern','#4f88c8'],['hatchet-blade','#6b93aa'],['dragon-black','#3e4d70'],['viper-fangs','#7d4f89'],['fangtooth-head','#8c5d52'],['snailfish-soft','#83b8ba'],['tripod-stilts','#a28768']
  ],
  benthic:[
   ['leopard-cucumber','#9c7657'],['sea-pig-legs','#b57991'],['swimming-holothurian','#6e9eb0'],['basket-arms','#9270a8'],['brittle-star','#b47a65'],['crown-star','#bd5444'],['diadema-spines','#614f83'],['pencil-urchin','#a56d49'],['crinoid-feather','#6d9c77'],['harp-sponge','#78a7b0']
  ],
  mollusc:[
   ['nautilus-spiral','#b89d72'],['argonaut-shell','#c9a5a0'],['cuttle-ribbed','#7f9f8d'],['flamboyant-warning','#dc6550'],['sea-bunny-ears','#d6c7ba'],['blue-dragon-wings','#4b91d0'],['sea-angel-wings','#83c6d6'],['sea-butterfly-wings','#768ec7'],['scalyfoot-armor','#6d6760'],['giant-chiton-plates','#8b6d56']
  ]
 };
 const clamp255=n=>Math.max(0,Math.min(255,Math.round(n)));
 const hexToRgb=hex=>{const n=parseInt(String(hex).replace('#',''),16);return [(n>>16)&255,(n>>8)&255,n&255];};
 const rgbToHex=rgb=>'#'+rgb.map(v=>clamp255(v).toString(16).padStart(2,'0')).join('');
 const mix=(a,b,t)=>{const A=hexToRgb(a),B=hexToRgb(b);return rgbToHex(A.map((v,i)=>v+(B[i]-v)*t));};
 const rotate=(hex,seed)=>{const [r,g,b]=hexToRgb(hex),mode=((seed%3)+3)%3;return rgbToHex(mode===0?[g,b,r]:mode===1?[b,r,g]:[r,b,g]);};
 const makeArtPalette=(tone,seed)=>Object.freeze({
  base:mix(tone,'#09111a',.12),
  shadow:mix(tone,'#02050a',.68),
  rim:mix(tone,'#ffffff',.42),
  glow:mix(tone,'#ffffff',.2),
  accent:mix(rotate(tone,seed),'#ffffff',.08),
  eye:seed%3===0?'#fff4d7':seed%3===1?'#dffff8':'#ffd8ee'
 });
 const palette=['#739ba6','#b39b78','#9c8aa3','#b17665','#7b9c87','#6f8fb5','#9b7f9e','#8ca36f','#b58d72','#6f9f9a'];
 const species=families.flatMap(([family,trait,stat,names],f)=>names.map((name,i)=>{
  const id='marine_'+family+'_'+(i+1),paid=i>=8,bonus=(paid?24:8)+i;
  return Object.freeze({id,name,family,variant:i,stat,bonus,paid,brl:paid?990+(i-8)*500:0,coins:1500+f*350+i*1250,price:paid?990+(i-8)*500:1500+f*350+i*1250,color:visualProfiles[family][i][1],art:Object.freeze({key:visualProfiles[family][i][0],tone:visualProfiles[family][i][1],palette:makeArtPalette(visualProfiles[family][i][1],f*10+i)}),shape:family,desc:name+' · '+trait+'. Interpretação estilizada de fauna marinha.',ability:trait+': '+bonus+'% '+(stat==='defense'?'menos dano recebido':'mais '+labels[stat])+'.',tier:paid?'abyssal':'surface'});
 }));
 const byId=Object.freeze(Object.fromEntries(species.map(s=>[s.id,s])));
 const api=Object.freeze({species:Object.freeze(species),byId});
 if(typeof module!=='undefined')module.exports=api;
 root.AbyssalMarineSpecies=api;
})(typeof globalThis!=='undefined'?globalThis:this);
