/* Per-device HUD editor. Normalized anchors, independent orientation profiles,
   no network persistence, no changes to combat unlocks or cooldowns. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else if(root?.document)api.mount(root);})(typeof window!=='undefined'?window:null,function(){
'use strict';
const KEY='abyssalHudLayoutV1',clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ITEMS=[
 ['hud','Indicadores',.5,.13,.5,.16],['toggleHudBtn','Ocultar HUD',.09,.06,.115,.08],['mobilePauseBtn','Pausa',.91,.06,.115,.08],
 ['selectedSkillsPanel','Ressonância',.82,.30,.30,.13],['runEnergyRanking','Ranking',.18,.30,.30,.13],
 ['mobileMoveStick','Mover (fixo)',.14,.82,.22,.15],['mobileAimStick','Mira',.86,.85,.22,.15],['mobileFireBtn','Disparar',.86,.69,.14,.095],
 ['skillPulseBtn','Q · Pulso',.12,.94,.13,.085],['skillDashBtn','E · Propulsor',.29,.94,.13,.085],['skinActiveBtn','R · Espécime',.46,.94,.13,.085],
 ['petHabitBar','Espécime / submarino',.17,.70,.27,.17],['quickComms','Emojis',.50,.80,.14,.09]
];
const IDS=new Set(ITEMS.map(x=>x[0]));
function clean(raw){const out={portrait:{},landscape:{}};for(const o of Object.keys(out)){for(const [id,v] of Object.entries(raw?.[o]||{})){if(!IDS.has(id)||!v||![v.x,v.y,v.s].every(Number.isFinite))continue;out[o][id]={x:clamp(v.x,0,1),y:clamp(v.y,0,1),s:clamp(v.s,.75,1.65)};}}return out;}
function bound(x,y,w,h,vw,vh,pad=6){const minX=Math.min(vw/2,w/2+pad),minY=Math.min(vh/2,h/2+pad);return {x:clamp(x,minX,Math.max(minX,vw-minX)),y:clamp(y,minY,Math.max(minY,vh-minY))};}
function mount(win){
 const doc=win.document,by=id=>doc.getElementById(id),orientation=()=>win.innerWidth>win.innerHeight?'landscape':'portrait';
 let profiles;try{profiles=clean(JSON.parse(win.localStorage.getItem(KEY)||'{}'));}catch{profiles=clean({});}
 let overlay=null,stage=null,range=null,label=null,status=null,orientationSelect=null,draft=null,editingOrientation=null,selected=null,drag=null,frame=0,applied=new Map();
 const visible=el=>el&&!el.hidden&&el.getClientRects().length&&win.getComputedStyle(el).visibility!=='hidden'&&win.getComputedStyle(el).display!=='none';
 const rect=el=>el.getBoundingClientRect();
 function anchor(el){return el?.id==='quickComms'?by('quickCommsToggle')||el:el;}
 function clear(){for(const [el,old] of applied){for(const [prop,val,priority] of old){if(val)el.style.setProperty(prop,val,priority);else el.style.removeProperty(prop);}delete el.dataset.hudScale;}applied.clear();}
 function hasFixedMove(){return Boolean(profiles[orientation()].mobileMoveStick);}
 function apply(){
  frame=0;clear();const active=doc.body.classList.contains('game-active')&&doc.body.classList.contains('mobile-game-active');
  const move=by('mobileMoveStick');move?.classList.toggle('dual-stick-visible',active&&hasFixedMove());
  if(!active)return;
  const profile=profiles[orientation()],vw=win.innerWidth,vh=win.innerHeight;
  for(const [id,v] of Object.entries(profile)){
   const el=by(id);if(!visible(el))continue;
   const a=anchor(el);if(!visible(a))continue;
   const r=rect(a);if(r.width<1||r.height<1)continue;
   // Contextual submarine actions move with the specimen control, preserving their arrangement.
   let top=r.top,left=r.left,right=r.right,bottom=r.bottom;
   if(id==='petHabitBar')for(const childId of ['soloSubmarinePowerBtn','soloSubmarineRepairBtn']){const child=by(childId);if(visible(child)){const q=rect(child);top=Math.min(top,q.top);left=Math.min(left,q.left);right=Math.max(right,q.right);bottom=Math.max(bottom,q.bottom);}}
   const cx=r.left+r.width/2,cy=r.top+r.height/2;
   const scale=Math.min(v.s,Math.max(.75,(vw-12)/Math.max(1,right-left)),Math.max(.75,(vh-12)/Math.max(1,bottom-top)));
   const minX=(cx-left)*scale+6,maxX=vw-(right-cx)*scale-6,minY=(cy-top)*scale+6,maxY=vh-(bottom-cy)*scale-6;
   const x=clamp(v.x*vw,Math.min(minX,vw/2),Math.max(maxX,vw/2)),y=clamp(v.y*vh,Math.min(minY,vh/2),Math.max(maxY,vh/2));
   const old=['translate','scale','transform-origin'].map(p=>[p,el.style.getPropertyValue(p),el.style.getPropertyPriority(p)]);applied.set(el,old);
   const er=rect(el);el.style.setProperty('transform-origin',((cx-er.left)/Math.max(1,er.width)*100)+'% '+((cy-er.top)/Math.max(1,er.height)*100)+'%','important');
   el.style.setProperty('translate',(x-cx)+'px '+(y-cy)+'px','important');el.style.setProperty('scale',String(scale),'important');el.dataset.hudScale=String(scale);
  }
 }
 function schedule(){if(!frame)frame=win.requestAnimationFrame(apply);}
 function dimensions(){const landscape=editingOrientation==='landscape';return landscape?{w:844,h:390}:{w:390,h:844};}
 function defaultValue(item){const [id,,x,y]=item;if(editingOrientation===orientation()&&doc.body.classList.contains('game-active')){const el=anchor(by(id));if(visible(el)){const r=rect(el),scale=Number(by(id)?.dataset.hudScale)||1;return {x:clamp((r.left+r.width/2)/win.innerWidth,0,1),y:clamp((r.top+r.height/2)/win.innerHeight,0,1),s:scale};}}if(editingOrientation==='landscape'){const map={hud:[.5,.13],toggleHudBtn:[.05,.09],mobilePauseBtn:[.95,.09],selectedSkillsPanel:[.90,.30],runEnergyRanking:[.10,.30],mobileMoveStick:[.10,.80],mobileAimStick:[.90,.80],mobileFireBtn:[.90,.53],skillPulseBtn:[.39,.90],skillDashBtn:[.50,.90],skinActiveBtn:[.61,.90],petHabitBar:[.13,.50],quickComms:[.50,.66]};return {x:map[id][0],y:map[id][1],s:1};}return {x,y,s:1};}
 let defaults={};
 function get(id){return draft[editingOrientation][id]||defaults[id];}
 function previewSize(item){const [, , , ,w,h]=item;const d=dimensions();return editingOrientation==='landscape'?{w:Math.min(.45,w*390/d.w),h:Math.min(.55,h*844/d.h)}:{w,h};}
 function render(){
  const d=dimensions();stage.style.aspectRatio=d.w+'/'+d.h;stage.classList.toggle('landscape',editingOrientation==='landscape');orientationSelect.value=editingOrientation;
  for(const item of ITEMS){const id=item[0],el=stage.querySelector('[data-hud-item="'+id+'"]'),v=get(id),sz=previewSize(item);el.style.left=v.x*100+'%';el.style.top=v.y*100+'%';el.style.width=sz.w*100*v.s+'%';el.style.height=sz.h*100*v.s+'%';el.classList.toggle('selected',id===selected);el.setAttribute('aria-pressed',String(id===selected));}
  range.value=String(Math.round(get(selected).s*100));label.textContent=ITEMS.find(x=>x[0]===selected)[1]+' · '+range.value+'%';
  const boxes=ITEMS.filter(x=>!['hud','selectedSkillsPanel','runEnergyRanking'].includes(x[0])).map(item=>{const v=get(item[0]),z=previewSize(item);return {x:v.x,y:v.y,w:z.w*v.s,h:z.h*v.s,id:item[0]};});
  const overlap=boxes.some((a,i)=>boxes.slice(i+1).some(b=>Math.abs(a.x-b.x)<(a.w+b.w)*.45&&Math.abs(a.y-b.y)<(a.h+b.h)*.45));
  status.textContent=overlap?'Atenção: alguns controles estão próximos ou sobrepostos. Ajuste se necessário.':'Arraste os controles. Selecione um para ajustar o tamanho.';
 }
 function change(id,value){const item=ITEMS.find(x=>x[0]===id),sz=previewSize(item),r=rect(stage);const p=bound(value.x*r.width,value.y*r.height,sz.w*r.width*value.s,sz.h*r.height*value.s,r.width,r.height,2);draft[editingOrientation][id]={x:p.x/r.width,y:p.y/r.height,s:clamp(value.s,.75,1.65)};render();}
 function setOrientation(o){editingOrientation=o;defaults=Object.fromEntries(ITEMS.map(item=>[item[0],defaultValue(item)]));render();}
 function close(){if(!overlay)return;overlay.hidden=true;draft=null;drag=null;doc.body.classList.remove('hud-layout-editing');}
 function open(){
  if(!overlay)build();
  if(!overlay.hidden)return;
  draft=clean(profiles);selected='skillPulseBtn';overlay.hidden=false;doc.body.classList.add('hud-layout-editing');setOrientation(orientation());stage.querySelector('[data-hud-item="'+selected+'"]')?.focus();
 }
 function build(){
  overlay=doc.createElement('section');overlay.id='abyssalHudEditor';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Personalizar interface');
  overlay.innerHTML='<div class="hud-editor-card"><header><div><small>CONFIGURAÇÃO LOCAL</small><h2>Personalizar interface</h2></div><button type="button" data-hud-close aria-label="Cancelar e fechar">×</button></header><div class="hud-editor-body"><div class="hud-editor-preview" aria-label="Prévia do HUD"></div><div class="hud-editor-settings"><label>Orientação<select data-hud-orientation><option value="portrait">Retrato</option><option value="landscape">Paisagem</option></select></label><label><span data-hud-size-label>Tamanho</span><input type="range" min="75" max="165" value="100" step="5" data-hud-size aria-label="Tamanho do controle"></label><p data-hud-status role="status"></p><p class="hud-editor-note">O joystick de movimento torna-se fixo quando personalizado. Energizar e reparar acompanham o painel do espécime.</p><button type="button" data-hud-reset>Restaurar padrão desta orientação</button><button type="button" data-hud-save class="hud-editor-save">Salvar interface</button><button type="button" data-hud-close>Cancelar</button></div></div></div>';
  doc.body.appendChild(overlay);stage=overlay.querySelector('.hud-editor-preview');range=overlay.querySelector('[data-hud-size]');label=overlay.querySelector('[data-hud-size-label]');status=overlay.querySelector('[data-hud-status]');orientationSelect=overlay.querySelector('[data-hud-orientation]');
  for(const item of ITEMS){const el=doc.createElement('button');el.type='button';el.dataset.hudItem=item[0];el.textContent=item[1];el.className='hud-editor-item';stage.appendChild(el);
   el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();selected=item[0];const v=get(selected),r=rect(stage);drag={id:selected,pointer:e.pointerId,dx:e.clientX-(r.left+v.x*r.width),dy:e.clientY-(r.top+v.y*r.height)};el.setPointerCapture?.(e.pointerId);render();});
   el.addEventListener('pointermove',e=>{if(drag?.pointer!==e.pointerId)return;const r=rect(stage);change(drag.id,{...get(drag.id),x:(e.clientX-r.left-drag.dx)/r.width,y:(e.clientY-r.top-drag.dy)/r.height});});
   for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,()=>{drag=null;});
   el.addEventListener('click',()=>{selected=item[0];render();});
   el.addEventListener('keydown',e=>{const v=get(item[0]),r=rect(stage),delta={ArrowLeft:[-4,0],ArrowRight:[4,0],ArrowUp:[0,-4],ArrowDown:[0,4]}[e.key];if(!delta)return;e.preventDefault();selected=item[0];change(item[0],{...v,x:v.x+delta[0]/r.width,y:v.y+delta[1]/r.height});});
  }
  orientationSelect.addEventListener('change',()=>setOrientation(orientationSelect.value));
  range.addEventListener('input',()=>change(selected,{...get(selected),s:Number(range.value)/100}));
  overlay.querySelector('[data-hud-reset]').addEventListener('click',()=>{draft[editingOrientation]={};setOrientation(editingOrientation);});
  overlay.querySelector('[data-hud-save]').addEventListener('click',()=>{const next=clean(draft);try{win.localStorage.setItem(KEY,JSON.stringify(next));}catch{status.textContent='Não foi possível salvar neste dispositivo. Libere espaço e tente novamente.';return;}profiles=next;close();schedule();});
  overlay.querySelectorAll('[data-hud-close]').forEach(b=>b.addEventListener('click',close));
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
 }
 function setup(){for(const id of ['hudLayoutMenuBtn','hudLayoutPauseBtn'])by(id)?.addEventListener('click',open);win.addEventListener('resize',schedule);win.addEventListener('orientationchange',schedule);new win.MutationObserver(schedule).observe(doc.body,{attributes:true,attributeFilter:['class']});const shell=by('gameShell');if(shell)new win.MutationObserver(records=>{if(records.some(r=>IDS.has(r.target.id)||['soloSubmarinePowerBtn','soloSubmarineRepairBtn'].includes(r.target.id)))schedule();}).observe(shell,{subtree:true,attributes:true,attributeFilter:['hidden']});schedule();}
 win.AbyssalHudLayout={open,close,hasFixedMove,snapshot:()=>clean(profiles),apply:schedule};
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
}
return {clean,bound,ITEMS,mount};
});