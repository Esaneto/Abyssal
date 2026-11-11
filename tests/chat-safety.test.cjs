'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {screenChatMessage,normalizeForScreening,obfuscationView}=require('../chat-safety');

test('chat screening rejects links, email addresses, telephone numbers and contact solicitation',()=>{
 for(const text of ['Veja https://example.com','meu email: player@example.com','me liga +55 (11) 99999-9999','me chama no WhatsApp','meu endereço fica na rua X']){
  const result=screenChatMessage(text);
  assert.equal(result.ok,false,text);
 }
});
test('chat screening bounds, normalizes and rejects repetitive spam',()=>{
 assert.equal(screenChatMessage('  olá\nmergulhador  ').text,'olá mergulhador');
 assert.equal(screenChatMessage('x'.repeat(12)).reason,'repeated_characters');
 assert.equal(screenChatMessage(('abcdefg').repeat(30)).text.length,180);
 assert.equal(screenChatMessage('   ').reason,'empty');
 assert.equal(normalizeForScreening('a'+String.fromCharCode(0x200B)+'b'), 'ab');
});
test('chat screening rejects common Portuguese and English profanity, threats and grooming patterns',()=>{
 for(const [text,reason] of [
  ['isso é uma merda','profanity'],['you are a bitch','profanity'],
  ['vou te matar','threat'],['i will kill you','threat'],
  ['não conta pros seus pais','grooming_or_off_platform_contact'],
  ['manda uma foto sua','grooming_or_off_platform_contact']
 ]) assert.equal(screenChatMessage(text).reason,reason,text);
});
test('obfuscation normalization catches common leetspeak substitutions',()=>{
 assert.equal(screenChatMessage('f0da-se').reason,'profanity');
 assert.equal(obfuscationView('v0u te m@t@r').includes('vou te matar'),true);
});
