'use strict';

const crypto = require('crypto');

function kidApiBase() { return String(process.env.KID_SERVER_SECRET || '').startsWith('kgs_live_') ? 'https://game-api.k-id.com/api/v1' : 'https://game-api.test.k-id.com/api/v1'; }

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function authenticatedUser(users, token) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const tokenHash = digest(token), now = Date.now();
  for (const [key, user] of Object.entries(users || {})) {
    const tokens = Array.isArray(user.sessionTokens) ? user.sessionTokens : [];
    if (tokens.some(item => item && Number(item.expiresAt) > now && item.hash === tokenHash)) return { key, user };
  }
  return null;
}

function getSecret() {
  const secret = String(process.env.KID_SERVER_SECRET || '');
  return /^kgs_(?:test|live)_[A-Za-z0-9]+$/.test(secret) ? secret : null;
}

async function kidRequest(method, secret, { query = {}, body } = {}) {
  const url = new URL(kidApiBase() + '/' + method);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: 'Bearer ' + secret,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(12000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('k-ID request failed (' + response.status + ')');
    error.status = response.status;
    error.code = result.error || result.code || null;
    throw error;
  }
  return result;
}

function publicState(kid) {
  if (!kid) return { status: 'not_started', passed: false };
  return {
    status: kid.status || 'not_started',
    passed: kid.status === 'passed',
    prohibited: kid.status === 'prohibited',
    challengeType: kid.challengeType || null,
    challengeUrl: kid.challengeUrl || null,
    oneTimePassword: kid.oneTimePassword || null,
    permissions: Array.isArray(kid.permissions) ? kid.permissions : [],
    ageStatus: kid.ageStatus || null
  };
}

function hasKidPermission(user, permissionName) {
  const kid = user?.kidAgeGate;
  if (kid?.status !== 'passed' || !kid.sessionId) return false;
  const permission = (Array.isArray(kid.permissions) ? kid.permissions : []).find(item => item?.name === permissionName);
  // Missing permissions fail closed: only features explicitly enabled by k-ID are available.
  return permission?.enabled === true && permission?.managedBy !== 'PROHIBITED';
}

function registerKidAgeGateRoutes({ app, getUsers, saveUsers }) {
  const json = require('express').json({ limit: '8kb' });
  const jurisdiction = String(process.env.KID_JURISDICTION || 'BR').trim();

  function getAuth(req) {
    const authorization = String(req.headers.authorization || '');
    return authenticatedUser(getUsers(), authorization.startsWith('Bearer ') ? authorization.slice(7) : '');
  }
  function configured(res) {
    const secret = getSecret();
    if (!secret) res.status(503).set('Cache-Control', 'no-store').json({
      ok: false, code: 'KID_NOT_CONFIGURED',
      message: 'A verificação de idade ainda não está configurada.'
    });
    return secret;
  }
  function fail(res, error, message) {
    console.error('[k-ID]', error.message);
    return res.status(error.status && error.status >= 400 && error.status < 500 ? 422 : 502)
      .set('Cache-Control', 'no-store')
      .json({ ok: false, message });
  }

  app.get('/api/kid/status', (req, res) => {
    const account = getAuth(req);
    if (!account) return res.status(401).set('Cache-Control', 'no-store').json({ ok: false, message: 'Entre na sua conta.' });
    return res.set('Cache-Control', 'no-store').json({ ok: true, ...publicState(account.user.kidAgeGate) });
  });

  app.get('/api/kid/requirements', async (req, res) => {
    if (!getAuth(req)) return res.status(401).set('Cache-Control', 'no-store').json({ ok: false, message: 'Entre na sua conta.' });
    const secret = configured(res); if (!secret) return;
    try {
      const result = await kidRequest('age-gate/get-requirements', secret, { query: { jurisdiction } });
      return res.set('Cache-Control', 'no-store').json({ ok: true, requirements: result });
    } catch (error) { return fail(res, error, 'Não foi possível carregar os requisitos de idade.'); }
  });

  app.post('/api/kid/check', json, async (req, res) => {
    const account = getAuth(req);
    if (!account) return res.status(401).set('Cache-Control', 'no-store').json({ ok: false, message: 'Entre na sua conta.' });
    const dateOfBirth = String(req.body?.dateOfBirth || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(Date.parse(dateOfBirth)) || new Date(dateOfBirth).toISOString().slice(0, 10) !== dateOfBirth || dateOfBirth >= new Date().toISOString().slice(0, 10)) {
      return res.status(400).set('Cache-Control', 'no-store').json({ ok: false, message: 'Informe uma data de nascimento válida.' });
    }
    const secret = configured(res); if (!secret) return;
    try {
      const result = await kidRequest('age-gate/check', secret, { body: { jurisdiction, dateOfBirth } });
      const kid = account.user.kidAgeGate || {};
      kid.checkedAt = new Date().toISOString();
      kid.challengeId = null; kid.challengeUrl = null; kid.oneTimePassword = null;
      kid.challengeType = null; kid.sessionId = null; kid.permissions = [];
      if (result.status === 'PASS' && result.session?.sessionId) {
        kid.status = 'passed'; kid.sessionId = String(result.session.sessionId);
        kid.ageStatus = result.session.ageStatus || null;
        kid.permissions = Array.isArray(result.session.permissions) ? result.session.permissions.map(p => ({
          name: String(p.name || ''), enabled: p.enabled === true, managedBy: p.managedBy || null
        })).filter(p => p.name) : [];
        kid.passedAt = new Date().toISOString();
      } else if (result.status === 'PROHIBITED') {
        kid.status = 'prohibited';
      } else if (result.status === 'CHALLENGE' && result.challenge?.challengeId) {
        kid.status = 'pending';
        kid.challengeId = String(result.challenge.challengeId);
        kid.challengeUrl = typeof result.challenge.url === 'string' ? result.challenge.url : null;
        kid.oneTimePassword = typeof result.challenge.oneTimePassword === 'string' ? result.challenge.oneTimePassword : null;
        kid.challengeType = String(result.challenge.type || '');
      } else {
        return res.status(502).set('Cache-Control', 'no-store').json({ ok: false, message: 'Resposta inesperada do k-ID. Tente novamente.' });
      }
      account.user.kidAgeGate = kid; saveUsers();
      return res.set('Cache-Control', 'no-store').json({ ok: true, ...publicState(kid) });
    } catch (error) { return fail(res, error, 'Não foi possível verificar a idade agora. Tente novamente.'); }
  });

  app.post('/api/kid/challenge-status', json, async (req, res) => {
    const account = getAuth(req);
    if (!account) return res.status(401).set('Cache-Control', 'no-store').json({ ok: false, message: 'Entre na sua conta.' });
    const kid = account.user.kidAgeGate;
    if (!kid?.challengeId || kid.status !== 'pending') return res.set('Cache-Control', 'no-store').json({ ok: true, ...publicState(kid) });
    if (kid.lastChallengeCheckAt && Date.now() - Date.parse(kid.lastChallengeCheckAt) < 5000) {
      return res.status(429).set('Retry-After', '5').set('Cache-Control', 'no-store').json({ ok: false, message: 'Aguarde alguns segundos antes de consultar novamente.' });
    }
    const secret = configured(res); if (!secret) return;
    try {
      const result = await kidRequest('challenge/get-status', secret, { query: { challengeId: kid.challengeId } });
      kid.lastChallengeCheckAt = new Date().toISOString();
      if (result.status === 'PASS' && result.sessionId) {
        const sessionResult = await kidRequest('session/get', secret, { query: { sessionId: result.sessionId } });
        const session = sessionResult.session || sessionResult;
        if (!session.sessionId || session.status !== 'ACTIVE') throw new Error('k-ID session is not active');
        kid.status = 'passed'; kid.sessionId = String(session.sessionId);
        kid.challengeId = null; kid.challengeUrl = null; kid.oneTimePassword = null; kid.challengeType = null;
        kid.ageStatus = session.ageStatus || null;
        kid.permissions = Array.isArray(session.permissions) ? session.permissions.map(p => ({
          name: String(p.name || ''), enabled: p.enabled === true, managedBy: p.managedBy || null
        })).filter(p => p.name) : [];
        kid.passedAt = new Date().toISOString();
      } else if (result.status === 'FAIL' || result.status === 'PROHIBITED') {
        kid.status = 'prohibited'; kid.challengeId = null; kid.challengeUrl = null; kid.oneTimePassword = null;
      }
      account.user.kidAgeGate = kid; saveUsers();
      return res.set('Cache-Control', 'no-store').json({ ok: true, ...publicState(kid) });
    } catch (error) { return fail(res, error, 'Não foi possível consultar a autorização agora.'); }
  });

  app.post('/api/kid/challenge-email', json, async (req, res) => {
    const account = getAuth(req);
    if (!account) return res.status(401).set('Cache-Control', 'no-store').json({ ok: false, message: 'Entre na sua conta.' });
    const kid = account.user.kidAgeGate;
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!kid?.challengeId || kid.status !== 'pending' || kid.challengeType !== 'CHALLENGE_PARENTAL_CONSENT') {
      return res.status(409).set('Cache-Control', 'no-store').json({ ok: false, message: 'Não existe uma solicitação de autorização parental pendente.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ ok: false, message: 'Informe um email válido do responsável.' });
    const secret = configured(res); if (!secret) return;
    try {
      await kidRequest('challenge/send-email', secret, { body: { challengeId: kid.challengeId, email } });
      return res.set('Cache-Control', 'no-store').json({ ok: true });
    } catch (error) { return fail(res, error, 'Não foi possível enviar o convite ao responsável.'); }
  });

  app.get('/api/kid/session', async (req, res) => {
    const account = getAuth(req);
    if (!account) return res.status(401).set('Cache-Control', 'no-store').json({ ok: false, message: 'Entre na sua conta.' });
    const kid = account.user.kidAgeGate;
    if (kid?.status !== 'passed' || !kid.sessionId) return res.status(403).set('Cache-Control', 'no-store').json({ ok: false, status: kid?.status || 'not_started' });
    const secret = configured(res); if (!secret) return;
    try {
      const result = await kidRequest('session/get', secret, { query: { sessionId: kid.sessionId } });
      const session = result.session || result;
      if (session.status !== 'ACTIVE' || String(session.sessionId || '') !== kid.sessionId) {
        kid.status = 'revoked'; kid.sessionId = null; kid.permissions = [];
      } else {
        kid.ageStatus = session.ageStatus || null;
        kid.permissions = Array.isArray(session.permissions) ? session.permissions.map(p => ({
          name: String(p.name || ''), enabled: p.enabled === true, managedBy: p.managedBy || null
        })).filter(p => p.name) : [];
      }
      account.user.kidAgeGate = kid; saveUsers();
      if (kid.status !== 'passed') return res.status(403).set('Cache-Control', 'no-store').json({ ok: false, ...publicState(kid) });
      return res.set('Cache-Control', 'no-store').json({ ok: true, ...publicState(kid) });
    } catch (error) { return fail(res, error, 'Não foi possível atualizar as permissões agora.'); }
  });
}

async function deleteKidSessionForUser(user) {
  const sessionId = user?.kidAgeGate?.sessionId;
  if (!sessionId) return;
  const secret = getSecret();
  if (!secret) throw new Error('k-ID não configurado; não foi possível revogar a sessão.');
  try {
    await kidRequest('session/delete', secret, { body: { sessionId } });
  } catch (error) {
    if (!(error.status === 400 && error.code === 'NOT_FOUND')) throw error;
  }
  user.kidAgeGate = { status: 'revoked', passed: false, permissions: [] };
}

module.exports = { registerKidAgeGateRoutes, getSecret, deleteKidSessionForUser, hasKidPermission };
