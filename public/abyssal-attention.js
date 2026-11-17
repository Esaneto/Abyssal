/* Visual state indicators stay independent from legacy menu :before/:after
 * and box-shadow !important declarations. A child overlay owns the pulse. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalAttention=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 function ensure(button){
  if(!button||typeof button.appendChild!=='function')return null;
  let ring=button.querySelector?.(':scope > .abyss-neon-frame');
  if(ring)return ring;
  const doc=button.ownerDocument;
  if(!doc)return null;
  ring=doc.createElement('span');
  ring.className='abyss-neon-frame';
  ring.setAttribute('aria-hidden','true');
  button.appendChild(ring);
  return ring;
 }
 return Object.freeze({ensure});
});
