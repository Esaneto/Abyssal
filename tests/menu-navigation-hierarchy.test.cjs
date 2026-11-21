'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('exterior has one destination per primary action; legacy event bridges remain intact',()=>{
 const html=read('public/index.html');
 const nav=html.match(/<nav class="hub-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
 assert.match(nav,/id="submarineWorkshopBtn"/);
 for(const id of ['catalogBtn','profileBtn'])assert.match(nav,new RegExp('id="'+id+'"[^>]*hidden[^>]*aria-hidden="true"'));
 const secondary=html.match(/<div class="hub-secondary">([\s\S]*?)<\/details><\/div>/)?.[1]||'';
 assert.match(secondary,/id="hubMore"/);
 for(const id of ['exteriorGuideBtn','menuTourBtn'])assert.match(secondary,new RegExp('id="'+id+'"'));
 for(const id of ['shopBtn','wheelBtn','rankingsBtn','cardumesBtn','matchHistoryBtn','hubNoticesBtn'])assert.match(secondary,new RegExp('id="'+id+'"'));
 assert.match(secondary,/<h3>PROGRESSÃO<\/h3>/);
 assert.match(secondary,/<h3>COMUNIDADE<\/h3>/);
 assert.match(secondary,/style="display:none!important"/);
});

test('physical cockpit has only Settings and unread Notices in the top bar',()=>{
 const html=read('public/index.html'),runtime=read('public/abyssal-exploration-runtime.js');
 const top=html.split('class="abyss-cockpit-top-actions"')[1].split('<\/div><button id="cockpitTourBtn"')[0];
 const visible=top.split('<div class="cockpit-command-bridges"')[0];
 assert.equal((visible.match(/class="cockpit-command/g)||[]).length,2);
 assert.match(visible,/data-cockpit-setting="settings"/);
 assert.match(visible,/data-cockpit-proxy="notifBtn"/);
 assert.match(visible,/cockpit-unread-dot/);
 assert.match(top,/cockpit-command-bridges" hidden aria-hidden="true" style="display:none!important"/);
 const utility=html.match(/<nav class="abyss-cockpit-utilities"[^>]*>/)?.[0]||'';
 assert.match(utility,/hidden aria-hidden="true" style="display:none!important"/);
 for(const id of ['cockpitWheelBtn','cockpitProfileBtn','cockpitRankingBtn','cockpitCardumesBtn'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(runtime,/new Set\(\['settings','language','controls'/);
});

test('each station owns distinct destinations without duplicating quick actions',()=>{
 const src=read('public/abyssal-exploration-runtime.js');
 const cockpit=src.split("const entries=hub==='socialHub'?")[1].split("const panel=document.createElement")[0];
 const social=cockpit.split("]:hub==='arsenalHub'?")[0];
 const arsenal=cockpit.split("]:hub==='arsenalHub'?[")[1].split("]:[")[0];
 assert.match(social,/'CARDUMES'/);assert.match(social,/'RANKING'/);assert.match(social,/'ROLETA'/);
 assert.doesNotMatch(social,/'AVISOS'/);
 assert.match(arsenal,/'CATÁLOGO DE ECOS'/);assert.match(arsenal,/'ABYSSÁRIO'/);
 assert.doesNotMatch(arsenal,/'ADQUIRIR ECOS'|'MEUS ECOS'|'RESGATAR CÓDIGO'/);
 const marker="body.textContent='Escolha como deseja explorar as profundezas.'";const start=src.indexOf(marker);assert.ok(start>0);const home=src.slice(start,src.indexOf("}else utility.append(heading,body,action)",start));
 assert.match(home,/cockpitSoloDiveBtn/);assert.match(home,/cockpitOnlineDiveBtn/);
 assert.doesNotMatch(home,/abyss-wardrobe-entry|createSoloResearchNav\(\)/);
 assert.match(src,/\['ARMÁRIO','Personalize seu mergulhador.'/);
 assert.match(src,/\['EDITAR HUD','Ajuste a interface da partida.'/);
});

test('settings consolidate advanced groups without changing original selectors or preferences',()=>{
 const page=read('public/abyssal-submarine-cockpit.js');
 const html=read('public/index.html');
 const css=read('public/abyssal-cockpit-stations.css');
 assert.match(page,/if\(name==='settings'\)/);
 for(const name of ['language','controls','volume','filter','fullscreen'])
  assert.match(page,new RegExp("'"+name+"'"));
 assert.match(page,/cockpit-setting-accordion/);
 assert.match(html,/abyssal-cockpit-stations\.css\?v=3\.6\.154\.loop/);
 assert.match(read('public/offline-sw.js'),/2026-11-21-combat-engagement-v315/);
 assert.match(css,/\.cockpit-setting-accordion/);
});
