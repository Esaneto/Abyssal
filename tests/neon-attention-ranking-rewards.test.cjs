'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=path=>fs.readFileSync(path,'utf8');
const attention=require('../public/abyssal-attention.js');
const signals=read('public/abyssal-state-signals.css'),review=read('public/abyssal-review.css');
const html=read('public/index.html'),game=read('public/game.js'),online=read('public/online.js');
const badgeCSS=read('public/abyssal-ranking-rewards.css');
test('red neon ring is a real overlay and blinks between invisible and luminous',()=>{
  assert.match(signals,/\.abyss-neon-frame/);
  assert.match(signals,/@keyframes abyss-neon-red-blink/);
  assert.match(signals,/0%,100%\{opacity:0/);
  assert.match(signals,/42%,56%\{opacity:1/);
  assert.match(signals,/border:2px solid #ff244e/);
  assert.match(signals,/pointer-events:none/);
  assert.doesNotMatch(review,/@keyframes abyss-attention/,'old constant teal pulse removed');
});
test('signed out account pulses red and authenticated account gets steady green border',()=>{
  assert.match(online,/btn\.classList\.toggle\('abyss-attention',!authenticated\)/);
  assert.match(online,/btn\.classList\.toggle\('abyss-account-linked',authenticated\)/);
  assert.match(online,/AbyssalAttention\?\.ensure\(btn\)/);
  assert.match(signals,/#menuScreen #loginBtn\.abyss-account-linked > \.abyss-neon-frame/);
  assert.match(signals,/border-color:#39e5a1!important/);
  assert.match(signals,/animation:none!important/);
});
test('notifications flash for unread; opening marks as viewed before cockpit routing',()=>{
  assert.match(game,/hubNotices\.classList\.toggle\('abyss-attention',hasUnread\)/);
  assert.match(game,/cockpit\.classList\.toggle\('abyss-attention',hasUnread\)/);
  assert.match(game,/btn\.classList\.toggle\('abyss-attention',hasUnread\)/);
  for(const call of ['ensure(hubNotices)','ensure(cockpit)','ensure(btn)'])assert.ok(game.includes('AbyssalAttention?.'+call));
  const open=game.slice(game.indexOf('function openNotifPanel()'),game.indexOf('function closeNotifPanel()'));
  assert.ok(open.indexOf('abyssalNotificationsLastSeen')<open.indexOf("routeScreen?.('notifPanel')"));
  const handlers=game.slice(game.indexOf('function initNotifSystem()'),game.indexOf('// User-supplied audio only'));
  assert.match(handlers,/hubNoticesBtn\.addEventListener\('click'/);
});
test('lightweight indicator cannot steal touch or add textual noise',()=>{
  const mockDocument={createElement:()=>({className:'',setAttribute(n,v){this[n]=v}})};
  const element={ownerDocument:mockDocument,kids:[],querySelector(){return this.kids[0]||null},appendChild(x){this.kids.push(x)}};
  const a=attention.ensure(element),b=attention.ensure(element);
  assert.equal(a,b);
  assert.equal(a['aria-hidden'],'true');
  assert.equal(element.kids.length,1);
  assert.equal(attention.ensure(null),null);
});
test('ranking reward is placed inline with period titles, uses authoritative server values',()=>{
 assert.match(online,/function rankingRewardBadge\(key,rewards\)/);
 assert.match(online,/if\(key==='eternal'\)return ''/);
 assert.match(online,/Number\(rewards\?\.\[key\]\)/);
 assert.match(online,/rankingRewardBadge\(key,rewards\)/);
 assert.match(online,/ranking-title-line/);
 assert.match(online,/\+\x27\+formatted/);
 assert.match(online,/#bc79ff/);
 assert.match(badgeCSS,/ranking-energy-orb/);
 assert.match(badgeCSS,/flex-wrap:wrap/);
});
test('scripts and styles ship in installed app and offline cache',()=>{
 const sw=read('public/offline-sw.js');
 for(const file of ['abyssal-attention.js','abyssal-state-signals.css','abyssal-ranking-rewards.css']){
   assert.ok(html.includes(file),file+' absent in page');
   assert.ok(sw.includes("'"+file+"'"),file+' absent in offline cache');
 }
});
