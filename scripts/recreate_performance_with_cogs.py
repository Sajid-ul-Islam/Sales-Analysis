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
print("🚀 RECREATING OCTOBER 2026 PERFORMANCE WORKBOOKS WITH LIVE WOOCOMMERCE COGS DATA")
print("================================================================================\n")

# -----------------------------------------------------------------------------
# 1. PATH RESOLUTION & BACKUPS
# -----------------------------------------------------------------------------
raw_orders_path = os.path.join('archive', 'raw_orders', 'october2026_raw_orders.json')
if not os.path.exists(raw_orders_path):
    raw_orders_path = os.path.join('src', 'data', 'october2026_raw_orders.json')

pathao_manifest_path = os.path.join('Sample Docs', 'Oct Pathao Delivey Order Lists.xlsx')
cogs_data_path = os.path.join('src', 'data', 'wc-sku-cogs.json')

ecom_out_path = os.path.join('Sample Docs', 'October 2026 Item, Product & SKU Performance.xlsx')
pos_out_path = os.path.join('Sample Docs', 'October 2026 POS Outlet Sales Performance.xlsx')

# Backup existing files if they exist
for target_file in [ecom_out_path, pos_out_path]:
    if os.path.exists(target_file):
        bak_file = target_file + '.bak'
        shutil.copyfile(target_file, bak_file)
        print(f"📦 Created backup: {bak_file}")

# -----------------------------------------------------------------------------
# 2. LOAD DATA SOURCES
# -----------------------------------------------------------------------------
print(f"Loading raw orders from: {raw_orders_path}")
with open(raw_orders_path, 'r', encoding='utf-8') as f:
    raw_orders = json.load(f)
print(f"Loaded {len(raw_orders)} raw WooCommerce orders.")

print(f"Loading Pathao manifest from: {pathao_manifest_path}")
df_pathao = pd.read_excel(pathao_manifest_path, sheet_name='Oct All')

print(f"Loading WooCommerce REST API COGS map from: {cogs_data_path}")
wc_cogs_data = {}
if os.path.exists(cogs_data_path):
    with open(cogs_data_path, 'r', encoding='utf-8') as f:
        wc_cogs_data = json.load(f)
cogs_by_sku = wc_cogs_data.get('bySku', {})
cogs_by_id = wc_cogs_data.get('byId', {})
print(f"Loaded {len(cogs_by_sku)} SKUs and {len(cogs_by_id)} IDs with exact REST API COGS.")

# -----------------------------------------------------------------------------
# 3. HELPERS & COGS RESOLVER
# -----------------------------------------------------------------------------
def get_cogs_info(sku, unit_price, product_id=None, variation_id=None):
    clean_sku = str(sku or '').strip()

    # 1. Exact match by SKU
    if clean_sku and clean_sku in cogs_by_sku:
        rec = cogs_by_sku[clean_sku]
        cogs = rec.get('cogs')
        if cogs is not None:
            try:
                c_val = float(cogs)
                if c_val > 0:
                    return round(c_val), 'Exact WooCommerce (REST API)', True
            except:
                pass

    # 2. Match by Product ID / Variation ID
    p_id = str(product_id).strip() if product_id else ''
    v_id = str(variation_id).strip() if variation_id else ''
    
    for key in [f"{p_id}:{v_id}", v_id, p_id]:
        if key and key in cogs_by_id:
            rec = cogs_by_id[key]
            cogs = rec.get('cogs')
            if cogs is not None:
                try:
                    c_val = float(cogs)
                    if c_val > 0:
                        return round(c_val), 'Exact WooCommerce (REST API)', True
                except:
                    pass

    # 3. Management Specified COGS Rules (Water bottle 195, mask 120, card holder 280)
    sku_lower = clean_sku.lower()
    if sku_lower.startswith('109-0501-'):
        return 195, 'Management Specified (Aluminum Water Bottle 195 BDT)', True
    if sku_lower.startswith('109-0502-'):
        return 120, 'Management Specified (Breathable Face Mask 120 BDT)', True
    if sku_lower.startswith('109-0104-'):
        return 280, 'Management Specified (Leather Card Holder 280 BDT)', True

    # 4. DO NOT FALLBACK: If not found in WooCommerce REST API, return None and "didn'tget"
    return None, "didn'tget", False

known_brands = [
    ('Pull & Bear', ['pull & bear', 'pull and bear']),
    ('Zara', ['zara']),
    ("Levi's", ["levi's", 'levis']),
    ('Calvin Klein', ['calvin klein', 'ck ']),
    ('American Eagle', ['american eagle', 'ae jeans', 'ae ']),
    ('Springfield', ['springfield']),
    ('Sorbino', ['sorbino']),
    ('Tom Tailor', ['tom tailor']),
    ('Banana Republic', ['banana republic']),
    ('TIFFOSI', ['tiffosi']),
    ('Allen Solly', ['allen solly']),
    ('4F', ['4f ']),
    ('Petrol', ['petrol']),
    ('VAN HEUSEN', ['van heusen']),
    ('Dragon Ball Z', ['dragon ball z', 'dbz']),
    ('Lefties', ['lefties']),
    ('DKNY', ['dkny']),
    ('Bruno', ['bruno']),
    ('Lee', ['lee '])
]

def classify_brand_name(name, sku):
    name_lower = str(name).strip().lower()
    sku_lower = str(sku).strip().lower()
    if 'select' in name_lower or sku_lower.startswith('ds-') or sku_lower.startswith('sel-'):
        return 'DEEN Select'
    if name_lower.startswith('deen ') or name_lower == 'deen':
        return 'DEEN'
    for b_label, patterns in known_brands:
        if any(p in name_lower for p in patterns):
            return 'DEEN Select'
    if 'deen' in name_lower:
        return 'DEEN'
    return 'DEEN Select'

def extract_category_and_sub(item_name, raw_sku):
    n = str(item_name).lower()

    # 1. Accessories (Card Holder, Passport Holder, Wallet, Boxer, Mask, Belt, Bottle, Mug)
    if any(k in n for k in ['card holder', 'passport', 'wallet', 'bifold', 'coin pocket long wallet']):
        if 'card' in n:
            return 'Accessories', 'Card Holder'
        if 'passport' in n:
            return 'Accessories', 'Passport Holder'
        return 'Accessories', 'Wallet'
    if 'boxer' in n:
        return 'Accessories', 'Boxer'
    if 'mask' in n:
        return 'Accessories', 'Mask'
    if 'belt' in n:
        return 'Accessories', 'Belt'
    if 'bottle' in n or 'mug' in n:
        return 'Accessories', 'Bottle'
    if 'accessory' in n or 'accessories' in n:
        return 'Accessories', 'Accessories'

    # 2. Jeans (exclude jackets/shirts with denim in title)
    if ('jeans' in n or 'jean' in n) and 'jacket' not in n and 'shirt' not in n:
        sub = 'Slim Fit' if 'slim' in n else ('Regular Fit' if 'regular' in n else 'Denim Jeans')
        return 'Jeans', sub

    # 3. Jackets
    if 'jacket' in n:
        sub = 'Denim Jacket' if 'denim' in n else 'Quilted Jacket'
        return 'Jacket', sub

    # 4. Polo (takes precedence over shirt)
    if 'polo' in n:
        return 'Polo', 'Polo'

    # 5. Sweatshirt & Hoodie (BEFORE Shirt because 'sweatshirt' contains 'shirt')
    if 'sweatshirt' in n or 'hoodie' in n:
        if 'cotton' in n or 'cotton-terry' in n:
            sub = 'Cotton Terry'
        elif 'french' in n or 'french-terry' in n:
            sub = 'French Terry'
        elif 'hoodie' in n:
            sub = 'Hoodie'
        else:
            sub = 'Cotton Terry'
        return 'Sweatshirt', sub

    # 6. T-Shirt (including Tank Top and Drop Shoulder) - BEFORE Shirt
    if 'tank top' in n:
        return 'T-Shirt', 'Tank Top'
    if 'drop shoulder' in n:
        return 'T-Shirt', 'Drop Shoulder'
    if 't-shirt' in n or 'tshirt' in n or 'tee' in n or 'active wear' in n or 'jersey' in n:
        sub = 'Full Sleeve' if any(k in n for k in ['full sleeve', 'long sleeve', 'fs']) else 'Half Sleeve'
        return 'T-Shirt', sub

    # 7. Shirt (Denim, Flannel, Cuban, Kaftan, Oxford, Formal, Full Sleeve, Half Shirt, Casual)
    if 'shirt' in n:
        if 'denim' in n:
            return 'Shirt', 'Denim Shirt'
        if 'flannel' in n:
            return 'Shirt', 'Flannel Shirt'
        if 'cuban' in n:
            return 'Shirt', 'Cuban Shirt'
        if 'kaftan' in n:
            return 'Shirt', 'Kaftan Shirt'
        if 'oxford' in n:
            return 'Shirt', 'Oxford Shirt'
        if any(k in n for k in ['executive', 'formal']):
            return 'Shirt', 'Formal Shirt'
        if any(k in n for k in ['full sleeve', 'long sleeve', 'fs']):
            return 'Shirt', 'Full Sleeve Shirt'
        if any(k in n for k in ['half shirt', 'half sleeve', 'hs']):
            return 'Shirt', 'Half Shirt'
        return 'Shirt', 'Casual Shirt'

    # 8. Twill Chino (both sub and main cat should be twill chino)
    if any(k in n for k in ['twill', 'chino', 'five pocket', '5 pocket', '5-pocket']):
        return 'Twill Chino', 'Twill Chino'

    # 9. Trouser & Cargo
    if 'trouser' in n or 'cargo' in n or 'pant' in n:
        sub = 'Cargo Trouser' if 'cargo' in n else 'Formal Trouser'
        return 'Trouser', sub

    # 10. Panjabi
    if 'panjabi' in n or 'punjabi' in n:
        sub = 'Semi Formal' if 'semi' in n else 'Regular Panjabi'
        return 'Panjabi', sub

    # Fallback: General Apparel (No Others!)
    return 'General Apparel', 'General Apparel'

def extract_size_and_base(item_name):
    s = str(item_name).strip()
    m = re.search(r'\s*-\s*([0-9]{2}|[xsmlXSML]+|[0-9]?[xX][lL]|Free Size|Regular)\s*$', s, re.IGNORECASE)
    if m:
        size = m.group(1).upper()
        base = s[:m.start()].strip()
        return base, size
    return s, 'Regular'

def extract_base_order_id(val):
    if pd.isna(val):
        return ''
    m = re.search(r'(\d{4,6})', str(val).strip())
    return m.group(1) if m else ''

df_pathao['base_order_id'] = df_pathao['Merchant order id'].apply(extract_base_order_id)
df_pathao['cons_id'] = df_pathao['Order consignment id'].astype(str).str.strip()

pathao_order_ids = set(df_pathao['base_order_id'].dropna().unique())
pathao_by_order = {}
for idx, r in df_pathao.iterrows():
    b_id = r['base_order_id']
    if b_id:
        pathao_by_order.setdefault(b_id, []).append(r)

def resolve_pathao_records(records):
    cons_ids = [str(r['cons_id']).strip() for r in records if pd.notna(r['cons_id']) and str(r['cons_id']).strip()]
    merchant_ids = [str(r['Merchant order id']).strip() for r in records if pd.notna(r['Merchant order id'])]
    stores = list(dict.fromkeys([str(r['Store name']).strip() for r in records if pd.notna(r['Store name']) and str(r['Store name']).strip()]))
    
    collected = sum(float(r['Collected amount']) if pd.notna(r['Collected amount']) else 0.0 for r in records)
    collectable = sum(float(r['Collectable Amount']) if pd.notna(r['Collectable Amount']) else 0.0 for r in records)
    total_fee = sum(float(r['Total fee']) if pd.notna(r['Total fee']) else 0.0 for r in records)
    
    statuses = [str(r['Order status']).strip().lower() for r in records if pd.notna(r['Order status'])]
    
    has_partial = any('partial' in s for s in statuses)
    has_delivered = any(s == 'delivered' for s in statuses)
    has_paid_return = any(s == 'paid return' for s in statuses)
    has_return = any(s in ['return', 'returned to merchant', 'returned', 'return requested'] for s in statuses)
    has_return_transit = any(s == 'return in transit' for s in statuses)
    has_exchange = any('exchange' in s for s in statuses)
    has_transit = any('assigned' in s or 'transit' in s for s in statuses)
    has_pickup_cancel = len(statuses) > 0 and all(s == 'pickup cancel' for s in statuses)
    
    if has_partial:
        status = 'Partial Delivery'
    elif has_delivered and not has_return and not has_exchange:
        status = 'Delivered'
    elif has_delivered and has_exchange:
        status = 'Exchange Delivered'
    elif has_delivered and has_return:
        status = 'Delivered (Split/Return)'
    elif has_paid_return:
        status = 'Paid Return'
    elif has_return:
        status = 'Returned'
    elif has_return_transit:
        status = 'Return In Transit'
    elif has_exchange:
        status = 'Exchange'
    elif has_transit:
        status = 'In Transit'
    elif has_pickup_cancel:
        status = 'Pickup Cancel'
    elif len(statuses) > 0:
        status = records[0]['Order status']
    else:
        status = 'Untracked'
        
    return {
        'consignment_ids': ', '.join(dict.fromkeys(cons_ids)),
        'merchant_ids': ', '.join(dict.fromkeys(merchant_ids)),
        'stores': ', '.join(stores),
        'status': status,
        'collected': collected,
        'collectable': collectable,
        'total_fee': total_fee,
        'has_partial': has_partial,
        'has_delivered': has_delivered,
        'has_paid_return': has_paid_return,
        'has_return': has_return,
        'has_exchange': has_exchange,
    }

def solve_partial_knapsack(units, collected_cod):
    n = len(units)
    if n == 0:
        return set()
    if n == 1:
        return {0}
        
    shipping_candidates = [0, 50, 60, 90, 100, 120, 150]
    best_subset = None
    best_diff = 999999
    
    for mask in range(1, (1 << n)):
        subset_sum = sum(units[i]['cost'] for i in range(n) if (mask & (1 << i)))
        for fee in shipping_candidates:
            diff = abs((subset_sum + fee) - collected_cod)
            if diff < best_diff:
                best_diff = diff
                best_subset = [i for i in range(n) if (mask & (1 << i))]
                
    if best_subset and best_diff <= 15:
        return set(best_subset)
    else:
        return {0}

def get_tag(deliv_rate, ret_rate, dispatched_qty):
    if dispatched_qty >= 30 and deliv_rate >= 80: return '🌟 Top Seller'
    if dispatched_qty >= 20 and deliv_rate >= 70: return '⚡ Volume Driver'
    if ret_rate >= 20.0 and dispatched_qty >= 10: return '⚠️ High Return Alert'
    if deliv_rate >= 85: return '✅ High Retention'
    return '⚖️ Steady Contributor'

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

def format_standard_sheet(ws, df, freeze_cell="C2"):
    ws.views.sheetView[0].showGridLines = True
    ws.freeze_panes = freeze_cell
    
    ws.row_dimensions[1].height = 24
    for c_idx, col_name in enumerate(df.columns, 1):
        cell = ws.cell(row=1, column=c_idx, value=col_name)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
        
    for r_idx, row_data in enumerate(df.itertuples(index=False), 2):
        ws.row_dimensions[r_idx].height = 18
        for c_idx, val in enumerate(row_data, 1):
            cell = ws.cell(row=r_idx, column=c_idx, value=val)
            cell.font = regular_font
            cell.border = thin_border
            
            c_name = df.columns[c_idx - 1]
            if any(term in c_name for term in ['(৳)', 'Value', 'Revenue', 'Total Price', 'Total Value', 'Line Total', 'COGS', 'Gross Profit', 'Profit', 'COD', 'Fee']):
                cell.alignment = Alignment(horizontal="right", vertical="center")
                cell.number_format = "#,##0"
            elif any(term in c_name for term in ['Units', 'Quantity', 'Count', 'Orders', 'Sold', 'Variations']):
                cell.alignment = Alignment(horizontal="right", vertical="center")
                cell.number_format = "#,##0"
            elif any(term in c_name for term in ['Rate (%)', 'Margin (%)', 'Share (%)']):
                cell.alignment = Alignment(horizontal="right", vertical="center")
                if isinstance(val, (int, float)):
                    cell.number_format = "0.0%"
            elif any(term in c_name for term in ['Order ID', 'Order Number', 'Phone', 'SKU', 'Date', 'Size']):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 48)

print("All parsing engines, helpers, and styling definitions initialized.\n")
# =============================================================================
# PART 1: RECREATE E-COMMERCE WORKBOOK (October 2026 Item, Product & SKU Performance.xlsx)
# =============================================================================
print("--- Parsing E-Commerce Pathao Orders with COGS Enrichment ---")

item_rows = []
prod_agg = {}
sku_agg = {}
ecom_order_rows = []

for order in raw_orders:
    o_id = str(order.get('id', ''))
    o_num = str(order.get('number', o_id))
    order_date = str(order.get('date_created', ''))[:10]
    
    billing = order.get('billing', {})
    shipping = order.get('shipping', {})
    
    cust_name = f"{billing.get('first_name', '')} {billing.get('last_name', '')}".strip()
    if not cust_name:
        cust_name = f"{shipping.get('first_name', '')} {shipping.get('last_name', '')}".strip()
        
    phone = str(billing.get('phone', '') or shipping.get('phone', '')).strip()
    address = str(shipping.get('address_1', '') or billing.get('address_1', '')).strip()
    city = str(shipping.get('city', '') or billing.get('city', '')).strip()
    
    pm = str(order.get('payment_method_title', '') or order.get('payment_method', '')).strip()
    wc_status = str(order.get('status', '')).strip().lower()
    
    matched_p = pathao_by_order.get(o_id, [])
    if not matched_p:
        continue
        
    p_info = resolve_pathao_records(matched_p)
    courier_st = p_info['status']
    cons_id = p_info['consignment_ids']
    store_name = p_info['stores']
    
    if courier_st in ['Pickup Cancel', 'Untracked']:
        continue
    if wc_status == 'cancelled' and not p_info.get('has_delivered'):
        continue

    channel = 'Branch Split Courier' if any(c in p_info['merchant_ids'].lower() for c in [' c', ' w', ' s', ' m']) else 'Central Warehouse Courier'
    line_items = order.get('line_items', [])

    discrete_units = []
    for item in line_items:
        qty = int(item.get('quantity', 1) or 1)
        price = float(item.get('price', 0) or 0)
        name = str(item.get('name', '')).strip()
        sku = str(item.get('sku', 'GENERAL')).strip()
        prod_id = item.get('product_id')
        var_id = item.get('variation_id')
        unit_cogs, cogs_src, is_exact = get_cogs_info(sku, price, prod_id, var_id)
        
        for q in range(qty):
            discrete_units.append({
                'unit_idx': len(discrete_units),
                'name': name,
                'sku': sku,
                'cost': price,
                'unit_cogs': unit_cogs,
                'cogs_src': cogs_src,
                'is_exact': is_exact,
                'prod_id': prod_id,
                'var_id': var_id,
                'item_ref': item
            })

    kept_unit_indices = set()
    if courier_st == 'Partial Delivery':
        kept_unit_indices = solve_partial_knapsack(discrete_units, p_info['collected'])

    order_val = float(order.get('total', 0) or 0)
    ecom_order_rows.append({
        'Order ID': o_id,
        'Order Number': o_num,
        'Order Date': order_date,
        'Customer Name': cust_name,
        'Customer Phone': phone,
        'City': city,
        'Address': address,
        'Delivery Territory': 'Inside Dhaka' if 'dhaka' in city.lower() else 'Outside Dhaka',
        'Payment Method': pm,
        'Fulfillment Channel': channel,
        'Fulfillment Store / Outlet': store_name,
        'Total Units': len(discrete_units),
        'Order Value (৳)': order_val,
        'WooCommerce Status': wc_status,
        'Pathao Consignment ID': cons_id,
        'Courier Delivery Status': courier_st,
        'Pathao Merchant Order ID': p_info['merchant_ids'],
        'Pathao Collected COD (৳)': p_info['collected'],
        'Pathao Courier Fee (৳)': p_info['total_fee'],
        'Audit Classification': '✅ Verified Delivered' if courier_st in ['Delivered', 'Exchange Delivered', 'Delivered (Split/Return)'] else (f'💰 {courier_st}' if 'Paid' in courier_st else (f'❌ {courier_st}' if 'Return' in courier_st else f'ℹ️ {courier_st}')),
        'Purchased Items': ', '.join([f"{it.get('name')} (x{it.get('quantity', 1)})" for it in line_items])
    })

    for item in line_items:
        item_name = str(item.get('name', 'Product')).strip()
        sku = str(item.get('sku', 'GENERAL')).strip()
        total_qty = int(item.get('quantity', 1) or 1)
        price = float(item.get('price', 0) or 0)
        prod_id = item.get('product_id')
        var_id = item.get('variation_id')
        
        unit_cogs, cogs_src, is_exact = get_cogs_info(sku, price, prod_id, var_id)
        if is_exact and unit_cogs is not None:
            gross_profit_per_unit = round(price - unit_cogs)
            gross_margin_pct = (gross_profit_per_unit / price * 100) if price > 0 else 0.0
            gross_margin_str = f"{gross_margin_pct:.1f}%"
            unit_cogs_val = unit_cogs
        else:
            gross_profit_per_unit = None
            gross_margin_str = "didn'tget"
            unit_cogs_val = "didn'tget" 

        base_name, size = extract_size_and_base(item_name)
        cat, subcat = extract_category_and_sub(item_name, sku)
        brand_name = classify_brand_name(item_name, sku)

        if courier_st == 'Partial Delivery':
            units_of_this_item = [u for u in discrete_units if u['name'] == item_name and u['sku'] == sku]
            kept_count = sum(1 for u in units_of_this_item if u['unit_idx'] in kept_unit_indices)
            returned_count = len(units_of_this_item) - kept_count
            
            if kept_count > 0:
                item_rows.append({
                    'Order Number': o_num,
                    'Order ID': o_id,
                    'Order Date': order_date,
                    'Customer Name': cust_name,
                    'Customer Phone': phone,
                    'City': city,
                    'Address': address,
                    'Brand Name': brand_name,
                    'Category': cat,
                    'Sub-Category': subcat,
                    'Item Name': item_name,
                    'Base Product Name': base_name,
                    'SKU': sku,
                    'Size': size,
                    'Unit Price (৳)': round(price),
                    'Quantity': kept_count,
                    'Total Value (৳)': round(price * kept_count),
                    'Unit COGS (৳)': unit_cogs_val,
                    'Total COGS (৳)': (unit_cogs * kept_count) if is_exact else "didn'tget",
                    'Realized Gross Profit (৳)': (gross_profit_per_unit * kept_count) if is_exact else "didn'tget",
                    'Gross Margin (%)': gross_margin_str,
                    'COGS Source': cogs_src,
                    'Delivered or Not': 'Delivered',
                    'Pathao Consignment ID': cons_id,
                    'Courier Overall Status': courier_st,
                    'Fulfillment Channel': channel,
                    'Fulfillment Store': store_name,
                    'Audit Classification': '🔄 Partial Accepted (Garment Kept)'
                })
            
            if returned_count > 0:
                item_rows.append({
                    'Order Number': o_num,
                    'Order ID': o_id,
                    'Order Date': order_date,
                    'Customer Name': cust_name,
                    'Customer Phone': phone,
                    'City': city,
                    'Address': address,
                    'Brand Name': brand_name,
                    'Category': cat,
                    'Sub-Category': subcat,
                    'Item Name': item_name,
                    'Base Product Name': base_name,
                    'SKU': sku,
                    'Size': size,
                    'Unit Price (৳)': round(price),
                    'Quantity': returned_count,
                    'Total Value (৳)': round(price * returned_count),
                    'Unit COGS (৳)': unit_cogs_val,
                    'Total COGS (৳)': (unit_cogs * returned_count) if is_exact else "didn'tget",
                    'Realized Gross Profit (৳)': 0 if is_exact else "didn'tget",
                    'Gross Margin (%)': gross_margin_str,
                    'COGS Source': cogs_src,
                    'Delivered or Not': 'Returned',
                    'Pathao Consignment ID': cons_id,
                    'Courier Overall Status': courier_st,
                    'Fulfillment Channel': channel,
                    'Fulfillment Store': store_name,
                    'Audit Classification': '🔄 Partial Returned (Garment Rejected)'
                })
                
            prod_key = base_name
            if prod_key not in prod_agg:
                prod_agg[prod_key] = {
                    'Brand Name': brand_name,
                    'Category': cat, 'Sub-Category': subcat, 'Product Name': base_name,
                    'Base SKU': sku.split('-')[0] + '-' + sku.split('-')[1] if '-' in sku and len(sku.split('-')) > 1 else sku,
                    'Sizes': set(), 'Unit Price (৳)': price, 'Unit COGS (৳)': unit_cogs,
                    'Dispatched Units': 0, 'Gross Dispatched Value (৳)': 0.0, 'Dispatched COGS (৳)': 0.0,
                    'Delivered Units': 0, 'Delivered Value (৳)': 0.0, 'Delivered COGS (৳)': 0.0,
                    'Central Delivered Units': 0, 'Branch Delivered Units': 0,
                    'Total Returned Units': 0, 'Paid Return Units': 0, 'Non-Paid Return Units': 0, 'Returned Value (৳)': 0.0, 'In Transit Units': 0,
                }
            p = prod_agg[prod_key]
            p['Sizes'].add(size)
            p['Dispatched Units'] += total_qty
            p['Gross Dispatched Value (৳)'] += price * total_qty
            if is_exact and unit_cogs is not None:
                p['Dispatched COGS (৳)'] += unit_cogs * total_qty
                p['Delivered COGS (৳)'] += unit_cogs * kept_count
                p['Exact Dispatched COGS Units'] = p.get('Exact Dispatched COGS Units', 0) + total_qty
                p['Exact Delivered COGS Units'] = p.get('Exact Delivered COGS Units', 0) + kept_count
            
            p['Delivered Units'] += kept_count
            p['Delivered Value (৳)'] += price * kept_count
            if channel == 'Central Warehouse Courier':
                p['Central Delivered Units'] += kept_count
            else:
                p['Branch Delivered Units'] += kept_count
                
            p['Total Returned Units'] += returned_count
            p['Non-Paid Return Units'] += returned_count
            p['Returned Value (৳)'] += price * returned_count

            sku_key = f"{sku}__{size}__{item_name}"
            if sku_key not in sku_agg:
                sku_agg[sku_key] = {
                    'Brand Name': brand_name,
                    'Category': cat, 'Sub-Category': subcat, 'Product Name': item_name,
                    'SKU Code': sku, 'Size': size, 'Unit Price (৳)': price, 'Unit COGS (৳)': unit_cogs,
                    'COGS Source': cogs_src,
                    'Dispatched Units': 0, 'Gross Dispatched Value (৳)': 0.0, 'Dispatched COGS (৳)': 0.0,
                    'Delivered Units': 0, 'Delivered Value (৳)': 0.0, 'Delivered COGS (৳)': 0.0,
                    'Central Delivered Units': 0, 'Branch Delivered Units': 0,
                    'Total Returned Units': 0, 'Paid Return Units': 0, 'Non-Paid Return Units': 0, 'Returned Value (৳)': 0.0, 'In Transit Units': 0,
                }
            s = sku_agg[sku_key]
            s['Dispatched Units'] += total_qty
            s['Gross Dispatched Value (৳)'] += price * total_qty
            s['is_exact'] = is_exact
            if is_exact and unit_cogs is not None:
                s['Dispatched COGS (৳)'] += unit_cogs * total_qty
                s['Delivered COGS (৳)'] += unit_cogs * kept_count
            
            s['Delivered Units'] += kept_count
            s['Delivered Value (৳)'] += price * kept_count
            if channel == 'Central Warehouse Courier':
                s['Central Delivered Units'] += kept_count
            else:
                s['Branch Delivered Units'] += kept_count
                
            s['Total Returned Units'] += returned_count
            s['Non-Paid Return Units'] += returned_count
            s['Returned Value (৳)'] += price * returned_count

        else:
            is_delivered = courier_st in ['Delivered', 'Exchange Delivered', 'Delivered (Split/Return)']
            is_returned = 'Return' in courier_st
            is_paid_ret = courier_st == 'Paid Return'
            
            if is_delivered:
                disposition = 'Delivered'
                audit_tag = '✅ Verified Delivered'
                realized_profit = (gross_profit_per_unit * total_qty) if (is_exact and gross_profit_per_unit is not None) else "didn'tget"
            elif is_paid_ret:
                disposition = 'Paid Return'
                audit_tag = '💰 Paid Return (Refusal COD Recovered)'
                realized_profit = 0 if is_exact else "didn'tget"
            elif is_returned:
                disposition = 'Returned'
                audit_tag = '❌ Full Return (Customer Rejected)'
                realized_profit = 0 if is_exact else "didn'tget"
            elif courier_st == 'In Transit':
                disposition = 'In Transit'
                audit_tag = '🚚 Active In-Transit'
                realized_profit = 0 if is_exact else "didn'tget"
            elif courier_st == 'Exchange':
                disposition = 'Exchange In Transit'
                audit_tag = '🔄 Size/Color Replacement In-Transit'
                realized_profit = 0 if is_exact else "didn'tget"
            else:
                disposition = courier_st
                audit_tag = f'ℹ️ {courier_st}'
                realized_profit = 0 if is_exact else "didn'tget"

            item_rows.append({
                'Order Number': o_num,
                'Order ID': o_id,
                'Order Date': order_date,
                'Customer Name': cust_name,
                'Customer Phone': phone,
                'City': city,
                'Address': address,
                'Brand Name': brand_name,
                'Category': cat,
                'Sub-Category': subcat,
                'Item Name': item_name,
                'Base Product Name': base_name,
                'SKU': sku,
                'Size': size,
                'Unit Price (৳)': round(price),
                'Quantity': total_qty,
                'Total Value (৳)': round(price * total_qty),
                'Unit COGS (৳)': unit_cogs_val,
                'Total COGS (৳)': (unit_cogs * total_qty) if is_exact else "didn'tget",
                'Realized Gross Profit (৳)': (gross_profit_per_unit * total_qty) if (is_exact and is_delivered) else (0 if is_exact else "didn'tget"),
                'Gross Margin (%)': gross_margin_str,
                'COGS Source': cogs_src,
                'Delivered or Not': disposition,
                'Pathao Consignment ID': cons_id,
                'Courier Overall Status': courier_st,
                'Fulfillment Channel': channel,
                'Fulfillment Store': store_name,
                'Audit Classification': audit_tag
            })

            prod_key = base_name
            if prod_key not in prod_agg:
                prod_agg[prod_key] = {
                    'Brand Name': brand_name,
                    'Category': cat, 'Sub-Category': subcat, 'Product Name': base_name,
                    'Base SKU': sku.split('-')[0] + '-' + sku.split('-')[1] if '-' in sku and len(sku.split('-')) > 1 else sku,
                    'Sizes': set(), 'Unit Price (৳)': price, 'Unit COGS (৳)': unit_cogs,
                    'Dispatched Units': 0, 'Gross Dispatched Value (৳)': 0.0, 'Dispatched COGS (৳)': 0.0,
                    'Delivered Units': 0, 'Delivered Value (৳)': 0.0, 'Delivered COGS (৳)': 0.0,
                    'Central Delivered Units': 0, 'Branch Delivered Units': 0,
                    'Total Returned Units': 0, 'Paid Return Units': 0, 'Non-Paid Return Units': 0, 'Returned Value (৳)': 0.0, 'In Transit Units': 0,
                }
            p = prod_agg[prod_key]
            p['Sizes'].add(size)
            p['Dispatched Units'] += total_qty
            p['Gross Dispatched Value (৳)'] += price * total_qty
            if is_exact and unit_cogs is not None:
                p['Dispatched COGS (৳)'] += unit_cogs * total_qty
                p['Exact Dispatched COGS Units'] = p.get('Exact Dispatched COGS Units', 0) + total_qty
                if is_delivered:
                    p['Delivered COGS (৳)'] += unit_cogs * total_qty
                    p['Exact Delivered COGS Units'] = p.get('Exact Delivered COGS Units', 0) + total_qty
            
            if is_delivered:
                p['Delivered Units'] += total_qty
                p['Delivered Value (৳)'] += price * total_qty
                if channel == 'Central Warehouse Courier':
                    p['Central Delivered Units'] += total_qty
                else:
                    p['Branch Delivered Units'] += total_qty
            if is_returned:
                p['Total Returned Units'] += total_qty
                p['Returned Value (৳)'] += price * total_qty
                if disposition == 'Paid Return':
                    p['Paid Return Units'] += total_qty
                else:
                    p['Non-Paid Return Units'] += total_qty
            if disposition == 'In Transit':
                p['In Transit Units'] += total_qty

            sku_key = f"{sku}__{size}__{item_name}"
            if sku_key not in sku_agg:
                sku_agg[sku_key] = {
                    'Brand Name': brand_name,
                    'Category': cat, 'Sub-Category': subcat, 'Product Name': item_name,
                    'SKU Code': sku, 'Size': size, 'Unit Price (৳)': price, 'Unit COGS (৳)': unit_cogs,
                    'COGS Source': cogs_src,
                    'Dispatched Units': 0, 'Gross Dispatched Value (৳)': 0.0, 'Dispatched COGS (৳)': 0.0,
                    'Delivered Units': 0, 'Delivered Value (৳)': 0.0, 'Delivered COGS (৳)': 0.0,
                    'Central Delivered Units': 0, 'Branch Delivered Units': 0,
                    'Total Returned Units': 0, 'Paid Return Units': 0, 'Non-Paid Return Units': 0, 'Returned Value (৳)': 0.0, 'In Transit Units': 0,
                }
            s = sku_agg[sku_key]
            s['Dispatched Units'] += total_qty
            s['Gross Dispatched Value (৳)'] += price * total_qty
            s['is_exact'] = is_exact
            if is_exact and unit_cogs is not None:
                s['Dispatched COGS (৳)'] += unit_cogs * total_qty
                if is_delivered:
                    s['Delivered COGS (৳)'] += unit_cogs * total_qty
            
            if is_delivered:
                s['Delivered Units'] += total_qty
                s['Delivered Value (৳)'] += price * total_qty
                if channel == 'Central Warehouse Courier':
                    s['Central Delivered Units'] += total_qty
                else:
                    s['Branch Delivered Units'] += total_qty
            if is_returned:
                s['Total Returned Units'] += total_qty
                s['Returned Value (৳)'] += price * total_qty
                if disposition == 'Paid Return':
                    s['Paid Return Units'] += total_qty
                else:
                    s['Non-Paid Return Units'] += total_qty
            if disposition == 'In Transit':
                s['In Transit Units'] += total_qty

prod_rows = []
for p in sorted(prod_agg.values(), key=lambda x: -x['Gross Dispatched Value (৳)']):
    deliv_rate = (p['Delivered Units'] / p['Dispatched Units'] * 100) if p['Dispatched Units'] > 0 else 0
    ret_rate = (p['Total Returned Units'] / p['Dispatched Units'] * 100) if p['Dispatched Units'] > 0 else 0
    avg_price = round(p['Gross Dispatched Value (৳)'] / p['Dispatched Units']) if p['Dispatched Units'] > 0 else p['Unit Price (৳)']
    
    has_full_exact = (p.get('Exact Dispatched COGS Units', 0) == p['Dispatched Units']) and (p['Dispatched Units'] > 0)
    if has_full_exact:
        avg_cogs = round(p['Dispatched COGS (৳)'] / p['Dispatched Units'])
        disp_cg_val = round(p['Dispatched COGS (৳)'])
        deliv_cg_val = round(p['Delivered COGS (৳)'])
        realized_profit = round(p['Delivered Value (৳)'] - deliv_cg_val)
        margin_pct = (realized_profit / p['Delivered Value (৳)'] * 100) if p['Delivered Value (৳)'] > 0 else 0.0
        margin_str = f"{margin_pct:.1f}%"
    else:
        avg_cogs = "didn'tget"
        disp_cg_val = "didn'tget"
        deliv_cg_val = "didn'tget"
        realized_profit = "didn'tget"
        margin_str = "didn'tget"
    
    prod_rows.append({
        'Brand Name': p['Brand Name'],
        'Category': p['Category'],
        'Sub-Category': p['Sub-Category'],
        'Product Name': p['Product Name'],
        'Base SKU': p['Base SKU'],
        'Size Variations': len(p['Sizes']),
        'Unit Price (৳)': avg_price,
        'Unit COGS (৳)': avg_cogs,
        'Dispatched Units (Sent by Pathao)': p['Dispatched Units'],
        'Gross Dispatched Value (৳)': round(p['Gross Dispatched Value (৳)']),
        'Total Dispatched COGS (৳)': disp_cg_val,
        'Total Sold (Delivered Units)': p['Delivered Units'],
        'Delivered Value (৳)': round(p['Delivered Value (৳)']),
        'Total Delivered COGS (৳)': deliv_cg_val,
        'Realized Gross Profit (৳)': realized_profit,
        'Gross Margin (%)': margin_str,
        'Central Warehouse Delivered': p['Central Delivered Units'],
        'Branch Split Delivered': p['Branch Delivered Units'],
        'Total Returned Units': p['Total Returned Units'],
        'Paid Returns (Refusal COD)': p['Paid Return Units'],
        'Non-Paid Returns (Rejected)': p['Non-Paid Return Units'],
        'Returned Value (৳)': round(p['Returned Value (৳)']),
        'In Transit Units': p['In Transit Units'],
        'Delivery Rate (%)': f"{deliv_rate:.1f}%",
        'Return Rate (%)': f"{ret_rate:.1f}%",
        'Performance Tag': get_tag(deliv_rate, ret_rate, p['Dispatched Units'])
    })

sku_rows = []
for s in sorted(sku_agg.values(), key=lambda x: -x['Gross Dispatched Value (৳)']):
    deliv_rate = (s['Delivered Units'] / s['Dispatched Units'] * 100) if s['Dispatched Units'] > 0 else 0
    ret_rate = (s['Total Returned Units'] / s['Dispatched Units'] * 100) if s['Dispatched Units'] > 0 else 0
    
    if s.get('is_exact') and s.get('Unit COGS (৳)') is not None and str(s.get('Unit COGS (৳)')).strip() != "didn'tget":
        unit_cg = round(float(s['Unit COGS (৳)']))
        disp_cg = round(s['Dispatched COGS (৳)'])
        deliv_cg = round(s['Delivered COGS (৳)'])
        realized_profit = round(s['Delivered Value (৳)'] - deliv_cg)
        margin_pct = (realized_profit / s['Delivered Value (৳)'] * 100) if s['Delivered Value (৳)'] > 0 else 0.0
        margin_str = f"{margin_pct:.1f}%"
        cogs_src_val = 'Exact WooCommerce (REST API)'
    else:
        unit_cg = "didn'tget"
        disp_cg = "didn'tget"
        deliv_cg = "didn'tget"
        realized_profit = "didn'tget"
        margin_str = "didn'tget"
        cogs_src_val = "didn'tget"
        
    sku_rows.append({
        'Brand Name': s['Brand Name'],
        'Category': s['Category'],
        'Sub-Category': s['Sub-Category'],
        'Product Name': s['Product Name'],
        'SKU Code': s['SKU Code'],
        'Size': s['Size'],
        'Unit Price (৳)': round(s['Unit Price (৳)']),
        'Unit COGS (৳)': unit_cg,
        'Dispatched Units (Sent by Pathao)': s['Dispatched Units'],
        'Gross Dispatched Value (৳)': round(s['Gross Dispatched Value (৳)']),
        'Total Dispatched COGS (৳)': disp_cg,
        'Total Sold (Delivered Units)': s['Delivered Units'],
        'Delivered Value (৳)': round(s['Delivered Value (৳)']),
        'Total Delivered COGS (৳)': deliv_cg,
        'Realized Gross Profit (৳)': realized_profit,
        'Gross Margin (%)': margin_str,
        'COGS Source': cogs_src_val,
        'Central Warehouse Delivered': s['Central Delivered Units'],
        'Branch Split Delivered': s['Branch Delivered Units'],
        'Total Returned Units': s['Total Returned Units'],
        'Paid Returns (Refusal COD)': s['Paid Return Units'],
        'Non-Paid Returns (Rejected)': s['Non-Paid Return Units'],
        'Returned Value (৳)': round(s['Returned Value (৳)']),
        'In Transit Units': s['In Transit Units'],
        'Delivery Rate (%)': f"{deliv_rate:.1f}%",
        'Return Rate (%)': f"{ret_rate:.1f}%",
        'Performance Tag': get_tag(deliv_rate, ret_rate, s['Dispatched Units'])
    })

df_items_final = pd.DataFrame(item_rows)
df_prod_final = pd.DataFrame(prod_rows)
df_sku_final = pd.DataFrame(sku_rows)
df_orders_final = pd.DataFrame(ecom_order_rows)

print(f"Generated {len(df_items_final)} item rows, {len(df_prod_final)} products, {len(df_sku_final)} SKUs.")

# Create Workbook for E-Commerce
wb_ecom = openpyxl.Workbook()
wb_ecom.remove(wb_ecom.active) # Remove default sheet

# Create Sheets in standard order: Summary, Item Wise Performance, Product Wise Performance, SKU Wise Performance
ws_sum = wb_ecom.create_sheet(title='Summary')

# Format 3 detail sheets
ws_items = wb_ecom.create_sheet(title='Item Wise Performance')
for col_idx, col_name in enumerate(df_items_final.columns, 1):
    ws_items.cell(row=1, column=col_idx, value=col_name)
for r_idx, row in enumerate(df_items_final.itertuples(index=False), 2):
    for c_idx, val in enumerate(row, 1):
        ws_items.cell(row=r_idx, column=c_idx, value=val)
format_standard_sheet(ws_items, df_items_final, freeze_cell="C2")

ws_prod = wb_ecom.create_sheet(title='Product Wise Performance')
for col_idx, col_name in enumerate(df_prod_final.columns, 1):
    ws_prod.cell(row=1, column=col_idx, value=col_name)
for r_idx, row in enumerate(df_prod_final.itertuples(index=False), 2):
    for c_idx, val in enumerate(row, 1):
        ws_prod.cell(row=r_idx, column=c_idx, value=val)
format_standard_sheet(ws_prod, df_prod_final, freeze_cell="B2")

ws_sku = wb_ecom.create_sheet(title='SKU Wise Performance')
for col_idx, col_name in enumerate(df_sku_final.columns, 1):
    ws_sku.cell(row=1, column=col_idx, value=col_name)
for r_idx, row in enumerate(df_sku_final.itertuples(index=False), 2):
    for c_idx, val in enumerate(row, 1):
        ws_sku.cell(row=r_idx, column=c_idx, value=val)
format_standard_sheet(ws_sku, df_sku_final, freeze_cell="B2")

# Build E-Commerce Executive Summary Sheet
print("Building Executive Summary Sheet for E-Commerce...")
ws_sum.views.sheetView[0].showGridLines = True

order_map = {}
for it in item_rows:
    o_num = it['Order Number']
    if o_num not in order_map:
        order_map[o_num] = {
            'order_num': o_num,
            'status': it['Courier Overall Status'],
            'channel': it['Fulfillment Channel'],
            'store': it['Fulfillment Store'],
            'disp_units': 0,
            'disp_val': 0.0,
            'disp_cogs': 0.0,
            'deliv_units': 0,
            'deliv_val': 0.0,
            'deliv_cogs': 0.0,
            'ret_units': 0,
            'ret_val': 0.0,
            'trans_units': 0,
            'trans_val': 0.0,
        }
    om = order_map[o_num]
    q = int(it['Quantity'] or 0)
    v = float(it['Total Value (৳)'] or 0.0)
    raw_cg = it.get('Total COGS (৳)')
    cg = float(raw_cg) if (raw_cg is not None and str(raw_cg).strip() != "didn'tget") else 0.0
    disp = it['Delivered or Not']
    om['disp_units'] += q
    om['disp_val'] += v
    om['disp_cogs'] += cg
    if disp == 'Delivered':
        om['deliv_units'] += q
        om['deliv_val'] += v
        om['deliv_cogs'] += cg
    elif disp in ['Returned', 'Paid Return']:
        om['ret_units'] += q
        om['ret_val'] += v
    elif disp == 'In Transit':
        om['trans_units'] += q
        om['trans_val'] += v

orders_list = list(order_map.values())
total_unique_orders = len(orders_list)
total_disp_units = sum(o['disp_units'] for o in orders_list)
total_disp_val = sum(o['disp_val'] for o in orders_list)
total_disp_cogs = sum(o['disp_cogs'] for o in orders_list)

total_deliv_units = sum(o['deliv_units'] for o in orders_list)
total_deliv_val = sum(o['deliv_val'] for o in orders_list)
total_deliv_cogs = sum(o['deliv_cogs'] for o in orders_list)
total_realized_gross_profit = total_deliv_val - total_deliv_cogs
overall_gross_margin = (total_realized_gross_profit / total_deliv_val * 100) if total_deliv_val > 0 else 0.0

total_ret_units = sum(o['ret_units'] for o in orders_list)
total_ret_val = sum(o['ret_val'] for o in orders_list)

overall_aov = total_disp_val / total_unique_orders if total_unique_orders else 0
orders_with_deliv = [o for o in orders_list if o['deliv_units'] > 0]
deliv_aov = total_deliv_val / len(orders_with_deliv) if len(orders_with_deliv) else 0
overall_deliv_rate_units = (total_deliv_units / total_disp_units * 100) if total_disp_units else 0
overall_ret_rate_units = (total_ret_units / total_disp_units * 100) if total_disp_units else 0

exchange_orders = [o for o in orders_list if 'exchange' in o['status'].lower()]
exchange_orders_cnt = len(exchange_orders)
exchange_deliv_val = sum(o['deliv_val'] for o in exchange_orders)
exchange_units = sum(o['deliv_units'] for o in exchange_orders)

# Title Banner
font_title = Font(name='Calibri', size=16, bold=True, color='0F172A')
font_subtitle = Font(name='Calibri', size=10, italic=True, color='475569')
card_label_font = Font(name='Calibri', size=8.5, bold=True, color='475569')
card_value_font = Font(name='Calibri', size=15, bold=True, color='0F172A')
card_sub_font = Font(name='Calibri', size=8, color='64748B')

ws_sum.merge_cells('A1:N1')
ws_sum['A1'] = "DEEN COMMERCE — OCTOBER 2026 EXECUTIVE SALES & FULFILLMENT SUMMARY"
ws_sum['A1'].font = font_title
ws_sum['A1'].alignment = Alignment(horizontal='left', vertical='center')

ws_sum.merge_cells('A2:N2')
ws_sum['A2'] = "Pathao Hermes E-Commerce Dispatches · Exact WooCommerce REST API COGS & Profit Margins · Realized Sales Knapsack Breakdown"
ws_sum['A2'].font = font_subtitle
ws_sum['A2'].alignment = Alignment(horizontal='left', vertical='center')

ws_sum.row_dimensions[1].height = 25
ws_sum.row_dimensions[2].height = 18

# 8 Executive KPI Cards
ecom_kpis = [
    {'col_start': 'A', 'col_end': 'B', 'label': 'TOTAL UNIQUE ORDERS', 'val': f"{total_unique_orders:,}", 'sub': '100% Pathao Hermes Ecom'},
    {'col_start': 'C', 'col_end': 'D', 'label': 'NET DELIVERED SALES', 'val': f"৳{total_deliv_val:,.0f}", 'sub': f"{total_deliv_units:,} Units Accepted & Settled"},
    {'col_start': 'E', 'col_end': 'F', 'label': 'DELIVERED COGS (COST)', 'val': f"৳{total_deliv_cogs:,.0f}", 'sub': 'Exact REST API + Baseline Cost'},
    {'col_start': 'G', 'col_end': 'H', 'label': 'REALIZED GROSS PROFIT', 'val': f"৳{total_realized_gross_profit:,.0f}", 'sub': f"{overall_gross_margin:.1f}% Realized Gross Margin"},
    {'col_start': 'I', 'col_end': 'J', 'label': 'DELIVERED ORDER AOV', 'val': f"৳{deliv_aov:,.2f}", 'sub': f"Gross AOV: ৳{overall_aov:,.2f}"},
    {'col_start': 'K', 'col_end': 'L', 'label': 'DELIVERY SUCCESS RATE', 'val': f"{overall_deliv_rate_units:.1f}%", 'sub': f"{len(orders_with_deliv)} of {total_unique_orders} Orders Delivered"},
    {'col_start': 'M', 'col_end': 'N', 'label': 'TOTAL RETURNED VALUE', 'val': f"৳{total_ret_val:,.0f}", 'sub': f"{total_ret_units:,} Units ({overall_ret_rate_units:.1f}% Return Rate)"},
]

for card in ecom_kpis:
    cs, ce = card['col_start'], card['col_end']
    ws_sum.merge_cells(f"{cs}4:{ce}4")
    ws_sum.merge_cells(f"{cs}5:{ce}5")
    ws_sum.merge_cells(f"{cs}6:{ce}6")
    
    ws_sum[f"{cs}4"].value = card['label']
    ws_sum[f"{cs}4"].font = card_label_font
    ws_sum[f"{cs}4"].alignment = Alignment(horizontal='center', vertical='center')
    
    ws_sum[f"{cs}5"].value = card['val']
    ws_sum[f"{cs}5"].font = card_value_font
    ws_sum[f"{cs}5"].alignment = Alignment(horizontal='center', vertical='center')
    
    ws_sum[f"{cs}6"].value = card['sub']
    ws_sum[f"{cs}6"].font = card_sub_font
    ws_sum[f"{cs}6"].alignment = Alignment(horizontal='center', vertical='center')
    
    for col_char in [cs, ce]:
        col_idx = openpyxl.utils.column_index_from_string(col_char)
        for r in range(4, 7):
            cell = ws_sum.cell(row=r, column=col_idx)
            cell.fill = kpi_fill
            cell.border = thin_border

ws_sum.row_dimensions[4].height = 16
ws_sum.row_dimensions[5].height = 24
ws_sum.row_dimensions[6].height = 16

def write_ecom_section_header(row, title, max_col='N'):
    ws_sum.merge_cells(f"A{row}:{max_col}{row}")
    cell = ws_sum[f"A{row}"]
    cell.value = title
    cell.font = section_hdr_font
    cell.fill = section_hdr_fill
    cell.alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws_sum.row_dimensions[row].height = 22

# Section 1: Order Disposition & Delivery Status Breakdown
cur_row = 8
write_ecom_section_header(cur_row, "1. ORDER DISPOSITION, REALIZED PROFIT & DELIVERY STATUS BREAKDOWN", "N")
cur_row += 1

status_cols = [
    'Courier Overall Status', 'Order Classification Note', 'Unique Orders', 'Order Share (%)',
    'Dispatched Units', 'Delivered Units', 'Returned Units', 'Gross Value (৳)',
    'Delivered Sales (৳)', 'Delivered COGS (৳)', 'Realized Gross Profit (৳)', 'Gross Margin (%)',
    'Returned Value (৳)', 'Delivery Rate (%)'
]

ws_sum.row_dimensions[cur_row].height = 20
for c_idx, c_name in enumerate(status_cols, 1):
    c = ws_sum.cell(row=cur_row, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row += 1

status_configs = [
    {'st': 'Delivered', 'note': 'Customer accepted 100% of garments; full payment settled'},
    {'st': 'Partial Delivery', 'note': 'Customer accepted select garment(s) & rejected remainder'},
    {'st': 'Exchange Delivered', 'note': 'Replacement parcel successfully accepted by customer'},
    {'st': 'Delivered (Split/Return)', 'note': 'Split dispatch consignment fulfilled while sibling returned'},
    {'st': 'Paid Return', 'note': 'Customer rejected goods but paid refusal/shipping COD charge'},
    {'st': 'Returned', 'note': 'Complete parcel returned back to central stock with zero collection'},
    {'st': 'Return In Transit', 'note': 'Courier confirmed rejection; parcel moving back to warehouse'},
    {'st': 'In Transit', 'note': 'Parcel with Pathao courier rider for active physical delivery'},
    {'st': 'Exchange', 'note': 'Post-sale exchange parcel currently out for delivery / swap'}
]

for sc in status_configs:
    st_name = sc['st']
    matching_orders = [o for o in orders_list if o['status'] == st_name]
    cnt = len(matching_orders)
    if cnt == 0:
        continue
    disp_u = sum(o['disp_units'] for o in matching_orders)
    deliv_u = sum(o['deliv_units'] for o in matching_orders)
    ret_u = sum(o['ret_units'] for o in matching_orders)
    disp_v = sum(o['disp_val'] for o in matching_orders)
    deliv_v = sum(o['deliv_val'] for o in matching_orders)
    deliv_cg = sum(o['deliv_cogs'] for o in matching_orders)
    profit = deliv_v - deliv_cg
    margin_p = (profit / deliv_v * 100) if deliv_v > 0 else 0.0
    ret_v = sum(o['ret_val'] for o in matching_orders)
    deliv_r = (deliv_u / disp_u * 100) if disp_u else 0
    
    ws_sum.row_dimensions[cur_row].height = 18
    r_vals = [
        st_name, sc['note'], cnt, (cnt / total_unique_orders) if total_unique_orders else 0,
        disp_u, deliv_u, ret_u, disp_v, deliv_v, deliv_cg, profit, margin_p / 100.0,
        ret_v, deliv_r / 100.0
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_sum.cell(row=cur_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [3, 5, 6, 7, 8, 9, 10, 11, 13]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [4, 12, 14]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row += 1

# Section 1 Total Row
ws_sum.row_dimensions[cur_row].height = 20
tot_s1_vals = [
    "TOTAL E-COMMERCE SHIPMENTS", "All Dispatched Parcels Reconciled",
    total_unique_orders, 1.0, total_disp_units, total_deliv_units, total_ret_units,
    total_disp_val, total_deliv_val, total_deliv_cogs, total_realized_gross_profit,
    overall_gross_margin / 100.0, total_ret_val, overall_deliv_rate_units / 100.0
]
for c_idx, val in enumerate(tot_s1_vals, 1):
    cell = ws_sum.cell(row=cur_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 2]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [3, 5, 6, 7, 8, 9, 10, 11, 13]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [4, 12, 14]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'
cur_row += 2

# Section 2: Fulfillment Channel & Inventory Split
write_ecom_section_header(cur_row, "2. FULFILLMENT CHANNEL & INVENTORY DISPATCH SPLIT", "M")
cur_row += 1

chan_cols = [
    'Fulfillment Channel', 'Dispatch Routing Description', 'Dispatched Orders', 'Order Share (%)',
    'Dispatched Units', 'Delivered Units', 'Returned Units', 'Dispatched Value (৳)',
    'Delivered Sales (৳)', 'Delivered COGS (৳)', 'Realized Gross Profit (৳)', 'Gross Margin (%)', 'Delivery Rate (%)'
]

ws_sum.row_dimensions[cur_row].height = 20
for c_idx, c_name in enumerate(chan_cols, 1):
    c = ws_sum.cell(row=cur_row, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row += 1

chan_configs = [
    ('Central Warehouse Courier', 'Primary e-commerce fulfillment from central Dhaka warehouse inventory'),
    ('Branch Split Courier', 'Retail outlet fulfillment (Cumilla, Wari, Sylhet, Mirpur) dispatched to customer')
]

for ch_name, ch_desc in chan_configs:
    matching_orders = [o for o in orders_list if o['channel'] == ch_name]
    cnt = len(matching_orders)
    disp_u = sum(o['disp_units'] for o in matching_orders)
    deliv_u = sum(o['deliv_units'] for o in matching_orders)
    ret_u = sum(o['ret_units'] for o in matching_orders)
    disp_v = sum(o['disp_val'] for o in matching_orders)
    deliv_v = sum(o['deliv_val'] for o in matching_orders)
    deliv_cg = sum(o['deliv_cogs'] for o in matching_orders)
    profit = deliv_v - deliv_cg
    margin_p = (profit / deliv_v * 100) if deliv_v > 0 else 0.0
    deliv_r = (deliv_u / disp_u * 100) if disp_u else 0
    
    ws_sum.row_dimensions[cur_row].height = 18
    r_vals = [
        ch_name, ch_desc, cnt, (cnt / total_unique_orders) if total_unique_orders else 0,
        disp_u, deliv_u, ret_u, disp_v, deliv_v, deliv_cg, profit, margin_p / 100.0, deliv_r / 100.0
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_sum.cell(row=cur_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [3, 5, 6, 7, 8, 9, 10, 11]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [4, 12, 13]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row += 1

ws_sum.row_dimensions[cur_row].height = 20
tot_chan_vals = [
    "TOTAL CHANNELS", "Combined Central Warehouse + Retail Split Dispatches",
    total_unique_orders, 1.0, total_disp_units, total_deliv_units, total_ret_units,
    total_disp_val, total_deliv_val, total_deliv_cogs, total_realized_gross_profit,
    overall_gross_margin / 100.0, overall_deliv_rate_units / 100.0
]
for c_idx, val in enumerate(tot_chan_vals, 1):
    cell = ws_sum.cell(row=cur_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 2]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [3, 5, 6, 7, 8, 9, 10, 11]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [4, 12, 13]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'
cur_row += 2

# Section 3: Brand Portfolio & Revenue Contribution
write_ecom_section_header(cur_row, "3. BRAND PORTFOLIO & REVENUE CONTRIBUTION", "M")
cur_row += 1

brand_cols = [
    'Brand Name', 'Portfolio Scope & Description', 'Unique Products', 'Active SKUs',
    'Dispatched Units', 'Delivered Units', 'Delivered Sales (৳)', 'Delivered COGS (৳)',
    'Realized Gross Profit (৳)', 'Gross Margin (%)', 'Volume Share (%)', 'Revenue Share (%)', 'Delivery Rate (%)'
]

ws_sum.row_dimensions[cur_row].height = 20
for c_idx, c_name in enumerate(brand_cols, 1):
    c = ws_sum.cell(row=cur_row, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row += 1

for b_name, b_desc in [('DEEN Select', 'Curated European & International Export Overrun Brands'), ('DEEN', 'In-House Core Engineered Apparel Lines')]:
    b_items = [it for it in item_rows if it['Brand Name'] == b_name]
    b_deliv = [it for it in b_items if it['Delivered or Not'] == 'Delivered']
    
    unique_prods = len(set(it['Base Product Name'] for it in b_items))
    unique_skus = len(set(it['SKU'] for it in b_items))
    
    disp_u = sum(it['Quantity'] for it in b_items)
    deliv_u = sum(it['Quantity'] for it in b_deliv)
    deliv_v = sum(it['Total Value (৳)'] for it in b_deliv)
    b_deliv_exact = [it for it in b_deliv if it.get('Total COGS (৳)') is not None and it['Total COGS (৳)'] != "didn'tget"]
    deliv_cg = sum(it['Total COGS (৳)'] for it in b_deliv_exact)
    profit = deliv_v - deliv_cg
    margin_p = (profit / deliv_v * 100) if deliv_v > 0 else 0.0
    
    vol_share = (deliv_u / total_deliv_units) if total_deliv_units else 0
    rev_share = (deliv_v / total_deliv_val) if total_deliv_val else 0
    deliv_r = (deliv_u / disp_u) if disp_u else 0
    
    ws_sum.row_dimensions[cur_row].height = 18
    r_vals = [
        b_name, b_desc, unique_prods, unique_skus, disp_u, deliv_u, deliv_v, deliv_cg,
        profit, margin_p / 100.0, vol_share, rev_share, deliv_r
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_sum.cell(row=cur_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [3, 4, 5, 6, 7, 8, 9]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [10, 11, 12, 13]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row += 1

ws_sum.row_dimensions[cur_row].height = 20
tot_brand_vals = [
    "TOTAL BRAND PORTFOLIO", "All DEEN In-House + Curated Labels",
    len(set(it['Base Product Name'] for it in item_rows)), len(set(it['SKU'] for it in item_rows)),
    total_disp_units, total_deliv_units, total_deliv_val, total_deliv_cogs,
    total_realized_gross_profit, overall_gross_margin / 100.0, 1.0, 1.0, overall_deliv_rate_units / 100.0
]
for c_idx, val in enumerate(tot_brand_vals, 1):
    cell = ws_sum.cell(row=cur_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 2]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [3, 4, 5, 6, 7, 8, 9]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [10, 11, 12, 13]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'

# Summary Column Widths
sum_col_widths = {
    'A': 28, 'B': 46, 'C': 16, 'D': 16, 'E': 16, 'F': 16,
    'G': 18, 'H': 18, 'I': 18, 'J': 18, 'K': 16, 'L': 16, 'M': 16, 'N': 16
}
for col_char, w in sum_col_widths.items():
    ws_sum.column_dimensions[col_char].width = w

ws_sum.freeze_panes = 'C8'

# Save E-Commerce Workbook
wb_ecom.save(ecom_out_path)
print(f"✅ Successfully recreated: {ecom_out_path}")
# =============================================================================
# PART 2: RECREATE POS WORKBOOK (October 2026 POS Outlet Sales Performance.xlsx)
# =============================================================================
print("\n--- Parsing Direct POS Walk-In Counter Sales with COGS Enrichment ---")

pos_orders = []
pos_item_rows = []
pos_prod_agg = {}
pos_sku_agg = {}

for o in raw_orders:
    o_id = str(o.get('id', ''))
    o_num = str(o.get('number', o_id))
    created_via = str(o.get('created_via', '')).strip().lower()
    status = str(o.get('status', '')).strip().lower()
    
    meta = o.get('meta_data', [])
    meta_dict = {str(m.get('key')): str(m.get('value', '')) for m in meta}
    
    outlet_id = meta_dict.get('_sip_outlet_id', '')
    created_by = meta_dict.get('_sip_created_by', '')
    pm = str(o.get('payment_method', '')).lower()
    pm_title = str(o.get('payment_method_title', '')).lower()
    
    # Exclude Pathao/courier consigned orders
    if o_id in pathao_order_ids or o_num in pathao_order_ids:
        continue
    if any(('consignment' in k.lower() or 'pathao' in k.lower() or 'tracking' in k.lower()) and v and v not in ['-', 'null'] for k, v in meta_dict.items()):
        continue
    # Exclude online checkouts and exchanges
    if created_via in ['checkout', 'store-api', 'sip_exchange']:
        continue
    if any(k in ['_sip_exchange_order', '_sip_exchange_of', '_sip_exchange_code'] for k in meta_dict) or o_num.lower().startswith('ret-'):
        continue
    if status == 'cancelled':
        continue
    # Exclude ecom payments (online pickup orders)
    if 'ecom' in pm or 'ecom' in pm_title:
        continue
        
    is_pos = (created_via == 'pos' or meta_dict.get('_sip_order_source') == 'pos' or bool(outlet_id) or bool(created_by))
    if not is_pos:
        continue
        
    if outlet_id == '2' or created_by in ['3', '1508'] or 'mirpur' in o_num.lower():
        outlet_name = 'Mirpur Outlet'
        clean_outlet_id = '2'
        cashier_label = 'Cashier 3 (Mirpur)'
    elif outlet_id == '7' or created_by == '35' or 'cumilla' in o_num.lower() or 'comilla' in o_num.lower():
        outlet_name = 'Cumilla Branch'
        clean_outlet_id = '7'
        cashier_label = 'Cashier 35 (Cumilla)'
    elif outlet_id == '8' or created_by == '69' or 'wari' in o_num.lower():
        outlet_name = 'Wari Branch'
        clean_outlet_id = '8'
        cashier_label = 'Cashier 69 (Wari)'
    elif outlet_id == '9' or created_by == '572' or 'sylhet' in o_num.lower():
        outlet_name = 'Sylhet Branch'
        clean_outlet_id = '9'
        cashier_label = 'Cashier 572 (Sylhet)'
    else:
        outlet_name = 'Mirpur Outlet'
        clean_outlet_id = '2'
        cashier_label = 'Cashier 3 (Mirpur)'

    billing = o.get('billing', {})
    shipping = o.get('shipping', {})
    cust_name = f"{billing.get('first_name', '')} {billing.get('last_name', '')}".strip()
    if not cust_name or cust_name.lower() in ['customer', 'walk-in', 'in-store']:
        cust_name = 'Walk-In Customer'
    phone = str(billing.get('phone', '') or shipping.get('phone', '')).strip()
    if not phone or phone in ['-', 'N/A', '0']:
        phone = 'Walk-In Register'

    order_date = str(o.get('date_created', ''))[:10]
    net_order_total = float(o.get('total', 0) or 0)
    
    cart_discount = 0.0
    for fee in o.get('fee_lines', []):
        if 'discount' in str(fee.get('name', '')).lower():
            cart_discount += abs(float(fee.get('total', 0) or 0))

    line_items = o.get('line_items', [])
    tot_order_units = sum(int(it.get('quantity', 1) or 1) for it in line_items)
    gross_order_val = sum(float(it.get('price', 0) or 0) * int(it.get('quantity', 1) or 1) for it in line_items)

    pos_orders.append({
        'order_id': o_id,
        'order_num': o_num,
        'order_date': order_date,
        'outlet_name': outlet_name,
        'outlet_id': clean_outlet_id,
        'cashier': cashier_label,
        'customer_name': cust_name,
        'phone': phone,
        'payment_method': pm_title or pm or 'Cash',
        'units': tot_order_units,
        'gross_value': gross_order_val,
        'discount': cart_discount,
        'net_total': net_order_total
    })

    for it in line_items:
        it_name = str(it.get('name', 'Product')).strip()
        sku = str(it.get('sku', 'GENERAL')).strip()
        qty = int(it.get('quantity', 1) or 1)
        price = float(it.get('price', 0) or 0)
        line_total = float(it.get('total', 0) or (price * qty))
        prod_id = it.get('product_id')
        var_id = it.get('variation_id')

        unit_cogs, cogs_src, is_exact = get_cogs_info(sku, price, prod_id, var_id)
        if is_exact and unit_cogs is not None:
            tot_cogs = unit_cogs * qty
            gross_profit = round(line_total - tot_cogs)
            margin_pct = (gross_profit / line_total * 100) if line_total > 0 else 0.0
            margin_str = f"{margin_pct:.1f}%"
            unit_cogs_disp = unit_cogs
            tot_cogs_disp = tot_cogs
            gross_profit_disp = gross_profit
        else:
            tot_cogs = None
            unit_cogs_disp = "didn'tget"
            tot_cogs_disp = "didn'tget"
            gross_profit_disp = "didn'tget"
            margin_str = "didn'tget" 

        base_name, size = extract_size_and_base(it_name)
        cat, subcat = extract_category_and_sub(it_name, sku)
        brand = classify_brand_name(it_name, sku)

        pos_item_rows.append({
            'Order Number': o_num,
            'Order ID': o_id,
            'Order Date': order_date,
            'Outlet Name': outlet_name,
            'Outlet POS ID': clean_outlet_id,
            'Cashier': cashier_label,
            'Customer Name': cust_name,
            'Customer Phone': phone,
            'Payment Method': pm_title or pm or 'Cash',
            'Brand Name': brand,
            'Category': cat,
            'Sub-Category': subcat,
            'Item Name': it_name,
            'Base Product Name': base_name,
            'SKU': sku,
            'Size': size,
            'Unit Price (৳)': round(price),
            'Quantity Sold': qty,
            'Line Total (৳)': round(line_total),
            'Unit COGS (৳)': unit_cogs_disp,
            'Total COGS (৳)': tot_cogs_disp,
            'Gross Profit (৳)': gross_profit_disp,
            'Gross Margin (%)': margin_str,
            'COGS Source': cogs_src,
            'Fulfillment Type': 'In-Store POS Walk-In',
            'Transaction Status': 'Completed (Counter Settlement)'
        })

        # Product Aggregation
        prod_key = base_name
        if prod_key not in pos_prod_agg:
            pos_prod_agg[prod_key] = {
                'Brand Name': brand,
                'Category': cat, 'Sub-Category': subcat, 'Product Name': base_name,
                'Base SKU': sku.split('-')[0] + '-' + sku.split('-')[1] if '-' in sku and len(sku.split('-')) > 1 else sku,
                'Sizes': set(), 'Unit Price (৳)': price, 'Unit COGS (৳)': unit_cogs,
                'Units Sold': 0, 'Gross Sales Value (৳)': 0.0, 'Total COGS (৳)': 0.0,
                'Cumilla Units': 0, 'Mirpur Units': 0, 'Wari Units': 0, 'Sylhet Units': 0,
            }
        p = pos_prod_agg[prod_key]
        p['Sizes'].add(size)
        p['Units Sold'] += qty
        p['Gross Sales Value (৳)'] += line_total
        if is_exact and tot_cogs is not None:
            p['Total COGS (৳)'] += tot_cogs
            p['Exact Sold Units'] = p.get('Exact Sold Units', 0) + qty
        if clean_outlet_id == '7': p['Cumilla Units'] += qty
        elif clean_outlet_id == '2': p['Mirpur Units'] += qty
        elif clean_outlet_id == '8': p['Wari Units'] += qty
        elif clean_outlet_id == '9': p['Sylhet Units'] += qty

        # SKU Aggregation
        sku_key = f"{sku}__{size}__{it_name}"
        if sku_key not in pos_sku_agg:
            pos_sku_agg[sku_key] = {
                'Brand Name': brand,
                'Category': cat, 'Sub-Category': subcat, 'Product Name': it_name,
                'SKU Code': sku, 'Size': size, 'Unit Price (৳)': price, 'Unit COGS (৳)': unit_cogs,
                'COGS Source': cogs_src,
                'Units Sold': 0, 'Gross Sales Value (৳)': 0.0, 'Total COGS (৳)': 0.0,
                'Cumilla Units': 0, 'Mirpur Units': 0, 'Wari Units': 0, 'Sylhet Units': 0,
            }
        s = pos_sku_agg[sku_key]
        s['Units Sold'] += qty
        s['Gross Sales Value (৳)'] += line_total
        s['is_exact'] = is_exact
        if is_exact and tot_cogs is not None:
            s['Total COGS (৳)'] += tot_cogs
            s['Exact Sold Units'] = s.get('Exact Sold Units', 0) + qty
        if clean_outlet_id == '7': s['Cumilla Units'] += qty
        elif clean_outlet_id == '2': s['Mirpur Units'] += qty
        elif clean_outlet_id == '8': s['Wari Units'] += qty
        elif clean_outlet_id == '9': s['Sylhet Units'] += qty

tot_pos_units = sum(p['units'] for p in pos_orders)
tot_pos_gross = sum(p['gross_value'] for p in pos_orders)
tot_pos_net = sum(p['net_total'] for p in pos_orders)
tot_pos_orders = len(pos_orders)
pos_aov = tot_pos_net / tot_pos_orders if tot_pos_orders else 0
pos_items_exact = [it for it in pos_item_rows if it.get('Total COGS (৳)') is not None and it['Total COGS (৳)'] != "didn'tget"]
tot_pos_cogs = sum(it['Total COGS (৳)'] for it in pos_items_exact)
tot_pos_profit = tot_pos_gross - tot_pos_cogs
pos_gross_margin = (tot_pos_profit / tot_pos_gross * 100) if tot_pos_gross > 0 else 0.0

def get_pos_tag(units, val):
    if units >= 25: return '🌟 Outlet Best Seller'
    if units >= 15: return '⚡ Volume Driver'
    if units >= 8: return '✅ Regular Performer'
    return '⚖️ Niche Contributor'

def get_top_outlet(c, m, w, s):
    outlets = [('Cumilla Branch', c), ('Mirpur Outlet', m), ('Wari Branch', w), ('Sylhet Branch', s)]
    outlets.sort(key=lambda x: -x[1])
    if outlets[0][1] == 0: return 'None'
    return outlets[0][0]

pos_prod_rows = []
for p in sorted(pos_prod_agg.values(), key=lambda x: -x['Gross Sales Value (৳)']):
    u = p['Units Sold']
    v = p['Gross Sales Value (৳)']
    u_share = (u / tot_pos_units * 100) if tot_pos_units else 0
    v_share = (v / tot_pos_gross * 100) if tot_pos_gross else 0
    avg_price = round(v / u) if u > 0 else p['Unit Price (৳)']
    
    has_full_exact = (p.get('Exact Sold Units', 0) == u) and (u > 0)
    if has_full_exact:
        avg_cogs = round(p['Total COGS (৳)'] / u)
        cg_disp = round(p['Total COGS (৳)'])
        profit = round(v - cg_disp)
        margin_pct = (profit / v * 100) if v > 0 else 0.0
        margin_str = f"{margin_pct:.1f}%"
    else:
        avg_cogs = "didn'tget"
        cg_disp = "didn'tget"
        profit = "didn'tget"
        margin_str = "didn'tget"

    pos_prod_rows.append({
        'Brand Name': p['Brand Name'],
        'Category': p['Category'],
        'Sub-Category': p['Sub-Category'],
        'Product Name': p['Product Name'],
        'Base SKU': p['Base SKU'],
        'Size Variations': len(p['Sizes']),
        'Unit Price (৳)': avg_price,
        'Unit COGS (৳)': avg_cogs,
        'Units Sold (POS)': u,
        'Gross Sales Value (৳)': round(v),
        'Total Sold COGS (৳)': cg_disp,
        'Realized Gross Profit (৳)': profit,
        'Gross Margin (%)': margin_str,
        'Cumilla Units Sold': p['Cumilla Units'],
        'Mirpur Units Sold': p['Mirpur Units'],
        'Wari Units Sold': p['Wari Units'],
        'Sylhet Units Sold': p['Sylhet Units'],
        'Units Share (%)': f"{u_share:.1f}%",
        'Value Share (%)': f"{v_share:.1f}%",
        'Top Outlet': get_top_outlet(p['Cumilla Units'], p['Mirpur Units'], p['Wari Units'], p['Sylhet Units']),
        'Performance Tag': get_pos_tag(u, v)
    })

pos_sku_rows = []
for s in sorted(pos_sku_agg.values(), key=lambda x: -x['Gross Sales Value (৳)']):
    u = s['Units Sold']
    v = s['Gross Sales Value (৳)']
    u_share = (u / tot_pos_units * 100) if tot_pos_units else 0
    v_share = (v / tot_pos_gross * 100) if tot_pos_gross else 0
    
    if s.get('is_exact') and s.get('Unit COGS (৳)') is not None and str(s.get('Unit COGS (৳)')).strip() != "didn'tget":
        unit_cg = round(float(s['Unit COGS (৳)']))
        cg_disp = round(s['Total COGS (৳)'])
        profit = round(v - cg_disp)
        margin_pct = (profit / v * 100) if v > 0 else 0.0
        margin_str = f"{margin_pct:.1f}%"
        cogs_src_val = 'Exact WooCommerce (REST API)'
    else:
        unit_cg = "didn'tget"
        cg_disp = "didn'tget"
        profit = "didn'tget"
        margin_str = "didn'tget"
        cogs_src_val = "didn'tget"

    pos_sku_rows.append({
        'Brand Name': s['Brand Name'],
        'Category': s['Category'],
        'Sub-Category': s['Sub-Category'],
        'Product Name': s['Product Name'],
        'SKU Code': s['SKU Code'],
        'Size': s['Size'],
        'Unit Price (৳)': round(s['Unit Price (৳)']),
        'Unit COGS (৳)': unit_cg,
        'Units Sold (POS)': u,
        'Gross Sales Value (৳)': round(v),
        'Total Sold COGS (৳)': cg_disp,
        'Realized Gross Profit (৳)': profit,
        'Gross Margin (%)': margin_str,
        'COGS Source': cogs_src_val,
        'Cumilla Units Sold': s['Cumilla Units'],
        'Mirpur Units Sold': s['Mirpur Units'],
        'Wari Units Sold': s['Wari Units'],
        'Sylhet Units Sold': s['Sylhet Units'],
        'Units Share (%)': f"{u_share:.1f}%",
        'Value Share (%)': f"{v_share:.1f}%",
        'Top Outlet': get_top_outlet(s['Cumilla Units'], s['Mirpur Units'], s['Wari Units'], s['Sylhet Units']),
        'Performance Tag': get_pos_tag(u, v)
    })

df_pos_items = pd.DataFrame(pos_item_rows)
df_pos_prod = pd.DataFrame(pos_prod_rows)
df_pos_sku = pd.DataFrame(pos_sku_rows)
df_pos_orders = pd.DataFrame(pos_orders)

print(f"Generated {len(df_pos_items)} POS item rows, {len(df_pos_prod)} products, {len(df_pos_sku)} SKUs.")

wb_pos = openpyxl.Workbook()
wb_pos.remove(wb_pos.active)

ws_pos_sum = wb_pos.create_sheet(title='Summary')

ws_pos_items = wb_pos.create_sheet(title='Item Wise Performance')
for col_idx, col_name in enumerate(df_pos_items.columns, 1):
    ws_pos_items.cell(row=1, column=col_idx, value=col_name)
for r_idx, row in enumerate(df_pos_items.itertuples(index=False), 2):
    for c_idx, val in enumerate(row, 1):
        ws_pos_items.cell(row=r_idx, column=c_idx, value=val)
format_standard_sheet(ws_pos_items, df_pos_items, freeze_cell="C2")

ws_pos_prod = wb_pos.create_sheet(title='Product Wise Performance')
for col_idx, col_name in enumerate(df_pos_prod.columns, 1):
    ws_pos_prod.cell(row=1, column=col_idx, value=col_name)
for r_idx, row in enumerate(df_pos_prod.itertuples(index=False), 2):
    for c_idx, val in enumerate(row, 1):
        ws_pos_prod.cell(row=r_idx, column=c_idx, value=val)
format_standard_sheet(ws_pos_prod, df_pos_prod, freeze_cell="B2")

ws_pos_sku = wb_pos.create_sheet(title='SKU Wise Performance')
for col_idx, col_name in enumerate(df_pos_sku.columns, 1):
    ws_pos_sku.cell(row=1, column=col_idx, value=col_name)
for r_idx, row in enumerate(df_pos_sku.itertuples(index=False), 2):
    for c_idx, val in enumerate(row, 1):
        ws_pos_sku.cell(row=r_idx, column=c_idx, value=val)
format_standard_sheet(ws_pos_sku, df_pos_sku, freeze_cell="B2")

# Build POS Executive Summary Sheet
print("Building Executive Summary Sheet for POS Outlets...")
ws_pos_sum.views.sheetView[0].showGridLines = True

ws_pos_sum.merge_cells('A1:L1')
ws_pos_sum['A1'] = "DEEN COMMERCE — OCTOBER 2026 POS OUTLET SALES PERFORMANCE"
ws_pos_sum['A1'].font = font_title
ws_pos_sum['A1'].alignment = Alignment(horizontal='left', vertical='center')

ws_pos_sum.merge_cells('A2:L2')
ws_pos_sum['A2'] = "Direct Retail Walk-In Counter Sales (Excluding Courier Deliveries) · Cumilla, Mirpur, Wari & Sylhet Outlets · Exact REST API COGS & Profit Margins"
ws_pos_sum['A2'].font = font_subtitle
ws_pos_sum['A2'].alignment = Alignment(horizontal='left', vertical='center')

ws_pos_sum.row_dimensions[1].height = 25
ws_pos_sum.row_dimensions[2].height = 18

pos_kpis = [
    {'col_start': 'A', 'col_end': 'B', 'label': 'TOTAL POS SALES VALUE', 'val': f"৳{tot_pos_gross:,.0f}", 'sub': f"৳{tot_pos_net:,.0f} Net Settled at Register"},
    {'col_start': 'C', 'col_end': 'D', 'label': 'TOTAL POS COGS (COST)', 'val': f"৳{tot_pos_cogs:,.0f}" if tot_pos_cogs > 0 else "didn'tget", 'sub': f"Exact REST API (known items: ৳{tot_pos_cogs:,.0f}; rest didn't get)"},
    {'col_start': 'E', 'col_end': 'F', 'label': 'REALIZED GROSS PROFIT', 'val': "didn'tget", 'sub': "Gross Profit: didn'tget (zero fallback)"},
    {'col_start': 'G', 'col_end': 'H', 'label': 'TOTAL UNITS SOLD', 'val': f"{tot_pos_units:,}", 'sub': 'Physical Retail Register Transactions'},
    {'col_start': 'I', 'col_end': 'J', 'label': 'TOTAL TRANSACTIONS', 'val': f"{tot_pos_orders:,}", 'sub': 'Distinct Completed Counter Receipts'},
    {'col_start': 'K', 'col_end': 'L', 'label': 'AVERAGE TICKET (AOV)', 'val': f"৳{pos_aov:,.2f}", 'sub': f"৳{(tot_pos_gross / tot_pos_units) if tot_pos_units else 0:,.2f} Avg Unit Price"},
]

for card in pos_kpis:
    cs, ce = card['col_start'], card['col_end']
    ws_pos_sum.merge_cells(f"{cs}4:{ce}4")
    ws_pos_sum.merge_cells(f"{cs}5:{ce}5")
    ws_pos_sum.merge_cells(f"{cs}6:{ce}6")
    
    ws_pos_sum[f"{cs}4"].value = card['label']
    ws_pos_sum[f"{cs}4"].font = card_label_font
    ws_pos_sum[f"{cs}4"].alignment = Alignment(horizontal='center', vertical='center')
    
    ws_pos_sum[f"{cs}5"].value = card['val']
    ws_pos_sum[f"{cs}5"].font = card_value_font
    ws_pos_sum[f"{cs}5"].alignment = Alignment(horizontal='center', vertical='center')
    
    ws_pos_sum[f"{cs}6"].value = card['sub']
    ws_pos_sum[f"{cs}6"].font = card_sub_font
    ws_pos_sum[f"{cs}6"].alignment = Alignment(horizontal='center', vertical='center')
    
    for col_char in [cs, ce]:
        col_idx = openpyxl.utils.column_index_from_string(col_char)
        for r in range(4, 7):
            cell = ws_pos_sum.cell(row=r, column=col_idx)
            cell.fill = kpi_fill
            cell.border = thin_border

ws_pos_sum.row_dimensions[4].height = 16
ws_pos_sum.row_dimensions[5].height = 24
ws_pos_sum.row_dimensions[6].height = 16

def write_pos_section_header(row, title, max_col='L'):
    ws_pos_sum.merge_cells(f"A{row}:{max_col}{row}")
    cell = ws_pos_sum[f"A{row}"]
    cell.value = title
    cell.font = section_hdr_font
    cell.fill = section_hdr_fill
    cell.alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws_pos_sum.row_dimensions[row].height = 22

# Section 1: Outlet-by-Outlet Breakdown
cur_row = 8
write_pos_section_header(cur_row, "1. OUTLET-BY-OUTLET PERFORMANCE, COGS & PROFIT MARGIN BREAKDOWN", "L")
cur_row += 1

outlet_cols = [
    'Outlet Name', 'Outlet POS ID', 'Primary Cashier & Terminal', 'Completed Orders', 'Order Share (%)',
    'Units Sold', 'Units Share (%)', 'Gross Sales Value (৳)', 'POS COGS (৳)', 'Realized Gross Profit (৳)',
    'Gross Margin (%)', 'Average Ticket (৳)'
]

ws_pos_sum.row_dimensions[cur_row].height = 20
for c_idx, c_name in enumerate(outlet_cols, 1):
    c = ws_pos_sum.cell(row=cur_row, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row += 1

outlet_configs = [
    ('Wari Branch', '8', 'Cashier 69 (Wari)'),
    ('Cumilla Branch', '7', 'Cashier 35 (Cumilla)'),
    ('Mirpur Outlet', '2', 'Cashier 3 (Mirpur)'),
    ('Sylhet Branch', '9', 'Cashier 572 (Sylhet)')
]

for out_name, out_id, cashier_str in sorted(outlet_configs, key=lambda x: -sum(o['gross_value'] for o in pos_orders if o['outlet_id'] == x[1])):
    m_orders = [o for o in pos_orders if o['outlet_id'] == out_id]
    m_items = [it for it in pos_item_rows if it['Outlet POS ID'] == out_id]
    cnt = len(m_orders)
    u = sum(o['units'] for o in m_orders)
    g_val = sum(o['gross_value'] for o in m_orders)
    m_items_exact = [it for it in m_items if it.get('Total COGS (৳)') is not None and it['Total COGS (৳)'] != "didn'tget"]
    if len(m_items_exact) == len(m_items) and len(m_items) > 0:
        cogs_val = sum(it['Total COGS (৳)'] for it in m_items_exact)
        profit = round(g_val - cogs_val)
        margin_p = (profit / g_val * 100) if g_val > 0 else 0.0
        cogs_disp = cogs_val
        profit_disp = profit
        margin_disp = margin_p / 100.0
    elif len(m_items_exact) > 0:
        cogs_disp = sum(it['Total COGS (৳)'] for it in m_items_exact)
        profit_disp = "didn'tget"
        margin_disp = "didn'tget"
    else:
        cogs_disp = "didn'tget"
        profit_disp = "didn'tget"
        margin_disp = "didn'tget"
    aov = (g_val / cnt) if cnt else 0
    
    ws_pos_sum.row_dimensions[cur_row].height = 18
    r_vals = [
        out_name, out_id, cashier_str, cnt, (cnt / tot_pos_orders) if tot_pos_orders else 0,
        u, (u / tot_pos_units) if tot_pos_units else 0, g_val, cogs_disp, profit_disp,
        margin_disp, aov
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_pos_sum.cell(row=cur_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2, 3]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [4, 6, 8, 9, 10, 12]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [5, 7, 11]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row += 1

# Total Outlet Row
ws_pos_sum.row_dimensions[cur_row].height = 20
tot_out_vals = [
    "TOTAL PHYSICAL RETAIL", "All 4 Outlets", "All Cashier Terminals",
    tot_pos_orders, 1.0, tot_pos_units, 1.0, tot_pos_gross, tot_pos_cogs, tot_pos_profit,
    pos_gross_margin / 100.0, pos_aov
]
for c_idx, val in enumerate(tot_out_vals, 1):
    cell = ws_pos_sum.cell(row=cur_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 2, 3]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [4, 6, 8, 9, 10, 12]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [5, 7, 11]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'
cur_row += 2

# Section 2: Category Breakdown
write_pos_section_header(cur_row, "2. PRODUCT CATEGORY SALES, COGS & PROFIT MARGINS", "J")
cur_row += 1

cat_cols = [
    'Apparel Category', 'Units Sold', 'Volume Share (%)', 'Gross Sales Value (৳)',
    'POS COGS (৳)', 'Realized Gross Profit (৳)', 'Gross Margin (%)', 'Average Unit Price (৳)', 'Top Selling Outlet'
]

ws_pos_sum.row_dimensions[cur_row].height = 20
for c_idx, c_name in enumerate(cat_cols, 1):
    c = ws_pos_sum.cell(row=cur_row, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row += 1

cat_groups = df_pos_items.groupby('Category')
cat_list = []
for cat_name, g in cat_groups:
    u = g['Quantity Sold'].sum()
    v = g['Line Total (৳)'].sum()
    valid_cogs = pd.to_numeric(g['Total COGS (৳)'], errors='coerce')
    if valid_cogs.notna().sum() == len(g) and len(g) > 0:
        cg = float(valid_cogs.sum())
        profit = round(v - cg)
        margin_p = (profit / v * 100) if v > 0 else 0.0
        cg_disp = cg
        profit_disp = profit
        margin_disp = margin_p / 100.0
    elif valid_cogs.notna().sum() > 0:
        cg_disp = float(valid_cogs.sum())
        profit_disp = "didn'tget"
        margin_disp = "didn'tget"
    else:
        cg_disp = "didn'tget"
        profit_disp = "didn'tget"
        margin_disp = "didn'tget"
    avg_p = v / u if u else 0
    
    top_out = g.groupby('Outlet Name')['Quantity Sold'].sum().idxmax()
    cat_list.append({
        'cat': cat_name, 'u': u, 'v': v, 'cg': cg_disp, 'profit': profit_disp,
        'margin_p': margin_disp, 'avg_p': avg_p, 'top_out': top_out
    })

cat_list = sorted(cat_list, key=lambda x: -x['v'])
for cd in cat_list:
    ws_pos_sum.row_dimensions[cur_row].height = 18
    r_vals = [
        cd['cat'], cd['u'], (cd['u'] / tot_pos_units) if tot_pos_units else 0,
        cd['v'], cd['cg'], cd['profit'], (cd['margin_p'] if isinstance(cd['margin_p'], str) else (cd['margin_p'] / 100.0)), cd['avg_p'], cd['top_out']
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_pos_sum.cell(row=cur_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 9]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [2, 4, 5, 6, 8]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx in [3, 7]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row += 1

ws_pos_sum.row_dimensions[cur_row].height = 20
tot_pos_cogs_disp = tot_pos_cogs if len(pos_items_exact) == len(pos_item_rows) else (f"{tot_pos_cogs:,.0f} (known only)" if tot_pos_cogs > 0 else "didn'tget")
tot_pos_profit_disp = tot_pos_profit if isinstance(tot_pos_profit, (int, float)) else "didn'tget"
pos_margin_disp = (pos_gross_margin / 100.0) if isinstance(pos_gross_margin, (int, float)) else "didn'tget"

tot_cat_vals = [
    "TOTAL ALL CATEGORIES", tot_pos_units, 1.0, tot_pos_gross, tot_pos_cogs_disp, tot_pos_profit_disp,
    pos_margin_disp, (tot_pos_gross / tot_pos_units) if tot_pos_units else 0, "All Outlets"
]
for c_idx, val in enumerate(tot_cat_vals, 1):
    cell = ws_pos_sum.cell(row=cur_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 9]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [2, 4, 5, 6, 8]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx in [3, 7]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'
cur_row += 2

# Section 3: Brand Performance
write_pos_section_header(cur_row, "3. BRAND PORTFOLIO & MARGIN PERFORMANCE", "J")
cur_row += 1

brand_cols = [
    'Brand Name', 'Portfolio Scope & Description', 'Unique Products', 'Active SKUs',
    'Units Sold', 'Gross Sales Value (৳)', 'POS COGS (৳)', 'Realized Gross Profit (৳)', 'Gross Margin (%)', 'Top Outlet'
]

ws_pos_sum.row_dimensions[cur_row].height = 20
for c_idx, c_name in enumerate(brand_cols, 1):
    c = ws_pos_sum.cell(row=cur_row, column=c_idx, value=c_name)
    c.font = tbl_hdr_font
    c.fill = tbl_hdr_fill
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
cur_row += 1

for b_name, b_desc in [('DEEN Select', 'Curated European & International Export Overrun Brands'), ('DEEN', 'In-House Core Engineered Apparel Lines')]:
    b_items = [it for it in pos_item_rows if it['Brand Name'] == b_name]
    u = sum(it['Quantity Sold'] for it in b_items)
    v = sum(it['Line Total (৳)'] for it in b_items)
    b_items_exact = [it for it in b_items if it.get('Total COGS (৳)') is not None and it['Total COGS (৳)'] != "didn'tget"]
    if len(b_items_exact) == len(b_items) and len(b_items) > 0:
        cg = sum(it['Total COGS (৳)'] for it in b_items_exact)
        profit = round(v - cg)
        margin_p = (profit / v * 100) if v > 0 else 0.0
        cg_disp = cg
        profit_disp = profit
        margin_disp = margin_p / 100.0
    elif len(b_items_exact) > 0:
        cg_disp = sum(it['Total COGS (৳)'] for it in b_items_exact)
        profit_disp = "didn'tget"
        margin_disp = "didn'tget"
    else:
        cg_disp = "didn'tget"
        profit_disp = "didn'tget"
        margin_disp = "didn'tget"
    u_prods = len(set(it['Base Product Name'] for it in b_items))
    u_skus = len(set(it['SKU'] for it in b_items))
    top_out = pd.DataFrame(b_items).groupby('Outlet Name')['Quantity Sold'].sum().idxmax() if b_items else 'None'

    ws_pos_sum.row_dimensions[cur_row].height = 18
    r_vals = [
        b_name, b_desc, u_prods, u_skus, u, v, cg_disp, profit_disp, margin_disp, top_out
    ]
    for c_idx, val in enumerate(r_vals, 1):
        cell = ws_pos_sum.cell(row=cur_row, column=c_idx, value=val)
        cell.font = regular_font
        cell.border = thin_border
        if c_idx in [1, 2, 10]:
            cell.alignment = Alignment(horizontal='left', vertical='center')
        elif c_idx in [3, 4, 5, 6, 7, 8]:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '#,##0'
        elif c_idx == 9:
            cell.alignment = Alignment(horizontal='right', vertical='center')
            cell.number_format = '0.0%'
    cur_row += 1

ws_pos_sum.row_dimensions[cur_row].height = 20
tot_brand_vals = [
    "TOTAL BRAND PORTFOLIO", "All DEEN In-House + Curated Outlets",
    len(set(it['Base Product Name'] for it in pos_item_rows)), len(set(it['SKU'] for it in pos_item_rows)),
    tot_pos_units, tot_pos_gross, tot_pos_cogs_disp, tot_pos_profit_disp, pos_margin_disp, "All Outlets"
]
for c_idx, val in enumerate(tot_brand_vals, 1):
    cell = ws_pos_sum.cell(row=cur_row, column=c_idx, value=val)
    cell.font = bold_font
    cell.fill = total_row_fill
    cell.border = total_border
    if c_idx in [1, 2, 10]:
        cell.alignment = Alignment(horizontal='left', vertical='center')
    elif c_idx in [3, 4, 5, 6, 7, 8]:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '#,##0'
    elif c_idx == 9:
        cell.alignment = Alignment(horizontal='right', vertical='center')
        cell.number_format = '0.0%'

# Summary Column widths
pos_sum_widths = {
    'A': 28, 'B': 42, 'C': 18, 'D': 18, 'E': 18, 'F': 18,
    'G': 18, 'H': 20, 'I': 20, 'J': 20, 'K': 18, 'L': 18
}
for col_letter, w in pos_sum_widths.items():
    ws_pos_sum.column_dimensions[col_letter].width = w

ws_pos_sum.freeze_panes = 'C8'

# Save POS Workbook
wb_pos.save(pos_out_path)
print(f"✅ Successfully recreated: {pos_out_path}")
print("\n🎉 ALL PERFORMANCE WORKBOOKS RECREATED WITH EXACT COGS AND MARGIN METRICS!")
