'use strict';

// Server-side safety screening for every public chat message.
// This deterministic first layer is not a substitute for human moderation.
const CONTACT_PATTERNS = [
  /\bhttps?:\/\//i, /\bwww\./i,
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,
  /(?:\+?\d[\d .()\-]{7,}\d)/,
  /\b(?:me chama|me chame|manda mensagem|passa seu|me passa|add me|message me|text me|send me your)\b.{0,45}\b(?:whats?app|telegram|discord|instagram|snapchat|telefone|phone|number|n[uú]mero)\b/i,
  /\b(?:whats?app|telegram|discord|instagram|snapchat)\s*[:@#]?\s*[a-z\d_.-]{4,}/i,
  /\b(?:meu endereço|minha rua|meu cpf|meu rg|my address|my phone|my number)\b/i
];
const PROFANITY_PATTERNS = [
  /\b(?:puta|puto|pqp|fdp|foda\s*se|vai se foder|merda|buceta|caralho|cuzao|cuzão)\b/i,
  /\b(?:fuck|fucking|motherfucker|bitch|cunt|asshole|shit)\b/i
];
const THREAT_PATTERNS = [
  /\b(?:vou te matar|vou te encontrar|vou te machucar|te matar|i will kill you|i'm going to kill you|i will hurt you)\b/i
];
const GROOMING_PATTERNS = [
  /\b(?:não conta pros seus pais|nao conta pros seus pais|segredo entre nós|manda foto|manda uma foto sua|send me a pic|don't tell your parents|dont tell your parents)\b/i,
  /\b(?:encontro|meet me)\b.{0,35}\b(?:sozinho|sozinha|secretamente|alone|secretly)\b/i
];
function normalizeForScreening(value) {
  return String(value || '').normalize('NFKC')
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function obfuscationView(value) {
  return normalizeForScreening(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[4@]/g, 'a').replace(/[3]/g, 'e').replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o').replace(/[5$]/g, 's').replace(/[7]/g, 't')
    .replace(/[^a-z0-9]+/gi, ' ').toLowerCase();
}
function screenChatMessage(input, limit = 180) {
  const text = normalizeForScreening(input).slice(0, limit);
  if (!text) return { ok: false, reason: 'empty', text: '' };
  if (/(.)\1{11,}/u.test(text)) return { ok: false, reason: 'repeated_characters', text: '' };
  if (CONTACT_PATTERNS.some(pattern => pattern.test(text))) return { ok: false, reason: 'contact_or_link', text: '' };
  const normalized = obfuscationView(text);
  if (PROFANITY_PATTERNS.some(pattern => pattern.test(normalized))) return { ok: false, reason: 'profanity', text: '' };
  if (THREAT_PATTERNS.some(pattern => pattern.test(normalized))) return { ok: false, reason: 'threat', text: '' };
  if (GROOMING_PATTERNS.some(pattern => pattern.test(normalized))) return { ok: false, reason: 'grooming_or_off_platform_contact', text: '' };
  return { ok: true, reason: null, text };
}
module.exports = { screenChatMessage, normalizeForScreening, obfuscationView };
