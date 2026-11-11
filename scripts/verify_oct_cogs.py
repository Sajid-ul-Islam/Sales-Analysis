import openpyxl

wb = openpyxl.load_workbook('public/Sample Docs/October 2026 Overall Sales & Channel Performance (Ecom & 4 Outlets).xlsx', data_only=True)
ws = wb['Master Transaction Ledger']
rows = list(ws.iter_rows(values_only=True))
header = rows[0]
cogs_idx = header.index('Unit COGS (৳)')
name_idx = header.index('Item Name')
sku_idx = header.index('SKU')
missing = []
exact = []

for r in rows[1:]:
    val = r[cogs_idx]
    if val == "didn'tget":
        missing.append((r[sku_idx], r[name_idx]))
    else:
        exact.append((r[sku_idx], val))

print(f"Total Transactions in Ledger: {len(rows)-1}")
print(f"Exact COGS Transactions: {len(exact)} ({len(exact)/(len(rows)-1)*100:.2f}%)")
print(f"Missing (didn'tget) Transactions: {len(missing)} ({len(missing)/(len(rows)-1)*100:.2f}%)")
if missing:
    print("Sample missing items:")
    for m in missing[:5]:
        print(" ", m)
