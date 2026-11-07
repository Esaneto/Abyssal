'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { parentPort } = require('node:worker_threads');

if (!parentPort) throw new Error('state-persistence-worker must run inside a Worker thread');

let queue = Promise.resolve();

async function atomicWrite(filePath, serialized, mode) {
  if (!filePath) return;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, serialized, { encoding: 'utf8', mode });
  await fs.rename(temporaryPath, filePath);
}

async function handleJob(job) {
  const id = Number(job?.id);
  const key = String(job?.key || '');
  try {
    const serialized = JSON.stringify(job?.value ?? null, null, job?.pretty ? 2 : 0);
    await atomicWrite(job?.filePath, serialized, Number(job?.mode) || 0o600);
    parentPort.postMessage({
      id,
      key,
      ok: true,
      serialized,
      bytes: Buffer.byteLength(serialized, 'utf8')
    });
  } catch (error) {
    parentPort.postMessage({
      id,
      key,
      ok: false,
      error: String(error?.message || error || 'unknown persistence worker error')
    });
  }
}

parentPort.on('message', job => {
  queue = queue.then(() => handleJob(job), () => handleJob(job));
});
