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
