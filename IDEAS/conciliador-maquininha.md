# Scorecard: Conciliador de maquininha (vendas no cartão × recebimentos) para comércio pequeno

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-01 (PT). Lote 2026-10-01-b.

Ideia: o lojista físico ou MEI solta o relatório de vendas e o de recebimentos da maquininha (Stone, PagBank, Cielo, Rede) e a página aponta parcelas não pagas e taxa diferente da contratada.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | Passa (fraca) | Mesmo raciocínio do conferidor do ML: o join é fácil num prompt, mas as regras de parcelas e antecipação não são. |
| 2 | O que falta à IA | Passa | Arquivos do usuário. |
| 3 | Dor real | **Fraca** | As próprias adquirentes já entregam conciliação grátis: a Stone com o Raio-X e a Conciliação (https://www.stone.com.br/conta-pj/raio-x, https://conciliacao.stone.com.br/docs/bem-vindo-a-concilia%C3%A7%C3%A3o), e o PagBank reúne vendas de Stone e Rede no mesmo relatório (https://brasilmaquininhas.com.br/financas-e-gestao/pagbank-reune-vendas-de-stone-e-rede-no-mesmo-relatorio-quando-centralizar-os-recebiveis-evita-erro.html). |
| 4 | Prova de interesse | Fraca | O autocomplete de "conciliação maquininha" só devolve o próprio termo. |
| 5 | Dado legítimo | **Reprova (formato)** | Cada adquirente tem um export próprio, sem dicionário público de colunas (só a Stone documenta, via API/XML). Construir sem amostra real seria inventar colunas, o que é proibido. |

## Notas
Não pontuada: reprovou no gate 5 e é fraca nos gates 3 e 4. Estimativa indicativa: ~7/18.

## Decisão
**MORTA no gate 5.**
