# Scorecard: DANFE PDF → CSV estruturado (lote, no navegador)

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-02 (PT). Lote 2026-10-02.

Ideia: o seller/contador solta vários PDFs de DANFE (NF-e impressa) e recebe CSV com chave, CNPJ, totais, impostos e itens. Diferente de `nfe-xml-lote` (XML).

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Reprova** | ChatGPT com upload de PDF já extrai chave, totais e itens de DANFE digital com boa qualidade. r/brdev recomenda LLM multimodal para PDF fiscal (https://www.reddit.com/r/brdev/comments/1vfaaow/). Parser determinístico de layout DANFE quebra entre emissores; a fonte de verdade é o XML (já coberto em `nfe-xml-lote`). Estimo ≥80% no chat. |
| 2 | O que falta à IA | Passa | Arquivo do usuário (PDF). |
| 3 | Dor real | Fraca | Quem tem o PDF quase sempre tem (ou pode baixar) o XML. Threads recentes pedem download de XML/DANFSe, não conversão PDF→CSV (https://www.reddit.com/r/ContabilidadeAtual/comments/1u1jx70/). |
| 4 | Prova de interesse | Fraca | Buscas e fóruns apontam para XML/API DANFSe, não "DANFE PDF planilha". |
| 5 | Dado legítimo | Passa | PDF do próprio usuário. |

## Notas
Não pontuada: reprovou no gate 1.

## Decisão
**MORTA no gate 1.** Preferir XML (`nfe-xml-lote`) se reavaliar.
