const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const game=fs.readFileSync(path.join(root,'public','game.js'),'utf8');
const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'public','style.css'),'utf8');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');

test('toxic cloud and green serpent poison are manual standardized actives',()=>{
 const S=require('../public/skin-standard.js');
 assert.equal(S.profile('toxic').active,'cloud');assert.equal(S.profile('greensnake').active,'poison');
 assert.doesNotMatch(game,/equippedSkin==='greensnake'[\\s\\S]{0,180}poisonTimer/);
 assert.match(game,/function activateSkinAbility\\(/);assert.match(server,/payload\\.type!=='standard-active'/);
});
test('notification bell has a concrete unread dot controlled by state',()=>{
 assert.match(html,/id="notifUnreadDot"[^>]*notification-badge-dot/);
 assert.match(game,/notifUnreadDot[\s\S]{0,180}dot\.hidden\s*=\s*!hasUnread/);
 assert.match(css,/\.notification-badge-dot\[hidden\]/);
});

test('gameplay notices are queued and limited to gameplay-critical kinds including cave choices',()=>{
 assert.match(game,/new Set\(\['boss','fusion','join','death','cave'\]\)/);
 assert.match(game,/gameplayNoticeQueue\.sort\(\(a,b\)=>b\.priority-a\.priority/);
 assert.match(server,/kind:'death'[\s\S]{0,220}foi engolido pelas profundezas/);
 assert.match(server,/kind:'fusion'[\s\S]{0,220}fundiu habilidades/);
});

test('pvp visuals and projectiles respect arena rocks',()=>{
 assert.match(game,/projectileHitsPvpWall\(prevX,prevY,p\.x,p\.y,p\.r\|\|0\)/);
 assert.match(game,/fx\.type==='occluded-ring'[\s\S]{0,500}projectileHitsPvpWall/);
 assert.match(game,/fx\.type==='photon-ray'[\s\S]{0,900}projectileHitsPvpWall/);
 assert.match(server,/pvpSegmentHitsRock\(centerX,centerY,target\.x,target\.y/);
});

test('gravitational rupture cadence is not faster than the base 0.52s cadence',()=>{
 assert.match(game,/gravitationalRuptureTimer=\.52/);
 assert.doesNotMatch(game,/gravitationalRuptureTimer=\.34/);
});

test('rankings expose live reward countdowns',()=>{
 const online=fs.readFileSync(path.join(root,'public','online.js'),'utf8');
 assert.match(online,/rankingCountdown\(target\)/);
 assert.match(online,/RECOMPENSA EM/);
 assert.match(online,/ranking-countdown/);
});
