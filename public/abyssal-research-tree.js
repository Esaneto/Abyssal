(function(root){
'use strict';
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function mount(parent,branches,options={}){
 const tree=el('section','abyss-research-tree'),map=el('div','abyss-tree-map'),detail=el('aside','abyss-tree-detail');
 tree.append(el('h3','abyss-tree-label',options.title||'Mapa de pesquisa'),el('p','abyss-tree-intro',options.copy||'Passe o mouse ou selecione um nó para consultar seus detalhes.'),map,detail);parent.append(tree);
 const nodes=new Map();let selected=options.selected;
 function select(id){const entry=nodes.get(id);if(!entry)return;selected=id;options.onSelect?.(id);
  for(const [key,v] of nodes)v.button.setAttribute('aria-pressed',String(key===id));
  const item=entry.item;detail.replaceChildren(el('h3','abyss-tree-detail-title',item.name),el('span','abyss-tree-state',item.state),el('p','abyss-tree-description',item.description));
  if(item.costText)detail.append(el('p','abyss-tree-cost',item.costText));
  if(item.actions?.length){const actions=el('div','abyss-tree-actions');for(const action of item.actions){const btn=el('button','abyss-tree-action'+(action.secondary?' is-secondary':''),action.label);btn.type='button';btn.disabled=Boolean(action.disabled);btn.addEventListener('click',()=>action.run?.());actions.append(btn);}detail.append(actions);}
 }
 for(const branch of branches){
  const section=el('section','abyss-tree-branch'),grid=el('div','abyss-tree-nodes'+(branch.linear?' is-linear':''));
  section.append(el('h4','abyss-tree-branch-title',branch.name),el('div','abyss-tree-trunk'),grid);map.append(section);
  for(const item of branch.items){
   const node=el('button','abyss-tree-node'+(item.owned?' is-owned':'')+(item.active?' is-equipped':'')+(item.locked?' is-locked':''));node.type='button';node.setAttribute('aria-pressed','false');node.setAttribute('aria-label',item.name+' · '+item.state);
   node.append(el('span','abyss-tree-node-icon',item.icon||'◈'),el('span','abyss-tree-node-name',item.name),el('span','abyss-tree-node-state',item.state));grid.append(node);nodes.set(item.id,{item,button:node});
   node.addEventListener('click',()=>select(item.id));node.addEventListener('focus',()=>select(item.id));node.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')select(item.id);});
  }
 }
 if(!nodes.has(selected))selected=nodes.keys().next().value;if(selected)select(selected);
 return tree;
}
root.AbyssalResearchTree=Object.freeze({mount});
})(window);
