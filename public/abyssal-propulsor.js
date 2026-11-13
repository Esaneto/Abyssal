(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AbyssalPropulsor=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const CAPACITY=100,DRAIN=10,RECHARGE=2.5,SPEED=2.35;
function charge(value){return value!=null&&Number.isFinite(Number(value))?Math.max(0,Math.min(CAPACITY,Number(value))):CAPACITY;}
function step(value,dt,equipped,moving){const seconds=Math.max(0,Math.min(2,Number(dt)||0));const energy=charge(value);return equipped&&moving?Math.max(0,energy-DRAIN*seconds):Math.min(CAPACITY,energy+RECHARGE*seconds);}
return Object.freeze({CAPACITY,DRAIN,RECHARGE,SPEED,charge,step});});
