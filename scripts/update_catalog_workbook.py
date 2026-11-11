import os
import openpyxl
from copy import copy

CATALOG_PATH = 'Sample Docs/DEEN_All_SKUs_Exact_COGS_Catalog.xlsx'

def get_rule_cogs(name, sku):
    n = (name or '').lower()
    s = (sku or '').lower()
    if 'water bottle' in n or ('bottle' in n and 'sweatshirt' not in n and 'hoodie' not in n) or s.startswith('109-0501-'):
        return 195, 'Management Specified (Aluminum Water Bottle 195 BDT)'
    if 'mask' in n or 'face mask' in n or s.startswith('109-0502-'):
        return 120, 'Management Specified (Breathable Face Mask 120 BDT)'
    if 'card holder' in n or 'cardholder' in n or s.startswith('109-0104-'):
        return 280, 'Management Specified (Leather Card Holder 280 BDT)'
    return None, None

def update_catalog():
    print(f"Loading {CATALOG_PATH}...")
    wb = openpyxl.load_workbook(CATALOG_PATH)

    # 1. Update All Catalog Items
    ws_all = wb['All Catalog Items']
    all_updated = 0
    for r in range(9, ws_all.max_row + 1):
        sku = str(ws_all.cell(r, 5).value or '')
        title = str(ws_all.cell(r, 6).value or '')
        reg_price = ws_all.cell(r, 10).value or 0
        cogs, src = get_rule_cogs(title, sku)
        if cogs is not None:
            ws_all.cell(r, 12, value=cogs)
            ws_all.cell(r, 16, value=src)
            try:
                rp = float(reg_price)
                gp = round(rp - cogs)
                gm = (rp - cogs) / rp if rp > 0 else 0.0
                ws_all.cell(r, 13, value=gp)
                ws_all.cell(r, 14, value=gm)
                ws_all.cell(r, 14).number_format = '0.0%'
            except:
                pass
            all_updated += 1

    print(f"All Catalog Items updated: {all_updated} rows")

    # Update summary banner in All Catalog Items
    # Row 5: Col 7 was 1,563 -> now 1,563 + 14 = 1,577
    exact_count = 1563 + all_updated
    pct = (exact_count / 1590) * 100
    ws_all.cell(5, 7, value=f"{exact_count:,}")
    ws_all.cell(6, 7, value=f"{pct:.1f}% Exact Cost Coverage")

    # 2. Update Distinct SKU Master
    ws_dist = wb['Distinct SKU Master']
    dist_updated = 0
    for r in range(5, ws_dist.max_row + 1):
        sku = str(ws_dist.cell(r, 2).value or '')
        title = str(ws_dist.cell(r, 3).value or '')
        reg_price = ws_dist.cell(r, 7).value or 0
        cogs, src = get_rule_cogs(title, sku)
        if cogs is not None:
            ws_dist.cell(r, 8, value=cogs)
            try:
                rp = float(reg_price)
                gp = round(rp - cogs)
                gm = (rp - cogs) / rp if rp > 0 else 0.0
                ws_dist.cell(r, 9, value=gp)
                ws_dist.cell(r, 10, value=gm)
                ws_dist.cell(r, 10).number_format = '0.0%'
            except:
                pass
            dist_updated += 1

    print(f"Distinct SKU Master updated: {dist_updated} rows")

    # 3. Rebuild Verified SKUs (With COGS) and Needs Cost Input (didn'tget)
    # Collect all items from Distinct SKU Master
    verified_items = []
    missing_items = []

    for r in range(5, ws_dist.max_row + 1):
        sku = ws_dist.cell(r, 2).value
        if not sku:
            continue
        title = ws_dist.cell(r, 3).value
        cat = ws_dist.cell(r, 4).value
        sub = ws_dist.cell(r, 5).value
        vars_cnt = ws_dist.cell(r, 6).value
        reg_p = ws_dist.cell(r, 7).value
        cogs = ws_dist.cell(r, 8).value
        gp = ws_dist.cell(r, 9).value
        gm = ws_dist.cell(r, 10).value

        item = {
            'sku': sku, 'title': title, 'cat': cat, 'sub': sub,
            'vars': vars_cnt, 'reg_p': reg_p, 'cogs': cogs, 'gp': gp, 'gm': gm
        }

        if cogs != "didn'tget" and cogs is not None:
            verified_items.append(item)
        else:
            missing_items.append(item)

    print(f"Verified SKUs count: {len(verified_items)}")
    print(f"Missing SKUs count: {len(missing_items)}")

    # Update Verified SKUs sheet
    ws_ver = wb['Verified SKUs (With COGS)']
    # clear existing data rows
    while ws_ver.max_row > 4:
        ws_ver.delete_rows(5)

    for i, it in enumerate(verified_items, start=1):
        row_idx = 4 + i
        ws_ver.cell(row_idx, 1, value=i)
        ws_ver.cell(row_idx, 2, value=it['sku'])
        ws_ver.cell(row_idx, 3, value=it['title'])
        ws_ver.cell(row_idx, 4, value=it['cat'])
        ws_ver.cell(row_idx, 5, value=it['sub'])
        ws_ver.cell(row_idx, 6, value=it['vars'])
        ws_ver.cell(row_idx, 7, value=it['reg_p'])
        ws_ver.cell(row_idx, 8, value=it['cogs'])
        ws_ver.cell(row_idx, 9, value=it['gp'])
        ws_ver.cell(row_idx, 10, value=it['gm'])
        if isinstance(it['gm'], (int, float)):
            ws_ver.cell(row_idx, 10).number_format = '0.0%'

    # Update Needs Cost Input sheet
    ws_miss = wb["Needs Cost Input (didn'tget)"]
    while ws_miss.max_row > 4:
        ws_miss.delete_rows(5)

    for i, it in enumerate(missing_items, start=1):
        row_idx = 4 + i
        ws_miss.cell(row_idx, 1, value=i)
        ws_miss.cell(row_idx, 2, value=it['sku'])
        ws_miss.cell(row_idx, 3, value=it['title'])
        ws_miss.cell(row_idx, 4, value=it['cat'])
        ws_miss.cell(row_idx, 5, value=it['sub'])
        ws_miss.cell(row_idx, 6, value=it['vars'])
        ws_miss.cell(row_idx, 7, value=it['reg_p'])
        ws_miss.cell(row_idx, 8, value="didn'tget")
        ws_miss.cell(row_idx, 9, value="")
        ws_miss.cell(row_idx, 10, value="")

    # Ensure grid lines enabled on all sheets
    for ws in wb.worksheets:
        ws.views.sheetView[0].showGridLines = True

    # Save to public first (always accessible for browser downloads)
    public_path = 'public/Sample Docs/DEEN_All_SKUs_Exact_COGS_Catalog.xlsx'
    os.makedirs('public/Sample Docs', exist_ok=True)
    wb.save(public_path)
    print(f"Catalog saved to public: {public_path}")

    # Try saving to Sample Docs
    try:
        wb.save(CATALOG_PATH)
        print(f"Catalog saved successfully: {CATALOG_PATH}")
    except PermissionError:
        backup_path = 'Sample Docs/DEEN_All_SKUs_Exact_COGS_Catalog_Updated.xlsx'
        wb.save(backup_path)
        print(f"Warning: {CATALOG_PATH} is locked by Excel. Saved to {backup_path} instead.")

if __name__ == '__main__':
    update_catalog()
