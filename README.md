# Abyssal v2.3 — Disparos, skins e sons abissais

## Instalação
1. Extraia a pasta `abyssal-v2.1`.
2. Abra a pasta no VS Code.
3. No terminal, execute `npm install`.
4. Execute `npm start`.
5. Abra http://localhost:3000.

## Alterações
- Disparos automáticos online usam um heartbeat separado do `requestAnimationFrame`, reduzindo a chance de parar quando a aba fica em segundo plano.
- Disparos remotos têm cores por habilidade, brilho, rastros e faíscas.
- Skins voltaram a usar a silhueta base animada, diferenciando-se por cor e detalhes (chifres/auréola) em vez de tentáculos estáticos.
- A música ambiente sintetizada fica mais audível.
- Chefes produzem efeitos sonoros sintetizados de entrada, com tons graves e dissonantes inspirados em gritos submersos.
- O servidor transmite os projéteis para todos os jogadores da sala.

## Limitações conhecidas
O navegador pode reduzir a frequência de timers em abas em segundo plano. Esta mudança mantém tentativas de disparo automáticas, mas não substitui um servidor autoritativo que simule todos os projéteis, inimigos e dano. Para testar a experiência cooperativa, mantenha duas janelas abertas e verifique se os tiros aparecem em ambas.
