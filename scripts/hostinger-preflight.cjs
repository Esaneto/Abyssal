'use strict';

const os = require('node:os');
const fs = require('node:fs');

const GiB = 1024 ** 3;
const cpuCount = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
const totalRamGiB = os.totalmem() / GiB;
const nodeMajor = Number(process.versions.node.split('.')[0]) || 0;
const threadpool = Number(process.env.UV_THREADPOOL_SIZE || 4);
let freeDiskGiB = null;

try {
  if (typeof fs.statfsSync === 'function') {
    const stat = fs.statfsSync(process.cwd());
    freeDiskGiB = Number(stat.bavail) * Number(stat.bsize) / GiB;
  }
} catch {}

const checks = [
  ['vCPU', cpuCount >= 2, `${cpuCount} disponível(is), esperado >= 2`],
  ['RAM', totalRamGiB >= 7.25, `${totalRamGiB.toFixed(2)} GiB, esperado ~8 GiB`],
  ['Node LTS', nodeMajor >= 24 && nodeMajor <= 26, `Node ${process.versions.node}, recomendado 24 ou 26 LTS`],
  ['libuv threadpool', threadpool >= 8, `UV_THREADPOOL_SIZE=${threadpool}, recomendado 8`],
  ['resource profile', process.env.ABYSSAL_RESOURCE_PROFILE === 'hostinger-kvm2', `ABYSSAL_RESOURCE_PROFILE=${process.env.ABYSSAL_RESOURCE_PROFILE || '(não definido)'}`]
];

if (freeDiskGiB !== null) checks.push(['disco livre', freeDiskGiB >= 20, `${freeDiskGiB.toFixed(1)} GiB livres`]);

console.log('Abyssal Hostinger KVM 2 preflight');
for (const [name, ok, detail] of checks) console.log(`${ok ? 'OK ' : 'WARN'} ${name}: ${detail}`);

const hardFailures = checks.filter(([name, ok]) => !ok && (name === 'vCPU' || name === 'RAM'));
if (hardFailures.length) {
  console.error('A VPS não corresponde ao perfil KVM 2 esperado.');
  process.exitCode = 1;
}
