# Abyssal v3.0.2 — correção do lobby e movimento online

## Mudanças
- Define `escapeHtml()` no escopo de `game.js`, evitando que o renderizador da lista de salas falhe.
- Todas as salas públicas e privadas aparecem na lista; a listagem mostra apenas metadados de privacidade e nunca envia senhas/hashes.
- Os três monstros iniciais surgem em vórtices fixos nos cantos, em vez de nascerem ao redor do jogador.
- Movimento autoritativo mantém distância de contato para que inimigos não se sobreponham ao jogador e parem todos no mesmo ponto.
- Velocidades de inimigos usam os mesmos valores-base do modo solo e conversão de escala de mundo única (`WORLD_ZOOM = 0.78`).
- Botão de cooperativo online maior, animado e destacado no menu.
- Favicon SVG, build `3.0.2` e cache busting dos arquivos de cliente.
- `/health` informa versão, diretório de salas e métricas de simulação.

## Atualizar
1. Substitua os arquivos correspondentes no repositório mantendo `public/` e demais configurações existentes.
2. Execute `npm install` na raiz e inclua o `package-lock.json` atualizado, se gerado.
3. Faça commit/push para a branch `main`.
4. Mantenha a variável `DATABASE_URL` e o grupo de ambiente existente no Render.
5. Confirme `/health` com `build: "3.0.2"`, `simulation.errors: 0` e `simulation.movingEnemies > 0` quando houver jogadores e inimigos perseguindo-os.
6. Confirme `/api/rooms` e teste uma sala criada por um segundo navegador/dispositivo.

## Observações
- Salas registradas no PostgreSQL são um diretório de metadados. O estado de jogo e os sockets permanecem na memória da instância ativa; reiniciar o serviço encerra partidas abertas.
- Não publique `DATABASE_URL` nem credenciais no GitHub.
