# Scorecard: Comprovantes PIX (PDF/imagem) para planilha, no navegador

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-01 (PT). Lote 2026-10-01-b.

Ideia: o MEI solta 50 comprovantes PIX (PDF) e recebe uma planilha com data, valor, pagador e ID E2E, para mandar ao contador ou dar baixa nos pedidos.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Reprova** | Ler comprovante é tarefa de visão que o ChatGPT faz bem com upload. Os vendedores de automação já vendem exatamente isso com IA (Structura: https://structura.com.br/casos-de-uso/financeiro/comprovante-de-pagamento; tutorial n8n + IA: https://www.negocionoautomaticobr.com.br/blog/automatize/ler-comprovante-pix-whatsapp-dar-baixa-automatica-n8n-ia-passo-a-passo). Um parser determinístico precisaria cobrir dezenas de layouts de banco, sem amostra pública oficial. |
| 2 | O que falta à IA | Passa | Arquivo do usuário. |
| 3 | Dor real | Passa (fraca) | Existe para quem recebe PIX por WhatsApp, mas o extrato do banco já lista os PIX recebidos. |
| 4 | Prova de interesse | **Fraca** | "comprovante pix planilha" não tem nenhuma sugestão no autocomplete (medido em 2026-10-01). |
| 5 | Dado legítimo | Passa | Arquivos do usuário. |

**Existe grátis?** Os conversores genéricos de PDF para Excel (iLovePDF, Smallpdf) cobrem parte disso.

## Notas
Não pontuada: reprovou no gate 1 (e o gate 4 é fraco). Estimativa indicativa: ~5/18.

## Decisão
**MORTA no gate 1.**
