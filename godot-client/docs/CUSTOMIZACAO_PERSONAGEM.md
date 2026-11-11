# Abyssal Godot | Guia de personagem modular

## Objetivo e inspiracao
Arquitetura do tipo **paper doll / vanity slots**, semelhante a sistemas de vestimentas cosmeticas de jogos como Terraria. Aparencia independente de habilidades, atributos e progressao. A configuracao do jogador e o ponto de verdade compartilhado entre os dois enquadramentos: na cabine (ilustracao em camadas de alta resolucao) e no Mar Aberto (pose animada de nado).

## Arquivos e dependencias

| Arquivo | Responsabilidade |
| --- | --- |
| `scripts/diver_appearance.gd` | IDs, defaults, whitelist, rotulo e paleta dos seis slots |
| `scripts/exploration_progress.gd` | Persistencia local e migracao de saves antigos |
| `scripts/diver_paper_doll.gd` | Ordem de camadas, pintura da cabine, cabelo e ferramentas do nado |
| `scripts/diver_native.gd` | Rig de nado, traje e viseira conforme look, fisica **inalterada** |
| `scripts/native_cabin_art.gd` | Cabine com mergulhador/a reais usando o look salvo |
| `scripts/wardrobe_ui.gd` | Interface de personalizacao, cores e areas clicaveis |
| `scripts/abyssal_main.gd` | Eventos de teclado/mouse, atualizacao imediata e HUD da cabine |
| `scripts/ocean_expedition.gd` | Injeta os mesmos cosmeticos no personagem quando entra no mar |
| `assets/art/character/cabin_layer_*.svg` | Arte vetorial separada do corpo, rosto, cabelos, traje, equipamento e mascara |

## Modelo de dados

Os cosmeticos sao **somente locais** dentro de `user://abyssal_native_exploration_v1.json`, na chave `appearance`:

```json
{
  "body": "female",
  "hair": "long",
  "hair_color": "copper",
  "suit": "abyss",
  "mask": "aqua",
  "handheld": "scanner"
}
```

- `body`: `female` ou `male`, **sem diferencia de hitbox ou estatisticas**.
- `hair`: `long`, `short`, `tied`, independentemente do corpo.
- `hair_color`: `copper`, `black`, `brown`, `silver`.
- `suit`: `abyss`, `tide`, `ember`.
- `mask`: `aqua`, `amber`.
- `handheld`: `scanner`, `cutter`, `none`. Nao adiciona ataques, dano ou recompensas.

O arquivo antigo continua na versao 1. Saves anteriores sem `appearance` recebem os defaults. IDs desconhecidos ou alterados manualmente sao saneados com `Look.normalize()`, e so o conjunto aprovado e carregado.

## Como o usuario altera o personagem

Na cabine, pressione **C** ou clique em **PERSONAGEM [C]**. A personagem continua visivel na esquerda como preview real. Use **setas para cima/baixo** para navegar pelas categorias e **esquerda/direita** para trocar a opcao. Os numeros **1 a 6** selecionam categorias. Clique nas setas das linhas para trocar o valor. **C / Esc / X** fecha o guarda-roupa.

Cada troca salva automaticamente via `progress.cycle_appearance(...)`. A propria instancia `ExpedicaoOceanica/Mergulhador` recebe o novo look via `set_appearance(...)`. Entrar no Mar Aberto aplica novamente o snapshot da cabine.

## Ordem de renderizacao da cabine

Todos os SVGs foram derivados de partes isoladas e mantem o mesmo `viewBox=520x670`, garantindo que as juntas continuem alinhadas:

1. Cabelo traseiro (separado por penteado)
2. Poltrona/cadeira e cilindro
3. Trapezio/peito do traje (com cor selecionada)
4. Rosto feminino ou masculino (assets distintos, mesma referencia espacial)
5. Cabelo frontal
6. Mascara de mergulho (paleta da viseira)
7. Braco com pulseira e equipamento de mao separado

O arquivo antigo `assets/art/cabin_navigator.svg` permanece apenas como arte de referencia legada; **nao e mais utilizado para montar o personagem da cabine**.

## Como adicionar novos cosmeticos

1. Adicione um ID **imutavel** a `diver_appearance.gd` em `OPTIONS[slot]`. O ID deve ser curto e sem espacos, com rotulo em `CHOICE_LABELS`.
2. Para novas cores, adicione `SUIT_TINTS`/`SUIT_BASE`/`SUIT_ACCENT` ou `HAIR_TINTS` conforme o slot.
3. Para um novo corte, desenhe `cabin_layer_hair_back_<id>.svg` e `cabin_layer_hair_front_<id>.svg` no **mesmo viewBox 520x670** e inclua-os no renderer `diver_paper_doll.gd`.
4. Atualize a ramificacao `draw_swimmer_hair` com o mesmo ID, os mesmos encaixes de nuca e a animacao correspondente ao cabelo na cabine.
5. Para uma nova ferramenta visual de mao, ancore-a aos pontos previstos (cabine perto da luva, nado `Vector2(39,8)`), mantendo o renderer de combate desconectado ate a criacao da habilidade real.
6. Adicione fixture de save/capture em `ci_functional_smoke.gd` e `ci_capture.gd`. Confirme animação e renderizacao sem `SCRIPT ERROR` e capture ambas as variantes.

## Restricoes de arte, escala e desempenho

- Um unico rig e hitbox no nado: fisica, movimento, oxigenio, pressao e tamanho de colisao NAO dependem de cosmetics.
- Evitar carregar todas as opcoes possiveis como variacoes de sprites completos. As mesmas camadas de imagem/preload devem ser reutilizadas.
- Nao renderizar mockups ou imagens de referencia completas como cenario.
- Nao informar um cosmetico como recurso pago sem implementacao real; enquanto a integracao com a loja nao existir, as opcoes sao locais e disponiveis sem compra.
- Um SVG individual pode ser substituido por uma imagem raster, spritesheet ou node de animacao preservando seu slot e os mesmos pontos de encaixe.
- Antes de lancamento, medir custo das camadas, verificar FPS no Android, tratar interface mobile/toque e animacoes detalhadas com sprites externos quando necessario.
