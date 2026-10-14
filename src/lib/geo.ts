import { LocationType } from '@/types';

export const GEO_DICT = {
  outside_en: [
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
  ],
  outside_bn: [
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
  ],
  dhaka_en: [
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
  ],
  dhaka_bn: [
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
};

/**
 * Intelligent geocoding and district classifier.
 * Categorizes an address string into 'Inside Dhaka', 'Outside Dhaka', or 'Outlet / POS'.
 */
export function classifyLocation(
  address?: string | null,
  city?: string | null,
  note?: string | null
): LocationType {
  if (!address || String(address).trim() === '' || String(address).trim().toLowerCase() === 'nan') {
    return 'Outlet / POS';
  }

  const combined = `${address || ''} ${city || ''} ${note || ''}`.toLowerCase();

  // 1. Check outside keywords (districts, upazilas)
  for (const term of GEO_DICT.outside_en) {
    const reg = new RegExp('\\b' + term + '\\b', 'i');
    if (reg.test(combined)) return 'Outside Dhaka';
  }
  for (const term of GEO_DICT.outside_bn) {
    if (combined.includes(term)) return 'Outside Dhaka';
  }

  // 2. Check inside Dhaka keywords (thana, locality)
  for (const term of GEO_DICT.dhaka_en) {
    const reg = new RegExp('\\b' + term + '\\b', 'i');
    if (reg.test(combined)) return 'Inside Dhaka';
  }
  for (const term of GEO_DICT.dhaka_bn) {
    if (combined.includes(term)) return 'Inside Dhaka';
  }

  // Default to Outside Dhaka if undetermined
  return 'Outside Dhaka';
}

import bangladeshDivisionsData from '@/data/bangladeshDivisions.json';
import { ReconciledOrderRow } from '@/types';

export type BangladeshDivision =
  | 'Dhaka'
  | 'Chattogram'
  | 'Rajshahi'
  | 'Khulna'
  | 'Barishal'
  | 'Sylhet'
  | 'Rangpur'
  | 'Mymensingh';

export interface DivisionBranchInfo {
  name: string;
  code: string;
  outletId?: number;
  x: number;
  y: number;
}

export interface DivisionMetric {
  id: string;
  name: BangladeshDivision;
  nameBn: string;
  color: string;
  centerX: number;
  centerY: number;
  svgPath: string;
  dispatchedOrders: number;
  deliveredOrders: number;
  partialOrders: number;
  returnedOrders: number;
  exchangeOrders: number;
  netRevenue: number;
  grossRevenue: number;
  returnRate: number;
  orderShare: number;
  revenueShare: number;
  aov: number;
  topDistricts: { name: string; count: number; revenue: number }[];
  branches?: DivisionBranchInfo[];
}

/**
 * Intelligent Bangladesh division classifier.
 * Matches order attributes against standard geographical boundaries of all 8 administrative divisions.
 */
export function detectDivision(
  city?: string | null,
  address?: string | null,
  note?: string | null,
  districtArea?: LocationType,
  fulfillmentLocation?: string | null
): BangladeshDivision {
  if (districtArea === 'Inside Dhaka' || fulfillmentLocation === 'Mirpur Outlet POS' || fulfillmentLocation === 'Wari Branch') {
    return 'Dhaka';
  }
  if (fulfillmentLocation === 'Cumilla Branch') return 'Chattogram';
  if (fulfillmentLocation === 'Sylhet Branch') return 'Sylhet';

  const combined = `${city || ''} ${address || ''} ${note || ''}`.toLowerCase();

  for (const div of bangladeshDivisionsData) {
    for (const kw of div.districts) {
      if (combined.includes(kw.toLowerCase())) {
        return div.name as BangladeshDivision;
      }
    }
  }

  return 'Dhaka';
}

/**
 * Detects destination district name from city or address.
 */
export function detectDistrictName(city?: string | null, address?: string | null): string {
  const cleanCity = String(city || '').trim();
  if (cleanCity && cleanCity.length > 2 && !/^\d+$/.test(cleanCity) && !cleanCity.toLowerCase().includes('outside')) {
    return cleanCity;
  }
  const cleanAddr = String(address || '').trim().toLowerCase();
  for (const term of GEO_DICT.outside_en) {
    if (term.length > 3 && cleanAddr.includes(term)) {
      return term.charAt(0).toUpperCase() + term.slice(1);
    }
  }
  return cleanCity || 'Dhaka Metro';
}

/**
 * Aggregates complete division-level sales, dispatch, and return metrics across Bangladesh.
 */
export function aggregateDivisionMetrics(orders: ReconciledOrderRow[]): {
  divisions: DivisionMetric[];
  nationalTotal: {
    dispatchedOrders: number;
    deliveredOrders: number;
    returnedOrders: number;
    partialOrders: number;
    exchangeOrders: number;
    netRevenue: number;
    grossRevenue: number;
    nationalReturnRate: number;
  };
  topNationwideDistricts: { name: string; division: string; count: number; revenue: number }[];
} {
  // 1. Group items by unique Order ID
  const orderGroups = new Map<string, ReconciledOrderRow[]>();
  for (const r of orders) {
    if (!orderGroups.has(r.orderId)) {
      orderGroups.set(r.orderId, []);
    }
    orderGroups.get(r.orderId)!.push(r);
  }

  // 2. Initialize tracking per division
  const divStats = new Map<string, {
    dispatchedOrders: number;
    deliveredOrders: number;
    partialOrders: number;
    returnedOrders: number;
    exchangeOrders: number;
    netRevenue: number;
    grossRevenue: number;
    districtsMap: Map<string, { count: number; revenue: number }>;
  }>();

  for (const d of bangladeshDivisionsData) {
    divStats.set(d.name, {
      dispatchedOrders: 0,
      deliveredOrders: 0,
      partialOrders: 0,
      returnedOrders: 0,
      exchangeOrders: 0,
      netRevenue: 0,
      grossRevenue: 0,
      districtsMap: new Map()
    });
  }

  let totalDispatched = 0;
  let totalDelivered = 0;
  let totalReturned = 0;
  let totalPartial = 0;
  let totalExchange = 0;
  let totalNetRevenue = 0;
  let totalGrossRevenue = 0;

  const nationwideDistrictsMap = new Map<string, { division: string; count: number; revenue: number }>();

  // 3. Process each unique order
  orderGroups.forEach((items) => {
    const primary = items[0];
    const divName = detectDivision(
      primary.city,
      primary.rawNote,
      primary.rawNote,
      primary.districtArea,
      primary.fulfillmentLocation
    );

    const stats = divStats.get(divName) || divStats.get('Dhaka')!;

    const orderAmount = primary.orderAmount || items.reduce((s, it) => s + (it.itemCost * it.quantity), 0);
    const netRevenue = items.reduce((s, it) => s + it.netRevenueImpact, 0);

    stats.dispatchedOrders++;
    stats.grossRevenue += orderAmount;
    stats.netRevenue += netRevenue;

    totalDispatched++;
    totalGrossRevenue += orderAmount;
    totalNetRevenue += netRevenue;

    if (primary.orderCategory === 'DELIVERED') {
      stats.deliveredOrders++;
      totalDelivered++;
    } else if (primary.orderCategory === 'FULL_RETURN') {
      stats.returnedOrders++;
      totalReturned++;
    } else if (primary.orderCategory === 'PARTIAL') {
      stats.partialOrders++;
      totalPartial++;
    } else if (primary.orderCategory === 'EXCHANGE') {
      stats.exchangeOrders++;
      totalExchange++;
    }

    // District accumulation
    const districtName = detectDistrictName(primary.city, primary.rawNote);
    if (!stats.districtsMap.has(districtName)) {
      stats.districtsMap.set(districtName, { count: 0, revenue: 0 });
    }
    const dEntry = stats.districtsMap.get(districtName)!;
    dEntry.count++;
    dEntry.revenue += netRevenue;

    // Nationwide district accumulation
    if (!nationwideDistrictsMap.has(districtName)) {
      nationwideDistrictsMap.set(districtName, { division: divName, count: 0, revenue: 0 });
    }
    const nEntry = nationwideDistrictsMap.get(districtName)!;
    nEntry.count++;
    nEntry.revenue += netRevenue;
  });

  // 4. Compile division metrics list
  const divisions: DivisionMetric[] = bangladeshDivisionsData.map((d: any) => {
    const stats = divStats.get(d.name) || {
      dispatchedOrders: 0,
      deliveredOrders: 0,
      partialOrders: 0,
      returnedOrders: 0,
      exchangeOrders: 0,
      netRevenue: 0,
      grossRevenue: 0,
      districtsMap: new Map()
    };

    const returnRate = stats.dispatchedOrders > 0
      ? ((stats.returnedOrders + stats.partialOrders) / stats.dispatchedOrders) * 100
      : 0;

    const orderShare = totalDispatched > 0 ? (stats.dispatchedOrders / totalDispatched) * 100 : 0;
    const revenueShare = totalNetRevenue > 0 ? (stats.netRevenue / totalNetRevenue) * 100 : 0;
    const aov = (stats.deliveredOrders + stats.partialOrders) > 0
      ? stats.netRevenue / (stats.deliveredOrders + stats.partialOrders)
      : (stats.dispatchedOrders > 0 ? stats.grossRevenue / stats.dispatchedOrders : 0);

    const topDistricts = Array.from(stats.districtsMap.entries())
      .map(([name, data]) => ({ name, count: data.count, revenue: Math.round(data.revenue) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      id: d.id,
      name: d.name as BangladeshDivision,
      nameBn: d.nameBn,
      color: d.color,
      centerX: d.centerX,
      centerY: d.centerY,
      svgPath: d.d,
      dispatchedOrders: stats.dispatchedOrders,
      deliveredOrders: stats.deliveredOrders,
      partialOrders: stats.partialOrders,
      returnedOrders: stats.returnedOrders,
      exchangeOrders: stats.exchangeOrders,
      netRevenue: Math.round(stats.netRevenue),
      grossRevenue: Math.round(stats.grossRevenue),
      returnRate: Math.round(returnRate * 10) / 10,
      orderShare: Math.round(orderShare * 10) / 10,
      revenueShare: Math.round(revenueShare * 10) / 10,
      aov: Math.round(aov),
      topDistricts,
      branches: d.branches
    };
  });

  // 5. Compile top nationwide districts
  const topNationwideDistricts = Array.from(nationwideDistrictsMap.entries())
    .map(([name, data]) => ({ name, division: data.division, count: data.count, revenue: Math.round(data.revenue) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const nationalReturnRate = totalDispatched > 0
    ? ((totalReturned + totalPartial) / totalDispatched) * 100
    : 0;

  return {
    divisions,
    nationalTotal: {
      dispatchedOrders: totalDispatched,
      deliveredOrders: totalDelivered,
      returnedOrders: totalReturned,
      partialOrders: totalPartial,
      exchangeOrders: totalExchange,
      netRevenue: Math.round(totalNetRevenue),
      grossRevenue: Math.round(totalGrossRevenue),
      nationalReturnRate: Math.round(nationalReturnRate * 10) / 10
    },
    topNationwideDistricts
  };
}
