'use strict';

const crypto = require('crypto');
const { verifyStripeSignature, TERMS_VERSION } = require('./payments');

function deriveAgeStatus(dob, now = new Date()) {
  if (!dob || !Number.isInteger(Number(dob.year)) || !Number.isInteger(Number(dob.month)) || !Number.isInteger(Number(dob.day))) return null;
  const year = Number(dob.year), month = Number(dob.month), day = Number(dob.day);
  const born = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > now.getUTCFullYear() || born.getUTCFullYear() !== year || born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day || born > now) return null;
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() < month - 1 || (now.getUTCMonth() === month - 1 && now.getUTCDate() < day)) age--;
  return age >= 18 ? 'adult' : 'minor';
}

function deriveStripeAgeOutcome(session) {
  if (!session || session.type !== 'document') return null;
  if (session.status === 'verified') return 'adult';
  if (session.status === 'requires_input' && session.last_error?.code === 'under_supported_age') return 'minor';
  return null;
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function authenticatedUser(users, token) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const tokenHash = digest(token), now = Date.now();
  for (const [key, user] of Object.entries(users || {})) {
    const sessions = Array.isArray(user.sessionTokens) ? user.sessionTokens : [];
    if (sessions.some(item => item && Number(item.expiresAt) > now && item.hash === tokenHash)) return { key, user };
  }
  return null;
}

function stripeTestKey(value) {
  return /^sk_test_[A-Za-z0-9]+$/.test(String(value || ''));
}

async function ensureAgeSchema(pool) {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS abyssal_identity_sessions (" +
    "session_id TEXT PRIMARY KEY, user_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending'," +
    "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" +
    "CREATE INDEX IF NOT EXISTS abyssal_identity_sessions_user_status_idx ON abyssal_identity_sessions(user_key,status,created_at);" +
    "CREATE TABLE IF NOT EXISTS abyssal_identity_events (" +
    "event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"
  );
}

function registerAgeAssuranceRoutes({ app, getUsers, getPool, saveUsers }) {
  const express = require('express');
  const json = express.json({ limit: '8kb' });
  const raw = express.raw({ type: 'application/json', limit: '1mb' });

  async function stripeRequest(path, secret, options = {}) {
    const response = await fetch('https://api.stripe.com' + path, {
      ...options,
      headers: { Authorization: 'Bearer ' + secret, ...options.headers }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error('Stripe Identity request failed (' + response.status + ')');
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function getAuth(req) {
    const authorization = String(req.headers.authorization || '');
    return authenticatedUser(getUsers(), authorization.startsWith('Bearer ') ? authorization.slice(7) : '');
  }

  app.get('/api/age-assurance/status', async (req, res) => {
    const account = getAuth(req);
    if (!account) return res.status(401).set('Cache-Control', 'no-store').json({ ok: false, message: 'Entre na sua conta para consultar a verificação.' });
    try {
      const pool = getPool();
      if (pool) {
        await ensureAgeSchema(pool);
        const latest = await pool.query(
          'SELECT session_id,status FROM abyssal_identity_sessions WHERE user_key=$1 ORDER BY created_at DESC LIMIT 1',
          [account.key]
        );
        const row = latest.rows[0] || null;
        const saved = account.user.ageAssurance || null;
        if (row && row.session_id && !['verified','underage'].includes(saved?.status)) {
          const secret = String(process.env.STRIPE_SECRET_KEY || '');
          if (stripeTestKey(secret)) {
            const remote = await stripeRequest('/v1/identity/verification_sessions/' + encodeURIComponent(row.session_id), secret);
            if (remote.id === row.session_id && remote.livemode === false) {
              let status = remote.status || row.status;
              const ageOutcome = deriveStripeAgeOutcome(remote);
              if (ageOutcome) {
                status = ageOutcome === 'adult' ? 'verified' : 'underage';
                account.user.ageAssurance = {provider:'stripe_identity',status,ageBand:ageOutcome==='adult'?'18_plus':'under_18',verifiedAt:new Date().toISOString(),mode:'test'};
                saveUsers();
              }
              if (['verified','underage','needs_review','requires_input','processing','canceled'].includes(status)) {
                await pool.query('UPDATE abyssal_identity_sessions SET status=$2,updated_at=NOW() WHERE session_id=$1',[row.session_id,status]);
              }
            }
          }
        }
        const current = account.user.ageAssurance || saved;
        const dbStatus = row?.status === 'verified' ? 'needs_review' : row?.status;
        return res.set('Cache-Control', 'no-store').json({
          ok: true,
          status: current?.status || dbStatus || 'not_started',
          ageBand: current?.ageBand || null,
          provider: current?.provider || null,
          verifiedAt: current?.verifiedAt || null,
          mode: current?.mode || null
        });
      }
    } catch (error) {
      console.error('[age-assurance] Status lookup failed:', error.message);
      return res.status(503).set('Cache-Control', 'no-store').json({ ok: false, message: 'Não foi possível consultar a verificação agora.' });
    }
    const age = account.user.ageAssurance || null;
    return res.set('Cache-Control', 'no-store').json({
      ok: true, status: age?.status || 'not_started', ageBand: age?.ageBand || null,
      provider: age?.provider || null, verifiedAt: age?.verifiedAt || null, mode: age?.mode || null
    });
  });

  app.post('/api/age-assurance/session', json, async (req, res) => {
    try {
      const account = getAuth(req);
      if (!account) return res.status(401).set('Cache-Control', 'no-store').json({ ok: false, message: 'Entre na sua conta para verificar a idade.' });
      if (req.body?.consent !== true || req.body?.termsVersion !== TERMS_VERSION) {
        return res.status(428).set('Cache-Control', 'no-store').json({ ok: false, message: 'Leia e aceite a informação de privacidade atual antes de continuar.' });
      }
      if (account.user.termsAcceptedVersion !== TERMS_VERSION || account.user.privacyAcceptedVersion !== TERMS_VERSION) {
        return res.status(428).set('Cache-Control', 'no-store').json({ ok: false, message: 'Aceite os documentos atuais antes de continuar.' });
      }
      if (process.env.STRIPE_IDENTITY_TEST_ENABLED !== 'true') {
        return res.status(423).set('Cache-Control', 'no-store').json({ ok: false, message: 'A verificação ainda não está habilitada no ambiente de teste.' });
      }
      const secret = String(process.env.STRIPE_SECRET_KEY || '');
      if (!stripeTestKey(secret)) return res.status(503).set('Cache-Control', 'no-store').json({ ok: false, message: 'Configure uma chave Stripe de teste para Identity.' });
      const pool = getPool();
      if (!pool) return res.status(503).set('Cache-Control', 'no-store').json({ ok: false, message: 'PostgreSQL é necessário para manter a verificação com segurança.' });
      await ensureAgeSchema(pool);

      const attempts = await pool.query(
        "SELECT COUNT(*)::int AS total FROM abyssal_identity_sessions WHERE user_key=$1 AND created_at > NOW()-INTERVAL '24 hours'",
        [account.key]
      );
      if (Number(attempts.rows[0]?.total || 0) >= 5) {
        return res.status(429).set('Cache-Control', 'no-store').json({ ok: false, message: 'Limite diário de tentativas atingido. Tente novamente amanhã.' });
      }

      account.user.ageAssuranceConsent = { version: TERMS_VERSION, purpose: 'age_assurance', acceptedAt: new Date().toISOString() };
      saveUsers();

      const base = String(process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
      let baseUrl;
      try { baseUrl = new URL(base); } catch {
        return res.status(503).json({ ok: false, message: 'PUBLIC_BASE_URL precisa ser configurada para o retorno seguro.' });
      }
      if (baseUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(baseUrl.hostname)) {
        return res.status(503).json({ ok: false, message: 'A verificação exige HTTPS.' });
      }

      // Sempre criamos uma sessão nova: nunca devolvemos uma URL antiga, expirada ou já concluída.
      const form = new URLSearchParams();
      form.set('type', 'document');
      form.set('return_url', new URL('/?ageVerification=returned', baseUrl).toString());
      form.set('client_reference_id', digest(account.key).slice(0, 32));
      form.set('metadata[account_ref]', digest(account.key).slice(0, 32));
      form.set('metadata[purpose]', 'abyssal_age_assurance');
      const session = await stripeRequest('/v1/identity/verification_sessions', secret, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': 'abyssal-age-' + crypto.randomUUID()
        },
        body: form
      });
      if (!session.id || !session.url) throw new Error('Stripe Identity did not return a hosted verification link.');

      // Grava o vínculo antes de entregar a URL ao navegador; o webhook sempre encontrará a conta.
      await pool.query(
        "INSERT INTO abyssal_identity_sessions(session_id,user_key,status) VALUES($1,$2,$3)",
        [session.id, account.key, String(session.status || 'requires_input')]
      );
      res.set('Cache-Control', 'no-store').json({ ok: true, url: session.url, sessionId: session.id, status: session.status || 'requires_input' });
    } catch (error) {
      console.error('[age-assurance] Session creation failed:', error.message);
      res.status(502).set('Cache-Control', 'no-store').json({ ok: false, message: 'Não foi possível iniciar uma nova verificação. Tente novamente mais tarde.' });
    }
  });

  app.post('/api/age-assurance/webhook', raw, async (req, res) => {
    let client;
    try {
      const webhookSecret = String(process.env.STRIPE_IDENTITY_WEBHOOK_SECRET || '');
      const apiKey = String(process.env.STRIPE_SECRET_KEY || '');
      if (process.env.STRIPE_IDENTITY_TEST_ENABLED !== 'true' || !stripeTestKey(apiKey)) return res.status(503).send('Identity test webhook is disabled');
      if (!webhookSecret || !verifyStripeSignature(req.body, req.headers['stripe-signature'], webhookSecret)) return res.status(400).send('Invalid Stripe signature');
      const event = JSON.parse(req.body.toString('utf8'));
      const allowed = new Set([
        'identity.verification_session.verified',
        'identity.verification_session.requires_input',
        'identity.verification_session.processing',
        'identity.verification_session.canceled'
      ]);
      if (event.livemode !== false) return res.status(400).send('Stripe mode mismatch');
      if (!allowed.has(event.type)) return res.json({ received: true, ignored: true });
      const session = event.data?.object;
      if (!session?.id) return res.status(400).send('Missing verification session');

      const ageOutcome = deriveStripeAgeOutcome(session);
      if (event.type === 'identity.verification_session.verified' && ageOutcome !== 'adult') return res.status(400).send('A verified document session is required');

      const pool = getPool();
      if (!pool) return res.status(503).send('PostgreSQL is required');
      await ensureAgeSchema(pool);
      client = await pool.connect();
      await client.query('BEGIN');
      const linked = await client.query(
        'SELECT user_key FROM abyssal_identity_sessions WHERE session_id=$1 FOR UPDATE',
        [session.id]
      );
      if (!linked.rowCount) {
        await client.query('ROLLBACK');
        client.release();
        client = null;
        console.error('[age-assurance] No local session link; asking Stripe to retry:', session.id);
        return res.status(500).send('Verification session is not linked; retry delivery');
      }

      // Duplicate deliveries are intentionally reprocessed: updates below are idempotent.
      await client.query(
        'INSERT INTO abyssal_identity_events(event_id,event_type) VALUES($1,$2) ON CONFLICT(event_id) DO NOTHING',
        [String(event.id), String(event.type)]
      );
      const userKey = linked.rows[0].user_key;
      const statusByEvent = {
        'identity.verification_session.verified': 'verified',
        'identity.verification_session.requires_input': ageOutcome === 'minor' ? 'underage' : 'requires_input',
        'identity.verification_session.processing': 'processing',
        'identity.verification_session.canceled': 'canceled'
      };
      const nextStatus = statusByEvent[event.type];
      await client.query(
        'UPDATE abyssal_identity_sessions SET status=$2,updated_at=NOW() WHERE session_id=$1',
        [session.id, nextStatus]
      );

      const user = getUsers()[userKey];
      if (user && event.type === 'identity.verification_session.verified') {
        user.ageAssurance = {
          provider: 'stripe_identity',
          status: nextStatus,
          ageBand: '18_plus',
          verifiedAt: new Date().toISOString(),
          mode: 'test'
        };
      } else if (user && event.type === 'identity.verification_session.requires_input') {
        if (ageOutcome === 'minor') user.ageAssurance = { provider: 'stripe_identity', status: 'underage', ageBand: 'under_18', verifiedAt: new Date().toISOString(), mode: 'test' };
        else if (!user.ageAssurance || user.ageAssurance.status !== 'verified') user.ageAssurance = { provider: 'stripe_identity', status: 'requires_input', ageBand: null, mode: 'test' };
      } else if (user && event.type === 'identity.verification_session.canceled') {
        if (!user.ageAssurance || user.ageAssurance.status !== 'verified') user.ageAssurance = { provider: 'stripe_identity', status: 'canceled', ageBand: null, mode: 'test' };
      }
      await client.query('COMMIT');
      client.release();
      client = null;
      if (user && event.type === 'identity.verification_session.verified') saveUsers();
      return res.json({ received: true, status: nextStatus });
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
      console.error('[age-assurance] Webhook failed:', error.message);
      return res.status(500).send('Identity webhook processing failed');
    }
  });
}

module.exports = { registerAgeAssuranceRoutes, deriveAgeStatus, deriveStripeAgeOutcome, stripeTestKey };
