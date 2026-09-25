from openpyxl.comments import Comment
from formulas import faixa_of, k_of, price_fx, r_of
from styles import (
    MONEY, PCT, NUM2, box_thin, center, fill_aux, font_aux, font_aux_h,
    left_c, locked, put, right_c, style_merge,
)

def _aux_cells(ws):
    style_merge(ws, "N5:P5",
                "CELULAS AUXILIARES — nao editar (a Calculadora so le; documentacao na aba Como usar)",
                font_aux_h, fill_aux, left_c)
    put(ws, "N6", "Papel", font_aux_h, fill_aux, left_c)
    put(ws, "O6", "Valor / formula", font_aux_h, fill_aux, center)
    put(ws, "P6", "O que e", font_aux_h, fill_aux, left_c)
    aux = [
        (8, "BASE (custo total)", '=C7+C8+IF(C10="voce",C9,0)', MONEY,
         "Produto + embalagem + frete se voce paga. Entrada de todas as contas."),
        (9, "Modo e Margem %?", '=C12="Margem %"', None, "VERDADEIRO usa margem; FALSO usa lucro R$."),
        (10, "t  (imposto)", "=C11", PCT, "Aliquota sobre o preco de venda."),
        (11, "m  (margem usada)", "=IF(O9,C13,0)", PCT, "Zero no modo Lucro R$."),
        (12, "L  (lucro alvo usado)", "=IF(O9,0,C14)", MONEY, "Zero no modo Margem %."),
        (13, "Marketplace", "=C15", None, "Copia para leitura das faixas."),
        (14, "r ML (classico ou premium)",
         '=IF(C15="ML Classico",ML_Classico_pct,IF(C15="ML Premium",ML_Premium_pct,0))', PCT,
         "Comissao percentual do ML, sem a parcela fixa."),
        (15, "extra Amazon",
         '=IF(C15="Amazon Individual",AMZ_IndExtra,IF(C15="Amazon Professional",AMZ_ProExtra,0))', MONEY,
         "R$ por item do plano Amazon."),
        (17, "denom margem sem r  (1-t-m)", "=1-O10-O11", NUM2, "Denominador antes de descontar a comissao %."),
        (18, "denom lucro sem r  (1-t)", "=1-O10", NUM2, "Denominador do modo Lucro R$ antes da comissao."),
        (20, "ML candidato alto (sem fixa)", price_fx("O14", "0"), MONEY,
         "Passo 1 / faixa P >= ML_SemFixaDe. Tambem e o preco-teste do ML."),
        (21, "ML candidato meio (fixa R$)", price_fx("O14", "ML_FixaMeio"), MONEY,
         "Faixa ML_FaixaBaixa <= P < ML_SemFixaDe."),
        (22, "ML candidato baixo (fixa %)", price_fx("O14+ML_FixaPctBaixa", "0"), MONEY,
         "Faixa P < ML_FaixaBaixa (50% do preco + comissao)."),
        (23, "ML S consistente",
         "=IFS(O20>=ML_SemFixaDe,O20,AND(O21>=ML_FaixaBaixa,O21<ML_SemFixaDe),O21,O22<ML_FaixaBaixa,O22,O21<ML_FaixaBaixa,ML_FaixaBaixa,TRUE,ML_SemFixaDe)",
         MONEY, "Fica com o candidato cuja propria faixa contem o preco. Evita oscilar no corte de R$ 79."),
        (25, "Shopee P1 (< lim1)", price_fx("SH_Pct1", "SH_Fix1"), MONEY, "Faixa baixa Shopee."),
        (26, "Shopee P2 (lim1-lim2)", price_fx("SH_Pct2", "SH_Fix2"), MONEY, "Segunda faixa Shopee."),
        (27, "Shopee P3 (lim2-lim3)", price_fx("SH_Pct3", "SH_Fix3"), MONEY, "Terceira faixa — tambem e o preco-teste tipico."),
        (28, "Shopee P4 (>= lim3)", price_fx("SH_Pct4", "SH_Fix4"), MONEY, "Faixa alta Shopee."),
        (29, "Shopee S consistente",
         "=IFS(O28>=SH_Lim3,O28,AND(O27>=SH_Lim2,O27<SH_Lim3),O27,AND(O26>=SH_Lim1,O26<SH_Lim2),O26,O25<SH_Lim1,O25,O27>=SH_Lim3,SH_Lim3,O26>=SH_Lim2,SH_Lim2,TRUE,SH_Lim1)",
         MONEY, "Mesma logica de consistencia, quatro faixas."),
        (31, "Amazon P normal (% + extra)", price_fx("AMZ_Pct", "O15"), MONEY, "Assume referral % acima do minimo."),
        (32, "Amazon P com referral minimo", price_fx("0", "AMZ_Min+O15"), MONEY, "Usa quando % x preco < minimo."),
        (33, "Amazon S", "=IF(AMZ_Pct*O31>=AMZ_Min,O31,O32)", MONEY, "Escolhe o ramo consistente com o minimo de referral."),
        (35, "Magalu S", price_fx("MAGALU_Pct", "0"), MONEY, "So percentual (estimativa da aba Taxas)."),
        (36, "Venda direta S", price_fx("DIRETA_Pct", "0"), MONEY, "Sem comissao de marketplace."),
        (38, "S teste (sem fixa / faixa tipica)",
         '=SWITCH(C15,"ML Classico",O20,"ML Premium",O20,"Shopee",O27,"Amazon Individual",O31,"Amazon Professional",O31,"Magalu",O35,"Venda direta",O36,NA())',
         MONEY, "Preco-teste documentado: ML sem fixa, Shopee faixa 3, Amazon % + extra. Nao e o resultado final."),
        (40, "S FINAL",
         '=SWITCH(C15,"ML Classico",O23,"ML Premium",O23,"Shopee",O29,"Amazon Individual",O33,"Amazon Professional",O33,"Magalu",O35,"Venda direta",O36,NA())',
         MONEY, "Preco de venda publicado a esquerda. Candidato consistente — nao iteracao cega."),
        (41, "r aplicado", r_of("$O$40"), PCT, "Percentual da faixa do S final (rele a aba Taxas)."),
        (42, "k aplicado", k_of("$O$40"), MONEY, "Parcela fixa da faixa do S final."),
        (43, "Taxa em R$", "=O40*O41+O42", MONEY, "r x S + k. Amazon minimo entra via r=0 e k=min+extra."),
        (44, "Imposto em R$", "=O40*O10", MONEY, "t x S."),
        (45, "Lucro liquido", "=O40-O43-O44-O8", MONEY, "S - taxa - imposto - BASE."),
        (46, "Margem efetiva", "=IF(O40=0,0,O45/O40)", PCT, "Lucro / S."),
        (47, "Frete considerado", '=IF(C10="voce",C9,0)', MONEY, "Espelha a regra de quem paga."),
        (48, "Rotulo da faixa", faixa_of("$O$40"), None, "Texto da faixa para a area de resultados."),
        (50, "P praticado (reverso)", "=C24", MONEY, "Preco informado em Se vender a R$ X."),
        (51, "r reverso", r_of("$O$50"), PCT, "Faixa relida a partir do preco praticado."),
        (52, "k reverso", k_of("$O$50"), MONEY, "Fixa da faixa do preco praticado."),
        (53, "Taxa reversa R$", "=O50*O51+O52", MONEY, "Quanto o marketplace leva nesse preco."),
        (54, "Imposto reverso R$", "=O50*O10", MONEY, "t x preco praticado."),
        (55, "Lucro reverso", "=O50-O53-O54-O8", MONEY, "O que sobra se vender a P."),
        (56, "Margem reversa", "=IF(O50=0,0,O55/O50)", PCT, "Lucro reverso / P."),
        (57, "Rotulo faixa reversa", faixa_of("$O$50"), None, "Faixa correspondente ao preco praticado."),
    ]
    for r, label, formula, fmt, note in aux:
        put(ws, "N{0}".format(r), label, font_aux, fill_aux, left_c, border=box_thin)
        if isinstance(formula, str) and formula and not formula.startswith("="):
            formula = "=" + formula
        cell = put(ws, "O{0}".format(r), formula, font_aux, fill_aux,
                   right_c if fmt else left_c, fmt=fmt, prot=locked, border=box_thin)
        put(ws, "P{0}".format(r), note, font_aux, fill_aux, left_c, border=box_thin)
        if r in (20, 23, 38, 40):
            cell.comment = Comment(note, "Precifica")
            cell.comment.width = 280
            cell.comment.height = 80
