# Scorecard: Boletos (linha digitável / PDF texto) → planilha com validação Febraban

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-02 (PT). Lote 2026-10-02.

Ideia: lote de boletos (PDF com texto selecionável, ou colagem/TXT com linhas digitáveis de 47 dígitos). A página valida DV (mod 10/11 Febraban), decodifica banco, fator de vencimento, valor em centavos e exporta CSV. 100% no navegador; sem OCR de imagem.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Passa (fraca)** | Em 1 PDF, ChatGPT/OCR lê vencimento e valor. Em lote (50+) o plano grátis limita uploads; DV Febraban e fator→data (base 07/10/1997, com a regra do fator ≥1000 pós-2025) o chat erra com frequência. ImageToTable vende exatamente a extração visual com IA (https://imagetotable.ai/blog/extract-brazil-boleto-bancario-excel, 2026-09-11). Um decoder determinístico + batch local entrega o que o chat não escala. Estimo ~55–70% no chat, não 80% em lote. |
| 2 | O que falta à IA | **Passa** | Processa os arquivos/linhas do usuário; regras Febraban públicas aplicadas localmente. |
| 3 | Dor real | **Passa** | Financeiro digita linha digitável, vencimento e valor à mão para conciliar. ImageToTable descreve o gargalo ("manual typing, copy-pasting") e cita ~37 bi de boletos/ano. Crow Docs e Dynadok também vendem leitura/validação de boleto. |
| 4 | Prova de interesse | **Passa** | Concorrentes pagos/IA: ImageToTable (batch→Excel), Crow Docs, Dynadok (validação com IA: https://blog.dynadok.com/validacao-de-boleto-bancario-com-ia/). LinkedIn com automação de leitura de boletos (Python). Não é hunch: há produto cobrando. |
| 5 | Dado legítimo | **Passa** | Arquivo do usuário + layout Febraban público. Sem login. Escopo v1: PDF texto / TXT (sem OCR de scan — escaneado fica fora de propósito). |

**Existe grátis?** Conversores genéricos de PDF→Excel bagunçam layout. Não achei decoder Febraban em lote, grátis, 100% no navegador, focado em seller/MEI. Validador de 1 linha digitável existe em vários sites; o diferencial é lote + CSV + DV.

## Notas

| # | Critério | Nota | Por quê |
|---|----------|------|---------|
| 6 | Frequência | **2** | Semanal/mensal no contas a pagar. Contador pode ser diário (3), seller típico do Precifica é 2. |
| 7 | Fosso | **1** | Regras Febraban são públicas; histórico local de boletos pagos ajuda pouco. Código copiável. |
| 8 | Distribuição | **1** | SEO "extrair linha digitável" / "boleto PDF Excel" existe, mas Crow/ImageToTable e geradores de boleto dominam. Precifica é conhecido por precificação ML, não AP. |
| 9 | Caminho para pagamento | **1** | Evita erro de digitação; acha DV inválido. Menos "achei dinheiro" que o conferidor de repasse. PIX por gratidão é fraco. |
| 10 | Custo de manutenção | **2** | Decoder da linha é estável; parser de PDF texto varia por banco (posição do texto). Sem OCR = menos quebra. |
| 11 | Métrica de 14 dias | **3** | Abaixo. |

**Total: 10/18.** Gates: 5/5 (gate 1 fraco).

## Métrica de morte (se construída)
Em 14 dias: ≥ 80 page views em `/boleto-linha-digitavel.html` **e** ≥ 1 PIX/mensagem citando a ferramenta. Senão, tirar do ar.

## Decisão
**REPROVA na régua 13.** Na régua 11 também fica abaixo (10). Não construir neste lote, a menos que nenhuma outra ≥11 e esta seja a melhor — não é.
