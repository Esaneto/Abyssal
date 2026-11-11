# Abyssal | Exploracao Oceanica em Godot 4

> Cliente nativo em desenvolvimento, independente da versao JavaScript. O jogo original e o backend Node.js/PostgreSQL continuam preservados.

## Abrir no Godot 4.7.2 (Windows)
1. Baixe o repositorio na branch `feat/godot-client-foundation-20261111`.
2. No Gerenciador de Projetos do Godot, escolha **Importar** e selecione `godot-client/project.godot`.
3. Pressione **F5**.

## Controles
- **Enter:** deixar a cabine e iniciar a expedicao oceanica.
- **WASD / setas:** nadar; soltar o controle permite sentir inercia e flutuabilidade.
- **F:** registrar a criatura real mais proxima no diario de campo.
- **Tab:** abrir/fechar o diario de campo e consultar a ultima descoberta.
- **Esc:** retornar a cabine.
- **Oxigenio:** retorna ao subir ate a superficie; esgota gradualmente quando submerso.

## O que esta implementado
- **Cabine** animada com instrumentos de sonar, iluminacao e ciclo de dia/noite de aproximadamente 7 minutos.
- **Mar Aberto:** mundo de 24.000 x 14.000 *unidades de jogo*, geografia continental, plataformas e rochas colidiveis, carregamento visual por regiao ao redor da camera.
- **Mergulhador:** `CharacterBody2D` com hitbox, `move_and_slide`, aceleracao, resistencia da agua, flutuabilidade, correntes leves, animacao corporal, oxigenio e dano por falta de oxigenio.
- **Fauna:** 8 especies derivadas de animais reais, paletas e silhuetas proprias, animacao individual, localizacao influenciada pela profundidade e distancia ao fundo.
- **Escala:** nenhuma criatura desenhada tem comprimento visual principal menor que 40% do mergulhador.
- **Ambiente:** iluminacao dependente da profundidade, superficie ondulada, algas rasas, sedimento suspenso, penumbra e iluminacao da roupa de mergulho.
- **Descobertas:** registros de fauna pelo jogador e metadados biologicos no diario, atualmente salvos apenas durante a sessao.

## O que esta fora desta etapa
Shooter, Fossas, loja, servidores multiplayer, integracao com banco, inventario persistente, exportacoes Android e assets de acabamento artistico ainda nao foram migrados. A arte procedural nao e a referencia final de realismo.

## Desenvolvimento/qualidade
O workflow `.github/workflows/godot-native-smoke.yml` baixa Godot 4.7.2 e valida importacao de scripts, inicializacao e nado. Tambem tenta gravar capturas reais da cabine e de zonas do oceano com Xvfb. `scripts/ci_smoke.gd` exige a escala minima de toda a fauna catalogada.

Diretrizes de arte e biologia em [docs/DIRECAO_ARTISTICA.md](docs/DIRECAO_ARTISTICA.md).
