/* Open Sea gathering presentation. Server controls online duration and final awards.
 * No timers, inventory grants, or extraction effects run in shooter/rift modes.
 */
(function(){
 'use strict';
 const bridge=window.AbyssalExplorationBridge,inv=()=>window.AbyssalInventoryUI;
 if(!bridge)return;
 const button=document.getElementById('explorationGatherBtn'),bar=document.getElementById('explorationWorkFill');
 let held=false,action=null,drop=null,lastClaim=0;
 const now=()=>performance.now();
 const pos=()=>bridge.cfg();
 const selected=()=>inv()?.heldItem?.()||'abyssWeapon';
 function reset(){held=false;action=null;drop=null;window.AbyssalExplorationToolState=null;if(bar)bar.style.width='0%';}
 function interrupt(){
  held=false;
  if(action&&action.phase!=='finishing'){action=null;window.AbyssalExplorationToolState=null;}
 }
 function start(node){
  const p=pos();if(!p||p.mode!=='open-sea'||p.paused||action||drop)return;
  const tool=selected();
  // Pipe-laying starts and completes at the FPSO, not at an arbitrary deposit.
  if(tool==='offshoreCable'&&bridge.platformNearby?.(p)){bridge.platformAction?.();return;}
  const target=node||bridge.closest();
  if(!target||Math.hypot(target.x-p.x,target.y-p.y)>135){bridge.notify('Aproxime-se da rocha ou da exsudação.');return;}
  const seep=target.type==='oilSeep'||target.type==='gasSeep';
  if(seep&&tool==='offshoreCable'){
   const research=bridge.levels();
   if(!research.offshoreSurvey||!research.offshorePlatform||!research.subseaUmbilical){bridge.notify('Instalação offshore requer pesquisas do submarino.');return;}
   bridge.connect(target);return;
  }
  const check=bridge.fields.eligible(target,p.x,p.y,bridge.inventory(),135,tool);
  if(!check.ok){bridge.notify(check.reason==='select-tool'?'Equipe '+(bridge.config.RESOURCES[check.tool]?.name||check.tool)+'.':check.reason==='tool-required'?'Equipe a picareta ou um cilindro vazio.':check.reason==='empty-cylinder-required'?'Sem cilindros vazios.':'Recurso fora do alcance.');return;}
  held=true;
  const a={node:target,tool,phase:p.online?'pending':'working',began:now(),duration:bridge.fields.durationFor(target.type)};
  action=a;
  bridge.notify(seep?'COLETANDO AMOSTRA · mantenha pressionado para encher o cilindro.':'MINERANDO · mantenha pressionado para fragmentar a rocha.');
  if(p.online){
   const begin=window.AbyssalOnline?.explorationExtractBegin;
   if(!begin){action=null;bridge.notify('Extração online indisponível.');return;}
   begin(target.id,tool,result=>{
    if(action!==a)return;
    if(!result?.ok){action=null;held=false;bridge.notify('Não foi possível iniciar: '+String(result?.reason||'erro'));return;}
    if(!held){action=null;return;}
    a.phase='working';a.began=now();a.duration=Number(result.durationMs)||a.duration;
   });
  }
 }
 function extracted(a,result){
  if(action!==a)return;
  action=null;window.AbyssalExplorationToolState=null;
  if(!result?.ok){bridge.notify('Extração interrompida: '+String(result?.reason||'erro'));return;}
  const n=a.node;
  drop={node:n,item:result.item,amount:Math.max(1,Number(result.amount)||1),x:n.x,y:n.y,at:now(),busy:false,result:a.localResult||null};
  bridge.notify('RECURSO LIBERADO! Aproxime-se para atraí-lo com o coletor magnético.');
 }
 function finish(a,p){
  if(action!==a||a.phase!=='working')return;
  a.phase='finishing';
  window.AbyssalExplorationToolState=null;
  if(p.online)window.AbyssalOnline?.explorationExtractComplete?.(a.node.id,result=>extracted(a,result));
  else {
   const result=bridge.prepareSolo(a.node);
   if(result?.ok)a.localResult=result;
   extracted(a,result);
  }
 }
 function claimed(d,result,p){
  if(drop!==d)return;
  if(!result?.ok){
   d.busy=false;
   // Do not lose an already-mined object on a transient network failure.
   d.x=d.node.x;d.y=d.node.y-27;d.at=now()-700;
   bridge.notify('Amostra ainda no mar: '+String(result?.reason||'aproxime-se'));
   return;
  }
  const final=p.online?bridge.claimOnline(d.node,result):bridge.claimSolo(d.node,result);
  if(final?.ok){
   bridge.feedback(d.item,d.amount);
   bridge.notify('RECOLHIDO · '+(bridge.config.RESOURCES[d.item]?.name||d.item)+' × '+d.amount+' · barra rápida / inventário');
   drop=null;
  }
 }
 function tick(time,dt,p){
  if(!p||p.mode!=='open-sea'){reset();return;}
  if(action){
   const a=action,dist=Math.hypot(a.node.x-p.x,a.node.y-p.y);
   if(p.paused||selected()!==a.tool||dist>145||(!held&&a.phase!=='finishing'))interrupt();
   else if(a.phase==='working'){
    const progress=Math.max(0,Math.min(1,(time-a.began)/a.duration));
    window.AbyssalExplorationToolState={node:a.node,tool:a.tool,progress,swing:a.tool==='abyssPickaxe'?Math.sin((time-a.began)*.021):0};
    if(progress>=1)finish(a,p);
   }
  }else window.AbyssalExplorationToolState=null;
  if(!drop)return;
  const d=drop,age=time-d.at;
  if(age<650){d.x=d.node.x+Math.sin(age*.01)*2;d.y=d.node.y-28*(age/650);return;}
  const range=Math.hypot(d.x-p.x,d.y-p.y);
  if(range<200){
   const k=1-Math.exp(-Math.max(0,dt)*9);
   d.x+=(p.x-d.x)*k;d.y+=(p.y-d.y)*k;
  }else{d.x=d.node.x+Math.sin(age*.0016)*5;d.y=d.node.y-28+Math.sin(age*.0027)*4;}
  if(Math.hypot(d.x-p.x,d.y-p.y)<22&&!d.busy&&time-lastClaim>400){
   d.busy=true;lastClaim=time;
   if(p.online)window.AbyssalOnline?.explorationCollect?.(d.node.id,result=>claimed(d,result,p));
   else claimed(d,d.result,p);
  }
 }
 function refreshHUD(near,p){
  if(!button)return;
  const tool=selected(),seep=near&&(near.type==='oilSeep'||near.type==='gasSeep');
  const can=near&&Math.hypot(p.x-near.x,p.y-near.y)<=135&&(seep&&tool==='offshoreCable'?bridge.levels().offshorePlatform&&bridge.levels().subseaUmbilical&&!bridge.isConnected(near.id):bridge.fields.eligible(near,p.x,p.y,bridge.inventory(),135,tool).ok);
  const platform=tool==='offshoreCable'&&bridge.platformNearby?.(p)&&bridge.levels().offshorePlatform;
  button.disabled=!(can||platform||action)||Boolean(drop)||Boolean(p.paused);
  const percent=action?.phase==='working'?Math.max(0,Math.min(100,(now()-action.began)/action.duration*100)):0;
  if(bar)bar.style.width=percent.toFixed(1)+'%';
  button.textContent=action?(action.tool==='abyssPickaxe'?'GOLPEANDO ROCHA '+Math.floor(percent)+'%':'ENCHENDO CILINDRO '+Math.floor(percent)+'%'):drop?'APROXIME-SE DO RECURSO':platform?(bridge.installation?.()?.phase==='return'?'LIGAR DUTO NO FPSO':'RETIRAR BOBINA DO FPSO'):tool==='offshoreCable'?'FIXAR DUTO NO POÇO':'SEGURE PARA EXTRAIR';
 }
 function pendingId(){return drop?.node?.id||null;}
 function draw(c,time,view){
  const t=Number(time)||now();
  if(action&&action.phase==='working'){
   const a=action,x=a.node.x,y=a.node.y,f=Math.max(0,Math.min(1,(now()-a.began)/a.duration));
   if(x>=view.left-90&&x<=view.right+90&&y>=view.top-90&&y<=view.bottom+90){
    c.save();c.translate(x,y);
    c.strokeStyle=a.tool==='abyssPickaxe'?'#dfc38c':'#84dfa9';c.lineWidth=3;c.beginPath();c.arc(0,0,43,-Math.PI/2,Math.PI*2*f-Math.PI/2);c.stroke();
    if(a.tool==='abyssPickaxe'){
     // Fragments are visual chips, not player inventory. Rocks remain grounded.
     for(let j=0;j<7;j++){const phase=((t-a.began)*.0034+j*.24)%1;
      c.globalAlpha=Math.max(0,1-phase)*.9;c.fillStyle=j%2?'#b4a997':'#8f9c98';
      c.beginPath();c.arc(Math.sin(j*3.3)*phase*24,-phase*29+j%2*4,1.6+(j%3),0,Math.PI*2);c.fill();}
    }else{
     const gas=a.node.type==='gasSeep';
     c.globalAlpha=1;c.fillStyle='#1a3441';c.strokeStyle='#c7b78d';c.lineWidth=2;
     c.beginPath();c.roundRect(31,-51,19,42,4);c.fill();c.stroke();
     c.fillStyle=gas?'#63c58a':'#17161b';c.fillRect(34,-12-35*f,13,35*f);
     c.fillStyle='#cbd4cb';c.fillRect(36,-56,9,5);
    }
    c.restore();
   }
  }
  if(drop&&drop.x>view.left-50&&drop.x<view.right+50&&drop.y>view.top-60&&drop.y<view.bottom+60){
   const d=drop,gas=d.item==='gasCylinder',oil=d.item==='oilCylinder',col=gas?'#8de9ac':oil?'#c6a172':'#c3d8c8';
   c.save();c.translate(d.x,d.y);c.shadowColor=col;c.shadowBlur=12;c.strokeStyle=col;c.lineWidth=1.6;
   if(gas||oil){
    c.fillStyle='#1d3441';c.beginPath();c.roundRect(-10,-13,20,28,5);c.fill();c.stroke();
    c.fillStyle=gas?'#55b27c':'#1a1b21';c.fillRect(-7,-7,14,19);c.fillStyle='#ced4cb';c.fillRect(-4,-18,8,6);
   }else{
    for(let j=0;j<Math.min(3,d.amount);j++){const x=(j-1)*12,y=Math.sin(t*.002+j)*3;
     c.beginPath();c.moveTo(x,y-10);c.lineTo(x+6,y-3);c.lineTo(x+1,y+9);c.lineTo(x-8,y+1);c.closePath();c.fillStyle=j%2?'#acc6b9':'#7eaea7';c.fill();c.stroke();}
   }
   c.restore();
  }
 }
 const key=e=>e.key==='g'||e.key==='G';
 window.addEventListener('keydown',e=>{if(key(e)&&!e.repeat&&!e.target?.closest?.('input,textarea,select,[contenteditable]')&&pos()?.mode==='open-sea'){e.preventDefault();start();}},true);
 window.addEventListener('keyup',e=>{if(key(e))interrupt();},true);
 if(button){button.addEventListener('pointerdown',e=>{e.preventDefault();start();});
  for(const event of ['pointerup','pointercancel','pointerleave'])button.addEventListener(event,interrupt);
  button.addEventListener('click',e=>e.preventDefault());
 }
 const canvas=bridge.canvas;
 canvas.addEventListener('pointerdown',e=>{
  if(pos()?.mode!=='open-sea'||!['abyssPickaxe','emptyCylinder','offshoreCable'].includes(selected()))return;
  const cam=window.AbyssalGameHooks?.cameraState?.(),box=canvas.getBoundingClientRect(),zoom=Number(cam?.zoom)||1;
  const x=(Number(cam?.x)||0)+(e.clientX-box.left)/zoom,y=(Number(cam?.y)||0)+(e.clientY-box.top)/zoom;
  let hit=null,r=72;
  for(const n of bridge.nearby()){const dist=Math.hypot(n.x-x,n.y-y);if(dist<r){r=dist;hit=n;}}
  if(hit){e.preventDefault();e.stopPropagation();start(hit);}else if(selected()==='offshoreCable'&&bridge.platformNearby?.(pos())&&Math.hypot(x-520,y-95)<185){e.preventDefault();e.stopPropagation();start();}
 },true);
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,interrupt,true);
 window.addEventListener('blur',interrupt);
 window.addEventListener('abyssal-held-item-change',interrupt);
 window.AbyssalGathering=Object.freeze({reset,tick,draw,refreshHUD,pendingId});
})();
