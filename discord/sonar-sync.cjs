'use strict';
const config = require('./sonar-config.json');
const { icon } = require('./sonar-icons.cjs');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
function api(token, fetcher=fetch) {
 return async (method,path,body) => {
  for(let attempt=0;attempt<8;attempt++){
   const response=await fetcher('https://discord.com/api/v10'+path,{method,redirect:'error',headers:{Authorization:'Bot '+token,'Content-Type':'application/json','User-Agent':'DiscordBot (https://github.com/Esaneto/Abyssal, 1.0)','X-Audit-Log-Reason':'Abyssal%20Sonar%20versioned%20configuration'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
   if(response.status===429){const data=await response.json();await sleep(Math.max(1000,Math.ceil(Number(data.retry_after||1)*1000)+250));continue;}
   if(!response.ok) throw Error(method+' '+path+' HTTP '+response.status);
   return response.status===204?null:response.json();
  }
  throw Error('Rate limit exceeded: '+path);
 };
}
const norm=s=>String(s).normalize('NFC').toLowerCase().replace(/\uFE0F/g,'').replace(/\s+/g,'-');
function match(items,old,name,type){
 const found=items.filter(c=>(type===undefined||c.type===type)&&[norm(old),norm(name)].includes(norm(c.name)));
 if(found.length>1)throw Error('Ambiguous channel: '+old);
 return found[0];
}
function plan(channels,cfg=config){
 const actions=[],missing=[];
 for(const group of cfg.categories){
  const category=match(channels,group.old,group.name,4);
  if(!category){missing.push(group.old);continue;}
  if(norm(category.name)!==norm(group.name))actions.push({id:category.id,name:group.name});
  const children=channels.filter(c=>c.parent_id===category.id&&[0,2,5,13,15,16].includes(c.type));
  for(const item of group.channels){
   const c=match(children,item.old,item.name);
   if(!c){missing.push(group.old+' / '+item.old);continue;}
   if(norm(c.name)!==norm(item.name))actions.push({id:c.id,name:item.name});
  }
 }
 return {actions,missing};
}
async function sync(request,{apply=false,log=console.log,cfg=config}={}){
 const user=await request('GET','/users/@me');
 if(user.id!==cfg.botId||!user.bot)throw Error('Unexpected bot identity');
 const guild=await request('GET','/guilds/'+cfg.guildId);
 if(guild.id!==cfg.guildId)throw Error('Unexpected server identity');
 const channels=await request('GET','/guilds/'+cfg.guildId+'/channels');
 const emojis=await request('GET','/guilds/'+cfg.guildId+'/emojis');
 const {actions,missing}=plan(channels,cfg);
 const additions=cfg.emojis.filter(n=>!emojis.some(e=>e.name===n));
 const failures=[];
 log('Server: '+guild.name+' | '+(apply?'APPLY':'PREVIEW'));
 for(const name of missing)log('NOT VISIBLE OR MISSING: '+name);
 for(const action of actions){
  log('RENAME '+action.id+' => '+action.name);
  if(apply)try{await request('PATCH','/channels/'+action.id,{name:action.name});}catch(e){failures.push(e.message);}
 }
 for(const name of additions){
  log('CREATE EMOJI '+name);
  if(apply)try{await request('POST','/guilds/'+cfg.guildId+'/emojis',{name,image:'data:image/png;base64,'+icon(name).toString('base64')});}catch(e){failures.push(e.message);}
 }
 for(const failure of failures)log('FAILED: '+failure);
 log('Result: '+actions.length+' renames, '+additions.length+' new emojis, '+missing.length+' missing, '+failures.length+' failed.');
 return {actions,additions,missing,failures};
}
if(require.main===module){
 const token=process.env.ABYSSAL_DISCORD_BOT_TOKEN;
 if(!token){console.error('Set repository Actions secret ABYSSAL_DISCORD_BOT_TOKEN.');process.exitCode=1;}
 else sync(api(token),{apply:process.argv.includes('--apply')}).then(r=>{if(r.failures.length||r.missing.length)process.exitCode=1;}).catch(e=>{console.error(e.message);process.exitCode=1;});
}
module.exports={api,plan,sync,norm};
