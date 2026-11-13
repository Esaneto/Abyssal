'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const server=read('server.js');

test('RoxyCloud profile keeps blocking work away from the 20 Hz simulation thread',()=>{
 assert.doesNotMatch(server,/scryptSync/);
 assert.match(server,/crypto\.scrypt\(/);
 assert.match(server,/MAX_PENDING_PASSWORD_HASHES=32/);
 assert.match(server,/passwordHashQueue/);
 assert.doesNotMatch(server,/writeFileSync\(USERS_FILE/);
 assert.match(server,/state-persistence-worker\.js/);
});

test('RoxyCloud systemd profile is sized for 2 vCPU and 4 GB RAM',()=>{
 const unit=read('deploy/roxycloud/abyssal.service');
 assert.match(unit,/ABYSSAL_RESOURCE_PROFILE=roxycloud-ryzen4/);
 assert.match(unit,/UV_THREADPOOL_SIZE=4/);
 assert.match(unit,/NODE_OPTIONS=--max-old-space-size=1536/);
 assert.match(unit,/MemoryHigh=3072M/);
 assert.match(unit,/MemoryMax=3584M/);
 assert.match(unit,/LimitNOFILE=65535/);
 assert.doesNotMatch(unit,/cluster/i);
});

test('RoxyCloud Nginx profile supports epoll and long-lived WebSockets',()=>{
 const main=read('deploy/roxycloud/nginx-main.conf');
 const site=read('deploy/roxycloud/nginx-abyssal.conf');
 assert.match(main,/worker_processes auto/);
 assert.match(main,/use epoll/);
 assert.match(main,/worker_connections 4096/);
 assert.match(site,/location \/socket\.io\//);
 assert.match(site,/proxy_buffering off/);
 assert.match(site,/proxy_read_timeout 1d/);
 assert.match(site,/Cache-Control \"public, no-cache, must-revalidate\"/);
 assert.doesNotMatch(site,/no-store, no-cache, must-revalidate/);
});

test('RoxyCloud preflight requires the purchased 2 vCPU and roughly 4 GB RAM',()=>{
 const preflight=read('scripts/roxycloud-preflight.cjs');
 assert.match(preflight,/cpuCount >= 2/);
 assert.match(preflight,/totalRamGiB >= 3\.5/);
 assert.match(preflight,/roxycloud-ryzen4/);
 assert.match(preflight,/freeDiskGiB >= 15/);
});

test('RoxyCloud deployment rejects a wrong runtime profile and retains rollback',()=>{
 const deploy=read('deploy/roxycloud/deploy.sh');
 assert.match(deploy,/h\.resources\?\.profile==="roxycloud-ryzen4"/);
 assert.match(deploy,/h\.persistence==="postgres"/);
 assert.doesNotMatch(deploy,/h\.activePlayers===0|h\.online===0/);
 assert.match(deploy,/export PATH=.*\/usr\/sbin/);
 assert.match(deploy,/git worktree add --detach "\$stage" "\$target"/);
 for(const file of ['roxycloud-readiness','roxycloud-stripe-webhook','specimen-journal-biology','submarine-repair-performance','native-update']){
  assert.ok(deploy.split('\n').some(line=>line.includes('node --test')&&line.includes('tests/'+file+'.test.cjs')));
 }
 const stageTests=deploy.indexOf('as_app node --test');
 const stop=deploy.lastIndexOf('systemctl stop abyssal');
 assert.ok(stageTests>=0&&stop>stageTests);
 assert.match(deploy,/trap rollback ERR/);
 assert.match(deploy,/git checkout --detach "\$previous" && as_app npm ci --omit=dev && systemctl start abyssal && health/);
 assert.match(deploy,/systemctl start abyssal\nhealth/);
});

test('RoxyCloud kernel profile limits swap pressure and preserves connection backlog',()=>{
 const sysctl=read('deploy/roxycloud/99-abyssal.conf');
 assert.match(sysctl,/net\.core\.somaxconn = 4096/);
 assert.match(sysctl,/net\.ipv4\.tcp_max_syn_backlog = 8192/);
 assert.match(sysctl,/vm\.swappiness = 10/);
});


test('Rajada Prismatica is passive end to end and cannot become a shot type again',()=>{
 const game=read('public/game.js');
 assert.match(game,/passive:\['burst','ricochet','spread'\]/);
 assert.doesNotMatch(game,/shots:\[[^\]]*'spread'/);
 assert.doesNotMatch(game,/activeShot==='spread'/);
 assert.doesNotMatch(server,/shotSkills=new Set\(\[[^\]]*'spread'/);
 assert.doesNotMatch(server,/special:\[[^\]]*'spread'/);
 assert.doesNotMatch(server,/WEAPON_INFUSION_SHOTS=new Set\(\[[^\]]*'spread'/);
 assert.match(server,/p\.prismaticLevel = clamp\(Math\.floor\(Number\(payload\.prismaticLevel\)/);
});

test('rewarded wheel uses the original reward scale converted to energy',()=>{
 assert.match(server,/let reward=roll<40\?20:roll<70\?50:roll<88\?100:roll<96\?300:roll<99\.9\?600:1000/);
 assert.match(server,/u\.energy=\(u\.energy\|\|0\)\+reward/);
});

test('RoxyCloud deploy persists and restores the active run before maintenance disconnect',()=>{
 const game=read('public/game.js');
 const unit=read('deploy/roxycloud/abyssal.service');
 const stashAt=server.indexOf('let deployRuns=0;');
 const flushAt=server.indexOf('await flushPersistence();',stashAt);
 const noticeAt=server.indexOf("io.emit('server-maintenance'",stashAt);
 const disconnectAt=server.indexOf('io.disconnectSockets(true)',stashAt);
 assert.ok(stashAt>=0&&flushAt>stashAt&&noticeAt>flushAt&&disconnectAt>noticeAt);
 assert.match(server,/resumeBuild:\{regenLevel:/);
 assert.match(server,/runResume:resumedRun\?deployRunResumePayload\(resumedRun\):null/);
 assert.match(server,/expiresAt:Date\.now\(\)\+15\*60\*1000/);
 assert.match(server,/message:'Manutenção para atualização\. Seu progresso foi salvo\. Reconectando automaticamente…'/);
 assert.match(game,/function restoreDeployRunProgress\(run\)/);
 assert.match(game,/if\(d\.resumedRun&&d\.runResume\)restoreDeployRunProgress\(d\.runResume\)/);
 assert.match(game,/prismaticLevel:upgrades\.spread/);
 assert.match(game,/predatorLevel:upgrades\.predator/);
 assert.match(game,/hadalBeamActive:Boolean\(upgrades\.hadalBeam\)/);
 assert.match(unit,/KillSignal=SIGTERM/);
 assert.match(unit,/TimeoutStopSec=15/);
});
