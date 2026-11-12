(function(){
'use strict';
let current=null,near=false,busy=false;
const button=document.createElement('button');button.id='riftChestButton';button.hidden=true;button.textContent='ABRIR BAÚ DAS FOSSAS';document.body.append(button);
const dialog=document.createElement('dialog');dialog.id='riftChestDialog';dialog.innerHTML=`<button class="chest-close" aria-label="Fechar">×</button><h2>Relíquia das Fossas</h2><div class="treasure-art"><div class="treasure-light"></div><svg viewBox="0 0 300 230" aria-label="Baú de madeira encharcada com ferragens corroídas"><defs><linearGradient id="wetWood" x2="0" y2="1"><stop stop-color="#536259"/><stop offset=".4" stop-color="#303a32"/><stop offset="1" stop-color="#101f23"/></linearGradient><linearGradient id="rust"><stop stop-color="#819789"/><stop offset=".4" stop-color="#455d57"/><stop offset="1" stop-color="#a17e47"/></linearGradient></defs><ellipse cx="150" cy="207" rx="113" ry="13" fill="#03131b"/><g class="treasure-lid"><path d="M45 115 Q45 52 150 52 Q255 52 255 115Z" fill="url(#wetWood)" stroke="#819185" stroke-width="3"/><path d="M85 114 Q85 65 105 58 M205 114 Q205 65 190 58" fill="none" stroke="url(#rust)" stroke-width="16"/></g><path d="M45 115H255L242 197H58Z" fill="url(#wetWood)" stroke="#536a63" stroke-width="3"/><path d="M52 141H248M55 169H245" stroke="#102326" stroke-width="3"/><path d="M88 116L94 196M212 116L206 196" stroke="url(#rust)" stroke-width="15"/><rect x="137" y="108" width="26" height="42" rx="5" fill="url(#rust)"/><circle cx="150" cy="128" r="4" fill="#0a151c"/><g fill="#acc0a3" opacity=".7"><circle cx="64" cy="180" r="7"/><circle cx="73" cy="187" r="4"/><circle cx="229" cy="153" r="6"/><circle cx="235" cy="164" r="4"/></g><path d="M58 172q-13 14-5 32M240 175q17 7 11 29" fill="none" stroke="#447665" stroke-width="5"/>
<g class="chest-ancient-moss" fill="#456947" stroke="#6e8b52" stroke-width="2" opacity=".89">
 <path d="M39 115Q55 106 74 118T104 118L116 127L93 126Q72 134 59 125L41 131Z"/>
 <path d="M171 52Q192 43 208 60L221 68Q207 78 199 62Q190 76 173 65Z"/>
 <path d="M54 190Q73 189 91 201Q71 215 50 208Z"/>
 <path d="M230 182Q255 187 253 202L244 216L220 203Z"/>
</g>
<g class="chest-wet-grain" fill="none" stroke="#091b1f" stroke-width="3" opacity=".68">
 <path d="M66 141Q148 153 230 139M62 172Q127 159 240 171M78 190Q147 195 215 183"/>
 <path d="M79 78Q152 68 223 82M105 98Q151 92 200 101"/>
</g>
<g class="chest-creeping-arms" fill="none" stroke-linecap="round">
 <path d="M51 184C21 183 24 145 36 119C45 93 24 72 12 91" stroke="#315546" stroke-width="14"/>
 <path d="M51 184C21 183 24 145 36 119C45 93 24 72 12 91" stroke="#6b9875" stroke-width="5"/>
 <path d="M252 189C273 174 255 144 268 121C280 94 295 111 289 132" stroke="#3b5055" stroke-width="15"/>
 <path d="M252 189C273 174 255 144 268 121C280 94 295 111 289 132" stroke="#8b7da0" stroke-width="5"/>
 <path d="M76 55C52 31 92 7 109 19" stroke="#416c5b" stroke-width="8"/>
 <path d="M224 74C251 45 223 14 207 26" stroke="#5d8b60" stroke-width="7"/>
</g>
<g class="chest-salt-corrosion" fill="#a4b7a0" opacity=".54">
 <circle cx="65" cy="130" r="2"/><circle cx="89" cy="159" r="3"/><circle cx="236" cy="160" r="2"/>
 <circle cx="76" cy="85" r="3"/><circle cx="187" cy="75" r="2"/><circle cx="205" cy="184" r="2"/>
</g></svg></div><p id="riftChestMessage">Madeira salgada. Um brilho sobrevive lá dentro.</p><p class="chest-odds">3% de espécime ainda não possuída · 97% de energia<br>30 / 50 / 70 / 90 / 100 / 120<br>Se todas as skins já forem suas, o prêmio será em energia.</p><button id="riftChestOpen">ABRIR</button>`;document.body.append(dialog);
const message=dialog.querySelector('#riftChestMessage'),open=dialog.querySelector('#riftChestOpen');
dialog.querySelector('.chest-close').onclick=()=>dialog.close();
button.onclick=()=>{if(!current||!near||!window.AbyssalGameHooks?.isRiftPlaying?.())return;dialog.classList.toggle('final-chest',Boolean(current.final));dialog.querySelector('h2').textContent=current.final?'BAÚ MOFADO DOURADO':'Relíquia das Fossas';dialog.querySelector('.chest-odds').textContent=current.final?'SKIN PESADELO ROXO + 1 SKIN ALEATÓRIA GARANTIDA + 10.000 ENERGIA':'3% de skin · 97% de energia (30 a 120)';dialog.classList.remove('opened');message.textContent='Madeira salgada. Um brilho sobrevive lá dentro.';open.disabled=false;dialog.showModal();};
open.onclick=()=>{
 if(busy||!current)return;busy=true;open.disabled=true;message.textContent='Abrindo o baú…';const chest=current;
 window.AbyssalOnline?.openRiftChest({...chest,progress:window.AbyssalGameHooks?.riftRewardProgress?.()},result=>{
  busy=false;if(!result?.ok){message.textContent=result?.message||'Conecte-se ao servidor para abrir.';open.disabled=false;return;}
  chest.opened=true;button.hidden=true;dialog.classList.add('opened');
  const reward=result.reward;if(reward.type==='final'){const nightmare=window.AbyssalGameHooks?.skinName?.(reward.nightmareSkinId)||reward.nightmareSkinId,random=window.AbyssalGameHooks?.skinName?.(reward.randomSkinId)||reward.randomSkinId;message.textContent='FOSSAS CONCLUÍDAS · '+nightmare+' · SKIN ALEATÓRIA: '+random+' · +'+reward.amount.toLocaleString('pt-BR')+' energia';}else message.textContent=reward.type==='skin'?'SKIN DESCOBERTA · '+(window.AbyssalGameHooks?.skinName?.(reward.id)||reward.id):reward.amount.toLocaleString('pt-BR')+' energia ABISSAIS';
 });
};
window.addEventListener('abyssal-rift-chest',e=>{current={...e.detail};});
setInterval(()=>{if(!window.AbyssalGameHooks?.isRiftPlaying?.()){button.hidden=true;if(dialog.open)dialog.close();}},250);
window.AbyssalTreasure={
 reset(){current=null;near=false;button.hidden=true;dialog.close();},
 update(c,tier,cleared,room,player,t){
  if(!cleared||!room||!player||!window.AbyssalGameHooks?.isRiftPlaying?.()){button.hidden=true;return;}
  if(!current||current.tier!==tier)current={tier,final:tier>=7};
  if(tier>=7)current.final=true;
  const x=room.x,y=room.y+room.ry*.28;
  near=Math.hypot(player.x-x,player.y-y)<190;
  button.hidden=!near||current.opened;button.textContent=current.final?'ABRIR BAÚ MOFADO DOURADO':'ABRIR BAÚ DAS FOSSAS';
  c.save();c.translate(x,y);const glow=c.createRadialGradient(0,-15,0,0,0,110);glow.addColorStop(0,current.opened?'rgba(255,221,97,.55)':'rgba(81,169,169,.22)');glow.addColorStop(1,'rgba(255,205,70,0)');c.fillStyle=glow;c.fillRect(-110,-110,220,220);
  c.fillStyle=current.final?'#977431':'#34473e';c.strokeStyle=current.final?'#ffe6a0':'#8d9070';c.lineWidth=3;c.fillRect(-38,-17,76,45);c.strokeRect(-38,-17,76,45);c.fillStyle='#202f2d';c.beginPath();c.ellipse(0,current.opened?-38:-17,38,19,0,Math.PI,Math.PI*2);c.fill();c.stroke();
  c.strokeStyle=current.final?'#ebc66b':'#829c86';c.lineWidth=8;for(const x of [-23,23]){c.beginPath();c.moveTo(x,-17);c.lineTo(x,28);c.stroke();}c.fillStyle=current.final?'#fff4aa':'#b9a45c';c.fillRect(-6,-11,12,15);
  c.fillStyle='#527e60';for(let i=0;i<12;i++){const bx=-34+i*6,by=i%2?20:-15;c.beginPath();c.ellipse(bx,by,3.2+(i%4),2.3,0,0,Math.PI*2);c.fill();}
  c.strokeStyle=current.final?'rgba(182,131,218,.83)':'rgba(76,118,91,.77)';c.lineCap='round';
  for(const side of [-1,1]){c.lineWidth=current.final?7:5;c.beginPath();c.moveTo(side*29,17);c.bezierCurveTo(side*54,1,side*48,-29,side*27,-27);c.stroke();}
  c.fillStyle='#243b36';for(let i=0;i<5;i++){c.beginPath();c.arc(-32+i*4,20+Math.sin(i)*4,3,0,7);c.fill();}c.restore();
 }
};
})();
