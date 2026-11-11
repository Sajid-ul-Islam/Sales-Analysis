"""
Syncs the updated public/Sample Docs/*.xlsx files into Sample Docs/
Run this script or close Excel to allow overwriting the locked files.
"""

import os
import shutil

FILES = [
    'DEEN_All_SKUs_Exact_COGS_Catalog.xlsx',
    'October 2026 Overall Sales & Channel Performance (Ecom & 4 Outlets).xlsx',
    'October 2026 Item, Product & SKU Performance.xlsx',
    'October 2026 POS Outlet Sales Performance.xlsx'
]

def sync():
    for f in FILES:
        src = os.path.join('public', 'Sample Docs', f)
        dst = os.path.join('Sample Docs', f)
        if os.path.exists(src):
            try:
                shutil.copyfile(src, dst)
                print(f"✅ Successfully copied {src} -> {dst}")
            except PermissionError:
                print(f"⚠️ Cannot overwrite {dst} because it is currently open in Excel.")

if __name__ == '__main__':
    sync()
