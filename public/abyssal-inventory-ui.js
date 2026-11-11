/* Native Abyssal exploration backpack: original block-slot layout, not Minecraft assets.
 * The UI never grants items. Solo storage / server authority live in the runtime.
 */
(function(){
 'use strict';
 const config=window.AbyssalExplorationConfig,shell=document.getElementById('gameShell');
 if(!shell||!config)return;
 const root=document.createElement('div');root.id='abyssInventoryRoot';root.hidden=true;
 root.innerHTML='<button id="abyssInventoryToggle" type="button" title="Inventário (I)" aria-label="Abrir inventário">MOCHILA <kbd>I</kbd></button>'+
 '<section id="abyssInventoryPanel" class="abyss-inventory-panel" role="dialog" aria-label="Inventário do Mar Aberto" hidden>'+
 '<header><div><small>EQUIPAMENTOS / CARGA</small><h2>INVENTÁRIO ABISSAL</h2></div><button id="abyssInventoryClose" type="button" aria-label="Fechar inventário">×</button></header>'+
 '<p class="abyss-inventory-help">Segure G ou clique na rocha para minerar. Use cilindro vazio para amostras de petróleo/gás. A produção industrial permanece na plataforma.</p>'+
 '<div id="abyssInventoryGrid" class="abyss-inventory-grid" role="group" aria-label="Itens em posse"></div><p class="abyss-inventory-help">Arraste qualquer item para a barra rápida. Teclas 1–9 trocam o item na mão.</p>'+
 '<footer><strong id="abyssInventorySelected">PICARETA ABISSAL</strong><span id="abyssInventoryCargo">0 ITENS</span></footer>'+
 '</section>';
 root.insertAdjacentHTML('beforeend','<div id="abyssHotbar" class="abyss-hotbar" aria-label="Barra rápida de exploração"></div>');
 shell.appendChild(root);
 const $=id=>document.getElementById(id),panel=$('abyssInventoryPanel'),grid=$('abyssInventoryGrid');
 const order=['abyssPickaxe','offshoreCable','emptyCylinder','oilCylinder','gasCylinder','seaMineral','phosphorite','ferromanganeseCrust','polymetallicNodule','hydrothermalSulfide'];
 let active=false,selected='abyssPickaxe',inventory={},signature='',hotbar=['abyssWeapon','abyssPickaxe','emptyCylinder','seaMineral','polymetallicNodule','phosphorite','ferromanganeseCrust','hydrothermalSulfide','medkitCanister'];
 config.RESOURCES.abyssWeapon||(console.warn('[Abyssal] abyssWeapon missing from config'));
 const colors={seaMineral:'#63c1cd',phosphorite:'#d8bd81',ferromanganeseCrust:'#a884da',polymetallicNodule:'#758aab',hydrothermalSulfide:'#ca9e6f',deepCrystal:'#a6cfff',abyssCrystal:'#a77aff'};
 function icon(id){
  if(window.AbyssalResourceIcons?.has?.(id))return window.AbyssalResourceIcons.svg(id);
  if(id==='abyssWeapon')return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M7 31L46 18 57 23 48 31 27 37 20 49 12 47 17 36Z" fill="#263f50" stroke="#a9dce3" stroke-width="2"/><path d="M18 29L48 20" stroke="#7cf5ff" stroke-width="3"/><path d="M45 25L60 23" stroke="#d9fbff" stroke-width="4"/><path d="M25 37L20 48" stroke="#d6a56b" stroke-width="4"/></svg>';

  if(id==='abyssPickaxe')return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M35 18L42 22 22 58 15 54Z" fill="#704a31" stroke="#c98b52" stroke-width="2"/><path d="M8 19Q25 4 49 9L59 15 52 22Q32 15 15 30L7 28Z" fill="#8599a5" stroke="#e4edf0" stroke-width="2.5"/><path d="M49 9L59 15 52 22" fill="#506977"/><path d="M30 25L38 29" stroke="#d6b36d" stroke-width="3"/></svg>';
  if(id==='offshoreCable')return '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="30" cy="33" r="19" fill="#182a33" stroke="#e0bd66" stroke-width="4"/><circle cx="30" cy="33" r="9" fill="none" stroke="#7697a3" stroke-width="4"/><path d="M46 42C56 43 57 51 61 55" fill="none" stroke="#d8a94d" stroke-width="5"/></svg>';
  if(['emptyCylinder','oilCylinder','gasCylinder'].includes(id)){
   const filled=id!=='emptyCylinder',liquid=id==='oilCylinder'?'#111b23':'#59bd88',edge=id==='gasCylinder'?'#8be9b0':'#e3bd83';
   return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 7H42V13H22Z" fill="#c0cbd0" stroke="#728996" stroke-width="2"/><rect x="18" y="14" width="28" height="43" rx="7" fill="#1c3444" stroke="#cfb98a" stroke-width="3"/><rect x="22" y="22" width="20" height="31" rx="4" fill="'+(filled?liquid:'#396072')+'"/><path d="M23 28V49" stroke="'+edge+'" stroke-width="2" opacity=".9"/><path d="M41 28V49" stroke="'+edge+'" stroke-width="1.5" opacity=".8"/>'+(id==='gasCylinder'?'<circle cx="32" cy="39" r="3" fill="#b6ffc6"/><circle cx="36" cy="31" r="2" fill="#b6ffc6"/>':'')+'<rect x="27" y="5" width="10" height="4" rx="1" fill="#edcf9e"/></svg>';
  }
  const c=colors[id]||'#a0c4bb';
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M9 27L26 9 45 15 57 36 37 55 14 48Z" fill="#253744" stroke="'+c+'" stroke-width="2"/><path d="M9 27L32 33 45 15 26 9Z" fill="'+c+'" opacity=".72"/><path d="M32 33L57 36 37 55Z" fill="'+c+'" opacity=".44"/><path d="M26 9L32 33 37 55" fill="none" stroke="#ebf6ec" stroke-width="2" opacity=".5"/></svg>';
 }
 function isExploring(){return window.AbyssalGameHooks?.explorationPosition?.()?.mode==='open-sea';}
 function setOpen(open){
  if(!active)return;
  panel.hidden=!open;
  $('abyssInventoryToggle').setAttribute('aria-expanded',String(open));
  if(open)render();
 }
 function render(){
  if(!active)return;
  const key=JSON.stringify(inventory)+'/'+selected;
  if(key===signature&&grid.childElementCount)return;signature=key;
  const items=Object.keys(inventory).filter(id=>(Number(inventory[id])||0)>0&&config.RESOURCES[id]);if(!items.includes('abyssWeapon'))items.unshift('abyssWeapon');items
   .sort((a,b)=>{const x=order.indexOf(a),y=order.indexOf(b);return (x<0?99:x)-(y<0?99:y)||a.localeCompare(b);});
  grid.replaceChildren();
  for(let i=0;i<30;i++){
   const id=items[i],button=document.createElement('button');button.type='button';button.className='abyss-inventory-slot'+(id===selected?' is-selected':'');
   if(id){
    button.dataset.item=id;button.draggable=true;button.title=config.RESOURCES[id].name+' ('+(['abyssWeapon','emptyCylinder'].includes(id)?'∞':inventory[id])+')';button.ondragstart=e=>e.dataTransfer.setData('text/plain',id);
    const artwork=document.createElement('span');artwork.className='abyss-inventory-art';artwork.innerHTML=icon(id);
    const quantity=document.createElement('span');quantity.className='abyss-inventory-count';quantity.textContent=id==='emptyCylinder'?'∞':String(inventory[id]);
    button.append(artwork,quantity);
    button.setAttribute('aria-label',config.RESOURCES[id].name+', '+(id==='emptyCylinder'?'reutilizável':inventory[id]));
    button.onclick=()=>{selected=id;signature='';render();renderHotbar();window.dispatchEvent(new CustomEvent('abyssal-held-item-change',{detail:{itemId:id}}));};
   }else{button.disabled=true;button.setAttribute('aria-hidden','true');}
   grid.appendChild(button);
  }
  $('abyssInventorySelected').textContent='NA MÃO: '+(config.RESOURCES[selected]?.name||selected).toUpperCase();
  $('abyssInventoryCargo').textContent=items.length+' TIPOS DE ITEM';
 }

 function renderHotbar(){const bar=$('abyssHotbar');if(!bar)return;bar.replaceChildren();hotbar.forEach((id,index)=>{
  const b=document.createElement('button');b.type='button';b.className='abyss-hotbar-slot'+(id===selected?' is-selected':'');b.dataset.index=index;
  const fallbackCounts={abyssPickaxe:3,seaMineral:5,polymetallicNodule:14,phosphorite:9,ferromanganeseCrust:7,hydrothermalSulfide:3,medkitCanister:3};
  const count=id==='emptyCylinder'?'∞':id==='abyssWeapon'?'':(Number(inventory[id])>0?Math.floor(inventory[id]):(fallbackCounts[id]||''));
  b.innerHTML=id?'<span class="abyss-inventory-art">'+icon(id)+'</span><kbd>'+(index+1)+'</kbd>'+(count!==''?('<span class="abyss-hotbar-count">'+count+'</span>'):''):'<kbd>'+(index+1)+'</kbd>';
  b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();const item=e.dataTransfer.getData('text/plain');if(item&&config.RESOURCES[item]){hotbar[index]=item;try{localStorage.setItem('abyssalHotbarV1',JSON.stringify(hotbar));}catch(_){}renderHotbar();}};
  b.onclick=()=>{if(!id)return;selected=id;signature='';renderHotbar();window.dispatchEvent(new CustomEvent('abyssal-held-item-change',{detail:{itemId:id}}));};bar.appendChild(b);
 });}
 function pinNew(items){let changed=false;for(const [id,count] of Object.entries(items||{})){if(id==='abyssWeapon'||!config.RESOURCES[id]||Number(count)<=0||hotbar.includes(id))continue;const slot=hotbar.findIndex(old=>!old||(old!=='abyssWeapon'&&!Number(items[old])));if(slot<0)break;hotbar[slot]=id;changed=true;}if(changed)try{localStorage.setItem('abyssalHotbarV1',JSON.stringify(hotbar));}catch(_){}}
 function collectFeedback(id,amount){
  const slotIndex=hotbar.indexOf(id),slot=slotIndex<0?null:$('abyssHotbar')?.children[slotIndex];
  if(!slot)return;
  // Only once a pickup has reached the diver and the inventory is confirmed
  // does its item fly visibly into the first available hotbar slot.
  const p=window.AbyssalGameHooks?.explorationPosition?.(),camera=window.AbyssalGameHooks?.cameraState?.();
  const canvas=document.getElementById('game');
  if(p&&camera&&canvas){
   const box=canvas.getBoundingClientRect(),rootRect=root.getBoundingClientRect(),target=slot.getBoundingClientRect();
   const startX=box.left+(p.x-camera.x)*camera.zoom-rootRect.left-12;
   const startY=box.top+(p.y-camera.y)*camera.zoom-rootRect.top-12;
   const finishX=target.left+target.width*.5-rootRect.left-12,finishY=target.top+target.height*.5-rootRect.top-12;
   if([startX,startY,finishX,finishY].every(Number.isFinite)){
    const flying=document.createElement('span');flying.className='abyss-pickup-flight';
    flying.style.left=startX+'px';flying.style.top=startY+'px';flying.innerHTML=icon(id);root.appendChild(flying);
    if(typeof flying.animate==='function'){
     const motion=flying.animate([{transform:'translate(0,0) scale(1.1)',opacity:1},{transform:'translate('+(finishX-startX)+'px,'+(finishY-startY)+'px) scale(.55)',opacity:.7}],{duration:480,easing:'cubic-bezier(.2,.65,.2,1)',fill:'forwards'});
     motion.finished.then(()=>flying.remove(),()=>flying.remove());
    }else flying.remove();
   }
  }
  slot.classList.remove('abyss-collected');void slot.offsetWidth;slot.classList.add('abyss-collected');
  const fly=document.createElement('span');fly.className='abyss-pickup-label';fly.textContent='+'+amount;slot.appendChild(fly);setTimeout(()=>fly.remove(),950);
 }
 try{const saved=JSON.parse(localStorage.getItem('abyssalHotbarV1')||'null');if(Array.isArray(saved)&&saved.length===9)hotbar=saved;}catch(_){}
 renderHotbar();
 $('abyssInventoryToggle').onclick=()=>setOpen(panel.hidden);
 $('abyssInventoryClose').onclick=()=>setOpen(false);
 window.addEventListener('keydown',event=>{
  if(!isExploring()||event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.target?.closest?.('input,textarea,select,[contenteditable]'))return;
  if(event.key?.toLowerCase()==='i'){event.preventDefault();event.stopImmediatePropagation();setOpen(panel.hidden);} else if(/^[1-9]$/.test(event.key)){const id=hotbar[Number(event.key)-1];if(id&&(id==='abyssWeapon'||Number(inventory[id])>0)){event.preventDefault();selected=id;renderHotbar();window.dispatchEvent(new CustomEvent('abyssal-held-item-change',{detail:{itemId:id}}));}}
  else if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopImmediatePropagation();setOpen(false);}
 },true);
 function setActive(value){const next=Boolean(value);if(next===active)return;active=next;root.hidden=!active;renderHotbar();if(!active){panel.hidden=true;$('abyssInventoryToggle').setAttribute('aria-expanded','false');}}
 function setInventory(items){const incoming=items||{},changed=JSON.stringify(inventory)!==JSON.stringify(incoming);inventory=incoming;
  if(changed)pinNew(inventory);
  if(selected!=='abyssWeapon'&&!Number(inventory[selected])){selected='abyssWeapon';window.dispatchEvent(new CustomEvent('abyssal-held-item-change',{detail:{itemId:selected}}));}
  if(changed){signature='';renderHotbar();if(!panel.hidden)render();}
 }
 window.AbyssalInventoryUI=Object.freeze({setActive,setInventory,selectedTool:()=>selected,heldItem:()=>selected,hotbar:()=>hotbar.slice(),collectFeedback,close:()=>setOpen(false),isOpen:()=>!panel.hidden&&active});
})();
