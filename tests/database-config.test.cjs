'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeDatabasePoolConfig}=require('../database-config');

test('legacy pg8 sslmode=require is made explicitly verify-full',()=>{
 const cfg=normalizeDatabasePoolConfig('postgres://user:pass@db.example.com:5432/app?sslmode=require','auto');
 assert.match(cfg.connectionString,/sslmode=verify-full/);
 assert.equal(Object.prototype.hasOwnProperty.call(cfg,'ssl'),false);
});

test('prefer and verify-ca preserve current pg8 verification semantics explicitly',()=>{
 for(const mode of ['prefer','verify-ca']){
  const cfg=normalizeDatabasePoolConfig('postgres://u:p@db.example.com/app?sslmode='+mode,'auto');
  assert.match(cfg.connectionString,/sslmode=verify-full/);
 }
});

test('explicit libpq compatibility is preserved untouched',()=>{
 const cfg=normalizeDatabasePoolConfig('postgres://u:p@db.example.com/app?uselibpqcompat=true&sslmode=require','auto');
 assert.match(cfg.connectionString,/uselibpqcompat=true/);
 assert.match(cfg.connectionString,/sslmode=require/);
 assert.doesNotMatch(cfg.connectionString,/sslmode=verify-full/);
});

test('DATABASE_SSL=disable cannot be overridden by SSL query parameters',()=>{
 const cfg=normalizeDatabasePoolConfig('postgres://u:p@db.example.com/app?sslmode=require&ssl=true','disable');
 assert.equal(cfg.ssl,false);
 assert.doesNotMatch(cfg.connectionString,/sslmode|ssl=true|uselibpqcompat/);
});

test('connection strings without SSL query options keep the existing explicit TLS fallback',()=>{
 const cfg=normalizeDatabasePoolConfig('postgres://u:p@db.example.com/app','auto');
 assert.deepEqual(cfg.ssl,{rejectUnauthorized:false});
});

test('malformed strings retain old fallback behavior instead of crashing startup',()=>{
 const cfg=normalizeDatabasePoolConfig('not-a-postgres-url','auto');
 assert.equal(cfg.connectionString,'not-a-postgres-url');
 assert.deepEqual(cfg.ssl,{rejectUnauthorized:false});
});
