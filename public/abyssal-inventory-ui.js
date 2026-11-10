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
 '<p class="abyss-inventory-help">Selecione a picareta para minerar ou o cilindro vazio para extrair petróleo e gás. Use G perto de um depósito.</p>'+
 '<div id="abyssInventoryGrid" class="abyss-inventory-grid" role="group" aria-label="Itens em posse"></div>'+
 '<footer><strong id="abyssInventorySelected">PICARETA ABISSAL</strong><span id="abyssInventoryCargo">0 ITENS</span></footer>'+
 '</section>';
 shell.appendChild(root);
 const $=id=>document.getElementById(id),panel=$('abyssInventoryPanel'),grid=$('abyssInventoryGrid');
 const order=['abyssPickaxe','emptyCylinder','oilCylinder','gasCylinder','seaMineral','phosphorite','ferromanganeseCrust','polymetallicNodule','hydrothermalSulfide'];
 let active=false,selected='abyssPickaxe',inventory={},signature='';
 const colors={seaMineral:'#63c1cd',phosphorite:'#d8bd81',ferromanganeseCrust:'#a884da',polymetallicNodule:'#758aab',hydrothermalSulfide:'#ca9e6f',deepCrystal:'#a6cfff',abyssCrystal:'#a77aff'};
 function icon(id){
  if(id==='abyssPickaxe')return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M38 11L44 14 21 55 15 51Z" fill="#986341" stroke="#e8bb75" stroke-width="2"/><path d="M8 18Q28 -1 56 19L49 29Q33 12 14 29Z" fill="#b6c2cf" stroke="#f5e7c8" stroke-width="2"/><path d="M17 24L47 24" stroke="#6d8494" stroke-width="2"/></svg>';
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
  const items=Object.keys(inventory).filter(id=>(Number(inventory[id])||0)>0&&config.RESOURCES[id])
   .sort((a,b)=>{const x=order.indexOf(a),y=order.indexOf(b);return (x<0?99:x)-(y<0?99:y)||a.localeCompare(b);});
  grid.replaceChildren();
  for(let i=0;i<30;i++){
   const id=items[i],button=document.createElement('button');button.type='button';button.className='abyss-inventory-slot'+(id===selected?' is-selected':'');
   if(id){
    button.dataset.item=id;button.title=config.RESOURCES[id].name+' ('+inventory[id]+')';
    const artwork=document.createElement('span');artwork.className='abyss-inventory-art';artwork.innerHTML=icon(id);
    const quantity=document.createElement('span');quantity.className='abyss-inventory-count';quantity.textContent=String(inventory[id]);
    button.append(artwork,quantity);
    button.setAttribute('aria-label',config.RESOURCES[id].name+', '+inventory[id]);
    button.onclick=()=>{if(id==='abyssPickaxe'||id==='emptyCylinder'){selected=id;signature='';render();}else{ $('abyssInventorySelected').textContent=config.RESOURCES[id].name.toUpperCase();}};
   }else{button.disabled=true;button.setAttribute('aria-hidden','true');}
   grid.appendChild(button);
  }
  $('abyssInventorySelected').textContent='EQUIPADO: '+(config.RESOURCES[selected]?.name||'Picareta abissal').toUpperCase();
  $('abyssInventoryCargo').textContent=items.length+' TIPOS DE ITEM';
 }
 $('abyssInventoryToggle').onclick=()=>setOpen(panel.hidden);
 $('abyssInventoryClose').onclick=()=>setOpen(false);
 window.addEventListener('keydown',event=>{
  if(!isExploring()||event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.target?.closest?.('input,textarea,select,[contenteditable]'))return;
  if(event.key?.toLowerCase()==='i'){event.preventDefault();event.stopImmediatePropagation();setOpen(panel.hidden);}
  else if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopImmediatePropagation();setOpen(false);}
 },true);
 function setActive(value){active=Boolean(value);root.hidden=!active;if(!active){panel.hidden=true;$('abyssInventoryToggle').setAttribute('aria-expanded','false');}}
 function setInventory(items){inventory=items||{};if(!Number(inventory[selected]))selected=Number(inventory.abyssPickaxe)>0?'abyssPickaxe':'emptyCylinder';if(!panel.hidden)render();}
 window.AbyssalInventoryUI=Object.freeze({setActive,setInventory,selectedTool:()=>selected,close:()=>setOpen(false),isOpen:()=>!panel.hidden&&active});
})();
