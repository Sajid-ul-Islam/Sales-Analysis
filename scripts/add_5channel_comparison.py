"""
add_5channel_comparison.py
Inserts a comprehensive "5-Channel Comparison" sheet into the master omnichannel workbook.
Compares: E-Commerce vs Mirpur vs Cumilla vs Wari vs Sylhet across every operational
and financial dimension.
"""

import sys
import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')

# ─────────────────────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────────────────────
F_ECOM   = 'Sample Docs/October 2026 Item, Product & SKU Performance.xlsx'
F_POS    = 'Sample Docs/October 2026 POS Outlet Sales Performance.xlsx'
OUT_PATH = 'Sample Docs/October 2026 Overall Sales & Channel Performance (Ecom & 4 Outlets).xlsx'

print("Loading source data...")
wb_ecom = openpyxl.load_workbook(F_ECOM, data_only=True)
df_ecom = pd.DataFrame(wb_ecom['Item Wise Performance'].values)
df_ecom.columns = df_ecom.iloc[0]; df_ecom = df_ecom[1:].copy()

wb_pos = openpyxl.load_workbook(F_POS, data_only=True)
df_pos = pd.DataFrame(wb_pos['Item Wise Performance'].values)
df_pos.columns = df_pos.iloc[0]; df_pos = df_pos[1:].copy()

# Fix cargo
def fix_cat(row):
    name = str(row.get('Item Name', '')).lower()
    if 'cargo' in name:
        return 'Cargo', 'Cargo Trouser'
    return row.get('Category', 'General Apparel'), row.get('Sub-Category', 'General Apparel')

df_ecom[['Category', 'Sub-Category']] = df_ecom.apply(fix_cat, axis=1, result_type='expand')
df_pos[['Category', 'Sub-Category']]  = df_pos.apply(fix_cat, axis=1, result_type='expand')

# Only delivered for ecom
df_ecom_d = df_ecom[df_ecom['Delivered or Not'] == 'Delivered'].copy()

# Numeric coerce
for col in ['Quantity']:
    df_ecom_d[col] = pd.to_numeric(df_ecom_d[col], errors='coerce').fillna(0)
for col in ['Total Value (৳)', 'Total COGS (৳)']:
    df_ecom_d[col] = pd.to_numeric(df_ecom_d[col], errors='coerce').fillna(0)

for col in ['Quantity Sold', 'Line Total (৳)', 'Total COGS (৳)', 'Unit Price (৳)']:
    df_pos[col] = pd.to_numeric(df_pos[col], errors='coerce').fillna(0)

# ─────────────────────────────────────────────────────────────────────────────
# BUILD CHANNEL DATA STRUCTURES
# ─────────────────────────────────────────────────────────────────────────────
OUTLETS = [
    ('Mirpur Outlet',  'Mirpur',  'POS Outlet ID 2 (Cashier 3)',  '#16A34A', 'FF16A34A'),
    ('Cumilla Branch', 'Cumilla', 'POS Outlet ID 7 (Cashier 35)', '#0891B2', 'FF0891B2'),
    ('Wari Branch',    'Wari',    'POS Outlet ID 8 (Cashier 69)', '#7C3AED', 'FF7C3AED'),
    ('Sylhet Branch',  'Sylhet',  'POS Outlet ID 9 (Cashier 572)','#B45309', 'FFB45309'),
]

CHANNELS = ['Ecom', 'Mirpur', 'Cumilla', 'Wari', 'Sylhet']
CHANNEL_FILLS = {
    'Ecom':    PatternFill('solid', fgColor='FF0284C7'),
    'Mirpur':  PatternFill('solid', fgColor='FF16A34A'),
    'Cumilla': PatternFill('solid', fgColor='FF0891B2'),
    'Wari':    PatternFill('solid', fgColor='FF7C3AED'),
    'Sylhet':  PatternFill('solid', fgColor='FFB45309'),
}

def ch_data(key):
    """Return (df, units_col, net_col, cogs_col, orders_col_field) for a channel key."""
    if key == 'Ecom':
        return df_ecom_d, 'Quantity', 'Total Value (৳)', 'Total COGS (৳)', 'Order Number'
    out_name = {'Mirpur': 'Mirpur Outlet', 'Cumilla': 'Cumilla Branch', 'Wari': 'Wari Branch', 'Sylhet': 'Sylhet Branch'}[key]
    df = df_pos[df_pos['Outlet Name'] == out_name].copy()
    return df, 'Quantity Sold', 'Line Total (৳)', 'Total COGS (৳)', 'Order Number'

def ch_summary(key):
    df, uq, nq, cq, oq = ch_data(key)
    units  = int(df[uq].sum())
    net    = float(df[nq].sum())
    cogs   = float(df[cq].sum())
    profit = net - cogs
    margin = profit / net if net else 0.0
    orders = len(df[oq].unique())
    aov    = net / orders if orders else 0.0
    aup    = net / units if units else 0.0
    upt    = units / orders if orders else 0.0
    return {'units': units, 'net': net, 'cogs': cogs, 'profit': profit,
            'margin': margin, 'orders': orders, 'aov': aov, 'aup': aup, 'upt': upt}

summaries = {ch: ch_summary(ch) for ch in CHANNELS}
grand_units  = sum(s['units']  for s in summaries.values())
grand_net    = sum(s['net']    for s in summaries.values())
grand_cogs   = sum(s['cogs']   for s in summaries.values())
grand_profit = grand_net - grand_cogs
grand_margin = grand_profit / grand_net if grand_net else 0.0
grand_orders = sum(s['orders'] for s in summaries.values())

def cat_breakdown(key):
    df, uq, nq, cq, _ = ch_data(key)
    brand_col = 'Brand Name'
    grp = df.groupby('Category').agg(
        units  = (uq, 'sum'),
        net    = (nq, 'sum'),
        cogs   = (cq, 'sum'),
    ).reset_index()
    grp['profit'] = grp['net'] - grp['cogs']
    grp['margin'] = grp.apply(lambda r: r['profit']/r['net'] if r['net'] else 0, axis=1)
    return grp.set_index('Category')

def subcat_breakdown(key):
    df, uq, nq, cq, _ = ch_data(key)
    grp = df.groupby(['Category', 'Sub-Category']).agg(
        units=(uq, 'sum'), net=(nq, 'sum'), cogs=(cq, 'sum')
    ).reset_index()
    grp['profit'] = grp['net'] - grp['cogs']
    grp['margin'] = grp.apply(lambda r: r['profit']/r['net'] if r['net'] else 0, axis=1)
    return grp

def brand_breakdown(key):
    df, uq, nq, cq, _ = ch_data(key)
    brand_col = 'Brand Name'
    grp = df.groupby(brand_col).agg(units=(uq,'sum'), net=(nq,'sum'), cogs=(cq,'sum')).reset_index()
    grp['profit'] = grp['net'] - grp['cogs']
    grp['margin'] = grp.apply(lambda r: r['profit']/r['net'] if r['net'] else 0, axis=1)
    return grp.set_index(brand_col)

def top_products(key, n=10):
    df, uq, nq, cq, _ = ch_data(key)
    name_col = 'Item Name' if key == 'Ecom' else 'Item Name'
    grp = df.groupby(name_col).agg(units=(uq,'sum'), net=(nq,'sum'), cogs=(cq,'sum')).reset_index()
    grp['profit'] = grp['net'] - grp['cogs']
    return grp.sort_values('net', ascending=False).head(n)

cats_data  = {ch: cat_breakdown(ch)   for ch in CHANNELS}
subcat_all = {ch: subcat_breakdown(ch) for ch in CHANNELS}
brand_data = {ch: brand_breakdown(ch)  for ch in CHANNELS}
top_prods  = {ch: top_products(ch, 10) for ch in CHANNELS}

# All categories union
all_cats = sorted(set().union(*[set(cats_data[ch].index) for ch in CHANNELS]))

# ─────────────────────────────────────────────────────────────────────────────
# STYLING HELPERS
# ─────────────────────────────────────────────────────────────────────────────
hdr_dark    = PatternFill('solid', fgColor='FF1E293B')
hdr_mid     = PatternFill('solid', fgColor='FF334155')
total_fill  = PatternFill('solid', fgColor='FFF1F5F9')
kpi_fill    = PatternFill('solid', fgColor='FFFFFBEB')
alt_fill    = PatternFill('solid', fgColor='FFF8FAFC')
white_fill  = PatternFill('solid', fgColor='FFFFFFFF')

font_title  = Font(name='Calibri', size=16, bold=True, color='0F172A')
font_sub    = Font(name='Calibri', size=10, italic=True, color='475569')
font_hdr    = Font(name='Calibri', size=9.5, bold=True, color='FFFFFF')
font_sect   = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
font_body   = Font(name='Calibri', size=9.5)
font_bold   = Font(name='Calibri', size=9.5, bold=True)
font_total  = Font(name='Calibri', size=9.5, bold=True, color='0F172A')
font_kpi_l  = Font(name='Calibri', size=8.5, bold=True, color='475569')
font_kpi_v  = Font(name='Calibri', size=14, bold=True, color='0F172A')
font_kpi_s  = Font(name='Calibri', size=8, color='64748B')
font_ch_hdr = Font(name='Calibri', size=10, bold=True, color='FFFFFF')

thin = Border(
    left=Side(style='thin', color='E2E8F0'),
    right=Side(style='thin', color='E2E8F0'),
    top=Side(style='thin', color='E2E8F0'),
    bottom=Side(style='thin', color='E2E8F0'),
)
thick_top = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='medium', color='475569'),
    bottom=Side(style='double', color='0F172A'),
)

def center(ws, row, col, val, font=None, fill=None, fmt=None, border=None, wrap=False):
    c = ws.cell(row=row, column=col, value=val)
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=wrap)
    if font:   c.font   = font
    if fill:   c.fill   = fill
    if fmt:    c.number_format = fmt
    if border: c.border = border
    return c

def left(ws, row, col, val, font=None, fill=None, fmt=None, border=None, wrap=False):
    c = ws.cell(row=row, column=col, value=val)
    c.alignment = Alignment(horizontal='left', vertical='center', wrap_text=wrap)
    if font:   c.font   = font
    if fill:   c.fill   = fill
    if fmt:    c.fmt    = fmt
    if border: c.border = border
    return c

def right(ws, row, col, val, font=None, fill=None, fmt=None, border=None):
    c = ws.cell(row=row, column=col, value=val)
    c.alignment = Alignment(horizontal='right', vertical='center')
    if font:   c.font   = font
    if fill:   c.fill   = fill
    if fmt:    c.number_format = fmt
    if border: c.border = border
    return c

def pct(val):   return val   # already decimal; will be formatted as 0.0%
def cur(val):   return val   # will be formatted as #,##0

def section_hdr(ws, row, label, ncols=26):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=ncols)
    c = ws.cell(row=row, column=1, value=label)
    c.font      = font_sect
    c.fill      = hdr_dark
    c.alignment = Alignment(horizontal='left', vertical='center')
    ws.row_dimensions[row].height = 24
    return row + 1

# ─────────────────────────────────────────────────────────────────────────────
# OPEN MASTER WORKBOOK & ADD SHEET
# ─────────────────────────────────────────────────────────────────────────────
print(f"Opening master workbook: {OUT_PATH}")
wb = openpyxl.load_workbook(OUT_PATH)

# Remove old version if re-running
if '5-Channel Comparison' in wb.sheetnames:
    del wb['5-Channel Comparison']

ws = wb.create_sheet(title='5-Channel Comparison', index=1)  # 2nd sheet
ws.sheet_view.showGridLines = False
NCOLS = 27  # total column span

# ─────────────────────────────────────────────────────────────────────────────
# COLUMN WIDTHS
# ─────────────────────────────────────────────────────────────────────────────
ws.column_dimensions['A'].width = 28  # Metric / Category name
ws.column_dimensions['B'].width = 18  # Sub-category or detail
# Channels: 5 channels × 4 metrics each = cols C..V  (cols 3–22) + 4 total cols
CH_COL_START = 3  # col C
COL_WIDTH = 11
for idx in range(CH_COL_START, CH_COL_START + 5*4 + 5):
    ws.column_dimensions[get_column_letter(idx)].width = COL_WIDTH
ws.column_dimensions[get_column_letter(CH_COL_START + 5*4)].width = 12

# Freeze first 2 columns and top header rows
ws.freeze_panes = ws.cell(row=9, column=3)

row = 1

# ─────────────────────────────────────────────────────────────────────────────
# TITLE
# ─────────────────────────────────────────────────────────────────────────────
ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=NCOLS)
c = ws.cell(row=row, column=1, value='DEEN COMMERCE — OCTOBER 2026 · 5-CHANNEL SALES COMPARISON')
c.font = font_title; c.alignment = Alignment(horizontal='left', vertical='center')
ws.row_dimensions[row].height = 30; row += 1

ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=NCOLS)
c = ws.cell(row=row, column=1, value='E-Commerce (Pathao Hermes)  vs  Mirpur Outlet  vs  Cumilla Branch  vs  Wari Branch  vs  Sylhet Branch  ·  Side-by-Side All Metrics')
c.font = font_sub; c.alignment = Alignment(horizontal='left', vertical='center')
ws.row_dimensions[row].height = 18; row += 1
row += 1  # blank

# ─────────────────────────────────────────────────────────────────────────────
# SECTION A: KPI SCORECARD (one KPI card per channel)
# ─────────────────────────────────────────────────────────────────────────────
row = section_hdr(ws, row, 'A.  KPI SCORECARD — ALL 5 CHANNELS AT A GLANCE', NCOLS)
# Channel name mega headers  (5 channels × 5 cols each = 25 cols from C onward)
# Layout: Col A = KPI Label, Cols B-F = Ecom, G-K = Mirpur, L-P = Cumilla, Q-U = Wari, V-Z = Sylhet
# Each block: [Units Sold, Net Sales (৳), COGS (৳), Gross Profit (৳), Margin %]  5 cols per channel
CH_METRICS = ['Units Sold', 'Net Sales (৳)', 'COGS (৳)', 'Gross Profit (৳)', 'Margin %']
CH_COL_BLOCKS = {}
col = 2  # col B
for ch in CHANNELS:
    CH_COL_BLOCKS[ch] = col  # start col of this channel's block
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col + 4)
    c = ws.cell(row=row, column=col, value=ch.upper())
    c.font = font_ch_hdr; c.fill = CHANNEL_FILLS[ch]
    c.alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[row].height = 22
    col += 5
# Total column
ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+1)
c = ws.cell(row=row, column=col, value='TOTAL')
c.font = font_ch_hdr; c.fill = hdr_dark
c.alignment = Alignment(horizontal='center', vertical='center')
row += 1

# KPI Metric sub-headers
ws.cell(row=row, column=1, value='KPI Metric').font = font_hdr
ws.cell(row=row, column=1).fill = hdr_mid
ws.cell(row=row, column=1).alignment = Alignment(horizontal='left', vertical='center')
ws.row_dimensions[row].height = 20
col = 2
for ch in CHANNELS:
    for m_idx, m in enumerate(CH_METRICS):
        c = ws.cell(row=row, column=col + m_idx, value=m)
        c.font = Font(name='Calibri', size=8.5, bold=True, color='FFFFFF')
        c.fill = CHANNEL_FILLS[ch]
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    col += 5
# Total sub-headers
for t in ['Net Sales', 'Units']:
    c = ws.cell(row=row, column=col, value=t)
    c.font = font_hdr; c.fill = hdr_dark
    c.alignment = Alignment(horizontal='center', vertical='center')
    col += 1
row += 1

TOTAL_COL = 2 + 5*5  # = 27

def kpi_data_row(ws, row, label, vals_by_ch, grand_net_v=None, grand_units_v=None,
                  fmt='#,##0', is_pct=False, is_bold=False, fill=None, border=None):
    """Write one KPI row: label in col A, then 5 channels × 5 metrics."""
    f = font_bold if is_bold else font_body
    fl = fill or white_fill
    brd = border or thin
    # Row label (col A)
    c = ws.cell(row=row, column=1, value=label)
    c.font = f; c.fill = fl; c.border = brd
    c.alignment = Alignment(horizontal='left', vertical='center')
    # Channel blocks
    col = 2
    for ch in CHANNELS:
        s = summaries[ch]
        if label == 'Units Sold':
            vals = [s['units'], s['net'], s['cogs'], s['profit'], s['margin']]
        elif label in vals_by_ch:
            vals = vals_by_ch[label][ch]
        else:
            vals = vals_by_ch.get(ch, [0,0,0,0,0])
        for m_idx, v in enumerate(vals):
            c = ws.cell(row=row, column=col + m_idx, value=v)
            c.font = f; c.fill = fl; c.border = brd
            c.alignment = Alignment(horizontal='right', vertical='center')
            if m_idx == 4:  # margin
                c.number_format = '0.0%'
            else:
                c.number_format = '#,##0'
        col += 5
    ws.row_dimensions[row].height = 18

# KPI Rows
KPI_DEFS = [
    ('Units Sold',           lambda s: [s['units'],  s['net'],    s['cogs'],    s['profit'],    s['margin']]),
    ('Transactions / Orders',lambda s: [s['orders'], s['net'],    s['cogs'],    s['profit'],    s['margin']]),
    ('Net Settled Sales (৳)',lambda s: [s['units'],  s['net'],    s['cogs'],    s['profit'],    s['margin']]),
    ('Total COGS (৳)',       lambda s: [s['units'],  s['net'],    s['cogs'],    s['profit'],    s['margin']]),
    ('Gross Profit (৳)',     lambda s: [s['units'],  s['net'],    s['cogs'],    s['profit'],    s['margin']]),
    ('Gross Margin (%)',     lambda s: [s['units'],  s['net'],    s['cogs'],    s['profit'],    s['margin']]),
    ('AOV (Avg Order Value)',lambda s: [s['units'],  s['aov'],    s['cogs'],    s['profit'],    s['margin']]),
    ('AUP (Avg Unit Price)', lambda s: [s['units'],  s['aup'],    s['cogs'],    s['profit'],    s['margin']]),
    ('UPT (Units/Txn)',      lambda s: [s['units'],  s['upt'],    s['cogs'],    s['profit'],    s['margin']]),
    ('Revenue Share (%)',    lambda s: [s['units'],  s['net']/grand_net,  s['cogs'],  s['profit'],  s['margin']]),
    ('Volume Share (%)',     lambda s: [s['units']/grand_units, s['net'], s['cogs'], s['profit'], s['margin']]),
]

CUSTOM_KPI = {
    'Units Sold':            lambda ch: [summaries[ch]['units'], summaries[ch]['net'],  summaries[ch]['cogs'], summaries[ch]['profit'], summaries[ch]['margin']],
    'Transactions / Orders': lambda ch: [summaries[ch]['orders'],summaries[ch]['net'],  summaries[ch]['cogs'], summaries[ch]['profit'], summaries[ch]['margin']],
    'Net Settled Sales (৳)': lambda ch: [summaries[ch]['units'], summaries[ch]['net'],  summaries[ch]['cogs'], summaries[ch]['profit'], summaries[ch]['margin']],
    'Total COGS (৳)':        lambda ch: [summaries[ch]['units'], summaries[ch]['net'],  summaries[ch]['cogs'], summaries[ch]['profit'], summaries[ch]['margin']],
    'Gross Profit (৳)':      lambda ch: [summaries[ch]['units'], summaries[ch]['net'],  summaries[ch]['cogs'], summaries[ch]['profit'], summaries[ch]['margin']],
    'Gross Margin (%)':      lambda ch: [summaries[ch]['units'], summaries[ch]['net'],  summaries[ch]['cogs'], summaries[ch]['profit'], summaries[ch]['margin']],
    'AOV (Avg Order Value)': lambda ch: [summaries[ch]['orders'],summaries[ch]['aov'],  summaries[ch]['cogs'], summaries[ch]['profit'], summaries[ch]['margin']],
    'AUP (Avg Unit Price)':  lambda ch: [summaries[ch]['units'], summaries[ch]['aup'],  summaries[ch]['cogs'], summaries[ch]['profit'], summaries[ch]['margin']],
    'UPT (Units/Txn)':       lambda ch: [summaries[ch]['orders'],summaries[ch]['upt'],  summaries[ch]['cogs'], summaries[ch]['profit'], summaries[ch]['margin']],
    'Revenue Share (%)':     lambda ch: [summaries[ch]['units'], summaries[ch]['net']/grand_net, summaries[ch]['cogs'], summaries[ch]['profit'], summaries[ch]['margin']],
    'Volume Share (%)':      lambda ch: [summaries[ch]['units']/grand_units, summaries[ch]['net'], summaries[ch]['cogs'], summaries[ch]['profit'], summaries[ch]['margin']],
}

# Column-1 metrics with explicit per-row value logic
DIRECT_ROWS = [
    # (Row label,  [ecom_v, mirpur_v, cumilla_v, wari_v, sylhet_v], fmt, is_pct, is_bold)
    ('Units Sold',
     {ch: summaries[ch]['units'] for ch in CHANNELS}, '#,##0', False, True),
    ('Transactions / Orders',
     {ch: summaries[ch]['orders'] for ch in CHANNELS}, '#,##0', False, False),
    ('Net Settled Sales (৳)',
     {ch: summaries[ch]['net'] for ch in CHANNELS}, '#,##0', False, True),
    ('Total COGS (৳)',
     {ch: summaries[ch]['cogs'] for ch in CHANNELS}, '#,##0', False, False),
    ('Gross Profit (৳)',
     {ch: summaries[ch]['profit'] for ch in CHANNELS}, '#,##0', False, False),
    ('Gross Margin (%)',
     {ch: summaries[ch]['margin'] for ch in CHANNELS}, '0.0%', True, False),
    ('AOV — Avg Order Value (৳)',
     {ch: summaries[ch]['aov'] for ch in CHANNELS}, '#,##0.00', False, False),
    ('AUP — Avg Unit Price (৳)',
     {ch: summaries[ch]['aup'] for ch in CHANNELS}, '#,##0.00', False, False),
    ('UPT — Units per Transaction',
     {ch: summaries[ch]['upt'] for ch in CHANNELS}, '0.00', False, False),
    ('Revenue Share of Company (%)',
     {ch: summaries[ch]['net']/grand_net for ch in CHANNELS}, '0.0%', True, False),
    ('Volume Share of Company (%)',
     {ch: summaries[ch]['units']/grand_units for ch in CHANNELS}, '0.0%', True, False),
]

for lbl, ch_vals_dict, fmt, is_pct, is_bold in DIRECT_ROWS:
    f = font_bold if is_bold else font_body
    fl = kpi_fill if is_bold else white_fill
    c = ws.cell(row=row, column=1, value=lbl)
    c.font = f; c.fill = fl; c.border = thin
    c.alignment = Alignment(horizontal='left', vertical='center')
    col = 2
    row_total = 0
    for ch in CHANNELS:
        v = ch_vals_dict[ch]
        cell = ws.cell(row=row, column=col, value=v)
        cell.font = f; cell.fill = fl; cell.border = thin
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = fmt
        # fill remaining 4 cols of block blank
        for extra in range(1, 5):
            xc = ws.cell(row=row, column=col+extra, value='')
            xc.fill = fl; xc.border = thin
        row_total += v
        col += 5
    # Grand total col
    c_tot = ws.cell(row=row, column=col, value=row_total if not is_pct else grand_net/grand_net)
    c_tot.font = font_bold; c_tot.fill = total_fill; c_tot.border = thin
    c_tot.alignment = Alignment(horizontal='right', vertical='center')
    c_tot.number_format = fmt
    ws.cell(row=row, column=col+1, value='').border = thin
    ws.row_dimensions[row].height = 18
    row += 1

row += 1  # spacer

# ─────────────────────────────────────────────────────────────────────────────
# SECTION B: CATEGORY-WISE BREAKDOWN BY CHANNEL
# ─────────────────────────────────────────────────────────────────────────────
row = section_hdr(ws, row, 'B.  CATEGORY-WISE PERFORMANCE — ALL 5 CHANNELS SIDE BY SIDE', NCOLS)

# Column headers: Category | Ecom×4 | Mirpur×4 | Cumilla×4 | Wari×4 | Sylhet×4 | Total×4
CATCOLS = ['Units', 'Net Sales (৳)', 'COGS (৳)', 'Margin %']
# Channel mega-header
c = ws.cell(row=row, column=1, value='Category')
c.font = font_hdr; c.fill = hdr_mid; c.border = thin
c.alignment = Alignment(horizontal='left', vertical='center')

col = 2
for ch in CHANNELS:
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+3)
    c = ws.cell(row=row, column=col, value=ch.upper())
    c.font = font_ch_hdr; c.fill = CHANNEL_FILLS[ch]
    c.alignment = Alignment(horizontal='center', vertical='center')
    col += 4
ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+3)
c = ws.cell(row=row, column=col, value='TOTAL (ALL CHANNELS)')
c.font = font_hdr; c.fill = hdr_dark
c.alignment = Alignment(horizontal='center', vertical='center')
ws.row_dimensions[row].height = 20
row += 1

# Sub-headers
c = ws.cell(row=row, column=1, value='Category / Sub-Category')
c.font = font_hdr; c.fill = hdr_mid; c.border = thin
c.alignment = Alignment(horizontal='left', vertical='center')
col = 2
for ch in CHANNELS:
    for m in CATCOLS:
        c = ws.cell(row=row, column=col, value=m)
        c.font = Font(name='Calibri', size=8.5, bold=True, color='FFFFFF')
        c.fill = CHANNEL_FILLS[ch]; c.border = thin
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        col += 1
for m in ['Units', 'Net Sales (৳)', 'COGS (৳)', 'Margin %']:
    c = ws.cell(row=row, column=col, value=m)
    c.font = font_hdr; c.fill = hdr_dark; c.border = thin
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    col += 1
ws.row_dimensions[row].height = 24
row += 1

tot_cat_units  = {cat: 0 for cat in all_cats}
tot_cat_net    = {cat: 0.0 for cat in all_cats}
tot_cat_cogs   = {cat: 0.0 for cat in all_cats}

for cat_idx, cat in enumerate(sorted(all_cats)):
    fl = alt_fill if cat_idx % 2 == 0 else white_fill
    c = ws.cell(row=row, column=1, value=cat)
    c.font = font_bold; c.fill = fl; c.border = thin
    c.alignment = Alignment(horizontal='left', vertical='center')

    col = 2
    row_units_total = 0; row_net_total = 0.0; row_cogs_total = 0.0
    for ch in CHANNELS:
        cd = cats_data[ch]
        if cat in cd.index:
            u = int(cd.loc[cat, 'units'])
            n = float(cd.loc[cat, 'net'])
            cg = float(cd.loc[cat, 'cogs'])
            mg = (n - cg) / n if n else 0.0
        else:
            u, n, cg, mg = 0, 0.0, 0.0, 0.0
        row_units_total += u; row_net_total += n; row_cogs_total += cg
        tot_cat_units[cat] += u; tot_cat_net[cat] += n; tot_cat_cogs[cat] += cg
        for v, fmt in [(u, '#,##0'), (n, '#,##0'), (cg, '#,##0'), (mg, '0.0%')]:
            cell = ws.cell(row=row, column=col, value=v)
            cell.font = font_body; cell.fill = fl; cell.border = thin
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = fmt
            col += 1

    # Total cols
    tot_mg = (row_net_total - row_cogs_total) / row_net_total if row_net_total else 0.0
    for v, fmt in [(row_units_total, '#,##0'), (row_net_total, '#,##0'), (row_cogs_total, '#,##0'), (tot_mg, '0.0%')]:
        cell = ws.cell(row=row, column=col, value=v)
        cell.font = font_bold; cell.fill = total_fill; cell.border = thin
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = fmt
        col += 1

    ws.row_dimensions[row].height = 18
    row += 1

# Grand total row
c = ws.cell(row=row, column=1, value='GRAND TOTAL — ALL CATEGORIES')
c.font = font_total; c.fill = total_fill; c.border = thick_top
c.alignment = Alignment(horizontal='left', vertical='center')
col = 2
for ch in CHANNELS:
    s = summaries[ch]
    u_tot = s['units']; n_tot = s['net']; cg_tot = s['cogs']; mg = s['margin']
    for v, fmt in [(u_tot, '#,##0'), (n_tot, '#,##0'), (cg_tot, '#,##0'), (mg, '0.0%')]:
        cell = ws.cell(row=row, column=col, value=v)
        cell.font = font_total; cell.fill = total_fill; cell.border = thick_top
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = fmt
        col += 1
# Overall grand total
gm = grand_profit / grand_net if grand_net else 0.0
for v, fmt in [(grand_units, '#,##0'), (grand_net, '#,##0'), (grand_cogs, '#,##0'), (gm, '0.0%')]:
    cell = ws.cell(row=row, column=col, value=v)
    cell.font = font_total; cell.fill = hdr_dark
    cell.border = thick_top
    cell.alignment = Alignment(horizontal='right', vertical='center')
    cell.number_format = fmt
    # white text for dark bg
    cell.font = Font(name='Calibri', size=9.5, bold=True, color='FFFFFF')
    col += 1
ws.row_dimensions[row].height = 22
row += 2

# ─────────────────────────────────────────────────────────────────────────────
# SECTION C: BRAND TIER COMPARISON (DEEN Select vs Regular) PER CHANNEL
# ─────────────────────────────────────────────────────────────────────────────
row = section_hdr(ws, row, 'C.  BRAND TIER COMPARISON — DEEN SELECT vs DEEN REGULAR PER CHANNEL', NCOLS)

BRAND_TIERS = ['DEEN Select', 'DEEN']
BRAND_LABELS = {'DEEN Select': 'DEEN Select (Export Overruns)', 'DEEN': 'DEEN Regular (Core In-House)'}

# Headers
c = ws.cell(row=row, column=1, value='Brand Tier')
c.font = font_hdr; c.fill = hdr_mid; c.border = thin
c.alignment = Alignment(horizontal='left', vertical='center')
col = 2
for ch in CHANNELS:
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+3)
    c = ws.cell(row=row, column=col, value=ch.upper())
    c.font = font_ch_hdr; c.fill = CHANNEL_FILLS[ch]
    c.alignment = Alignment(horizontal='center', vertical='center')
    col += 4
ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+3)
c = ws.cell(row=row, column=col, value='COMPANY TOTAL')
c.font = font_hdr; c.fill = hdr_dark
c.alignment = Alignment(horizontal='center', vertical='center')
ws.row_dimensions[row].height = 20; row += 1

# Sub-headers
c = ws.cell(row=row, column=1, value='Brand Tier / Line')
c.font = font_hdr; c.fill = hdr_mid; c.border = thin
c.alignment = Alignment(horizontal='left', vertical='center')
col = 2
for ch in CHANNELS:
    for m in ['Units', 'Net Sales (৳)', 'COGS (৳)', 'Margin %']:
        c = ws.cell(row=row, column=col, value=m)
        c.font = Font(name='Calibri', size=8.5, bold=True, color='FFFFFF')
        c.fill = CHANNEL_FILLS[ch]; c.border = thin
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        col += 1
for m in ['Units', 'Net Sales (৳)', 'COGS (৳)', 'Margin %']:
    c = ws.cell(row=row, column=col, value=m)
    c.font = font_hdr; c.fill = hdr_dark; c.border = thin
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    col += 1
ws.row_dimensions[row].height = 24; row += 1

for b_idx, brand in enumerate(BRAND_TIERS):
    fl = alt_fill if b_idx % 2 == 0 else white_fill
    c = ws.cell(row=row, column=1, value=BRAND_LABELS[brand])
    c.font = font_bold; c.fill = fl; c.border = thin
    c.alignment = Alignment(horizontal='left', vertical='center')
    col = 2
    tot_u = 0; tot_n = 0.0; tot_cg = 0.0
    for ch in CHANNELS:
        bd = brand_data[ch]
        if brand in bd.index:
            u  = int(bd.loc[brand, 'units'])
            n  = float(bd.loc[brand, 'net'])
            cg = float(bd.loc[brand, 'cogs'])
            mg = (n - cg) / n if n else 0.0
        else:
            u, n, cg, mg = 0, 0.0, 0.0, 0.0
        tot_u += u; tot_n += n; tot_cg += cg
        for v, fmt in [(u, '#,##0'), (n, '#,##0'), (cg, '#,##0'), (mg, '0.0%')]:
            cell = ws.cell(row=row, column=col, value=v)
            cell.font = font_body; cell.fill = fl; cell.border = thin
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = fmt
            col += 1
    tot_mg = (tot_n - tot_cg) / tot_n if tot_n else 0.0
    for v, fmt in [(tot_u, '#,##0'), (tot_n, '#,##0'), (tot_cg, '#,##0'), (tot_mg, '0.0%')]:
        cell = ws.cell(row=row, column=col, value=v)
        cell.font = font_bold; cell.fill = total_fill; cell.border = thin
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = fmt
        col += 1
    ws.row_dimensions[row].height = 18; row += 1

row += 2

# ─────────────────────────────────────────────────────────────────────────────
# SECTION D: TOP 10 PRODUCTS PER CHANNEL (HORIZONTAL SIDE BY SIDE)
# ─────────────────────────────────────────────────────────────────────────────
row = section_hdr(ws, row, 'D.  TOP 10 BEST-SELLING PRODUCTS — PER CHANNEL (BY NET SALES)', NCOLS)

# 5 blocks side-by-side: each block = Rank | Product | Units | Net Sales | Margin
# Layout: cols A-E = Ecom, F-J = Mirpur, K-O = Cumilla, P-T = Wari, U-Y = Sylhet
TOP_N   = 10
BLK_W   = 5   # columns per channel block
TOP_COLS = ['#', 'Product Name', 'Units', 'Net Sales (৳)', 'Margin %']

col = 1
for ch in CHANNELS:
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col + BLK_W - 1)
    c = ws.cell(row=row, column=col, value=f'{ch.upper()} — TOP {TOP_N} PRODUCTS')
    c.font = font_ch_hdr; c.fill = CHANNEL_FILLS[ch]
    c.alignment = Alignment(horizontal='center', vertical='center')
    col += BLK_W
ws.row_dimensions[row].height = 22; row += 1

# Sub-headers
col = 1
for ch in CHANNELS:
    for m in TOP_COLS:
        c = ws.cell(row=row, column=col, value=m)
        c.font = Font(name='Calibri', size=8.5, bold=True, color='FFFFFF')
        c.fill = CHANNEL_FILLS[ch]; c.border = thin
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        col += 1
ws.row_dimensions[row].height = 24; row += 1

start_row_top = row
for rank in range(TOP_N):
    ws.row_dimensions[row + rank].height = 18

col_offset = 1
for ch in CHANNELS:
    tp = top_prods[ch].reset_index(drop=True)
    for rank in range(TOP_N):
        r = start_row_top + rank
        fl = alt_fill if rank % 2 == 0 else white_fill
        if rank < len(tp):
            prod_name = str(tp.loc[rank, 'Item Name'])[:35]
            u  = int(tp.loc[rank, 'units'])
            n  = float(tp.loc[rank, 'net'])
            cg = float(tp.loc[rank, 'cogs'])
            mg = (n - cg) / n if n else 0.0
            vals = [rank + 1, prod_name, u, n, mg]
            fmts = ['#,##0', '@', '#,##0', '#,##0', '0.0%']
        else:
            vals = ['', '', '', '', '']
            fmts = ['@', '@', '@', '@', '@']
        for col_i, (v, fmt) in enumerate(zip(vals, fmts)):
            cell = ws.cell(row=r, column=col_offset + col_i, value=v)
            cell.font = font_body; cell.fill = fl; cell.border = thin
            if col_i == 1:
                cell.alignment = Alignment(horizontal='left', vertical='center')
            else:
                cell.alignment = Alignment(horizontal='right', vertical='center')
            if fmt != '@' or isinstance(v, (int, float)):
                cell.number_format = fmt
    col_offset += BLK_W

row = start_row_top + TOP_N + 2

# ─────────────────────────────────────────────────────────────────────────────
# SECTION E: CHANNEL EFFICIENCY METRICS SCORECARD
# ─────────────────────────────────────────────────────────────────────────────
row = section_hdr(ws, row, 'E.  CHANNEL EFFICIENCY & PROFITABILITY METRICS SCORECARD', NCOLS)

EFF_ROWS = [
    ('Gross Margin (%)',         {ch: summaries[ch]['margin']          for ch in CHANNELS}, '0.0%'),
    ('COGS as % of Net Sales',   {ch: summaries[ch]['cogs']/summaries[ch]['net'] if summaries[ch]['net'] else 0  for ch in CHANNELS}, '0.0%'),
    ('Profit per Unit (৳)',      {ch: summaries[ch]['profit']/summaries[ch]['units'] if summaries[ch]['units'] else 0 for ch in CHANNELS}, '#,##0.00'),
    ('Revenue per Transaction',  {ch: summaries[ch]['aov']             for ch in CHANNELS}, '#,##0.00'),
    ('Units per Transaction',    {ch: summaries[ch]['upt']             for ch in CHANNELS}, '0.00'),
    ('Revenue Share of Total',   {ch: summaries[ch]['net']/grand_net   for ch in CHANNELS}, '0.0%'),
    ('Volume Share of Total',    {ch: summaries[ch]['units']/grand_units for ch in CHANNELS}, '0.0%'),
    ('Profit Share of Total',    {ch: summaries[ch]['profit']/grand_profit if grand_profit else 0 for ch in CHANNELS}, '0.0%'),
]

# Header
c = ws.cell(row=row, column=1, value='Efficiency Metric')
c.font = font_hdr; c.fill = hdr_mid; c.border = thin
c.alignment = Alignment(horizontal='left', vertical='center')
col = 2
for ch in CHANNELS:
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+1)
    c = ws.cell(row=row, column=col, value=ch.upper())
    c.font = font_ch_hdr; c.fill = CHANNEL_FILLS[ch]
    c.alignment = Alignment(horizontal='center', vertical='center')
    ws.cell(row=row, column=col+1).fill = CHANNEL_FILLS[ch]
    col += 2
ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+1)
c = ws.cell(row=row, column=col, value='COMPANY AVG')
c.font = font_hdr; c.fill = hdr_dark
c.alignment = Alignment(horizontal='center', vertical='center')
ws.row_dimensions[row].height = 20; row += 1

for eff_lbl, ch_vals, fmt in EFF_ROWS:
    fl = kpi_fill
    c = ws.cell(row=row, column=1, value=eff_lbl)
    c.font = font_body; c.fill = fl; c.border = thin
    c.alignment = Alignment(horizontal='left', vertical='center')
    col = 2
    for ch in CHANNELS:
        v = ch_vals[ch]
        ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+1)
        cell = ws.cell(row=row, column=col, value=v)
        cell.font = font_bold; cell.fill = fl; cell.border = thin
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.number_format = fmt
        ws.cell(row=row, column=col+1).fill = fl; ws.cell(row=row, column=col+1).border = thin
        col += 2
    # Company avg (sum of numerators / sum of denominators for most)
    avg = sum(ch_vals.values()) / len(CHANNELS) if ch_vals else 0
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+1)
    cell = ws.cell(row=row, column=col, value=avg)
    cell.font = font_total; cell.fill = total_fill; cell.border = thin
    cell.alignment = Alignment(horizontal='center', vertical='center')
    cell.number_format = fmt
    ws.cell(row=row, column=col+1).fill = total_fill; ws.cell(row=row, column=col+1).border = thin
    ws.row_dimensions[row].height = 18; row += 1

row += 1

# ─────────────────────────────────────────────────────────────────────────────
# SAVE
# ─────────────────────────────────────────────────────────────────────────────
# Reorder sheets so '5-Channel Comparison' is sheet 2 (index 1)
sheet_order = wb.sheetnames
if '5-Channel Comparison' in sheet_order:
    idx = sheet_order.index('5-Channel Comparison')
    wb.move_sheet('5-Channel Comparison', offset=-(idx - 1))

print(f"Saving updated workbook to: {OUT_PATH}")
wb.save(OUT_PATH)
print("✅ '5-Channel Comparison' sheet added successfully!")
print(f"   Sections: A (KPI Scorecard)  B (Category-Wise)  C (Brand Tier)  D (Top 10 Products)  E (Efficiency Metrics)")
