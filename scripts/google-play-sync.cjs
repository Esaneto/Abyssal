#!/usr/bin/env node
'use strict';
// Sync the Abyssal catalog to Google Play WITHOUT printing service-account secrets.
// Usage:
//   node scripts/google-play-sync.cjs                 # validate local catalog
//   node scripts/google-play-sync.cjs --status        # read-only Google Play inventory
//   node scripts/google-play-sync.cjs --apply         # create missing SKUs and activate their buy option
// NEVER run this script in CI with a key copied into GitHub.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const PRODUCTS = require('../docs/google-play/products.json');
const PACKAGE = 'com.esaneto.abyssal';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' + PACKAGE;
const OPTION = 'buy';
const KEY_PATH = '/etc/abyssal/credentials/google-play.json';
const args = process.argv.slice(2);
if (args.some(arg => !['--status','--apply'].includes(arg)) || args.includes('--status') && args.includes('--apply')) {
  console.error('Uso: node scripts/google-play-sync.cjs [--status|--apply]');
  process.exit(2);
}
const mode = args.includes('--apply') ? 'apply' : args.includes('--status') ? 'status' : 'validate';
function validateCatalog() {
  if (PRODUCTS.packageName !== PACKAGE || PRODUCTS.currency !== 'BRL') throw Error('Pacote ou moeda divergente');
  const ids = new Set();
  for (const p of PRODUCTS.products) {
    if (!/^[a-z0-9][a-z0-9._]*$/.test(p.productId) || ids.has(p.productId)) throw Error('ID de produto invalido ou duplicado: ' + p.productId);
    if (p.type !== 'non_consumable' || !Number.isSafeInteger(p.priceMinorBRL) || p.priceMinorBRL < 99) throw Error('Preco/tipo invalido: ' + p.productId);
    if (!p.title || p.title.length > 55) throw Error('Titulo invalido: ' + p.productId);
    ids.add(p.productId);
  }
  console.log('Catalogo local: ' + ids.size + ' produtos validos. Modo: ' + mode);
}
const b64 = data => Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)).toString('base64url');
async function token() {
  const credentials = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  if (credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key) throw Error('Credencial incompleta');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({alg:'RS256',typ:'JWT'}) + '.' + b64({
    iss:credentials.client_email,scope:'https://www.googleapis.com/auth/androidpublisher',
    aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600
  });
  const signature = crypto.sign('RSA-SHA256',Buffer.from(unsigned),credentials.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature}),
    signal:AbortSignal.timeout(20000)
  });
  if (!res.ok) throw Error('OAuth nao autorizado (HTTP '+res.status+'). Verifique a conta de servico.');
  const json = await res.json();
  if (!json.access_token) throw Error('Google nao retornou token.');
  return json.access_token;
}
async function call(access,method,url,body) {
  const res = await fetch(url,{
    method,headers:{Authorization:'Bearer '+access,...(body ? {'Content-Type':'application/json'} : {})},
    ...(body ? {body:JSON.stringify(body)} : {}),
    signal:AbortSignal.timeout(30000)
  });
  if (!res.ok) {
    let reason = 'sem detalhe';
    try { const error = await res.json(); reason = String(error.error?.message || error.message || reason).slice(0,360); } catch {}
    throw Error('Google Play HTTP '+res.status+': '+reason);
  }
  return res.json();
}
async function listing(access) {
  const all = [];
  let pageToken;
  do {
    const u = API + '/oneTimeProducts?pageSize=100' + (pageToken ? '&pageToken='+encodeURIComponent(pageToken) : '');
    const r = await call(access,'GET',u);
    all.push(...(r.oneTimeProducts || []));
    pageToken = r.nextPageToken;
  } while (pageToken);
  return all;
}
function productBody(p) {
  return {
    packageName:PACKAGE,productId:p.productId,
    listings:[{languageCode:'pt-BR',title:p.title,description:'Item digital permanente do jogo Abyssal: '+p.title+'.'}],
    purchaseOptions:[{
      purchaseOptionId:OPTION,buyOption:{legacyCompatible:true,multiQuantityEnabled:false},
      regionalPricingAndAvailabilityConfigs:[{
        regionCode:'BR',
        price:{
          currencyCode:'BRL',
          units:String(Math.floor(p.priceMinorBRL/100)),
          nanos:(p.priceMinorBRL%100)*10000000
        },
        availability:'AVAILABLE'
      }]
    }]
  };
}
async function main() {
  validateCatalog();
  if (mode === 'validate') {
    for (const p of PRODUCTS.products.slice(0,5)) console.log('Exemplo: '+p.productId+' R$ '+(p.priceMinorBRL/100).toFixed(2));
    console.log('Nenhuma chamada ao Google realizada. Use --status para consultar.');
    return;
  }
  if (!fs.existsSync(KEY_PATH)) throw Error('Chave nao encontrada no caminho protegido '+KEY_PATH);
  const access=await token();
  console.log('OAuth Google: autenticado (token oculto).');
  const existing=await listing(access);
  const byId=new Map(existing.map(p=>[p.productId,p]));
  const missing=PRODUCTS.products.filter(p=>!byId.has(p.productId));
  console.log('Google Play: '+existing.length+' produtos existentes; '+missing.length+' produtos do catalogo faltando.');
  if (mode==='status') {
    console.log('Nao modificamos nenhum produto. Itens ausentes:');
    for (const p of missing) console.log('  '+p.productId+' R$ '+(p.priceMinorBRL/100).toFixed(2));
    return;
  }
  if (!missing.length) {
    console.log('Nenhum SKU novo necessario. Produtos existentes nao serao alterados.');
    return;
  }
  // Obtain Google’s current region version without guessing it.
  const conversion=await call(access,'POST',API+'/pricing:convertRegionPrices',{
    price:{currencyCode:'BRL',units:'1',nanos:990000000}
  });
  if (!conversion.regionVersion?.version) throw Error('Google nao retornou versao das regioes.');
  const body={requests:missing.map(p=>({
    oneTimeProduct:productBody(p),updateMask:'listings,purchaseOptions',
    regionsVersion:conversion.regionVersion,allowMissing:true,
    latencyTolerance:'PRODUCT_UPDATE_LATENCY_TOLERANCE_LATENCY_TOLERANT'
  }))};
  console.log('Criando '+missing.length+' produtos em rascunho...');
  const created=await call(access,'POST',API+'/oneTimeProducts:batchUpdate',body);
  const ids=new Set((created.oneTimeProducts||[]).map(p=>p.productId));
  if (ids.size!==missing.length || missing.some(p=>!ids.has(p.productId))) {
    throw Error('Resposta incompleta do Google; consulte --status antes de repetir.');
  }
  console.log('Criados '+ids.size+' produtos. Ativando apenas as novas opcoes de compra...');
  await call(access,'POST',API+'/oneTimeProducts/-/purchaseOptions:batchUpdateStates',{
    requests:missing.map(p=>({activatePurchaseOptionRequest:{
      packageName:PACKAGE,productId:p.productId,purchaseOptionId:OPTION,
      latencyTolerance:'PRODUCT_UPDATE_LATENCY_TOLERANCE_LATENCY_TOLERANT'
    }}))
  });
  console.log('SINCRONIZACAO_CONCLUIDA: '+ids.size+' produtos criados com opcao de compra ativada.');
  console.log('A propagacao pode levar ate 24 horas. Teste uma compra por instalacao da Play Store.');
}
main().catch(error=>{console.error('FALHA: '+error.message);process.exitCode=1;});
