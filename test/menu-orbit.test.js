'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = path => fs.readFileSync(path, 'utf8');

test('principal actions keep unique IDs inside the radial navigation', () => {
  const html = read('public/index.html');
  const orbit = html.match(/<nav class="abyss-orbit-navigation"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(orbit, 'radial navigation element must exist');
  [
    'playBtn', 'resonanceBtn', 'wheelBtn', 'onlineBtn', 'shopBtn',
    'catalogBtn', 'rankingsBtn', 'cardumesBtn', 'profileBtn',
    'matchHistoryBtn', 'supportBtn'
  ].forEach(id => {
    const pattern = new RegExp('\\bid="' + id + '"', 'g');
    assert.equal((html.match(pattern) || []).length, 1, id + ' must stay unique');
    assert.match(orbit[1], pattern, id + ' must be in the orbit');
  });
});

test('the descent gate is inserted inside the orbit without changing its events', () => {
  const source = read('public/abyssal-rebuild.js');
  assert.match(source, /orbit\.appendChild\(gate\)/);
  assert.match(source, /buildVortexStreams\(\)/);
  assert.match(source, /id="abyssGateButton"/);
  assert.match(source, /abyssal-start-rift-solo/);
  assert.match(source, /connectAndJoin/);
});

test('menu motion has a reduced-motion option and mobile touch layout', () => {
  const css = read('public/abyssal-menu-orbit.css');
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /@media\(max-width:1000px\),\(pointer:coarse\)/);
  assert.match(css, /abyss-vortex-shaft/);
  assert.match(css, /pointer-events:auto!important/);
});


test('cinematic menu retains interactive actions with symmetric cards', () => {
  const html=read('public/index.html');
  const nav=html.match(/<nav class="abyss-orbit-navigation"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav);
  ['resonanceBtn','wheelBtn','profileBtn','controlsBtn'].forEach(id=>{
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' unique');
    assert.match(nav[1],new RegExp('id="'+id+'"'));
  });
  assert.doesNotMatch(html,/abyssal-menu-interactions\.js\?v=1/);
  assert.match(html,/abyssal-menu-orbit\.css\?v=5/);
  assert.match(nav[1],/class="abyss-orbit-extras"/);
});

test('purple tentacle cursor has become a centered aiming reticle', () => {
  const svg=read('public/abyssal-tentacle-cursor.svg');
  const css=read('public/abyssal-menu-orbit.css');
  assert.match(svg,/<svg[^>]*width="48" height="48"/);
  assert.match(svg,/rotate\(270 24 24\)/);
  assert.match(svg,/cx="24" cy="24" r="3\.5"/);
  assert.match(css,/cursor:url\('abyssal-tentacle-cursor\.svg\?v=2'\) 24 24,crosshair!important/);
});

test('reference-inspired interface centers vortex and keeps extra features reachable', () => {
  const css=read('public/abyssal-menu-orbit.css');
  assert.match(css,/url\('abyssal-ocean-cinema\.svg'\)/);
  assert.match(css,/#abyssGate\s*\{\s*left:50%!important;top:50%!important/);
  assert.match(css,/abyss-orbit-extras/);
  assert.match(css,/@media\(max-width:1000px\),\(pointer:coarse\)/);
  const game=read('public/game.js'),online=read('public/online.js');
  assert.match(game,/\$\('resonanceBtn'\)\?\.addEventListener\('click'/);
  assert.match(game,/\$\('wheelBtn'\)\?\.addEventListener\('click'/);
  assert.match(online,/\$\('profileBtn'\)\?\.addEventListener\('click'/);
});


test('orbital navigation is a direct fullscreen menu child, not a narrow legacy menu column', () => {
  const html=read('public/index.html');
  const css=read('public/abyssal-menu-orbit.css');
  const section=html.slice(html.indexOf('<section id="menuScreen"'),html.indexOf('<section id="hud"'));
  const columnClose=section.indexOf('      </div>');
  const navStart=section.indexOf('<nav class="abyss-orbit-navigation"');
  assert.ok(navStart>columnClose,'orbit must no longer be inside menu-content');
  assert.match(section,/<div class="menu-content">[\s\S]*?<\/h1>\s*<\/div>\s*<nav class="abyss-orbit-navigation"/);
  assert.match(css,/#menuScreen > \.abyss-orbit-navigation\s*\{[\s\S]*?width:100vw!important/);
  assert.match(css,/#menuScreen > \.abyss-orbit-navigation #abyssGate\s*\{[\s\S]*?left:50%!important;top:50%!important/);
});

test('cursor is an aiming crosshair centered on a purple dot, even when hovering over the gate',()=>{
  const cursor=read('public/abyssal-tentacle-cursor.svg');
  const css=read('public/abyssal-menu-orbit.css');
  assert.match(cursor,/width="48" height="48" viewBox="0 0 48 48"/);
  assert.match(cursor,/rotate\(270 24 24\)/);
  assert.match(cursor,/<circle cx="24" cy="24" r="3\.5"/);
  assert.match(css,/cursor:url\('abyssal-tentacle-cursor\.svg\?v=2'\) 24 24,crosshair!important/);
  assert.match(css,/#abyssGate \*/);
});

test('crocodile and caiman require real payment rather than coins',()=>{
  const game=read('public/game.js');
  const server=read('server.js');
  const payments=read('payments.js');
  for(const id of ['saltcroc','blackcaiman']){
    assert.match(game,new RegExp("id:'"+id+"'[^\\n]*price:999,paid:true"));
    assert.match(game,new RegExp("paidBrl=Object\\.freeze\\(\\{[^\\n]*"+id+":999"));
    assert.match(payments,new RegExp(id+":\\{[^\\n]*brl:999"));
    assert.match(server,new RegExp("stripeOnlySkins = new Set\\(\\[[^\\n]*'"+id+"'"));
    assert.doesNotMatch(server,new RegExp("const prices = \\{[^\\n]*\\b"+id+":"));
  }
});


test('six central choices are the existing game actions without duplicated extra buttons',()=>{
  const html=read('public/index.html');
  const nav=html.match(/<nav class="abyss-orbit-navigation"[^>]*>([\s\S]*?)<\/nav>/)[1];
  const primary=nav.match(/<div class="menu-secondary-actions">([\s\S]*?)<\/div>/)[1];
  const extras=nav.match(/<div class="abyss-orbit-extras"[^>]*>([\s\S]*?)<\/div>/)[1];
  for(const id of ['onlineBtn','resonanceBtn','rankingsBtn','wheelBtn','shopBtn','profileBtn']){
    assert.match(primary,new RegExp('id="'+id+'"'),id+' is a main card');
    assert.doesNotMatch(extras,new RegExp('id="'+id+'"'),id+' is not duplicated below');
  }
  for(const id of ['abyssSettingsBtn','abyssExitBtn']){
    assert.doesNotMatch(html,new RegExp('id="'+id+'"'),id+' redundant entry removed');
  }
  assert.match(extras,/id="controlsBtn"[^>]*hidden/);
});

test('portal has deterministic uneven currents and the fenda button sits at its center',()=>{
  const js=read('public/abyssal-rebuild.js');
  const css=read('public/abyssal-menu-orbit.css');
  assert.match(js,/count=11,steps=84/);
  assert.match(js,/var outer=207\+noise/);
  assert.match(css,/#abyssGate \.abyss-gate-content\{\s*position:absolute!important;z-index:12!important;[\s\S]*?top:50%!important/);
  assert.match(css,/\.abyss-vortex-plane::before\{\s*opacity:0!important/);
});

test('cursor references use one asset and one hot spot to avoid hover jumps',()=>{
  const css=read('public/abyssal-menu-orbit.css');
  assert.doesNotMatch(css,/cursor:url\('abyssal-tentacle-cursor\.svg'\) 6 5/);
  const cursors=[...css.matchAll(/cursor:url\('abyssal-tentacle-cursor\.svg(?:\?v=2)?'\) ([0-9]+) ([0-9]+),\s*([a-z-]+)!important/g)];
  assert.ok(cursors.length>=3,'cursor should be applied across menu and UI');
  for(const [,x,y,fallback] of cursors){
    assert.equal(x,'24');assert.equal(y,'24');assert.equal(fallback,'crosshair');
  }
});
