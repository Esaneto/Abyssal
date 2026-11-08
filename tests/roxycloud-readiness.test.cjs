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
 assert.match(deploy,/EXPECTED_PROFILE="roxycloud-ryzen4"/);
 assert.match(deploy,/resources\?\.profile/);
 assert.match(deploy,/rollback/);
 assert.match(deploy,/node --test tests\/roxycloud-readiness\.test\.cjs tests\/specimen-journal-biology\.test\.cjs/);
});

test('RoxyCloud kernel profile limits swap pressure and preserves connection backlog',()=>{
 const sysctl=read('deploy/roxycloud/99-abyssal.conf');
 assert.match(sysctl,/net\.core\.somaxconn = 4096/);
 assert.match(sysctl,/net\.ipv4\.tcp_max_syn_backlog = 8192/);
 assert.match(sysctl,/vm\.swappiness = 10/);
});
