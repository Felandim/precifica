from openpyxl.styles import Alignment
from openpyxl.utils import get_column_letter
from math_engine import brl, pct_br
from styles import (
    MONEY, PCT, box, box_thin, center, fill_dark, fill_gold_pale, fill_mid,
    fill_range, fill_result, fill_soft, fill_white, font_body, font_h,
    font_label, font_muted, font_out, font_small, header_block, left_c,
    left_t, locked, page_setup, put, right_c, style_merge, yellow_input,
    border_range,
)

def build_como_usar(wb):
    ws = wb.create_sheet("Como usar", 2)
    ws.sheet_properties.tabColor = "5C6B73"
    for col, w in {"A": 8, "B": 118, "C": 20}.items():
        ws.column_dimensions[col].width = w
    header_block(ws, "C", "Como usar a planilha em 1 minuto — e nao quebrar as formulas")
    page_setup(ws, "A1:C20", landscape=True, freeze="A6")
    lines = [
        "1. Abra a aba Calculadora e preencha so as celulas amarelas: custo do produto, embalagem, frete e imposto %.",
        "2. Em Quem paga o frete, escolha voce (o valor entra no custo) ou cliente (fica de fora do preco de venda).",
        "3. Escolha o modo: Margem % (lucro como fatia do preco) ou Lucro R$ (quanto voce quer ganhar em reais por unidade).",
        "4. Selecione o marketplace no menu. As taxas vem da aba Taxas — nao estao cravadas nas formulas da Calculadora.",
        "5. Leia o preco de venda a direita. Taxa em R$, imposto, frete considerado, margem efetiva e o breakdown acompanham.",
        "6. Quer testar um preco que voce ja pratica? Preencha Se vender a R$ X, quanto sobra. Nao e preciso inverter a formula.",
        "7. Para atualizar uma comissao ou faixa, edite as celulas amarelas da aba Taxas. Nao mexa nas colunas N-P da Calculadora (auxiliares: preco-teste e candidatos por faixa).",
        "8. Copie o texto de breakdown e cole nos grupos de sellers ou no WhatsApp. PIX e separado: esta planilha nao cobra nem gera QR; use sua chave se for receber fora do marketplace.",
        "9. Confira o numero no simulador oficial do Mercado Livre (link no topo) e no Seller Center / painel dos outros canais antes de publicar o anuncio.",
        "10. A aba Calculadora esta protegida para nao apagar formula. Senha: precifica. Celulas amarelas continuam liberadas; deixe a senha vazia se preferir desproteger.",
        "11. A conta fecha assim: preco = custo total + taxa do canal + imposto + lucro. A taxa % e a parcela fixa dependem da faixa do proprio preco — por isso ha um candidato por faixa.",
        "12. Estimativa, nao e conselho contabil. Categoria, reputacao, cubagem, campanha e o seu regime tributario mudam a taxa real. Em caso de duvida, vale o simulador oficial.",
    ]
    put(ws, "A6", "Passo", font_h, fill_dark, center)
    put(ws, "B6", "O que fazer", font_h, fill_dark, left_c)
    put(ws, "C6", "", font_h, fill_dark, center)
    ws.merge_cells("B6:C6")
    for i, text in enumerate(lines, start=7):
        ws.row_dimensions[i].height = 32
        put(ws, "A{0}".format(i), str(i - 6), font_h, fill_mid, center, border=box_thin)
        put(ws, "B{0}".format(i), text, font_body, fill_white, left_c, border=box_thin)
        put(ws, "C{0}".format(i), "", font_body, fill_white, border=box_thin)
        ws.merge_cells("B{0}:C{0}".format(i))
    ws.row_dimensions[20].height = 36
    put(ws, "A20",
        "Atalho: o exemplo 1 da aba Exemplos ja vem com custo 50, embalagem 2, ML Classico, imposto 4% e margem 20% — "
        "o mesmo cenario da calculadora web, agora com a tabela 2026 (12% + faixa de R$ 79, nao o atalho antigo de 16% que dava R$ 90).",
        font_muted, fill_gold_pale, left_t)
    ws.merge_cells("A20:C20")
    fill_range(ws, "A20:C20", fill_gold_pale)

def build_exemplos(wb, ex1, ex2, ex3):
    ws = wb.create_sheet("Exemplos", 3)
    ws.sheet_properties.tabColor = "1A6B54"
    widths = {
        "A": 30, "B": 22, "C": 14, "D": 14, "E": 12, "F": 12,
        "G": 12, "H": 14, "I": 14, "J": 16, "K": 16, "L": 14,
        "M": 14, "N": 14, "O": 14, "P": 64,
    }
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    header_block(ws, "P", "Tres contas trabalhadas com a mesma matematica da Calculadora (formulas vivas — mudam se voce editar Taxas)")
    page_setup(ws, "A1:P28", freeze="A6")
    headers = [
        "Cenario", "Marketplace", "Custo", "Embalagem", "Frete", "Quem paga",
        "Imposto", "Modo", "Meta", "Preco de venda", "Lucro liquido",
        "Taxa R$", "Imposto R$", "Frete cons.", "Margem efetiva", "Formula / nota",
    ]
    for i, h in enumerate(headers, start=1):
        put(ws, "{0}6".format(get_column_letter(i)), h, font_h, fill_dark, center)
    ws.row_dimensions[6].height = 28

    put(ws, "A8", "1. Precificar por margem", font_label, fill_soft, left_c, border=box_thin)
    put(ws, "B8", "ML Classico", font_body, fill_white, center, border=box_thin)
    yellow_input(ws, "C8", 50, MONEY)
    yellow_input(ws, "D8", 2, MONEY)
    yellow_input(ws, "E8", 0, MONEY)
    yellow_input(ws, "F8", "voce")
    yellow_input(ws, "G8", 0.04, PCT)
    put(ws, "H8", "Margem %", font_body, fill_white, center, border=box_thin)
    yellow_input(ws, "I8", 0.20, PCT)
    base1 = 'C8+D8+IF(F8="voce",E8,0)'
    p_high = "({0})/(1-ML_Classico_pct-G8-I8)".format(base1)
    p_mid = "({0}+ML_FixaMeio)/(1-ML_Classico_pct-G8-I8)".format(base1)
    p_low = "({0})/(1-ML_Classico_pct-ML_FixaPctBaixa-G8-I8)".format(base1)
    s1 = (
        "IFS({ph}>=ML_SemFixaDe,{ph},"
        "AND({pm}>=ML_FaixaBaixa,{pm}<ML_SemFixaDe),{pm},"
        "{pl}<ML_FaixaBaixa,{pl},"
        "{pm}<ML_FaixaBaixa,ML_FaixaBaixa,TRUE,ML_SemFixaDe)"
    ).format(ph=p_high, pm=p_mid, pl=p_low)
    put(ws, "J8", "=IFERROR({0},\"-\")".format(s1), font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    r1 = "IF(J8<ML_FaixaBaixa,ML_Classico_pct+ML_FixaPctBaixa,ML_Classico_pct)"
    k1 = "IF(J8<ML_FaixaBaixa,0,IF(J8<ML_SemFixaDe,ML_FixaMeio,0))"
    put(ws, "L8", "=J8*({0})+({1})".format(r1, k1), font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    put(ws, "M8", "=J8*G8", font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    put(ws, "N8", '=IF(F8="voce",E8,0)', font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    put(ws, "K8", "=J8-L8-M8-({0})".format(base1), font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    put(ws, "O8", "=IF(J8=0,0,K8/J8)", font_out, fill_result, right_c, fmt=PCT, prot=locked, border=box_thin)
    put(ws, "P8",
        "S = BASE / (1 - 12% - 4% - 20%) se a faixa alta couber. "
        "O atalho antigo com taxa 16% dava S = 90 (54/0,60). "
        "Com ML Classico 12% o candidato sem fixa e 52/0,64 = 81,25 >= 79, entao a taxa fixa NAO incide.",
        font_small, fill_white, left_c, border=box_thin)

    put(ws, "A9", "2. Precificar por lucro R$", font_label, fill_soft, left_c, border=box_thin)
    put(ws, "B9", "Amazon Individual", font_body, fill_white, center, border=box_thin)
    yellow_input(ws, "C9", 100, MONEY)
    yellow_input(ws, "D9", 0, MONEY)
    yellow_input(ws, "E9", 20, MONEY)
    yellow_input(ws, "F9", "voce")
    yellow_input(ws, "G9", 0.0, PCT)
    put(ws, "H9", "Lucro R$", font_body, fill_white, center, border=box_thin)
    yellow_input(ws, "I9", 30, MONEY)
    base2 = 'C9+D9+IF(F9="voce",E9,0)'
    p_n = "({0}+AMZ_IndExtra+I9)/(1-AMZ_Pct-G9)".format(base2)
    p_min = "({0}+AMZ_Min+AMZ_IndExtra+I9)/(1-G9)".format(base2)
    s2 = "IF(AMZ_Pct*({0})>=AMZ_Min,{0},{1})".format(p_n, p_min)
    put(ws, "J9", "=IFERROR({0},\"-\")".format(s2), font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    r2 = "IF(AMZ_Pct*J9<AMZ_Min,0,AMZ_Pct)"
    k2 = "IF(AMZ_Pct*J9<AMZ_Min,AMZ_Min+AMZ_IndExtra,AMZ_IndExtra)"
    put(ws, "L9", "=J9*({0})+({1})".format(r2, k2), font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    put(ws, "M9", "=J9*G9", font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    put(ws, "N9", '=IF(F9="voce",E9,0)', font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    put(ws, "K9", "=J9-L9-M9-({0})".format(base2), font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    put(ws, "O9", "=IF(J9=0,0,K9/J9)", font_out, fill_result, right_c, fmt=PCT, prot=locked, border=box_thin)
    put(ws, "P9",
        "S = (BASE + extra R$ 2 + lucro 30) / (1 - 12% - 0%) = 152 / 0,88 ~ 172,73. "
        "Taxa = 12% x S + R$ 2. Imposto 0% neste cenario (como no teste classico). "
        "Minimo de referral R$ 1 nao trava.",
        font_small, fill_white, left_c, border=box_thin)

    put(ws, "A10", "3. Se vender a R$ X, quanto sobra", font_label, fill_soft, left_c, border=box_thin)
    put(ws, "B10", "ML Classico", font_body, fill_white, center, border=box_thin)
    yellow_input(ws, "C10", 50, MONEY)
    yellow_input(ws, "D10", 2, MONEY)
    yellow_input(ws, "E10", 0, MONEY)
    yellow_input(ws, "F10", "voce")
    yellow_input(ws, "G10", 0.04, PCT)
    put(ws, "H10", "Preco dado", font_body, fill_white, center, border=box_thin)
    yellow_input(ws, "I10", 100, MONEY)
    base3 = 'C10+D10+IF(F10="voce",E10,0)'
    put(ws, "J10", "=I10", font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    r3 = "IF(J10<ML_FaixaBaixa,ML_Classico_pct+ML_FixaPctBaixa,ML_Classico_pct)"
    k3 = "IF(J10<ML_FaixaBaixa,0,IF(J10<ML_SemFixaDe,ML_FixaMeio,0))"
    put(ws, "L10", "=J10*({0})+({1})".format(r3, k3), font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    put(ws, "M10", "=J10*G10", font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    put(ws, "N10", '=IF(F10="voce",E10,0)', font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    put(ws, "K10", "=J10-L10-M10-({0})".format(base3), font_out, fill_result, right_c, fmt=MONEY, prot=locked, border=box_thin)
    put(ws, "O10", "=IF(J10=0,0,K10/J10)", font_out, fill_result, right_c, fmt=PCT, prot=locked, border=box_thin)
    put(ws, "P10",
        "Nao inverte a formula: o preco (R$ 100) e entrada. "
        "Como 100 >= 79, taxa = 12% x 100 = R$ 12, imposto = R$ 4, custo = 52 -> sobra R$ 32 (margem 32%). "
        "E o mesmo bloco Se vender a R$ X da Calculadora.",
        font_small, fill_white, left_c, border=box_thin)
    for r in (8, 9, 10):
        ws.row_dimensions[r].height = 48
    border_range(ws, "A6:P10", box)

    put(ws, "A12", "Conferencia (mesma conta em Python, gravada na geracao da planilha)", font_h, fill_mid, left_c)
    ws.merge_cells("A12:P12")
    fill_range(ws, "A12:P12", fill_mid)

    def dump_ex(row, title, r):
        put(ws, "A{0}".format(row), title, font_label, fill_soft, left_c, border=box_thin)
        txt = (
            "{mkt} | BASE {base} | S {S} | taxa {taxa} ({rp} + {k}) | "
            "imposto {imp} | lucro {lucro} | margem efetiva {me}"
        ).format(mkt=r["marketplace"], base=brl(r["base"]), S=brl(r["S"]), taxa=brl(r["taxa"]),
                 rp=pct_br(r["r"]), k=brl(r["k"]), imp=brl(r["imposto_rs"]), lucro=brl(r["lucro"]),
                 me=pct_br(r["margem_ef"]))
        put(ws, "B{0}".format(row), txt, font_body, fill_white, left_c, border=box_thin)
        ws.merge_cells("B{0}:P{0}".format(row))
        fill_range(ws, "B{0}:P{0}".format(row), fill_white)
        ws.row_dimensions[row].height = 22

    dump_ex(13, "Cenario 1", ex1)
    dump_ex(14, "Cenario 2", ex2)
    dump_ex(15, "Cenario 3", ex3)

    notes = [
        "Algebra do cenario 1: BASE = 50 + 2 + 0 = 52. Modo margem, entao S = (BASE + k) / (1 - r - t - m). "
        "Candidato sem fixa (k = 0, r = 12%): 52 / (1 - 0,12 - 0,04 - 0,20) = 52 / 0,64 = 81,25. "
        "81,25 >= 79 -> faixa alta, k permanece 0. Conferencia: 52 + 9,75 (taxa) + 3,25 (imposto) + 16,25 (lucro 20%) = 81,25.",
        "Algebra do cenario 2: BASE = 100 + 0 + 20 = 120. Modo lucro R$ 30, Amazon Individual (r = 12%, k = 2, t = 0). "
        "S = (120 + 2 + 30) / (1 - 0,12) = 152 / 0,88 ~ 172,7273. Taxa = 0,12 x 172,7273 + 2 ~ 22,7273. "
        "Lucro = 172,7273 - 22,7273 - 0 - 120 = 30,00. Referral minimo R$ 1 nao se aplica (12% de 172,73 > 1).",
        "Algebra do cenario 3 (reverso): S informado = 100, mesmas entradas do cenario 1. "
        "100 >= 79 -> k = 0, r = 12%. Taxa = 12,00; imposto = 4,00; lucro = 100 - 12 - 4 - 52 = 32,00; margem = 32%.",
        "Shopee no mesmo custo do cenario 1 (so para conferir faixa, nao e uma das tres linhas): "
        "P1 = (52+4)/0,56 = 100 (nao < 80); P2 = (52+16)/0,62 ~ 109,68 (nao < 100); "
        "P3 = (52+20)/0,62 ~ 116,13 (entre 100 e 200) -> S ~ 116,13.",
    ]
    put(ws, "A17", "Contas no papel", font_h, fill_dark, left_c)
    ws.merge_cells("A17:P17")
    fill_range(ws, "A17:P17", fill_dark)
    for i, n in enumerate(notes):
        rr = 18 + i
        ws.row_dimensions[rr].height = 48
        put(ws, "A{0}".format(rr), n, font_body, fill_white if i % 2 == 0 else fill_soft, left_t, border=box_thin)
        ws.merge_cells("A{0}:P{0}".format(rr))
        fill_range(ws, "A{0}:P{0}".format(rr), fill_white if i % 2 == 0 else fill_soft)
    put(ws, "A23",
        "Celulas amarelas desta aba sao editaveis para voce brincar com os exemplos. "
        "Os resultados das colunas verdes sao formulas, iguais em espirito as da Calculadora. "
        "Valores da conferencia Python (linhas 13-15) foram gravados na geracao e so mudam se a planilha for gerada de novo.",
        font_muted, fill_gold_pale, left_t)
    ws.merge_cells("A23:P25")
    fill_range(ws, "A23:P25", fill_gold_pale)
