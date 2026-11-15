(function(root){
'use strict';
const KEY='abyssalHudLayoutV1',PENDING=KEY+'Pending',PROFILES=['portrait','landscape','desktop'];
const ITEMS=[
 ['stats','Estatísticas',['#hud .hud-top'],.50,.045,260,32,'both'],
 ['health','Vida',['#hud .bars .bar-label:not(.xp-label)','#hud .bars .bar:not(.xp-bar)'],.50,.105,240,20,'both'],
 ['xp','Experiência',['#hud .xp-label','#hud .xp-bar'],.50,.15,240,20,'both'],
 ['energy','Energia / base',['#hud .solo-energy-stock'],.50,.19,220,20,'both'],
 ['progress','Progressão',['#bossProgressionTrack'],.50,.235,240,25,'both'],
 ['skills','Habilidades adquiridas',['#selectedSkillsPanel'],.84,.35,112,65,'both'],
 ['ranking','Ranking',['#runEnergyRanking'],.16,.35,108,65,'both'],
 ['pause','Pausar',['#mobilePauseBtn','#pauseBtn'],.92,.05,44,44,'both'],
 ['hide','Ocultar HUD',['#toggleHudBtn'],.08,.05,44,44,'both'],
 ['pulse','Q · Pulso',['#skillPulseBtn'],.36,.90,66,48,'both'],
 ['dash','E · Propulsor',['#skillDashBtn'],.51,.90,66,48,'both'],
 ['petSkill','R · Espécime',['#skinActiveBtn'],.66,.90,66,48,'both'],
 ['pet','Comportamento',['#mobilePetHabit','#petHabitBar .pet-habit-actions'],.16,.76,100,48,'both'],
 ['repair','Reparar',['#soloSubmarineRepairBtn'],.09,.66,48,48,'both'],
 ['power','Energizar',['#soloSubmarinePowerBtn'],.23,.66,48,48,'both'],
 ['fire','Disparo',['#mobileFireBtn'],.88,.76,56,56,'mobile'],
 ['aim','Mira',['#mobileAimStick'],.86,.91,84,84,'mobile'],
 ['move','Movimento',['#mobileJoystick'],.14,.91,84,84,'mobile'],
 ['comms','Comunicação',['#quickCommsToggle'],.90,.55,46,46,'both'],
 ['map','Interagir',['#abyssMapInteractBtn'],.50,.70,90,44,'both'],
 ['sonar','Minimapa',['#abyssalMiniMap'],.86,.20,100,76,'both'],
 ['depth','Profundidade',['#abyssDepthMeter'],.08,.50,44,85,'both'],
 ['end','Encerrar',['#endDiveBtn'],.85,.84,118,36,'desktop']
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,d)=>typeof n==='number'&&Number.isFinite(n)?n:d;
function normalize(raw){const out={};for(const profile of PROFILES){const src=raw?.[profile];out[profile]={};for(const item of ITEMS){if(item[7]==='mobile'&&profile==='desktop'||item[7]==='desktop'&&profile!=='desktop')continue;const v=src?.[item[0]];if(v&&typeof v==='object'&&!Array.isArray(v))out[profile][item[0]]={x:clamp(finite(v.x,item[3]),0,1),y:clamp(finite(v.y,item[4]),0,1),s:clamp(finite(v.s,1),.65,1.6)};}}return out;}
function fit(pos,box,w,h){const s=Math.min(pos.s,Math.max(.1,(w-12)/Math.max(1,box.w)),Math.max(.1,(h-12)/Math.max(1,box.h)));const hw=box.w*s/2+6,hh=box.h*s/2+6;return {x:clamp(pos.x*w,hw,Math.max(hw,w-hw)),y:clamp(pos.y*h,hh,Math.max(hh,h-hh)),s};}
const core={normalize,fit,ITEMS,PROFILES};if(typeof module!=='undefined'&&module.exports){module.exports=core;return;}
const doc=root.document;if(!doc)return;
function read(key){try{return JSON.parse(root.localStorage.getItem(key)||'null');}catch{return null;}}
function write(key,v){try{root.localStorage.setItem(key,JSON.stringify(v));return true;}catch{return false;}}
let saved=normalize(read(KEY)),imported=null,scheduled=false,publishing=false;
const applied=new Map(),scales=new Map();
function profile(){return doc.documentElement.classList.contains('abyssal-handheld')||root.matchMedia('(pointer: coarse)').matches||root.innerWidth<=700?root.innerWidth>root.innerHeight?'landscape':'portrait':'desktop';}
function active(){return doc.body.classList.contains('game-active');}
function clear(){for(const el of applied.keys()){el.style.removeProperty('translate');el.style.removeProperty('scale');el.style.removeProperty('transform-origin');}applied.clear();scales.clear();}
function movementRect(){if(!active()||profile()==='desktop')return null;const v=saved[profile()].move;if(!v)return null;const shell=doc.getElementById('gameShell')?.getBoundingClientRect();if(!shell||!shell.width||!shell.height)return null;const f=fit(v,{w:88,h:88},shell.width,shell.height),r=44*f.s;return {left:shell.left+f.x-r,right:shell.left+f.x+r,top:shell.top+f.y-r,bottom:shell.top+f.y+r,s:f.s};}
function refresh(){scheduled=false;clear();const shell=doc.getElementById('gameShell'),layout=saved[profile()];if(!shell||!active()){doc.body.classList.remove('custom-hud-active');return;}const has=Object.keys(layout).length>0;doc.body.classList.toggle('custom-hud-active',has);if(!has)return;const sr=shell.getBoundingClientRect();if(!sr.width||!sr.height)return;
 for(const [id,,selectors] of ITEMS){const pos=layout[id];if(!pos)continue;if(id==='move'){const el=doc.getElementById('mobileJoystick'),r=movementRect();if(el&&r){el.hidden=false;el.classList.add('is-floating');el.style.left=((r.left+r.right)/2)+'px';el.style.top=((r.top+r.bottom)/2)+'px';el.style.bottom='auto';el.style.transform='translate(-50%, -50%)';el.style.setProperty('scale',String(r.s),'important');el.style.setProperty('transform-origin','center','important');applied.set(el,true);scales.set(id,r.s);}continue;}
 const els=selectors.flatMap(s=>[...doc.querySelectorAll(s)]).filter(el=>{const r=el.getBoundingClientRect(),cs=root.getComputedStyle(el);return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden';});if(!els.length)continue;
 const rects=els.map(el=>el.getBoundingClientRect()),l=Math.min(...rects.map(r=>r.left)),t=Math.min(...rects.map(r=>r.top)),r=Math.max(...rects.map(r=>r.right)),b=Math.max(...rects.map(r=>r.bottom)),cx=(l+r)/2,cy=(t+b)/2,f=fit(pos,{w:r-l,h:b-t},sr.width,sr.height);scales.set(id,f.s);
 els.forEach((el,i)=>{const rc=rects[i],ex=(rc.left+rc.right)/2,ey=(rc.top+rc.bottom)/2;el.style.setProperty('translate',(sr.left+f.x+(ex-cx)*f.s-ex)+'px '+(sr.top+f.y+(ey-cy)*f.s-ey)+'px','important');el.style.setProperty('scale',String(f.s),'important');el.style.setProperty('transform-origin','center','important');applied.set(el,true);});
 }
}
function schedule(){if(scheduled)return;scheduled=true;root.requestAnimationFrame(refresh);}
function publish(message){const online=root.AbyssalOnline,account=online?.getAccount?.();if(!online?.isAuthenticated?.()||!account?.nickname){message?.('Salvo neste dispositivo. Entre na conta e salve para compartilhar no perfil.');return;}
 const payload={owner:account.nickname,layout:normalize(saved)};write(PENDING,payload);
 if(!online.isConnected?.()){message?.('Salvo neste dispositivo. Compartilhamento pendente de conexão.');return;}if(publishing)return;publishing=true;online.saveCosmetics({hudLayout:payload.layout},res=>{publishing=false;if(res?.ok){const pending=read(PENDING);if(pending?.owner===payload.owner&&JSON.stringify(pending.layout)===JSON.stringify(payload.layout)){try{root.localStorage.removeItem(PENDING);}catch{}}message?.('HUD salvo e disponível no seu perfil.');}else message?.('HUD salvo localmente; não foi possível compartilhar agora.');});
}
function flushPending(){const pending=read(PENDING),online=root.AbyssalOnline;if(!pending||publishing||!online?.isAuthenticated?.()||!online?.isConnected?.()||online.getAccount?.()?.nickname!==pending.owner)return;publishing=true;online.saveCosmetics({hudLayout:normalize(pending.layout)},res=>{publishing=false;if(res?.ok&&JSON.stringify(read(PENDING))===JSON.stringify(pending)){try{root.localStorage.removeItem(PENDING);}catch{}}});}
const create=(tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
function defaults(item){return {x:item[3],y:item[4],s:1};}
function createPage(){let draft=normalize(imported?.layout||saved),selectedProfile=profile(),selected='aim',source=imported?.name||'';imported=null;
 const page=create('section','hud-editor'),title=create('p','hud-editor-note',source?'HUD de '+source+' carregado em prévia. Salve para substituir seu layout.':'Arraste os controles e ajuste o tamanho. Cada orientação tem seu próprio layout.');
 const bar=create('div','hud-editor-toolbar'),sel=create('select');sel.setAttribute('aria-label','Layout do dispositivo');for(const [id,label] of [['portrait','Celular vertical'],['landscape','Celular horizontal'],['desktop','Computador']]){const o=create('option','',label);o.value=id;sel.append(o);}sel.value=selectedProfile;
 const itemSel=create('select');itemSel.setAttribute('aria-label','Elemento da interface');bar.append(sel,itemSel);
 const stage=create('div','hud-editor-stage');stage.dataset.profile=selectedProfile;stage.setAttribute('aria-label','Prévia da interface de jogo');
 const tools=create('div','hud-editor-toolbar'),size=create('input'),sizeLabel=create('label','hud-editor-size','Tamanho '),amount=create('output','','100%');size.type='range';size.min='65';size.max='160';size.step='5';sizeLabel.append(amount,size);tools.append(sizeLabel);
 const actions=create('div','hud-editor-actions'),resetItem=create('button','','Restaurar elemento'),reset=create('button','','Restaurar layout'),save=create('button','primary-btn','Salvar HUD'),status=create('p','hud-editor-note');status.setAttribute('role','status');for(const b of [resetItem,reset,save])b.type='button';actions.append(resetItem,reset,save);page.append(title,bar,stage,tools,actions,status);
 const eligible=()=>ITEMS.filter(i=>i[7]==='both'||(selectedProfile==='desktop'?i[7]==='desktop':i[7]==='mobile'));
 const getItem=()=>ITEMS.find(i=>i[0]===selected);
 function current(item){return draft[selectedProfile][item[0]]||defaults(item);}
 function updateSize(){const v=current(getItem());size.value=String(Math.round(v.s*100));amount.textContent=size.value+'%';}
 const previewEls=new Map();
 function paint(){const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;const ref=selectedProfile==='portrait'?[390,844]:selectedProfile==='landscape'?[844,390]:[1280,720],factor=Math.min(r.width/ref[0],r.height/ref[1]);for(const item of eligible()){const v=current(item),el=previewEls.get(item[0]),box={w:item[5]*factor,h:item[6]*factor},f=fit(v,box,r.width,r.height);el.style.left=f.x+'px';el.style.top=f.y+'px';el.style.width=box.w*f.s+'px';el.style.height=box.h*f.s+'px';el.style.fontSize=Math.max(7,10*factor*f.s)+'px';el.setAttribute('aria-pressed',String(item[0]===selected));}updateSize();}
 function select(id){selected=id;itemSel.value=id;paint();}
 function rebuild(){const items=eligible();if(!items.some(i=>i[0]===selected))selected=items[0][0];itemSel.replaceChildren();stage.replaceChildren();previewEls.clear();for(const item of items){const o=create('option','',item[1]);o.value=item[0];itemSel.append(o);const b=create('button','hud-editor-piece',item[1]);b.type='button';b.dataset.item=item[0];if(item[0]==='aim'){b.classList.add('hud-editor-reticle');b.textContent='';b.setAttribute('aria-label',item[1]);}if(item[0]==='move')b.classList.add('hud-editor-stick');let drag=null;b.addEventListener('pointerdown',e=>{e.preventDefault();select(item[0]);const br=b.getBoundingClientRect();drag={id:e.pointerId,dx:e.clientX-br.left-br.width/2,dy:e.clientY-br.top-br.height/2};b.setPointerCapture?.(e.pointerId);});b.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const r=stage.getBoundingClientRect(),v=current(item);draft[selectedProfile][item[0]]={...v,x:clamp((e.clientX-r.left-drag.dx)/r.width,0,1),y:clamp((e.clientY-r.top-drag.dy)/r.height,0,1)};paint();});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>{drag=null;});b.addEventListener('click',()=>select(item[0]));b.addEventListener('keydown',e=>{const dx=e.key==='ArrowLeft'?-.01:e.key==='ArrowRight'?.01:0,dy=e.key==='ArrowUp'?-.01:e.key==='ArrowDown'?.01:0;if(!dx&&!dy)return;e.preventDefault();const v=current(item);draft[selectedProfile][item[0]]={...v,x:clamp(v.x+dx,0,1),y:clamp(v.y+dy,0,1)};paint();});previewEls.set(item[0],b);stage.append(b);}itemSel.value=selected;stage.dataset.profile=selectedProfile;root.requestAnimationFrame(paint);}
 sel.onchange=()=>{selectedProfile=sel.value;rebuild();};itemSel.onchange=()=>select(itemSel.value);
 size.oninput=()=>{const item=getItem();draft[selectedProfile][item[0]]={...current(item),s:Number(size.value)/100};paint();};
 resetItem.onclick=()=>{delete draft[selectedProfile][selected];paint();status.textContent='Elemento restaurado em prévia.';};
 reset.onclick=()=>{draft[selectedProfile]={};paint();status.textContent='Layout restaurado em prévia.';};
 save.onclick=()=>{const next=normalize(draft);if(!write(KEY,next)){status.textContent='Não foi possível salvar neste dispositivo.';return;}saved=next;schedule();status.textContent='HUD salvo neste dispositivo.';publish(v=>status.textContent=v);};
 rebuild();const observer=new ResizeObserver(paint);observer.observe(stage);const life=new MutationObserver(()=>{if(!page.isConnected){observer.disconnect();life.disconnect();}});root.requestAnimationFrame(()=>{if(page.isConnected)life.observe(doc.body,{childList:true,subtree:true});else observer.disconnect();});return page;
}
function copyFromProfile(layout,name){if(layout==null)return false;imported={layout:normalize(layout),name:String(name||'jogador')};const nav=root.AbyssalCockpitNavigation;if(nav?.routeCommand?.('hudEditor'))return true;nav?.open?.();if(nav?.routeCommand?.('hudEditor'))return true;imported=null;return false;}
root.AbyssalHudLayout=Object.freeze({...core,createPage,copyFromProfile,refresh:schedule,movementRect,scaleFor:id=>scales.get(id)||1,get:()=>normalize(saved)});
const selectors=ITEMS.flatMap(i=>i[2]).join(',');
function install(){const obs=new MutationObserver(records=>{for(const rec of records){if(rec.type==='attributes'){if(rec.target===doc.body||rec.target===doc.documentElement||rec.target.matches?.(selectors)) {schedule();return;}}else if([...rec.addedNodes].some(n=>n.nodeType===1&&(n.matches?.(selectors)||n.querySelector?.(selectors)))){schedule();return;}}});obs.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});obs.observe(doc.documentElement,{attributes:true,attributeFilter:['class']});root.addEventListener('resize',schedule,{passive:true});root.addEventListener('orientationchange',schedule);root.addEventListener('abyssal-account-data',flushPending);schedule();}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(typeof globalThis!=='undefined'?globalThis:this);
