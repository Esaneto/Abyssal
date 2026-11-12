'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createHmac } = require('node:crypto');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const net = require('node:net');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');

test('production HTTP pipeline preserves signed Stripe webhook bytes and pauses only new checkout', {timeout: 35000}, async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'abyssal-migration-'));
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const secret = 'whsec_localintegrationtest';
  const child = spawn(process.execPath, [resolve(__dirname, '../server.js')], {
    cwd: resolve(__dirname, '..'),
    env: {...process.env, NODE_ENV: 'test', PORT: String(port), DATA_DIR: dataDir, DATABASE_URL: '',
      STRIPE_SECRET_KEY: 'sk_test_localintegrationtest', STRIPE_WEBHOOK_SECRET: secret,
      STRIPE_CHECKOUT_ENABLED: 'false', PUBLIC_BASE_URL: 'https://abyssalgame.duckdns.org'},
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk.toString(); });
  child.stderr.on('data', chunk => { logs += chunk.toString(); });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
      timer.unref();
      try { await exited; } finally { clearTimeout(timer); }
    }
    await rm(dataDir, {recursive:true, force:true});
  });
  const origin = 'http://127.0.0.1:' + port;
  let ready = false;
  for (let i=0; i<100; i++) {
    if (child.exitCode !== null || child.signalCode !== null) break;
    try {
      const response = await fetch(origin + '/health', {signal:AbortSignal.timeout(1000)});
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(150);
  }
  assert.ok(ready, logs);
  const catalog = await fetch(origin+'/api/payments/catalog').then(r=>r.json());
  assert.equal(catalog.liveEnabled, false);
  const checkout = await fetch(origin+'/api/payments/checkout', {method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(checkout.status, 503);
  const raw = '{ "id": "evt_migration_test", "type": "checkout.session.expired", "livemode": false, "data": {"object":{"metadata":{"order_id":"not-a-real-order"}}} }';
  const timestamp = Math.floor(Date.now()/1000);
  const signature = 't='+timestamp+',v1='+createHmac('sha256',secret).update(String(timestamp)+'.').update(raw).digest('hex');
  const post = (body, sig) => fetch(origin+'/api/payments/webhook', {
    method:'POST', headers:{'content-type':'application/json','stripe-signature':sig}, body
  });
  assert.equal((await post(raw,'t='+timestamp+',v1='+'0'.repeat(64))).status,400);
  const accepted = await post(raw,signature);
  assert.equal(accepted.status,200,logs);
  assert.equal((await accepted.json()).received,true);
  const duplicate = await post(raw,signature);
  assert.equal(duplicate.status,200);
  assert.equal((await duplicate.json()).duplicate,true);
  assert.equal((await post(raw+' ',signature)).status,400);
});
