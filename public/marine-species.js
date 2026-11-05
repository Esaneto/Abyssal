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
 const palette=['#739ba6','#b39b78','#9c8aa3','#b17665','#7b9c87','#6f8fb5','#9b7f9e','#8ca36f','#b58d72','#6f9f9a'];
 const species=families.flatMap(([family,trait,stat,names],f)=>names.map((name,i)=>{
  const id='marine_'+family+'_'+(i+1),paid=i>=8,bonus=(paid?24:8)+i;
  return Object.freeze({id,name,family,variant:i,stat,bonus,paid,brl:paid?990+(i-8)*500:0,coins:1500+f*350+i*1250,price:paid?990+(i-8)*500:1500+f*350+i*1250,color:palette[(f*3+i)%palette.length],shape:family,desc:name+' · '+trait+'. Interpretação estilizada de fauna marinha.',ability:trait+': '+bonus+'% '+(stat==='defense'?'menos dano recebido':'mais '+labels[stat])+'.',tier:paid?'abyssal':'surface'});
 }));
 const byId=Object.freeze(Object.fromEntries(species.map(s=>[s.id,s])));
 const api=Object.freeze({species:Object.freeze(species),byId});
 if(typeof module!=='undefined')module.exports=api;
 root.AbyssalMarineSpecies=api;
})(typeof globalThis!=='undefined'?globalThis:this);
