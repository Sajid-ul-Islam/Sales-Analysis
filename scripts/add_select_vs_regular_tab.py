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
print("🚀 ADDING 'DEEN Select vs Regular' CATEGORY TABS TO OCTOBER 2026 WORKBOOKS")
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
select_hdr_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid") # Indigo for Selects
regular_hdr_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid") # Sky for Regular
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

def fix_cargo_classification(df):
    def mapper(row):
        name = str(row['Item Name']).lower()
        cat = str(row['Category'])
        sub = str(row['Sub-Category'])
        if 'cargo' in name:
            return 'Cargo', 'Cargo Trouser'
        return cat, sub
    df[['Category', 'Sub-Category']] = df.apply(mapper, axis=1, result_type='expand')
    return df

# =============================================================================
# 1. E-COMMERCE WORKBOOK (October 2026 Item, Product & SKU Performance.xlsx)
# =============================================================================
ecom_file = 'Sample Docs/October 2026 Item, Product & SKU Performance.xlsx'
print(f"Loading E-Commerce workbook: {ecom_file}")
wb1 = openpyxl.load_workbook(ecom_file)

ws1 = wb1['Item Wise Performance']
data1 = ws1.values
headers1 = next(data1)
df1 = pd.DataFrame(data1, columns=headers1)
df1 = fix_cargo_classification(df1)

d_df1 = df1[df1['Delivered or Not'] == 'Delivered']

# Totals for Select vs Regular
sel_deliv = d_df1[d_df1['Brand Name'] == 'DEEN Select']
reg_deliv = d_df1[d_df1['Brand Name'] == 'DEEN']

tot_sel_u = int(sel_deliv['Quantity'].sum())
tot_sel_v = float(sel_deliv['Total Value (৳)'].sum())
tot_sel_cg = safe_sum_cogs(sel_deliv['Total COGS (৳)'])
tot_sel_gp = tot_sel_v - tot_sel_cg
tot_sel_gm = (tot_sel_gp / tot_sel_v * 100) if tot_sel_v else 0.0

tot_reg_u = int(reg_deliv['Quantity'].sum())
tot_reg_v = float(reg_deliv['Total Value (৳)'].sum())
tot_reg_cg = safe_sum_cogs(reg_deliv['Total COGS (৳)'])
tot_reg_gp = tot_reg_v - tot_reg_cg
tot_reg_gm = (tot_reg_gp / tot_reg_v * 100) if tot_reg_v else 0.0

tot_all_u = tot_sel_u + tot_reg_u
tot_all_v = tot_sel_v + tot_reg_v
tot_all_cg = tot_sel_cg + tot_reg_cg
tot_all_gp = tot_all_v - tot_all_cg
tot_all_gm = (tot_all_gp / tot_all_v * 100) if tot_all_v else 0.0

# Remove existing sheet if present
sheet_title = 'DEEN Select vs Regular'
if sheet_title in wb1.sheetnames:
    del wb1[sheet_title]

# Create sheet at index 2 (right after Category Wise Performance)
ws_svr1 = wb1.create_sheet(title=sheet_title, index=2)
ws_svr1.views.sheetView[0].showGridLines = True

# Title Banner
ws_svr1.merge_cells('A1:Q1')
ws_svr1['A1'] = "DEEN COMMERCE — OCTOBER 2026 DEEN SELECT vs REGULAR CATEGORY PERFORMANCE (E-COMMERCE)"
ws_svr1['A1'].font = font_title
ws_svr1['A1'].alignment = Alignment(horizontal='left', vertical='center')

ws_svr1.merge_cells('A2:Q2')
ws_svr1['A2'] = "Brand Portfolio Comparison · Curated European/Export Lines (DEEN Select) vs In-House Core Garments (DEEN Regular) Across Every Category"
ws_svr1['A2'].font = font_subtitle
ws_svr1['A2'].alignment = Alignment(horizontal='left', vertical='center')

ws_svr1.row_dimensions[1].height = 25
ws_svr1.row_dimensions[2].height = 18

# KPI Ribbon (Rows 4-6)
kpis_ecom = [
    {'cs': 'A', 'ce': 'C', 'label': 'DEEN SELECT SOLD UNITS', 'val': f"{tot_sel_u:,}", 'sub': f"{(tot_sel_u/tot_all_u*100):.1f}% of Total Dispatches ({tot_sel_u:,} / {tot_all_u:,} pcs)"},
    {'cs': 'D', 'ce': 'F', 'label': 'DEEN SELECT NET REVENUE', 'val': f"৳{tot_sel_v:,.0f}", 'sub': f"{(tot_sel_v/tot_all_v*100):.1f}% Revenue Share · {tot_sel_gm:.1f}% Gross Margin"},
    {'cs': 'G', 'ce': 'I', 'label': 'DEEN REGULAR SOLD UNITS', 'val': f"{tot_reg_u:,}", 'sub': f"{(tot_reg_u/tot_all_u*100):.1f}% of Total Dispatches ({tot_reg_u:,} / {tot_all_u:,} pcs)"},
    {'cs': 'J', 'ce': 'L', 'label': 'DEEN REGULAR NET REVENUE', 'val': f"৳{tot_reg_v:,.0f}", 'sub': f"{(tot_reg_v/tot_all_v*100):.1f}% Revenue Share · {tot_reg_gm:.1f}% Gross Margin"},
    {'cs': 'M', 'ce': 'Q', 'label': 'PORTFOLIO BLENDED MARGIN', 'val': f"{tot_all_gm:.1f}%", 'sub': f"Realized Gross Profit: ৳{tot_all_gp:,.0f} on ৳{tot_all_v:,.0f} Sales"},
]
for card in kpis_ecom:
    cs, ce = card['cs'], card['ce']
    ws_svr1.merge_cells(f"{cs}4:{ce}4")
    ws_svr1.merge_cells(f"{cs}5:{ce}5")
    ws_svr1.merge_cells(f"{cs}6:{ce}6")
    ws_svr1[f"{cs}4"] = card['label']
    ws_svr1[f"{cs}4"].font = card_label_font
    ws_svr1[f"{cs}4"].alignment = Alignment(horizontal='center', vertical='center')
    ws_svr1[f"{cs}5"] = card['val']
    ws_svr1[f"{cs}5"].font = card_value_font
    ws_svr1[f"{cs}5"].alignment = Alignment(horizontal='center', vertical='center')
    ws_svr1[f"{cs}6"] = card['sub']
    ws_svr1[f"{cs}6"].font = card_sub_font
    ws_svr1[f"{cs}6"].alignment = Alignment(horizontal='center', vertical='center')
    col_start_idx = openpyxl.utils.column_index_from_string(cs)
    col_end_idx = openpyxl.utils.column_index_from_string(ce)
    for c in range(col_start_idx, col_end_idx + 1):
        for r in range(4, 7):
            ws_svr1.cell(row=r, column=c).fill = kpi_fill
            ws_svr1.cell(row=r, column=c).border = thin_border

cur_row = 8
# Section 1 Header
ws_svr1.merge_cells(f"A{cur_row}:Q{cur_row}")
ws_svr1[f"A{cur_row}"] = "1. SIDE-BY-SIDE CATEGORY PERFORMANCE MATRIX (DEEN SELECT vs DEEN REGULAR)"
ws_svr1[f"A{cur_row}"].font = section_hdr_font
ws_svr1[f"A{cur_row}"].fill = section_hdr_fill
ws_svr1[f"A{cur_row}"].alignment = Alignment(horizontal='left', vertical='center')
ws_svr1.row_dimensions[cur_row].height = 24
cur_row += 1

# Super-headers for Section 1
ws_svr1.row_dimensions[cur_row].height = 20
ws_svr1[f"A{cur_row}"] = "Apparel Category"
ws_svr1[f"A{cur_row}"].font = tbl_hdr_font
ws_svr1[f"A{cur_row}"].fill = tbl_hdr_fill
ws_svr1[f"A{cur_row}"].alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

# DEEN Select Header Block (B to G)
ws_svr1.merge_cells(f"B{cur_row}:G{cur_row}")
ws_svr1[f"B{cur_row}"] = "DEEN SELECT (CURATED EXPORT & OVERRUNS)"
ws_svr1[f"B{cur_row}"].font = tbl_hdr_font
ws_svr1[f"B{cur_row}"].fill = select_hdr_fill
ws_svr1[f"B{cur_row}"].alignment = Alignment(horizontal='center', vertical='center')

# DEEN Regular Header Block (H to M)
ws_svr1.merge_cells(f"H{cur_row}:M{cur_row}")
ws_svr1[f"H{cur_row}"] = "DEEN REGULAR (IN-HOUSE CORE LINES)"
ws_svr1[f"H{cur_row}"].font = tbl_hdr_font
ws_svr1[f"H{cur_row}"].fill = regular_hdr_fill
ws_svr1[f"H{cur_row}"].alignment = Alignment(horizontal='center', vertical='center')

# Comparison / Total Header Block (N to Q)
ws_svr1.merge_cells(f"N{cur_row}:Q{cur_row}")
ws_svr1[f"N{cur_row}"] = "CATEGORY BENCHMARK & SELECT SHARE"
ws_svr1[f"N{cur_row}"].font = tbl_hdr_font
ws_svr1[f"N{cur_row}"].fill = tbl_hdr_fill
ws_svr1[f"N{cur_row}"].alignment = Alignment(horizontal='center', vertical='center')

cur_row += 1

# Sub-column headers
sub_cols1 = [
    'Apparel Category',
    # Select cols
    'Select Sold Units', 'Select Total MRP (৳)', 'Select COGS (৳)', 'Select Net Sales (৳)', 'Select Profit (৳)', 'Select Margin (%)',
    # Regular cols
    'Regular Sold Units', 'Regular Total MRP (৳)', 'Regular COGS (৳)', 'Regular Net Sales (৳)', 'Regular Profit (৳)', 'Regular Margin (%)',
    # Benchmark cols
    'Total Sold Units', 'Total Net Sales (৳)', 'Select Volume Share (%)', 'Select Revenue Share (%)'
]
ws_svr1.row_dimensions[cur_row].height = 24
for c_idx, c_name in enumerate(sub_cols1, 1):
    cell = ws_svr1.cell(row=cur_row, column=c_idx, value=c_name)
    cell.font = tbl_hdr_font
    if 2 <= c_idx <= 7:
        cell.fill = PatternFill(start_color="3730A3", end_color="3730A3", fill_type="solid") # Darker indigo
    elif 8 <= c_idx <= 13:
        cell.fill = PatternFill(start_color="0369A1", end_color="0369A1", fill_type="solid") # Darker sky
    else:
        cell.fill = tbl_hdr_fill
    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row += 1

# Compute Category Matrix rows
matrix_data1 = []
for cat_name, grp in df1.groupby('Category'):
    d_grp = grp[grp['Delivered or Not'] == 'Delivered']
    
    # Select
    grp_sel = grp[grp['Brand Name'] == 'DEEN Select']
    d_sel = d_grp[d_grp['Brand Name'] == 'DEEN Select']
    sel_u = int(d_sel['Quantity'].sum())
    sel_mrp = float(grp_sel['Total Value (৳)'].sum())
    sel_net = float(d_sel['Total Value (৳)'].sum())
    sel_cg = safe_sum_cogs(d_sel['Total COGS (৳)'])
    sel_gp = sel_net - sel_cg
    sel_gm = (sel_gp / sel_net) if sel_net > 0 else 0.0
    
    # Regular
    grp_reg = grp[grp['Brand Name'] == 'DEEN']
    d_reg = d_grp[d_grp['Brand Name'] == 'DEEN']
    reg_u = int(d_reg['Quantity'].sum())
    reg_mrp = float(grp_reg['Total Value (৳)'].sum())
    reg_net = float(d_reg['Total Value (৳)'].sum())
    reg_cg = safe_sum_cogs(d_reg['Total COGS (৳)'])
    reg_gp = reg_net - reg_cg
    reg_gm = (reg_gp / reg_net) if reg_net > 0 else 0.0
    
    tot_u = sel_u + reg_u
    tot_net = sel_net + reg_net
    sel_vol_share = (sel_u / tot_u) if tot_u > 0 else 0.0
    sel_rev_share = (sel_net / tot_net) if tot_net > 0 else 0.0
    
    matrix_data1.append({
        'cat': cat_name,
        'sel_u': sel_u, 'sel_mrp': sel_mrp, 'sel_cg': sel_cg, 'sel_net': sel_net, 'sel_gp': sel_gp, 'sel_gm': sel_gm,
        'reg_u': reg_u, 'reg_mrp': reg_mrp, 'reg_cg': reg_cg, 'reg_net': reg_net, 'reg_gp': reg_gp, 'reg_gm': reg_gm,
        'tot_u': tot_u, 'tot_net': tot_net, 'sel_vol_share': sel_vol_share, 'sel_rev_share': sel_rev_share
    })

# Sort categories by Total Net Sales descending
matrix_data1.sort(key=lambda x: -x['tot_net'])

for row_data in matrix_data1:
    ws_svr1.row_dimensions[cur_row].height = 19
    r_vals = [
        row_data['cat'],
        row_data['sel_u'], row_data['sel_mrp'], row_data['sel_cg'], row_data['sel_net'], row_data['sel_gp'], row_data['sel_gm'],
        row_data['reg_u'], row_data['reg_mrp'], row_data['reg_cg'], row_data['reg_net'], row_data['reg_gp'], row_data['reg_gm'],
        row_data['tot_u'], row_data['tot_net'], row_data['sel_vol_share'], row_data['sel_rev_share']
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_svr1.cell(row=cur_row, column=c_idx, value=val)
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
    cur_row += 1

# Total Row for Section 1
ws_svr1.row_dimensions[cur_row].height = 20
tot_sel_mrp = sum(r['sel_mrp'] for r in matrix_data1)
tot_reg_mrp = sum(r['reg_mrp'] for r in matrix_data1)

tot_row_vals1 = [
    "TOTAL PORTFOLIO",
    tot_sel_u, tot_sel_mrp, tot_sel_cg, tot_sel_v, tot_sel_gp, tot_sel_gm / 100.0,
    tot_reg_u, tot_reg_mrp, tot_reg_cg, tot_reg_v, tot_reg_gp, tot_reg_gm / 100.0,
    tot_all_u, tot_all_v, (tot_sel_u / tot_all_u), (tot_sel_v / tot_all_v)
]
for c_idx, val in enumerate(tot_row_vals1, 1):
    cell = ws_svr1.cell(row=cur_row, column=c_idx, value=val)
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
cur_row += 3

# Section 2: Detailed Line-by-Line Breakdown by Category & Brand Line
ws_svr1.merge_cells(f"A{cur_row}:Q{cur_row}")
ws_svr1[f"A{cur_row}"] = "2. DETAILED CATEGORY & BRAND LINE BREAKDOWN (SELECT vs REGULAR ROWS)"
ws_svr1[f"A{cur_row}"].font = section_hdr_font
ws_svr1[f"A{cur_row}"].fill = section_hdr_fill
ws_svr1[f"A{cur_row}"].alignment = Alignment(horizontal='left', vertical='center')
ws_svr1.row_dimensions[cur_row].height = 24
cur_row += 1

sec2_cols1 = [
    'Apparel Category', 'Brand Line Tier', 'Dispatched Units', 'Sold Item Counts', 'Delivery Rate (%)',
    'Total MRP (৳)', 'Total Sold COGS (৳)', 'Net Sales (৳)', 'Realized Gross Profit (৳)', 'Gross Margin (%)',
    'Average Unit Price (৳)', 'Share in Category (%)', 'Share of Total Sales (%)'
]
ws_svr1.row_dimensions[cur_row].height = 22
for c_idx, c_name in enumerate(sec2_cols1, 1):
    c = ws_svr1.cell(row=cur_row, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row += 1

line_rows1 = []
for cat_name, grp in df1.groupby('Category'):
    cat_tot_sales = float(grp[grp['Delivered or Not'] == 'Delivered']['Total Value (৳)'].sum())
    for brand_name in ['DEEN Select', 'DEEN']:
        b_grp = grp[grp['Brand Name'] == brand_name]
        if len(b_grp) == 0:
            continue
        d_b_grp = b_grp[b_grp['Delivered or Not'] == 'Delivered']
        disp_u = int(b_grp['Quantity'].sum())
        sold_u = int(d_b_grp['Quantity'].sum())
        deliv_rate = (sold_u / disp_u) if disp_u > 0 else 0.0
        mrp_v = float(b_grp['Total Value (৳)'].sum())
        net_s = float(d_b_grp['Total Value (৳)'].sum())
        cogs_v = safe_sum_cogs(d_b_grp['Total COGS (৳)'])
        gp = net_s - cogs_v
        gm = (gp / net_s) if net_s > 0 else 0.0
        avg_p = (net_s / sold_u) if sold_u > 0 else 0.0
        cat_share = (net_s / cat_tot_sales) if cat_tot_sales > 0 else 0.0
        tot_share = (net_s / tot_all_v) if tot_all_v > 0 else 0.0
        
        line_rows1.append({
            'cat': cat_name, 'brand': brand_name, 'disp_u': disp_u, 'sold_u': sold_u, 'deliv_rate': deliv_rate,
            'mrp': mrp_v, 'cogs': cogs_v, 'net_s': net_s, 'gp': gp, 'gm': gm, 'avg_p': avg_p,
            'cat_share': cat_share, 'tot_share': tot_share
        })
line_rows1.sort(key=lambda x: (x['cat'], -x['net_s']))

for lr in line_rows1:
    ws_svr1.row_dimensions[cur_row].height = 19
    r_vals = [
        lr['cat'], lr['brand'], lr['disp_u'], lr['sold_u'], lr['deliv_rate'],
        lr['mrp'], lr['cogs'], lr['net_s'], lr['gp'], lr['gm'],
        lr['avg_p'], lr['cat_share'], lr['tot_share']
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_svr1.cell(row=cur_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
            if c_idx == 2 and val == 'DEEN Select':
                cell.font = Font(name='Calibri', size=9.5, bold=True, color='4F46E5')
            elif c_idx == 2 and val == 'DEEN':
                cell.font = Font(name='Calibri', size=9.5, bold=True, color='0284C7')
        elif c_idx in [3, 4, 6, 7, 8, 9, 11]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [5, 10, 12, 13]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row += 1

# Section 3: Channel Contribution (Central Warehouse vs Retail Split)
cur_row += 2
ws_svr1.merge_cells(f"A{cur_row}:Q{cur_row}")
ws_svr1[f"A{cur_row}"] = "3. FULFILLMENT DISPATCH CHANNEL BRAND LINE SPLIT"
ws_svr1[f"A{cur_row}"].font = section_hdr_font
ws_svr1[f"A{cur_row}"].fill = section_hdr_fill
ws_svr1[f"A{cur_row}"].alignment = Alignment(horizontal='left', vertical='center')
ws_svr1.row_dimensions[cur_row].height = 24
cur_row += 1

sec3_cols1 = [
    'Fulfillment Channel', 'Select Sold Units', 'Select Net Sales (৳)', 'Select Share (%)',
    'Regular Sold Units', 'Regular Net Sales (৳)', 'Regular Share (%)',
    'Total Channel Units', 'Total Channel Net Sales (৳)', 'Channel Share of E-Com (%)'
]
ws_svr1.row_dimensions[cur_row].height = 22
for c_idx, c_name in enumerate(sec3_cols1, 1):
    c = ws_svr1.cell(row=cur_row, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row += 1

for ch, grp in d_df1.groupby('Fulfillment Channel'):
    sel = grp[grp['Brand Name'] == 'DEEN Select']
    reg = grp[grp['Brand Name'] == 'DEEN']
    sel_u = int(sel['Quantity'].sum())
    reg_u = int(reg['Quantity'].sum())
    sel_v = float(sel['Total Value (৳)'].sum())
    reg_v = float(reg['Total Value (৳)'].sum())
    tot_u = sel_u + reg_u
    tot_v = sel_v + reg_v
    
    ws_svr1.row_dimensions[cur_row].height = 19
    r_vals = [
        ch, sel_u, sel_v, (sel_v / tot_v) if tot_v > 0 else 0.0,
        reg_u, reg_v, (reg_v / tot_v) if tot_v > 0 else 0.0,
        tot_u, tot_v, (tot_v / tot_all_v) if tot_all_v > 0 else 0.0
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_svr1.cell(row=cur_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx == 1:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [2, 3, 5, 6, 8, 9]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [4, 7, 10]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row += 1

# Total Row for Section 3
ws_svr1.row_dimensions[cur_row].height = 20
tot_row_ch1 = [
    "TOTAL CHANNELS", tot_sel_u, tot_sel_v, (tot_sel_v / tot_all_v),
    tot_reg_u, tot_reg_v, (tot_reg_v / tot_all_v),
    tot_all_u, tot_all_v, 1.0
]
for c_idx, val in enumerate(tot_row_ch1, 1):
    cell = ws_svr1.cell(row=cur_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx == 1:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [2, 3, 5, 6, 8, 9]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [4, 7, 10]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'

# Adjust column widths
for col in ws_svr1.columns:
    col_letter = get_column_letter(col[0].column)
    max_len = 0
    for cell in col:
        v_str = str(cell.value or '')
        if len(v_str) > max_len and '\n' not in v_str and len(v_str) < 50:
            max_len = len(v_str)
    ws_svr1.column_dimensions[col_letter].width = min(max(max_len + 3, 14), 32)
ws_svr1.column_dimensions['A'].width = 24

ws_svr1.freeze_panes = 'B11'

wb1.save(ecom_file)
print(f"✅ Successfully updated E-Commerce workbook with 'DEEN Select vs Regular': {ecom_file}")

# =============================================================================
# 2. POS OUTLET WORKBOOK (October 2026 POS Outlet Sales Performance.xlsx)
# =============================================================================
pos_file = 'Sample Docs/October 2026 POS Outlet Sales Performance.xlsx'
print(f"\nLoading POS Outlet workbook: {pos_file}")
wb2 = openpyxl.load_workbook(pos_file)

ws2 = wb2['Item Wise Performance']
data2 = ws2.values
headers2 = next(data2)
df2 = pd.DataFrame(data2, columns=headers2)
df2 = fix_cargo_classification(df2)

# Totals for Select vs Regular
sel_pos = df2[df2['Brand Name'] == 'DEEN Select']
reg_pos = df2[df2['Brand Name'] == 'DEEN']

tot_pos_sel_u = int(sel_pos['Quantity Sold'].sum())
tot_pos_sel_v = float(sel_pos['Line Total (৳)'].sum())
tot_pos_sel_cg = safe_sum_cogs(sel_pos['Total COGS (৳)'])
tot_pos_sel_gp = tot_pos_sel_v - tot_pos_sel_cg
tot_pos_sel_gm = (tot_pos_sel_gp / tot_pos_sel_v * 100) if tot_pos_sel_v else 0.0

tot_pos_reg_u = int(reg_pos['Quantity Sold'].sum())
tot_pos_reg_v = float(reg_pos['Line Total (৳)'].sum())
tot_pos_reg_cg = safe_sum_cogs(reg_pos['Total COGS (৳)'])
tot_pos_reg_gp = tot_pos_reg_v - tot_pos_reg_cg
tot_pos_reg_gm = (tot_pos_reg_gp / tot_pos_reg_v * 100) if tot_pos_reg_v else 0.0

tot_pos_all_u = tot_pos_sel_u + tot_pos_reg_u
tot_pos_all_v = tot_pos_sel_v + tot_pos_reg_v
tot_pos_all_cg = tot_pos_sel_cg + tot_pos_reg_cg
tot_pos_all_gp = tot_pos_all_v - tot_pos_all_cg
tot_pos_all_gm = (tot_pos_all_gp / tot_pos_all_v * 100) if tot_pos_all_v else 0.0

# Remove existing sheet if present
if sheet_title in wb2.sheetnames:
    del wb2[sheet_title]

ws_svr2 = wb2.create_sheet(title=sheet_title, index=2)
ws_svr2.views.sheetView[0].showGridLines = True

# Title Banner
ws_svr2.merge_cells('A1:Q1')
ws_svr2['A1'] = "DEEN COMMERCE — OCTOBER 2026 DEEN SELECT vs REGULAR CATEGORY PERFORMANCE (POS OUTLETS)"
ws_svr2['A1'].font = font_title
ws_svr2['A1'].alignment = Alignment(horizontal='left', vertical='center')

ws_svr2.merge_cells('A2:Q2')
ws_svr2['A2'] = "Retail Counter Portfolio Comparison · Curated European/Export Lines (DEEN Select) vs In-House Core Apparel (DEEN Regular) Across All Outlets"
ws_svr2['A2'].font = font_subtitle
ws_svr2['A2'].alignment = Alignment(horizontal='left', vertical='center')

ws_svr2.row_dimensions[1].height = 25
ws_svr2.row_dimensions[2].height = 18

# KPI Ribbon (Rows 4-6)
kpis_pos = [
    {'cs': 'A', 'ce': 'C', 'label': 'DEEN SELECT SOLD UNITS', 'val': f"{tot_pos_sel_u:,}", 'sub': f"{(tot_pos_sel_u/tot_pos_all_u*100):.1f}% of POS Units ({tot_pos_sel_u:,} / {tot_pos_all_u:,} pcs)"},
    {'cs': 'D', 'ce': 'F', 'label': 'DEEN SELECT NET REVENUE', 'val': f"৳{tot_pos_sel_v:,.0f}", 'sub': f"{(tot_pos_sel_v/tot_pos_all_v*100):.1f}% Revenue Share · {tot_pos_sel_gm:.1f}% Gross Margin"},
    {'cs': 'G', 'ce': 'I', 'label': 'DEEN REGULAR SOLD UNITS', 'val': f"{tot_pos_reg_u:,}", 'sub': f"{(tot_pos_reg_u/tot_pos_all_u*100):.1f}% of POS Units ({tot_pos_reg_u:,} / {tot_pos_all_u:,} pcs)"},
    {'cs': 'J', 'ce': 'L', 'label': 'DEEN REGULAR NET REVENUE', 'val': f"৳{tot_pos_reg_v:,.0f}", 'sub': f"{(tot_pos_reg_v/tot_pos_all_v*100):.1f}% Revenue Share · {tot_pos_reg_gm:.1f}% Gross Margin"},
    {'cs': 'M', 'ce': 'Q', 'label': 'PORTFOLIO BLENDED MARGIN', 'val': f"{tot_pos_all_gm:.1f}%", 'sub': f"Realized Gross Profit: ৳{tot_pos_all_gp:,.0f} on ৳{tot_pos_all_v:,.0f} Sales"},
]
for card in kpis_pos:
    cs, ce = card['cs'], card['ce']
    ws_svr2.merge_cells(f"{cs}4:{ce}4")
    ws_svr2.merge_cells(f"{cs}5:{ce}5")
    ws_svr2.merge_cells(f"{cs}6:{ce}6")
    ws_svr2[f"{cs}4"] = card['label']
    ws_svr2[f"{cs}4"].font = card_label_font
    ws_svr2[f"{cs}4"].alignment = Alignment(horizontal='center', vertical='center')
    ws_svr2[f"{cs}5"] = card['val']
    ws_svr2[f"{cs}5"].font = card_value_font
    ws_svr2[f"{cs}5"].alignment = Alignment(horizontal='center', vertical='center')
    ws_svr2[f"{cs}6"] = card['sub']
    ws_svr2[f"{cs}6"].font = card_sub_font
    ws_svr2[f"{cs}6"].alignment = Alignment(horizontal='center', vertical='center')
    col_start_idx = openpyxl.utils.column_index_from_string(cs)
    col_end_idx = openpyxl.utils.column_index_from_string(ce)
    for c in range(col_start_idx, col_end_idx + 1):
        for r in range(4, 7):
            ws_svr2.cell(row=r, column=c).fill = kpi_fill
            ws_svr2.cell(row=r, column=c).border = thin_border

cur_row2 = 8
# Section 1 Header
ws_svr2.merge_cells(f"A{cur_row2}:Q{cur_row2}")
ws_svr2[f"A{cur_row2}"] = "1. SIDE-BY-SIDE CATEGORY PERFORMANCE MATRIX (DEEN SELECT vs DEEN REGULAR)"
ws_svr2[f"A{cur_row2}"].font = section_hdr_font
ws_svr2[f"A{cur_row2}"].fill = section_hdr_fill
ws_svr2[f"A{cur_row2}"].alignment = Alignment(horizontal='left', vertical='center')
ws_svr2.row_dimensions[cur_row2].height = 24
cur_row2 += 1

# Super-headers for Section 1
ws_svr2.row_dimensions[cur_row2].height = 20
ws_svr2[f"A{cur_row2}"] = "Apparel Category"
ws_svr2[f"A{cur_row2}"].font = tbl_hdr_font
ws_svr2[f"A{cur_row2}"].fill = tbl_hdr_fill
ws_svr2[f"A{cur_row2}"].alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

# DEEN Select Header Block (B to G)
ws_svr2.merge_cells(f"B{cur_row2}:G{cur_row2}")
ws_svr2[f"B{cur_row2}"] = "DEEN SELECT (CURATED EXPORT & OVERRUNS)"
ws_svr2[f"B{cur_row2}"].font = tbl_hdr_font
ws_svr2[f"B{cur_row2}"].fill = select_hdr_fill
ws_svr2[f"B{cur_row2}"].alignment = Alignment(horizontal='center', vertical='center')

# DEEN Regular Header Block (H to M)
ws_svr2.merge_cells(f"H{cur_row2}:M{cur_row2}")
ws_svr2[f"H{cur_row2}"] = "DEEN REGULAR (IN-HOUSE CORE LINES)"
ws_svr2[f"H{cur_row2}"].font = tbl_hdr_font
ws_svr2[f"H{cur_row2}"].fill = regular_hdr_fill
ws_svr2[f"H{cur_row2}"].alignment = Alignment(horizontal='center', vertical='center')

# Comparison / Total Header Block (N to Q)
ws_svr2.merge_cells(f"N{cur_row2}:Q{cur_row2}")
ws_svr2[f"N{cur_row2}"] = "CATEGORY BENCHMARK & SELECT SHARE"
ws_svr2[f"N{cur_row2}"].font = tbl_hdr_font
ws_svr2[f"N{cur_row2}"].fill = tbl_hdr_fill
ws_svr2[f"N{cur_row2}"].alignment = Alignment(horizontal='center', vertical='center')

cur_row2 += 1

# Sub-column headers
sub_cols2 = [
    'Apparel Category',
    # Select cols
    'Select Sold Units', 'Select Total MRP (৳)', 'Select COGS (৳)', 'Select Net Sales (৳)', 'Select Profit (৳)', 'Select Margin (%)',
    # Regular cols
    'Regular Sold Units', 'Regular Total MRP (৳)', 'Regular COGS (৳)', 'Regular Net Sales (৳)', 'Regular Profit (৳)', 'Regular Margin (%)',
    # Benchmark cols
    'Total Sold Units', 'Total Net Sales (৳)', 'Select Volume Share (%)', 'Select Revenue Share (%)'
]
ws_svr2.row_dimensions[cur_row2].height = 24
for c_idx, c_name in enumerate(sub_cols2, 1):
    cell = ws_svr2.cell(row=cur_row2, column=c_idx, value=c_name)
    cell.font = tbl_hdr_font
    if 2 <= c_idx <= 7:
        cell.fill = PatternFill(start_color="3730A3", end_color="3730A3", fill_type="solid")
    elif 8 <= c_idx <= 13:
        cell.fill = PatternFill(start_color="0369A1", end_color="0369A1", fill_type="solid")
    else:
        cell.fill = tbl_hdr_fill
    cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row2 += 1

# Compute POS Category Matrix rows
matrix_data2 = []
for cat_name, grp in df2.groupby('Category'):
    # Select
    grp_sel = grp[grp['Brand Name'] == 'DEEN Select']
    sel_u = int(grp_sel['Quantity Sold'].sum())
    sel_mrp = float((grp_sel['Unit Price (৳)'] * grp_sel['Quantity Sold']).sum())
    sel_net = float(grp_sel['Line Total (৳)'].sum())
    sel_cg = safe_sum_cogs(grp_sel['Total COGS (৳)'])
    sel_gp = sel_net - sel_cg
    sel_gm = (sel_gp / sel_net) if sel_net > 0 else 0.0
    
    # Regular
    grp_reg = grp[grp['Brand Name'] == 'DEEN']
    reg_u = int(grp_reg['Quantity Sold'].sum())
    reg_mrp = float((grp_reg['Unit Price (৳)'] * grp_reg['Quantity Sold']).sum())
    reg_net = float(grp_reg['Line Total (৳)'].sum())
    reg_cg = safe_sum_cogs(grp_reg['Total COGS (৳)'])
    reg_gp = reg_net - reg_cg
    reg_gm = (reg_gp / reg_net) if reg_net > 0 else 0.0
    
    tot_u = sel_u + reg_u
    tot_net = sel_net + reg_net
    sel_vol_share = (sel_u / tot_u) if tot_u > 0 else 0.0
    sel_rev_share = (sel_net / tot_net) if tot_net > 0 else 0.0
    
    matrix_data2.append({
        'cat': cat_name,
        'sel_u': sel_u, 'sel_mrp': sel_mrp, 'sel_cg': sel_cg, 'sel_net': sel_net, 'sel_gp': sel_gp, 'sel_gm': sel_gm,
        'reg_u': reg_u, 'reg_mrp': reg_mrp, 'reg_cg': reg_cg, 'reg_net': reg_net, 'reg_gp': reg_gp, 'reg_gm': reg_gm,
        'tot_u': tot_u, 'tot_net': tot_net, 'sel_vol_share': sel_vol_share, 'sel_rev_share': sel_rev_share
    })

matrix_data2.sort(key=lambda x: -x['tot_net'])

for row_data in matrix_data2:
    ws_svr2.row_dimensions[cur_row2].height = 19
    r_vals = [
        row_data['cat'],
        row_data['sel_u'], row_data['sel_mrp'], row_data['sel_cg'], row_data['sel_net'], row_data['sel_gp'], row_data['sel_gm'],
        row_data['reg_u'], row_data['reg_mrp'], row_data['reg_cg'], row_data['reg_net'], row_data['reg_gp'], row_data['reg_gm'],
        row_data['tot_u'], row_data['tot_net'], row_data['sel_vol_share'], row_data['sel_rev_share']
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_svr2.cell(row=cur_row2, column=c_idx, value=val)
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
    cur_row2 += 1

# Total Row for Section 1
ws_svr2.row_dimensions[cur_row2].height = 20
tot_pos_sel_mrp = sum(r['sel_mrp'] for r in matrix_data2)
tot_pos_reg_mrp = sum(r['reg_mrp'] for r in matrix_data2)

tot_row_pos_vals1 = [
    "TOTAL PORTFOLIO",
    tot_pos_sel_u, tot_pos_sel_mrp, tot_pos_sel_cg, tot_pos_sel_v, tot_pos_sel_gp, tot_pos_sel_gm / 100.0,
    tot_pos_reg_u, tot_pos_reg_mrp, tot_pos_reg_cg, tot_pos_reg_v, tot_pos_reg_gp, tot_pos_reg_gm / 100.0,
    tot_pos_all_u, tot_pos_all_v, (tot_pos_sel_u / tot_pos_all_u), (tot_pos_sel_v / tot_pos_all_v)
]
for c_idx, val in enumerate(tot_row_pos_vals1, 1):
    cell = ws_svr2.cell(row=cur_row2, column=c_idx, value=val)
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
cur_row2 += 3

# Section 2: Detailed Line-by-Line Breakdown by Category & Brand Line
ws_svr2.merge_cells(f"A{cur_row2}:Q{cur_row2}")
ws_svr2[f"A{cur_row2}"] = "2. DETAILED CATEGORY & BRAND LINE BREAKDOWN (SELECT vs REGULAR ROWS)"
ws_svr2[f"A{cur_row2}"].font = section_hdr_font
ws_svr2[f"A{cur_row2}"].fill = section_hdr_fill
ws_svr2[f"A{cur_row2}"].alignment = Alignment(horizontal='left', vertical='center')
ws_svr2.row_dimensions[cur_row2].height = 24
cur_row2 += 1

sec2_cols2 = [
    'Apparel Category', 'Brand Line Tier', 'Sold Item Counts', 'Total MRP (৳)',
    'Total Sold COGS (৳)', 'Net Sales (৳)', 'Realized Gross Profit (৳)', 'Gross Margin (%)',
    'Average Unit Price (৳)', 'Share in Category (%)', 'Share of Total Sales (%)'
]
ws_svr2.row_dimensions[cur_row2].height = 22
for c_idx, c_name in enumerate(sec2_cols2, 1):
    c = ws_svr2.cell(row=cur_row2, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row2 += 1

line_rows2 = []
for cat_name, grp in df2.groupby('Category'):
    cat_tot_sales = float(grp['Line Total (৳)'].sum())
    for brand_name in ['DEEN Select', 'DEEN']:
        b_grp = grp[grp['Brand Name'] == brand_name]
        if len(b_grp) == 0:
            continue
        sold_u = int(b_grp['Quantity Sold'].sum())
        mrp_v = float((b_grp['Unit Price (৳)'] * b_grp['Quantity Sold']).sum())
        net_s = float(b_grp['Line Total (৳)'].sum())
        cogs_v = safe_sum_cogs(b_grp['Total COGS (৳)'])
        gp = net_s - cogs_v
        gm = (gp / net_s) if net_s > 0 else 0.0
        avg_p = (net_s / sold_u) if sold_u > 0 else 0.0
        cat_share = (net_s / cat_tot_sales) if cat_tot_sales > 0 else 0.0
        tot_share = (net_s / tot_pos_all_v) if tot_pos_all_v > 0 else 0.0
        
        line_rows2.append({
            'cat': cat_name, 'brand': brand_name, 'sold_u': sold_u,
            'mrp': mrp_v, 'cogs': cogs_v, 'net_s': net_s, 'gp': gp, 'gm': gm, 'avg_p': avg_p,
            'cat_share': cat_share, 'tot_share': tot_share
        })
line_rows2.sort(key=lambda x: (x['cat'], -x['net_s']))

for lr in line_rows2:
    ws_svr2.row_dimensions[cur_row2].height = 19
    r_vals = [
        lr['cat'], lr['brand'], lr['sold_u'],
        lr['mrp'], lr['cogs'], lr['net_s'], lr['gp'], lr['gm'],
        lr['avg_p'], lr['cat_share'], lr['tot_share']
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_svr2.cell(row=cur_row2, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
            if c_idx == 2 and val == 'DEEN Select':
                cell.font = Font(name='Calibri', size=9.5, bold=True, color='4F46E5')
            elif c_idx == 2 and val == 'DEEN':
                cell.font = Font(name='Calibri', size=9.5, bold=True, color='0284C7')
        elif c_idx in [3, 4, 5, 6, 7, 9]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [8, 10, 11]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row2 += 1

# Section 3: Outlet-Wise Brand Line Contribution
cur_row2 += 2
ws_svr2.merge_cells(f"A{cur_row2}:Q{cur_row2}")
ws_svr2[f"A{cur_row2}"] = "3. RETAIL OUTLET BRANCH BRAND LINE CONTRIBUTION (SELECT vs REGULAR)"
ws_svr2[f"A{cur_row2}"].font = section_hdr_font
ws_svr2[f"A{cur_row2}"].fill = section_hdr_fill
ws_svr2[f"A{cur_row2}"].alignment = Alignment(horizontal='left', vertical='center')
ws_svr2.row_dimensions[cur_row2].height = 24
cur_row2 += 1

sec3_cols2 = [
    'Retail Outlet Branch', 'Select Units Sold', 'Select Net Sales (৳)', 'Select Share (%)',
    'Regular Units Sold', 'Regular Net Sales (৳)', 'Regular Share (%)',
    'Total Outlet Units', 'Total Outlet Net Sales (৳)', 'Branch Share of POS (%)'
]
ws_svr2.row_dimensions[cur_row2].height = 22
for c_idx, c_name in enumerate(sec3_cols2, 1):
    c = ws_svr2.cell(row=cur_row2, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row2 += 1

for out, grp in df2.groupby('Outlet Name'):
    sel = grp[grp['Brand Name'] == 'DEEN Select']
    reg = grp[grp['Brand Name'] == 'DEEN']
    sel_u = int(sel['Quantity Sold'].sum())
    reg_u = int(reg['Quantity Sold'].sum())
    sel_v = float(sel['Line Total (৳)'].sum())
    reg_v = float(reg['Line Total (৳)'].sum())
    tot_u = sel_u + reg_u
    tot_v = sel_v + reg_v
    
    ws_svr2.row_dimensions[cur_row2].height = 19
    r_vals = [
        out, sel_u, sel_v, (sel_v / tot_v) if tot_v > 0 else 0.0,
        reg_u, reg_v, (reg_v / tot_v) if tot_v > 0 else 0.0,
        tot_u, tot_v, (tot_v / tot_pos_all_v) if tot_pos_all_v > 0 else 0.0
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_svr2.cell(row=cur_row2, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx == 1:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [2, 3, 5, 6, 8, 9]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [4, 7, 10]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row2 += 1

# Total Row for Section 3
ws_svr2.row_dimensions[cur_row2].height = 20
tot_row_pos_out = [
    "TOTAL PHYSICAL OUTLETS", tot_pos_sel_u, tot_pos_sel_v, (tot_pos_sel_v / tot_pos_all_v),
    tot_pos_reg_u, tot_pos_reg_v, (tot_pos_reg_v / tot_pos_all_v),
    tot_pos_all_u, tot_pos_all_v, 1.0
]
for c_idx, val in enumerate(tot_row_pos_out, 1):
    cell = ws_svr2.cell(row=cur_row2, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx == 1:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [2, 3, 5, 6, 8, 9]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [4, 7, 10]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'

# Adjust column widths
for col in ws_svr2.columns:
    col_letter = get_column_letter(col[0].column)
    max_len = 0
    for cell in col:
        v_str = str(cell.value or '')
        if len(v_str) > max_len and '\n' not in v_str and len(v_str) < 50:
            max_len = len(v_str)
    ws_svr2.column_dimensions[col_letter].width = min(max(max_len + 3, 14), 32)
ws_svr2.column_dimensions['A'].width = 24

ws_svr2.freeze_panes = 'B11'

wb2.save(pos_file)
print(f"✅ Successfully updated POS Outlet workbook with 'DEEN Select vs Regular': {pos_file}")

print("\n🎉 BOTH WORKBOOKS HAVE BEEN ENRICHED WITH 'DEEN Select vs Regular' CATEGORY TABS!")
