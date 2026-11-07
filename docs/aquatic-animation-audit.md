# Auditoria do sistema universal de animação aquática

O sistema cobre as skins jogáveis do catálogo, jogadores locais e remotos, inimigos comuns, inimigos especiais, minibosses, chefes clássicos e o chefe final das Fossas. Espécies futuras recebem um perfil por `family`; nomes biológicos conhecidos também têm uma classificação de reserva.

## Movimento contemplado

- O repouso mantém respiração, flutuação e pulsação contínuas.
- A intensidade sobe e desce suavemente a partir do deslocamento visual real.
- A direção anatômica acompanha o deslocamento e preserva a orientação vertical.
- Peixes, tubarões, raias, enguias, cefalópodes, águas-vivas, crustáceos, moluscos, répteis e espécies bentônicas usam ritmos próprios.
- Polvos e lulas permanecem em pose lateral, com pulsação de manto e braços oscilantes.
- Ataques acrescentam compressão e recuo visual sem alterar alcance, colisão, dano, velocidade ou lógica de combate.

## Online e desempenho

As poses são funções determinísticas do identificador e do tempo de apresentação. Nenhum pacote de rede foi adicionado. O rastreador reutiliza um estado por criatura, tem limite fixo e é limpo ao iniciar uma partida. Inimigos fora da câmera continuam descartados antes da renderização; anatomia detalhada usa sprites em cache e quadros quantizados.

## Verificação automatizada

Os testes cobrem catálogo e espécies hostis, limites contra inversão, orientação por deslocamento, aceleração e desaceleração suaves, animação em repouso, ataques, chefe final, jogadores online e separação entre apresentação e regras de gameplay.
