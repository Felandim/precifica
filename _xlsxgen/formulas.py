# fragmentos de formula Excel (gemeos do math_engine)

def price_fx(r, k):
    return (
        "IF($O$9,"
        "IF($O$17-({r})<=0.01,NA(),($O$8+({k}))/($O$17-({r}))),"
        "IF($O$18-({r})<=0.01,NA(),($O$8+$O$12+({k}))/($O$18-({r}))))"
    ).format(r=r, k=k)

def r_of(price_ref):
    p = price_ref
    return (
        'IF(OR($C$15="ML Classico",$C$15="ML Premium"),'
        "IF({p}<ML_FaixaBaixa,$O$14+ML_FixaPctBaixa,$O$14),"
        'IF($C$15="Shopee",'
        "IF({p}<SH_Lim1,SH_Pct1,IF({p}<SH_Lim2,SH_Pct2,IF({p}<SH_Lim3,SH_Pct3,SH_Pct4))),"
        'IF(OR($C$15="Amazon Individual",$C$15="Amazon Professional"),'
        "IF(AMZ_Pct*{p}<AMZ_Min,0,AMZ_Pct),"
        'IF($C$15="Magalu",MAGALU_Pct,'
        'IF($C$15="Venda direta",DIRETA_Pct,0)))))'
    ).format(p=p)

def k_of(price_ref):
    p = price_ref
    return (
        'IF(OR($C$15="ML Classico",$C$15="ML Premium"),'
        "IF({p}<ML_FaixaBaixa,0,IF({p}<ML_SemFixaDe,ML_FixaMeio,0)),"
        'IF($C$15="Shopee",'
        "IF({p}<SH_Lim1,SH_Fix1,IF({p}<SH_Lim2,SH_Fix2,IF({p}<SH_Lim3,SH_Fix3,SH_Fix4))),"
        'IF(OR($C$15="Amazon Individual",$C$15="Amazon Professional"),'
        "IF(AMZ_Pct*{p}<AMZ_Min,AMZ_Min+$O$15,$O$15),"
        "0)))"
    ).format(p=p)

def faixa_of(price_ref):
    p = price_ref
    return (
        'IF(OR($C$15="ML Classico",$C$15="ML Premium"),'
        'IF({p}<ML_FaixaBaixa,'
        '"ML: abaixo de "&TEXT(ML_FaixaBaixa,"R$ #,##0.00")&" (fixa = 50% do preco)",'
        'IF({p}<ML_SemFixaDe,'
        '"ML: "&TEXT(ML_FaixaBaixa,"R$ #,##0.00")&" a "&TEXT(ML_SemFixaDe-0.01,"R$ #,##0.00")&" (fixa estimada "&TEXT(ML_FixaMeio,"R$ #,##0.00")&")",'
        '"ML: a partir de "&TEXT(ML_SemFixaDe,"R$ #,##0.00")&" (sem taxa fixa)")),'
        'IF($C$15="Shopee",'
        'IF({p}<SH_Lim1,"Shopee: abaixo de "&TEXT(SH_Lim1,"R$ #,##0.00")&" (20% + fixa)",'
        'IF({p}<SH_Lim2,"Shopee: "&TEXT(SH_Lim1,"R$ #,##0.00")&" a "&TEXT(SH_Lim2-0.01,"R$ #,##0.00")&" (14% + fixa)",'
        'IF({p}<SH_Lim3,"Shopee: "&TEXT(SH_Lim2,"R$ #,##0.00")&" a "&TEXT(SH_Lim3-0.01,"R$ #,##0.00")&" (14% + fixa)",'
        '"Shopee: a partir de "&TEXT(SH_Lim3,"R$ #,##0.00")&" (14% + fixa)"))),'
        'IF(OR($C$15="Amazon Individual",$C$15="Amazon Professional"),'
        'IF(AMZ_Pct*{p}<AMZ_Min,"Amazon: referral minimo + extra por item","Amazon: referral % + extra por item"),'
        'IF($C$15="Magalu","Magalu: comissao percentual (estimativa)",'
        'IF($C$15="Venda direta","Venda direta: sem taxa de marketplace","")))))'
    ).format(p=p)
