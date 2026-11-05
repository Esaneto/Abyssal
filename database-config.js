'use strict';

const SSL_QUERY_KEYS=Object.freeze(['ssl','sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat']);

function normalizeDatabasePoolConfig(connectionString,databaseSsl='auto'){
 const raw=String(connectionString||'').trim();
 const mode=String(databaseSsl||'auto').trim().toLowerCase();
 if(!raw)return {connectionString:raw,ssl:mode==='disable'?false:{rejectUnauthorized:false}};

 let url;
 try{url=new URL(raw);}
 catch{
  return {connectionString:raw,ssl:mode==='disable'?false:{rejectUnauthorized:false}};
 }

 if(mode==='disable'){
  for(const key of SSL_QUERY_KEYS)url.searchParams.delete(key);
  return {connectionString:url.toString(),ssl:false};
 }

 const compat=String(url.searchParams.get('uselibpqcompat')||'').toLowerCase()==='true';
 const sslMode=String(url.searchParams.get('sslmode')||'').toLowerCase();

 // pg 8 currently treats prefer/require/verify-ca as verify-full unless
 // uselibpqcompat=true. Make that current behavior explicit so pg 9 cannot
 // silently weaken certificate verification and the deprecation warning stops.
 if(!compat&&['prefer','require','verify-ca'].includes(sslMode)){
  url.searchParams.set('sslmode','verify-full');
 }

 const hasSslQuery=SSL_QUERY_KEYS.some(key=>url.searchParams.has(key));
 return hasSslQuery
  ? {connectionString:url.toString()}
  : {connectionString:url.toString(),ssl:{rejectUnauthorized:false}};
}

module.exports={normalizeDatabasePoolConfig};
