import os
import requests
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv('.env.local')

url = os.environ.get('WOOCOMMERCE_STORE_URL', 'https://deencommerce.com').rstrip('/')
ck = os.environ.get('WOOCOMMERCE_CONSUMER_KEY')
cs = os.environ.get('WOOCOMMERCE_CONSUMER_SECRET')
auth = (ck, cs)

print(f"Connecting to WooCommerce: {url}")

# Step 1: Fetch all products
all_products = []
page = 1
while True:
    try:
        res = requests.get(
            f"{url}/wp-json/wc/v3/products",
            auth=auth,
            params={"per_page": 100, "page": page, "_fields": "id,name,type,sku,price,regular_price,meta_data"},
            timeout=30
        )
        if not res.ok:
            print(f"Products page {page} error: {res.status_code}")
            break
        items = res.json()
        if not items:
            break
        all_products.extend(items)
        print(f"Fetched page {page}: {len(items)} products (total so far: {len(all_products)})")
        if len(items) < 100:
            break
        page += 1
    except Exception as e:
        print(f"Error fetching page {page}: {e}")
        break

print(f"\nTotal products fetched: {len(all_products)}")

by_sku = {}
by_id = {}
all_skus_seen = {} # sku -> {cogs: float | None, name, price, ...}

variable_products = []

for p in all_products:
    p_id = p.get('id')
    p_name = p.get('name')
    p_type = p.get('type')
    p_sku = (p.get('sku') or '').strip()
    p_price = p.get('price') or p.get('regular_price') or 0
    try:
        p_price_float = float(p_price)
    except:
        p_price_float = 0.0

    if p_type == 'variable':
        variable_products.append(p)
    else:
        # Simple product
        meta = p.get('meta_data', [])
        cogs = None
        for m in meta:
            k = m.get('key')
            v = m.get('value')
            if k == '_sip_buying_price' and v is not None and str(v).strip():
                try:
                    val = float(str(v).strip())
                    if val > 0:
                        cogs = val
                except:
                    pass
            elif k in ['_cogs', '_cost', 'wc_cog_cost', '_alg_wc_cog_cost'] and v is not None and str(v).strip():
                try:
                    val = float(str(v).strip())
                    if val > 0 and cogs is None:
                        cogs = val
                except:
                    pass

        entry = {
            'sku': p_sku or f"PROD-{p_id}",
            'productId': p_id,
            'productName': p_name,
            'cogs': round(cogs) if cogs else None,
            'regularPrice': round(p_price_float),
            'hasExactCogs': cogs is not None and cogs > 0
        }
        if p_sku:
            all_skus_seen[p_sku] = entry
            if cogs and cogs > 0:
                by_sku[p_sku] = entry
        by_id[str(p_id)] = entry

print(f"Processed {len(all_products) - len(variable_products)} simple products.")
print(f"Now fetching variations for {len(variable_products)} variable products...")

def fetch_prod_variations(prod):
    p_id = prod.get('id')
    p_name = prod.get('name')
    p_sku_parent = (prod.get('sku') or '').strip()
    p_meta = prod.get('meta_data', [])
    parent_cogs = None
    for m in p_meta:
        if m.get('key') == '_sip_buying_price' and m.get('value'):
            try:
                val = float(str(m.get('value')).strip())
                if val > 0:
                    parent_cogs = val
            except:
                pass

    vars_found = []
    v_page = 1
    while True:
        try:
            res = requests.get(
                f"{url}/wp-json/wc/v3/products/{p_id}/variations",
                auth=auth,
                params={"per_page": 100, "page": v_page, "_fields": "id,sku,price,regular_price,attributes,meta_data"},
                timeout=30
            )
            if not res.ok:
                break
            v_items = res.json()
            if not v_items:
                break
            vars_found.extend(v_items)
            if len(v_items) < 100:
                break
            v_page += 1
        except:
            break

    results = []
    for v in vars_found:
        v_id = v.get('id')
        v_sku = (v.get('sku') or p_sku_parent or '').strip()
        v_price = v.get('price') or v.get('regular_price') or prod.get('price') or 0
        try:
            v_price_float = float(v_price)
        except:
            v_price_float = 0.0

        v_meta = v.get('meta_data', [])
        v_cogs = None
        for m in v_meta:
            k = m.get('key')
            val = m.get('value')
            if k == '_sip_buying_price' and val is not None and str(val).strip():
                try:
                    c_val = float(str(val).strip())
                    if c_val > 0:
                        v_cogs = c_val
                except:
                    pass
            elif k in ['_cogs', '_cost', 'wc_cog_cost', '_alg_wc_cog_cost'] and val is not None and str(val).strip():
                try:
                    c_val = float(str(val).strip())
                    if c_val > 0 and v_cogs is None:
                        v_cogs = c_val
                except:
                    pass

        # If variation has no cogs, check if parent had cogs
        if v_cogs is None and parent_cogs is not None and parent_cogs > 0:
            v_cogs = parent_cogs

        attr_text = " ".join([a.get('option', '') for a in v.get('attributes', []) if a.get('option')])
        item_title = f"{p_name} - {attr_text}".strip() if attr_text else p_name

        rec = {
            'sku': v_sku or f"VAR-{v_id}",
            'productId': p_id,
            'variationId': v_id,
            'productName': item_title,
            'cogs': round(v_cogs) if v_cogs else None,
            'regularPrice': round(v_price_float),
            'hasExactCogs': v_cogs is not None and v_cogs > 0
        }
        results.append(rec)

    return p_id, results

# Fetch with thread pool
completed_count = 0
total_vars = 0
with ThreadPoolExecutor(max_workers=10) as executor:
    futures = {executor.submit(fetch_prod_variations, p): p for p in variable_products}
    for fut in as_completed(futures):
        p_id, v_results = fut.result()
        completed_count += 1
        total_vars += len(v_results)
        for r in v_results:
            sku = r['sku']
            v_id = r['variationId']
            if sku:
                all_skus_seen[sku] = r
                if r['hasExactCogs']:
                    by_sku[sku] = r
            if r['hasExactCogs']:
                by_id[f"{p_id}:{v_id}"] = r
                by_id[str(v_id)] = r
            by_id[f"ALL_{p_id}:{v_id}"] = r

        if completed_count % 30 == 0 or completed_count == len(variable_products):
            print(f"Progress: {completed_count}/{len(variable_products)} variable products fetched ({total_vars} variations). Exact COGS found so far: {len(by_sku)}")

print(f"\n==========================================")
print(f"FETCH COMPLETE!")
print(f"Total products scanned: {len(all_products)}")
print(f"Total variations scanned: {total_vars}")
print(f"Total distinct SKUs seen: {len(all_skus_seen)}")
print(f"SKUs with EXACT WooCommerce COGS: {len(by_sku)}")
print(f"SKUs WITHOUT COGS (marked \"didn'tget\"): {len(all_skus_seen) - len(by_sku)}")
print(f"==========================================")

# Save to src/data/wc-sku-cogs.json
output_data = {
    'fetchedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'totalProducts': len(all_products),
    'totalVariations': total_vars,
    'totalSkusSeen': len(all_skus_seen),
    'totalSkusWithCogs': len(by_sku),
    'bySku': by_sku,
    'byId': by_id,
    'allSkusSeen': all_skus_seen
}

os.makedirs('src/data', exist_ok=True)
with open('src/data/wc-sku-cogs.json', 'w', encoding='utf-8') as f:
    json.dump(output_data, f, indent=2, ensure_ascii=False)

print("Saved updated live COGS map to src/data/wc-sku-cogs.json!")
