# Scorecard: Devoluções — taxa e custo residual por SKU

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-03 (PT). Lote 2026-10-03.

Ideia: CSV de vendas + CSV de devoluções → taxa de devolução e custo residual por SKU.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Passa (fraca)** | Pivot simples em planilha pequena; falha em custo residual (frete + tarifa não estornada). ~55%. |
| 2 | O que falta à IA | **Passa** | Arquivos do usuário. |
| 3 | Dor real | **Passa** | Jaguar Sheet / Anymarket falam de monitorar devoluções ML; sellers acompanham % (limite ~8% em 6 meses em alguns blogs). |
| 4 | Prova de interesse | **Passa (fraca)** | Conteúdo de blog; poucos concorrentes grátis dedicados a "custo residual por SKU" no browser. |
| 5 | Dado legítimo | **FALHA** | Não achei documentação **oficial pública** das colunas do export de devoluções do ML (só menções em Jaguar Sheet / Anymarket). Sem colunas estáveis documentadas, a ferramenta adivinharia ou quebraria — viola "sem inventar". |

## Decisão
**MORTA no gate 5.** Reabrir só se ML publicar glossário oficial do export de devoluções (ou o seller usar CSV genérico com mapeamento obrigatório + FAQ explícito — ainda arriscado para v1).
