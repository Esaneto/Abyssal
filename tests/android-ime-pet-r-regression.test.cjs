'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {installMobileMultitouchControls}=require('../public/abyssal-mobile-multitouch');

test('R pointer event stays trusted while another pointer owns swimming; Q/E keep click handlers',()=>{
 const handlers={};let jsClicks=0,casts=0,castPointer=null;
 const shell={contains:()=>true,addEventListener:(type,fn)=>{handlers[type]=fn;}};
 const document={body:{classList:{contains:key=>key==='game-active'||key==='mobile-game-active'}}};
 const mkButton=id=>({id,disabled:false,closest:s=>s==='button'?mkButton.cache: null,click(){jsClicks++;}});
 const button=mkButton('skinActiveBtn');mkButton.cache=button;
 const original=globalThis.AbyssalGameHooks;
 try{
  globalThis.AbyssalGameHooks={activateSkinAbilityFromPointer:e=>{casts++;castPointer=e;return true;}};
  assert.equal(installMobileMultitouchControls({root:shell,document}),true);
  const moved={target:{closest:()=>null},pointerId:11,pointerType:'touch',isTrusted:true,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}};
  handlers.pointerdown(moved);assert.equal(moved.prevented,undefined);
  const pressed={target:button,pointerId:12,pointerType:'touch',type:'pointerdown',isTrusted:true,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}};
  handlers.pointerdown(pressed);
  assert.equal(casts,1);assert.equal(castPointer,pressed);assert.equal(jsClicks,0);
  assert.equal(pressed.prevented,true);
  const nativeClick={target:button,pointerId:12,isTrusted:true,detail:1,preventDefault(){this.prevented=true},stopPropagation(){},stopImmediatePropagation(){this.suppressed=true}};
  handlers.click(nativeClick);assert.equal(nativeClick.suppressed,true);
  assert.equal(casts,1);assert.equal(jsClicks,0);
  button.id='skillPulseBtn';
  handlers.pointerdown({...pressed,pointerId:13});assert.equal(jsClicks,1);
 }finally{if(original===undefined)delete globalThis.AbyssalGameHooks;else globalThis.AbyssalGameHooks=original;}
});
test('R still validates trusted user interaction in original game engine',()=>{
 const src=fs.readFileSync('public/game.js','utf8');
 assert.match(src,/activateSkinAbilityFromPointer:event=>Boolean\(event\?\.isTrusted===true/);
 assert.match(src,/event\.target\?\.closest\?\.\('#skinActiveBtn'\)/);
 assert.match(src,/if\(inputEvent\?\.isTrusted!==true\)return false/);
 assert.match(src,/skinActiveBtn'\)\?\.addEventListener\('click',event=>activateSkinAbility\(event\)\)/);
});
test('IME form stays inside visible cockpit and legacy auto-scroll cannot crop it',()=>{
 const style=fs.readFileSync('public/abyssal-keyboard-focus.css','utf8');
 const mobile=fs.readFileSync('public/mobile-portrait.js','utf8');
 const js=fs.readFileSync('public/abyssal-keyboard-focus.js','utf8');
 assert.match(style,/#submarineWorkshop\.abyss-visor-expanded \.abyss-cockpit-console:focus-within/);
 assert.match(style,/height:calc\(100% - 16px\)!important/);
 assert.match(style,/#submarineWorkshop\.abyss-visor-expanded \.abyss-visor-body:focus-within/);
 assert.match(style,/\.abyss-visor-scroll-hint\{\s*display:none!important/);
 assert.doesNotMatch(mobile,/field\.scrollIntoView/);
 assert.doesNotMatch(js,/field\.scrollIntoView/);
});
