# Scorecard: Legenda automática de vídeo no navegador (Whisper/WASM) para criadores

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-01 (PT). Lote 2026-10-01-b.

Ideia: o criador solta o vídeo e recebe a legenda em PT-BR (SRT) e o vídeo com a legenda gravada, com Whisper e ffmpeg.wasm 100% local (mesma base técnica provada no Cortaí).

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | Passa | O chat não grava legenda dentro do vídeo. |
| 2 | O que falta à IA | Passa | Processa o arquivo do usuário. |
| 3 | Dor real | **Passa (fraca)** | A dor existe, mas hoje se resolve com o CapCut ou o Canva grátis, e com geradores locais grátis. |
| 4 | Prova de interesse | Passa | Autocomplete forte: "legenda automática grátis", "... online", "... video", "... capcut", "... sem marca d'água", "gerar legenda automatica gratis". |
| 5 | Dado legítimo | Passa | É o arquivo do próprio usuário. |

**Existe grátis?** Sim, vários, e já 100% no navegador: Whisper Web (grátis até 200 MB/20 min: https://whisperweb.dev/pt-BR), SubtitleKit (grátis até 2 GB, sem marca d'água: https://subtitlekit.com/pt/generate-subtitles/), Golber Dória (sem limite: https://golber.net/ferramentas/transcrever-audio), VidClean (grava a legenda no vídeo: https://vidclean.net/pt-br/add-subtitles).

## Notas

| # | Critério | Nota | Por quê |
|---|----------|------|---------|
| 6 | Frequência | **2** | Criadores postam toda semana. |
| 7 | Fosso | **0** | Commodity: o mesmo modelo aberto em quatro sites grátis e no CapCut. |
| 8 | Distribuição | **0** | A página de resultados tem CapCut, Canva e os sites acima. |
| 9 | Caminho para pagamento | **0** | Grátis em todo lugar. |
| 10 | Custo de manutenção | **1** | Modelos de 40 a 560 MB e WebGPU instável em celular; suporte caro. |
| 11 | Métrica de 14 dias | **3** | ≥ 100 vídeos legendados e ≥ 2 PIX. |

**Total: 6/18.**

## Decisão
**REPROVA (6 < 11).** Esta lacuna já está fechada por ferramentas grátis.
