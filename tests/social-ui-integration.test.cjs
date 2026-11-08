'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('notification system is bridged to online features',()=>{
 const game=read('public/game.js');
 assert.match(game,/window\.addNotification\s*=\s*addNotification/);
 assert.match(game,/window\.updateNotifBadge\s*=\s*updateNotifBadge/);
 assert.match(game,/notifUnreadDot/);
});




test('remaining UGC has in-app reporting wired to human moderation',()=>{
 const server=read('server.js'),online=read('public/online.js'),html=read('public/index.html');
 assert.match(server,/socket\.on\('report-ugc'/);
 assert.match(server,/abyssalelectrongames@gmail\.com/);
 assert.match(server,/CONTEÚDO \/ PERFIL CAPTURADO/);
 assert.match(online,/openUgcReport\('profile'/);
 assert.match(online,/openUgcReport\('cardume'/);
 assert.match(html,/id="ugcReportScreen"/);
 assert.match(html,/id="reportProfileBtn"/);
});

test('UGC profile safety includes a user restriction action',()=>{
 const server=read('server.js'),online=read('public/online.js'),html=read('public/index.html');
 assert.match(server,/toggle-user-block/);
 assert.match(server,/blockedUsers/);
 assert.match(online,/blockProfileBtn/);
 assert.match(html,/id="blockProfileBtn"/);
});

test('account deletion exists both in-app and as a public web request path',()=>{
 const server=read('server.js'),html=read('public/index.html'),support=read('support.js'),deletion=read('public/delete-account.html');
 assert.match(server,/socket\.on\('delete-account'/);
 assert.match(html,/id="deleteAccountBtn"/);
 assert.match(support,/\/api\/account-deletion-request/);
 assert.match(deletion,/Excluir conta do Abyssal/);
});


test('hidden modal screens cannot intercept login or menu controls',()=>{
 const css=read('public/style.css');
 assert.match(css,/\.screen\[hidden\],\.modal-screen\[hidden\]\{display:none!important;pointer-events:none!important\}/);
});

test('download and controls menu utilities remain compact instead of full width',()=>{
 const css=read('public/style.css');
 assert.match(css,/#menuScreen \.download-cta,#menuScreen \.controls-cta\{[\s\S]*?width:max-content!important/);
 assert.match(css,/#menuScreen \.download-cta\{right:10px!important;bottom:44px!important/);
 assert.match(css,/#menuScreen \.controls-cta\{right:10px!important;bottom:10px!important/);
});


test('moderation socket listener is bound only after the socket is created',()=>{
 const online=read('public/online.js');
 const created=online.indexOf("socket=window.io(SERVER_URL");
 const listener=online.indexOf("socket.on('ugc-report-result'");
 assert.ok(created>=0&&listener>created,'report listener must not dereference a null socket during startup');
});



test('mobile keeps download and controls in the top bar but removes fullscreen slot',()=>{
 const css=read('public/style.css');
 assert.match(css,/#mobileDownloadTopBtn,#mobileControlsTopBtn\{[\s\S]*?display:inline-flex!important/);
 assert.match(css,/#fullscreenBtn\{[\s\S]*?display:none!important[\s\S]*?width:0!important/);
});

test('new menu separates destination portals from legacy orbital layout',()=>{
  const html=read('public/index.html'),css=read('public/abyssal-menu-v2.css');
  for(const id of ['playBtn','onlineBtn','riftPortalBtn','shopBtn','profileBtn','resonanceBtn','rankingsBtn','wheelBtn'])assert.match(html,new RegExp('id="'+id+'"'));
  assert.doesNotMatch(html,/abyss-orbit-navigation|menu-fauna|menu-secondary-actions/);
  assert.match(css,/#menuScreen\.ocean-menu-v2 \.abyss-destination/);
});
 
 test('account and online menu actions are owned by the online module',()=>{
 const online=read('public/online.js'),game=read('public/game.js');
 assert.match(online,/\$\('loginBtn'\)\?\.addEventListener\('click',\(\)=>openLogin\(\)\)/);
 assert.match(online,/\$\('onlineBtn'\)\?\.addEventListener\('click'/);
 assert.doesNotMatch(game,/\$\('loginBtn'\)\.addEventListener/);
 assert.doesNotMatch(game,/\$\('onlineBtn'\)\.addEventListener/);
});

test('UGC modal exists before online client scripts execute',()=>{
 const html=read('public/index.html');
 assert.ok(html.indexOf('id="ugcReportScreen"')<html.indexOf('src="online.js'));
});


test('solo and resonance occupy separate spatial destinations',()=>{

 const menu=read('public/abyssal-menu-ocean.js'),html=read('public/index.html');
 assert.match(menu,/id:'playBtn',x:\.19,y:\.47/);
 assert.match(menu,/id:'onlineBtn',x:\.81,y:\.47/);
 assert.match(html,/<nav class="abyss-ocean-utilities"/);
 const nav=html.slice(html.indexOf('<nav class="abyss-ocean-utilities"'),html.indexOf('</nav>',html.indexOf('<nav class="abyss-ocean-utilities"')));
 assert.match(nav,/id="resonanceBtn"/);
 assert.doesNotMatch(nav,/id="playBtn"/);
});

test('Abyssary reads current enemy balance and wraps stat badges',()=>{
 const game=read('public/game.js'),css=read('public/style.css');
 assert.match(game,/window\.AbyssalEnemyAI\?\.ENEMY_STATS\?\.\[kind\]/);
 assert.match(game,/live\.dashSpeed \?\? live\.speed/);
 assert.match(css,/\.monster-stats-row\{display:flex!important;flex-wrap:wrap!important/);
 assert.match(css,/\.stat-spd\{/);
});

test('profile safety actions are compact and report is red',()=>{
 const html=read('public/index.html'),css=read('public/style.css');
 assert.match(html,/profile-top-actions/);
 assert.match(html,/profile-report-btn/);
 assert.match(css,/\.profile-report-btn\{[^}]*rgba\(255,69,89/);
});

test('boss bundle displays 39.99 and discounts missing specimens proportionally',()=>{
 const game=read('public/game.js');
 assert.match(game,/const bundleFullBrl=3999/);
 assert.match(game,/Math\.round\(bundleFullBrl\*\(remaining\/bundleIds\.length\)\)/);
 assert.match(game,/DESCONTO PROPORCIONAL MANTIDO/);
});

test('mobile menu has independently sized stations and touch navigation',()=>{

 const css=read('public/abyssal-menu-v2.css'),menu=read('public/abyssal-menu-ocean.js');
 assert.match(css,/@media\(max-width:550px\)/);
 assert.match(css,/abyss-ocean-mobile-pad/);
 assert.match(menu,/joystickX=dx\/length\*scale/);
 assert.match(menu,/pad\.setPointerCapture\(e\.pointerId\)/);
 assert.match(menu,/stage\.addEventListener\('pointerdown'/);
});

test('multiplayer keeps offscreen enemy motion warm instead of viewport-culling mobs',()=>{
 const server=read('server.js');
 assert.match(server,/sendFar=!recipient\|\|motionNow-\(Number\(recipient\.lastFarMotionAt\)\|\|0\)>=250/);
 assert.match(server,/const enemies=recipient\?world\.enemies\.filter\(e=>sendFar\|\|/);
 assert.match(server,/if\(recipient&&sendFar\)recipient\.lastFarMotionAt=motionNow/);
});


test('profile menu button opens the account profile flow',()=>{
 const online=read('public/online.js');
 assert.match(online,/\$\('profileBtn'\)\?\.addEventListener\('click',\(\)=>openProfile\(\)\)/);
});

test('Abyssary stats are centered in HP damage speed order',()=>{
 const css=read('public/style.css');
 assert.match(css,/\.monster-stats-row\{[\s\S]*?justify-content:center!important/);
 assert.match(css,/\.monster-stats-row \.stat-hp\{order:1\}/);
 assert.match(css,/\.monster-stats-row \.stat-dmg\{order:2\}/);
 assert.match(css,/\.monster-stats-row \.stat-spd\{order:3\}/);
});


test('match history keeps ten server-backed matches with participant moderation path',()=>{
 const server=read('server.js'),online=read('public/online.js'),html=read('public/index.html');
 assert.match(server,/matchHistory=.*slice\(0,10\)/);
 assert.match(server,/damageDealt=.*\+applied/);
 assert.match(server,/personalBossesKilled=.*\+1/);
 assert.match(server,/socket\.on\('get-match-history'/);
 assert.match(html,/id="matchHistoryBtn"/);
 assert.match(html,/id="matchHistoryScreen"/);
 assert.match(online,/openPublicProfile\(player\.nickname,\{matchId:match\.id/);
});

test('public profile like and report actions are inside the identity hero',()=>{
 const html=read('public/index.html');
 const hero=html.indexOf('class="profile-hero"'),actions=html.indexOf('id="publicProfileActions"'),stats=html.indexOf('class="profile-stats"');
 assert.ok(hero>=0&&actions>hero&&actions<stats);
});


test('moderation email contains internal ids match evidence recurrence and anti-spam controls',()=>{
 const server=read('server.js'),online=read('public/online.js');
 assert.match(server,/UUID permanente do denunciante/);
 assert.match(server,/UUID permanente do alvo/);
 assert.match(server,/CONTEXTO DA PARTIDA/);
 assert.match(server,/Denúncias anteriores registradas contra este alvo/);
 assert.match(server,/recent\.length>=8/);
 assert.match(server,/Esta denúncia já foi registrada recentemente/);
 assert.match(online,/matchId:match\.id/);
 assert.match(online,/bossesKilled:player\.bossesKilled,damage:player\.damage/);
});


test('accounts have immutable UUID identity for moderation independent of nickname',()=>{
 const server=read('server.js');
 assert.match(server,/function ensureAccountId\(u\)/);
 assert.match(server,/accountId:crypto\.randomUUID\(\)/);
 assert.match(server,/UUID permanente do denunciante/);
 assert.match(server,/UUID permanente do alvo/);
 assert.match(server,/UUID permanente da conta/);
});
