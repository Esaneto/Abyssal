'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const TERMS_VERSION = '2026-10-31-v10';
const BOSS_SKINS = ['leviathan','kraken','aberration','angler','maw','devourer'];
const BOSS_BUNDLE_BRL = 3999;
const PAID_SKINS = {
 violet:{name:'Medusa-Coroa Violeta',nameEn:'Violet Crown Jelly',brl:199},
 phantomjelly:{name:'Medusa-Fantasma Gigante',nameEn:'Giant Phantom Jellyfish',brl:199},
 bloodmoon:{name:'Lula-Vampira Carmesim',nameEn:'Crimson Vampire Squid',brl:199},
 toxic:{name:'Anêmona Tóxica',nameEn:'Toxic Anemone',brl:199},
 butterflyray:{name:'Raia-Borboleta',nameEn:'Butterfly Ray',brl:199},
 hawksbill:{name:'Tartaruga-de-Pente',nameEn:'Hawksbill Turtle',brl:199},
 greenland:{name:'Tubarão-da-Groenlândia',nameEn:'Greenland Shark',brl:199},
 reefshark:{name:'Tubarão-branco',nameEn:'Great White Shark',brl:499},
 hammerhead:{name:'Tubarão-martelo',nameEn:'Hammerhead Shark',brl:499},
 saltcroc:{name:'Crocodilo-Marinho',nameEn:'Saltwater Crocodile',brl:499},
 blackcaiman:{name:'Jacaré-Açu',nameEn:'Black Caiman',brl:499},
 abysscroc:{name:'Tubarão-Touro Estuarino',nameEn:'Estuarine Bull Shark',brl:499},
 armoredgator:{name:'Caranguejo-Ferradura Couraçado',nameEn:'Armored Horseshoe Crab',brl:499},
 electriceellegacy:{name:'Enguia-Elétrica Abissal',nameEn:'Abyssal Electric Eel',brl:499},
 leviathan:{name:'Eco do Peixe-Remo Leviatã',nameEn:'Oarfish Leviathan Echo',brl:999},
 kraken:{name:'Eco da Lula-Kraken',nameEn:'Kraken Squid Echo',brl:999},
 aberration:{name:'Eco do Polvo-de-Anéis-Azuis',nameEn:'Blue-Ringed Octopus Echo',brl:999},
 angler:{name:'Núcleo do Peixe-Pescador',nameEn:'Anglerfish Core',brl:999},
 maw:{name:'Fragmento da Enguia-Pelícano',nameEn:'Pelican Eel Fragment',brl:999},
 devourer:{name:'Núcleo da Lula-Colossal',nameEn:'Colossal Squid Core',brl:999}
}
function calculateOrder(productId, ownedSkins, currency='brl') {
 if (String(currency).toLowerCase() !== 'brl') throw new Error('Unsupported currency');
 const code='brl';
 const toMinorUnits=brl=>brl;
 const owned=new Set(Array.isArray(ownedSkins)?ownedSkins.map(String):[]);
 if(productId==='boss_bundle'){
  const skinIds=BOSS_SKINS.filter(id=>!owned.has(id));
  const brlAmount=skinIds.length?Math.round(BOSS_BUNDLE_BRL*(skinIds.length/BOSS_SKINS.length)):0;
  return {productId:productId,skinIds:skinIds,amount:toMinorUnits(brlAmount),brlAmount,currency:code};
 }
 const product=PAID_SKINS[productId];
 if(!product)throw new Error('Unknown product');
 const brlAmount=owned.has(productId)?0:product.brl;
 return {productId:productId,skinIds:owned.has(productId)?[]:[productId],amount:toMinorUnits(brlAmount),brlAmount,currency:code};
}
function verifyStripeSignature(rawBody,header,secret,nowSeconds) {
 if(!Buffer.isBuffer(rawBody)||!header||!secret)return false;
 const parts=String(header).split(',').map(x=>x.trim());
 const timestamp=Number((parts.find(x=>x.startsWith('t='))||'').slice(2));
 const signatures=parts.filter(x=>x.startsWith('v1=')).map(x=>x.slice(3));
 const now=Number.isFinite(nowSeconds)?nowSeconds:Math.floor(Date.now()/1000);
 if(!Number.isFinite(timestamp)||Math.abs(now-timestamp)>300||!signatures.length)return false;
 const expected=crypto.createHmac('sha256',secret).update(String(timestamp)+'.').update(rawBody).digest('hex');
 return signatures.some(sig=>{if(!/^[a-f0-9]{64}$/i.test(sig))return false;const a=Buffer.from(expected,'hex'),b=Buffer.from(sig,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b);});
}
function tokenUser(users,token) {
 if(!token||!/^[a-f0-9]{64}$/i.test(token))return null;
 const digest=crypto.createHash('sha256').update(token).digest('hex');
 for(const [key,user] of Object.entries(users||{})){
  if((Array.isArray(user.sessionTokens)?user.sessionTokens:[]).some(x=>x&&Number(x.expiresAt)>Date.now()&&x.hash===digest))return {key,user};
 }
 return null;
}
function hasPurchaseResponsibilityAcceptance(user) {
 return Boolean(user&&user.purchaseResponsibilityAcceptedVersion===TERMS_VERSION&&user.purchaseResponsibilityAcceptedAt);
}
function liveSalesReady() {
 return /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(String(process.env.STRIPE_SECRET_KEY||'').trim());
}
function registerPaymentRoutes(options) {
 const app=options.app,getUsers=options.getUsers,getPool=options.getPool,saveUsers=options.saveUsers;
 const dataDir=options.dataDir||path.resolve(__dirname,'data');
 const localOrdersFile=path.join(dataDir,'payment_orders.json');
 const localEventsFile=path.join(dataDir,'stripe_events.json');
 function readLocalStore(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
 function writeLocalStore(file,data){try{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2));}catch(err){console.warn('[payments] Erro ao salvar arquivo local:',err.message);}}
 let localOrders=readLocalStore(localOrdersFile,{});
 let localEvents=readLocalStore(localEventsFile,[]);
 const express=require('express');
 const jsonParser=typeof express.json==='function'?express.json({limit:'10kb'}):(_req,_res,next)=>next?.();
 const rawParser=typeof express.raw==='function'?express.raw({type:'application/json',limit:'1mb'}):(_req,_res,next)=>next?.();
 let schemaPromise=null;
 async function ensureSchema(){
  const pool=getPool();if(!pool)return;
  if(!schemaPromise)schemaPromise=pool.query(
   'CREATE TABLE IF NOT EXISTS abyssal_payment_orders(order_id TEXT PRIMARY KEY,checkout_session_id TEXT UNIQUE,user_key TEXT NOT NULL,product_id TEXT NOT NULL,skin_ids JSONB NOT NULL,prior_owned JSONB NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL DEFAULT '+ "'pending'"+ ',payment_intent_id TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());'+
   'CREATE TABLE IF NOT EXISTS abyssal_stripe_events(event_id TEXT PRIMARY KEY,event_type TEXT NOT NULL,received_at TIMESTAMPTZ NOT NULL DEFAULT NOW());'+
   'CREATE INDEX IF NOT EXISTS abyssal_payment_orders_user_status_idx ON abyssal_payment_orders(user_key,status,created_at);'+
   'CREATE INDEX IF NOT EXISTS abyssal_payment_orders_intent_idx ON abyssal_payment_orders(payment_intent_id);'
  );
  try{await schemaPromise;}catch(e){schemaPromise=null;throw e;}
 }
 app.post('/api/legal/accept',jsonParser,(req,res)=>{
  const auth=String(req.headers.authorization||''),token=auth.startsWith('Bearer ')?auth.slice(7):'';
  const account=tokenUser(getUsers(),token);
  if(!account)return res.status(401).json({ok:false,message:'Entre na sua conta para registrar o aceite.'});
  if(req.body?.termsVersion!==TERMS_VERSION||req.body?.privacyVersion!==TERMS_VERSION||req.body?.termsAccepted!==true||req.body?.privacyAccepted!==true||req.body?.purchaseResponsibilityAccepted!==true)return res.status(400).json({ok:false,message:'Confirme a declaração de responsabilidade e aceite os documentos atuais.'});
  account.user.termsAcceptedVersion=TERMS_VERSION;
  account.user.privacyAcceptedVersion=TERMS_VERSION;
  account.user.purchaseResponsibilityAcceptedVersion=TERMS_VERSION;
  account.user.purchaseResponsibilityAcceptedAt=new Date().toISOString();
  account.user.legalAcceptedAt=new Date().toISOString();
  saveUsers();
  res.json({ok:true,termsVersion:TERMS_VERSION});
 });
 
 app.get('/api/payments/order-status/:orderId', async (req, res) => {
  try {
   await ensureSchema();
   const pool = getPool(), orderId = String(req.params.orderId || '');
   if (pool) {
    const found = await pool.query('SELECT status, skin_ids, user_key FROM abyssal_payment_orders WHERE order_id=$1', [orderId]);
    if (!found.rowCount) return res.status(404).json({ ok: false, message: 'Pedido não encontrado.' });
    const order = found.rows[0];
    return res.json({ ok: true, status: order.status, skinIds: order.skin_ids });
   } else {
    const order = localOrders[orderId];
    if (!order) return res.status(404).json({ ok: false, message: 'Pedido não encontrado.' });
    return res.json({ ok: true, status: order.status, skinIds: order.skinIds });
   }
  } catch (err) {
   res.status(500).json({ ok: false, message: err.message });
  }
 });

 app.get('/api/payments/catalog',(_req,res)=>{res.json({currency:{brl:'BRL'},rates:{brl:1},testOnly:[],predatorySkins:['saltcroc','blackcaiman','reefshark','hammerhead','abysscroc','armoredgator'],bossBundle:{skins:BOSS_SKINS,brl:BOSS_BUNDLE_BRL},liveEnabled:liveSalesReady()});});
 app.post('/api/payments/checkout',jsonParser,async(req,res)=>{
  try{
   const secret=String(process.env.STRIPE_SECRET_KEY||'').trim();
   if(!/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(secret||''))return res.status(503).json({ok:false,message:'Pagamentos ainda não configurados.'});
   const auth=String(req.headers.authorization||''),token=auth.startsWith('Bearer ')?auth.slice(7):'';
   const account=tokenUser(getUsers(),token);
   if(!account)return res.status(401).json({ok:false,message:'Entre na sua conta para comprar.'});
   const currency='brl';
   const reqProductId = String(req.body&&req.body.productId||'');
   if (!reqProductId) return res.status(400).json({ok:false,message:'Produto não informado.'});
   if(reqProductId!=='boss_bundle'&&!Object.hasOwn(PAID_SKINS,reqProductId))return res.status(400).json({ok:false,message:'Produto indisponível para compra.'});
   const order=calculateOrder(reqProductId,account.user.ownedSkins||['default'],'brl');
   if(!order.skinIds.length||!order.amount)return res.status(409).json({ok:false,message:'Você já possui este conteúdo.'});
   await ensureSchema();
   const pool=getPool(),orderId=crypto.randomUUID();
   if(pool){
    const client=await pool.connect();let clientReleased=false;
    try{
     await client.query('BEGIN');
     await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[account.key]);
     const pending=await client.query("SELECT order_id,checkout_session_id,product_id,currency FROM abyssal_payment_orders WHERE user_key=$1 AND status='pending' AND created_at>NOW()-INTERVAL '45 minutes' ORDER BY created_at DESC LIMIT 1",[account.key]);
     if(pending.rowCount){
      await client.query('ROLLBACK');client.release();clientReleased=true;
      const previous=pending.rows[0];
      if(!previous.checkout_session_id)return res.status(409).json({ok:false,message:'Seu checkout anterior ainda está sendo preparado. Aguarde alguns segundos e tente novamente.'});
      const stripeHeaders={Authorization:'Bearer '+secret};
      const existingResponse=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(previous.checkout_session_id),{headers:stripeHeaders});
      const existing=await existingResponse.json();
      if(existingResponse.ok&&existing.status==='open'&&existing.url&&previous.product_id===order.productId&&previous.currency===currency)return res.json({ok:true,url:existing.url,orderId:previous.order_id,reused:true});
      if(existingResponse.ok&&existing.status==='open'&&(previous.product_id!==order.productId||previous.currency!==currency)){
       const expireResponse=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(previous.checkout_session_id)+'/expire',{method:'POST',headers:stripeHeaders});
       const expired=await expireResponse.json();
       if(!expireResponse.ok||expired.status!=='expired')return res.status(409).json({ok:false,message:'Você já tem outro checkout aberto. Reabra-o antes de escolher outro produto.'});
       await pool.query("UPDATE abyssal_payment_orders SET status='expired',updated_at=NOW() WHERE order_id=$1 AND status='pending'",[previous.order_id]);
       return res.status(409).json({ok:false,message:'O checkout anterior foi encerrado com segurança. Clique novamente para abrir o pagamento escolhido.'});
      }
      if(existingResponse.ok&&existing.status==='expired'){
       await pool.query("UPDATE abyssal_payment_orders SET status='expired',updated_at=NOW() WHERE order_id=$1 AND status='pending'",[previous.order_id]);
       return res.status(409).json({ok:false,message:'O checkout anterior expirou. Clique novamente para iniciar um novo pagamento.'});
      }
      if(existingResponse.ok&&existing.status==='complete')return res.status(409).json({ok:false,message:existing.payment_status==='paid'?'O pagamento já foi recebido e está sendo confirmado. Aguarde a entrega antes de tentar novamente.':'Este checkout já foi concluído. Atualize a loja e verifique o pedido antes de tentar novamente.'});
      console.error('[payments] Could not safely recover previous checkout:',existing.error&&existing.error.type||existingResponse.status);
      return res.status(409).json({ok:false,message:'Não foi possível confirmar o estado do checkout anterior. Tente novamente em alguns instantes.'});
     }
     const prior=order.skinIds.filter(id=>(account.user.ownedSkins||[]).includes(id));
     await client.query('INSERT INTO abyssal_payment_orders(order_id,user_key,product_id,skin_ids,prior_owned,amount,currency,status) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8)',[orderId,account.key,order.productId,JSON.stringify(order.skinIds),JSON.stringify(prior),order.amount,currency,'pending']);
     await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{if(!clientReleased)client.release();}
   } else {
    // Armazenamento local efêmero quando DATABASE_URL não está configurada
    const now=Date.now();
    const existingPending=Object.values(localOrders).find(o=>o.userKey===account.key&&o.status==='pending'&&(now-new Date(o.createdAt).getTime())<45*60*1000);
    if(existingPending){
     const stripeHeaders={Authorization:'Bearer '+secret};
     const existingResponse=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(existingPending.checkoutSessionId),{headers:stripeHeaders});
     const existing=await existingResponse.json();
     if(existingResponse.ok&&existing.status==='open'&&existing.url&&existingPending.productId===order.productId&&existingPending.currency===currency)return res.json({ok:true,url:existing.url,orderId:existingPending.orderId,reused:true});
     if(existingResponse.ok&&existing.status==='open'&&(existingPending.productId!==order.productId||existingPending.currency!==currency)){
      await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(existingPending.checkoutSessionId)+'/expire',{method:'POST',headers:stripeHeaders});
      existingPending.status='expired';writeLocalStore(localOrdersFile,localOrders);
      return res.status(409).json({ok:false,message:'O checkout anterior foi encerrado com segurança. Clique novamente para abrir o pagamento escolhido.'});
     }
     if(existingResponse.ok&&existing.status==='expired'){existingPending.status='expired';writeLocalStore(localOrdersFile,localOrders);}
    }
    const prior=order.skinIds.filter(id=>(account.user.ownedSkins||[]).includes(id));
    localOrders[orderId]={orderId,userKey:account.key,productId:order.productId,skinIds:order.skinIds,priorOwned:prior,amount:order.amount,currency,status:'pending',createdAt:new Date().toISOString()};
    writeLocalStore(localOrdersFile,localOrders);
   }
   const english=String(req.body?.language||'pt').toLowerCase()==='en',product=PAID_SKINS[order.productId];
   const productName=order.productId==='boss_bundle'?(english?'Abyss Boss Collection':'Coleção dos Bosses'):(english?product.nameEn:product.name);
   const form=new URLSearchParams();
   // Hosted Checkout is the default across Stripe API versions; omit renamed ui_mode enum.
   form.set('mode','payment');
   form.set('billing_address_collection','auto');
   form.set('phone_number_collection[enabled]','false');
   form.set('automatic_tax[enabled]','false');
   form.set('allow_promotion_codes','false');
   form.set('submit_type','auto');
   form.set('expires_at',String(Math.floor(Date.now()/1000)+45*60));
   form.set('success_url','https://abyssal-ej5j.onrender.com/?payment=success&session_id={CHECKOUT_SESSION_ID}');
   form.set('cancel_url','https://abyssal-ej5j.onrender.com/?payment=cancelled');
   form.set('client_reference_id',account.key);form.set('locale',english?'en':'pt-BR');
   form.set('line_items[0][quantity]','1');
   form.set('line_items[0][price_data][currency]',currency);
   form.set('line_items[0][price_data][unit_amount]',String(order.amount));
   form.set('line_items[0][price_data][product_data][name]',productName);
   form.set('line_items[0][price_data][product_data][description]',order.productId==='boss_bundle'?String(order.skinIds.length)+' '+(english?'remaining boss skins with gameplay abilities':'skins de boss restantes com habilidades de jogo'):(english?'Premium skin with gameplay abilities':'Skin premium com habilidades de jogo'));
   form.set('metadata[order_id]',orderId);form.set('metadata[user_key]',account.key);form.set('metadata[product_id]',order.productId);form.set('metadata[skin_ids]',order.skinIds.join(','));
   form.set('payment_intent_data[metadata][order_id]',orderId);form.set('payment_intent_data[metadata][user_key]',account.key);
   let response,session;
   try{response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':orderId},body:form,signal:AbortSignal.timeout(20000)});session=await response.json();}
   catch(error){console.error('[payments] Stripe connection error:',error.message);return res.status(503).json({ok:false,message:'Não foi possível confirmar a criação do checkout. Tente novamente em instantes.'});}
   if(!response.ok||!session.url){
    if(pool)await pool.query("UPDATE abyssal_payment_orders SET status='failed',updated_at=NOW() WHERE order_id=$1",[orderId]);
    else if(localOrders[orderId]){localOrders[orderId].status='failed';writeLocalStore(localOrdersFile,localOrders);}
    console.error('[payments] Stripe API error status:',response.status,'type:',session.error&&session.error.type,'code:',session.error&&session.error.code,'param:',session.error&&session.error.param,'msg:',session.error&&session.error.message);
    return res.status(502).json({ok:false,message:session?.error?.message||'Não foi possível iniciar o pagamento com a Stripe.'});
   }
   if(pool)await pool.query('UPDATE abyssal_payment_orders SET checkout_session_id=$2,updated_at=NOW() WHERE order_id=$1',[orderId,session.id]);
   else if(localOrders[orderId]){localOrders[orderId].checkoutSessionId=session.id;writeLocalStore(localOrdersFile,localOrders);}
   res.json({ok:true,url:session.url,orderId:orderId});
  }catch(error){console.error('[payments] Checkout error:',error.message);res.status(500).json({ok:false,message:error.message||'Erro ao iniciar o checkout.'});}
 });
 app.post('/api/payments/webhook',rawParser,async(req,res)=>{
  try{
   const secret=process.env.STRIPE_WEBHOOK_SECRET;
   if(!secret||!verifyStripeSignature(req.body,req.headers['stripe-signature'],secret))return res.status(400).send('Invalid Stripe signature');
   const event=JSON.parse(req.body.toString('utf8'));
   if(Boolean(event.livemode)!==/^(sk|rk)_live_/.test(String(process.env.STRIPE_SECRET_KEY||'')))return res.status(400).send('Stripe mode mismatch');
   await ensureSchema();
   const pool=getPool();let usersChanged=false;
   if(pool){
    const client=await pool.connect();
    try{
     await client.query('BEGIN');
     const inserted=await client.query('INSERT INTO abyssal_stripe_events(event_id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id',[event.id,event.type]);
     if(!inserted.rowCount){await client.query('COMMIT');return res.json({received:true,duplicate:true});}
     const session=event.data&&event.data.object;
     if((event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded')&&session&&session.payment_status==='paid'){
      const orderId=String(session.metadata&&session.metadata.order_id||'');
      const found=await client.query('SELECT * FROM abyssal_payment_orders WHERE order_id=$1 FOR UPDATE',[orderId]),order=found.rows[0];
      const paidCurrency=String(session.currency||'').toLowerCase();
      const sessionSkins=String(session.metadata?.skin_ids||'').split(',').filter(Boolean).sort();
      const expectedSkins=(Array.isArray(order?.skin_ids)?order.skin_ids:[]).slice().sort();
      const sessionPaymentIntent=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id||null;
      const orderMatches=order&&Boolean(session.livemode)===/^(sk|rk)_live_/.test(String(process.env.STRIPE_SECRET_KEY||''))&&order.checkout_session_id===session.id&&session.mode==='payment'&&session.payment_status==='paid'&&Number(session.amount_total)===Number(order.amount)&&paidCurrency===order.currency&&session.client_reference_id===order.user_key&&session.metadata?.user_key===order.user_key&&session.metadata?.product_id===order.product_id&&sessionSkins.length===expectedSkins.length&&sessionSkins.every((id,index)=>id===expectedSkins[index]);
      if(orderMatches&&order.status!=='paid'){
       const state=await client.query("SELECT state_value FROM abyssal_state WHERE state_key='users' FOR UPDATE"),stored=state.rows[0]&&state.rows[0].state_value||{},user=stored[order.user_key];
       if(user){
        const skins=Array.isArray(order.skin_ids)?order.skin_ids:[];
        user.ownedSkins=Array.from(new Set(['default',...(user.ownedSkins||[]),...skins]));
        user.purchaseTitles ||= {storeSupporter:false,bossAbyssal:false};
        user.purchaseTitles.storeSupporter=true;
        if(order.product_id==='boss_bundle'&&skins.length>0)user.purchaseTitles.bossAbyssal=true;
        if(skins.length===1)user.equippedSkin=skins[0];
        await client.query("UPDATE abyssal_state SET state_value=$1::jsonb,updated_at=NOW() WHERE state_key='users'",[JSON.stringify(stored)]);
        await client.query("UPDATE abyssal_payment_orders SET status='paid',payment_intent_id=$2,updated_at=NOW() WHERE order_id=$1",[orderId,sessionPaymentIntent]);
        Object.assign(getUsers(),stored);usersChanged=true;
       }else await client.query("UPDATE abyssal_payment_orders SET status='orphaned',updated_at=NOW() WHERE order_id=$1",[orderId]);
      }else if(!orderMatches){
       console.warn('[payments] Ignoring checkout event without a matching stored order:',event.id);
       await client.query('COMMIT');
       return res.json({received:true,ignored:true,reason:'order_not_matched'});
      }
     }else if(event.type==='checkout.session.async_payment_failed'||event.type==='checkout.session.expired'){
      const orderId=String(session&&session.metadata&&session.metadata.order_id||'');
      await client.query("UPDATE abyssal_payment_orders SET status=$2,updated_at=NOW() WHERE order_id=$1 AND status='pending'",[orderId,event.type==='checkout.session.expired'?'expired':'failed']);
     }else if(event.type==='charge.refunded'){
      const charge=session||{},pi=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent&&charge.payment_intent.id;
      if(pi&&Number(charge.amount_refunded)>=Number(charge.amount)){
       const found=await client.query("SELECT * FROM abyssal_payment_orders WHERE payment_intent_id=$1 AND status='paid' FOR UPDATE",[pi]);
       for(const order of found.rows){
        const state=await client.query("SELECT state_value FROM abyssal_state WHERE state_key='users' FOR UPDATE"),stored=state.rows[0]&&state.rows[0].state_value||{},user=stored[order.user_key];
        if(user){
         const skins=Array.isArray(order.skin_ids)?order.skin_ids:[],prior=new Set(Array.isArray(order.prior_owned)?order.prior_owned:[]);
         for(const id of skins){if(prior.has(id))continue;const other=await client.query("SELECT 1 FROM abyssal_payment_orders WHERE user_key=$1 AND order_id<>$2 AND status='paid' AND skin_ids @> $3::jsonb LIMIT 1",[order.user_key,order.order_id,JSON.stringify([id])]);if(!other.rowCount)user.ownedSkins=(user.ownedSkins||[]).filter(x=>x!==id);}
         if(!user.ownedSkins.includes(user.equippedSkin))user.equippedSkin='default';
         await client.query("UPDATE abyssal_state SET state_value=$1::jsonb,updated_at=NOW() WHERE state_key='users'",[JSON.stringify(stored)]);Object.assign(getUsers(),stored);usersChanged=true;
        }
        await client.query("UPDATE abyssal_payment_orders SET status='refunded',updated_at=NOW() WHERE order_id=$1",[order.order_id]);
       }
      }
     }
     await client.query('COMMIT');
    }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
   } else {
    // Webhook local quando PostgreSQL não está conectado
    if(localEvents.includes(event.id))return res.json({received:true,duplicate:true});
    localEvents.push(event.id);
    writeLocalStore(localEventsFile,localEvents);
    const session=event.data&&event.data.object;
    if((event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded')&&session&&session.payment_status==='paid'){
     const orderId=String(session.metadata&&session.metadata.order_id||'');
     const order=localOrders[orderId];
     if(order&&order.status!=='paid'){
      const allUsers=getUsers();
      const user=allUsers[order.userKey];
      if(user){
       const skins=Array.isArray(order.skinIds)?order.skinIds:[];
       user.ownedSkins=Array.from(new Set(['default',...(user.ownedSkins||[]),...skins]));
       user.purchaseTitles ||= {storeSupporter:false,bossAbyssal:false};
       user.purchaseTitles.storeSupporter=true;
       if(order.productId==='boss_bundle'&&skins.length>0)user.purchaseTitles.bossAbyssal=true;
       if(skins.length===1)user.equippedSkin=skins[0];
       order.status='paid';
       order.paymentIntentId=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id||null;
       writeLocalStore(localOrdersFile,localOrders);
       usersChanged=true;
      }
     }
    } else if(event.type==='checkout.session.async_payment_failed'||event.type==='checkout.session.expired'){
     const orderId=String(session&&session.metadata&&session.metadata.order_id||'');
     if(localOrders[orderId]){localOrders[orderId].status=event.type==='checkout.session.expired'?'expired':'failed';writeLocalStore(localOrdersFile,localOrders);}
    }
   }
   if(usersChanged)saveUsers();
   res.json({received:true});
  }catch(error){console.error('[payments] Webhook failed:',error.message);res.status(500).send('Webhook processing failed');}
 });
}
module.exports={registerPaymentRoutes,calculateOrder,verifyStripeSignature,liveSalesReady,hasPurchaseResponsibilityAcceptance,TERMS_VERSION,BOSS_SKINS,BOSS_BUNDLE_BRL,PAID_SKINS};
