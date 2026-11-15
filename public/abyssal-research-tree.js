(function(root){
'use strict';
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
const ICONS=Object.freeze({"photon":["#54e6ff","M4 20 19 5M10 5h9v9M3 13l5-1m3 8 1-5"],"electric":["#f4d34d","M13 2 5 13h6l-1 9 9-13h-6zM4 5l3 3m13 9-3-3"],"pierce":["#ef9b51","M3 20 19 4m-7 0h7v7M5 14l5 5M3 20l4-1"],"photonRay":["#55c8ff","M3 19 21 5M3 15 17 4M7 21 21 9"],"nova":["#c68bff","M4 12h3m10 0h3M12 4v3m0 10v3M6 6l3 3m6 6 3 3M18 6l-3 3M9 15l-3 3","circle"],"echoShot":["#38d8c1","M3 17 17 3m-11 18L20 7M11 3h6v6m-3-2h6v6"],"burst":["#db8cff","M12 2v5m0 10v5M2 12h5m10 0h5M4 4l4 4m8 8 4 4M20 4l-4 4m-8 8-4 4","circle"],"ricochet":["#f7e94d","M3 18 10 5l5 13 6-12M17 7l4-1 1 4"],"spread":["#e58aff","M4 18 20 5M4 18l17-1M4 18 8 3M16 5h4v4M17 14l4 3-4 3M5 6l3-3 3 3"],"power":["#ff806f","M12 2 9 9 2 12l7 3 3 7 3-7 7-3-7-3z"],"rate":["#ffb95b","M3 6h10M3 12h16M3 18h10m1-10 5 4-5 4"],"speed":["#45e5d0","M3 6l7 6-7 6m8-12 7 6-7 6M21 6v12"],"range":["#64d9ff","M2 12q10-14 20 0-10 14-20 0zM12 8v8m-4-4h8"],"magnet":["#f7d858","M12 2 5 12h6l-1 10 9-13h-6zM3 4l2 2m14 12 2 2"],"regen":["#57ed94","M12 21Q2 15 3 8q2-6 9-1 7-5 9 1 1 7-9 13M12 9v7m-3-3h6"],"shield":["#79d8ff","M12 2 21 6v6q-1 7-9 10-8-3-9-10V6zM12 7v10m-4-5h8"],"shell":["#d2ad77","M12 2 21 7v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10M7 5l10 14"],"ward":["#63b5ff","M12 2q9 5 9 11a9 9 0 0 1-18 0Q3 7 12 2zM6 13q6-5 12 0M8 16q4-3 8 0"],"lastStand":["#fa5774","M2 12h5l3-7 4 14 3-7h5M5 4q4-3 7 1 3-4 7-1"],"pressureCocoon":["#5ce7c5","M12 2 21 7v10l-9 5-9-5V7zM12 6 17 9v6l-5 3-5-3V9z"],"vitality":["#83ef7b","M12 3v18M3 12h18M5 5h14v14H5z"],"predator":["#ff685f","M3 7l5 10 4-6 4 6 5-10M3 7l5 2 4-3 4 3 5-2M9 20h6"],"closePressure":["#ff9e50","M3 3l5 5m-5 0h5V3m13 0-5 5m5 0h-5V3M3 21l5-5m-5 0h5v5m13 0-5-5m5 0h-5v5","circle"],"pulse":["#be9aff","M2 12h5l3-8 4 16 3-8h5"],"dash":["#55e2c7","M5 8h12l4 4-4 4H5zM2 8v8m5-4h9M1 5h7m-7 14h7"],"lamp":["#ffe083","M3 8h8v8H3zM11 8l10-5v18l-10-5M5 10v4"],"submarineShield":["#5dd7e8","M12 2 21 6v6q-1 7-9 10-8-3-9-10V6zM6 12h12M8 9h8v6H8z"],"magneticField":["#b68aff","M5 4v10a7 7 0 0 0 14 0V4h-5v10a2 2 0 0 1-4 0V4z"],"petAttack":["#ff775f","M3 7l5 12 4-8 4 8 5-12M5 5l3 3m8 0 3-3"],"petLife":["#7bf0a2","M12 20Q2 13 4 7q3-5 8 0 5-5 8 0 2 6-8 13M12 9v7m-3-3h6"],"petSpeed":["#4be4de","M3 12 11 5l-1 5h6l5 2-5 2h-6l1 5zM2 6h5M2 18h5"],"petCadence":["#ffb95b","M5 3v5m7-5v8m7-8v5M3 12l5 8 4-5 4 5 5-8"],"gravitationalRupture":["#ffd476","M2 12h5m10 0h5M12 2v5m0 10v5M5 5l4 4m6 6 4 4M19 5l-4 4m-6 6-4 4","circle"],"arcChain":["#ffe075","M2 17 7 8l4 6 5-9 6 4M2 17l4 2m10-14 1-3M11 14l-1 5"],"abyssEye":["#ffcc65","M2 12q10-15 20 0-10 15-20 0zM12 4v16M5 20 19 4","circle"],"vitalDrain":["#ff8894","M12 21Q1 13 4 7q3-5 8 0 5-5 8 0 3 6-8 14M12 8v9m-4-4h8"],"photonCascade":["#edbaff","M3 20 21 4M3 20l6-16M3 20l18-1M15 4h6v6M9 4l-4 2m16 13-3 3"],"tidalEcho":["#64e7db","M2 7q5-5 10 0t10 0M2 12q5-5 10 0t10 0M2 17q5-5 10 0t10 0"],"hadalBeam":["#79d9ff","M2 19 19 2M5 22 22 5M2 12 12 2m0 20 10-10M9 15l6-6"]});
function iconFor(id,fallback){
 const key=String(id).replace(/^weapon:/,'').replace(/^lamp:.+$/,'lamp'),definition=ICONS[key];
 const node=el('span','abyss-tree-node-icon');node.setAttribute('aria-hidden','true');
 if(!definition){node.textContent=fallback||'◈';return node;}
 const [color,path,center]=definition,ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke',color);svg.setAttribute('stroke-width','1.9');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
 const p=document.createElementNS(ns,'path');p.setAttribute('d',path);svg.append(p);
 if(center){const c=document.createElementNS(ns,'circle');c.setAttribute('cx','12');c.setAttribute('cy','12');c.setAttribute('r','3.5');c.setAttribute('fill',color);svg.append(c);}
 node.style.setProperty('--research-icon',color);node.append(svg);return node;
}
function mount(parent,branches,options={}){
 const tree=el('section','abyss-research-tree'),map=el('div','abyss-tree-map'),detail=el('aside','abyss-tree-detail');
 tree.append(el('h3','abyss-tree-label',options.title||'Mapa de pesquisa'),el('p','abyss-tree-intro',options.copy||'Clique ou toque em um ícone para consultar os detalhes.'),map,detail);parent.append(tree);
 const nodes=new Map();let selected=options.selected;detail.hidden=true;
 function select(id){const entry=nodes.get(id);if(!entry)return;selected=id;detail.hidden=false;options.onSelect?.(id);
  for(const [key,v] of nodes)v.button.setAttribute('aria-pressed',String(key===id));
  const item=entry.item;detail.replaceChildren(iconFor(item.id,item.icon),el('h3','abyss-tree-detail-title',item.name),el('span','abyss-tree-state',item.state));
  if(item.recommended)detail.append(el('span','abyss-recommended','Recomendado'));
  if(item.costText)detail.append(el('p','abyss-tree-cost',item.costText));
  if(item.actions?.length){const actions=el('div','abyss-tree-actions');for(const action of item.actions){const btn=el('button','abyss-tree-action'+(action.secondary?' is-secondary':''),action.label);btn.type='button';btn.disabled=Boolean(action.disabled);btn.addEventListener('click',()=>action.run?.());actions.append(btn);}detail.append(actions);}
  detail.append(el('p','abyss-tree-description',item.description));
 }
 for(const branch of branches){
  const section=el('section','abyss-tree-branch'),grid=el('div','abyss-tree-nodes'+(branch.linear?' is-linear':''));
  section.append(el('h4','abyss-tree-branch-title',branch.name),el('div','abyss-tree-trunk'),grid);map.append(section);
  for(const item of branch.items){
   const node=el('button','abyss-tree-node'+(item.owned?' is-owned':'')+(item.active?' is-equipped':'')+(item.locked?' is-locked':''));node.type='button';node.dataset.researchId=item.id;node.setAttribute('aria-pressed','false');node.setAttribute('aria-label',item.name+' · '+item.state+(item.recommended?' · Recomendado':''));
   node.append(iconFor(item.id,item.icon));node.title=item.name;node.dataset.state=item.active?'equipped':item.owned?'owned':item.locked?'locked':'available';grid.append(node);nodes.set(item.id,{item,button:node});
   node.addEventListener('click',()=>select(item.id));
  }
 }
 if(nodes.has(selected))select(selected);
 return tree;
}
root.AbyssalResearchTree=Object.freeze({mount,iconFor});
})(window);
