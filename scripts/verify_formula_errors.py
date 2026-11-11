import openpyxl

target = 'public/Sample Docs/October 2026 Overall Sales & Channel Performance (Ecom & 4 Outlets).xlsx'
wb = openpyxl.load_workbook(target, data_only=True)

errors_found = []
for name in wb.sheetnames:
    ws = wb[name]
    for r in range(1, ws.max_row + 1):
        for c in range(1, ws.max_column + 1):
            val = str(ws.cell(r, c).value or '')
            if any(err in val for err in ['#VALUE!', '#REF!', '#DIV/0!', '#NAME?', '#N/A']):
                errors_found.append((name, ws.cell(r, c).coordinate, val))

print(f"Sheet count: {len(wb.sheetnames)}")
print(f"Formula errors found: {len(errors_found)}")
for e in errors_found:
    print(" ", e)

if len(errors_found) == 0:
    print("✅ ZERO FORMULA ERRORS across all sheets!")
