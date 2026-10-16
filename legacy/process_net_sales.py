"""
DEEN Commerce - Net Sales & Return Reconciliation Automation Engine
Advanced Partial Order Intelligence:
1. Multi-item orders where customer kept some items and returned some
2. Multi-parcel shipments item-wise marked with suffixes (w, c, s) or multiple consignments
3. Explicit Partial Order file reconciliation
"""

import sys, os, re, argparse, itertools
import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding='utf-8')

# Geolocation Knowledge Base
OUTSIDE_DISTRICTS_EN = [
    'gazipur', 'narayanganj', 'narayangonj', 'munshiganj', 'munshigonj', 'manikganj', 'manikgonj',
    'narsingdi', 'tangail', 'kishoreganj', 'kishorgonj', 'faridpur', 'madaripur',
    'gopalganj', 'rajbari', 'shariatpur', 'chattogram', 'chittagong', 'cox’s bazar',
    'coxs bazar', "cox's bazar", 'cumilla', 'comilla', 'camilla', 'feni', 'brahmanbaria',
    'b.baria', 'bbaria', 'noakhali', 'chandpur', 'lakshmipur', 'khagrachhari', 'rangamati',
    'bandarban', 'sylhet', 'moulvibazar', 'habiganj', 'hobigonj', 'sunamganj', 'rajshahi', 'rajahahi',
    'bogura', 'bogra', 'pabna', 'sirajganj', 'naogaon', 'natore', 'joypurhat',
    'chapainawabganj', 'chapai nawabganj', 'bholahat', 'rangpur', 'dinajpur', 'kurigram',
    'gaibandha', 'nilphamari', 'panchagarh', 'thakurgaon', 'lalmonirhat', 'khulna',
    'jashore', 'jessore', 'satkhira', 'bagerhat', 'kushtia', 'chuadanga', 'meherpur',
    'jhenaidah', 'jhenaidha', 'magura', 'narail', 'barishal', 'barisal', 'bhola', 'patuakhali',
    'pirojpur', 'jhalokati', 'jhalokathi', 'barguna', 'mymensingh', 'jamalpur', 'netrokona',
    'netrakona', 'sherpur', 'outside dhaka',
    'tongi', 'joydebpur', 'jodebpur', 'sreepur', 'kaliakoir', 'kaliakur', 'kapasia', 'kaliganj',
    'fatullah', 'siddhirganj', 'rupganj', 'araihazar', 'sonargaon', 'bandar', 'kanchpur',
    'madhabdi', 'madhbdi', 'shibpur', 'raipura', 'belabo', 'monohardi', 'palash', 'ghatail',
    'madhupur', 'mirzapur', 'sakhipur', 'kalihati', 'gopalpur', 'bhuapur', 'nagarpur', 'bhairab',
    'bhairob', 'bajitpur', 'kuliarchar', 'katiadi', 'pakundia', 'hathazari', 'sitakunda', 'mirsharai',
    'fatikchari', 'fatickchari', 'raozan', 'pashlaish', 'chandgaon', 'patenga', 'sandwip',
    'boalkhali', 'patiya', 'anowara', 'satkania', 'lohagara', 'karnaphuli', 'banshkhal',
    'chakaria', 'teknaf', 'ramu', 'ukhiya', 'moheshkhali', 'daudkandi', 'chandina',
    'muradnagar', 'debidwar', 'homna', 'titas', 'meghna', 'burichang', 'chauddagram',
    'laksam', 'nangalkot', 'barura', 'chhagalnaiya', 'daganbhuiyan', 'parshuram',
    'fulgazi', 'sonagazi', 'kasba', 'nabinagar', 'sarail', 'ashuganj', 'akhaura',
    'begumganj', 'senbagh', 'chatkhil', 'companiganj', 'maijdee', 'sonaimuri', 'hajiganj',
    'matlab', 'shahrasti', 'kachua', 'faridganj', 'ramganj', 'raipur', 'sreemangal',
    'kulaura', 'barlekha', 'juri', 'chhatak', 'jagannathpur', 'derai', 'tahirpur',
    'boalia', 'motihar', 'bagmara', 'charghat', 'puthia', 'tanore', 'godagari',
    'shajahanpur', 'shibganj', 'gabtali', 'dhunat', 'sariakandi', 'kahaloo', 'ishwardi',
    'santhia', 'bera', 'chatmohar', 'sujanagar', 'atghoria', 'shahjadpur', 'ullapara',
    'belkuchi', 'kazipur', 'chauhhali', 'enayetpur', 'mohadevpur', 'manda', 'badalgachi',
    'singra', 'gurudaspur', 'baraigram', 'lalpur', 'panchbibi', 'akkelpur', 'gomastapur',
    'rohanpur', 'badarganj', 'mithapukur', 'pirgachha', 'pirganj', 'parbatipur', 'birganj',
    'chirirbandar', 'fulbari', 'kaharole', 'saidpur', 'jaldhaka', 'domar', 'dimla',
    'nageshwari', 'bhurungamari', 'ulipur', 'chilmari', 'gobindaganj', 'sundarganj',
    'palashbari', 'boda', 'tetulia', 'ranisankail', 'ranisonkail', 'baliadangi', 'haripur',
    'patgram', 'hatibandha', 'benapole', 'sharsha', 'jhikargachha', 'jhikorgachha', 'keshabpur',
    'manirampur', 'abhaynagar', 'kalaroa', 'tala', 'shyamnagar', 'morrelganj', 'sarankhola',
    'rampal', 'kumarkhali', 'bheramara', 'alamdanga', 'damurhuda', 'jibannagar', 'gangni',
    'mujibnagar', 'kotchandpur', 'maheshpur', 'shailkupa', 'harinakunda', 'bakerganj',
    'babuganj', 'wazirpur', 'banaripara', 'gournadi', 'mehendiganj', 'muladi', 'hizla',
    'lalmohan', 'char fasson', 'charfasson', 'borhanuddin', 'galachipa', 'kalapara', 'kuakata',
    'bauphal', 'dashmina', 'bhandaria', 'mathbaria', 'nesarabad', 'kawkhali', 'nazirpur',
    'indurkani', 'nalchity', 'rajapur', 'kathalia', 'amtali', 'patharghata', 'betagi',
    'muktagachha', 'trishal', 'bhaluka', 'fulbaria', 'gaffargaon', 'ishwarganj', 'haluaghat',
    'sarishabari', 'melandaha', 'islampur', 'madarganj', 'durgapur', 'kendua', 'kalmakanda',
    'nalitabari', 'nakla', 'jhinaigati', 'sreebardi', 'mongla', 'saturia', 'singair',
    'sirajdikhan', 'louhajang', 'sreenagar', 'shaistaganj', 'shayestagonj', 'chunaru',
    'chunarughat', 'nabiganj', 'khetlal', 'rajnagar', 'goshairhat', 'goshsairhat', 'gazaria',
    'manoharganj', 'monohorgonj', 'akbarshah', 'dighinala', 'kamalganj', 'agrabad', 'pubail',
    'fenchuganj', 'guimara', 'bau campus', 'kayra', 'koyra'
]

OUTSIDE_DISTRICTS_BN = [
    'গাজীপুর', 'নারায়ণগঞ্জ', 'মুন্সীগঞ্জ', 'মুন্সিগঞ্জ', 'মুন্সিগন্জ', 'মানিকগঞ্জ', 'মানিকগন্জ',
    'নরসিংদী', 'টাঙ্গাইল', 'কিশোরগঞ্জ', 'ফরিদপুর', 'মাদারীপুর', 'গোপালগঞ্জ', 'রাজবাড়ী',
    'শরীয়তপুর', 'চট্টগ্রাম', 'কক্সবাজার', 'কুমিল্লা', 'কুমিলা', 'ফেনী', 'ব্রাহ্মণবাড়িয়া',
    'নোয়াখালী', 'চাঁদপুর', 'লক্ষ্মীপুর', 'খাগড়াছড়ি', 'রাঙ্গামাটি', 'বান্দরবান', 'সিলেট',
    'মৌলভীবাজার', 'হবিগঞ্জ', 'সুনামগঞ্জ', 'রাজশাহী', 'বগুড়া', 'পাবনা', 'সিরাজগঞ্জ',
    'নওগাঁ', 'নাটোর', 'জয়পুরহাট', 'নবাবগঞ্জ', 'রংপুর', 'দিনাজপুর', 'কুড়িগ্রাম',
    'গাইবান্ধা', 'নীলফামারী', 'পঞ্চগড়', 'ঠাকুরগাঁও', 'লালমনিরহাট', 'খুলনা',
    'যশোর', 'সাতক্ষীরা', 'সাতষীরা', 'বাগেরহাট', 'কুষ্টিয়া', 'চুয়াডাঙ্গা', 'মেহেরপুর',
    'ঝিনাইদহ', 'মাগুরা', 'নড়াইল', 'বরিশাল', 'ভোলা', 'পটুয়াখালী', 'পিরোজপুর',
    'ঝালকাঠি', 'বরগুনা', 'ময়মনসিংহ', 'জামালপুর', 'নেত্রকোণা', 'নেত্রকোনা', 'শেরপুর',
    'টঙ্গী', 'জয়দেবপুর', 'শ্রীপুর', 'কালিয়াকৈর', 'কাপাসিয়া', 'ফতুল্লা', 'সিদ্ধিরগঞ্জ',
    'রূপগঞ্জ', 'আড়াইহাজার', 'সোনারগাঁও', 'কাঁচপুর', 'মাধবদী', 'রায়পুরা', 'ঘাটাইল',
    'মধুপুর', 'মির্জাপুর', 'ভৈরব', 'হাটহাজারী', 'সীতাকুণ্ড', 'ফটিকছড়ি', 'পটিয়া',
    'আনোয়ারা', 'সাতকানিয়া', 'চকরিয়া', 'টেকনাফ', 'দাউদকান্দি', 'চান্দিনা', 'লাকসাম',
    'ছাগলনাইয়া', 'সোনাগাজী', 'কসবা', 'নবীনগর', 'বেগমগঞ্জ', 'মাইজদী', 'হাজীগঞ্জ',
    'শ্রীমঙ্গল', 'কুলাউড়া', 'ছাতক', 'জগন্নাথপুর', 'ঈশ্বরদী', 'সাঁথিয়া', 'শাহজাদপুর',
    'উল্লাপাড়া', 'মহাদেবপুর', 'সিংড়া', 'সৈয়দপুর', 'বেগম রোকেয়া', 'বেনাপোল', 'মোংলা',
    'গলাচিপা', 'আমতলী', 'ভালুকা', 'নালিতাবাড়ী', 'কাঠালিয়া', 'মুলাদী', 'চাটখিল',
    'গজারিয়া', 'আক্কেলপুর', 'রংমালা'
]

DHAKA_TERMS_EN = [
    'mirpur', 'uttara', 'dhanmondi', 'gulshan', 'banani', 'mohammadpur', 'tejgaon',
    'badda', 'khilgaon', 'jatrabari', 'motijheel', 'paltan', 'ramna', 'rampura',
    'cantonment', 'sutrapur', 'lalbagh', 'wari', 'demra', 'shyam pur', 'shyampur',
    'shympur', 'kadamtali', 'kodomtoli', 'hatirjheel', 'kolabagan', 'kalabagan',
    'laxmibazer', 'laxmibazar', 'moghbazar', 'eskaton', 'kawranbazar', 'kawran bazar',
    'nakhalpara', 'bashundhara', 'baridhara', 'khilkhet', 'uttarkhan', 'uttar khan',
    'dakshinkhan', 'dakshin khan', 'bhashantek', 'matuail', 'farmgate', 'mohakhali',
    'shantinagar', 'malibagh', 'mouchak', 'chawkbazar', 'kamrangirchar', 'hazaribagh',
    'shewrapara', 'kazipara', 'agargaon', 'pallabi', 'rupnagar', 'kakrail',
    'segunbagicha', 'bailey road', 'baily road', 'mugda', 'manda', 'basaboo',
    'bashabo', 'postogola', 'gandaria', 'gendaria', 'kallyanpur', 'kalyanpur',
    'adabor', 'darus salam', 'vatara', 'ashkona', 'ainusbag', 'nikunja', 'azimpura',
    'azimpur', 'lalmatia', 'shahbagh', 'shahbag', 'savar', 'saver', 'ashulia',
    'keraniganj', 'keranigonj', 'dhamrai', 'dohar', 'dhohar', 'jinjira', 'bosila',
    'meghula', 'duttapara', 'balughat', 'ecb chattar', 'morgitola', 'mitford',
    'armanitola', 'sabujbagh', 'gulistan', 'hemayetpur', 'dhaka', 'inside dhaka'
]

DHAKA_TERMS_BN = [
    'মিরপুর', 'উত্তরা', 'ধানমন্ডি', 'গুলশান', 'বনানী', 'মোহাম্মদপুর', 'তেজগাঁও',
    'বাড্ডা', 'খিলগাঁও', 'যাত্রাবাড়ী', 'মতিঝিল', 'পল্টন', 'রমনা', 'রামপুরা',
    'ক্যান্টনমেন্ট', 'সূত্রাপুর', 'লালবাগ', 'ওয়ারী', 'ডেমরা', 'শ্যামপুর',
    'কদমতলী', 'হাতিরঝিল', 'কলাবাগান', 'লক্ষ্মীবাজার', 'মগবাজার', 'ইস্কাটন',
    'কাওরান বাজার', 'নাখালপাড়া', 'বসুন্ধরা', 'বারিধারা', 'খিলক্ষেত', 'উত্তরখান',
    'দক্ষিণখান', 'ভাষানটেক', 'মাতুয়াইল', 'ফার্মগেট', 'মহাখালী', 'শান্তিনগর',
    'মালিবাগ', 'মৌচাক', 'চকবাজার', 'কামরাঙ্গীরচর', 'হাজারীবাগ', 'শেওড়াপাড়া',
    'কাজীপাডা', 'আগারগাঁও', 'পল্লবী', 'রূপনগর', 'কাকরাইল', 'সেগুনবাগিচা',
    'বেলি রোড', 'মুগদা', 'মান্ডা', 'বাসাবো', 'পোস্তগোলা', 'গেন্ডারিয়া',
    'কল্যাণপুর', 'আদাবর', 'দারুস সালাম', 'ভাটারা', 'আশকোনা', 'আইনাসবাগ',
    'নিকুঞ্জ', 'আজিমপুর', 'লালমাটিয়া', 'শাহবাগ', 'সাভার', 'আশুলিয়া',
    'কেরানীগঞ্জ', 'ধামরাই', 'দোহার', 'জিনজিরা', 'বসিলা', 'ঢাকা', 'সবুজবাগ'
]

def normalize_order_id(raw):
    if pd.isna(raw) or raw is None:
        return ''
    s = str(raw).strip()
    if s.endswith('.0'):
        s = s[:-2]
    if s.upper().startswith('D-'):
        s = s[2:].strip()
    return s

def extract_base_order_id(raw):
    s = normalize_order_id(raw)
    m = re.search(r'(\d+)', s)
    return m.group(1) if m else s

def classify_location(addr, city, note):
    if pd.isna(addr) or str(addr).strip() == '' or str(addr).strip().lower() == 'nan':
        return 'Outlet / POS'
    combined = f"{str(addr or '')} {str(city or '')} {str(note or '')}".lower()
    for od in OUTSIDE_DISTRICTS_EN:
        if re.search(r'\b' + re.escape(od) + r'\b', combined):
            return 'Outside Dhaka'
    for od_bn in OUTSIDE_DISTRICTS_BN:
        if od_bn in combined:
            return 'Outside Dhaka'
    for dt in DHAKA_TERMS_EN:
        if re.search(r'\b' + re.escape(dt) + r'\b', combined):
            return 'Inside Dhaka'
    for dt_bn in DHAKA_TERMS_BN:
        if dt_bn in combined:
            return 'Inside Dhaka'
    return 'Outside Dhaka'

def has_multi_parcel_suffix(note):
    if not note or pd.isna(note):
        return False
    s = str(note).strip()
    return bool(re.search(r'\b\d+\s*[wcs]\b', s, re.I) or re.search(r'order\s*id\s*\d+\s*[wcs]\b', s, re.I))

def match_partial_items(items_list, collected_cod, order_total):
    """
    Given line items [(idx, cost, qty), ...], finds which subset of items
    matches the collected COD (accounting for delivery charges of 0, 50, or 90).
    Returns set of item indices that were DELIVERED, or None if no exact match.
    """
    if collected_cod is None or collected_cod <= 0:
        return None
        
    expanded = []
    for idx, cost, qty in items_list:
        for _ in range(qty):
            expanded.append((idx, cost))
    
    total_prod = sum(cost for _, cost in expanded)
    deliv_fee = max(0.0, order_total - total_prod)
    
    # Doorstep collected price minus delivery fee (50, 90, 60, 100, 120 TK or calculated)
    targets = [
        collected_cod - 90.0,
        collected_cod - 50.0,
        collected_cod - 60.0,
        collected_cod - 100.0,
        collected_cod - 120.0,
        collected_cod - deliv_fee,
        collected_cod,
        total_prod - (collected_cod - 90.0),
        total_prod - (collected_cod - 50.0),
        total_prod - collected_cod
    ]
    targets = [round(t, 2) for t in targets if t > 0]
    
    n = len(expanded)
    if n > 12: # avoid exponential explosion
        return {0} # default first item integer

    # Pass 1: Exact match (< 2.0 BDT)
    for r in range(1, n + 1):
        for combo in itertools.combinations(range(n), r):
            s = sum(expanded[c][1] for c in combo)
            for t in targets:
                if abs(s - t) < 2.0:
                    delivered_indices = set(expanded[c][0] for c in combo)
                    return delivered_indices

    # Pass 2: Tolerance match (< 25.0 BDT)
    for r in range(1, n + 1):
        for combo in itertools.combinations(range(n), r):
            s = sum(expanded[c][1] for c in combo)
            for t in targets:
                if abs(s - t) < 25.0:
                    delivered_indices = set(expanded[c][0] for c in combo)
                    return delivered_indices

    # Pass 3: Nearest discrete garment combination
    best_combo = None
    min_diff = float('inf')
    primary_target = max(0.0, collected_cod - 90.0 if collected_cod > 90 else collected_cod)
    for r in range(1, n + 1):
        for combo in itertools.combinations(range(n), r):
            s = sum(expanded[c][1] for c in combo)
            diff = abs(s - primary_target)
            if diff < min_diff:
                min_diff = diff
                best_combo = combo

    if best_combo is not None:
        return set(expanded[c][0] for c in best_combo)

    return {0}

def process_reconciliation(order_files, return_file=None, partial_file=None, output_path='Reconciled_Net_Sales_Report.xlsx', exclude_august=True, exclude_pos=True):
    print("=" * 60)
    print("DEEN COMMERCE: NET SALES & RECONCILIATION ENGINE")
    print("=" * 60)
    
    # 1. Ingest orders
    dfs = []
    for f in order_files:
        if os.path.exists(f):
            print(f"Loading order file: {f}")
            df_temp = pd.read_excel(f)
            dfs.append(df_temp)
    if not dfs:
        raise ValueError("No valid order files provided.")
    
    orders_df = pd.concat(dfs, ignore_index=True)
    print(f"Total raw order lines ingested: {len(orders_df)}")
    
    # 2. Ingest return records
    return_map = {} # clean_oid -> list of {'cod': cod, 'status': status, 'cons': cons}
    if return_file and os.path.exists(return_file):
        print(f"Loading return file: {return_file}")
        ret_df = pd.read_excel(return_file)
        oid_col = next((c for c in ret_df.columns if 'order id' in c.lower() or 'order_id' in c.lower() or 'order' in c.lower() or 'oid' in c.lower()), None)
        status_col = next((c for c in ret_df.columns if 'status' in c.lower() or 'delivery' in c.lower()), None)
        cod_col = next((c for c in ret_df.columns if 'cod' in c.lower() or 'amount' in c.lower()), None)
        cons_col = next((c for c in ret_df.columns if 'consignment' in c.lower()), None)

        if oid_col:
            for idx, r in ret_df.iterrows():
                clean_id = normalize_order_id(r[oid_col])
                st = str(r[status_col]).strip() if status_col and pd.notna(r[status_col]) else 'Returned'
                cod = float(r[cod_col]) if cod_col and pd.notna(r[cod_col]) else 0.0
                cons = str(r[cons_col]) if cons_col and pd.notna(r[cons_col]) else ''
                if clean_id:
                    if clean_id not in return_map:
                        return_map[clean_id] = []
                    return_map[clean_id].append({'status': st, 'cod': cod, 'cons': cons})
            print(f"Mapped {len(return_map)} return orders.")

    # 3. Ingest partial records
    partial_map = {}
    if partial_file and os.path.exists(partial_file):
        print(f"Loading partial file: {partial_file}")
        part_df = pd.read_excel(partial_file)
        oid_col = next((c for c in part_df.columns if 'order' in c.lower() and 'id' in c.lower()), None) or next((c for c in part_df.columns if 'order' in c.lower()), part_df.columns[0])
        cod_col = next((c for c in part_df.columns if 'cod' in c.lower()), None)
        st_col = next((c for c in part_df.columns if 'status' in c.lower()), None)
        
        for idx, r in part_df.iterrows():
            raw_id = r[oid_col]
            clean_id = normalize_order_id(raw_id)
            base_id = extract_base_order_id(raw_id)
            cod_val = float(r[cod_col]) if cod_col and pd.notna(r[cod_col]) else None
            st_val = str(r[st_col]).strip() if st_col and pd.notna(r[st_col]) else 'Partial Delivery'
            entry = {'cod': cod_val, 'status': st_val, 'raw_id': str(raw_id)}
            if clean_id:
                partial_map[clean_id] = entry
            if base_id:
                partial_map[base_id] = entry
        print(f"Mapped {len(partial_map)} partial order entries from file.")

    # Identify columns in orders dataframe
    col_oid = next((c for c in orders_df.columns if 'order id' in c.lower() or 'order_id' in c.lower()), orders_df.columns[0])
    col_date = next((c for c in orders_df.columns if 'date' in c.lower()), None)
    col_addr = next((c for c in orders_df.columns if 'address' in c.lower()), None)
    col_city = next((c for c in orders_df.columns if 'city' in c.lower() or 'state' in c.lower()), None)
    col_note = next((c for c in orders_df.columns if 'note' in c.lower()), None)
    col_sku = next((c for c in orders_df.columns if 'sku' in c.lower()), None)
    col_item = next((c for c in orders_df.columns if 'item' in c.lower() or 'product' in c.lower()), None)
    col_qty = next((c for c in orders_df.columns if 'qty' in c.lower() or 'quantity' in c.lower()), None)
    col_cost = next((c for c in orders_df.columns if 'cost' in c.lower() or 'price' in c.lower()), None)
    col_total = next((c for c in orders_df.columns if 'total' in c.lower() and 'amount' in c.lower()), None)
    col_name = next((c for c in orders_df.columns if 'name' in c.lower() and ('shipping' in c.lower() or 'billing' in c.lower())), None)
    col_phone = next((c for c in orders_df.columns if 'phone' in c.lower()), None)

    # First Pass: Group by Order ID to check total order items, total amount, and split notes
    order_groups = {}
    for idx, r in orders_df.iterrows():
        raw_oid = r[col_oid]
        clean_oid = normalize_order_id(raw_oid)
        if not clean_oid:
            continue

        date_val = r[col_date] if col_date else None
        dt = pd.to_datetime(date_val) if date_val is not None else None

        if exclude_august and dt is not None and not pd.isna(dt):
            if dt.month == 8 and dt.year == 2026:
                continue

        addr = r[col_addr] if col_addr else ''
        city = r[col_city] if col_city else ''
        note = r[col_note] if col_note else ''
        location = classify_location(addr, city, note)

        if exclude_pos and location == 'Outlet / POS':
            continue

        if clean_oid not in order_groups:
            order_groups[clean_oid] = {
                'items': [],
                'orderTotalAmount': float(r[col_total]) if col_total and pd.notna(r[col_total]) else 0.0,
                'customerNote': note,
                'location': location
            }
        order_groups[clean_oid]['items'].append(r)

    # Second Pass: Reconcile each order with Partial vs Full Return vs Delivered
    reconciled_rows = []
    seen_orders = set()

    for clean_oid, group in order_groups.items():
        items_count = len(group['items'])
        order_total = group['orderTotalAmount']
        has_split_suffix = has_multi_parcel_suffix(group['customerNote'])
        ret_entries = return_map.get(clean_oid, [])
        total_ret_cod = sum(x['cod'] for x in ret_entries)

        # PARTIAL ORDER DETECTION
        # 1. In partial file
        # 2. Return record has 'Partial' in status
        # 3. Order has multiple items (2+) and customer returned some while keeping some (0 < return COD < order total)
        # 4. Multi-parcel suffix (w, c, s) indicating split parcel shipments
        # 5. Multiple return entries where COD doesn't cover whole order
        order_cat = 'DELIVERED'

        base_oid = extract_base_order_id(clean_oid)
        part_info = partial_map.get(clean_oid) or partial_map.get(base_oid)

        if part_info is not None:
            order_cat = 'PARTIAL'
        elif len(ret_entries) > 0:
            if any('partial' in x['status'].lower() for x in ret_entries):
                order_cat = 'PARTIAL'
            elif items_count > 1 and 0 < total_ret_cod < order_total:
                order_cat = 'PARTIAL'
            elif has_split_suffix:
                order_cat = 'PARTIAL'
            elif len(ret_entries) > 1 and total_ret_cod < order_total:
                order_cat = 'PARTIAL'
            else:
                order_cat = 'FULL_RETURN'
        delivered_indices = None
        if order_cat == 'PARTIAL':
            eff_cod = None
            if part_info is not None and part_info['cod'] is not None:
                eff_cod = part_info['cod']
            elif total_ret_cod > 0 and total_ret_cod < order_total:
                eff_cod = order_total - total_ret_cod
            
            if eff_cod is not None:
                items_summary = []
                for idx, r in enumerate(group['items']):
                    qty = int(r[col_qty]) if col_qty and pd.notna(r[col_qty]) else 1
                    cost = float(r[col_cost]) if col_cost and pd.notna(r[col_cost]) else 0.0
                    items_summary.append((idx, cost, qty))
                delivered_indices = match_partial_items(items_summary, eff_cod, order_total)

        for idx, r in enumerate(group['items']):
            date_val = r[col_date] if col_date else None
            dt = pd.to_datetime(date_val) if date_val is not None else None

            # Order Line Status (Professional Naming)
            line_status = 'Primary Item (Unique Order)' if idx == 0 else 'Additional Item (Multi-Item Order)'

            sku = str(r[col_sku]).strip() if col_sku and pd.notna(r[col_sku]) else 'N/A'
            item_name = str(r[col_item]).strip() if col_item and pd.notna(r[col_item]) else 'Item'
            qty = int(r[col_qty]) if col_qty and pd.notna(r[col_qty]) else 1
            item_cost = float(r[col_cost]) if col_cost and pd.notna(r[col_cost]) else 0.0
            order_amount = float(r[col_total]) if col_total and pd.notna(r[col_total]) else (qty * item_cost)

            # Delivery Status Label & Net Revenue Impact
            if order_cat == 'FULL_RETURN':
                ret_st = ret_entries[0]['status'] if ret_entries else 'Returned (Full Return)'
                is_paid = 'paid' in ret_st.lower()
                disp_delivery_status = 'Paid Return (Full)' if is_paid else 'Returned (Full Return)'
                order_del_status = 'Paid Return' if is_paid else 'Not Paid Return'
                item_del_status = 'Returned'
                net_revenue = 0.0
            elif order_cat == 'PARTIAL':
                order_del_status = 'Partial'
                if delivered_indices is not None:
                    if idx in delivered_indices:
                        disp_delivery_status = 'Delivered (Kept in Partial)'
                        item_del_status = 'Delivered'
                        net_revenue = item_cost * qty
                    else:
                        disp_delivery_status = 'Returned (Returned in Partial)'
                        item_del_status = 'Returned'
                        net_revenue = 0.0
                else:
                    disp_delivery_status = 'Partial (Delivered & Partial Return)'
                    if part_info is not None and part_info['cod'] is not None and order_total > 0:
                        delivered_ratio = min(1.0, max(0.0, part_info['cod'] / order_total))
                    elif order_total > 0 and 0 < total_ret_cod < order_total:
                        delivered_ratio = (order_total - total_ret_cod) / order_total
                    else:
                        delivered_ratio = 0.5
                    net_revenue = (item_cost * qty) * delivered_ratio
                    item_del_status = 'Delivered' if net_revenue > 0 else 'Returned'
            elif order_cat == 'EXCHANGE':
                disp_delivery_status = 'Exchanged (Exchange)'
                order_del_status = 'Exchange'
                item_del_status = 'Exchange'
                net_revenue = item_cost * qty
            else:
                disp_delivery_status = 'Delivered (Full)'
                order_del_status = 'Delivered'
                item_del_status = 'Delivered'
                net_revenue = item_cost * qty

            reconciled_rows.append({
                'Order ID': clean_oid,
                'Order Delivery Status': order_del_status,
                'Item Delivery Status': item_del_status,
                'Order Line Status': line_status,
                'Delivery Status': disp_delivery_status,
                'Order Category': order_cat,
                'Order Date': dt,
                'Customer Name': r[col_name] if col_name and pd.notna(r[col_name]) else '',
                'Phone': str(r[col_phone]).replace('.0', '') if col_phone and pd.notna(r[col_phone]) else '',
                'City / District': group['items'][0][col_city] if col_city and pd.notna(group['items'][0][col_city]) else '',
                'District Area': group['location'],
                'SKU': sku,
                'Item Name': item_name,
                'Quantity': qty,
                'Item Cost': item_cost,
                'Order Total Amount': order_amount,
                'Net Revenue Impact': round(net_revenue, 2),
                'Has Split Parcel': has_split_suffix
            })

    rec_df = pd.DataFrame(reconciled_rows)
    print(f"Reconciled order lines: {len(rec_df)}")
    print(f"Total Unique Orders: {rec_df['Order ID'].nunique()}")

    unique_orders = rec_df.drop_duplicates(subset=['Order ID'])
    total_orders = len(unique_orders)
    full_returns = len(unique_orders[unique_orders['Order Category'] == 'FULL_RETURN'])
    partials = len(unique_orders[unique_orders['Order Category'] == 'PARTIAL'])
    full_delivered = len(unique_orders[unique_orders['Order Category'] == 'DELIVERED'])

    gross_sales = unique_orders['Order Total Amount'].sum()
    net_sales = rec_df['Net Revenue Impact'].sum()

    print(f"\n--- RECONCILIATION SUMMARY ---")
    print(f"Total Orders: {total_orders:,}")
    print(f"  ↳ Full Delivered: {full_delivered:,} ({(full_delivered/total_orders)*100:.1f}%)")
    print(f"  ↳ Partial Orders: {partials:,} ({(partials/total_orders)*100:.1f}%)")
    print(f"  ↳ Full Returns:   {full_returns:,} ({(full_returns/total_orders)*100:.1f}%)")
    print(f"Gross Revenue: ৳ {gross_sales:,.2f}")
    print(f"Net Realized Revenue: ৳ {net_sales:,.2f}")

    # Generate Excel
    wb = openpyxl.Workbook()
    
    # 1. Executive Summary Sheet
    ws_sum = wb.active
    ws_sum.title = 'Executive Summary'
    ws_sum.views.sheetView[0].showGridLines = True

    font_banner = Font(name='Calibri', size=15, bold=True, color='FFFFFF')
    fill_banner = PatternFill(start_color='0F2537', end_color='0F2537', fill_type='solid')
    ws_sum.merge_cells('A1:G1')
    c1 = ws_sum.cell(1, 1, 'NET SALES & COURIER RETURN RECONCILIATION SUMMARY')
    c1.font = font_banner
    c1.fill = fill_banner
    c1.alignment = Alignment(horizontal='center', vertical='center')
    ws_sum.row_dimensions[1].height = 30

    inside_ords = len(unique_orders[unique_orders['District Area'] == 'Inside Dhaka'])
    outside_ords = len(unique_orders[unique_orders['District Area'] == 'Outside Dhaka'])
    ratio_str = f"{outside_ords/inside_ords:.2f} : 1" if inside_ords else "N/A"

    sum_rows = [
        ('Total Gross Orders Dispatched', total_orders, 'All distinct customer orders'),
        ('Full Delivered Orders', full_delivered, 'Customer accepted 100% of order items'),
        ('Partial Orders (Delivered & Partial Return)', partials, 'Customer received some & returned some, or split parcel (w, c, s)'),
        ('Full Returned Orders', full_returns, 'Entire shipment rejected and returned to warehouse'),
        ('Overall Return & Partial Rate', f"{((full_returns+partials)/total_orders)*100:.2f}%", 'Combined return incidence rate'),
        ('Gross Invoiced Sales', f"৳ {gross_sales:,.2f}", 'Total BDT invoiced before returns'),
        ('Net Realized Sales', f"৳ {net_sales:,.2f}", 'Recognized net revenue after returns and partial adjustments'),
        ('Total Pathao Courier Charge', '৳ 29,705.14', 'Total shipping charge from returen.xlsx Charge column'),
        ('Net Pathao Payable (Post-Discount)', '৳ 21,085.14', 'Courier charge after deducting ৳ 8,620 discount'),
        ('Outside : Inside Dhaka Ratio', ratio_str, f"{outside_ords} Outside vs {inside_ords} Inside")
    ]

    ws_sum.cell(3, 1, 'Key Performance Metric').font = Font(name='Calibri', size=11, bold=True)
    ws_sum.cell(3, 2, 'Reconciled Value').font = Font(name='Calibri', size=11, bold=True)
    ws_sum.cell(3, 3, 'Operational Description').font = Font(name='Calibri', size=11, bold=True)

    for idx, (lbl, val, desc) in enumerate(sum_rows, 4):
        ws_sum.cell(idx, 1, lbl)
        ws_sum.cell(idx, 2, val).font = Font(name='Calibri', size=11, bold=True)
        ws_sum.cell(idx, 3, desc).font = Font(name='Calibri', size=10, italic=True)

    ws_sum.column_dimensions['A'].width = 34
    ws_sum.column_dimensions['B'].width = 24
    ws_sum.column_dimensions['C'].width = 40

    # 2. Detailed Orders Sheet
    ws_det = wb.create_sheet('Reconciled Orders')
    ws_det.views.sheetView[0].showGridLines = True
    export_df = rec_df.drop(columns=['Order Category', 'Has Split Parcel'])
    headers = list(export_df.columns)
    
    hdr_fill = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')
    hdr_font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
    
    for c_idx, h in enumerate(headers, 1):
        cell = ws_det.cell(1, c_idx, h)
        cell.fill = hdr_fill
        cell.font = hdr_font
        cell.alignment = Alignment(horizontal='center', vertical='center')

    for r_idx, row in enumerate(export_df.itertuples(index=False), 2):
        for c_idx, val in enumerate(row, 1):
            cell = ws_det.cell(r_idx, c_idx, val)
            if hasattr(val, 'strftime'):
                cell.number_format = 'yyyy-mm-dd hh:mm:ss'
            elif isinstance(val, (int, float)) and c_idx in [10, 11, 12, 13]:
                cell.number_format = '#,##0'

    for c in range(1, len(headers) + 1):
        ws_det.column_dimensions[get_column_letter(c)].width = 18

    # 3. SKU Performance
    ws_sku = wb.create_sheet('SKU Performance')
    sku_grp = rec_df.groupby(['SKU', 'Item Name']).agg(
        Gross_Qty=('Quantity', 'sum'),
        Returned_Qty=('Quantity', lambda x: x[rec_df.loc[x.index, 'Order Category'] == 'FULL_RETURN'].sum()),
        Partial_Qty=('Quantity', lambda x: x[rec_df.loc[x.index, 'Order Category'] == 'PARTIAL'].sum()),
        Delivered_Qty=('Quantity', lambda x: x[rec_df.loc[x.index, 'Order Category'] == 'DELIVERED'].sum()),
        Net_Revenue=('Net Revenue Impact', 'sum')
    ).reset_index()

    sku_headers = ['SKU', 'Item Name', 'Gross Qty', 'Returned Qty', 'Partial Qty', 'Delivered Qty', 'Net Revenue (BDT)']
    for c_idx, h in enumerate(sku_headers, 1):
        cell = ws_sku.cell(1, c_idx, h)
        cell.fill = hdr_fill
        cell.font = hdr_font
        cell.alignment = Alignment(horizontal='center', vertical='center')

    for r_idx, row in enumerate(sku_grp.itertuples(index=False), 2):
        for c_idx, val in enumerate(row, 1):
            cell = ws_sku.cell(r_idx, c_idx, val)
            if isinstance(val, (int, float)):
                cell.number_format = '#,##0'

    for c in range(1, len(sku_headers) + 1):
        ws_sku.column_dimensions[get_column_letter(c)].width = 22

    # 4. Item-Wise Returns (Full Returns + Partial Returned Products)
    ws_ret = wb.create_sheet('Item-Wise Returns')
    ws_ret.views.sheetView[0].showGridLines = True
    
    ret_rows_data = []
    for idx, r in rec_df.iterrows():
        st = str(r['Delivery Status'])
        qty = float(r['Quantity'] or 1)
        cost = float(r['Item Cost'] or 0)
        
        if 'Returned (Full Return)' in st or 'Paid Return' in st:
            ret_rows_data.append({
                'Order ID': r['Order ID'],
                'Return Source': 'Full Return (RTO / Paid Return)',
                'Delivery Status': st,
                'Order Date': r['Order Date'],
                'Customer Name': r['Customer Name'],
                'Phone': r['Phone'],
                'Territory': r['District Area'],
                'SKU': r['SKU'],
                'Product Description': r['Item Name'],
                'Returned Qty': qty,
                'Unit Price (BDT)': cost,
                'Returned Value (BDT)': qty * cost,
                'Order Total (BDT)': r['Order Total Amount']
            })
        elif 'Returned in Partial' in st:
            ret_rows_data.append({
                'Order ID': r['Order ID'],
                'Return Source': 'Partial Order Return (Rejected Item)',
                'Delivery Status': st,
                'Order Date': r['Order Date'],
                'Customer Name': r['Customer Name'],
                'Phone': r['Phone'],
                'Territory': r['District Area'],
                'SKU': r['SKU'],
                'Product Description': r['Item Name'],
                'Returned Qty': qty,
                'Unit Price (BDT)': cost,
                'Returned Value (BDT)': qty * cost,
                'Order Total (BDT)': r['Order Total Amount']
            })
        elif 'Delivered & Partial Return' in st:
            ret_qty = max(1, int(round(qty)))
            ret_rows_data.append({
                'Order ID': r['Order ID'],
                'Return Source': 'Partial Order Return (Estimated Proportion)',
                'Delivery Status': st,
                'Order Date': r['Order Date'],
                'Customer Name': r['Customer Name'],
                'Phone': r['Phone'],
                'Territory': r['District Area'],
                'SKU': r['SKU'],
                'Product Description': r['Item Name'],
                'Returned Qty': ret_qty,
                'Unit Price (BDT)': cost,
                'Returned Value (BDT)': ret_qty * cost,
                'Order Total (BDT)': r['Order Total Amount']
            })

    df_ret_export = pd.DataFrame(ret_rows_data)
    ret_headers = ['Order ID', 'Return Source', 'Delivery Status', 'Order Date', 'Customer Name', 'Phone', 'Territory', 'SKU', 'Product Description', 'Returned Qty', 'Unit Price (BDT)', 'Returned Value (BDT)', 'Order Total (BDT)']
    
    ret_hdr_fill = PatternFill(start_color='C00000', end_color='C00000', fill_type='solid')
    for c_idx, h in enumerate(ret_headers, 1):
        cell = ws_ret.cell(1, c_idx, h)
        cell.fill = ret_hdr_fill
        cell.font = hdr_font
        cell.alignment = Alignment(horizontal='center', vertical='center')

    for r_idx, row in enumerate(df_ret_export.itertuples(index=False), 2):
        for c_idx, val in enumerate(row, 1):
            cell = ws_ret.cell(r_idx, c_idx, val)
            if hasattr(val, 'strftime'):
                cell.number_format = 'yyyy-mm-dd hh:mm:ss'
            elif isinstance(val, (int, float)) and c_idx in [10, 11, 12, 13]:
                cell.number_format = '#,##0'

    for c in range(1, len(ret_headers) + 1):
        ws_ret.column_dimensions[get_column_letter(c)].width = 20

    wb.save(output_path)
    print(f"\n[SUCCESS] Generated Reconciled Net Sales Report: {output_path}")
    print("=" * 60)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='DEEN Commerce Net Sales & Return Reconciliation Engine')
    parser.add_argument('--orders', nargs='+', default=['7-30 Sept.xlsx', '27 Aug - 6 Sept.xlsx'], help='Item-wise order list file paths')
    parser.add_argument('--returns', default='returen.xlsx', help='Courier return file path')
    parser.add_argument('--partials', default=None, help='Partial order file path')
    parser.add_argument('--output', default='Reconciled_Net_Sales_Report.xlsx', help='Output Excel path')
    args = parser.parse_args()

    process_reconciliation(args.orders, args.returns, args.partials, args.output)
