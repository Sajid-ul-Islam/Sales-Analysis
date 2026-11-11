import json
import re
import os
import sys
import shutil
import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')

print("================================================================================")
print("🚀 ADDING CATEGORY WISE PERFORMANCE TABS TO OCTOBER 2026 WORKBOOKS")
print("================================================================================\n")

# Styling definitions
header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
regular_font = Font(name="Calibri", size=9.5)
bold_font = Font(name="Calibri", size=9.5, bold=True)
section_hdr_font = Font(name="Calibri", size=12, bold=True, color="FFFFFF")
section_hdr_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
tbl_hdr_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
tbl_hdr_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
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

# -----------------------------------------------------------------------------
# 1. E-COMMERCE WORKBOOK
# -----------------------------------------------------------------------------
ecom_file = 'Sample Docs/October 2026 Item, Product & SKU Performance.xlsx'
print(f"Loading E-Commerce workbook: {ecom_file}")
wb1 = openpyxl.load_workbook(ecom_file)

# Read Item Wise Performance
ws1 = wb1['Item Wise Performance']
data1 = ws1.values
headers1 = next(data1)
df_items = pd.DataFrame(data1, columns=headers1)
df_items = fix_cargo_classification(df_items)

# Update Item Wise Performance sheet with Cargo category
cat_col_idx = headers1.index('Category') + 1
sub_col_idx = headers1.index('Sub-Category') + 1
for r_idx, row in enumerate(df_items.itertuples(index=False), 2):
    ws1.cell(row=r_idx, column=cat_col_idx, value=row.Category)
    ws1.cell(row=r_idx, column=sub_col_idx, value=getattr(row, '_9', row[9]))

# Remove existing Category Wise Performance sheet if present
if 'Category Wise Performance' in wb1.sheetnames:
    del wb1['Category Wise Performance']

# Create Category Wise Performance as Sheet 2 (index 1)
ws_cat = wb1.create_sheet(title='Category Wise Performance', index=1)
ws_cat.views.sheetView[0].showGridLines = True

# Title Banner
ws_cat.merge_cells('A1:M1')
ws_cat['A1'] = "DEEN COMMERCE — OCTOBER 2026 CATEGORY-WISE SALES PERFORMANCE (E-COMMERCE)"
ws_cat['A1'].font = font_title
ws_cat['A1'].alignment = Alignment(horizontal='left', vertical='center')

ws_cat.merge_cells('A2:M2')
ws_cat['A2'] = "Pathao Hermes Dispatches · Exact WooCommerce REST API COGS & Profit Margins · Sold Item Counts, MRP, COGS & Net Sales"
ws_cat['A2'].font = font_subtitle
ws_cat['A2'].alignment = Alignment(horizontal='left', vertical='center')

ws_cat.row_dimensions[1].height = 25
ws_cat.row_dimensions[2].height = 18

deliv_items = df_items[df_items['Delivered or Not'] == 'Delivered']
tot_deliv_units = int(deliv_items['Quantity'].sum())
tot_disp_units = int(df_items['Quantity'].sum())
tot_disp_val = float(df_items['Total Value (৳)'].sum())
tot_deliv_val = float(deliv_items['Total Value (৳)'].sum())
tot_deliv_cogs = float(deliv_items['Total COGS (৳)'].sum())
tot_gp = tot_deliv_val - tot_deliv_cogs
tot_gm = (tot_gp / tot_deliv_val * 100) if tot_deliv_val else 0.0

# KPI Ribbon (Rows 4-6)
kpis1 = [
    {'cs': 'A', 'ce': 'B', 'label': 'SOLD ITEM COUNTS', 'val': f"{tot_deliv_units:,}", 'sub': f"Delivered: {(tot_deliv_units/tot_disp_units*100):.1f}% of {tot_disp_units:,} Dispatched"},
    {'cs': 'C', 'ce': 'D', 'label': 'TOTAL MRP VALUE', 'val': f"৳{tot_disp_val:,.0f}", 'sub': 'Gross Dispatched Retail Tag Value'},
    {'cs': 'E', 'ce': 'F', 'label': 'TOTAL SOLD COGS', 'val': f"৳{tot_deliv_cogs:,.0f}", 'sub': 'Exact Delivered Product Cost'},
    {'cs': 'G', 'ce': 'I', 'label': 'NET SALES REVENUE', 'val': f"৳{tot_deliv_val:,.0f}", 'sub': 'Realized Settled Courier Revenue'},
    {'cs': 'J', 'ce': 'M', 'label': 'REALIZED GROSS PROFIT', 'val': f"৳{tot_gp:,.0f}", 'sub': f"{tot_gm:.1f}% Realized Gross Margin"},
]
for card in kpis1:
    cs, ce = card['cs'], card['ce']
    ws_cat.merge_cells(f"{cs}4:{ce}4")
    ws_cat.merge_cells(f"{cs}5:{ce}5")
    ws_cat.merge_cells(f"{cs}6:{ce}6")
    ws_cat[f"{cs}4"] = card['label']
    ws_cat[f"{cs}4"].font = card_label_font
    ws_cat[f"{cs}4"].alignment = Alignment(horizontal='center', vertical='center')
    ws_cat[f"{cs}5"] = card['val']
    ws_cat[f"{cs}5"].font = card_value_font
    ws_cat[f"{cs}5"].alignment = Alignment(horizontal='center', vertical='center')
    ws_cat[f"{cs}6"] = card['sub']
    ws_cat[f"{cs}6"].font = card_sub_font
    ws_cat[f"{cs}6"].alignment = Alignment(horizontal='center', vertical='center')
    col_start_idx = openpyxl.utils.column_index_from_string(cs)
    col_end_idx = openpyxl.utils.column_index_from_string(ce)
    for c in range(col_start_idx, col_end_idx + 1):
        for r in range(4, 7):
            ws_cat.cell(row=r, column=c).fill = kpi_fill
            ws_cat.cell(row=r, column=c).border = thin_border

cur_row = 8
# Section 1 Header
ws_cat.merge_cells(f"A{cur_row}:M{cur_row}")
ws_cat[f"A{cur_row}"] = "1. MAIN APPAREL CATEGORY SALES PERFORMANCE"
ws_cat[f"A{cur_row}"].font = section_hdr_font
ws_cat[f"A{cur_row}"].fill = section_hdr_fill
ws_cat[f"A{cur_row}"].alignment = Alignment(horizontal='left', vertical='center')
ws_cat.row_dimensions[cur_row].height = 24
cur_row += 1

sec1_cols = [
    'Apparel Category', 'Dispatched Units', 'Sold Item Counts', 'Returned Units',
    'Delivery Rate (%)', 'Total MRP (৳)', 'Total Sold COGS (৳)', 'Net Sales (৳)',
    'Realized Gross Profit (৳)', 'Gross Margin (%)', 'Average Unit Price (৳)', 'Share of Net Sales (%)', 'Performance Tag'
]
ws_cat.row_dimensions[cur_row].height = 22
for c_idx, col_name in enumerate(sec1_cols, 1):
    c = ws_cat.cell(row=cur_row, column=c_idx, value=col_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row += 1

# Aggregate by Category
ecom_cats = []
for cat_name, grp in df_items.groupby('Category'):
    d_grp = grp[grp['Delivered or Not'] == 'Delivered']
    r_grp = grp[grp['Delivered or Not'].isin(['Returned', 'Paid Return'])]
    disp_u = int(grp['Quantity'].sum())
    sold_u = int(d_grp['Quantity'].sum())
    ret_u = int(r_grp['Quantity'].sum())
    deliv_rate = (sold_u / disp_u) if disp_u else 0.0
    mrp_v = float(grp['Total Value (৳)'].sum())
    net_s = float(d_grp['Total Value (৳)'].sum())
    cogs_v = float(d_grp['Total COGS (৳)'].sum())
    gp = net_s - cogs_v
    gm = (gp / net_s) if net_s > 0 else 0.0
    avg_p = (net_s / sold_u) if sold_u > 0 else 0.0
    share = (net_s / tot_deliv_val) if tot_deliv_val > 0 else 0.0
    
    tag = '🌟 Top Revenue Category' if share >= 0.20 else ('⚡ Volume Driver' if sold_u >= 100 else ('⚠️ High Return Alert' if (1.0 - deliv_rate) >= 0.25 else '⚖️ Steady Contributor'))
    ecom_cats.append({
        'cat': cat_name, 'disp_u': disp_u, 'sold_u': sold_u, 'ret_u': ret_u,
        'deliv_rate': deliv_rate, 'mrp': mrp_v, 'cogs': cogs_v, 'net_s': net_s,
        'gp': gp, 'gm': gm, 'avg_p': avg_p, 'share': share, 'tag': tag
    })
ecom_cats.sort(key=lambda x: -x['net_s'])

for ec in ecom_cats:
    ws_cat.row_dimensions[cur_row].height = 19
    row_vals = [
        ec['cat'], ec['disp_u'], ec['sold_u'], ec['ret_u'],
        ec['deliv_rate'], ec['mrp'], ec['cogs'], ec['net_s'],
        ec['gp'], ec['gm'], ec['avg_p'], ec['share'], ec['tag']
    ]
    for c_idx, val in enumerate(row_vals, 1):
        cell = ws_cat.cell(row=cur_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 13]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [2, 3, 4, 6, 7, 8, 9, 11]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [5, 10, 12]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row += 1

# Total Row for Section 1
ws_cat.row_dimensions[cur_row].height = 20
tot_disp_units = sum(c['disp_u'] for c in ecom_cats)
tot_sold_units = sum(c['sold_u'] for c in ecom_cats)
tot_ret_units = sum(c['ret_u'] for c in ecom_cats)
tot_mrp_v = sum(c['mrp'] for c in ecom_cats)
tot_cogs_v = sum(c['cogs'] for c in ecom_cats)
tot_net_s = sum(c['net_s'] for c in ecom_cats)
tot_gp = tot_net_s - tot_cogs_v
tot_gm = (tot_gp / tot_net_s) if tot_net_s > 0 else 0.0
tot_deliv_rate = (tot_sold_units / tot_disp_units) if tot_disp_units > 0 else 0.0
tot_avg_p = (tot_net_s / tot_sold_units) if tot_sold_units > 0 else 0.0

tot_row_1 = [
    "TOTAL ALL CATEGORIES", tot_disp_units, tot_sold_units, tot_ret_units,
    tot_deliv_rate, tot_mrp_v, tot_cogs_v, tot_net_s,
    tot_gp, tot_gm, tot_avg_p, 1.0, "All E-Com Dispatches"
]
for c_idx, val in enumerate(tot_row_1, 1):
    cell = ws_cat.cell(row=cur_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 13]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [2, 3, 4, 6, 7, 8, 9, 11]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [5, 10, 12]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'
cur_row += 3

# Section 2: Sub-Category Granular Performance
ws_cat.merge_cells(f"A{cur_row}:M{cur_row}")
ws_cat[f"A{cur_row}"] = "2. SUB-CATEGORY SALES BREAKDOWN (GRANULAR PERFORMANCE)"
ws_cat[f"A{cur_row}"].font = section_hdr_font
ws_cat[f"A{cur_row}"].fill = section_hdr_fill
ws_cat[f"A{cur_row}"].alignment = Alignment(horizontal='left', vertical='center')
ws_cat.row_dimensions[cur_row].height = 24
cur_row += 1

sec2_cols = [
    'Category', 'Sub-Category', 'Dispatched Units', 'Sold Item Counts', 'Returned Units',
    'Delivery Rate (%)', 'Total MRP (৳)', 'Total Sold COGS (৳)', 'Net Sales (৳)',
    'Realized Gross Profit (৳)', 'Gross Margin (%)', 'Average Unit Price (৳)', 'Share of Category (%)'
]
ws_cat.row_dimensions[cur_row].height = 22
for c_idx, col_name in enumerate(sec2_cols, 1):
    c = ws_cat.cell(row=cur_row, column=c_idx, value=col_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row += 1

# Group by Category & Sub-Category
ecom_subcats = []
cat_net_totals = {c['cat']: c['net_s'] for c in ecom_cats}
for (cat_name, sub_name), grp in df_items.groupby(['Category', 'Sub-Category']):
    d_grp = grp[grp['Delivered or Not'] == 'Delivered']
    r_grp = grp[grp['Delivered or Not'].isin(['Returned', 'Paid Return'])]
    disp_u = int(grp['Quantity'].sum())
    sold_u = int(d_grp['Quantity'].sum())
    ret_u = int(r_grp['Quantity'].sum())
    deliv_rate = (sold_u / disp_u) if disp_u else 0.0
    mrp_v = float(grp['Total Value (৳)'].sum())
    net_s = float(d_grp['Total Value (৳)'].sum())
    cogs_v = float(d_grp['Total COGS (৳)'].sum())
    gp = net_s - cogs_v
    gm = (gp / net_s) if net_s > 0 else 0.0
    avg_p = (net_s / sold_u) if sold_u > 0 else 0.0
    parent_tot = cat_net_totals.get(cat_name, 0)
    cat_share = (net_s / parent_tot) if parent_tot > 0 else 0.0
    ecom_subcats.append({
        'cat': cat_name, 'sub': sub_name, 'disp_u': disp_u, 'sold_u': sold_u, 'ret_u': ret_u,
        'deliv_rate': deliv_rate, 'mrp': mrp_v, 'cogs': cogs_v, 'net_s': net_s,
        'gp': gp, 'gm': gm, 'avg_p': avg_p, 'cat_share': cat_share
    })
ecom_subcats.sort(key=lambda x: (x['cat'], -x['net_s']))

for sc in ecom_subcats:
    ws_cat.row_dimensions[cur_row].height = 19
    row_vals = [
        sc['cat'], sc['sub'], sc['disp_u'], sc['sold_u'], sc['ret_u'],
        sc['deliv_rate'], sc['mrp'], sc['cogs'], sc['net_s'],
        sc['gp'], sc['gm'], sc['avg_p'], sc['cat_share']
    ]
    for c_idx, val in enumerate(row_vals, 1):
        cell = ws_cat.cell(row=cur_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [3, 4, 5, 7, 8, 9, 10, 12]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [6, 11, 13]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row += 1

# Total Row for Section 2
ws_cat.row_dimensions[cur_row].height = 20
tot_row_2 = [
    "TOTAL ALL SUB-CATEGORIES", f"{len(ecom_subcats)} Variants", tot_disp_units, tot_sold_units, tot_ret_units,
    tot_deliv_rate, tot_mrp_v, tot_cogs_v, tot_net_s,
    tot_gp, tot_gm, tot_avg_p, 1.0
]
for c_idx, val in enumerate(tot_row_2, 1):
    cell = ws_cat.cell(row=cur_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 2]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [3, 4, 5, 7, 8, 9, 10, 12]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [6, 11, 13]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'

# Column widths
cat_col_widths = {
    'A': 22, 'B': 24, 'C': 16, 'D': 16, 'E': 16, 'F': 16,
    'G': 18, 'H': 18, 'I': 18, 'J': 18, 'K': 18, 'L': 18, 'M': 22
}
for col_char, w in cat_col_widths.items():
    ws_cat.column_dimensions[col_char].width = w

ws_cat.freeze_panes = 'C8'

wb1.save(ecom_file)
print(f"✅ Successfully updated E-Commerce workbook with Category Wise Performance: {ecom_file}")

# -----------------------------------------------------------------------------
# 2. POS OUTLET WORKBOOK
# -----------------------------------------------------------------------------
pos_file = 'Sample Docs/October 2026 POS Outlet Sales Performance.xlsx'
print(f"\nLoading POS Outlet workbook: {pos_file}")
wb2 = openpyxl.load_workbook(pos_file)

ws2 = wb2['Item Wise Performance']
data2 = ws2.values
headers2 = next(data2)
df_pos_items = pd.DataFrame(data2, columns=headers2)
df_pos_items = fix_cargo_classification(df_pos_items)

# Update Item Wise Performance sheet with Cargo category
cat_col_idx2 = headers2.index('Category') + 1
sub_col_idx2 = headers2.index('Sub-Category') + 1
for r_idx, row in enumerate(df_pos_items.itertuples(index=False), 2):
    ws2.cell(row=r_idx, column=cat_col_idx2, value=row.Category)
    ws2.cell(row=r_idx, column=sub_col_idx2, value=getattr(row, '_12', row[12]))

# Remove existing Category Wise Performance sheet if present
if 'Category Wise Performance' in wb2.sheetnames:
    del wb2['Category Wise Performance']

ws_pos_cat = wb2.create_sheet(title='Category Wise Performance', index=1)
ws_pos_cat.views.sheetView[0].showGridLines = True

# Title Banner
ws_pos_cat.merge_cells('A1:K1')
ws_pos_cat['A1'] = "DEEN COMMERCE — OCTOBER 2026 CATEGORY-WISE SALES PERFORMANCE (POS OUTLETS)"
ws_pos_cat['A1'].font = font_title
ws_pos_cat['A1'].alignment = Alignment(horizontal='left', vertical='center')

ws_pos_cat.merge_cells('A2:K2')
ws_pos_cat['A2'] = "Direct Retail Walk-In Counter Sales (Cumilla, Mirpur, Wari, Sylhet) · Sold Item Counts, MRP, COGS & Net Sales"
ws_pos_cat['A2'].font = font_subtitle
ws_pos_cat['A2'].alignment = Alignment(horizontal='left', vertical='center')

ws_pos_cat.row_dimensions[1].height = 25
ws_pos_cat.row_dimensions[2].height = 18

tot_pos_units = int(df_pos_items['Quantity Sold'].sum())
tot_pos_mrp = float((df_pos_items['Unit Price (৳)'] * df_pos_items['Quantity Sold']).sum())
tot_pos_net = float(df_pos_items['Line Total (৳)'].sum())
tot_pos_cogs = float(df_pos_items['Total COGS (৳)'].sum())
tot_pos_gp = tot_pos_net - tot_pos_cogs
pos_gm = (tot_pos_gp / tot_pos_net * 100) if tot_pos_net else 0.0

# KPI Ribbon (Rows 4-6)
kpis2 = [
    {'cs': 'A', 'ce': 'B', 'label': 'SOLD ITEM COUNTS', 'val': f"{tot_pos_units:,}", 'sub': '100% In-Store POS Units Sold'},
    {'cs': 'C', 'ce': 'D', 'label': 'TOTAL MRP VALUE', 'val': f"৳{tot_pos_mrp:,.0f}", 'sub': 'Gross Register Retail Tag Value'},
    {'cs': 'E', 'ce': 'F', 'label': 'TOTAL SOLD COGS', 'val': f"৳{tot_pos_cogs:,.0f}", 'sub': 'Exact REST API Garment Cost'},
    {'cs': 'G', 'ce': 'H', 'label': 'NET SALES REVENUE', 'val': f"৳{tot_pos_net:,.0f}", 'sub': 'Cash/bKash/Card Settled at Counter'},
    {'cs': 'I', 'ce': 'K', 'label': 'REALIZED GROSS PROFIT', 'val': f"৳{tot_pos_gp:,.0f}", 'sub': f"{pos_gm:.1f}% Realized Gross Margin"},
]
for card in kpis2:
    cs, ce = card['cs'], card['ce']
    ws_pos_cat.merge_cells(f"{cs}4:{ce}4")
    ws_pos_cat.merge_cells(f"{cs}5:{ce}5")
    ws_pos_cat.merge_cells(f"{cs}6:{ce}6")
    ws_pos_cat[f"{cs}4"] = card['label']
    ws_pos_cat[f"{cs}4"].font = card_label_font
    ws_pos_cat[f"{cs}4"].alignment = Alignment(horizontal='center', vertical='center')
    ws_pos_cat[f"{cs}5"] = card['val']
    ws_pos_cat[f"{cs}5"].font = card_value_font
    ws_pos_cat[f"{cs}5"].alignment = Alignment(horizontal='center', vertical='center')
    ws_pos_cat[f"{cs}6"] = card['sub']
    ws_pos_cat[f"{cs}6"].font = card_sub_font
    ws_pos_cat[f"{cs}6"].alignment = Alignment(horizontal='center', vertical='center')
    col_start_idx = openpyxl.utils.column_index_from_string(cs)
    col_end_idx = openpyxl.utils.column_index_from_string(ce)
    for c in range(col_start_idx, col_end_idx + 1):
        for r in range(4, 7):
            ws_pos_cat.cell(row=r, column=c).fill = kpi_fill
            ws_pos_cat.cell(row=r, column=c).border = thin_border

cur_row2 = 8
# Section 1 Header
ws_pos_cat.merge_cells(f"A{cur_row2}:K{cur_row2}")
ws_pos_cat[f"A{cur_row2}"] = "1. MAIN APPAREL CATEGORY SALES PERFORMANCE"
ws_pos_cat[f"A{cur_row2}"].font = section_hdr_font
ws_pos_cat[f"A{cur_row2}"].fill = section_hdr_fill
ws_pos_cat[f"A{cur_row2}"].alignment = Alignment(horizontal='left', vertical='center')
ws_pos_cat.row_dimensions[cur_row2].height = 24
cur_row2 += 1

sec1_pos_cols = [
    'Apparel Category', 'Sold Item Counts', 'Total MRP (৳)', 'Total Sold COGS (৳)',
    'Net Sales (৳)', 'Realized Gross Profit (৳)', 'Gross Margin (%)', 'Average Unit Price (৳)',
    'Share of Total Sales (%)', 'Top Selling Outlet', 'Performance Tag'
]
ws_pos_cat.row_dimensions[cur_row2].height = 22
for c_idx, col_name in enumerate(sec1_pos_cols, 1):
    c = ws_pos_cat.cell(row=cur_row2, column=c_idx, value=col_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row2 += 1

pos_cats = []
for cat_name, grp in df_pos_items.groupby('Category'):
    sold_u = int(grp['Quantity Sold'].sum())
    mrp_v = float((grp['Unit Price (৳)'] * grp['Quantity Sold']).sum())
    net_s = float(grp['Line Total (৳)'].sum())
    cogs_v = float(grp['Total COGS (৳)'].sum())
    gp = net_s - cogs_v
    gm = (gp / net_s) if net_s > 0 else 0.0
    avg_p = (net_s / sold_u) if sold_u > 0 else 0.0
    share = (net_s / tot_pos_net) if tot_pos_net > 0 else 0.0
    top_out = grp.groupby('Outlet Name')['Quantity Sold'].sum().idxmax()
    tag = '🌟 Top POS Volume' if share >= 0.20 else ('⚡ Core Driver' if sold_u >= 70 else '⚖️ Steady Contributor')
    pos_cats.append({
        'cat': cat_name, 'sold_u': sold_u, 'mrp': mrp_v, 'cogs': cogs_v, 'net_s': net_s,
        'gp': gp, 'gm': gm, 'avg_p': avg_p, 'share': share, 'top_out': top_out, 'tag': tag
    })
pos_cats.sort(key=lambda x: -x['net_s'])

for pc in pos_cats:
    ws_pos_cat.row_dimensions[cur_row2].height = 19
    row_vals = [
        pc['cat'], pc['sold_u'], pc['mrp'], pc['cogs'], pc['net_s'],
        pc['gp'], pc['gm'], pc['avg_p'], pc['share'], pc['top_out'], pc['tag']
    ]
    for c_idx, val in enumerate(row_vals, 1):
        cell = ws_pos_cat.cell(row=cur_row2, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 10, 11]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [2, 3, 4, 5, 6, 8]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [7, 9]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row2 += 1

# Total Row for Section 1
ws_pos_cat.row_dimensions[cur_row2].height = 20
tot_pos_sold_units = sum(c['sold_u'] for c in pos_cats)
tot_pos_mrp_v = sum(c['mrp'] for c in pos_cats)
tot_pos_cogs_v = sum(c['cogs'] for c in pos_cats)
tot_pos_net_s = sum(c['net_s'] for c in pos_cats)
tot_pos_gp_v = tot_pos_net_s - tot_pos_cogs_v
tot_pos_gm_v = (tot_pos_gp_v / tot_pos_net_s) if tot_pos_net_s > 0 else 0.0
tot_pos_avg_p = (tot_pos_net_s / tot_pos_sold_units) if tot_pos_sold_units > 0 else 0.0

tot_row_pos1 = [
    "TOTAL ALL CATEGORIES", tot_pos_sold_units, tot_pos_mrp_v, tot_pos_cogs_v, tot_pos_net_s,
    tot_pos_gp_v, tot_pos_gm_v, tot_pos_avg_p, 1.0, "All 4 Outlets", "All Walk-In Sales"
]
for c_idx, val in enumerate(tot_row_pos1, 1):
    cell = ws_pos_cat.cell(row=cur_row2, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 10, 11]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [2, 3, 4, 5, 6, 8]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [7, 9]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'
cur_row2 += 3

# Section 2: Sub-Category Granular Performance
ws_pos_cat.merge_cells(f"A{cur_row2}:K{cur_row2}")
ws_pos_cat[f"A{cur_row2}"] = "2. SUB-CATEGORY SALES BREAKDOWN (GRANULAR PERFORMANCE)"
ws_pos_cat[f"A{cur_row2}"].font = section_hdr_font
ws_pos_cat[f"A{cur_row2}"].fill = section_hdr_fill
ws_pos_cat[f"A{cur_row2}"].alignment = Alignment(horizontal='left', vertical='center')
ws_pos_cat.row_dimensions[cur_row2].height = 24
cur_row2 += 1

sec2_pos_cols = [
    'Category', 'Sub-Category', 'Sold Item Counts', 'Total MRP (৳)', 'Total Sold COGS (৳)',
    'Net Sales (৳)', 'Realized Gross Profit (৳)', 'Gross Margin (%)', 'Average Unit Price (৳)',
    'Share of Category (%)', 'Top Selling Outlet'
]
ws_pos_cat.row_dimensions[cur_row2].height = 22
for c_idx, col_name in enumerate(sec2_pos_cols, 1):
    c = ws_pos_cat.cell(row=cur_row2, column=c_idx, value=col_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row2 += 1

pos_subcats = []
cat_net_totals2 = {c['cat']: c['net_s'] for c in pos_cats}
for (cat_name, sub_name), grp in df_pos_items.groupby(['Category', 'Sub-Category']):
    sold_u = int(grp['Quantity Sold'].sum())
    mrp_v = float((grp['Unit Price (৳)'] * grp['Quantity Sold']).sum())
    net_s = float(grp['Line Total (৳)'].sum())
    cogs_v = float(grp['Total COGS (৳)'].sum())
    gp = net_s - cogs_v
    gm = (gp / net_s) if net_s > 0 else 0.0
    avg_p = (net_s / sold_u) if sold_u > 0 else 0.0
    parent_tot = cat_net_totals2.get(cat_name, 0)
    cat_share = (net_s / parent_tot) if parent_tot > 0 else 0.0
    top_out = grp.groupby('Outlet Name')['Quantity Sold'].sum().idxmax()
    pos_subcats.append({
        'cat': cat_name, 'sub': sub_name, 'sold_u': sold_u, 'mrp': mrp_v, 'cogs': cogs_v, 'net_s': net_s,
        'gp': gp, 'gm': gm, 'avg_p': avg_p, 'cat_share': cat_share, 'top_out': top_out
    })
pos_subcats.sort(key=lambda x: (x['cat'], -x['net_s']))

for psc in pos_subcats:
    ws_pos_cat.row_dimensions[cur_row2].height = 19
    row_vals = [
        psc['cat'], psc['sub'], psc['sold_u'], psc['mrp'], psc['cogs'], psc['net_s'],
        psc['gp'], psc['gm'], psc['avg_p'], psc['cat_share'], psc['top_out']
    ]
    for c_idx, val in enumerate(row_vals, 1):
        cell = ws_pos_cat.cell(row=cur_row2, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2, 11]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [3, 4, 5, 6, 7, 9]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [8, 10]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row2 += 1

# Total Row for Section 2
ws_pos_cat.row_dimensions[cur_row2].height = 20
tot_row_pos2 = [
    "TOTAL ALL SUB-CATEGORIES", f"{len(pos_subcats)} Variants", tot_pos_sold_units, tot_pos_mrp_v, tot_pos_cogs_v, tot_pos_net_s,
    tot_pos_gp_v, tot_pos_gm_v, tot_pos_avg_p, 1.0, "All Outlets"
]
for c_idx, val in enumerate(tot_row_pos2, 1):
    cell = ws_pos_cat.cell(row=cur_row2, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 2, 11]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [3, 4, 5, 6, 7, 9]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [8, 10]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'
cur_row2 += 3

# Section 3: Outlet-Wise Category Sales Matrix
ws_pos_cat.merge_cells(f"A{cur_row2}:K{cur_row2}")
ws_pos_cat[f"A{cur_row2}"] = "3. OUTLET-WISE CATEGORY SALES MATRIX (UNITS & NET SALES)"
ws_pos_cat[f"A{cur_row2}"].font = section_hdr_font
ws_pos_cat[f"A{cur_row2}"].fill = section_hdr_fill
ws_pos_cat[f"A{cur_row2}"].alignment = Alignment(horizontal='left', vertical='center')
ws_pos_cat.row_dimensions[cur_row2].height = 24
cur_row2 += 1

sec3_pos_cols = [
    'Apparel Category', 'Cumilla Units', 'Mirpur Units', 'Wari Units', 'Sylhet Units', 'Total Units Sold',
    'Cumilla Sales (৳)', 'Mirpur Sales (৳)', 'Wari Sales (৳)', 'Sylhet Sales (৳)', 'Total Net Sales (৳)'
]
ws_pos_cat.row_dimensions[cur_row2].height = 22
for c_idx, col_name in enumerate(sec3_pos_cols, 1):
    c = ws_pos_cat.cell(row=cur_row2, column=c_idx, value=col_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row2 += 1

# Matrix rows
matrix_rows = []
for cat_name, grp in df_pos_items.groupby('Category'):
    cum_u = int(grp[grp['Outlet Name'] == 'Cumilla Branch']['Quantity Sold'].sum())
    mir_u = int(grp[grp['Outlet Name'] == 'Mirpur Outlet']['Quantity Sold'].sum())
    war_u = int(grp[grp['Outlet Name'] == 'Wari Branch']['Quantity Sold'].sum())
    syl_u = int(grp[grp['Outlet Name'] == 'Sylhet Branch']['Quantity Sold'].sum())
    tot_u = cum_u + mir_u + war_u + syl_u
    
    cum_v = float(grp[grp['Outlet Name'] == 'Cumilla Branch']['Line Total (৳)'].sum())
    mir_v = float(grp[grp['Outlet Name'] == 'Mirpur Outlet']['Line Total (৳)'].sum())
    war_v = float(grp[grp['Outlet Name'] == 'Wari Branch']['Line Total (৳)'].sum())
    syl_v = float(grp[grp['Outlet Name'] == 'Sylhet Branch']['Line Total (৳)'].sum())
    tot_v = cum_v + mir_v + war_v + syl_v
    
    matrix_rows.append({
        'cat': cat_name, 'cum_u': cum_u, 'mir_u': mir_u, 'war_u': war_u, 'syl_u': syl_u, 'tot_u': tot_u,
        'cum_v': cum_v, 'mir_v': mir_v, 'war_v': war_v, 'syl_v': syl_v, 'tot_v': tot_v
    })
matrix_rows.sort(key=lambda x: -x['tot_v'])

for mr in matrix_rows:
    ws_pos_cat.row_dimensions[cur_row2].height = 19
    row_vals = [
        mr['cat'], mr['cum_u'], mr['mir_u'], mr['war_u'], mr['syl_u'], mr['tot_u'],
        mr['cum_v'], mr['mir_v'], mr['war_v'], mr['syl_v'], mr['tot_v']
    ]
    for c_idx, val in enumerate(row_vals, 1):
        cell = ws_pos_cat.cell(row=cur_row2, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx == 1:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        else:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
    cur_row2 += 1

# Total Row for Section 3
ws_pos_cat.row_dimensions[cur_row2].height = 20
tot_cum_u = sum(r['cum_u'] for r in matrix_rows)
tot_mir_u = sum(r['mir_u'] for r in matrix_rows)
tot_war_u = sum(r['war_u'] for r in matrix_rows)
tot_syl_u = sum(r['syl_u'] for r in matrix_rows)
tot_all_u = sum(r['tot_u'] for r in matrix_rows)

tot_cum_v = sum(r['cum_v'] for r in matrix_rows)
tot_mir_v = sum(r['mir_v'] for r in matrix_rows)
tot_war_v = sum(r['war_v'] for r in matrix_rows)
tot_syl_v = sum(r['syl_v'] for r in matrix_rows)
tot_all_v = sum(r['tot_v'] for r in matrix_rows)

tot_row_pos3 = [
    "TOTAL ALL OUTLETS", tot_cum_u, tot_mir_u, tot_war_u, tot_syl_u, tot_all_u,
    tot_cum_v, tot_mir_v, tot_war_v, tot_syl_v, tot_all_v
]
for c_idx, val in enumerate(tot_row_pos3, 1):
    cell = ws_pos_cat.cell(row=cur_row2, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx == 1:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    else:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'

# Column widths
pos_cat_col_widths = {
    'A': 22, 'B': 18, 'C': 18, 'D': 18, 'E': 18, 'F': 18,
    'G': 18, 'H': 18, 'I': 18, 'J': 20, 'K': 20
}
for col_char, w in pos_cat_col_widths.items():
    ws_pos_cat.column_dimensions[col_char].width = w

ws_pos_cat.freeze_panes = 'C8'

wb2.save(pos_file)
print(f"✅ Successfully updated POS Outlet workbook with Category Wise Performance: {pos_file}")

print("\n🎉 BOTH WORKBOOKS HAVE BEEN ENRICHED WITH THE NEW CATEGORY WISE SALES TAB!")
