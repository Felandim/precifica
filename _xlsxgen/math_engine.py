# motor de preco (gemeo das formulas Excel)
TAXAS = {
    "ML_Classico_pct": 0.12,
    "ML_Premium_pct": 0.17,
    "ML_SemFixaDe": 79.0,
    "ML_FaixaBaixa": 12.50,
    "ML_FixaPctBaixa": 0.50,
    "ML_FixaMeio": 6.50,
    "SH_Lim1": 80.0,
    "SH_Pct1": 0.20,
    "SH_Fix1": 4.0,
    "SH_Lim2": 100.0,
    "SH_Pct2": 0.14,
    "SH_Fix2": 16.0,
    "SH_Lim3": 200.0,
    "SH_Pct3": 0.14,
    "SH_Fix3": 20.0,
    "SH_Pct4": 0.14,
    "SH_Fix4": 26.0,
    "AMZ_Pct": 0.12,
    "AMZ_IndExtra": 2.0,
    "AMZ_ProExtra": 0.0,
    "AMZ_Min": 1.0,
    "MAGALU_Pct": 0.16,
    "DIRETA_Pct": 0.0,
}

def base_cost(custo, embalagem, frete, quem):
    return custo + embalagem + (frete if quem == "voce" else 0.0)

def price_candidate(base, r, k, imposto, modo, margem, lucro):
    if modo == "Margem %":
        denom = 1 - r - imposto - margem
        if denom <= 0.01:
            return None
        return (base + k) / denom
    denom = 1 - r - imposto
    if denom <= 0.01:
        return None
    return (base + k + lucro) / denom

def ml_consistent(base, r, imposto, modo, margem, lucro):
    t = TAXAS
    p_high = price_candidate(base, r, 0.0, imposto, modo, margem, lucro)
    p_mid = price_candidate(base, r, t["ML_FixaMeio"], imposto, modo, margem, lucro)
    p_low = price_candidate(base, r + t["ML_FixaPctBaixa"], 0.0, imposto, modo, margem, lucro)
    if p_high is not None and p_high >= t["ML_SemFixaDe"]:
        return p_high
    if p_mid is not None and t["ML_FaixaBaixa"] <= p_mid < t["ML_SemFixaDe"]:
        return p_mid
    if p_low is not None and p_low < t["ML_FaixaBaixa"]:
        return p_low
    if p_mid is not None and p_mid < t["ML_FaixaBaixa"]:
        return t["ML_FaixaBaixa"]
    return t["ML_SemFixaDe"]

def shopee_consistent(base, imposto, modo, margem, lucro):
    t = TAXAS
    p1 = price_candidate(base, t["SH_Pct1"], t["SH_Fix1"], imposto, modo, margem, lucro)
    p2 = price_candidate(base, t["SH_Pct2"], t["SH_Fix2"], imposto, modo, margem, lucro)
    p3 = price_candidate(base, t["SH_Pct3"], t["SH_Fix3"], imposto, modo, margem, lucro)
    p4 = price_candidate(base, t["SH_Pct4"], t["SH_Fix4"], imposto, modo, margem, lucro)
    if p4 is not None and p4 >= t["SH_Lim3"]:
        return p4
    if p3 is not None and t["SH_Lim2"] <= p3 < t["SH_Lim3"]:
        return p3
    if p2 is not None and t["SH_Lim1"] <= p2 < t["SH_Lim2"]:
        return p2
    if p1 is not None and p1 < t["SH_Lim1"]:
        return p1
    if p3 is not None and p3 >= t["SH_Lim3"]:
        return t["SH_Lim3"]
    if p2 is not None and p2 >= t["SH_Lim2"]:
        return t["SH_Lim2"]
    return t["SH_Lim1"]

def amazon_price(base, extra, imposto, modo, margem, lucro):
    t = TAXAS
    p_n = price_candidate(base, t["AMZ_Pct"], extra, imposto, modo, margem, lucro)
    p_min = price_candidate(base, 0.0, t["AMZ_Min"] + extra, imposto, modo, margem, lucro)
    if p_n is None:
        return p_min
    if t["AMZ_Pct"] * p_n >= t["AMZ_Min"]:
        return p_n
    return p_min

def selling_price(mkt, custo, embalagem, frete, quem, imposto, modo, margem, lucro):
    base = base_cost(custo, embalagem, frete, quem)
    t = TAXAS
    if mkt == "ML Classico":
        return ml_consistent(base, t["ML_Classico_pct"], imposto, modo, margem, lucro)
    if mkt == "ML Premium":
        return ml_consistent(base, t["ML_Premium_pct"], imposto, modo, margem, lucro)
    if mkt == "Shopee":
        return shopee_consistent(base, imposto, modo, margem, lucro)
    if mkt == "Amazon Individual":
        return amazon_price(base, t["AMZ_IndExtra"], imposto, modo, margem, lucro)
    if mkt == "Amazon Professional":
        return amazon_price(base, t["AMZ_ProExtra"], imposto, modo, margem, lucro)
    if mkt == "Magalu":
        return price_candidate(base, t["MAGALU_Pct"], 0.0, imposto, modo, margem, lucro)
    if mkt == "Venda direta":
        return price_candidate(base, t["DIRETA_Pct"], 0.0, imposto, modo, margem, lucro)
    raise ValueError(mkt)

def rk_of(mkt, s):
    t = TAXAS
    if mkt in ("ML Classico", "ML Premium"):
        r = t["ML_Classico_pct"] if mkt == "ML Classico" else t["ML_Premium_pct"]
        if s < t["ML_FaixaBaixa"]:
            return r + t["ML_FixaPctBaixa"], 0.0
        if s < t["ML_SemFixaDe"]:
            return r, t["ML_FixaMeio"]
        return r, 0.0
    if mkt == "Shopee":
        if s < t["SH_Lim1"]:
            return t["SH_Pct1"], t["SH_Fix1"]
        if s < t["SH_Lim2"]:
            return t["SH_Pct2"], t["SH_Fix2"]
        if s < t["SH_Lim3"]:
            return t["SH_Pct3"], t["SH_Fix3"]
        return t["SH_Pct4"], t["SH_Fix4"]
    if mkt in ("Amazon Individual", "Amazon Professional"):
        extra = t["AMZ_IndExtra"] if mkt == "Amazon Individual" else t["AMZ_ProExtra"]
        if t["AMZ_Pct"] * s < t["AMZ_Min"]:
            return 0.0, t["AMZ_Min"] + extra
        return t["AMZ_Pct"], extra
    if mkt == "Magalu":
        return t["MAGALU_Pct"], 0.0
    return t["DIRETA_Pct"], 0.0

def full_result(mkt, custo, embalagem, frete, quem, imposto, modo, margem=0.0, lucro=0.0, preco=None):
    base = base_cost(custo, embalagem, frete, quem)
    s = preco if preco is not None else selling_price(mkt, custo, embalagem, frete, quem, imposto, modo, margem, lucro)
    r, k = rk_of(mkt, s)
    taxa = s * r + k
    imp = s * imposto
    lucro_liq = s - taxa - imp - base
    frete_c = frete if quem == "voce" else 0.0
    margem_ef = lucro_liq / s if s else 0.0
    return {
        "marketplace": mkt, "custo": custo, "embalagem": embalagem, "frete": frete,
        "quem": quem, "imposto": imposto, "modo": modo, "base": base, "S": s,
        "r": r, "k": k, "taxa": taxa, "imposto_rs": imp, "lucro": lucro_liq,
        "frete_c": frete_c, "margem_ef": margem_ef,
    }

def brl(n):
    return "R$ {:.2f}".format(n).replace(".", ",")

def pct_br(n):
    return "{:.2f}%".format(n * 100).replace(".", ",")
