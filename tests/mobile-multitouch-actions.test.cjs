'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {installMobileMultitouchControls}=require('../public/abyssal-mobile-multitouch');
function harness(){
 const handlers={},classes=new Set(['game-active','mobile-game-active']);
 const document={body:{classList:{contains:key=>classes.has(key)}}};
 const root={addEventListener:(name,callback,capture)=>{assert.equal(capture,true);handlers[name]=callback;},contains:()=>true};
 let clicks=0;
 const button={disabled:false,closest:s=>s==='button'?button:null,click:()=>{clicks++;}};
 const canvas={closest:()=>null};
 const event=(target,pointerId,type='pointerdown',extra={})=>({
  target,pointerId,pointerType:'touch',type,isTrusted:type==='click',detail:1,
  preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},
  stopImmediatePropagation(){this.stoppedImmediate=true;},...extra
 });
 assert.equal(installMobileMultitouchControls({root,document}),true);
 return {handlers,classes,button,canvas,event,getClicks:()=>clicks,root,document};
}
test('movement finger stays active while second finger activates a skill immediately',()=>{
 const h=harness();
 const move=h.event(h.canvas,10);h.handlers.pointerdown(move);
 assert.equal(move.prevented,undefined);
 const skill=h.event(h.button,11);h.handlers.pointerdown(skill);
 assert.equal(skill.prevented,true);assert.equal(skill.stopped,true);
 assert.equal(h.getClicks(),1); // no release of movement finger required
 const browserClick=h.event(h.button,11,'click');h.handlers.click(browserClick);
 assert.equal(browserClick.stoppedImmediate,true);
 assert.equal(h.getClicks(),1);
});
test('independent controls work repeatedly and never treat aim surface or canvas as a button',()=>{
 const h=harness();
 h.handlers.pointerdown(h.event(h.button,21));
 h.handlers.pointerdown(h.event(h.button,22));
 assert.equal(h.getClicks(),2);
 h.handlers.pointerdown(h.event(h.canvas,23));
 assert.equal(h.getClicks(),2);
 assert.equal(installMobileMultitouchControls({root:h.root,document:h.document}),false);
});
test('mouse, disabled buttons, menus and keyboard activation keep default behavior',()=>{
 const h=harness();
 h.handlers.pointerdown(h.event(h.button,30,'pointerdown',{pointerType:'mouse'}));
 assert.equal(h.getClicks(),0);
 h.button.disabled=true;h.handlers.pointerdown(h.event(h.button,31));
 h.button.disabled=false;assert.equal(h.getClicks(),0);
 h.classes.delete('mobile-game-active');h.handlers.pointerdown(h.event(h.button,32));
 assert.equal(h.getClicks(),0);h.classes.add('mobile-game-active');
 const keyboard=h.event(h.button,33,'click',{detail:0});
 h.handlers.click(keyboard);assert.equal(keyboard.stoppedImmediate,undefined);
});
test('browser, service worker and Android bundled game include the same touch bridge',()=>{
 const html=fs.readFileSync('public/index.html','utf8');
 const sw=fs.readFileSync('public/offline-sw.js','utf8');
 const ci=fs.readFileSync('.github/workflows/ci.yml','utf8');
 assert.match(html,/abyssal-mobile-multitouch\.js\?v=/);
 assert.match(sw,/'abyssal-mobile-multitouch\.js'/);
 assert.match(ci,/cmp public\/abyssal-mobile-multitouch\.js android\/app\/src\/main\/assets\/public\/abyssal-mobile-multitouch\.js/);
});
