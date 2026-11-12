/* Illustrated field-guide diagrams. All shapes are original in-game SVG artwork. */
(function(root){
'use strict';
let diagramId=0;
const base=(inner,desc)=>'<svg class="abyssal-guide-diagram-svg" viewBox="0 0 144 98" role="img" aria-label="'+desc+'" xmlns="http://www.w3.org/2000/svg">'+
 '<defs><radialGradient id="glow" cx=".5" cy=".45" r=".66"><stop stop-color="#17495a"/><stop offset="1" stop-color="#071b2b"/></radialGradient><linearGradient id="metal" x2="1" y2="1"><stop stop-color="#72818d"/><stop offset="1" stop-color="#1b2c3c"/></linearGradient></defs>'+
 '<rect x="1" y="1" width="142" height="96" rx="12" fill="url(#glow)" stroke="#42717b" stroke-opacity=".55"/>'+
 '<path d="M2 83Q24 75 47 86T101 83T142 84" stroke="#1e5866" opacity=".35" fill="none"/>'+inner+'</svg>';
const line=(d,color='#b7e8f4',w=3,extra='')=>'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round" '+extra+'/>';
const dot=(x,y,r,col)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+col+'"/>';
const diver=(x,y,col='#8bf6ef')=>'<g transform="translate('+x+' '+y+')"><rect x="-17" y="-8" width="9" height="25" rx="4" fill="#65798a" stroke="'+col+'"/><path d="M-9 1Q1 -5 9 4L12 20L1 23L-7 13Z" fill="#253b50" stroke="'+col+'" stroke-width="2"/><circle cy="-10" r="11" fill="#20364b" stroke="'+col+'" stroke-width="2"/><path d="M0 -15H8L10 -8H0Z" fill="'+col+'"/><path d="M7 5L19 12L29 10M1 22L-8 31L-19 29M8 22L18 29L26 24" fill="none" stroke="'+col+'" stroke-width="4" stroke-linecap="round"/><path d="M-19 29L-27 34M26 24L32 28" stroke="#9ab4c6" stroke-width="6" stroke-linecap="round"/><circle cx="13" cy="-22" r="2" fill="#bdefff"/></g>';
const rock='<path d="M4 95L4 38L16 20L41 27L50 53L40 75L49 96Z" fill="url(#metal)" stroke="#6e828b" stroke-width="2"/>';
const symbols={
 move:()=>diver(47,48)+line('M65 45H122M111 35L123 45L111 55','#9ee4c6',4)+line('M45 23V8M37 16L45 8L53 16','#72cfdd',2),
 combat:()=>diver(36,50)+dot(105,45,13,'#b65d74')+dot(108,41,3,'#ffe9c6')+line('M54 49L85 45','#e1f6f5',4)+dot(68,46,4,'#e8fff8')+dot(85,45,4,'#d2f9e6')+dot(105,75,6,'#b789ff'),
 progress:()=>line('M26 71H117','#234658',14)+line('M26 71H93','#f3b76c',9)+dot(31,44,12,'#6079a9')+dot(100,45,19,'#7e3da6')+dot(108,40,5,'#fdc5ff')+line('M35 20H113','#a1e4ff',2),
 energy:()=>'<path d="M72 12L43 52H65L57 85L101 39H77L87 12Z" fill="#b899ff" stroke="#e7dcff" stroke-width="2"/>'+dot(28,27,5,'#a879f7')+dot(117,70,7,'#a879f7'),
 bonus:()=>'<g fill="#d7c4ff" font-size="15" font-weight="bold" text-anchor="middle"><text x="72" y="35">60% + 10%</text><text x="72" y="70" font-size="24">70%</text></g>'+line('M24 46H120','#9c74ef',2),
 ranking:()=>'<g fill="#50758e" stroke="#addbe8"><rect x="9" y="53" width="39" height="27" rx="3"/><rect x="52" y="37" width="40" height="43" rx="3"/><rect x="96" y="20" width="39" height="60" rx="3"/></g><g fill="#e5d4ff" font-size="10" text-anchor="middle" font-weight="bold"><text x="28" y="70">100</text><text x="72" y="55">1.000</text><text x="115" y="40">5.000</text></g>',
 submarine:()=>'<ellipse cx="68" cy="52" rx="60" ry="37" fill="#f5c75d" opacity=".13"/><rect x="18" y="32" width="105" height="40" rx="19" fill="#ad8037" stroke="#f5d47c" stroke-width="3"/><rect x="47" y="19" width="37" height="17" rx="5" fill="#775b32" stroke="#eac576"/><circle cx="47" cy="52" r="10" fill="#163e55" stroke="#b1f0f7" stroke-width="3"/><circle cx="83" cy="52" r="10" fill="#163e55" stroke="#b1f0f7" stroke-width="3"/><path d="M123 45L142 30V74L123 59Z" fill="#ffe18b" opacity=".55"/>',
 oxygen:()=>'<rect x="18" y="20" width="34" height="63" rx="12" fill="#344d62" stroke="#a6dbe9" stroke-width="3"/><rect x="23" y="37" width="24" height="41" rx="8" fill="#71d9e7"/><path d="M75 26H126M75 49H116M75 72H105" stroke="#b5dfea" stroke-width="3"/><text x="100" y="18" fill="#d4f9ff" text-anchor="middle" font-size="12">O₂</text>',
 inventory:()=>'<g stroke="#7296ac" fill="#173348"><rect x="12" y="13" width="120" height="72" rx="6"/><path d="M52 13V85M92 13V85M12 49H132"/></g>'+line('M24 65L42 30M24 28L48 37','#c5dce7',4)+'<rect x="64" y="23" width="15" height="47" rx="6" fill="#578899" stroke="#c8f6fa"/><path d="M104 64L113 48L125 64L115 76Z" fill="#a98df7"/>',
 crown:()=>'<path d="M30 67L22 28L49 44L72 17L95 44L122 28L115 67Z" fill="#b69b5a" stroke="#ffe0a6" stroke-width="3"/>'+line('M40 78H105','#ffd878',4),
 team:()=>diver(41,52,'#79e9d8')+diver(94,52,'#c99df7')+line('M55 39Q68 21 81 39','#f8dc9c',2),
 duel:()=>diver(34,46,'#7ce6dc')+diver(110,46,'#dd84b9')+line('M50 45L90 45','#ff9b75',4)+dot(69,44,5,'#fff2be'),
 cover:()=>diver(31,47)+diver(111,48,'#f68ca8')+'<path d="M65 30L89 20L96 64L75 78L58 67Z" fill="url(#metal)" stroke="#738697" stroke-width="3"/>'+line('M110 49L96 53','#ffb0aa',3),
 aim:()=>diver(37,47)+line('M54 48H100','#e8ffff',3)+line('M96 41L104 48L96 55','#e8ffff',2)+dot(108,48,11,'none')+'<circle cx="110" cy="48" r="15" fill="none" stroke="#fc8e87" stroke-dasharray="4 4" stroke-width="2"/>',
 skills:()=>diver(42,50)+'<circle cx="98" cy="48" r="26" fill="none" stroke="#b8a8ff" stroke-dasharray="4 4" stroke-width="2"/>'+dot(98,48,7,'#f5e2ff')+line('M98 23V15M118 57L125 65M79 57L71 65','#c6b3ff',2),
 map:()=>'<path d="M29 12L51 27L40 53L66 65L87 80L123 75" fill="none" stroke="#346777" stroke-width="18" stroke-linecap="round"/>'+line('M30 12L51 27L40 53L66 65L87 80L123 75','#a1d8e0',2)+dot(30,12,7,'#a4ffda')+dot(66,65,7,'#dfabf9')+dot(123,75,8,'#ffc369'),
 portals:()=>'<ellipse cx="43" cy="50" rx="21" ry="28" fill="#0d3949" stroke="#79dce6" stroke-width="4"/><ellipse cx="100" cy="50" rx="21" ry="28" fill="#143657" stroke="#778afc" stroke-width="4"/>'+line('M63 48H83M76 41L84 48L76 55','#d1fbff',3),
 checkpoint:()=>diver(40,51)+line('M73 49H108M100 40L110 49L100 58','#bde6f7',3)+'<circle cx="115" cy="49" r="20" fill="none" stroke="#83e2cc" stroke-width="3"/>'+dot(115,49,7,'#92f5e2')+line('M113 25V15','#8cffd9',2),
 volcano:()=>rock+'<ellipse cx="44" cy="53" rx="11" ry="15" fill="#ee8b40"/><path d="M42 42Q86 23 126 46Q104 49 135 62Q91 71 43 58Z" fill="#ed6b32" opacity=".88"/><path d="M43 51Q80 43 119 52" fill="none" stroke="#ffe5a9" stroke-width="7"/>'+dot(122,35,3,'#ffc470'),
 poison:()=>rock+Array.from({length:8},(_,i)=>line('M43 48Q'+(65+i*1.8)+' '+(20+i*3)+' '+(75+i*4)+' '+(11+i*8),'#8fe88e',3)).join('')+'<circle cx="104" cy="49" r="29" fill="#65c476" opacity=".29" stroke="#aaff87" stroke-width="2"/>'+dot(95,39,3,'#e5ff86')+dot(114,59,4,'#90ee87'),
 vortex:()=>'<ellipse cx="74" cy="62" rx="52" ry="25" fill="#02111f" stroke="#477d92" stroke-width="4"/>'+Array.from({length:3},(_,i)=>'<ellipse cx="74" cy="62" rx="'+(17+i*12)+'" ry="'+(8+i*5)+'" fill="none" stroke="'+(i%2?'#7dcee9':'#407995')+'" stroke-width="2"/>').join('')+[31,52,100,119].map((x,i)=>'<circle cx="'+x+'" cy="'+(25+i%2*8)+'" r="'+(3+i%2*2)+'" fill="none" stroke="#c4f4ff" stroke-width="2"/>').join(''),
 tentacle:()=>'<path d="M12 41H130V68H12Z" fill="#fe3f63" opacity=".29" stroke="#ff496b" stroke-width="2"/>'+line('M11 55Q49 18 87 48T133 48','#6b2d97',16)+line('M11 55Q49 18 87 48T133 48','#ca8cf4',5),
 final:()=>'<path d="M33 29L17 5L43 17L66 10L76 16L103 7L119 30L108 26L111 68Q70 95 32 65Z" fill="#531477" stroke="#d5a0fa" stroke-width="3"/>'+'<path d="M43 39L58 35L63 47L50 50Z M84 36L99 39L93 50L79 47Z" fill="#08031c"/>'+dot(55,43,5,'#f5c3ff')+dot(89,43,5,'#f5c3ff')+'<path d="M37 57Q71 65 106 55Q100 85 72 83Q45 84 37 57" fill="#100320" stroke="#d99af6" stroke-width="2"/>'+Array.from({length:9},(_,i)=>'<path d="M'+(41+i*7)+' 62l6 1l-3 '+(7+i%3*3)+'Z" fill="#fff3fb"/>').join(''),
 chest:()=>'<path d="M33 39Q34 24 71 24T108 39V74H33Z" fill="#84703b" stroke="#ffe38c" stroke-width="4"/>'+line('M34 50H108M51 41V74M89 41V74','#ffd77c',5)+dot(70,53,6,'#fff2b0')+dot(70,53,2,'#6e5529'),
};
function render(topic){
 const id=Object.hasOwn(symbols,topic)?topic:'map';
 const svg=base(symbols[id](),{
  move:'Movimente seu personagem',combat:'Ataques e criaturas',progress:'Progresso dos chefes',
  energy:'Energia armazenada e recompensas',bonus:'Soma de bônus de energia: 60 mais 10 igual a 70 por cento',ranking:'Energia dos rankings diário, semanal e mensal',submarine:'Submarino e iluminação',oxygen:'Reserva de oxigênio',inventory:'Inventário e ferramentas',crown:'Conquista final',team:'Jogo cooperativo',duel:'Duelo entre jogadores',
  cover:'Use as rochas como cobertura',aim:'Mira e disparos',skills:'Habilidades especiais',
  map:'Mapa e caminhos',portals:'Vórtices de passagem',checkpoint:'Retorno ao checkpoint',
  volcano:'Rocha vulcânica expelindo calor',poison:'Anêmona soltando nuvem verde',
  vortex:'Poço profundo soltando bolhas',tentacle:'Área vermelha do tentáculo',final:'Pesadelo Roxo',chest:'Baú das Fossas'
 }[id]);
 const uid='guide'+(++diagramId);return svg.replaceAll('id="glow"','id="'+uid+'-glow"').replaceAll('url(#glow)','url(#'+uid+'-glow)').replaceAll('id="metal"','id="'+uid+'-metal"').replaceAll('url(#metal)','url(#'+uid+'-metal)');
}
root.AbyssalTutorialArt=Object.freeze({render});
})(globalThis);
