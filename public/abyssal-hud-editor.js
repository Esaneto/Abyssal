(function(root){
'use strict';
const KEY='abyssalHudLayoutV1',PENDING=KEY+'Pending',PROFILES=['portrait','landscape','desktop'];
const ITEMS=[
 ['stats','Estatísticas',['#hud .hud-top'],.50,.037,236,35,'both'],
 ['health','Vida',['#hud .bars .bar-label:not(.xp-label)','#hud .bars .bar:not(.xp-bar)'],.50,.087,236,18,'both'],
 ['xp','Experiência',['#hud .xp-label','#hud .xp-bar'],.50,.12,236,18,'both'],
 ['energy','Energia / base',['#hud .solo-energy-stock'],.50,.158,236,25,'both'],
 ['progress','Progressão de chefes',['#bossProgressionTrack'],.50,.202,236,64,'both'],
 ['skills','Habilidades adquiridas',['#selectedSkillsPanel'],.91,.31,60,112,'both'],
 ['pause','Pausar',['#mobilePauseBtn','#pauseBtn'],.92,.047,48,48,'both'],
 ['hide','Ocultar HUD',['#toggleHudBtn'],.08,.047,48,48,'both'],
 ['pulse','Q · Pulso',['#skillPulseBtn'],.36,.95,48,50,'both'],
 ['dash','E · Propulsor',['#skillDashBtn'],.51,.95,48,50,'both'],
 ['petSkill','R · Espécime',['#skinActiveBtn'],.66,.95,48,50,'both'],
 ['pet','Comportamento',['#petHabitBar .pet-habit-actions'], .20,.846,150,48,'both'],
 ['repair','Reparar',['#soloSubmarineRepairBtn'],.23,.675,48,48,'both'],
 ['power','Energizar',['#soloSubmarinePowerBtn'],.23,.76,48,48,'both'],
 ['fire','Disparo',['#mobileFireBtn'],.91,.79,56,56,'mobile'],
 ['aim','Mira',['#mobileAimStick'],.855,.908,76,76,'mobile'],
 ['comms','Comunicação',['#quickComms'],.90,.55,46,46,'both'],
 ['end','Encerrar',['#endDiveBtn'],.85,.84,118,36,'desktop'],
];
const MODES=['solo','online'];
// Optional readouts and nonessential controls can be removed per mode/device.
const OPTIONAL=new Set(['stats','health','xp','energy','progress','skills','pet','comms']);
function canRemove(id){return OPTIONAL.has(id);}
function scaleLimit(id){return id==='power'?1:1.6;}
function eligibleItems(mode,profile,controls='dual-stick'){return ITEMS.filter(i=>(i[0]!=='comms'||mode==='online')&&(i[7]==='both'||(profile==='desktop'?i[7]==='desktop':i[7]==='mobile'))&&(controls==='dual-stick'||!['aim','fire'].includes(i[0])));}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,d)=>typeof n==='number'&&Number.isFinite(n)?n:d;
function normalizeMode(raw,mode){const out={};for(const profile of PROFILES){const src=raw?.[profile];out[profile]={};for(const item of eligibleItems(mode,profile)){const v=src?.[item[0]];if(v&&typeof v==='object'&&!Array.isArray(v))out[profile][item[0]]={x:clamp(finite(v.x,item[3]),0,1),y:clamp(finite(v.y,item[4]),0,1),s:clamp(finite(v.s,1),.65,scaleLimit(item[0])),...(canRemove(item[0])&&v.hidden===true?{hidden:true}:{}),...(typeof v.o==='number'&&Number.isFinite(v.o)&&v.o!==1?{o:clamp(v.o,canRemove(item[0])?.15:.35,1)}:{})};}}return out;}
// Keep existing Solo keys and migrate the previously shared layout to Online once.
function normalize(raw){return {...normalizeMode(raw,'solo'),online:normalizeMode(raw?.online??raw,'online')};}
function modeLayout(layout,mode){return mode==='online'?layout.online:layout;}
// Public GameMaster Solo HUD snapshot, 2026-11-15. Bundled for offline starts;
// it is a baseline, not a live dependency or an overwrite of player settings.
const MOBILE_PRESET={
 "portrait": {
  "health": {
   "x": 0.24212964375813803,
   "y": 0.11094417652258506,
   "s": 0.65
  },
  "xp": {
   "x": 0.22638891885677973,
   "y": 0.13420138622705752,
   "s": 0.65
  },
  "energy": {
   "x": 0.21898148457209268,
   "y": 0.15848692334615266,
   "s": 0.65
  },
  "progress": {
   "x": 0.7171295285224915,
   "y": 0.1230302040393536,
   "s": 0.65
  },
  "skills": {
   "x": 0.9422452449798584,
   "y": 0.1924412617316613,
   "s": 1
  },
  "pulse": {
   "x": 0.9200231234232584,
   "y": 0.6992292459300488,
   "s": 1
  },
  "dash": {
   "x": 0.7818287213643392,
   "y": 0.7012684992972137,
   "s": 1
  },
  "petSkill": {
   "x": 0.9413193861643473,
   "y": 0.6198057494411578,
   "s": 1
  },
  "pet": {
   "x": 0.13686344027519226,
   "y": 0.9762684678755744,
   "s": 1
  },
  "repair": {
   "x": 0.9762732883294424,
   "y": 0.46759796142578125,
   "s": 1
  },
  "power": {
   "x": 0.9478009541829427,
   "y": 0.5431278647714957,
   "s": 1
  }
 },
 "landscape": {
  "stats": {
   "x": 0.7807625348751361,
   "y": 0.013802083830038706,
   "s": 0.65
  },
  "health": {
   "x": 0.25240384615384615,
   "y": 0.016652201612790424,
   "s": 0.65
  },
  "xp": {
   "x": 0.2521367623255803,
   "y": 0.08554687475164731,
   "s": 0.65
  },
  "energy": {
   "x": 0.25213012328514683,
   "y": 0.1389178385337194,
   "s": 0.65
  },
  "progress": {
   "x": 0.7811966767677894,
   "y": 0.13485241681337357,
   "s": 0.65
  },
  "pulse": {
   "x": 0.9015958492572491,
   "y": 0.761689821879069,
   "s": 1
  },
  "dash": {
   "x": 0.980181620671199,
   "y": 0.7607494195302328,
   "s": 1
  },
  "petSkill": {
   "x": 0.9660790516779973,
   "y": 0.8940682411193848,
   "s": 1
  },
  "pet": {
   "x": 0.05886752101091238,
   "y": 0.9464698781569799,
   "s": 1
  },
  "repair": {
   "x": 0.01551816096672645,
   "y": 0.7782408793767294,
   "s": 1
  },
  "power": {
   "x": 0.05654380183953505,
   "y": 0.642578125,
   "s": 1
  }
 }
};
// Nekko's public Solo desktop layout, retrieved 2026-11-15. Unedited controls retain their native baseline.
const DESKTOP_PRESET={
 "skills": {
  "x": 0.9932291666666667,
  "y": 0.12840043525571274,
  "s": 1
 },
 "hide": {
  "x": 0.996875,
  "y": 0.08378672470076169,
  "s": 1
 },
 "pulse": {
  "x": 0.007291666666666667,
  "y": 1,
  "s": 1
 },
 "dash": {
  "x": 0.043229166666666666,
  "y": 0.9912948857453754,
  "s": 1
 },
 "petSkill": {
  "x": 0.07083333333333333,
  "y": 1,
  "s": 1
 },
 "pet": {
  "x": 0,
  "y": 0.8813928182807399,
  "s": 1
 },
 "repair": {
  "x": 0.009895833333333333,
  "y": 0.8030467899891186,
  "s": 1
 },
 "power": {
  "x": 0.008854166666666666,
  "y": 0.750816104461371,
  "s": 1
 },
 "end": {
  "x": 1,
  "y": 1,
  "s": 1
 }
};
function defaultLayout(mode,profile){
 const source=profile==='desktop'?DESKTOP_PRESET:MOBILE_PRESET[profile];if(!source)return {};
 const layout=Object.fromEntries(Object.entries(source).map(([id,pos])=>[id,{...pos}]));
 if(mode==='online')layout.comms=profile==='desktop'?{x:layout.power.x,y:layout.power.y-.085,s:1}:profile==='portrait'?{x:.15,y:.47,s:1}:{x:.15,y:.52,s:1};
 return layout;
}
function effectiveLayout(layout,mode,profile){return {...defaultLayout(mode,profile),...modeLayout(layout,mode)[profile]};}
// Preserve authored controls. Fit untouched baseline controls against the actual
// rendered bounds, on narrow screens and rotations, without changing saved data.
const PRESET_ORDER=['pause','hide','repair','power','petSkill','pulse','dash','pet','aim','fire','comms','stats','health','xp','energy','progress','skills'];
function resolvePositions(entries,w,h,safe={},avoidOverlap=true,device='portrait'){
 const result={},occupied=[],gap=3;
 const order=device==='desktop'?['pause','hide','power','comms','repair','pulse','dash','petSkill','pet','end','stats','health','xp','energy','progress','skills']:PRESET_ORDER;
 const priority=e=>e.custom?-1:order.indexOf(e.id)<0?99:order.indexOf(e.id);
 const ordered=[...entries].sort((a,b)=>priority(a)-priority(b));
 for(const e of ordered){
  if(e.pos.hidden)continue;
  let wanted=e.pos;
  if(device==='desktop'&&e.id==='comms'&&!e.custom){const power=entries.find(v=>v.id==='power'),p=power?.pos||DESKTOP_PRESET.power,box=power?.box||{w:48,h:48},actual=result.power||p,pf=fit(actual,box,w,h,safe);wanted={...e.pos,x:pf.x/w,y:(pf.y-box.h*pf.s/2-e.box.h*e.pos.s/2-8)/h};}
  const target=fit(wanted,e.box,w,h,safe),hw=e.box.w*target.s/2,hh=e.box.h*target.s/2;
  const rect=(x,y)=>({l:x-hw,r:x+hw,t:y-hh,b:y+hh});
  const intersects=(a,b)=>a.l<b.r+gap-.001&&a.r>b.l-gap+.001&&a.t<b.b+gap-.001&&a.b>b.t-gap+.001;
  let best=target,bestRect=rect(target.x,target.y);
  if(avoidOverlap&&!e.custom&&occupied.some(r=>intersects(bestRect,r))){
   const xs=[target.x],ys=[target.y];
   for(const r of occupied){xs.push(r.l-hw-gap,r.r+hw+gap);ys.push(r.t-hh-gap,r.b+hh+gap);}
   let cost=Infinity;
   for(const x of xs)for(const y of ys){
    const p=fit({...wanted,x:x/w,y:y/h},e.box,w,h,safe),r=rect(p.x,p.y);
    if(occupied.some(o=>intersects(r,o)))continue;
    const d=(p.x-target.x)**2+(p.y-target.y)**2;
    if(d<cost){cost=d;best=p;bestRect=r;}
   }
  }
  result[e.id]={...e.pos,x:best.x/w,y:best.y/h,s:best.s};occupied.push(bestRect);
 }
 return result;
}
// Reserve the space of the complete HUD, even for controls which are not
// currently available. The skill rail grows from a fixed edge, not its center.
function planPositions(entries,w,h,safe={},device='portrait'){
 const prepared=entries.map(e=>{
  if(e.id!=='skills'||!e.reserve||e.pos.hidden)return e;
  const anchor=e.pos.y<=.5?1:-1,reference=e.reserve.reference,extent=Math.max(reference,e.reserve.height);
  return {...e,anchor,reference,extent,box:{...e.box,h:extent},pos:{...e.pos,y:e.pos.y+anchor*(extent-reference)*e.pos.s/(2*h)}};
 });
 const positions=resolvePositions(prepared,w,h,safe,true,device),rail=prepared.find(e=>e.id==='skills'&&e.anchor),slots={};
 if(rail&&positions.skills){const p=positions.skills;slots.skills={anchor:rail.anchor,reference:rail.reference};positions.skills={...p,y:p.y-rail.anchor*(rail.extent-rail.reference)*p.s/(2*h)};}
 return {positions,slots};
}
function displayPosition(pos,slot,box,h){return slot?{...pos,y:pos.y+slot.anchor*(box.h-slot.reference)*pos.s/(2*h)}:pos;}
function fit(pos,box,w,h,safe={}){const l=Math.max(6,safe.left||0),r=Math.max(6,safe.right||0),t=Math.max(6,safe.top||0),b=Math.max(6,safe.bottom||0),s=Math.min(pos.s,Math.max(.1,(w-l-r)/Math.max(1,box.w)),Math.max(.1,(h-t-b)/Math.max(1,box.h)));const hw=box.w*s/2,hh=box.h*s/2;return {x:clamp(pos.x*w,l+hw,Math.max(l+hw,w-r-hw)),y:clamp(pos.y*h,t+hh,Math.max(t+hh,h-b-hh)),s};}
function safeInsets(doc){const html=doc.documentElement;if(!html.classList.contains('abyssal-handheld'))return {};let el=doc.getElementById('abyssalHudSafeAreaProbe');if(!el){el=doc.createElement('div');el.id='abyssalHudSafeAreaProbe';el.style.cssText='position:fixed;pointer-events:none;visibility:hidden;width:0;height:0;box-sizing:content-box;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';doc.body.append(el);}const c=doc.defaultView.getComputedStyle(el);return {left:parseFloat(c.paddingLeft)||0,right:parseFloat(c.paddingRight)||0,top:parseFloat(c.paddingTop)||0,bottom:parseFloat(c.paddingBottom)||0};}
function groupRect(els){if(!els.length)return null;const rects=els.map(el=>el.getBoundingClientRect()),l=Math.min(...rects.map(r=>r.left)),t=Math.min(...rects.map(r=>r.top)),r=Math.max(...rects.map(r=>r.right)),b=Math.max(...rects.map(r=>r.bottom));return {rects,l,t,r,b,w:r-l,h:b-t,cx:(l+r)/2,cy:(t+b)/2};}
function skillReservation(el,box){const c=el.ownerDocument.defaultView.getComputedStyle(el),row=el.querySelector('.selected-skill-row'),r=row?.getBoundingClientRect(),reference=Math.max(1,(r?.height||32)+(parseFloat(c.paddingTop)||0)+(parseFloat(c.paddingBottom)||0)+(parseFloat(c.borderTopWidth)||0)+(parseFloat(c.borderBottomWidth)||0));return {reference,height:Math.max(reference,parseFloat(c.maxHeight)||box.h)};}
function visibleGroup(doc,selectors){return selectors.flatMap(s=>[...doc.querySelectorAll(s)]).filter(el=>{const r=el.getBoundingClientRect(),cs=doc.defaultView.getComputedStyle(el);return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden';});}
function placeGroup(els,g,pos,sr,safe=safeInsets(els[0].ownerDocument)){const f=fit(pos,g,sr.width,sr.height,safe);els.forEach((el,i)=>{const rc=g.rects[i],ex=(rc.left+rc.right)/2,ey=(rc.top+rc.bottom)/2;el.style.setProperty('translate',(sr.left+f.x+(ex-g.cx)*f.s-ex)+'px '+(sr.top+f.y+(ey-g.cy)*f.s-ey)+'px','important');el.style.setProperty('scale',String(f.s),'important');el.style.setProperty('transform-origin','center','important');el.toggleAttribute('data-hud-custom-opacity',typeof pos.o==='number');if(typeof pos.o==='number')el.style.setProperty('--hud-custom-opacity',String(pos.o));else el.style.removeProperty('--hud-custom-opacity');});return f;}
function ownerKey(name){return String(name||'').trim().toLowerCase();}
function changedProfiles(before,after){const result=[];for(const mode of MODES)for(const device of PROFILES)if(JSON.stringify(modeLayout(before,mode)[device])!==JSON.stringify(modeLayout(after,mode)[device]))result.push(mode+':'+device);return result;}
function mergeProfiles(remote,local,changes){const out=normalize(remote),next=normalize(local);for(const key of (Array.isArray(changes)?changes.slice(0,6):[])){if(typeof key!=='string')continue;const [mode,device]=key.split(':');if(MODES.includes(mode)&&PROFILES.includes(device))modeLayout(out,mode)[device]=modeLayout(next,mode)[device];}return out;}
function hasEdits(layout){return MODES.some(mode=>PROFILES.some(device=>Object.keys(modeLayout(layout,mode)[device]).length));}
const core={normalize,fit,ITEMS,PROFILES,MODES,eligibleItems,modeLayout,canRemove,scaleLimit,defaultLayout,effectiveLayout,resolvePositions,planPositions,displayPosition,ownerKey,changedProfiles,mergeProfiles,hasEdits};if(typeof module!=='undefined'&&module.exports){module.exports=core;return;}
const doc=root.document;if(!doc)return;
function read(key){try{return JSON.parse(root.localStorage.getItem(key)||'null');}catch{return null;}}
function write(key,v){try{root.localStorage.setItem(key,JSON.stringify(v));return true;}catch{return false;}}
const OWNER=KEY+'Owner',GUEST='@guest';
const scoped=(key,owner)=>key+'.'+encodeURIComponent(owner||GUEST);
const cachedIdentity=()=>{try{return root.localStorage.getItem('abyssalSessionToken')?ownerKey(read('abyssalAccount')?.nickname):'';}catch{return '';}};
let owner=cachedIdentity(),imported=null,scheduled=false;
const publishing=new Set();
function readScoped(name){const record=read(scoped(KEY,name));if(record)return {layout:normalize(record.layout),revision:Number(record.revision)||0};const marker=read(OWNER),legacy=read(KEY);return {layout:normalize((marker===null&&name===cachedIdentity()||marker===(name||GUEST))?legacy:null),revision:0};}
let record=readScoped(owner),saved=record.layout,revision=record.revision,runLayout=null,layoutPlan=null,hudObserver=null;
function storeCurrent(){const ok=write(scoped(KEY,owner),{layout:saved,revision});write(OWNER,owner||GUEST);write(KEY,saved);return ok;}
function pendingFor(name){const key=scoped(PENDING,name),v=read(key);if(v)return v;const old=read(PENDING);if(name&&ownerKey(old?.owner)===name&&old.layout){const next={layout:normalize(old.layout),changes:MODES.flatMap(mode=>PROFILES.map(device=>mode+':'+device))};write(key,next);try{root.localStorage.removeItem(PENDING);}catch{}return next;}return null;}
function switchOwner(name){name=ownerKey(name);if(name===owner)return;storeCurrent();owner=name;record=readScoped(owner);saved=record.layout;revision=record.revision;runLayout=null;layoutPlan=null;storeCurrent();schedule();}
storeCurrent();
const applied=new Map(),scales=new Map(),userHidden=new Set(),observedSizes=new Set();
const layoutSizeObserver=typeof root.ResizeObserver==='function'?new root.ResizeObserver(()=>schedule()):null;
function watchSizes(entries){if(!layoutSizeObserver)return;const next=new Set(entries.flatMap(e=>e.els));for(const el of observedSizes)if(!next.has(el)){layoutSizeObserver.unobserve(el);observedSizes.delete(el);}for(const el of next)if(!observedSizes.has(el)){observedSizes.add(el);layoutSizeObserver.observe(el);}}
function profile(){return doc.documentElement.classList.contains('abyssal-handheld')||root.matchMedia('(pointer: coarse)').matches||root.innerWidth<=700?root.innerWidth>root.innerHeight?'landscape':'portrait':'desktop';}
function gameMode(){return doc.body.dataset.hudMode==='online'?'online':'solo';}
function mobileControls(){try{return root.localStorage.getItem('abyssalControlsMobile')==='dual-stick'?'dual-stick':'classic';}catch{return 'classic';}}
function activeLayout(){return effectiveLayout(runLayout||saved,gameMode(),profile());}
function beginRun(){runLayout=normalize(saved);layoutPlan=null;schedule();}
function active(){return doc.body.classList.contains('game-active');}
function clear(){for(const el of applied.keys()){el.style.removeProperty('translate');el.style.removeProperty('scale');el.style.removeProperty('transform-origin');el.removeAttribute('data-hud-custom-opacity');el.style.removeProperty('--hud-custom-opacity');}applied.clear();scales.clear();for(const el of userHidden)el.removeAttribute('data-hud-user-hidden');userHidden.clear();}
// A plan is rebuilt only on a real viewport/mode/control/layout change.
// Hidden contextual controls keep their slots. Measure the full DOM once,
// synchronously, then restore every original visibility flag before painting.
function measurePlan(items,layout,raw,sr,safe,device){
 const changed=new Set(),collapsed=doc.body.classList.contains('hud-collapsed');
 if(collapsed)doc.body.classList.remove('hud-collapsed');
 const reveal=el=>{for(let p=el;p&&p!==doc.body;p=p.parentElement)if(p.hidden){changed.add(p);p.hidden=false;}};
 for(const item of items)for(const selector of item[2])for(const el of doc.querySelectorAll(selector))reveal(el);
 const entries=[];
 try{
  for(const item of items){
   const [id,,selectors]=item,els=visibleGroup(doc,selectors),g=groupRect(els);
   const dims=device==='desktop'?DESKTOP_BOXES[id]||[item[5],item[6]]:[item[5],item[6]];
   const box=g||{w:dims[0],h:dims[1]};
   const pos=layout[id]||(g?{x:(g.cx-sr.left)/sr.width,y:(g.cy-sr.top)/sr.height,s:1}:defaults(item,device));
   entries.push({id,pos,box,custom:Boolean(raw[id]),...(id==='skills'&&g?{reserve:skillReservation(els[0],g)}:{})});
  }
 }finally{
  for(const el of changed)el.hidden=true;
  if(collapsed)doc.body.classList.add('hud-collapsed');
  hudObserver?.takeRecords();
 }
 return planPositions(entries,sr.width,sr.height,safe,device);
}
function refresh(){
 scheduled=false;
 const shell=doc.getElementById('gameShell');
 if(!shell||!active()){clear();watchSizes([]);layoutPlan=null;runLayout=null;doc.body.classList.remove('custom-hud-active');return;}
 // The level-up modal hides HUD nodes by design. Do not replace their geometry
 // with a partial/empty layout while it is open.
 const upgrade=doc.getElementById('upgradeScreen');if(upgrade&&!upgrade.hidden)return;
 if(!runLayout)runLayout=normalize(saved);
 const device=profile(),mode=gameMode(),raw=modeLayout(runLayout,mode)[device],layout=effectiveLayout(runLayout,mode,device),safe=safeInsets(doc),controls=mobileControls();
 const sr=shell.getBoundingClientRect();if(!sr.width||!sr.height)return;
 const key=JSON.stringify([mode,device,controls,sr.width,sr.height,safe,raw]);
 doc.body.classList.add('custom-hud-active');
 clear();
 const items=eligibleItems(mode,device,controls);
 if(!layoutPlan||layoutPlan.key!==key)layoutPlan={key,...measurePlan(items,layout,raw,sr,safe,device)};
 const entries=[];
 for(const [id,,selectors] of items){
  const pos=layoutPlan.positions[id];
  if(canRemove(id)&&layout[id]?.hidden){for(const sel of selectors)for(const el of doc.querySelectorAll(sel)){el.setAttribute('data-hud-user-hidden','');userHidden.add(el);}continue;}
  if(!pos)continue;const els=visibleGroup(doc,selectors),g=groupRect(els);if(!g)continue;
  entries.push({id,els});
  const f=placeGroup(els,g,displayPosition(pos,layoutPlan.slots[id],g,sr.height),sr,safe);
  scales.set(id,f.s);for(const el of els)applied.set(el,true);
 }
 watchSizes(entries);
}
function schedule(){if(scheduled)return;scheduled=true;root.requestAnimationFrame(refresh);}
function publish(message,changes){
 if(!owner){message?.('Salvo neste dispositivo como visitante.');return;}
 const pending=pendingFor(owner),keys=[...new Set([...(pending?.changes||[]),...changes])];if(!keys.length){message?.('HUD salvo neste dispositivo.');return;}
 write(scoped(PENDING,owner),{layout:normalize(saved),changes:keys});
 message?.('HUD salvo localmente. Sincronização pendente.');
 flushPending(message);
}
function flushPending(message){
 const online=root.AbyssalOnline,name=owner,pending=pendingFor(name);
 if(!name||!pending||publishing.has(name)||!online?.isAuthenticated?.()||!online?.isConnected?.()||ownerKey(online.getAccount?.()?.nickname)!==name)return;
 publishing.add(name);
 const remote=normalize(online.getAccount()?.hudLayout),layout=mergeProfiles(remote,pending.layout,pending.changes);
 online.saveCosmetics({hudLayout:layout,hudLayoutChanges:pending.changes},res=>{
  publishing.delete(name);
  if(!res?.ok){message?.('HUD salvo localmente; sincronização pendente.');return;}
  const latest=pendingFor(name),same=JSON.stringify(latest)===JSON.stringify(pending),key=scoped(PENDING,name);
  if(same){try{root.localStorage.removeItem(key);}catch{}}
  if(owner!==name)return;
  const ackRevision=Number(res.account?.hudLayoutRevision)||0,known=online.getAccount?.(),knownRevision=Number(known?.hudLayoutRevision)||0;
  const authoritative=normalize(knownRevision>ackRevision?known.hudLayout:res.account?.hudLayout||layout);
  revision=Math.max(revision,ackRevision,knownRevision);
  saved=same?authoritative:mergeProfiles(authoritative,latest?.layout,latest?.changes);
  storeCurrent();schedule();message?.(same?'HUD salvo e disponível no seu perfil.':'HUD salvo localmente. Sincronizando novas alterações.');
  if(!same)flushPending(message);
 });
}
function reconcileAccount(event){
 const data=event?.detail,online=root.AbyssalOnline,name=ownerKey(data?.nickname);
 if(!name||!online?.isAuthenticated?.()||ownerKey(online.getAccount?.()?.nickname)!==name||!data.hudLayout)return;
 switchOwner(name);const incoming=Number(data.hudLayoutRevision)||0;
 if(incoming<revision)return;
 const remote=normalize(data.hudLayout),pending=pendingFor(name);
 if(pending){saved=mergeProfiles(remote,pending.layout,pending.changes);}
 else if(incoming===0&&revision===0&&!hasEdits(remote)&&hasEdits(saved)){
  // Old clients had no owner marker or revision. Only adopt a local legacy layout
  // already associated with this account, never another player's or a guest's.
  write(scoped(PENDING,name),{layout:normalize(saved),changes:changedProfiles(remote,saved)});
 }else saved=remote;
 revision=incoming;storeCurrent();schedule();flushPending();
}
const create=(tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
// Identical glyph, countdown and keyboard badge in the live HUD and editor iframe.
function renderAbilityButton(button,{icon,key,label,seconds=0,charge=null}){
 if(!button)return;const d=button.ownerDocument,make=(tag,cls)=>{const node=d.createElement(tag);node.className=cls;return node;};
 let glyph=button.querySelector('.ability-glyph'),timer=button.querySelector('.ability-timer'),badge=button.querySelector('.ability-key');
 if(!glyph||!timer||!badge){glyph=make('span','ability-glyph');glyph.setAttribute('aria-hidden','true');timer=make('span','ability-timer');badge=make('kbd','ability-key');badge.setAttribute('aria-hidden','true');button.replaceChildren(glyph,timer,badge);}
 if(button.dataset.abilityIcon!==icon||!glyph.firstChild){const node=root.AbyssalResearchTree?.iconFor?.(icon,'◈');if(node)glyph.replaceChildren(d.importNode(node,true));button.dataset.abilityIcon=icon;}
 const cooling=Number(seconds)>0,remaining=cooling?Math.max(.1,Number(seconds)).toFixed(1)+'s':'';
 glyph.hidden=cooling;timer.hidden=!cooling;if(timer.textContent!==remaining)timer.textContent=remaining;
 if(badge.textContent!==key)badge.textContent=key;
 let meter=button.querySelector('.ability-charge');if(charge!==null){if(!meter){meter=make('span','ability-charge');meter.setAttribute('aria-hidden','true');button.append(meter);}const value=String(charge)+'%';if(meter.textContent!==value)meter.textContent=value;}else meter?.remove();
 const accessible=label+(cooling?' · '+remaining:charge!==null?' · '+charge+'%':'');if(button.getAttribute('aria-label')!==accessible){button.setAttribute('aria-label',accessible);button.title=accessible;}
}
const DESKTOP_DEFAULTS={stats:[.14,.395],health:[.14,.135],xp:[.14,.18],energy:[.14,.225],progress:[.14,.305],skills:[.915,.185],pause:[.97,.045],hide:[.815,.13],pulse:[.405,.90],dash:[.48,.90],petSkill:[.565,.90],pet:[.042,.70],repair:[.045,.59],power:[.50,.955],end:[.925,.115],comms:[.93,.55]};
const DESKTOP_BOXES={stats:[330,40],health:[330,28],xp:[330,24],energy:[330,34],progress:[330,64],skills:[48,112],pulse:[48,48],dash:[48,48],petSkill:[48,48],pet:[80,112],power:[48,48],repair:[80,42],end:[156,32]};
const LANDSCAPE_DEFAULTS={stats:[.23,.06],health:[.23,.13],xp:[.23,.19],energy:[.23,.25],progress:[.23,.31],skills:[.90,.28],pulse:[.39,.92],dash:[.50,.92],petSkill:[.61,.92],pet:[.12,.67],repair:[.08,.50],power:[.17,.50]};
function defaults(item,profile){const pos=(profile==='desktop'?DESKTOP_DEFAULTS:profile==='landscape'?LANDSCAPE_DEFAULTS:{})[item[0]];return {x:pos?.[0]??item[3],y:pos?.[1]??item[4],s:1};}
function previewSpecimenIcon(){try{const equipped=root.AbyssalOnline?.getAccount?.()?.equippedSkin||root.localStorage.getItem('abyssalSkin')||'default';return root.AbyssalSkinStandard?.activeSpec?.(equipped)?.id||'petAttack';}catch{return 'petAttack';}}
function createPage(){const editorOwner=owner,starting=normalize(saved);let copied=Boolean(imported),draft=normalize(imported?.layout||saved),selectedProfile=profile(),selectedMode=active()?gameMode():'solo',selected='aim',source=imported?.name||'';imported=null;
 const page=create('dialog','hud-editor hud-editor-fullscreen'),title=create('p','hud-editor-note',source?'HUD de '+source+' carregado em prévia. Salve para substituir seu layout.':'Selecione o mergulho e arraste os controles. Cada modo e dispositivo tem seu próprio layout.');
 const bar=create('div','hud-editor-toolbar'),sel=create('select');sel.setAttribute('aria-label','Layout do dispositivo');for(const [id,label] of [['portrait','Celular vertical'],['landscape','Celular horizontal'],['desktop','Computador']]){const o=create('option','',label);o.value=id;sel.append(o);}sel.value=selectedProfile;
 const itemSel=create('select');itemSel.setAttribute('aria-label','Elemento da interface');const modeSel=create('select');modeSel.setAttribute('aria-label','Modo de jogo');for(const [id,label] of [['solo','Mergulho Solo'],['online','Mergulho Online']]){const o=create('option','',label);o.value=id;modeSel.append(o);}modeSel.value=selectedMode;bar.append(sel,itemSel,modeSel);
 const stage=create('div','hud-editor-stage');stage.dataset.profile=selectedProfile;stage.setAttribute('aria-label','Prévia da interface de jogo');
 const tools=create('div','hud-editor-context'),contextName=create('strong','hud-editor-context-name'),size=create('input'),sizeLabel=create('label','hud-editor-size','Tamanho '),amount=create('output','','100%'),smaller=create('button','','−'),larger=create('button','','+'),dismiss=create('button','','Fechar opções');size.type='range';size.min='65';size.max='160';size.step='5';smaller.type=larger.type=dismiss.type='button';smaller.setAttribute('aria-label','Diminuir elemento');larger.setAttribute('aria-label','Aumentar elemento');sizeLabel.append(amount,size);const stepper=create('div','hud-editor-stepper');stepper.append(smaller,sizeLabel,larger);const opacity=create('input'),opacityLabel=create('label','hud-editor-size hud-editor-opacity','Opacidade '),opacityAmount=create('output','','100%');opacity.type='range';opacity.min='15';opacity.max='100';opacity.step='5';opacity.setAttribute('aria-label','Opacidade do elemento');opacityLabel.append(opacityAmount,opacity);tools.append(contextName,stepper,opacityLabel);tools.hidden=true;
 const removeItem=create('button','hud-editor-remove','Excluir elemento'),resetItem=create('button','','Restaurar elemento'),reset=create('button','','Restaurar layout'),save=create('button','primary-btn','Salvar HUD'),status=create('p','hud-editor-note');status.setAttribute('role','status');for(const b of [removeItem,resetItem,reset,save])b.type='button';const contextActions=create('div','hud-editor-context-actions');contextActions.append(removeItem,resetItem,dismiss);tools.append(contextActions);const dock=create('div','hud-editor-dock'),dockRow=create('div','hud-editor-dock-row'),settings=create('button','','Configurar'),close=create('button','','Voltar'),settingsPanel=create('div','hud-editor-settings'),previewBtn=create('button','','Prévia');previewBtn.type=settings.type=close.type='button';settings.setAttribute('aria-expanded','false');settingsPanel.hidden=true;bar.append(reset);settingsPanel.append(title,bar);dockRow.append(close,settings,previewBtn,save);dock.append(settingsPanel,dockRow,status);page.setAttribute('aria-label','Editor de HUD em tela cheia');page.append(stage,tools,dock);previewBtn.onclick=()=>{const on=page.classList.toggle('hud-editor-inspect');previewBtn.textContent=on?'Editar':'Prévia';tools.hidden=true;settingsPanel.hidden=true;settings.setAttribute('aria-expanded','false');};settings.onclick=()=>{settingsPanel.hidden=!settingsPanel.hidden;settings.setAttribute('aria-expanded',String(!settingsPanel.hidden));};const exit=()=>{page.close?.();root.AbyssalCockpitNavigation?.back?.();};close.onclick=exit;page.addEventListener('cancel',e=>{e.preventDefault();exit();});page.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();exit();}});dismiss.onclick=()=>{tools.hidden=true;};stage.addEventListener('pointerdown',e=>{if(e.target===stage){tools.hidden=true;settingsPanel.hidden=true;settings.setAttribute('aria-expanded','false');}});
 const eligible=()=>eligibleItems(selectedMode,selectedProfile,mobileControls());
 const selectedLayout=()=>modeLayout(draft,selectedMode);
 const getItem=()=>ITEMS.find(i=>i[0]===selected);
 function target(item){const m=metrics.get(item[0]);return selectedLayout()[selectedProfile][item[0]]||defaultLayout(selectedMode,selectedProfile)[item[0]]||(m?{x:m.x,y:m.y,s:1}:defaults(item,selectedProfile));}
 function current(item){return selectedLayout()[selectedProfile][item[0]]||resolvedPreview[item[0]]||target(item);}
 function updateSize(){const item=getItem(),v=current(item);contextName.textContent=item[1];opacity.min=String(canRemove(item[0])?15:35);opacity.value=String(Math.round((v.o??1)*100));opacityAmount.textContent=opacity.value+'%';opacity.disabled=Boolean(v.hidden);size.max=String(scaleLimit(item[0])*100);size.disabled=Boolean(v.hidden);smaller.disabled=Boolean(v.hidden)||v.s<=.65;larger.disabled=Boolean(v.hidden)||v.s>=scaleLimit(item[0]);removeItem.disabled=!canRemove(item[0])||Boolean(v.hidden);size.value=String(Math.round(v.s*100));const m=metrics.get(selected),vfit=m&&fit(v,m,reference[0],reference[1],previewSafe);amount.textContent=size.value+'%'+(vfit?' · '+Math.round(m.w*vfit.s)+' × '+Math.round(m.h*vfit.s)+' px':'');}
 const previewEls=new Map();let frame=null,metrics=new Map(),resolvedPreview={},reference=[360,640],generation=0,previewSafe={},paintQueued=false,lastDevice=profile();
 function referenceSize(){if(profile()===selectedProfile)return [Math.max(1,Math.round(root.innerWidth)),Math.max(1,Math.round(root.innerHeight))];return selectedProfile==='portrait'?[360,640]:selectedProfile==='landscape'?[844,390]:[1280,720];}
 function paintBackdrop(canvas,w,h){const c=canvas.getContext('2d');if(!c)return;const density=Math.min(root.devicePixelRatio||1,2,Math.sqrt(2000000/(w*h)));canvas.width=Math.round(w*density);canvas.height=Math.round(h*density);canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';const live=doc.getElementById('game');if(active()&&live?.width&&live?.height&&profile()===selectedProfile){c.drawImage(live,0,0,canvas.width,canvas.height);canvas.dataset.scene='live';return;}const cavern=root.AbyssalSoloCavern;if(!cavern)return;const zoom=Math.max(.36,Math.min(selectedProfile==='desktop'?1.2:.70,Math.min(w,h)/(2*(294/.78)*1.08))),ww=w/zoom,hh=h/zoom,rocks=cavern.buildRocks(4800,3000),water=cavern.nearestWater(rocks,4800,3000,2400,680,95)||{x:2400,y:330},px=water.x,py=water.y,view={left:Math.max(0,Math.min(4800-ww,px-ww/2)),top:Math.max(0,Math.min(3000-hh,py-hh/2)),width:ww,height:hh},diver={x:px,y:py,r:13/.78,bodyAngle:-.7,angle:-.7};c.setTransform(canvas.width/ww,0,0,canvas.height/hh,-view.left*canvas.width/ww,-view.top*canvas.height/hh);cavern.paint(c,view,1800,4800,3000,selectedProfile!=='desktop',true);cavern.drawRocks(c,rocks,view,1800,selectedProfile!=='desktop');root.AbyssalDiverArt?.draw?.(c,px,py,diver.r,-.7,-.7,1800,{gender:'male',gameplay:true,detail:true,appearance:root.AbyssalAvatarBase?.get(),heldItem:'abyssWeapon',helmetLamp:true});cavern.lighting(c,view,diver,root.AbyssalSoloProgress?.get?.().lamp||1,rocks,1800,[],selectedProfile!=='desktop');canvas.dataset.scene='cavern';}
 function measurePreview(){
  const gen=++generation;metrics=new Map();resolvedPreview={};reference=referenceSize();previewSafe=selectedProfile===profile()?safeInsets(doc):{};delete stage.dataset.measured;
  frame?.remove();frame=create('iframe','hud-editor-live-preview');frame.title='Prévia visual dos controles';frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.style.width=reference[0]+'px';frame.style.height=reference[1]+'px';stage.prepend(frame);
  const d=frame.contentDocument,shell=doc.getElementById('gameShell');if(!d||!shell)return;
  d.open();d.write('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>');d.close();
  d.documentElement.className=selectedProfile==='desktop'?'':('abyssal-handheld mobile-game-active'+(selectedProfile==='landscape'?' abyssal-handheld-landscape':''));
  for(const edge of ['left','right','top','bottom'])if(previewSafe[edge])d.documentElement.style.setProperty('--mobile-safe-'+edge,Math.max(6,previewSafe[edge])+'px');
  d.body.className='game-active abyss-solo-run custom-hud-active'+(selectedProfile==='desktop'?'':' mobile-game-active');d.body.dataset.hudMode=selectedMode;
  const app=d.createElement('div');app.id='app';d.body.append(app);
  const copy=d.importNode(shell,true);copy.querySelectorAll('script,canvas,.screen,.modal-screen,dialog,.hud-editor').forEach(e=>e.remove());app.append(copy);const backdrop=d.createElement('canvas');backdrop.id='game';copy.prepend(backdrop);paintBackdrop(backdrop,reference[0],reference[1]);
  const top=doc.querySelector('.topbar');if(top&&selectedProfile==='desktop')app.prepend(d.importNode(top,true));
  if(!copy.querySelector('#soloSubmarineRepairBtn')){const b=d.createElement('button');b.id='soloSubmarineRepairBtn';b.innerHTML='<span>🔧</span><small>REPARAR</small>';copy.querySelector('#petHabitBar')?.prepend(b);}
  let power=copy.querySelector('#soloSubmarinePowerBtn');if(!power){power=d.createElement('button');power.id='soloSubmarinePowerBtn';copy.append(power);}power.classList.remove('abyss-map-interact');power.classList.add('compact-submarine-power');power.innerHTML='<span aria-hidden="true">⚡</span><small class="sub-power-cost">20</small>';(selectedProfile==='desktop'?copy:copy.querySelector('#petHabitBar')||copy).prepend(power);
  for(const item of eligible())for(const sel of item[2])for(const el of d.querySelectorAll(sel)){el.hidden=false;el.removeAttribute('disabled');for(let p=el.parentElement;p&&p!==d.body;p=p.parentElement)p.hidden=false;el.style.removeProperty('translate');el.style.removeProperty('scale');el.style.removeProperty('transform-origin');el.removeAttribute('data-hud-user-hidden');el.removeAttribute('data-hud-custom-opacity');el.style.removeProperty('--hud-custom-opacity');}
  const stick=d.getElementById('mobileJoystick');if(stick){stick.hidden=true;stick.classList.remove('is-floating');}
  const aim=d.getElementById('mobileAimStick');if(aim){aim.classList.toggle('dual-stick-visible',selectedProfile!=='desktop'&&mobileControls()==='dual-stick');aim.hidden=mobileControls()!=='dual-stick';}
  if(selectedMode==='solo')d.getElementById('quickComms')?.setAttribute('hidden','');
  for(const [id,icon,key,label] of [['skillPulseBtn','pulse','Q','Pulso de maré'],['skillDashBtn','dash','E','Propulsor'],['skinActiveBtn',previewSpecimenIcon(),'R','Habilidade do espécime']]){renderAbilityButton(d.getElementById(id),{icon,key,label,charge:key==='E'?100:null});}
  const skillList=d.getElementById('selectedSkillsList');if(skillList){skillList.replaceChildren();const icon=root.AbyssalResearchTree?.iconFor?.('photon','☄');if(icon){const btn=d.createElement('button');btn.type='button';btn.className='selected-skill-row';btn.dataset.skillId='photon';btn.setAttribute('aria-label','Lança de Fótons, nível 1');const lv=d.createElement('strong');lv.textContent='1';btn.append(d.importNode(icon,true),lv);skillList.replaceChildren(btn);}}
  let pending=0,ready=false;const done=()=>{if(ready||pending||gen!==generation)return;ready=true;root.requestAnimationFrame(()=>{if(gen!==generation)return;const sr=copy.getBoundingClientRect();if(!sr.width||!sr.height)return;for(const item of eligible()){const els=visibleGroup(d,item[2]),g=groupRect(els);if(g)metrics.set(item[0],{w:g.w,h:g.h,x:(g.cx-sr.left)/sr.width,y:(g.cy-sr.top)/sr.height,g,els,sr,...(item[0]==='skills'?{reserve:skillReservation(els[0],g)}:{})});}stage.dataset.measured='true';paint();});};
  const css=Array.from(doc.querySelectorAll('link[rel="stylesheet"],style'));for(const node of css){const n=d.importNode(node,true);if(n.tagName==='LINK'){n.href=node.href;pending++;n.onload=n.onerror=()=>{pending--;done();};}d.head.append(n);}
  const fix=d.createElement('style');fix.textContent='html,body{overflow:hidden!important;margin:0!important} #app{padding:0!important} #gameShell{background:radial-gradient(ellipse at 50% 45%,#154653,#092632 52%,#030e17)!important}';d.head.append(fix);done();root.setTimeout(()=>{pending=0;done();},1800);
 }
 function paint(){const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;const w=reference[0],h=reference[1],factor=Math.min(stage.clientWidth/w,stage.clientHeight/h),ox=(stage.clientWidth-w*factor)/2,oy=(stage.clientHeight-h*factor)/2;if(frame){const transform='translate('+ox+'px,'+oy+'px) scale('+factor+')';if(frame.style.transform!==transform)frame.style.transform=transform;}stage.dataset.scale=String(factor);const entries=eligible().map(item=>{const m=metrics.get(item[0]),dimensions=selectedProfile==='desktop'?DESKTOP_BOXES[item[0]]||[item[5],item[6]]:[item[5],item[6]];return {id:item[0],pos:target(item),box:m||{w:dimensions[0],h:dimensions[1]},custom:Boolean(selectedLayout()[selectedProfile][item[0]]),reserve:m?.reserve};});const planned=planPositions(entries,w,h,previewSafe,selectedProfile);resolvedPreview=planned.positions;for(const item of eligible()){const el=previewEls.get(item[0]);if(!el)continue;const m=metrics.get(item[0]),dimensions=selectedProfile==='desktop'?DESKTOP_BOXES[item[0]]||[item[5],item[6]]:[item[5],item[6]],box=m||{w:dimensions[0],h:dimensions[1]},v=resolvedPreview[item[0]]||target(item),display=displayPosition(v,planned.slots[item[0]],box,h),f=fit(display,box,w,h,previewSafe);el.style.left=ox+f.x*factor+'px';el.style.top=oy+f.y*factor+'px';el.style.width=box.w*f.s*factor+'px';el.style.height=box.h*f.s*factor+'px';el.style.fontSize=Math.max(8,12*factor*f.s)+'px';el.dataset.realWidth=String(box.w*f.s);el.dataset.realHeight=String(box.h*f.s);el.dataset.live=String(Boolean(m));el.hidden=Boolean(v.hidden);if(m){const sig=[v.x,v.y,v.s,v.o??1,Boolean(v.hidden)].join(':');if(m.signature!==sig){m.signature=sig;for(const node of m.els)node.toggleAttribute('data-hud-user-hidden',Boolean(v.hidden));if(!v.hidden)placeGroup(m.els,m.g,display,m.sr,previewSafe);}}const option=Array.from(itemSel.options).find(o=>o.value===item[0]);if(option)option.textContent=item[1]+(v.hidden?' (excluído)':'');el.setAttribute('aria-pressed',String(item[0]===selected));if(item[0]===selected)tools.dataset.side=f.y>h*.50?'top':'bottom';}updateSize();}
 function queuePaint(){if(paintQueued)return;paintQueued=true;root.requestAnimationFrame(()=>{paintQueued=false;if(page.isConnected)paint();});}
 function select(id){selected=id;itemSel.value=id;tools.hidden=false;settingsPanel.hidden=true;settings.setAttribute('aria-expanded','false');paint();}
 function rebuild(){const items=eligible();if(!items.some(i=>i[0]===selected))selected=items[0][0];itemSel.replaceChildren();stage.replaceChildren();previewEls.clear();for(const item of items){const o=create('option','',item[1]);o.value=item[0];itemSel.append(o);const labels={stats:'TEMPO · NV · BOSSES · DANO',health:'VITALIDADE',xp:'ENERGIA · EVOLUÇÃO',energy:'ENERGIA / BASE',progress:'CICLO · PROGRESSÃO',skills:'RESSONÂNCIA',pause:'Ⅱ',hide:'›',pulse:'Q · PULSO',dash:'E · PROPULSOR',petSkill:'R · PET',pet:'PASSIVO',repair:'🔧',power:'⚡ 20',fire:'DISPARO',comms:'💬',end:'ENCERRAR'};const b=create('button','hud-editor-piece',labels[item[0]]||item[1]);b.setAttribute('aria-label',item[1]);b.type='button';b.dataset.item=item[0];if(item[0]==='aim'){b.classList.add('hud-editor-reticle');b.textContent='';b.setAttribute('aria-label',item[1]);}let drag=null;b.addEventListener('pointerdown',e=>{e.preventDefault();select(item[0]);const br=b.getBoundingClientRect();drag={id:e.pointerId,dx:e.clientX-br.left-br.width/2,dy:e.clientY-br.top-br.height/2};b.setPointerCapture?.(e.pointerId);});b.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const r=stage.getBoundingClientRect(),v=current(item);selectedLayout()[selectedProfile][item[0]]={...v,x:clamp((e.clientX-r.left-stage.clientLeft-drag.dx-(stage.clientWidth-reference[0]*Math.min(stage.clientWidth/reference[0],stage.clientHeight/reference[1]))/2)/(reference[0]*Math.min(stage.clientWidth/reference[0],stage.clientHeight/reference[1])),0,1),y:clamp((e.clientY-r.top-stage.clientTop-drag.dy-(stage.clientHeight-reference[1]*Math.min(stage.clientWidth/reference[0],stage.clientHeight/reference[1]))/2)/(reference[1]*Math.min(stage.clientWidth/reference[0],stage.clientHeight/reference[1])),0,1)};queuePaint();});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>{drag=null;});b.addEventListener('click',()=>select(item[0]));b.addEventListener('keydown',e=>{const dx=e.key==='ArrowLeft'?-.01:e.key==='ArrowRight'?.01:0,dy=e.key==='ArrowUp'?-.01:e.key==='ArrowDown'?.01:0;if(!dx&&!dy)return;e.preventDefault();const v=current(item);selectedLayout()[selectedProfile][item[0]]={...v,x:clamp(v.x+dx,0,1),y:clamp(v.y+dy,0,1)};paint();});previewEls.set(item[0],b);stage.append(b);}itemSel.value=selected;stage.dataset.profile=selectedProfile;stage.dataset.mode=selectedMode;root.requestAnimationFrame(()=>{if(page.isConnected)measurePreview();paint();});}
 modeSel.onchange=()=>{snapshotPreview();selectedMode=modeSel.value;tools.hidden=true;rebuild();};sel.onchange=()=>{snapshotPreview();selectedProfile=sel.value;tools.hidden=true;rebuild();};itemSel.onchange=()=>select(itemSel.value);
 function changeSize(n){const item=getItem();if(current(item).hidden)return;selectedLayout()[selectedProfile][item[0]]={...current(item),s:clamp(Math.round(n*100)/100,.65,scaleLimit(item[0]))};paint();}size.oninput=()=>changeSize(Number(size.value)/100);smaller.onclick=()=>changeSize(current(getItem()).s-.05);larger.onclick=()=>changeSize(current(getItem()).s+.05);opacity.oninput=()=>{const item=getItem(),v=current(item);if(v.hidden)return;selectedLayout()[selectedProfile][item[0]]={...v,o:clamp(Number(opacity.value)/100,canRemove(item[0])?.15:.35,1)};paint();};
 removeItem.onclick=()=>{const item=getItem();if(!canRemove(item[0]))return;selectedLayout()[selectedProfile][item[0]]={...current(item),hidden:true};paint();status.textContent='Elemento excluído em prévia. Use Restaurar elemento para recuperá-lo.';};
 resetItem.onclick=()=>{delete selectedLayout()[selectedProfile][selected];paint();status.textContent='Elemento restaurado em prévia.';};
 reset.onclick=()=>{selectedLayout()[selectedProfile]={};paint();status.textContent='Layout restaurado em prévia.';};
 let lastSaved=normalize(starting);
 function snapshotPreview(){
  const key=selectedMode+':'+selectedProfile,raw=selectedLayout()[selectedProfile];
  if(copied||!changedProfiles(lastSaved,normalize(draft)).includes(key)||!Object.keys(raw).length||stage.dataset.measured!=='true')return;
  for(const item of eligible()){const id=item[0];if(!raw[id]&&resolvedPreview[id])raw[id]={...resolvedPreview[id]};}
 }
 save.onclick=()=>{
  if(editorOwner!==owner){status.textContent='A conta mudou. Reabra o editor para salvar o HUD correto.';return;}
  // Freeze the measured preview for each edited orientation. Explicit restores remain empty.
  snapshotPreview();const next=normalize(draft),changes=copied?MODES.flatMap(m=>PROFILES.map(p=>m+':'+p)):changedProfiles(lastSaved,next);
  saved=mergeProfiles(saved,next,changes);if(!storeCurrent()){status.textContent='Não foi possível salvar neste dispositivo.';return;}
  draft=normalize(saved);lastSaved=normalize(saved);copied=false;if(active()){runLayout=normalize(saved);layoutPlan=null;}schedule();status.textContent='HUD salvo neste dispositivo.';
  publish(v=>{status.title=v;status.textContent=v;},changes);
 };
 root.requestAnimationFrame(()=>{if(page.isConnected&&!page.open){if(typeof page.showModal==='function')page.showModal();else page.setAttribute('open','');}});rebuild();const observer=new ResizeObserver(paint);observer.observe(stage);const viewportChanged=()=>{const device=profile();if(selectedProfile===lastDevice&&device!==lastDevice){snapshotPreview();selectedProfile=device;sel.value=device;lastDevice=device;tools.hidden=true;rebuild();return;}lastDevice=device;const next=referenceSize();if(next[0]!==reference[0]||next[1]!==reference[1])measurePreview();};root.addEventListener('resize',viewportChanged);const life=new MutationObserver(()=>{if(page.hudEditorAnchor&&!page.hudEditorAnchor.isConnected)page.remove();if(!page.isConnected){generation++;observer.disconnect();root.removeEventListener('resize',viewportChanged);life.disconnect();}});root.requestAnimationFrame(()=>{if(page.isConnected)life.observe(doc.body,{childList:true,subtree:true});else observer.disconnect();});return page;
}
function copyFromProfile(layout,name){if(layout==null)return false;imported={layout:normalize(layout),name:String(name||'jogador')};const nav=root.AbyssalCockpitNavigation;if(nav?.routeCommand?.('hudEditor'))return true;nav?.open?.();if(nav?.routeCommand?.('hudEditor'))return true;imported=null;return false;}
root.AbyssalHudLayout=Object.freeze({...core,createPage,copyFromProfile,renderAbilityButton,beginRun,refresh:schedule,scaleFor:id=>scales.get(id)||1,get:()=>normalize(saved),getEffective:(mode,device)=>effectiveLayout(saved,mode,device)});
const selectors=ITEMS.flatMap(i=>i[2]).join(',');
function install(){const obs=hudObserver=new MutationObserver(records=>{if(!Object.keys(activeLayout()).length&&!applied.size)return;if(!active()&&!applied.size)return;for(const rec of records){if(rec.type==='attributes'){if(rec.oldValue===rec.target.getAttribute(rec.attributeName))continue;if(rec.target===doc.body||rec.target===doc.documentElement||rec.target.matches?.(selectors)||rec.target.id==='quickComms'||rec.target.id==='petHabitBar'||rec.target.id==='upgradeScreen') {schedule();return;}}else if([...rec.addedNodes].some(n=>n.nodeType===1&&(n.matches?.(selectors)||n.querySelector?.(selectors)))){schedule();return;}}});obs.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','data-hud-mode'],attributeOldValue:true});obs.observe(doc.documentElement,{attributes:true,attributeFilter:['class'],attributeOldValue:true});root.addEventListener('resize',schedule,{passive:true});root.addEventListener('orientationchange',schedule);root.addEventListener('abyssal-account-data',reconcileAccount);root.addEventListener('abyssal-account-signed-out',()=>switchOwner(''));root.addEventListener('abyssal-authenticated',()=>flushPending());root.addEventListener('storage',e=>{if(e.key===scoped(KEY,owner)){const next=readScoped(owner);if(next.revision>=revision){saved=next.layout;revision=next.revision;schedule();}}});schedule();}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(typeof globalThis!=='undefined'?globalThis:this);
