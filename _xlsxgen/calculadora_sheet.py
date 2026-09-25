from calculadora_aux import _aux_cells
from calculadora_inputs import _breakdown_and_reverse, _inputs, _results, _validations_and_protect
from styles import GREEN_DARK, header_block, page_setup

def build_calculadora(wb):
    ws = wb.create_sheet("Calculadora", 0)
    ws.sheet_properties.tabColor = GREEN_DARK
    widths = {
        "A": 34, "B": 2, "C": 18, "D": 38, "E": 2,
        "F": 30, "G": 2, "H": 20, "I": 3, "J": 28, "K": 12, "L": 12,
        "M": 3, "N": 44, "O": 18, "P": 56,
    }
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    header_block(ws, "L", "Calculadora de preco para Mercado Livre, Shopee, Amazon, Magalu e venda direta")
    page_setup(ws, "A1:L32", freeze="A6")
    _inputs(ws)
    _results(ws)
    _breakdown_and_reverse(ws)
    _aux_cells(ws)
    _validations_and_protect(ws)
