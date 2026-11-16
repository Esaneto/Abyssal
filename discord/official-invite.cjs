'use strict';
const {api}=require('./sonar-sync.cjs');
const cfg=require('./sonar-config.json');
async function create(request){
 const bot=await request('GET','/users/@me');
 if(!bot.bot||bot.id!==cfg.botId)throw Error('Unexpected bot identity');
 const channel=await request('GET','/channels/1571881108059066499');
 if(channel.guild_id!==cfg.guildId||channel.type!==0)throw Error('Unexpected welcome channel');
 const invite=await request('POST','/channels/1571881108059066499/invites',{max_age:0,max_uses:0,temporary:false,unique:false});
 if(!/^[A-Za-z0-9-]+$/.test(invite.code||''))throw Error('Invalid invitation response');
 return 'https://discord.gg/'+invite.code;
}
if(require.main===module){const token=process.env.ABYSSAL_DISCORD_BOT_TOKEN;if(!token){console.error('Missing Discord token');process.exitCode=1;}else create(api(token)).then(url=>console.log('OFFICIAL_PUBLIC_INVITE: '+url)).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={create};
