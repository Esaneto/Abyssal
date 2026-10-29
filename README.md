# Abyssal v3.0.1 — correção do lobby e da simulação online

## Correções principais
- O servidor envia a lista inicial de salas pela mesma função canônica usada pela API e pelas atualizações seguintes.
- A lista HTTP é tratada como fonte mais recente no cliente; a lista Socket.IO cobre apenas o primeiro render enquanto a resposta HTTP está pendente. Isso remove salas expiradas que ficavam presas no cache local.
- Salas públicas e privadas são listadas. As privadas aparecem com cadeado e exigem senha no ingresso; a senha e seu hash nunca são enviados ao cliente.
- O diretório de salas usa PostgreSQL (`abyssal_rooms`) com heartbeat/lease para que a lista seja compartilhada entre clientes, e `/health` informa se o diretório está ativo.
- Simulação autoritativa executada em ticks de 50 ms, erro isolado por arena, 3 monstros iniciais e snapshots de movimento a cada 100 ms. `/health` expõe quantidade de ticks, erros, salas e monstros que se moveram.
- O cliente interpola a partir da posição já renderizada e faz uma pequena extrapolação com a velocidade do snapshot para suavizar a latência.
- Cache-busting `v=3.0.1` para evitar que navegador continue usando JavaScript antigo.

## Como testar em produção
1. Preserve `DATABASE_URL` e o grupo Render `abyss`.
2. Faça deploy desta versão.
3. Abra `https://SEU-SERVICO.onrender.com/health`. Confira `build: "3.0.1"`, `roomRegistry: "postgres-ready"`, `simulation.ticks` crescendo, `simulation.errors: 0`, e `simulation.movingEnemies` maior que zero quando houver uma sala com jogadores.
4. Em outra aba ou aparelho, abra `https://SEU-SERVICO.onrender.com/api/rooms`. A sala privada deve aparecer com `isPrivate: true`, sem nenhum campo de senha/hash.
5. Para entrar numa sala privada, selecione-a no lobby, informe a senha e confirme.

## Infraestrutura e limites
- PostgreSQL resolve o diretório/listagem entre processos, mas Socket.IO e simulação da sala continuam no processo que a criou. Para permitir que salas hospedadas em processos diferentes aceitem jogadores, seria necessário um adapter distribuído mais roteamento/sincronização da simulação. Na configuração de um único Web Service gratuito do Render, os clientes que usam a mesma URL normalmente chegam ao mesmo processo. Não aumente a quantidade de instâncias para este projeto sem adicionar essa arquitetura.
- As salas ativas não sobrevivem ao restart do processo; a listagem usa leases de 25 segundos para remover registros abandonados. Contas e rankings permanecem no PostgreSQL.
- As senhas das salas não são armazenadas em texto puro.

## Deploy
1. Extraia o ZIP e copie os arquivos para o repositório `Esaneto/Abyssal`, preservando `public/`.
2. Na raiz do projeto execute `npm install`.
3. Faça commit e push para a branch `main`; aguarde o Render ficar `Live`.
4. Não remova nem altere `DATABASE_URL`.
