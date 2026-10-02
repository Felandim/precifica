# Scorecard: Validador de estrutura SPED (EFD/ECD) no navegador

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-02 (PT). Lote 2026-10-02.

Ideia: soltar TXT SPED e ver erros de layout (campos por registro, blocos) sem instalar o PVA.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | Passa (fraca) | ChatGPT não valida layout oficial completo com segurança. |
| 2 | O que falta à IA | Passa | Arquivo do usuário. |
| 3 | Dor real | **Reprova (na prática)** | O caminho correto é o PVA oficial da Receita (gratuito). Calima e outros mandam o usuário ao PVA (https://ajuda.calimaerp.com/pt/article/como-validar-o-arquivo-sped-ecd-qswfg3/). Um checker incompleto no browser gera falsa segurança. Já existe open-source client-side maduro (https://github.com/jobasfernandes/analise-sped-fiscal-efd-icms-ipi). |
| 4 | Prova de interesse | Fraca para "alternativa ao PVA"; a demanda é cumprir obrigação com o validador oficial. |
| 5 | Dado legítimo | Passa | Arquivo do contribuinte + leiautes públicos. |

## Notas
Não pontuada: gate 3 (PVA oficial + OSS existente).

## Decisão
**MORTA no gate 3.**
