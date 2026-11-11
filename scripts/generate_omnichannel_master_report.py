import json
import re
import os
import sys
import pandas as pd
import openpyxl
def safe_sum_cogs(series):
    s = pd.to_numeric(series, errors='coerce')
    return float(s.sum()) if s.notna().sum() > 0 else 0.0

def safe_cogs_disp(series, total_count=None):
    s = pd.to_numeric(series, errors='coerce')
    notna_cnt = s.notna().sum()
    if notna_cnt == 0:
        return "didn'tget"
    if total_count is not None and notna_cnt < total_count:
        return "didn'tget"
    return float(s.sum())

from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')

print("================================================================================")
print("🚀 GENERATING OCTOBER 2026 MASTER OMNICHANNEL SALES & CHANNEL REPORT")
print("   Consolidating E-Commerce (Pathao Hermes) + 4 Retail Outlets (All-In-One)")
print("================================================================================\n")

# Styling definitions
header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
regular_font = Font(name="Calibri", size=9.5)
bold_font = Font(name="Calibri", size=9.5, bold=True)
section_hdr_font = Font(name="Calibri", size=12, bold=True, color="FFFFFF")
section_hdr_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
tbl_hdr_font = Font(name="Calibri", size=9.5, bold=True, color="FFFFFF")
tbl_hdr_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")

ecom_hdr_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")   # Sky blue
pos_hdr_fill = PatternFill(start_color="16A34A", end_color="16A34A", fill_type="solid")    # Emerald green
select_hdr_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid") # Indigo
regular_hdr_fill = PatternFill(start_color="0891B2", end_color="0891B2", fill_type="solid")# Cyan
total_row_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
kpi_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

font_title = Font(name='Calibri', size=16, bold=True, color='0F172A')
font_subtitle = Font(name='Calibri', size=10, italic=True, color='475569')
card_label_font = Font(name='Calibri', size=8.5, bold=True, color='475569')
card_value_font = Font(name='Calibri', size=15, bold=True, color='0F172A')
card_sub_font = Font(name='Calibri', size=8, color='64748B')

thin_border = Border(
    left=Side(style="thin", color="E2E8F0"),
    right=Side(style="thin", color="E2E8F0"),
    top=Side(style="thin", color="E2E8F0"),
    bottom=Side(style="thin", color="E2E8F0")
)
total_border = Border(
    left=Side(style="thin", color="CBD5E1"),
    right=Side(style="thin", color="CBD5E1"),
    top=Side(style="thin", color="475569"),
    bottom=Side(style="double", color="0F172A")
)

# -----------------------------------------------------------------------------
# 1. LOAD DATA FROM BOTH SOURCES
# -----------------------------------------------------------------------------
f_ecom = 'Sample Docs/October 2026 Item, Product & SKU Performance.xlsx'
f_pos = 'Sample Docs/October 2026 POS Outlet Sales Performance.xlsx'
out_path = 'Sample Docs/October 2026 Overall Sales & Channel Performance (Ecom & 4 Outlets).xlsx'

print(f"Reading E-Commerce data from: {f_ecom}")
wb_ecom = openpyxl.load_workbook(f_ecom, data_only=True)
df_ecom_raw = pd.DataFrame(wb_ecom['Item Wise Performance'].values)
df_ecom_raw.columns = df_ecom_raw.iloc[0]
df_ecom_raw = df_ecom_raw[1:].copy()

print(f"Reading POS Outlets data from: {f_pos}")
wb_pos = openpyxl.load_workbook(f_pos, data_only=True)
df_pos_raw = pd.DataFrame(wb_pos['Item Wise Performance'].values)
df_pos_raw.columns = df_pos_raw.iloc[0]
df_pos_raw = df_pos_raw[1:].copy()

# Fix Cargo classification
def fix_cat(row):
    name = str(row['Item Name']).lower()
    cat = str(row['Category'])
    sub = str(row['Sub-Category'])
    if 'cargo' in name:
        return 'Cargo', 'Cargo Trouser'
    return cat, sub

df_ecom_raw[['Category', 'Sub-Category']] = df_ecom_raw.apply(fix_cat, axis=1, result_type='expand')
df_pos_raw[['Category', 'Sub-Category']] = df_pos_raw.apply(fix_cat, axis=1, result_type='expand')

# Filter delivered E-commerce
df_ecom_deliv = df_ecom_raw[df_ecom_raw['Delivered or Not'] == 'Delivered'].copy()

print(f"Loaded {len(df_ecom_raw)} E-Com dispatches ({len(df_ecom_deliv)} delivered items) and {len(df_pos_raw)} POS outlet walk-in sales items.")

# -----------------------------------------------------------------------------
# 2. CREATE MASTER OMNICHANNEL WORKBOOK
# -----------------------------------------------------------------------------
wb_master = openpyxl.Workbook()
wb_master.remove(wb_master.active) # Remove default sheet

# Create sheets
ws_sum = wb_master.create_sheet(title='Master Summary')
ws_channel = wb_master.create_sheet(title='Sales Channel Breakdown')
ws_cat = wb_master.create_sheet(title='Category Wise Performance')
ws_svr = wb_master.create_sheet(title='DEEN Select vs Regular')
ws_prod = wb_master.create_sheet(title='Product Wise Performance')
ws_sku = wb_master.create_sheet(title='SKU Wise Performance')
ws_ledger = wb_master.create_sheet(title='Master Transaction Ledger')

# Calculations for Master Totals
ecom_units = int(df_ecom_deliv['Quantity'].sum())
ecom_mrp = float(df_ecom_raw['Total Value (৳)'].sum())
ecom_net = float(df_ecom_deliv['Total Value (৳)'].sum())
ecom_cogs = safe_sum_cogs(df_ecom_deliv['Total COGS (৳)'])
ecom_profit = ecom_net - ecom_cogs
ecom_margin = (ecom_profit / ecom_net * 100) if ecom_net else 0.0
ecom_orders = len(df_ecom_raw['Order Number'].unique())

pos_units = int(df_pos_raw['Quantity Sold'].sum())
pos_mrp = float((df_pos_raw['Unit Price (৳)'] * df_pos_raw['Quantity Sold']).sum())
pos_net = float(df_pos_raw['Line Total (৳)'].sum())
pos_cogs = safe_sum_cogs(df_pos_raw['Total COGS (৳)'])
pos_profit = pos_net - pos_cogs
pos_margin = (pos_profit / pos_net * 100) if pos_net else 0.0
pos_orders = len(df_pos_raw['Order Number'].unique())

tot_units = ecom_units + pos_units
tot_mrp = ecom_mrp + pos_mrp
tot_net = ecom_net + pos_net
tot_cogs = ecom_cogs + pos_cogs
tot_profit = tot_net - tot_cogs
tot_margin = (tot_profit / tot_net * 100) if tot_net else 0.0
tot_orders = ecom_orders + pos_orders
tot_aov = tot_net / tot_orders if tot_orders else 0.0

print(f"Master Totals: {tot_units:,} units sold, ৳{tot_net:,.0f} net sales, ৳{tot_cogs:,.0f} COGS, ৳{tot_profit:,.0f} profit ({tot_margin:.2f}% margin).")

# =============================================================================
# SHEET 1: MASTER SUMMARY
# =============================================================================
print("Building Sheet 1: Master Summary...")
ws_sum.views.sheetView[0].showGridLines = True

ws_sum.merge_cells('A1:N1')
ws_sum['A1'] = "DEEN COMMERCE — OCTOBER 2026 OMNICHANNEL OVERALL SALES & FULFILLMENT REPORT"
ws_sum['A1'].font = font_title
ws_sum['A1'].alignment = Alignment(horizontal='left', vertical='center')

ws_sum.merge_cells('A2:N2')
ws_sum['A2'] = "Consolidated Master Analysis · E-Commerce (Pathao Hermes) + 4 Physical Retail Branches (Mirpur, Cumilla, Wari, Sylhet) · 100% Realized Financials"
ws_sum['A2'].font = font_subtitle
ws_sum['A2'].alignment = Alignment(horizontal='left', vertical='center')

ws_sum.row_dimensions[1].height = 25
ws_sum.row_dimensions[2].height = 18

# Master KPI Cards (Rows 4-6)
kpis_master = [
    {'cs': 'A', 'ce': 'B', 'label': 'TOTAL OMNICHANNEL SALES', 'val': f"৳{tot_net:,.0f}", 'sub': f"Combined Net Settled Revenue"},
    {'cs': 'C', 'ce': 'D', 'label': 'TOTAL UNITS SOLD', 'val': f"{tot_units:,}", 'sub': f"E-Com: {ecom_units:,} | Retail: {pos_units:,}"},
    {'cs': 'E', 'ce': 'F', 'label': 'TOTAL PRODUCT COGS', 'val': f"৳{tot_cogs:,.0f}", 'sub': f"Exact WooCommerce REST API Cost"},
    {'cs': 'G', 'ce': 'H', 'label': 'REALIZED GROSS PROFIT', 'val': f"৳{tot_profit:,.0f}", 'sub': f"{tot_margin:.1f}% Blended Gross Margin"},
    {'cs': 'I', 'ce': 'J', 'label': 'TOTAL TRANSACTIONS', 'val': f"{tot_orders:,}", 'sub': f"{ecom_orders:,} E-Com + {pos_orders:,} POS"},
    {'cs': 'K', 'ce': 'L', 'label': 'BLENDED AOV / TICKET', 'val': f"৳{tot_aov:,.2f}", 'sub': f"Avg Unit Price: ৳{(tot_net/tot_units):,.2f}"},
    {'cs': 'M', 'ce': 'N', 'label': 'ONLINE vs RETAIL SPLIT', 'val': f"{(ecom_net/tot_net*100):.1f}% / {(pos_net/tot_net*100):.1f}%", 'sub': f"E-Com ৳{ecom_net:,.0f} | Outlets ৳{pos_net:,.0f}"},
]
for card in kpis_master:
    cs, ce = card['cs'], card['ce']
    ws_sum.merge_cells(f"{cs}4:{ce}4")
    ws_sum.merge_cells(f"{cs}5:{ce}5")
    ws_sum.merge_cells(f"{cs}6:{ce}6")
    ws_sum[f"{cs}4"] = card['label']
    ws_sum[f"{cs}4"].font = card_label_font
    ws_sum[f"{cs}4"].alignment = Alignment(horizontal='center', vertical='center')
    ws_sum[f"{cs}5"] = card['val']
    ws_sum[f"{cs}5"].font = card_value_font
    ws_sum[f"{cs}5"].alignment = Alignment(horizontal='center', vertical='center')
    ws_sum[f"{cs}6"] = card['sub']
    ws_sum[f"{cs}6"].font = card_sub_font
    ws_sum[f"{cs}6"].alignment = Alignment(horizontal='center', vertical='center')
    col_start_idx = openpyxl.utils.column_index_from_string(cs)
    col_end_idx = openpyxl.utils.column_index_from_string(ce)
    for c in range(col_start_idx, col_end_idx + 1):
        for r in range(4, 7):
            ws_sum.cell(row=r, column=c).fill = kpi_fill
            ws_sum.cell(row=r, column=c).border = thin_border

cur_row = 8
# Section 1: 5-Channel Comparative Performance Matrix
ws_sum.merge_cells(f"A{cur_row}:N{cur_row}")
ws_sum[f"A{cur_row}"] = "1. OVERALL SALES CHANNELS COMPARATIVE PERFORMANCE MATRIX (E-COMMERCE & 4 OUTLETS)"
ws_sum[f"A{cur_row}"].font = section_hdr_font
ws_sum[f"A{cur_row}"].fill = section_hdr_fill
ws_sum[f"A{cur_row}"].alignment = Alignment(horizontal='left', vertical='center')
ws_sum.row_dimensions[cur_row].height = 24
cur_row += 1

sec1_headers = [
    'Sales Channel', 'Channel Type', 'Fulfillment Center / POS Terminal', 'Orders / Receipts',
    'Units Sold', 'Total MRP Value (৳)', 'Discounts / Return Fee (৳)', 'Net Settled Sales (৳)',
    'Channel COGS (৳)', 'Realized Gross Profit (৳)', 'Gross Margin (%)', 'Average Ticket (AOV ৳)',
    'Revenue Share (%)', 'Volume Share (%)'
]
ws_sum.row_dimensions[cur_row].height = 22
for c_idx, c_name in enumerate(sec1_headers, 1):
    c = ws_sum.cell(row=cur_row, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row += 1

# Channels Data
channel_rows = [
    {
        'name': 'Online Store (E-Commerce)', 'type': 'Courier Fulfillment', 'term': 'Pathao Hermes Dispatches (Central & Split)',
        'orders': ecom_orders, 'units': ecom_units, 'mrp': ecom_mrp, 'disc': ecom_mrp - ecom_net,
        'net': ecom_net, 'cogs': ecom_cogs, 'profit': ecom_profit, 'margin': ecom_margin / 100.0,
        'aov': ecom_net / ecom_orders if ecom_orders else 0,
        'rev_share': ecom_net / tot_net, 'vol_share': ecom_units / tot_units
    }
]

# Outlet breakdown
outlet_names = [('Cumilla Branch', 'Cumilla Branch POS', 'POS Outlet ID 7 (Cashier 35)'),
                ('Mirpur Outlet', 'Mirpur Outlet POS', 'POS Outlet ID 2 (Cashier 3)'),
                ('Wari Branch', 'Wari Branch POS', 'POS Outlet ID 8 (Cashier 69)'),
                ('Sylhet Branch', 'Sylhet Branch POS', 'POS Outlet ID 9 (Cashier 572)')]

for out_key, out_disp, term_info in outlet_names:
    o_grp = df_pos_raw[df_pos_raw['Outlet Name'] == out_key]
    o_orders = len(o_grp['Order Number'].unique())
    o_units = int(o_grp['Quantity Sold'].sum())
    o_mrp = float((o_grp['Unit Price (৳)'] * o_grp['Quantity Sold']).sum())
    o_net = float(o_grp['Line Total (৳)'].sum())
    o_cogs = safe_sum_cogs(o_grp['Total COGS (৳)'])
    o_profit = o_net - o_cogs
    o_margin = (o_profit / o_net) if o_net else 0.0
    o_aov = o_net / o_orders if o_orders else 0.0
    channel_rows.append({
        'name': out_disp, 'type': 'Physical Retail POS', 'term': term_info,
        'orders': o_orders, 'units': o_units, 'mrp': o_mrp, 'disc': o_mrp - o_net,
        'net': o_net, 'cogs': o_cogs, 'profit': o_profit, 'margin': o_margin,
        'aov': o_aov, 'rev_share': o_net / tot_net, 'vol_share': o_units / tot_units
    })

for cr in channel_rows:
    ws_sum.row_dimensions[cur_row].height = 20
    r_vals = [
        cr['name'], cr['type'], cr['term'], cr['orders'], cr['units'],
        cr['mrp'], cr['disc'], cr['net'], cr['cogs'], cr['profit'],
        cr['margin'], cr['aov'], cr['rev_share'], cr['vol_share']
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_sum.cell(row=cur_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2, 3]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [4, 5, 6, 7, 8, 9, 10, 12]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [11, 13, 14]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row += 1

# Total Row for Section 1
ws_sum.row_dimensions[cur_row].height = 20
tot_row_ch = [
    "TOTAL OMNICHANNEL COMPANY", "All 5 Channels", "Online + 4 Physical Branches", tot_orders,
    tot_units, tot_mrp, tot_mrp - tot_net, tot_net, tot_cogs, tot_profit,
    tot_margin / 100.0, tot_aov, 1.0, 1.0
]
for c_idx, val in enumerate(tot_row_ch, 1):
    cell = ws_sum.cell(row=cur_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 2, 3]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [4, 5, 6, 7, 8, 9, 10, 12]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [11, 13, 14]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'
cur_row += 3

# Section 2: Brand Line Summary (Select vs Regular)
ws_sum.merge_cells(f"A{cur_row}:N{cur_row}")
ws_sum[f"A{cur_row}"] = "2. BRAND PORTFOLIO STRATEGY (DEEN SELECT vs DEEN REGULAR OVERALL)"
ws_sum[f"A{cur_row}"].font = section_hdr_font
ws_sum[f"A{cur_row}"].fill = section_hdr_fill
ws_sum[f"A{cur_row}"].alignment = Alignment(horizontal='left', vertical='center')
ws_sum.row_dimensions[cur_row].height = 24
cur_row += 1

sec2_sum_headers = [
    'Brand Portfolio Line', 'Scope & Product Description', 'Total Units Sold', 'Volume Share (%)',
    'Total MRP Value (৳)', 'Total Sold COGS (৳)', 'Net Settled Sales (৳)', 'Realized Gross Profit (৳)',
    'Gross Margin (%)', 'Average Unit Price (৳)', 'E-Com Share (%)', 'Retail Outlets Share (%)', 'Revenue Share (%)', 'Strategic Focus'
]
ws_sum.row_dimensions[cur_row].height = 22
for c_idx, c_name in enumerate(sec2_sum_headers, 1):
    c = ws_sum.cell(row=cur_row, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row += 1

sel_ecom_u = int(df_ecom_deliv[df_ecom_deliv['Brand Name'] == 'DEEN Select']['Quantity'].sum())
sel_ecom_v = float(df_ecom_deliv[df_ecom_deliv['Brand Name'] == 'DEEN Select']['Total Value (৳)'].sum())
sel_pos_u = int(df_pos_raw[df_pos_raw['Brand Name'] == 'DEEN Select']['Quantity Sold'].sum())
sel_pos_v = float(df_pos_raw[df_pos_raw['Brand Name'] == 'DEEN Select']['Line Total (৳)'].sum())

reg_ecom_u = int(df_ecom_deliv[df_ecom_deliv['Brand Name'] == 'DEEN']['Quantity'].sum())
reg_ecom_v = float(df_ecom_deliv[df_ecom_deliv['Brand Name'] == 'DEEN']['Total Value (৳)'].sum())
reg_pos_u = int(df_pos_raw[df_pos_raw['Brand Name'] == 'DEEN']['Quantity Sold'].sum())
reg_pos_v = float(df_pos_raw[df_pos_raw['Brand Name'] == 'DEEN']['Line Total (৳)'].sum())

tot_sel_units = sel_ecom_u + sel_pos_u
tot_sel_net = sel_ecom_v + sel_pos_v
tot_sel_cogs = safe_sum_cogs(df_ecom_deliv[df_ecom_deliv['Brand Name'] == 'DEEN Select']['Total COGS (৳)']) + safe_sum_cogs(df_pos_raw[df_pos_raw['Brand Name'] == 'DEEN Select']['Total COGS (৳)'])
tot_sel_profit = tot_sel_net - tot_sel_cogs
tot_sel_margin = (tot_sel_profit / tot_sel_net) if tot_sel_net else 0.0

tot_reg_units = reg_ecom_u + reg_pos_u
tot_reg_net = reg_ecom_v + reg_pos_v
tot_reg_cogs = safe_sum_cogs(df_ecom_deliv[df_ecom_deliv['Brand Name'] == 'DEEN']['Total COGS (৳)']) + safe_sum_cogs(df_pos_raw[df_pos_raw['Brand Name'] == 'DEEN']['Total COGS (৳)'])
tot_reg_profit = tot_reg_net - tot_reg_cogs
tot_reg_margin = (tot_reg_profit / tot_reg_net) if tot_reg_net else 0.0

brand_summary_rows = [
    {
        'brand': 'DEEN Select', 'desc': 'Curated European & International Export Overruns (Pull & Bear, Zara, Levis, etc.)',
        'units': tot_sel_units, 'vol_share': tot_sel_units / tot_units, 'mrp': tot_sel_net, # approximate MRP with net
        'cogs': tot_sel_cogs, 'net': tot_sel_net, 'profit': tot_sel_profit, 'margin': tot_sel_margin,
        'avg_p': tot_sel_net / tot_sel_units if tot_sel_units else 0,
        'ecom_share': sel_ecom_v / tot_sel_net if tot_sel_net else 0,
        'pos_share': sel_pos_v / tot_sel_net if tot_sel_net else 0,
        'rev_share': tot_sel_net / tot_net, 'focus': 'High AOV Driver & Premium Overrun Lines'
    },
    {
        'brand': 'DEEN Regular', 'desc': 'In-House Core Engineered Apparel Lines & Basics',
        'units': tot_reg_units, 'vol_share': tot_reg_units / tot_units, 'mrp': tot_reg_net,
        'cogs': tot_reg_cogs, 'net': tot_reg_net, 'profit': tot_reg_profit, 'margin': tot_reg_margin,
        'avg_p': tot_reg_net / tot_reg_units if tot_reg_units else 0,
        'ecom_share': reg_ecom_v / tot_reg_net if tot_reg_net else 0,
        'pos_share': reg_pos_v / tot_reg_net if tot_reg_net else 0,
        'rev_share': tot_reg_net / tot_net, 'focus': 'Volume Backbone & Reliable Core Retention'
    }
]

for bsr in brand_summary_rows:
    ws_sum.row_dimensions[cur_row].height = 20
    r_vals = [
        bsr['brand'], bsr['desc'], bsr['units'], bsr['vol_share'], bsr['mrp'],
        bsr['cogs'], bsr['net'], bsr['profit'], bsr['margin'], bsr['avg_p'],
        bsr['ecom_share'], bsr['pos_share'], bsr['rev_share'], bsr['focus']
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_sum.cell(row=cur_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2, 14]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [3, 5, 6, 7, 8, 10]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [4, 9, 11, 12, 13]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row += 1

# Total Row for Section 2
ws_sum.row_dimensions[cur_row].height = 20
tot_row_brand = [
    "TOTAL BRAND PORTFOLIO", "100% DEEN In-House + Select Lines", tot_units, 1.0, tot_net,
    tot_cogs, tot_net, tot_profit, tot_margin / 100.0, tot_net / tot_units if tot_units else 0,
    ecom_net / tot_net, pos_net / tot_net, 1.0, "Complete Brand Portfolio"
]
for c_idx, val in enumerate(tot_row_brand, 1):
    cell = ws_sum.cell(row=cur_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 2, 14]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [3, 5, 6, 7, 8, 10]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [4, 9, 11, 12, 13]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'

# Adjust column widths for Sheet 1
sum_widths = {
    'A': 28, 'B': 24, 'C': 34, 'D': 16, 'E': 14, 'F': 18,
    'G': 18, 'H': 18, 'I': 18, 'J': 18, 'K': 16, 'L': 18, 'M': 16, 'N': 16
}
for col_char, w in sum_widths.items():
    ws_sum.column_dimensions[col_char].width = w

ws_sum.freeze_panes = 'C8'

# =============================================================================
# SHEET 2: SALES CHANNEL BREAKDOWN
# =============================================================================
print("Building Sheet 2: Sales Channel Breakdown...")
ws_channel.views.sheetView[0].showGridLines = True

ws_channel.merge_cells('A1:L1')
ws_channel['A1'] = "DEEN COMMERCE — OCTOBER 2026 SALES CHANNEL DEEP-DIVE ANALYSIS"
ws_channel['A1'].font = font_title
ws_channel['A1'].alignment = Alignment(horizontal='left', vertical='center')

ws_channel.merge_cells('A2:L2')
ws_channel['A2'] = "Channel Operational Efficiency · Online Store Courier vs In-Store Terminals (Mirpur, Cumilla, Wari, Sylhet)"
ws_channel['A2'].font = font_subtitle
ws_channel['A2'].alignment = Alignment(horizontal='left', vertical='center')

ws_channel.row_dimensions[1].height = 25
ws_channel.row_dimensions[2].height = 18

cur_c_row = 4
ws_channel.merge_cells(f"A{cur_c_row}:L{cur_c_row}")
ws_channel[f"A{cur_c_row}"] = "CHANNEL DISPATCH & TRANSACTION OVERVIEW"
ws_channel[f"A{cur_c_row}"].font = section_hdr_font
ws_channel[f"A{cur_c_row}"].fill = section_hdr_fill
ws_channel.row_dimensions[cur_c_row].height = 24
cur_c_row += 1

ch_table_cols = [
    'Sales Channel', 'Fulfillment / Terminal Type', 'Active Terminals / Couriers', 'Total Receipts / Orders',
    'Total Units Sold', 'Avg Items Per Ticket', 'Net Settled Sales (৳)', 'Realized Profit (৳)',
    'Gross Margin (%)', 'Average Order Value (৳)', 'Channel Share of Company (%)', 'Top Selling Apparel Category'
]
ws_channel.row_dimensions[cur_c_row].height = 22
for c_idx, c_name in enumerate(ch_table_cols, 1):
    c = ws_channel.cell(row=cur_c_row, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_c_row += 1

# Channel detailed rows
ch_deep_rows = []

# E-Com
top_ecom_cat = df_ecom_deliv.groupby('Category')['Total Value (৳)'].sum().idxmax()
ch_deep_rows.append({
    'name': 'Online Store (E-Commerce)', 'type': 'Hermes Courier Dispatches', 'courier': 'Pathao Hermes Courier API',
    'orders': ecom_orders, 'units': ecom_units, 'ipt': ecom_units / ecom_orders if ecom_orders else 0,
    'net': ecom_net, 'profit': ecom_profit, 'margin': ecom_margin / 100.0,
    'aov': ecom_net / ecom_orders if ecom_orders else 0,
    'share': ecom_net / tot_net, 'top_cat': top_ecom_cat
})

# POS channels
for out_key, out_disp, term_info in outlet_names:
    o_grp = df_pos_raw[df_pos_raw['Outlet Name'] == out_key]
    o_orders = len(o_grp['Order Number'].unique())
    o_units = int(o_grp['Quantity Sold'].sum())
    o_net = float(o_grp['Line Total (৳)'].sum())
    o_cogs = safe_sum_cogs(o_grp['Total COGS (৳)'])
    o_profit = o_net - o_cogs
    o_margin = (o_profit / o_net) if o_net else 0.0
    o_aov = o_net / o_orders if o_orders else 0.0
    top_cat = o_grp.groupby('Category')['Line Total (৳)'].sum().idxmax()
    ch_deep_rows.append({
        'name': out_disp, 'type': 'Physical POS Terminal', 'courier': term_info,
        'orders': o_orders, 'units': o_units, 'ipt': o_units / o_orders if o_orders else 0,
        'net': o_net, 'profit': o_profit, 'margin': o_margin,
        'aov': o_aov, 'share': o_net / tot_net, 'top_cat': top_cat
    })

for cdr in ch_deep_rows:
    ws_channel.row_dimensions[cur_c_row].height = 20
    r_vals = [
        cdr['name'], cdr['type'], cdr['courier'], cdr['orders'], cdr['units'],
        cdr['ipt'], cdr['net'], cdr['profit'], cdr['margin'], cdr['aov'],
        cdr['share'], cdr['top_cat']
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_channel.cell(row=cur_c_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2, 3, 12]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [4, 5, 7, 8, 10]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx == 6:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.00'
        elif c_idx in [9, 11]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_c_row += 1

# Total Row for Channels
ws_channel.row_dimensions[cur_c_row].height = 20
tot_ch_deep = [
    "TOTAL ALL CHANNELS", "Omnichannel Operations", "All 5 Channels Reconciled", tot_orders,
    tot_units, tot_units / tot_orders if tot_orders else 0, tot_net, tot_profit,
    tot_margin / 100.0, tot_aov, 1.0, "Jeans (Top Omnichannel)"
]
for c_idx, val in enumerate(tot_ch_deep, 1):
    cell = ws_channel.cell(row=cur_c_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 2, 3, 12]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [4, 5, 7, 8, 10]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx == 6:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.00'
    elif c_idx in [9, 11]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'

# Adjust column widths
for col in ws_channel.columns:
    col_letter = get_column_letter(col[0].column)
    max_len = 0
    for cell in col:
        v_str = str(cell.value or '')
        if len(v_str) > max_len and '\n' not in v_str and len(v_str) < 50:
            max_len = len(v_str)
    ws_channel.column_dimensions[col_letter].width = min(max(max_len + 3, 16), 34)
ws_channel.column_dimensions['A'].width = 28

ws_channel.freeze_panes = 'C6'

# =============================================================================
# SHEET 3: CATEGORY WISE PERFORMANCE (OMNICHANNEL)
# =============================================================================
print("Building Sheet 3: Category Wise Performance (Omnichannel)...")
ws_cat.views.sheetView[0].showGridLines = True

ws_cat.merge_cells('A1:O1')
ws_cat['A1'] = "DEEN COMMERCE — OCTOBER 2026 CATEGORY-WISE OMNICHANNEL SALES PERFORMANCE"
ws_cat['A1'].font = font_title
ws_cat['A1'].alignment = Alignment(horizontal='left', vertical='center')

ws_cat.merge_cells('A2:O2')
ws_cat['A2'] = "Consolidated Category Benchmark across E-Commerce & All 4 Physical Outlets · Sold Item Counts, MRP, COGS, Net Sales & Margins"
ws_cat['A2'].font = font_subtitle
ws_cat['A2'].alignment = Alignment(horizontal='left', vertical='center')

ws_cat.row_dimensions[1].height = 25
ws_cat.row_dimensions[2].height = 18

cur_cat_row = 4
ws_cat.merge_cells(f"A{cur_cat_row}:O{cur_cat_row}")
ws_cat[f"A{cur_cat_row}"] = "1. MAIN APPAREL CATEGORY OMNICHANNEL PERFORMANCE MATRIX"
ws_cat[f"A{cur_cat_row}"].font = section_hdr_font
ws_cat[f"A{cur_cat_row}"].fill = section_hdr_fill
ws_cat.row_dimensions[cur_cat_row].height = 24
cur_cat_row += 1

omni_cat_cols = [
    'Apparel Category',
    'E-Com Sold Units', 'E-Com Net Sales (৳)',
    'POS Outlets Sold Units', 'POS Outlets Net Sales (৳)',
    'Total Units Sold (Omnichannel)', 'Total Gross MRP (৳)', 'Total Sold COGS (৳)', 'Total Net Sales (৳)',
    'Realized Gross Profit (৳)', 'Gross Margin (%)', 'Average Unit Price (৳)',
    'E-Com Revenue Share (%)', 'POS Revenue Share (%)', 'Total Company Share (%)'
]
ws_cat.row_dimensions[cur_cat_row].height = 24
for c_idx, c_name in enumerate(omni_cat_cols, 1):
    c = ws_cat.cell(row=cur_cat_row, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    if 2 <= c_idx <= 3:
        c.fill = ecom_hdr_fill
    elif 4 <= c_idx <= 5:
        c.fill = pos_hdr_fill
    else:
        c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_cat_row += 1

# Aggregate all categories across both E-Com and POS
all_categories = sorted(list(set(df_ecom_deliv['Category'].unique()).union(set(df_pos_raw['Category'].unique()))))

cat_omni_data = []
for cat_name in all_categories:
    e_grp = df_ecom_deliv[df_ecom_deliv['Category'] == cat_name]
    p_grp = df_pos_raw[df_pos_raw['Category'] == cat_name]
    
    e_u = int(e_grp['Quantity'].sum())
    e_v = float(e_grp['Total Value (৳)'].sum())
    e_cg = safe_sum_cogs(e_grp['Total COGS (৳)'])
    
    p_u = int(p_grp['Quantity Sold'].sum())
    p_v = float(p_grp['Line Total (৳)'].sum())
    p_cg = safe_sum_cogs(p_grp['Total COGS (৳)'])
    
    # MRP
    e_mrp = float(df_ecom_raw[df_ecom_raw['Category'] == cat_name]['Total Value (৳)'].sum())
    p_mrp = float((p_grp['Unit Price (৳)'] * p_grp['Quantity Sold']).sum())
    tot_c_mrp = e_mrp + p_mrp
    
    c_tot_u = e_u + p_u
    c_tot_v = e_v + p_v
    c_tot_cg = e_cg + p_cg
    c_tot_gp = c_tot_v - c_tot_cg
    c_tot_gm = (c_tot_gp / c_tot_v) if c_tot_v else 0.0
    c_avg_p = (c_tot_v / c_tot_u) if c_tot_u else 0.0
    
    e_share = (e_v / c_tot_v) if c_tot_v else 0.0
    p_share = (p_v / c_tot_v) if c_tot_v else 0.0
    comp_share = (c_tot_v / tot_net) if tot_net else 0.0
    
    cat_omni_data.append({
        'cat': cat_name, 'e_u': e_u, 'e_v': e_v, 'p_u': p_u, 'p_v': p_v,
        'tot_u': c_tot_u, 'mrp': tot_c_mrp, 'cogs': c_tot_cg, 'net': c_tot_v,
        'gp': c_tot_gp, 'gm': c_tot_gm, 'avg_p': c_avg_p,
        'e_share': e_share, 'p_share': p_share, 'comp_share': comp_share
    })

cat_omni_data.sort(key=lambda x: -x['net'])

for cd in cat_omni_data:
    ws_cat.row_dimensions[cur_cat_row].height = 19
    r_vals = [
        cd['cat'], cd['e_u'], cd['e_v'], cd['p_u'], cd['p_v'],
        cd['tot_u'], cd['mrp'], cd['cogs'], cd['net'], cd['gp'],
        cd['gm'], cd['avg_p'], cd['e_share'], cd['p_share'], cd['comp_share']
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_cat.cell(row=cur_cat_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx == 1:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [2, 3, 4, 5, 6, 7, 8, 9, 10, 12]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [11, 13, 14, 15]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_cat_row += 1

# Total Row for Section 1
ws_cat.row_dimensions[cur_cat_row].height = 20
tot_row_cat_omni = [
    "TOTAL ALL CATEGORIES", ecom_units, ecom_net, pos_units, pos_net,
    tot_units, tot_mrp, tot_cogs, tot_net, tot_profit,
    tot_margin / 100.0, tot_net / tot_units if tot_units else 0,
    ecom_net / tot_net, pos_net / tot_net, 1.0
]
for c_idx, val in enumerate(tot_row_cat_omni, 1):
    cell = ws_cat.cell(row=cur_cat_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx == 1:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [2, 3, 4, 5, 6, 7, 8, 9, 10, 12]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [11, 13, 14, 15]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'
cur_cat_row += 3

# Section 2: Sub-Category Breakdown (Omnichannel)
ws_cat.merge_cells(f"A{cur_cat_row}:O{cur_cat_row}")
ws_cat[f"A{cur_cat_row}"] = "2. SUB-CATEGORY OMNICHANNEL BREAKDOWN (GRANULAR PERFORMANCE)"
ws_cat[f"A{cur_cat_row}"].font = section_hdr_font
ws_cat[f"A{cur_cat_row}"].fill = section_hdr_fill
ws_cat.row_dimensions[cur_cat_row].height = 24
cur_cat_row += 1

subcat_cols_omni = [
    'Category', 'Sub-Category',
    'E-Com Sold Units', 'E-Com Net Sales (৳)',
    'POS Outlets Sold Units', 'POS Outlets Net Sales (৳)',
    'Total Units Sold', 'Total Sold COGS (৳)', 'Total Net Sales (৳)',
    'Realized Gross Profit (৳)', 'Gross Margin (%)', 'Average Unit Price (৳)',
    'Share of Category (%)', 'Share of Total Sales (%)'
]
ws_cat.row_dimensions[cur_cat_row].height = 22
for c_idx, c_name in enumerate(subcat_cols_omni, 1):
    c = ws_cat.cell(row=cur_cat_row, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    if 3 <= c_idx <= 4:
        c.fill = ecom_hdr_fill
    elif 5 <= c_idx <= 6:
        c.fill = pos_hdr_fill
    else:
        c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_cat_row += 1

# Sub-Category aggregations
all_subcats = set()
for (c, s) in df_ecom_deliv[['Category', 'Sub-Category']].drop_duplicates().values:
    all_subcats.add((c, s))
for (c, s) in df_pos_raw[['Category', 'Sub-Category']].drop_duplicates().values:
    all_subcats.add((c, s))

subcat_omni_data = []
cat_net_totals_omni = {c['cat']: c['net'] for c in cat_omni_data}
for (c_name, s_name) in all_subcats:
    e_grp = df_ecom_deliv[(df_ecom_deliv['Category'] == c_name) & (df_ecom_deliv['Sub-Category'] == s_name)]
    p_grp = df_pos_raw[(df_pos_raw['Category'] == c_name) & (df_pos_raw['Sub-Category'] == s_name)]
    
    e_u = int(e_grp['Quantity'].sum())
    e_v = float(e_grp['Total Value (৳)'].sum())
    
    p_u = int(p_grp['Quantity Sold'].sum())
    p_v = float(p_grp['Line Total (৳)'].sum())
    
    tot_s_u = e_u + p_u
    tot_s_v = e_v + p_v
    tot_s_cg = safe_sum_cogs(e_grp['Total COGS (৳)']) + safe_sum_cogs(p_grp['Total COGS (৳)'])
    tot_s_gp = tot_s_v - tot_s_cg
    tot_s_gm = (tot_s_gp / tot_s_v) if tot_s_v else 0.0
    tot_s_avg_p = (tot_s_v / tot_s_u) if tot_s_u else 0.0
    
    parent_cat_v = cat_net_totals_omni.get(c_name, 0.0)
    cat_share = (tot_s_v / parent_cat_v) if parent_cat_v else 0.0
    tot_share = (tot_s_v / tot_net) if tot_net else 0.0
    
    subcat_omni_data.append({
        'cat': c_name, 'sub': s_name, 'e_u': e_u, 'e_v': e_v, 'p_u': p_u, 'p_v': p_v,
        'tot_u': tot_s_u, 'cogs': tot_s_cg, 'net': tot_s_v, 'gp': tot_s_gp, 'gm': tot_s_gm,
        'avg_p': tot_s_avg_p, 'cat_share': cat_share, 'tot_share': tot_share
    })

subcat_omni_data.sort(key=lambda x: (x['cat'], -x['net']))

for sc in subcat_omni_data:
    ws_cat.row_dimensions[cur_cat_row].height = 19
    r_vals = [
        sc['cat'], sc['sub'], sc['e_u'], sc['e_v'], sc['p_u'], sc['p_v'],
        sc['tot_u'], sc['cogs'], sc['net'], sc['gp'], sc['gm'],
        sc['avg_p'], sc['cat_share'], sc['tot_share']
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_cat.cell(row=cur_cat_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [3, 4, 5, 6, 7, 8, 9, 10, 12]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [11, 13, 14]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_cat_row += 1

# Total Row for Section 2
ws_cat.row_dimensions[cur_cat_row].height = 20
tot_row_sub_omni = [
    "TOTAL ALL SUB-CATEGORIES", f"{len(subcat_omni_data)} Variants", ecom_units, ecom_net, pos_units, pos_net,
    tot_units, tot_cogs, tot_net, tot_profit,
    tot_margin / 100.0, tot_net / tot_units if tot_units else 0,
    1.0, 1.0
]
for c_idx, val in enumerate(tot_row_sub_omni, 1):
    cell = ws_cat.cell(row=cur_cat_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 2]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [3, 4, 5, 6, 7, 8, 9, 10, 12]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [11, 13, 14]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'

# Adjust column widths
for col in ws_cat.columns:
    col_letter = get_column_letter(col[0].column)
    max_len = 0
    for cell in col:
        v_str = str(cell.value or '')
        if len(v_str) > max_len and '\n' not in v_str and len(v_str) < 50:
            max_len = len(v_str)
    ws_cat.column_dimensions[col_letter].width = min(max(max_len + 3, 15), 32)
ws_cat.column_dimensions['A'].width = 24
ws_cat.column_dimensions['B'].width = 24

ws_cat.freeze_panes = 'C6'

# =============================================================================
# SHEET 4: DEEN SELECT vs REGULAR (OMNICHANNEL)
# =============================================================================
print("Building Sheet 4: DEEN Select vs Regular (Omnichannel)...")
ws_svr.views.sheetView[0].showGridLines = True

ws_svr.merge_cells('A1:Q1')
ws_svr['A1'] = "DEEN COMMERCE — OCTOBER 2026 DEEN SELECT vs REGULAR OMNICHANNEL PERFORMANCE"
ws_svr['A1'].font = font_title
ws_svr['A1'].alignment = Alignment(horizontal='left', vertical='center')

ws_svr.merge_cells('A2:Q2')
ws_svr['A2'] = "Company-Wide Portfolio Split · Curated Export Brands (DEEN Select) vs Core In-House Apparel (DEEN Regular) by Category Across All Channels"
ws_svr['A2'].font = font_subtitle
ws_svr['A2'].alignment = Alignment(horizontal='left', vertical='center')

ws_svr.row_dimensions[1].height = 25
ws_svr.row_dimensions[2].height = 18

cur_svr_row = 4
ws_svr.merge_cells(f"A{cur_svr_row}:Q{cur_svr_row}")
ws_svr[f"A{cur_svr_row}"] = "SIDE-BY-SIDE CATEGORY MATRIX (DEEN SELECT vs DEEN REGULAR)"
ws_svr[f"A{cur_svr_row}"].font = section_hdr_font
ws_svr[f"A{cur_svr_row}"].fill = section_hdr_fill
ws_svr.row_dimensions[cur_svr_row].height = 24
cur_svr_row += 1

# Super-headers
ws_svr.row_dimensions[cur_svr_row].height = 20
ws_svr[f"A{cur_svr_row}"] = "Apparel Category"
ws_svr[f"A{cur_svr_row}"].font = tbl_hdr_font
ws_svr[f"A{cur_svr_row}"].fill = tbl_hdr_fill
ws_svr[f"A{cur_svr_row}"].alignment = Alignment(horizontal='center', vertical='center')

ws_svr.merge_cells(f"B{cur_svr_row}:G{cur_svr_row}")
ws_svr[f"B{cur_svr_row}"] = "DEEN SELECT (CURATED EXPORT & OVERRUNS)"
ws_svr[f"B{cur_svr_row}"].font = tbl_hdr_font
ws_svr[f"B{cur_svr_row}"].fill = select_hdr_fill
ws_svr[f"B{cur_svr_row}"].alignment = Alignment(horizontal='center', vertical='center')

ws_svr.merge_cells(f"H{cur_svr_row}:M{cur_svr_row}")
ws_svr[f"H{cur_svr_row}"] = "DEEN REGULAR (IN-HOUSE CORE LINES)"
ws_svr[f"H{cur_svr_row}"].font = tbl_hdr_font
ws_svr[f"H{cur_svr_row}"].fill = regular_hdr_fill
ws_svr[f"H{cur_svr_row}"].alignment = Alignment(horizontal='center', vertical='center')

ws_svr.merge_cells(f"N{cur_svr_row}:Q{cur_svr_row}")
ws_svr[f"N{cur_svr_row}"] = "OMNICHANNEL TOTALS & SELECT SHARE"
ws_svr[f"N{cur_svr_row}"].font = tbl_hdr_font
ws_svr[f"N{cur_svr_row}"].fill = tbl_hdr_fill
ws_svr[f"N{cur_svr_row}"].alignment = Alignment(horizontal='center', vertical='center')

cur_svr_row += 1

# Sub-column headers
sub_cols_svr = [
    'Apparel Category',
    # Select cols
    'Select Units Sold', 'Select Gross MRP (৳)', 'Select Sold COGS (৳)', 'Select Net Sales (৳)', 'Select Profit (৳)', 'Select Margin (%)',
    # Regular cols
    'Regular Units Sold', 'Regular Gross MRP (৳)', 'Regular Sold COGS (৳)', 'Regular Net Sales (৳)', 'Regular Profit (৳)', 'Regular Margin (%)',
    # Benchmark cols
    'Total Units Sold', 'Total Net Sales (৳)', 'Select Volume Share (%)', 'Select Revenue Share (%)'
]
ws_svr.row_dimensions[cur_svr_row].height = 24
for c_idx, c_name in enumerate(sub_cols_svr, 1):
    cell = ws_svr.cell(row=cur_svr_row, column=c_idx, value=c_name)
    cell.font = tbl_hdr_font
    if 2 <= c_idx <= 7:
        cell.fill = PatternFill(start_color="3730A3", end_color="3730A3", fill_type="solid")
    elif 8 <= c_idx <= 13:
        cell.fill = PatternFill(start_color="0369A1", end_color="0369A1", fill_type="solid")
    else:
        cell.fill = tbl_hdr_fill
    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_svr_row += 1

# Build matrix
omni_svr_matrix = []
for cat_name in all_categories:
    e_grp = df_ecom_deliv[df_ecom_deliv['Category'] == cat_name]
    p_grp = df_pos_raw[df_pos_raw['Category'] == cat_name]
    
    # Select
    e_sel = e_grp[e_grp['Brand Name'] == 'DEEN Select']
    p_sel = p_grp[p_grp['Brand Name'] == 'DEEN Select']
    sel_u = int(e_sel['Quantity'].sum()) + int(p_sel['Quantity Sold'].sum())
    sel_mrp = float(e_sel['Total Value (৳)'].sum()) + float((p_sel['Unit Price (৳)'] * p_sel['Quantity Sold']).sum())
    sel_net = float(e_sel['Total Value (৳)'].sum()) + float(p_sel['Line Total (৳)'].sum())
    sel_cg = safe_sum_cogs(e_sel['Total COGS (৳)']) + safe_sum_cogs(p_sel['Total COGS (৳)'])
    sel_gp = sel_net - sel_cg
    sel_gm = (sel_gp / sel_net) if sel_net > 0 else 0.0
    
    # Regular
    e_reg = e_grp[e_grp['Brand Name'] == 'DEEN']
    p_reg = p_grp[p_grp['Brand Name'] == 'DEEN']
    reg_u = int(e_reg['Quantity'].sum()) + int(p_reg['Quantity Sold'].sum())
    reg_mrp = float(e_reg['Total Value (৳)'].sum()) + float((p_reg['Unit Price (৳)'] * p_reg['Quantity Sold']).sum())
    reg_net = float(e_reg['Total Value (৳)'].sum()) + float(p_reg['Line Total (৳)'].sum())
    reg_cg = safe_sum_cogs(e_reg['Total COGS (৳)']) + safe_sum_cogs(p_reg['Total COGS (৳)'])
    reg_gp = reg_net - reg_cg
    reg_gm = (reg_gp / reg_net) if reg_net > 0 else 0.0
    
    tot_cat_u = sel_u + reg_u
    tot_cat_v = sel_net + reg_net
    sel_vol_p = (sel_u / tot_cat_u) if tot_cat_u > 0 else 0.0
    sel_rev_p = (sel_net / tot_cat_v) if tot_cat_v > 0 else 0.0
    
    omni_svr_matrix.append({
        'cat': cat_name,
        'sel_u': sel_u, 'sel_mrp': sel_mrp, 'sel_cg': sel_cg, 'sel_net': sel_net, 'sel_gp': sel_gp, 'sel_gm': sel_gm,
        'reg_u': reg_u, 'reg_mrp': reg_mrp, 'reg_cg': reg_cg, 'reg_net': reg_net, 'reg_gp': reg_gp, 'reg_gm': reg_gm,
        'tot_u': tot_cat_u, 'tot_net': tot_cat_v, 'sel_vol_p': sel_vol_p, 'sel_rev_p': sel_rev_p
    })

omni_svr_matrix.sort(key=lambda x: -x['tot_net'])

for r in omni_svr_matrix:
    ws_svr.row_dimensions[cur_svr_row].height = 19
    r_vals = [
        r['cat'],
        r['sel_u'], r['sel_mrp'], r['sel_cg'], r['sel_net'], r['sel_gp'], r['sel_gm'],
        r['reg_u'], r['reg_mrp'], r['reg_cg'], r['reg_net'], r['reg_gp'], r['reg_gm'],
        r['tot_u'], r['tot_net'], r['sel_vol_p'], r['sel_rev_p']
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_svr.cell(row=cur_svr_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx == 1:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [7, 13, 16, 17]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_svr_row += 1

# Total Row for Section 1
ws_svr.row_dimensions[cur_svr_row].height = 20
tot_svr_omni = [
    "TOTAL COMPANY PORTFOLIO",
    tot_sel_units, tot_sel_net, tot_sel_cogs, tot_sel_net, tot_sel_profit, tot_sel_margin,
    tot_reg_units, tot_reg_net, tot_reg_cogs, tot_reg_net, tot_reg_profit, tot_reg_margin,
    tot_units, tot_net, (tot_sel_units / tot_units), (tot_sel_net / tot_net)
]
for c_idx, val in enumerate(tot_svr_omni, 1):
    cell = ws_svr.cell(row=cur_svr_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx == 1:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [7, 13, 16, 17]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'

# Adjust column widths
for col in ws_svr.columns:
    col_letter = get_column_letter(col[0].column)
    max_len = 0
    for cell in col:
        v_str = str(cell.value or '')
        if len(v_str) > max_len and '\n' not in v_str and len(v_str) < 50:
            max_len = len(v_str)
    ws_svr.column_dimensions[col_letter].width = min(max(max_len + 3, 14), 32)
ws_svr.column_dimensions['A'].width = 24

ws_svr.freeze_panes = 'B7'

# =============================================================================
# SHEET 5: PRODUCT WISE PERFORMANCE (OMNICHANNEL)
# =============================================================================
print("Building Sheet 5: Product Wise Performance (Omnichannel)...")
ws_prod.views.sheetView[0].showGridLines = True

# Group all items by Base Product Name
prod_omni = {}

# Process E-com delivered items
for _, it in df_ecom_deliv.iterrows():
    p_name = str(it['Base Product Name'] or it['Item Name']).strip()
    brand = str(it['Brand Name']).strip()
    cat = str(it['Category']).strip()
    sub = str(it['Sub-Category']).strip()
    sku = str(it['SKU']).strip()
    price = float(it['Unit Price (৳)'] or 0.0)
    raw_u_cg = it.get('Unit COGS (৳)')
    cogs = float(raw_u_cg) if (raw_u_cg is not None and str(raw_u_cg).strip() != "didn'tget") else None
    q = int(it['Quantity'] or 0)
    v = float(it['Total Value (৳)'] or 0.0)
    raw_t_cg = it.get('Total COGS (৳)')
    cg = float(raw_t_cg) if (raw_t_cg is not None and str(raw_t_cg).strip() != "didn'tget") else 0.0
    has_exact = (cogs is not None)
    
    if p_name not in prod_omni:
        prod_omni[p_name] = {
            'brand': brand, 'cat': cat, 'sub': sub, 'name': p_name, 'base_sku': sku,
            'unit_price': price,
            'ecom_u': 0, 'ecom_v': 0.0,
            'cum_u': 0, 'cum_v': 0.0,
            'mir_u': 0, 'mir_v': 0.0,
            'war_u': 0, 'war_v': 0.0,
            'syl_u': 0, 'syl_v': 0.0,
            'tot_u': 0, 'tot_v': 0.0, 'tot_cg': 0.0,
            'exact_cg_u': 0, 'exact_cg_val': 0.0
        }
    p = prod_omni[p_name]
    p['ecom_u'] += q
    p['ecom_v'] += v
    p['tot_u'] += q
    p['tot_v'] += v
    if has_exact:
        p['exact_cg_u'] += q
        p['exact_cg_val'] += (cogs * q)
        p['tot_cg'] += cg

# Process POS items
for _, it in df_pos_raw.iterrows():
    p_name = str(it['Base Product Name'] or it['Item Name']).strip()
    brand = str(it['Brand Name']).strip()
    cat = str(it['Category']).strip()
    sub = str(it['Sub-Category']).strip()
    sku = str(it['SKU']).strip()
    outlet = str(it['Outlet Name']).strip()
    price = float(it['Unit Price (৳)'] or 0.0)
    raw_u_cg = it.get('Unit COGS (৳)')
    cogs = float(raw_u_cg) if (raw_u_cg is not None and str(raw_u_cg).strip() != "didn'tget") else None
    q = int(it['Quantity Sold'] or 0)
    v = float(it['Line Total (৳)'] or 0.0)
    raw_t_cg = it.get('Total COGS (৳)')
    cg = float(raw_t_cg) if (raw_t_cg is not None and str(raw_t_cg).strip() != "didn'tget") else 0.0
    has_exact = (cogs is not None)
    
    if p_name not in prod_omni:
        prod_omni[p_name] = {
            'brand': brand, 'cat': cat, 'sub': sub, 'name': p_name, 'base_sku': sku,
            'unit_price': price,
            'ecom_u': 0, 'ecom_v': 0.0,
            'cum_u': 0, 'cum_v': 0.0,
            'mir_u': 0, 'mir_v': 0.0,
            'war_u': 0, 'war_v': 0.0,
            'syl_u': 0, 'syl_v': 0.0,
            'tot_u': 0, 'tot_v': 0.0, 'tot_cg': 0.0,
            'exact_cg_u': 0, 'exact_cg_val': 0.0
        }
    p = prod_omni[p_name]
    if 'Cumilla' in outlet:
        p['cum_u'] += q
        p['cum_v'] += v
    elif 'Mirpur' in outlet:
        p['mir_u'] += q
        p['mir_v'] += v
    elif 'Wari' in outlet:
        p['war_u'] += q
        p['war_v'] += v
    elif 'Sylhet' in outlet:
        p['syl_u'] += q
        p['syl_v'] += v
    p['tot_u'] += q
    p['tot_v'] += v
    if has_exact:
        p['exact_cg_u'] += q
        p['exact_cg_val'] += (cogs * q)
        p['tot_cg'] += cg

prod_list = list(prod_omni.values())
prod_list.sort(key=lambda x: -x['tot_v'])

prod_headers = [
    'Brand Name', 'Category', 'Sub-Category', 'Product Name', 'Base SKU',
    'Unit Price (৳)', 'Unit COGS (৳)',
    'E-Com Units', 'Cumilla Units', 'Mirpur Units', 'Wari Units', 'Sylhet Units',
    'Total Units Sold', 'Total Net Sales (৳)', 'Total Product COGS (৳)',
    'Realized Gross Profit (৳)', 'Gross Margin (%)', 'Top Selling Channel'
]

ws_prod.row_dimensions[1].height = 24
for c_idx, c_name in enumerate(prod_headers, 1):
    c = ws_prod.cell(row=1, column=c_idx, value=c_name)
    c.font = header_font
    c.fill = header_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

for r_idx, pr in enumerate(prod_list, 2):
    ws_prod.row_dimensions[r_idx].height = 18
    is_exact_all = (pr['exact_cg_u'] == pr['tot_u']) and (pr['tot_u'] > 0)
    if is_exact_all:
        unit_cogs_disp = round(pr['exact_cg_val'] / pr['tot_u'])
        tot_cogs_disp = round(pr['exact_cg_val'])
        gp = round(pr['tot_v'] - tot_cogs_disp)
        gm = (gp / pr['tot_v']) if pr['tot_v'] else 0.0
    else:
        unit_cogs_disp = "didn'tget"
        tot_cogs_disp = "didn'tget"
        gp = "didn'tget"
        gm = "didn'tget"
    
    # Determine top channel
    ch_map = {
        'Online E-Com': pr['ecom_u'],
        'Cumilla': pr['cum_u'],
        'Mirpur': pr['mir_u'],
        'Wari': pr['war_u'],
        'Sylhet': pr['syl_u']
    }
    top_ch = max(ch_map.items(), key=lambda x: x[1])[0]
    
    r_vals = [
        pr['brand'], pr['cat'], pr['sub'], pr['name'], pr['base_sku'],
        pr['unit_price'], unit_cogs_disp,
        pr['ecom_u'], pr['cum_u'], pr['mir_u'], pr['war_u'], pr['syl_u'],
        pr['tot_u'], pr['tot_v'], tot_cogs_disp, gp, gm, top_ch
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_prod.cell(row=r_idx, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2, 3, 4, 18]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx == 5:
            cell.alignment = Alignment(horizontal='center', vertical='center')
        elif c_idx in [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]:
            if isinstance(val, (int, float)):
                cell.alignment = Alignment(horizontal='right', vertical='center')
                cell.number_format = '#,##0'
            else:
                cell.alignment = Alignment(horizontal='center', vertical='center')
        elif c_idx == 17:
            if isinstance(val, (int, float)):
                cell.alignment = Alignment(horizontal='right', vertical='center')
                cell.number_format = '0.0%'
            else:
                cell.alignment = Alignment(horizontal='center', vertical='center')

# Total Row for Products
tot_prod_r_idx = len(prod_list) + 2
ws_prod.row_dimensions[tot_prod_r_idx].height = 20
tot_prod_row = [
    "TOTAL ALL PRODUCTS", f"{len(prod_list)} Products", "-", "-", "-",
    "-", "-",
    ecom_units, sum(p['cum_u'] for p in prod_list), sum(p['mir_u'] for p in prod_list),
    sum(p['war_u'] for p in prod_list), sum(p['syl_u'] for p in prod_list),
    tot_units, tot_net,
    tot_cogs if tot_cogs > 0 else "didn'tget",
    tot_profit if tot_cogs > 0 else "didn'tget",
    tot_margin / 100.0 if tot_cogs > 0 else "didn'tget",
    "All 5 Channels"
]
for c_idx, val in enumerate(tot_prod_row, 1):
    cell = ws_prod.cell(row=tot_prod_r_idx, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 2, 3, 4, 18]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx == 5:
        cell.alignment = Alignment(horizontal='center', vertical='center')
    elif c_idx in [8, 9, 10, 11, 12, 13, 14, 15, 16]:
        if isinstance(val, (int, float)):
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        else:
            cell.alignment = Alignment(horizontal='center', vertical='center')
    elif c_idx == 17:
        if isinstance(val, (int, float)):
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
        else:
            cell.alignment = Alignment(horizontal='center', vertical='center')

for col in ws_prod.columns:
    col_letter = get_column_letter(col[0].column)
    max_len = 0
    for cell in col:
        v_str = str(cell.value or '')
        if len(v_str) > max_len and '\n' not in v_str and len(v_str) < 50:
            max_len = len(v_str)
    ws_prod.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 40)
ws_prod.column_dimensions['D'].width = 38

ws_prod.freeze_panes = 'F2'

# =============================================================================
# SHEET 6: SKU WISE PERFORMANCE (OMNICHANNEL)
# =============================================================================
print("Building Sheet 6: SKU Wise Performance (Omnichannel)...")
ws_sku.views.sheetView[0].showGridLines = True

sku_omni = {}
for _, it in df_ecom_deliv.iterrows():
    sku = str(it['SKU']).strip()
    size = str(it['Size']).strip()
    p_name = str(it['Base Product Name'] or it['Item Name']).strip()
    brand = str(it['Brand Name']).strip()
    cat = str(it['Category']).strip()
    sub = str(it['Sub-Category']).strip()
    price = float(it['Unit Price (৳)'] or 0.0)
    raw_u_cg = it.get('Unit COGS (৳)')
    cogs = float(raw_u_cg) if (raw_u_cg is not None and str(raw_u_cg).strip() != "didn'tget") else None
    q = int(it['Quantity'] or 0)
    v = float(it['Total Value (৳)'] or 0.0)
    raw_t_cg = it.get('Total COGS (৳)')
    cg = float(raw_t_cg) if (raw_t_cg is not None and str(raw_t_cg).strip() != "didn'tget") else 0.0
    has_exact = (cogs is not None)
    
    sku_key = f"{sku}__{size}__{p_name}"
    if sku_key not in sku_omni:
        sku_omni[sku_key] = {
            'brand': brand, 'cat': cat, 'sub': sub, 'name': p_name, 'sku': sku, 'size': size,
            'price': price, 'ecom_u': 0, 'pos_u': 0, 'tot_u': 0, 'tot_v': 0.0,
            'exact_cg_u': 0, 'exact_cg_val': 0.0
        }
    s = sku_omni[sku_key]
    s['ecom_u'] += q
    s['tot_u'] += q
    s['tot_v'] += v
    if has_exact:
        s['exact_cg_u'] += q
        s['exact_cg_val'] += (cogs * q)

for _, it in df_pos_raw.iterrows():
    sku = str(it['SKU']).strip()
    size = str(it['Size']).strip()
    p_name = str(it['Base Product Name'] or it['Item Name']).strip()
    brand = str(it['Brand Name']).strip()
    cat = str(it['Category']).strip()
    sub = str(it['Sub-Category']).strip()
    price = float(it['Unit Price (৳)'] or 0.0)
    raw_u_cg = it.get('Unit COGS (৳)')
    cogs = float(raw_u_cg) if (raw_u_cg is not None and str(raw_u_cg).strip() != "didn'tget") else None
    q = int(it['Quantity Sold'] or 0)
    v = float(it['Line Total (৳)'] or 0.0)
    raw_t_cg = it.get('Total COGS (৳)')
    cg = float(raw_t_cg) if (raw_t_cg is not None and str(raw_t_cg).strip() != "didn'tget") else 0.0
    has_exact = (cogs is not None)
    
    sku_key = f"{sku}__{size}__{p_name}"
    if sku_key not in sku_omni:
        sku_omni[sku_key] = {
            'brand': brand, 'cat': cat, 'sub': sub, 'name': p_name, 'sku': sku, 'size': size,
            'price': price, 'ecom_u': 0, 'pos_u': 0, 'tot_u': 0, 'tot_v': 0.0,
            'exact_cg_u': 0, 'exact_cg_val': 0.0
        }
    s = sku_omni[sku_key]
    s['pos_u'] += q
    s['tot_u'] += q
    s['tot_v'] += v
    if has_exact:
        s['exact_cg_u'] += q
        s['exact_cg_val'] += (cogs * q)

sku_list = list(sku_omni.values())
sku_list.sort(key=lambda x: -x['tot_v'])

sku_headers = [
    'Brand Name', 'Category', 'Sub-Category', 'Product Name', 'SKU Code', 'Size',
    'Unit Price (৳)', 'Unit COGS (৳)', 'E-Com Sold Units', 'POS Outlets Sold Units',
    'Total Units Sold', 'Total Net Sales (৳)', 'Total Sold COGS (৳)',
    'Realized Gross Profit (৳)', 'Gross Margin (%)'
]
ws_sku.row_dimensions[1].height = 24
for c_idx, c_name in enumerate(sku_headers, 1):
    c = ws_sku.cell(row=1, column=c_idx, value=c_name)
    c.font = header_font
    c.fill = header_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

for r_idx, sk in enumerate(sku_list, 2):
    ws_sku.row_dimensions[r_idx].height = 18
    is_exact_all = (sk['exact_cg_u'] == sk['tot_u']) and (sk['tot_u'] > 0)
    if is_exact_all:
        unit_cogs_disp = round(sk['exact_cg_val'] / sk['tot_u'])
        tot_cogs_disp = round(sk['exact_cg_val'])
        gp = round(sk['tot_v'] - tot_cogs_disp)
        gm = (gp / sk['tot_v']) if sk['tot_v'] else 0.0
    else:
        unit_cogs_disp = "didn'tget"
        tot_cogs_disp = "didn'tget"
        gp = "didn'tget"
        gm = "didn'tget"
    
    r_vals = [
        sk['brand'], sk['cat'], sk['sub'], sk['name'], sk['sku'], sk['size'],
        sk['price'], unit_cogs_disp, sk['ecom_u'], sk['pos_u'],
        sk['tot_u'], sk['tot_v'], tot_cogs_disp, gp, gm
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_sku.cell(row=r_idx, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2, 3, 4]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [5, 6]:
            cell.alignment = Alignment(horizontal='center', vertical='center')
        elif c_idx in [7, 8, 9, 10, 11, 12, 13, 14]:
            if isinstance(val, (int, float)):
                cell.alignment = Alignment(horizontal='right', vertical='center')
                cell.number_format = '#,##0'
            else:
                cell.alignment = Alignment(horizontal='center', vertical='center')
        elif c_idx == 15:
            if isinstance(val, (int, float)):
                cell.alignment = Alignment(horizontal='right', vertical='center')
                cell.number_format = '0.0%'
            else:
                cell.alignment = Alignment(horizontal='center', vertical='center')

# Total Row for SKUs
tot_sku_r_idx = len(sku_list) + 2
ws_sku.row_dimensions[tot_sku_r_idx].height = 20
tot_sku_row = [
    "TOTAL ALL SKUS", f"{len(sku_list)} SKUs", "-", "-", "-", "-",
    "-", "-", ecom_units, pos_units,
    tot_units, tot_net,
    tot_cogs if tot_cogs > 0 else "didn'tget",
    tot_profit if tot_cogs > 0 else "didn'tget",
    tot_margin / 100.0 if tot_cogs > 0 else "didn'tget"
]
for c_idx, val in enumerate(tot_sku_row, 1):
    cell = ws_sku.cell(row=tot_sku_r_idx, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 2, 3, 4]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [5, 6]:
        cell.alignment = Alignment(horizontal='center', vertical='center')
    elif c_idx in [9, 10, 11, 12, 13, 14]:
        if isinstance(val, (int, float)):
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        else:
            cell.alignment = Alignment(horizontal='center', vertical='center')
    elif c_idx == 15:
        if isinstance(val, (int, float)):
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
        else:
            cell.alignment = Alignment(horizontal='center', vertical='center')

for col in ws_sku.columns:
    col_letter = get_column_letter(col[0].column)
    max_len = 0
    for cell in col:
        v_str = str(cell.value or '')
        if len(v_str) > max_len and '\n' not in v_str and len(v_str) < 50:
            max_len = len(v_str)
    ws_sku.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 40)
ws_sku.column_dimensions['D'].width = 38

ws_sku.freeze_panes = 'G2'

# =============================================================================
# SHEET 7: MASTER TRANSACTION LEDGER (ALL LINE ITEMS)
# =============================================================================
print("Building Sheet 7: Master Transaction Ledger (All Line Items)...")
ws_ledger.views.sheetView[0].showGridLines = True

ledger_headers = [
    'Order Number', 'Order Date', 'Sales Channel', 'Fulfillment Store / Terminal',
    'Customer Name', 'Phone', 'City', 'Payment Method', 'Brand Name', 'Category', 'Sub-Category',
    'Item Name', 'SKU', 'Size', 'Unit Price (৳)', 'Quantity Sold', 'Line Total Net (৳)',
    'Unit COGS (৳)', 'Total COGS (৳)', 'Gross Profit (৳)', 'Gross Margin (%)', 'Transaction Status'
]
ws_ledger.row_dimensions[1].height = 24
for c_idx, c_name in enumerate(ledger_headers, 1):
    c = ws_ledger.cell(row=1, column=c_idx, value=c_name)
    c.font = header_font
    c.fill = header_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

ledger_rows = []

# E-Com delivered items
for _, it in df_ecom_deliv.iterrows():
    p = float(it['Unit Price (৳)'] or 0.0)
    raw_u_cg = it.get('Unit COGS (৳)')
    has_exact = (raw_u_cg is not None and str(raw_u_cg).strip() != "didn'tget")
    q = int(it['Quantity'] or 0)
    v = float(it['Total Value (৳)'] or 0.0)
    if has_exact:
        cg = float(raw_u_cg)
        tot_cg = float(it.get('Total COGS (৳)') or (cg * q))
        gp = v - tot_cg
        gm = (gp / v) if v else 0.0
    else:
        cg = "didn'tget"
        tot_cg = "didn'tget"
        gp = "didn'tget"
        gm = "didn'tget"
    ledger_rows.append([
        it['Order Number'], it['Order Date'], 'Online E-Commerce', it['Fulfillment Store'],
        it['Customer Name'], it['Customer Phone'], it['City'], 'COD (Courier)',
        it['Brand Name'], it['Category'], it['Sub-Category'], it['Item Name'],
        it['SKU'], it['Size'], p, q, v, cg, tot_cg, gp, gm, 'Delivered & Settled'
    ])

# POS items
for _, it in df_pos_raw.iterrows():
    p = float(it['Unit Price (৳)'] or 0.0)
    raw_u_cg = it.get('Unit COGS (৳)')
    has_exact = (raw_u_cg is not None and str(raw_u_cg).strip() != "didn'tget")
    q = int(it['Quantity Sold'] or 0)
    v = float(it['Line Total (৳)'] or 0.0)
    if has_exact:
        cg = float(raw_u_cg)
        tot_cg = float(it.get('Total COGS (৳)') or (cg * q))
        gp = v - tot_cg
        gm = (gp / v) if v else 0.0
    else:
        cg = "didn'tget"
        tot_cg = "didn'tget"
        gp = "didn'tget"
        gm = "didn'tget"
    ledger_rows.append([
        it['Order Number'], it['Order Date'], it['Outlet Name'], f"Terminal {it['Outlet POS ID']} ({it['Cashier']})",
        it['Customer Name'], it['Customer Phone'], 'Retail Branch Walk-In', it['Payment Method'],
        it['Brand Name'], it['Category'], it['Sub-Category'], it['Item Name'],
        it['SKU'], it['Size'], p, q, v, cg, tot_cg, gp, gm, 'In-Store Counter Sale'
    ])

for r_idx, lr in enumerate(ledger_rows, 2):
    ws_ledger.row_dimensions[r_idx].height = 18
    for c_idx, val in enumerate(lr, 1):
        cell = ws_ledger.cell(row=r_idx, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2, 6, 13, 14]:
            cell.alignment = Alignment(horizontal='center', vertical='center')
        elif c_idx in [3, 4, 5, 7, 8, 9, 10, 11, 12, 22]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [15, 16, 17, 18, 19, 20]:
            if isinstance(val, (int, float)):
                cell.alignment = Alignment(horizontal='right', vertical='center')
                cell.number_format = '#,##0'
            else:
                cell.alignment = Alignment(horizontal='center', vertical='center')
        elif c_idx == 21:
            if isinstance(val, (int, float)):
                cell.alignment = Alignment(horizontal='right', vertical='center')
                cell.number_format = '0.0%'
            else:
                cell.alignment = Alignment(horizontal='center', vertical='center')

for col in ws_ledger.columns:
    col_letter = get_column_letter(col[0].column)
    max_len = 0
    for cell in col:
        v_str = str(cell.value or '')
        if len(v_str) > max_len and '\n' not in v_str and len(v_str) < 50:
            max_len = len(v_str)
    ws_ledger.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 36)
ws_ledger.column_dimensions['L'].width = 36

ws_ledger.freeze_panes = 'E2'

# Save Master Workbook
public_out_path = os.path.join('public', 'Sample Docs', 'October 2026 Overall Sales & Channel Performance (Ecom & 4 Outlets).xlsx')
os.makedirs(os.path.dirname(public_out_path), exist_ok=True)
wb_master.save(public_out_path)
print(f"✅ Saved to public directory: {public_out_path}")

try:
    print(f"\nSaving Master Omnichannel Workbook to: {out_path}...")
    wb_master.save(out_path)
    print(f"✅ Successfully created Master Omnichannel Workbook: {out_path}")
except PermissionError:
    backup_out_path = os.path.join('Sample Docs', 'October 2026 Overall Sales & Channel Performance (Ecom & 4 Outlets)_Updated.xlsx')
    wb_master.save(backup_out_path)
    print(f"⚠️ Warning: {out_path} is currently open in Excel.")
    print(f"✅ Successfully saved updated version to: {backup_out_path}")
print("\n🎉 ALL ASPECTS (E-COMMERCE & 4 OUTLETS) CONSOLIDATED IN ONE COMPREHENSIVE WORKBOOK!")
