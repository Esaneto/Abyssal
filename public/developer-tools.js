(function(root){
'use strict';
let active=false,panel=null,toggle=null,message=null,pollTimer=null,lastFrame=performance.now(),frames=0;
function fpsLoop(now){frames++;if(now-lastFrame>=500){root.__abyssalFps=Math.round(frames*1000/(now-lastFrame));frames=0;lastFrame=now;}requestAnimationFrame(fpsLoop)}requestAnimationFrame(fpsLoop);
function metric(label,id){return '<div class="dev-metric"><small>'+label+'</small><strong id="'+id+'">-</strong></div>'}
function ensure(){
 if(toggle)return;
 toggle=document.createElement('button');toggle.id='developerToolsToggle';toggle.type='button';toggle.textContent='DEV';toggle.title='Ferramentas GameMaster · F10';
 panel=document.createElement('section');panel.id='developerToolsPanel';panel.hidden=true;panel.innerHTML='<div class="dev-panel-head"><strong>GAMEMASTER · DEV</strong><small>F10</small></div><div class="dev-telemetry">'+metric('BUILD','devBuild')+metric('FPS','devFps')+metric('MODO','devMode')+metric('SALA','devRoom')+metric('HP','devHp')+metric('POSIÇÃO','devPosition')+metric('INIMIGOS','devEnemies')+metric('BOSSES','devBosses')+metric('ENERGIA','devEnergy')+metric('PRÓXIMO BOSS','devNextBoss')+'</div><div class="dev-actions"><button data-dev-command="heal">CURAR / REVIVER</button><button data-dev-command="god-mode">INVULNERÁVEL</button><button data-dev-command="grant-energy">+100K ENERGIA</button><button data-dev-command="unlock-specimens">LIBERAR ESPÉCIMES</button><button data-dev-command="max-proficiency">PROFICIÊNCIA MÁX.</button><button data-dev-command="boss-now">FORÇAR BOSS</button><button data-dev-command="clear-enemies" data-danger="1">LIMPAR INIMIGOS</button><button data-dev-command="refresh">ATUALIZAR DADOS</button></div><p id="developerToolsMessage"></p>';
 document.body.append(toggle,panel);message=panel.querySelector('#developerToolsMessage');
 toggle.addEventListener('click',()=>setOpen(panel.hidden));
 panel.addEventListener('click',e=>{const b=e.target.closest('[data-dev-command]');if(b)runCommand(b.dataset.devCommand,b)});
 document.addEventListener('keydown',e=>{if(e.code==='F10'&&active){e.preventDefault();setOpen(panel.hidden)}});
}
function setActive(value){
 active=Boolean(value);root.AbyssalDeveloperActive=active;ensure();document.body.classList.toggle('abyssal-developer',active);
 if(!active){panel.hidden=true;stopPoll();}
}
function setOpen(open){if(!active)return;ensure();panel.hidden=!open;if(open){refresh();startPoll()}else stopPoll()}
function startPoll(){stopPoll();pollTimer=setInterval(refresh,900)}
function stopPoll(){if(pollTimer){clearInterval(pollTimer);pollTimer=null}}
function put(id,value){const el=document.getElementById(id);if(el)el.textContent=value==null?'-':String(value)}
async function refresh(){
 if(!active)return;
 const local=root.AbyssalGameHooks?.developerInspect?.()||{};
 let server=null;
 if(root.AbyssalOnlineDev?.isDeveloper?.())server=await root.AbyssalOnlineDev.inspect();
 const s=server?.ok?server:null,p=s?.player||null,w=s?.world||null,r=s?.room||null,a=s?.account||null;
 put('devBuild',s?.build||root.ABYSSAL_CLIENT_BUILD?.version||'-');
 put('devFps',local.fps||root.__abyssalFps||0);
 put('devMode',r?.mode||local.mode||'menu');
 put('devRoom',r?r.id:(local.online?'online':'local'));
 put('devHp',p?Math.round(p.hp)+' / '+Math.round(p.maxHp):Math.round(local.hp||0)+' / '+Math.round(local.maxHp||0));
 put('devPosition',p?Math.round(p.x)+', '+Math.round(p.y):Math.round(local.x||0)+', '+Math.round(local.y||0));
 put('devEnemies',w?.enemies??local.enemies??0);
 put('devBosses',w?.bosses??local.bosses??0);
 put('devEnergy',a?Number(a.energy||0).toLocaleString('pt-BR'):'-');
 put('devNextBoss',w?Math.max(0,w.nextBossIn)+'s':'-');
}
async function runCommand(command,button){
 if(command==='refresh'){await refresh();return}
 button.disabled=true;
 let result;
 const local=root.AbyssalGameHooks?.developerInspect?.()||{};
 const serverOnly=new Set(['grant-energy','unlock-specimens','max-proficiency']);
 if(!serverOnly.has(command)&&local.online===false)result=root.AbyssalGameHooks?.developerCommand?.(command)||{ok:false,message:'Comando local indisponível.'};
 else result=await root.AbyssalOnlineDev?.command?.(command)||{ok:false,message:'Servidor DEV indisponível.'};
 if(message)message.textContent=result?.message|| (result?.ok?'Comando concluído.':'Falha no comando.');
 button.disabled=false;await refresh();
}
root.addEventListener('abyssal-account-data',e=>setActive(Boolean(e.detail?.isDeveloper)));
root.addEventListener('abyssal-account-signed-out',()=>setActive(false));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure,{once:true});else ensure();
try{const cached=JSON.parse(localStorage.getItem('abyssalAccount')||'null');if(cached?.isDeveloper)setActive(true)}catch(_){}
})(window);
