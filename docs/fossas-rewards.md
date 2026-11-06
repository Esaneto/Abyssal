# Fossas: catálogo, arte e recompensas

A expansão contém 42 espécies: nove anteriores redesenhadas e 33 adicionais (três por família biológica). `public/marine-art.js` desenha a anatomia; nenhuma delas chama o desenho de outra skin por ID. As habilidades e os preços ficam em `public/abyssal-curated-skins.js`, compartilhado pelo cliente e servidor.

O baú fica na caverna do boss após sua derrota. Cada conta recebe uma recompensa por boss/camada/expedição. `rift-rewards.js` usa a aleatoriedade criptográfica do servidor: 3% de chance de uma skin por moedas ainda não possuída e 97% distribuídos igualmente entre 300, 500, 700, 900, 1000 e 1200 moedas. Coleção completa converte o resultado para moedas. Skins pagas, promocionais e de missão não entram no sorteio. Reabrir o mesmo baú retorna o resultado anterior sem creditar novamente.

A abertura exige conexão e conta. Nas salas online, o servidor observa a derrota. Nas Fossas locais, a elegibilidade usa o relatório de progresso do cliente, como o sistema de partidas locais já existente: isso não constitui validação autoritativa do combate offline. Sorteio e crédito são sempre executados no servidor. A durabilidade segue a persistência configurada no servidor (PostgreSQL ou arquivos locais).

Validação: sete bosses em ordem, sem reaparecimento na mesma camada, entrada do ciclo seguinte, catálogo elegível, probabilidades, repetição de pedidos e geometria distinta das 42 espécies. O navegador foi usado para verificar carregamento e renderização; isso não substitui uma partida completa de balanceamento.
