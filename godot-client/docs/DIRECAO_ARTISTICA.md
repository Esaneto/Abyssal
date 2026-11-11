# ABYSSAL | Direcao de arte e ecossistema do cliente Godot

Estado: especificacao aprovada para a nova linha de exploracao oceanica. Esta etapa NAO altera os modos de combate, Fossas ou cliente web existentes.

## Premissas irrevogaveis para esta etapa
1. A cabine e o modo Mar Aberto sao o foco. Shooter, PVP e Fossas estao fora de escopo ate o mundo de exploracao atingir qualidade visual e tecnica.
2. Arte 2D com acabamento 2.5D quase realista, horror ambiental e beleza biologica. A atmosfera deve causar respeito a escala, desconhecido e silencio, nunca parecer um parque de monstros.
3. Cada criatura ilustrada tem sua MAIOR dimensao visual >= 40% do comprimento do mergulhador (no codigo `DIVER_LENGTH_PX=104`, minimo 41.6). Espécies naturalmente maiores podem superar, e superar muito, o tamanho do mergulhador. Este limite e uma convencao de legibilidade ludica, nao uma afirmacao biologica de escala.
4. Fauna inspirada em animais reais, com silhuetas, olhos, barbatanas, bioluminescencia e gestos distinguiveis. Alteracoes de anatomia para clareza sao exageros artisticos explicitos.
5. Bioma e profundidade precisam afetar fauna, plantas, cor da agua, luz natural e ambiente.
6. Movimento organico obrigatorio: diver, flutuacao das plantas, correntes, sedimentos, bolhas, luz e fauna.
7. Observacao e descoberta, nao abate. Cada criatura tem nome popular e cientifico, habitat, comportamento, historia e modo de encontro.
8. Separar fisica/colisao da renderizacao. Objetivo de desempenho: 60 FPS em hardware-alvo, a ser medido, e nao presumido.

## Zonas ecologicas
As faixas reais abaixo servem de referencia cientifica, e nao de escala de sprites:
- Epipelagica: 0 a ~200 m; fotossintese, rayos solares, plancton, habitats rasos
- Mesopelagica: ~200 a 1.000 m; crepusculo, peixes com fotoforos, predadores de emboscada
- Batipelagica: ~1.000 a 4.000 m; sem luz solar

O prototipo permite ate ~1.400 m simulados em 14.000 unidades de mapa (10 unidades por metro); luz da superficie reduzida exponencialmente, com iluminacao artificial e bioluminescencia.

## Primeiras especies e encontros
| Especie | Nome cientifico | Faixa de encontro no jogo (m) | Como encontrar |
|---|---|---:|---|
| Raia-manta-oceanica | Mobula birostris | 0-250 | Aguarde na coluna de agua iluminada, longe de rochas |
| Tartaruga-verde | Chelonia mydas | 0-180 | Explore o talude e as algas rasas |
| Medusa-luminosa | Pelagia noctiluca | 0-900 | Acompanhe correntes de agua aberta |
| Peixe-remo | Regalecus glesne | 200-1.000 | Observe silhuetas verticais/longas no crepusculo |
| Peixe-vibora | Chauliodus sloani | 300-1.250 | Busque pontos de luz no ventre na penumbra |
| Lula-vampira | Vampyroteuthis infernalis | 600-1.100 | Encontre a zona de pouca luz e movimento lento |
| Tamboril-abissal | Melanocetus johnsonii | 750-1.400 | Procure uma isca luminosa solitaria |
| Isopode-gigante | Bathynomus giganteus | 220-1.400 | Inspecione o fundo e as encostas profundas |

**Importante:** faixas acima sao recortes de encontro DE JOGO, nao os limites biogeograficos completos das especies. O comportamento e a arte evoluirao com referencias zoologicas.

## Implementacao atual
- `scripts/abyssal_main.gd`: cena da cabine, ponte submarina e interface para iniciar a exploracao
- `scripts/ocean_expedition.gd`: camera, relevo, colisao, luz dia/noite, fauna distribuida por setores, diario
- `scripts/diver_native.gd`: mergulho com passo fixo, inercia, arrasto, flutuabilidade, correntes, oxigenio
- `scripts/marine_ecology.gd`: catalogo de especies, escala minima, arte procedural e animacoes
- `scripts/ci_smoke.gd`: validacao automatica no Godot

## Limitacoes atuais e proximos marcos
- A arte de criaturas/cabine ainda e procedural e nao equivale a acabamentos ilustrados quase fotograficos; requer assets, texturas, sombras de material e animacoes mais sofisticadas.
- O mapa tem uma plataforma continental e rochas grandes, mas ainda necessita sistemas de cavernas, galerias e zonas geologicas detalhadas.
- Fauna tem nado deterministicamente animado, mas ainda nao tem ecologia simulada completa nem avoidance fisico contra cavernas.
- Diario ainda nao persiste na conta PostgreSQL, apenas na sessao Godot.
- Controles nativos Android, otimizacao medida em dispositivos, multiplayer e exports serao fases posteriores.

## Fontes biológicas de referencia
- NOAA zonas e luz: https://oceanexplorer.noaa.gov/ocean-fact/light-distributed/
- NOAA isopodes: https://oceanexplorer.noaa.gov/ocean-fact/isopod/
- MBARI lula-vampira: https://www.mbari.org/animal/vampire-squid/
- Smithsonian Ocean: https://ocean.si.edu/

## Revisao visual implementada (2026-11-11)
A referencia ambiental e da cabine foi traduzida para cenas dinamicas Godot, nao capturas de tela fixas. Recifes, texturas, causticas, interface, corpo e luzes sao renderizados e animados separadamente.
Loja e Fossas continuam na versao web. A progressao solo e as funcoes de laboratorio e exploracao mantem-se operacionais sem alterar multiplayer ou servidor.
Auditoria: native_cabin_art.gd, native_reef_art.gd, native_ocean_hud.gd, ui_art_primitives.gd, assets/art/cabin_navigator.svg e as capturas reais do workflow Godot Native Client Smoke.
