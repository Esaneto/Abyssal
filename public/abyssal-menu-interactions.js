/* Abyssal cinematic menu: reuse existing actions without duplicating gameplay handlers. */
(function(){
  'use strict';
  if(window.__abyssalMenuInteractionsReady)return;
  window.__abyssalMenuInteractionsReady=true;

  function $(id){return document.getElementById(id);}
  function buildDialog(kind){
    var overlay=document.createElement('section');
    overlay.className='abyss-cinematic-dialog';
    overlay.hidden=true;
    overlay.dataset.kind=kind;
    overlay.innerHTML=kind==='settings'?
      '<div class="abyss-cinematic-dialog-card" role="dialog" aria-modal="true" aria-labelledby="abyssSettingsTitle">'+
        '<h2 id="abyssSettingsTitle">CONFIGURAÇÕES</h2>'+
        '<p>Ajuste sua expedição sem sair do Abismo.</p>'+
        '<div class="abyss-cinematic-dialog-choices">'+
          '<button type="button" data-setting="audio">SOM E MÚSICA</button>'+
          '<button type="button" data-setting="controls">CONTROLES</button>'+
          '<button type="button" data-setting="language">IDIOMA</button>'+
          '<button type="button" data-setting="fullscreen">TELA CHEIA</button>'+
        '</div>'+
        '<button type="button" class="abyss-cinematic-close">VOLTAR AO MENU</button>'+
      '</div>':
      '<div class="abyss-cinematic-dialog-card" role="dialog" aria-modal="true" aria-labelledby="abyssExitTitle">'+
        '<h2 id="abyssExitTitle">ENCERRAR MERGULHO?</h2>'+
        '<p>Sua conta continuará disponível para a próxima expedição.</p>'+
        '<div class="abyss-cinematic-dialog-choices">'+
          '<button type="button" class="abyss-cinematic-confirm">SAIR DO JOGO</button>'+
          '<button type="button" class="abyss-cinematic-close">CONTINUAR NO ABISMO</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(overlay);
    var origin=null;
    function close(){
      overlay.hidden=true;
      if(origin && origin.isConnected)origin.focus();
    }
    function open(from){
      origin=from;
      overlay.hidden=false;
      (overlay.querySelector('.abyss-cinematic-close')||overlay.querySelector('button'))?.focus();
    }
    overlay.addEventListener('click',function(event){
      if(event.target===overlay)close();
    });
    overlay.querySelectorAll('.abyss-cinematic-close').forEach(function(b){b.addEventListener('click',close);});
    overlay.querySelectorAll('[data-setting]').forEach(function(b){
      b.addEventListener('click',function(){
        var choice=b.dataset.setting;
        close();
        if(choice==='audio'){
          var popup=$('volumePopup');
          if(popup){
            popup.classList.add('active');
            $('volumeSlider')?.focus();
          }
        }else if(choice==='controls')$('controlsBtn')?.click();
        else if(choice==='language')$('languageSelect')?.focus();
        else if(choice==='fullscreen')$('fullscreenBtn')?.click();
      });
    });
    overlay.querySelector('.abyss-cinematic-confirm')?.addEventListener('click',function(){
      close();
      window.location.assign('about:blank');
    });
    document.addEventListener('keydown',function(event){
      if(overlay.hidden)return;
      if(event.key==='Escape'){event.preventDefault();close();}
      if(event.key==='Tab'){
        var buttons=Array.from(overlay.querySelectorAll('button:not([disabled])'));
        if(!buttons.length)return;
        var first=buttons[0],last=buttons[buttons.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
    return open;
  }

  function init(){
    var settings=$('abyssSettingsBtn');
    var exit=$('abyssExitBtn');
    if(!settings||!exit)return;
    var openSettings=buildDialog('settings');
    var openExit=buildDialog('exit');
    settings.addEventListener('click',function(){openSettings(settings);});
    exit.addEventListener('click',function(){openExit(exit);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
