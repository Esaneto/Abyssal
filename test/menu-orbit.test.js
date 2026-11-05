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
  ['abyssSettingsBtn','abyssExitBtn','controlsBtn'].forEach(id=>{
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' unique');
    assert.match(nav[1],new RegExp('id="'+id+'"'));
  });
  assert.match(html,/abyssal-menu-interactions\.js\?v=1/);
  assert.match(html,/abyssal-menu-orbit\.css\?v=4/);
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
  const interactions=read('public/abyssal-menu-interactions.js');
  assert.match(interactions,/settings\.addEventListener\('click'/);
  assert.match(interactions,/exit\.addEventListener\('click'/);
  assert.match(interactions,/popup\.classList\.add\('active'\)/);
  assert.match(interactions,/if\(event\.key==='Escape'\)/);
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
