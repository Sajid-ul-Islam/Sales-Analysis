import json
import openpyxl

POS_XLSX = 'Sample Docs/October 2026 POS Outlet Sales Performance.xlsx'
OUT_JSON = 'src/data/pos-outlet-baseline.json'

def main():
    print(f"Loading POS performance workbook: {POS_XLSX}...")
    wb = openpyxl.load_workbook(POS_XLSX, data_only=True)
    ws = wb['Item Wise Performance']
    rows = list(ws.iter_rows(values_only=True))
    headers = rows[0]

    idx_oid = headers.index('Order Number')
    idx_date = headers.index('Order Date')
    idx_outlet = headers.index('Outlet Name')
    idx_outid = headers.index('Outlet POS ID')
    idx_pay = headers.index('Payment Method')
    idx_brand = headers.index('Brand Name')
    idx_cat = headers.index('Category')
    idx_sub = headers.index('Sub-Category')
    idx_name = headers.index('Item Name')
    idx_sku = headers.index('SKU')
    idx_price = headers.index('Unit Price (৳)')
    idx_qty = headers.index('Quantity Sold')
    idx_total = headers.index('Line Total (৳)')
    idx_ucogs = headers.index('Unit COGS (৳)')
    idx_tcogs = headers.index('Total COGS (৳)')
    idx_profit = headers.index('Gross Profit (৳)')
    idx_src = headers.index('COGS Source')

    items = []
    exact_cnt = 0
    missing_cnt = 0

    for r in rows[1:]:
        if not r[idx_oid]:
            continue
        uc = r[idx_ucogs]
        tc = r[idx_tcogs]
        gp = r[idx_profit]
        src = str(r[idx_src] or '')

        is_exact = isinstance(uc, (int, float)) and uc > 0
        if is_exact:
            exact_cnt += 1
        else:
            missing_cnt += 1

        items.append({
            'orderNumber': str(r[idx_oid]),
            'orderDate': str(r[idx_date] or ''),
            'outletName': str(r[idx_outlet] or ''),
            'outletId': str(r[idx_outid] or ''),
            'paymentMethod': str(r[idx_pay] or 'cash'),
            'brand': str(r[idx_brand] or 'DEEN Regular'),
            'category': str(r[idx_cat] or 'General Apparel'),
            'subCategory': str(r[idx_sub] or 'General Apparel'),
            'itemName': str(r[idx_name] or ''),
            'sku': str(r[idx_sku] or ''),
            'unitPrice': float(r[idx_price] or 0),
            'quantity': int(r[idx_qty] or 1),
            'lineTotal': float(r[idx_total] or 0),
            'unitCogs': float(uc) if is_exact else None,
            'totalCogs': float(tc) if isinstance(tc, (int, float)) else None,
            'profit': float(gp) if isinstance(gp, (int, float)) else None,
            'cogsSource': src if is_exact else "didn'tget",
        })

    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(items, f, indent=2, ensure_ascii=False)

    print(f"Updated {OUT_JSON} with {len(items)} POS line items.")
    print(f"  Exact COGS items: {exact_cnt} ({exact_cnt/len(items)*100:.1f}%)")
    print(f"  Missing ('didn'tget'): {missing_cnt}")

if __name__ == '__main__':
    main()
