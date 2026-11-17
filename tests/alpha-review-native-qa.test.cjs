'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=path=>fs.readFileSync(path,'utf8');
const {shouldOffer,DELAY}=require('../public/abyssal-review.js');

test('end-of-dive review offers only with five-minute interval, permanent opt out and reviewed state',()=>{
 assert.equal(DELAY,300000);
 assert.equal(shouldOffer({lastShown:1000},300999),false);
 assert.equal(shouldOffer({lastShown:1000},301000),true);
 assert.equal(shouldOffer({never:true},10000000),false);
 assert.equal(shouldOffer({reviewed:true},10000000),false);
 const game=src('public/game.js'),html=src('public/index.html'),client=src('public/abyssal-review.js');
 assert.match(game,/CustomEvent\('abyssal-run-ended'/);
 assert.match(html,/id="playReviewBtn" class="hub-discord-btn"/);
 assert.match(client,/data-rate-choice="rate"/);
 assert.match(client,/data-rate-choice="later"/);
 assert.match(client,/data-rate-choice="never"/);
 assert.match(client,/Capacitor\?\.Plugins\?\.AbyssalStore/);
});
test('login and unread notices pulse without blocking navigation; embedded notices get marked read',()=>{
 const online=src('public/online.js'),game=src('public/game.js'),css=src('public/abyssal-state-signals.css');
 assert.match(online,/btn\.classList\.toggle\('abyss-attention',!authenticated\)/);
 assert.match(game,/hubNotices\.classList\.toggle\('abyss-attention',hasUnread\)/);
 assert.match(game,/cockpit\.classList\.toggle\('abyss-attention',hasUnread\)/);
 const open=game.slice(game.indexOf('function openNotifPanel()'),game.indexOf('function closeNotifPanel()'));
 assert.ok(open.indexOf('abyssalNotificationsLastSeen')<open.indexOf("routeScreen?.('notifPanel')"),'must mark seen before embedded return');
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('native immersive Android WebView does not double pad IME; native Play listing opens externally',()=>{
 const android=src('scripts/configure-android.cjs');
 assert.match(android,/if \(keyboardVisible\) \{\s*view\.setPadding\(safe\.left, safe\.top, safe\.right, 0\);\s*return insets;/);
 assert.doesNotMatch(android,/Math\.max\(safe\.bottom, ime\.bottom\)/);
 assert.match(android,/AbyssalStorePlugin\.class/);
 assert.match(android,/market:\/\/details\?id=com\.esaneto\.abyssal/);
});
test('alpha reward is server-only, once per account, includes 1000 energy and one choice-based fin',()=>{
 const server=src('server.js'),wardrobe=src('public/avatar-wardrobe.js');
 const admin=src('gamemaster-admin.js');
 assert.doesNotMatch(server,/alpha-tester/i,'literal code should not appear in tracked source');
 assert.match(server,/alphaDigest='[a-f0-9]{64}'/);
 assert.match(server,/redeemedPromoIds\.includes\(claimId\)/);
 assert.match(server,/previousEnergy\+1000/);
 assert.match(server,/alphaFinCredits=Math\.min\(1/);
 assert.match(server,/socket\.on\('claim-alpha-fin'/);
 assert.match(server,/product\.slot!=='fins'/);
 assert.match(wardrobe,/RESGATAR NADADEIRA ALPHA/);
 assert.match(wardrobe,/online\.claimAlphaFin\(p\.key/);
 assert.match(admin,/op==='online'/);
 assert.match(admin,/actor!=='gamemaster'/);
});
test('review resources are included in native APK and offline shell',()=>{
 const html=src('public/index.html'),sw=src('public/offline-sw.js');
 for(const name of ['abyssal-review.js','abyssal-review.css']){assert.ok(html.includes(name),name);assert.ok(sw.includes("'"+name+"'"),name);}
});
