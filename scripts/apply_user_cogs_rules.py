"""
Apply User-Specified COGS Rules:
- All Aluminum Water Bottle COGS = 195 TK
- All Mask COGS = 120 TK
- All Card Holder COGS = 280 TK

Updates:
1. src/data/wc-sku-cogs.json
2. Sample Docs/DEEN_All_SKUs_Exact_COGS_Catalog.xlsx
"""

import json
import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

JSON_PATH = 'src/data/wc-sku-cogs.json'
EXCEL_PATH = 'Sample Docs/DEEN_All_SKUs_Exact_COGS_Catalog.xlsx'

def get_rule_cogs(name, sku):
    n = (name or '').lower()
    s = (sku or '').lower()
    if 'water bottle' in n or ('bottle' in n and 'sweatshirt' not in n and 'hoodie' not in n) or s.startswith('109-0501-'):
        return 195, 'Aluminum Water Bottle (Fixed 195 BDT)'
    if 'mask' in n or 'face mask' in n or s.startswith('109-0502-'):
        return 120, 'Breathable Face Mask (Fixed 120 BDT)'
    if 'card holder' in n or 'cardholder' in n or s.startswith('109-0104-'):
        return 280, 'Leather Card Holder (Fixed 280 BDT)'
    return None, None

def update_json():
    print(f"Loading {JSON_PATH}...")
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    by_sku = data.get('bySku', {})
    by_id = data.get('byId', {})

    updated_ids = 0
    updated_skus = 0

    for k, item in by_id.items():
        cogs, src = get_rule_cogs(item.get('productName'), item.get('sku'))
        if cogs is not None:
            item['cogs'] = cogs
            item['hasExactCogs'] = True
            item['cogsSource'] = src
            reg_price = item.get('regularPrice') or 0
            if reg_price > 0:
                item['grossMarginPercent'] = round(((reg_price - cogs) / reg_price) * 100, 1)
            updated_ids += 1
            
            # Also ensure it exists in bySku
            sku = item.get('sku')
            if sku and sku != 'None' and sku != '':
                by_sku[sku] = dict(item)
                updated_skus += 1

    # Check any by_sku directly
    for sku, item in list(by_sku.items()):
        cogs, src = get_rule_cogs(item.get('productName'), sku)
        if cogs is not None:
            item['cogs'] = cogs
            item['hasExactCogs'] = True
            item['cogsSource'] = src
            reg_price = item.get('regularPrice') or 0
            if reg_price > 0:
                item['grossMarginPercent'] = round(((reg_price - cogs) / reg_price) * 100, 1)

    data['bySku'] = by_sku
    data['byId'] = by_id
    data['totalSkusWithCogs'] = len(by_sku)

    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"JSON Updated: {updated_ids} byId entries updated, {len(by_sku)} total SKUs in bySku.")

if __name__ == '__main__':
    update_json()
