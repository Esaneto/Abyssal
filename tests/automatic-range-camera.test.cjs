'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const game=fs.readFileSync('public/game.js','utf8'),html=fs.readFileSync('public/index.html','utf8'),cockpit=fs.readFileSync('public/abyssal-submarine-cockpit.js','utf8');
test('automatic camera ignores saved zoom and follows the firing range',()=>{
 const source=game.slice(game.indexOf('function desiredWorldZoom(){'),game.indexOf('function desiredMapFactor(){'));
 assert.doesNotMatch(source,/localStorage|preference\s*[*/]/);
 const run=new Function('mobileViewport','onlineMode','onlineRoomMode','upgrades','viewW','viewH','GAME_WORLD_ZOOM','FAIR_VIEW_REFERENCE','CAMERA_RANGE_MAX','isClassicCavernRun','getFiringRange','clamp',source+';return desiredWorldZoom();');
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),z=(range,mobile=false)=>run(mobile,true,'coop',{range:1},mobile?390:1366,mobile?844:768,.78,{zoom:.78},1.22**3,()=>true,()=>294/.78*range,clamp);
 assert.ok(z(1)>z(1.22));assert.ok(z(1.22)>z(1.22**3));assert.ok(z(1,true)>z(1.22,true));
});
test('manual zoom is no longer exposed in cockpit',()=>{assert.doesNotMatch(html,/data-cockpit-setting="zoom"/);assert.doesNotMatch(cockpit,/abyssalCameraZoomPc|abyssalCameraZoomMobile/);});
