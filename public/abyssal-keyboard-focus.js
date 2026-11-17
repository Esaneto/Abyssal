/* Android IME: keep the editable field visible over the soft keyboard.
 * The focused input remains in its original form (no DOM reparenting or
 * synthetic input events), so redemption, authentication and chat still work. */
(function(root){
 'use strict';
 const FIELD='input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=file]):not([type=color]),textarea,[contenteditable]:not([contenteditable=false])';
 const isEditable=element=>Boolean(element?.matches?.(FIELD)&&!element.disabled&&!element.readOnly);
 function viewport(root,baseline){
  const vv=root.visualViewport,layoutHeight=root.innerHeight||baseline||1;
  const height=Math.max(1,Math.round(vv?.height||layoutHeight));
  const top=Math.max(0,Math.round(vv?.offsetTop||0));
  return {top,bottom:top+height,height,keyboard:Math.max(0,(baseline||layoutHeight)-(height+top))>110};
 }
 function distanceToVisible(rect,view,margin=16){
  const top=view.top+margin,bottom=view.bottom-margin;
  return rect.bottom>bottom?rect.bottom-bottom:rect.top<top?rect.top-top:0;
 }
 function scrollClosest(field,delta,doc,root){
  let parent=field.parentElement;
  while(parent&&parent!==doc.body&&parent!==doc.documentElement){
   const css=root.getComputedStyle?.(parent);
   if(parent.scrollHeight>parent.clientHeight+2&&
      /auto|scroll|overlay/.test(css?.overflowY||'')){
    if(typeof parent.scrollBy==='function')parent.scrollBy({top:delta,behavior:'instant'});
    else parent.scrollTop=(parent.scrollTop||0)+delta;
    return true;
   }
   parent=parent.parentElement;
  }
  return false;
 }
 function install(options={}){
  const win=options.window||root,doc=options.document||win.document;
  if(!doc||!win.addEventListener||doc.__abyssalKeyboardFocusReady)return false;
  doc.__abyssalKeyboardFocusReady=true;
  const html=doc.documentElement;
  let baseline=Math.max(win.innerHeight||0,html.clientHeight||0),active=null,dock=null,scheduled=0,retries=[];
  const isHandheld=()=>html.classList.contains('abyssal-handheld')||win.Capacitor?.getPlatform?.()==='android';
  function getDock(){
   if(dock)return dock;
   dock=doc.createElement('div');
   dock.id='abyssalKeyboardFocus';dock.className='abyssal-ime-focus';dock.hidden=true;
   const label=doc.createElement('span');label.className='abyssal-ime-label';
   const preview=doc.createElement('strong');preview.className='abyssal-ime-preview';
   dock.append(label,preview);doc.body.appendChild(dock);return dock;
  }
  function labelFor(field){
   const label=field.id?[...doc.querySelectorAll('label[for]')].find(node=>node.getAttribute('for')===field.id):null;
   return String(field.getAttribute?.('aria-label')||label?.textContent||field.name||field.placeholder||'DIGITANDO').trim().slice(0,66);
  }
  function hide(){
   html.classList.remove('abyssal-ime-visible');
   html.style.removeProperty('--abyssal-ime-height');
   html.style.removeProperty('--abyssal-ime-top');
   if(dock)dock.hidden=true;
  }
  function sync(){
   scheduled=0;
   const field=doc.activeElement;
   if(!isHandheld()||!isEditable(field)){active=null;hide();baseline=Math.max(win.innerHeight||0,html.clientHeight||0);return;}
   active=field;
   const view=viewport(win,baseline);
   // Treat a rotation as a new baseline only when the keyboard isn't present.
   if(!view.keyboard){hide();return;}
   html.classList.add('abyssal-ime-visible');
   html.style.setProperty('--abyssal-ime-height',view.height+'px');
   html.style.setProperty('--abyssal-ime-top',view.top+'px');
   let rect=field.getBoundingClientRect(),delta=distanceToVisible(rect,view,22);
   if(Math.abs(delta)>1){
    // Only scroll a genuine form container. Scrolling the page or a fixed
    // cockpit with scrollIntoView can push the entire editor behind the IME.
    scrollClosest(field,delta,doc,win);
    rect=field.getBoundingClientRect();delta=distanceToVisible(rect,view,22);
   }
   const el=getDock();
   el.hidden=Math.abs(delta)<=2;
   if(!el.hidden){
    const [label,preview]=el.children;
    label.textContent=labelFor(field);
    const protectedValue=field.type==='password';
    const text=protectedValue?'••••••':String(field.value??field.textContent??'').slice(-100);
    preview.textContent=text||field.placeholder||'Digite aqui';
    el.style.top=Math.max(view.top+6,view.bottom-94)+'px';
   }
  }
  function request(){
   if(scheduled)return;
   if(typeof win.requestAnimationFrame==='function')scheduled=win.requestAnimationFrame(sync);
   else {scheduled=1;win.setTimeout(sync,0);}
  }
  function onFocus(event){
   if(!isEditable(event.target))return;
   if(!isHandheld())return;
   active=event.target;
   baseline=Math.max(baseline,win.innerHeight||0,html.clientHeight||0);
   request();
   retries.forEach(win.clearTimeout);retries=[80,220,430].map(ms=>win.setTimeout(request,ms));
  }
  doc.addEventListener('focusin',onFocus);
  doc.addEventListener('focusout',()=>{win.setTimeout(()=>{if(!isEditable(doc.activeElement)){active=null;hide();baseline=Math.max(win.innerHeight||0,html.clientHeight||0);}else request();},75);});
  doc.addEventListener('input',e=>{if(e.target===active)request();});
  win.visualViewport?.addEventListener('resize',request,{passive:true});
  win.visualViewport?.addEventListener('scroll',request,{passive:true});
  win.addEventListener('resize',()=>{if(!isEditable(doc.activeElement))baseline=Math.max(win.innerHeight||0,html.clientHeight||0);request();},{passive:true});
  win.addEventListener('orientationchange',()=>{baseline=Math.max(win.innerHeight||0,html.clientHeight||0);request();},{passive:true});
  return true;
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={viewport,distanceToVisible,isEditable,install};
 if(root.document)install();
})(typeof window!=='undefined'?window:globalThis);
