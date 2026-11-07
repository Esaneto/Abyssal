'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const server=read('server.js');

test('Hostinger profile keeps crypto and persistence off the 20 Hz event loop',()=>{
 assert.doesNotMatch(server,/scryptSync/);
 assert.match(server,/crypto\.scrypt\(/);
 assert.match(server,/await hashPassword\(/);
 assert.doesNotMatch(server,/writeFileSync\(USERS_FILE/);
 assert.doesNotMatch(server,/writeFileSync\(CARDUMES_FILE/);
 assert.doesNotMatch(server,/writeFileSync\(RANKS_FILE/);
 assert.match(server,/new Worker\(path\.join\(__dirname, 'state-persistence-worker\.js'\)\)/);
 assert.match(server,/ABYSSAL_ASYNC_PERSISTENCE/);
});

test('health exposes the KVM resource signals needed for capacity decisions',()=>{
 assert.match(server,/resources:resourceHealthPayload\(\)/);
 assert.match(server,/processPercent/);
 assert.match(server,/hostCapacityPercent/);
 assert.match(server,/rssMB/);
 assert.match(server,/eventLoopUtilization/);
 assert.match(server,/libuvThreadpoolSize/);
 assert.match(server,/httpBacklog/);
});

test('Socket.IO avoids websocket compression overhead and raises the listen backlog',()=>{
 assert.match(server,/perMessageDeflate: false/);
 assert.match(server,/httpCompression: \{ threshold: 2048 \}/);
 assert.match(server,/backlog:HTTP_BACKLOG/);
});

test('Hostinger service reserves the game loop while parallel native work can use the second vCPU',()=>{
 const unit=read('deploy/hostinger/abyssal.service');
 assert.match(unit,/UV_THREADPOOL_SIZE=8/);
 assert.match(unit,/NODE_OPTIONS=--max-old-space-size=2048/);
 assert.match(unit,/LimitNOFILE=65535/);
 assert.match(unit,/ABYSSAL_RESOURCE_PROFILE=hostinger-kvm2/);
 assert.doesNotMatch(unit,/cluster/i);
});

test('Nginx is configured for two-core event handling and long-lived websocket proxying',()=>{
 const main=read('deploy/hostinger/nginx-main.conf');
 const site=read('deploy/hostinger/nginx-abyssal.conf');
 assert.match(main,/worker_processes auto/);
 assert.match(main,/worker_connections 4096/);
 assert.match(main,/use epoll/);
 assert.match(site,/location \/socket\.io\//);
 assert.match(site,/proxy_buffering off/);
 assert.match(site,/proxy_read_timeout 1d/);
});

test('Hostinger deployment has preflight, kernel profile and rollback-aware deploy script',()=>{
 const preflight=read('scripts/hostinger-preflight.cjs');
 const sysctl=read('deploy/hostinger/99-abyssal.conf');
 const deploy=read('deploy/hostinger/deploy.sh');
 assert.match(preflight,/cpuCount >= 2/);
 assert.match(preflight,/totalRamGiB >= 7\.25/);
 assert.match(sysctl,/net\.core\.somaxconn = 4096/);
 assert.match(deploy,/rollback/);
 assert.match(deploy,/npm test/);
 assert.match(deploy,/HEALTH_URL/);
});
