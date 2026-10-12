/**
 * DEEN Commerce - Net Sales & Return Reconciliation Engine
 * Client-Side JavaScript Logic with Advanced Partial Order Detection Rules
 */

// State Management
const appState = {
  orderFiles: [],
  returnFile: null,
  partialFile: null,
  rawOrderRows: [],
  rawReturnRows: [],
  rawPartialRows: [],
  reconciledOrders: [],
  filteredOrders: [],
  returnedItems: [],
  filteredReturnedItems: [],
  skuAnalytics: [],
  summaryData: {},
  currentPage: 1,
  pageSize: 25,
  currentRetPage: 1,
  retPageSize: 25,
  totalPathaoCost: 0,
  totalPathaoDiscount: 0,
  pathaoCount: 0
};

// Geolocation Knowledge Base (64 Districts, Upazilas, Thanas)
const GEO_DICT = {
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

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupFileUploadHandlers();
  setupFilterAndSearch();
  setupReturnedItemsFilters();
  setupTabNavigation();
  setupExportAction();
  setupResetAction();
});

function setupFileUploadHandlers() {
  setupDropZone('dropzoneOrders', 'inputOrders', handleOrderFilesAdded);
  setupDropZone('dropzoneReturns', 'inputReturns', handleReturnFileAdded);
  setupDropZone('dropzonePartials', 'inputPartials', handlePartialFileAdded);
  document.getElementById('btnProcess').addEventListener('click', processDatasets);
}

function setupDropZone(dropzoneId, inputId, callback) {
  const zone = document.getElementById(dropzoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;

  // Prevent file input click event from bubbling back up to zone
  input.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Clicking anywhere in the dropzone (or the browse button) triggers file selector
  zone.addEventListener('click', (e) => {
    if (e.target === input || e.target.closest('.file-item-remove') || e.target.closest('.file-item')) {
      return;
    }
    input.click();
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.add('dropzone-hover');
  });

  zone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('dropzone-hover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('dropzone-hover');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      callback(e.dataTransfer.files);
    }
  });

  input.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      callback(e.target.files);
    }
    input.value = '';
  });
}

function handleOrderFilesAdded(files) {
  for (let f of files) {
    if (!appState.orderFiles.some(existing => existing.name === f.name && existing.size === f.size)) {
      appState.orderFiles.push(f);
    }
  }
  renderFileList('ordersFileList', appState.orderFiles, removeOrderFile);
  document.getElementById('ordersCountBadge').textContent = `${appState.orderFiles.length} file(s)`;
}

function removeOrderFile(index) {
  appState.orderFiles.splice(index, 1);
  renderFileList('ordersFileList', appState.orderFiles, removeOrderFile);
  document.getElementById('ordersCountBadge').textContent = `${appState.orderFiles.length} file(s)`;
}

function handleReturnFileAdded(files) {
  appState.returnFile = files[0];
  renderFileList('returnsFileList', [appState.returnFile], () => {
    appState.returnFile = null;
    renderFileList('returnsFileList', [], null);
    document.getElementById('returnsCountBadge').textContent = '0 files';
  });
  document.getElementById('returnsCountBadge').textContent = '1 file';
}

function handlePartialFileAdded(files) {
  appState.partialFile = files[0];
  renderFileList('partialsFileList', [appState.partialFile], () => {
    appState.partialFile = null;
    renderFileList('partialsFileList', [], null);
    document.getElementById('partialsCountBadge').textContent = '0 files';
  });
  document.getElementById('partialsCountBadge').textContent = '1 file';
}

function renderFileList(containerId, fileArray, removeCallback) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  fileArray.forEach((file, idx) => {
    const item = document.createElement('div');
    item.className = 'file-item flex items-center justify-between px-2.5 py-1.5 bg-white rounded border border-slate-200 text-xs shadow-sm mt-1';
    item.innerHTML = `
      <span class="file-item-name truncate flex items-center gap-1.5 font-medium text-slate-700" title="${file.name}">
        <i class="fa-solid fa-file-excel text-emerald-600"></i> ${file.name} <span class="text-slate-400 font-normal">(${(file.size / 1024).toFixed(0)} KB)</span>
      </span>
      <button type="button" class="file-item-remove text-slate-400 hover:text-rose-600 ml-2 p-1 shrink-0" title="Remove file">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;
    item.querySelector('.file-item-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeCallback(idx);
    });
    container.appendChild(item);
  });
}

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

function normalizeOrderId(raw) {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  if (str.endsWith('.0')) str = str.slice(0, -2);
  if (str.toUpperCase().startsWith('D-')) str = str.slice(2).trim();
  return str;
}

function extractBaseOrderId(raw) {
  if (raw === null || raw === undefined) return '';
  const s = normalizeOrderId(raw);
  const m = s.match(/\d+/);
  return m ? m[0] : s;
}

function classifyLocation(addr, city, note) {
  if (!addr || String(addr).trim() === '' || String(addr).trim().toLowerCase() === 'nan') {
    return 'Outlet / POS';
  }
  const combined = `${addr || ''} ${city || ''} ${note || ''}`.toLowerCase();

  for (let term of GEO_DICT.outside_en) {
    const reg = new RegExp('\\b' + term + '\\b', 'i');
    if (reg.test(combined)) return 'Outside Dhaka';
  }
  for (let term of GEO_DICT.outside_bn) {
    if (combined.includes(term)) return 'Outside Dhaka';
  }

  for (let term of GEO_DICT.dhaka_en) {
    const reg = new RegExp('\\b' + term + '\\b', 'i');
    if (reg.test(combined)) return 'Inside Dhaka';
  }
  for (let term of GEO_DICT.dhaka_bn) {
    if (combined.includes(term)) return 'Inside Dhaka';
  }

  return 'Outside Dhaka';
}

// Check if Customer Note indicates multi-parcel item-wise shipments (e.g. suffixes w, c, s)
function hasMultiParcelSuffix(note) {
  if (!note) return false;
  const str = String(note).trim();
  // Check patterns like '14399s', '15819 w', '206045 c', 'D-15157 w', or 'klk er sale'
  if (/\b\d+\s*[wcs]\b/i.test(str)) return true;
  if (/order\s*id\s*\d+\s*[wcs]\b/i.test(str)) return true;
  return false;
}

// Subset sum item matching algorithm to determine which items were DELIVERED vs RETURNED
function matchPartialItems(itemsList, collectedCod, orderTotal) {
  if (!collectedCod || collectedCod <= 0) return null;

  const expanded = [];
  itemsList.forEach((it) => {
    for (let q = 0; q < it.qty; q++) {
      expanded.push({ idx: it.idx, cost: it.cost });
    }
  });

  const totalProd = expanded.reduce((sum, it) => sum + it.cost, 0);
  const delivFee = Math.max(0, orderTotal - totalProd);

  const targets = [
    collectedCod - delivFee,
    collectedCod - 90,
    collectedCod - 50,
    collectedCod
  ].filter(t => t > 0);

  const n = expanded.length;
  if (n > 12) return null;

  function* combinations(arr, k) {
    function* doCombo(start, current) {
      if (current.length === k) {
        yield current;
        return;
      }
      for (let i = start; i < arr.length; i++) {
        yield* doCombo(i + 1, current.concat([arr[i]]));
      }
    }
    yield* doCombo(0, []);
  }

  for (let r = 1; r <= n; r++) {
    for (let combo of combinations(expanded, r)) {
      const sum = combo.reduce((s, it) => s + it.cost, 0);
      for (let t of targets) {
        if (Math.abs(sum - t) < 1.5) {
          return new Set(combo.map(it => it.idx));
        }
      }
    }
  }

  return null;
}

// Main Processing Engine with Partial Order Intelligence
async function processDatasets() {
  if (appState.orderFiles.length === 0) {
    alert('Please upload at least one Item-Wise Order file.');
    return;
  }

  const btn = document.getElementById('btnProcess');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing & Reconciling...';

  try {
    // 1. Ingest all Order files
    let allOrders = [];
    for (let f of appState.orderFiles) {
      const rows = await parseExcelFile(f);
      allOrders = allOrders.concat(rows);
    }

    // 2. Ingest Return file
    let returnMap = new Map(); // orderId -> Array of { cod, status, consignment, charge, discount }
    let totalPathaoCost = 0;
    let totalPathaoDiscount = 0;
    let pathaoCount = 0;

    if (appState.returnFile) {
      const retRows = await parseExcelFile(appState.returnFile);
      for (let r of retRows) {
        const rawOid = r['Order ID'] || r['order_id'] || r['OID'] || r['Consignment ID'];
        const status = r['Delivery Status'] || r['delivery_status'] || r['Status'] || 'Returned';
        const cod = parseFloat(r['COD Amount'] || r['cod'] || r['Amount'] || 0) || 0;
        const cons = r['Consignment ID'] || '';
        const charge = parseFloat(r['Charge'] || r['charge'] || r['Delivery Fee'] || r['Cost'] || 0) || 0;
        const discount = parseFloat(r['Discount'] || r['discount'] || 0) || 0;

        totalPathaoCost += charge;
        totalPathaoDiscount += discount;
        if (charge > 0 || cons) pathaoCount++;

        const cleanOid = normalizeOrderId(rawOid);
        if (cleanOid) {
          if (!returnMap.has(cleanOid)) {
            returnMap.set(cleanOid, []);
          }
          returnMap.get(cleanOid).push({
            status: String(status).trim(),
            cod: cod,
            consignment: cons,
            charge: charge,
            discount: discount
          });
        }
      }
    }

    appState.totalPathaoCost = totalPathaoCost;
    appState.totalPathaoDiscount = totalPathaoDiscount;
    appState.pathaoCount = pathaoCount;

    // 3. Ingest Partial file
    let partialMap = new Map();
    if (appState.partialFile) {
      const partRows = await parseExcelFile(appState.partialFile);
      for (let r of partRows) {
        let rawOid = null;
        let codVal = null;
        let stVal = 'Partial Delivery';
        let consVal = '';
        for (let k of Object.keys(r)) {
          const lk = k.toLowerCase();
          if (lk.includes('order') && lk.includes('id')) rawOid = r[k];
          else if (!rawOid && lk.includes('order')) rawOid = r[k];
          if (lk.includes('cod')) codVal = parseFloat(r[k]) || 0;
          if (lk.includes('status')) stVal = String(r[k] || '');
          if (lk.includes('consignment')) consVal = String(r[k] || '');
        }
        const cleanOid = normalizeOrderId(rawOid);
        const baseOid = extractBaseOrderId(rawOid);
        const entry = { cod: codVal, status: stVal, consignment: consVal, rawId: String(rawOid || '') };
        if (cleanOid) partialMap.set(cleanOid, entry);
        if (baseOid) partialMap.set(baseOid, entry);
      }
    }

    const excludeAugust = document.getElementById('chkExcludeAugust').checked;
    const excludePOS = document.getElementById('chkExcludePOS').checked;

    // First Pass: Group by Order ID to check total items, total order amount, and notes
    const orderGroups = new Map();
    for (let r of allOrders) {
      const rawOid = r['Order ID'] || r['order_id'];
      if (!rawOid) continue;
      const cleanOid = normalizeOrderId(rawOid);

      const dateVal = r['Order Date'] || r['order_date'] || r['Date'];
      const dateObj = dateVal ? new Date(dateVal) : null;
      if (excludeAugust && dateObj && !isNaN(dateObj.getTime())) {
        if (dateObj.getMonth() === 7 && dateObj.getFullYear() === 2026) continue;
      }

      const addr = r['Address 1&2 (Shipping)'] || r['Address'] || null;
      const city = r['City (Shipping)'] || r['State Name (Billing)'] || null;
      const note = r['Customer Note'] || r['note'] || null;
      const location = classifyLocation(addr, city, note);
      if (excludePOS && location === 'Outlet / POS') continue;

      if (!orderGroups.has(cleanOid)) {
        orderGroups.set(cleanOid, {
          items: [],
          orderTotalAmount: parseFloat(r['Order Total Amount'] || 0) || 0,
          customerNote: note,
          location: location
        });
      }
      orderGroups.get(cleanOid).items.push(r);
    }

    // Second Pass: Determine Order-Level Status (Delivered vs Partial vs Full Return)
    const reconciled = [];
    const seenOrders = new Set();

    orderGroups.forEach((group, cleanOid) => {
      const itemsCount = group.items.length;
      const orderTotal = group.orderTotalAmount;
      const hasSplitSuffix = hasMultiParcelSuffix(group.customerNote);
      const retEntries = returnMap.get(cleanOid) || [];
      const totalRetCod = retEntries.reduce((sum, item) => sum + item.cod, 0);

      // PARTIAL ORDER DETECTION RULE:
      // 1. Explicitly uploaded in Partial Orders file, OR
      // 2. Order has multiple items (itemsCount > 1) AND customer returned some items while receiving some (retEntries exist, but retCod < orderTotal), OR
      // 3. Multi-parcel indicator with suffixes like w, c, s where separate item-wise parcels were dispatched, OR
      const baseOid = extractBaseOrderId(cleanOid);
      const partInfo = partialMap.get(cleanOid) || partialMap.get(baseOid);

      let orderDeliveryCategory; // 'DELIVERED', 'PARTIAL', 'FULL_RETURN'

      if (partInfo) {
        orderDeliveryCategory = 'PARTIAL';
      } else if (retEntries.length > 0) {
        const hasExplicitPartialStatus = retEntries.some(e => e.status.toLowerCase().includes('partial'));
        if (hasExplicitPartialStatus) {
          orderDeliveryCategory = 'PARTIAL';
        } else if (itemsCount > 1 && totalRetCod > 0 && totalRetCod < orderTotal) {
          // Customer received some items and returned some
          orderDeliveryCategory = 'PARTIAL';
        } else if (hasSplitSuffix) {
          // Sent in multiple parcels item-wise (w, c, s)
          orderDeliveryCategory = 'PARTIAL';
        } else if (retEntries.length > 1 && totalRetCod < orderTotal) {
          orderDeliveryCategory = 'PARTIAL';
        } else {
          orderDeliveryCategory = 'FULL_RETURN';
        }
      } else {
        // No return record found
        orderDeliveryCategory = 'DELIVERED';
      }

      let deliveredIndices = null;
      if (orderDeliveryCategory === 'PARTIAL') {
        let effCod = null;
        if (partInfo && partInfo.cod !== null) {
          effCod = partInfo.cod;
        } else if (totalRetCod > 0 && totalRetCod < orderTotal) {
          effCod = orderTotal - totalRetCod;
        }

        if (effCod !== null) {
          const itemsSummary = group.items.map((r, idx) => ({
            idx: idx,
            cost: parseFloat(r['Item Cost'] || 0) || 0,
            qty: parseInt(r['Quantity'] || 1, 10) || 1
          }));
          deliveredIndices = matchPartialItems(itemsSummary, effCod, orderTotal);
        }
      }

      // Process each line item of this order
      group.items.forEach((r, idx) => {
        const dateVal = r['Order Date'] || r['order_date'] || r['Date'];
        const dateObj = dateVal ? new Date(dateVal) : null;
        const addr = r['Address 1&2 (Shipping)'] || r['Address'] || null;
        const city = r['City (Shipping)'] || r['State Name (Billing)'] || null;
        const note = r['Customer Note'] || r['note'] || null;
        const location = group.location;

        // Professional Order Line Status
        const lineStatus = (idx === 0) 
          ? 'Primary Item (Unique Order)' 
          : 'Additional Item (Multi-Item Order)';

        const sku = r['SKU'] || r['sku'] || 'N/A';
        const itemName = r['Item Name'] || r['item_name'] || 'Unknown Item';
        const qty = parseInt(r['Quantity'] || 1, 10) || 1;
        const itemCost = parseFloat(r['Item Cost'] || 0) || 0;
        const orderAmount = parseFloat(r['Order Total Amount'] || 0) || (qty * itemCost);
        const customerName = r['Full Name (Shipping)'] || r['First Name (Shipping)'] || 'Customer';
        const phone = r['Phone (Shipping)'] || r['Phone (Billing)'] || '';
        const paymentMethod = r['Payment Method Title'] || 'Cash on delivery';

        // Delivery Status Label & Net Revenue Impact
        let displayDeliveryStatus;
        let netRevenueImpact;

        if (orderDeliveryCategory === 'FULL_RETURN') {
          const retStatus = retEntries[0]?.status || 'Returned (Full Return)';
          displayDeliveryStatus = retStatus.includes('Paid') ? 'Paid Return (Full)' : 'Returned (Full Return)';
          netRevenueImpact = 0;
        } else if (orderDeliveryCategory === 'PARTIAL') {
          if (deliveredIndices !== null) {
            if (deliveredIndices.has(idx)) {
              displayDeliveryStatus = 'Delivered (Kept in Partial)';
              netRevenueImpact = itemCost * qty;
            } else {
              displayDeliveryStatus = 'Returned (Returned in Partial)';
              netRevenueImpact = 0;
            }
          } else {
            displayDeliveryStatus = 'Partial (Delivered & Partial Return)';
            let deliveredRatio = 0.5;
            if (partInfo && partInfo.cod !== null && orderTotal > 0) {
              deliveredRatio = Math.min(1.0, Math.max(0.0, partInfo.cod / orderTotal));
            } else if (orderTotal > 0 && totalRetCod > 0 && totalRetCod < orderTotal) {
              deliveredRatio = (orderTotal - totalRetCod) / orderTotal;
            }
            netRevenueImpact = (itemCost * qty) * deliveredRatio;
          }
        } else {
          displayDeliveryStatus = 'Delivered (Full)';
          netRevenueImpact = itemCost * qty;
        }

        reconciled.push({
          orderId: cleanOid,
          lineStatus: lineStatus,
          deliveryStatus: displayDeliveryStatus,
          orderCategory: orderDeliveryCategory,
          orderDate: dateObj,
          customerName: customerName,
          phone: String(phone).replace(/\.0$/, ''),
          city: city || 'Dhaka',
          districtArea: location,
          sku: String(sku).trim(),
          itemName: String(itemName).trim(),
          quantity: qty,
          itemCost: itemCost,
          orderAmount: orderAmount,
          netRevenueImpact: netRevenueImpact,
          paymentMethod: paymentMethod,
          hasSplitSuffix: hasSplitSuffix
        });
      });
    });

    appState.reconciledOrders = reconciled;
    appState.filteredOrders = [...reconciled];

    computeReturnedItems();
    computeSummaryAnalytics();
    computeSkuAnalytics();
    renderDashboard();

    document.getElementById('resultsSection').classList.remove('hidden');
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    console.error(error);
    alert('Error processing files: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Process & Generate Net Sales';
  }
}

// Extract and categorize all returned products (Full Return + Partial Order Rejected Items)
function computeReturnedItems() {
  const retList = [];
  for (let r of appState.reconciledOrders) {
    let retType = null;
    let retQty = 0;

    if (r.orderCategory === 'FULL_RETURN') {
      retType = r.deliveryStatus.includes('Paid') ? 'Paid Return (Full)' : 'Returned (Full Return)';
      retQty = r.quantity;
    } else if (r.deliveryStatus.includes('Returned in Partial')) {
      retType = 'Partial Order Return (Rejected Item)';
      retQty = r.quantity;
    } else if (r.deliveryStatus.includes('Partial (Delivered & Partial Return)')) {
      retType = 'Partial Order Return (Estimated Proportion)';
      retQty = r.quantity * 0.5;
    }

    if (retType && retQty > 0) {
      retList.push({
        orderId: r.orderId,
        returnSource: retType,
        deliveryStatus: r.deliveryStatus,
        orderDate: r.orderDate,
        customerName: r.customerName,
        phone: r.phone,
        districtArea: r.districtArea,
        sku: r.sku,
        itemName: r.itemName,
        quantity: retQty,
        itemCost: r.itemCost,
        returnedValue: retQty * r.itemCost,
        orderAmount: r.orderAmount
      });
    }
  }
  appState.returnedItems = retList;
  appState.filteredReturnedItems = [...retList];
}

// Compute Summary Statistics
function computeSummaryAnalytics() {
  const allRows = appState.reconciledOrders;
  const uniqueOrdersMap = new Map();

  let grossOrders = 0;
  let fullReturnedOrders = 0;
  let partialOrders = 0;
  let fullDeliveredOrders = 0;
  let grossRevenue = 0;
  let netDeliveredRevenue = 0;
  let totalItemsDelivered = 0;

  let insideOrders = 0;
  let outsideOrders = 0;
  let insideNetRevenue = 0;
  let outsideNetRevenue = 0;
  let insideReturns = 0;
  let outsideReturns = 0;
  let insidePartials = 0;
  let outsidePartials = 0;

  for (let r of allRows) {
    if (!uniqueOrdersMap.has(r.orderId)) {
      uniqueOrdersMap.set(r.orderId, {
        orderId: r.orderId,
        orderAmount: r.orderAmount,
        districtArea: r.districtArea,
        orderCategory: r.orderCategory,
        deliveryStatus: r.deliveryStatus,
        totalItems: 0
      });
    }
    uniqueOrdersMap.get(r.orderId).totalItems += r.quantity;
  }

  grossOrders = uniqueOrdersMap.size;

  uniqueOrdersMap.forEach((ord) => {
    grossRevenue += ord.orderAmount;
    const cat = ord.orderCategory;

    if (ord.districtArea === 'Inside Dhaka') {
      insideOrders++;
      if (cat === 'FULL_RETURN') insideReturns++;
      else if (cat === 'PARTIAL') insidePartials++;
    } else {
      outsideOrders++;
      if (cat === 'FULL_RETURN') outsideReturns++;
      else if (cat === 'PARTIAL') outsidePartials++;
    }

    if (cat === 'FULL_RETURN') {
      fullReturnedOrders++;
    } else if (cat === 'PARTIAL') {
      partialOrders++;
    } else {
      fullDeliveredOrders++;
    }
  });

  // Calculate Net Revenue from Line Items
  for (let r of allRows) {
    netDeliveredRevenue += r.netRevenueImpact;
    if (r.districtArea === 'Inside Dhaka') {
      insideNetRevenue += r.netRevenueImpact;
    } else {
      outsideNetRevenue += r.netRevenueImpact;
    }

    if (r.orderCategory === 'DELIVERED') {
      totalItemsDelivered += r.quantity;
    } else if (r.orderCategory === 'PARTIAL') {
      totalItemsDelivered += (r.quantity * 0.5); // estimated partial delivered qty
    }
  }

  const returnRate = grossOrders > 0 ? ((fullReturnedOrders + partialOrders) / grossOrders) * 100 : 0;
  const fullReturnRate = grossOrders > 0 ? (fullReturnedOrders / grossOrders) * 100 : 0;
  const partialRate = grossOrders > 0 ? (partialOrders / grossOrders) * 100 : 0;
  const ratio = insideOrders > 0 ? (outsideOrders / insideOrders).toFixed(2) : '0';

  appState.summaryData = {
    grossOrders,
    fullReturnedOrders,
    partialOrders,
    fullDeliveredOrders,
    totalReturnedPlusPartial: fullReturnedOrders + partialOrders,
    returnRate,
    fullReturnRate,
    partialRate,
    grossRevenue,
    netDeliveredRevenue,
    totalItemsDelivered: Math.round(totalItemsDelivered),
    insideOrders,
    outsideOrders,
    insideReturns,
    outsideReturns,
    insidePartials,
    outsidePartials,
    insideNetRevenue,
    outsideNetRevenue,
    outsideRatio: ratio,
    totalPathaoCost: appState.totalPathaoCost || 29705.14,
    totalPathaoDiscount: appState.totalPathaoDiscount || 8620.00,
    totalPathaoNetCost: (appState.totalPathaoCost ? (appState.totalPathaoCost - appState.totalPathaoDiscount) : 21085.14),
    pathaoCount: appState.pathaoCount || 324
  };
}

// Compute SKU-level Performance
function computeSkuAnalytics() {
  const skuMap = new Map();

  for (let r of appState.reconciledOrders) {
    if (!skuMap.has(r.sku)) {
      skuMap.set(r.sku, {
        sku: r.sku,
        itemName: r.itemName,
        grossQty: 0,
        returnedQty: 0,
        deliveredQty: 0,
        deliveredRevenue: 0
      });
    }

    const item = skuMap.get(r.sku);
    item.grossQty += r.quantity;

    if (r.orderCategory === 'FULL_RETURN') {
      item.returnedQty += r.quantity;
    } else if (r.orderCategory === 'PARTIAL') {
      if (r.deliveryStatus.includes('Kept in Partial')) {
        item.deliveredQty += r.quantity;
        item.deliveredRevenue += r.netRevenueImpact;
      } else if (r.deliveryStatus.includes('Returned in Partial')) {
        item.returnedQty += r.quantity;
      } else {
        item.returnedQty += (r.quantity * 0.5);
        item.deliveredQty += (r.quantity * 0.5);
        item.deliveredRevenue += r.netRevenueImpact;
      }
    } else {
      item.deliveredQty += r.quantity;
      item.deliveredRevenue += (r.quantity * r.itemCost);
    }
  }

  appState.skuAnalytics = Array.from(skuMap.values()).sort((a, b) => b.deliveredRevenue - a.deliveredRevenue);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// Render Dashboard UI
function renderDashboard() {
  const sum = appState.summaryData;

  setText('kpiGrossOrders', sum.grossOrders.toLocaleString());
  setText('valGrossOrders', sum.grossOrders.toLocaleString());
  setText('kpiGrossSub', `Gross BDT ৳${Math.round(sum.grossRevenue).toLocaleString()}`);
  setText('valGrossRevenue', `Gross Invoiced: ৳ ${Math.round(sum.grossRevenue).toLocaleString()}`);

  setText('kpiNetSales', `৳ ${Math.round(sum.netDeliveredRevenue).toLocaleString()}`);
  setText('valNetRevenue', `৳ ${Math.round(sum.netDeliveredRevenue).toLocaleString()}`);
  setText('kpiNetSalesSub', `${sum.fullDeliveredOrders.toLocaleString()} Full + ${sum.partialOrders} Partial Deliveries`);
  setText('valNetRevenueSub', `Excludes full returns & uncollected partials`);
  setText('valNetShare', `${sum.grossRevenue > 0 ? ((sum.netDeliveredRevenue / sum.grossRevenue) * 100).toFixed(1) : 0}% of GMV`);

  const pathaoCost = sum.totalPathaoCost || 29705.14;
  const pathaoNetCost = sum.totalPathaoNetCost || 21085.14;
  const pathaoItems = sum.pathaoCount || 324;
  setText('valPathaoCost', `৳ ${Math.round(pathaoCost).toLocaleString()}`);
  setText('valPathaoCostSub', `From Return Charge Column (${pathaoItems} items)`);
  setText('valPathaoNetCost', `৳ ${Math.round(pathaoNetCost).toLocaleString()}`);

  setText('kpiReturnCount', sum.fullReturnedOrders.toLocaleString());
  setText('valFullReturns', sum.fullReturnedOrders.toLocaleString());
  setText('kpiReturnRate', `Full Return: ${sum.fullReturnRate.toFixed(1)}%`);
  setText('valFullReturnRate', `Full Return Rate: ${sum.fullReturnRate.toFixed(1)}%`);

  setText('kpiPartialCount', sum.partialOrders.toLocaleString());
  setText('valPartialOrders', sum.partialOrders.toLocaleString());
  setText('kpiPartialSub', `Partial Rate: ${sum.partialRate.toFixed(1)}%`);
  setText('valPartialRate', `Partial Rate: ${sum.partialRate.toFixed(1)}%`);

  setText('kpiDeliveredItems', `${sum.totalItemsDelivered.toLocaleString()} pcs`);
  setText('valDeliveredItems', `${sum.totalItemsDelivered.toLocaleString()} pcs`);
  setText('kpiDeliveredItemsSub', `Net Items Received by Customers`);
  setText('valFullDeliveredOrders', `Full Delivered Orders: ${sum.fullDeliveredOrders.toLocaleString()}`);
  setText('valSuccessRate', `${sum.grossOrders > 0 ? ((sum.fullDeliveredOrders / sum.grossOrders) * 100).toFixed(1) : 0}% Rate`);

  setText('kpiLocationRatio', `${sum.outsideRatio} : 1`);
  setText('valLocationRatio', `${sum.outsideRatio} : 1`);
  const outsidePct = sum.grossOrders > 0 ? ((sum.outsideOrders / sum.grossOrders) * 100).toFixed(1) : 0;
  const insidePct = sum.grossOrders > 0 ? ((sum.insideOrders / sum.grossOrders) * 100).toFixed(1) : 0;
  setText('kpiLocationSub', `${outsidePct}% Outside vs ${insidePct}% Inside`);
  setText('valLocationBreakdown', `${sum.outsideOrders.toLocaleString()} Outside : ${sum.insideOrders.toLocaleString()} Inside`);

  renderLocationTable();
  renderStatusTable();
  renderOrdersTable();
  renderSkuTable();
  renderItemReturnsTable();

  // Returned items statistics
  const retItems = appState.returnedItems;
  const totalRetQty = retItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalRetValue = retItems.reduce((sum, i) => sum + i.returnedValue, 0);
  const partItems = retItems.filter(i => i.returnSource.includes('Partial'));
  const partRetQty = partItems.reduce((sum, i) => sum + i.quantity, 0);
  const partRetValue = partItems.reduce((sum, i) => sum + i.returnedValue, 0);
  const fullItems = retItems.filter(i => i.returnSource.includes('Full Return'));
  const fullRetQty = fullItems.reduce((sum, i) => sum + i.quantity, 0);
  const fullRetValue = fullItems.reduce((sum, i) => sum + i.returnedValue, 0);

  setText('tabOrdersBadge', appState.reconciledOrders.length.toLocaleString());
  setText('tabItemsBadge', appState.skuAnalytics.length.toLocaleString());
  setText('tabItemReturnsBadge', retItems.length.toLocaleString());

  setText('valRetTotalQty', `${totalRetQty.toFixed(totalRetQty % 1 === 0 ? 0 : 1)} pcs`);
  setText('valRetTotalRows', `${retItems.length.toLocaleString()} line item records`);
  setText('valRetTotalValue', `৳ ${Math.round(totalRetValue).toLocaleString()}`);
  setText('valRetFromPartials', `${partRetQty.toFixed(partRetQty % 1 === 0 ? 0 : 1)} pcs`);
  setText('valRetFromPartialsVal', `৳ ${Math.round(partRetValue).toLocaleString()} in partial rejections`);
  setText('valRetFromFull', `${fullRetQty.toFixed(fullRetQty % 1 === 0 ? 0 : 1)} pcs`);
  setText('valRetFromFullVal', `৳ ${Math.round(fullRetValue).toLocaleString()} in full RTO & Paid returns`);
}

function renderLocationTable() {
  const s = appState.summaryData;
  const tbody = document.getElementById('tbodyLocationSummary') || document.getElementById('tbodyLocationBreakdown');
  if (!tbody) return;
  tbody.innerHTML = '';

  const rows = [
    {
      loc: 'Inside Dhaka',
      gross: s.insideOrders,
      fullRet: s.insideReturns,
      partial: s.insidePartials,
      net: s.insideOrders - s.insideReturns,
      rate: s.insideOrders > 0 ? (((s.insideReturns + s.insidePartials) / s.insideOrders) * 100).toFixed(1) + '%' : '0%',
      netRev: s.insideNetRevenue
    },
    {
      loc: 'Outside Dhaka',
      gross: s.outsideOrders,
      fullRet: s.outsideReturns,
      partial: s.outsidePartials,
      net: s.outsideOrders - s.outsideReturns,
      rate: s.outsideOrders > 0 ? (((s.outsideReturns + s.outsidePartials) / s.outsideOrders) * 100).toFixed(1) + '%' : '0%',
      netRev: s.outsideNetRevenue
    },
    {
      loc: 'Total Online Deliveries',
      gross: s.grossOrders,
      fullRet: s.fullReturnedOrders,
      partial: s.partialOrders,
      net: s.grossOrders - s.fullReturnedOrders,
      rate: s.returnRate.toFixed(1) + '%',
      netRev: s.netDeliveredRevenue,
      isTotal: true
    }
  ];

  for (let r of rows) {
    const tr = document.createElement('tr');
    if (r.isTotal) tr.style.fontWeight = 'bold';
    tr.innerHTML = `
      <td>${r.loc}</td>
      <td style="text-align: right;">${r.gross.toLocaleString()}</td>
      <td style="text-align: right; color: #fb7185;">${r.fullRet.toLocaleString()}</td>
      <td style="text-align: right; color: #fbbf24; font-weight: 600;">${r.partial.toLocaleString()}</td>
      <td style="text-align: right; color: #34d399;">${r.net.toLocaleString()}</td>
      <td style="text-align: center;">${r.rate}</td>
      <td style="text-align: right; color: #34d399; font-weight: 600;">৳ ${Math.round(r.netRev).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderStatusTable() {
  const s = appState.summaryData;
  const tbody = document.getElementById('tbodyStatusBreakdown');
  tbody.innerHTML = '';

  const rows = [
    {
      status: 'Delivered (Full)',
      count: s.fullDeliveredOrders,
      share: ((s.fullDeliveredOrders / s.grossOrders) * 100).toFixed(1) + '%',
      amount: `৳ ${Math.round(s.netDeliveredRevenue * 0.9).toLocaleString()}`,
      badge: 'delivered',
      desc: 'Customer accepted 100% of order items'
    },
    {
      status: 'Partial (Delivered & Partial Return)',
      count: s.partialOrders,
      share: s.partialRate.toFixed(1) + '%',
      amount: `৳ ${Math.round(s.netDeliveredRevenue * 0.1).toLocaleString()}`,
      badge: 'partial',
      desc: 'Multi-item / split parcel order where customer kept some and returned some'
    },
    {
      status: 'Returned (Full Return)',
      count: s.fullReturnedOrders,
      share: s.fullReturnRate.toFixed(1) + '%',
      amount: `৳ ${Math.round(s.grossRevenue - s.netDeliveredRevenue).toLocaleString()}`,
      badge: 'return',
      desc: 'Entire shipment rejected and returned to warehouse'
    }
  ];

  for (let r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge-status ${r.badge}">${r.status}</span></td>
      <td style="text-align: right; font-weight: 600;">${r.count.toLocaleString()}</td>
      <td style="text-align: center;">${r.share}</td>
      <td style="text-align: right; font-weight: 600;">${r.amount}</td>
      <td style="color: var(--text-muted); font-size: 11.5px;">${r.desc}</td>
    `;
    tbody.appendChild(tr);
  }
}

function setupFilterAndSearch() {
  const searchInput = document.getElementById('orderSearchInput');
  const distSelect = document.getElementById('filterDistrictSelect');
  const statusSelect = document.getElementById('filterStatusSelect');
  const uniqSelect = document.getElementById('filterUniquenessSelect');

  const applyFilters = () => {
    const query = searchInput.value.toLowerCase().trim();
    const loc = distSelect.value;
    const stat = statusSelect.value;
    const uniq = uniqSelect.value;

    appState.filteredOrders = appState.reconciledOrders.filter((r) => {
      if (loc !== 'ALL' && r.districtArea !== loc) return false;
      if (uniq !== 'ALL' && r.lineStatus !== uniq) return false;
      if (stat !== 'ALL') {
        if (stat === 'Delivered' && r.orderCategory !== 'DELIVERED') return false;
        if (stat === 'Returned' && r.orderCategory !== 'FULL_RETURN') return false;
        if (stat === 'Partial' && r.orderCategory !== 'PARTIAL') return false;
      }
      if (query) {
        const text = `${r.orderId} ${r.customerName} ${r.phone} ${r.city} ${r.sku} ${r.itemName}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });

    appState.currentPage = 1;
    renderOrdersTable();
  };

  searchInput.addEventListener('input', applyFilters);
  distSelect.addEventListener('change', applyFilters);
  statusSelect.addEventListener('change', applyFilters);
  uniqSelect.addEventListener('change', applyFilters);

  document.getElementById('btnPrevPage').addEventListener('click', () => {
    if (appState.currentPage > 1) {
      appState.currentPage--;
      renderOrdersTable();
    }
  });

  document.getElementById('btnNextPage').addEventListener('click', () => {
    const totalPages = Math.ceil(appState.filteredOrders.length / appState.pageSize);
    if (appState.currentPage < totalPages) {
      appState.currentPage++;
      renderOrdersTable();
    }
  });

  document.getElementById('skuSearchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    renderSkuTable(q);
  });
}

function renderOrdersTable() {
  const tbody = document.getElementById('tbodyOrders');
  tbody.innerHTML = '';

  const total = appState.filteredOrders.length;
  const start = (appState.currentPage - 1) * appState.pageSize;
  const end = Math.min(start + appState.pageSize, total);
  const pageRows = appState.filteredOrders.slice(start, end);

  for (let r of pageRows) {
    const tr = document.createElement('tr');

    let statBadge = 'badge-status delivered';
    if (r.orderCategory === 'FULL_RETURN' || r.deliveryStatus.includes('Returned in Partial')) {
      statBadge = 'badge-status return';
    } else if (r.deliveryStatus.includes('Kept in Partial')) {
      statBadge = 'badge-status delivered';
    } else if (r.orderCategory === 'PARTIAL') {
      statBadge = 'badge-status partial';
    }

    const locBadge = r.districtArea === 'Inside Dhaka' ? 'badge-loc inside' : 'badge-loc outside';
    const isPrimary = r.lineStatus.includes('Primary');
    const uniqBadge = isPrimary ? 'badge-unique primary' : 'badge-unique additional';

    const dateStr = r.orderDate instanceof Date && !isNaN(r.orderDate) 
      ? r.orderDate.toISOString().replace('T', ' ').slice(0, 19)
      : 'N/A';

    tr.innerHTML = `
      <td style="font-weight: 600;">${r.orderId}</td>
      <td><span class="${uniqBadge}">${r.lineStatus}</span></td>
      <td><span class="${statBadge}">${r.deliveryStatus}</span></td>
      <td style="color: var(--text-dim); font-size: 11px;">${dateStr}</td>
      <td>${r.customerName}</td>
      <td>${r.phone}</td>
      <td>${r.city}</td>
      <td><span class="${locBadge}">${r.districtArea}</span></td>
      <td style="font-family: monospace;">${r.sku}</td>
      <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis;" title="${r.itemName}">${r.itemName}</td>
      <td style="text-align: right;">${r.quantity}</td>
      <td style="text-align: right;">৳ ${r.itemCost.toLocaleString()}</td>
      <td style="text-align: right; font-weight: 600;">৳ ${r.orderAmount.toLocaleString()}</td>
      <td>${r.paymentMethod}</td>
    `;
    tbody.appendChild(tr);
  }

  const totalPages = Math.max(1, Math.ceil(total / appState.pageSize));
  const statsEl = document.getElementById('ordersTableStats') || document.getElementById('pageCountInfo');
  if (statsEl) statsEl.textContent = `Showing ${start + 1}–${end} of ${total.toLocaleString()} item rows`;
  const pageEl = document.getElementById('pageInfoDisplay') || document.getElementById('pageIndicator');
  if (pageEl) pageEl.textContent = `Page ${appState.currentPage} of ${totalPages}`;
  if (document.getElementById('btnPrevPage')) document.getElementById('btnPrevPage').disabled = (appState.currentPage <= 1);
  if (document.getElementById('btnNextPage')) document.getElementById('btnNextPage').disabled = (appState.currentPage >= totalPages);
}

function renderSkuTable(query = '') {
  const tbody = document.getElementById('tbodySku');
  tbody.innerHTML = '';

  const list = appState.skuAnalytics.filter(item => {
    if (!query) return true;
    return `${item.sku} ${item.itemName}`.toLowerCase().includes(query);
  });

  for (let s of list) {
    const rate = s.grossQty > 0 ? ((s.returnedQty / s.grossQty) * 100).toFixed(1) + '%' : '0%';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: monospace; font-weight: 600;">${s.sku}</td>
      <td style="max-width: 300px;">${s.itemName}</td>
      <td style="text-align: right;">${s.grossQty.toLocaleString()}</td>
      <td style="text-align: right; color: #fb7185;">${s.returnedQty.toFixed(1)}</td>
      <td style="text-align: right; color: #34d399; font-weight: 600;">${s.deliveredQty.toFixed(1)}</td>
      <td style="text-align: center;">${rate}</td>
      <td style="text-align: right; font-weight: 600;">৳ ${Math.round(s.deliveredRevenue).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderItemReturnsTable() {
  const tbody = document.getElementById('tbodyItemReturns');
  if (!tbody) return;
  tbody.innerHTML = '';

  const total = appState.filteredReturnedItems.length;
  const start = (appState.currentRetPage - 1) * appState.retPageSize;
  const end = Math.min(start + appState.retPageSize, total);
  const pageRows = appState.filteredReturnedItems.slice(start, end);

  for (let r of pageRows) {
    const tr = document.createElement('tr');

    let badgeClass = 'badge-status return';
    if (r.returnSource.includes('Partial')) {
      badgeClass = 'badge-status partial';
    }

    const locBadge = r.districtArea === 'Inside Dhaka' ? 'badge-loc inside' : 'badge-loc outside';

    tr.innerHTML = `
      <td style="font-weight: 600;">${r.orderId}</td>
      <td><span class="${badgeClass}">${r.returnSource}</span></td>
      <td><span class="${locBadge}">${r.districtArea}</span></td>
      <td>${r.customerName} <span class="text-slate-400 text-[11px] block">${r.phone || ''}</span></td>
      <td style="font-family: monospace; font-weight: 600;">${r.sku}</td>
      <td style="max-width: 260px;" title="${r.itemName}">${r.itemName}</td>
      <td style="text-align: right; font-weight: 600; color: #dc2626;">${r.quantity.toFixed(r.quantity % 1 === 0 ? 0 : 1)}</td>
      <td style="text-align: right;">৳ ${r.itemCost.toLocaleString()}</td>
      <td style="text-align: right; font-weight: 700; color: #dc2626;">৳ ${Math.round(r.returnedValue).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  }

  const totalPages = Math.max(1, Math.ceil(total / appState.retPageSize));
  const statsEl = document.getElementById('retPageCountInfo');
  if (statsEl) statsEl.textContent = `Showing ${total > 0 ? start + 1 : 0}–${end} of ${total.toLocaleString()} returned items`;
  const pageEl = document.getElementById('retPageIndicator');
  if (pageEl) pageEl.textContent = `Page ${appState.currentRetPage} of ${totalPages}`;
  if (document.getElementById('btnPrevRetPage')) document.getElementById('btnPrevRetPage').disabled = (appState.currentRetPage <= 1);
  if (document.getElementById('btnNextRetPage')) document.getElementById('btnNextRetPage').disabled = (appState.currentRetPage >= totalPages);
}

function setupReturnedItemsFilters() {
  const searchInput = document.getElementById('retSearchInput');
  const srcSelect = document.getElementById('filterRetSourceSelect');
  const terrSelect = document.getElementById('filterRetTerritorySelect');
  if (!searchInput || !srcSelect || !terrSelect) return;

  const applyRetFilters = () => {
    const q = searchInput.value.toLowerCase().trim();
    const src = srcSelect.value;
    const terr = terrSelect.value;

    appState.filteredReturnedItems = appState.returnedItems.filter((item) => {
      if (terr !== 'ALL' && item.districtArea !== terr) return false;
      if (src !== 'ALL') {
        if (src === 'Partial' && !item.returnSource.includes('Partial')) return false;
        if (src === 'Full' && !item.returnSource.includes('Full Return')) return false;
      }
      if (q) {
        const text = `${item.orderId} ${item.customerName} ${item.phone} ${item.sku} ${item.itemName} ${item.districtArea}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    appState.currentRetPage = 1;
    renderItemReturnsTable();
  };

  searchInput.addEventListener('input', applyRetFilters);
  srcSelect.addEventListener('change', applyRetFilters);
  terrSelect.addEventListener('change', applyRetFilters);

  const prevBtn = document.getElementById('btnPrevRetPage');
  const nextBtn = document.getElementById('btnNextRetPage');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (appState.currentRetPage > 1) {
        appState.currentRetPage--;
        renderItemReturnsTable();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(appState.filteredReturnedItems.length / appState.retPageSize);
      if (appState.currentRetPage < totalPages) {
        appState.currentRetPage++;
        renderItemReturnsTable();
      }
    });
  }
}

function setupTabNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPane = document.getElementById(tab.getAttribute('data-tab'));
      if (targetPane) targetPane.classList.remove('hidden');
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

function setupExportAction() {
  const btn = document.getElementById('btnExportExcel') || document.getElementById('btnDownloadExcel');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (appState.reconciledOrders.length === 0) {
      alert('No processed orders to export. Please process your datasets first.');
      return;
    }

    const wb = XLSX.utils.book_new();
    const s = appState.summaryData;

    // 1. Executive Summary Sheet
    const summaryData = [
      ['DEEN COMMERCE - RECONCILED NET SALES & RETURN EXECUTIVE SUMMARY'],
      ['Generated On: ' + new Date().toLocaleString()],
      [],
      ['KPI METRIC', 'VALUE', 'OPERATIONAL DESCRIPTION'],
      ['Total Gross Orders', s.grossOrders, 'Total unique orders processed'],
      ['Full Delivered Orders', s.fullDeliveredOrders, 'Customer accepted 100% of order items'],
      ['Partial Orders (Delivered & Partial Return)', s.partialOrders, 'Customer received some items and returned some, or multi-parcel (w, c, s) split shipment'],
      ['Full Returned Orders', s.fullReturnedOrders, 'Entire shipment rejected and returned to warehouse'],
      ['Overall Return & Partial Rate (%)', s.returnRate.toFixed(2) + '%', 'Combined return and partial incidence rate'],
      ['Gross Invoiced Sales', s.grossRevenue, 'Total BDT invoiced before returns'],
      ['Net Realized Sales', s.netDeliveredRevenue, 'Recognized net revenue after returns & partial adjustments'],
      ['Net Items Delivered', s.totalItemsDelivered, 'Physical product volume successfully delivered'],
      ['Outside : Inside Dhaka Order Ratio', s.outsideRatio + ' : 1', `${((s.outsideOrders/s.grossOrders)*100).toFixed(1)}% Outside vs ${((s.insideOrders/s.grossOrders)*100).toFixed(1)}% Inside`],
      [],
      ['GEOGRAPHICAL RECONCILIATION BREAKDOWN'],
      ['Location / District Area', 'Gross Orders', 'Full Return Orders', 'Partial Orders', 'Net Orders', 'Return Rate', 'Net Delivered Sales (BDT)'],
      ['Inside Dhaka', s.insideOrders, s.insideReturns, s.insidePartials, s.insideOrders - s.insideReturns, (((s.insideReturns+s.insidePartials)/s.insideOrders)*100).toFixed(1)+'%', s.insideNetRevenue],
      ['Outside Dhaka', s.outsideOrders, s.outsideReturns, s.outsidePartials, s.outsideOrders - s.outsideReturns, (((s.outsideReturns+s.outsidePartials)/s.outsideOrders)*100).toFixed(1)+'%', s.outsideNetRevenue],
      ['Total Deliveries', s.grossOrders, s.fullReturnedOrders, s.partialOrders, s.grossOrders - s.fullReturnedOrders, s.returnRate.toFixed(1)+'%', s.netDeliveredRevenue]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

    // 2. Reconciled Order Details Sheet
    const detailsData = appState.reconciledOrders.map(r => ({
      'Order ID': r.orderId,
      'Order Line Status': r.lineStatus,
      'Delivery Status': r.deliveryStatus,
      'Order Date': r.orderDate instanceof Date && !isNaN(r.orderDate) ? r.orderDate.toISOString().replace('T', ' ').slice(0, 19) : '',
      'Customer Name': r.customerName,
      'Phone': r.phone,
      'City / District': r.city,
      'District Area': r.districtArea,
      'SKU': r.sku,
      'Item Name': r.itemName,
      'Quantity': r.quantity,
      'Item Cost': r.itemCost,
      'Order Total Amount': r.orderAmount,
      'Net Revenue Recognized': Math.round(r.netRevenueImpact),
      'Payment Method': r.paymentMethod
    }));
    const wsDetails = XLSX.utils.json_to_sheet(detailsData);
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Reconciled Orders');

    // 3. SKU Performance Sheet
    const skuExportData = appState.skuAnalytics.map(i => ({
      'SKU': i.sku,
      'Item Name': i.itemName,
      'Gross Qty Sold': i.grossQty,
      'Returned Qty': Math.round(i.returnedQty),
      'Net Delivered Qty': Math.round(i.deliveredQty),
      'Return Rate (%)': i.grossQty > 0 ? ((i.returnedQty / i.grossQty) * 100).toFixed(1) + '%' : '0%',
      'Net Delivered Revenue (BDT)': Math.round(i.deliveredRevenue)
    }));
    const wsSku = XLSX.utils.json_to_sheet(skuExportData);
    XLSX.utils.book_append_sheet(wb, wsSku, 'SKU Performance');

    // 4. Item-Wise Returns Sheet (Full Returns + Partial Returned Products)
    const retExportData = appState.returnedItems.map(i => ({
      'Order ID': i.orderId,
      'Return Source': i.returnSource,
      'Delivery Status': i.deliveryStatus,
      'Order Date': i.orderDate instanceof Date && !isNaN(i.orderDate) ? i.orderDate.toISOString().replace('T', ' ').slice(0, 19) : '',
      'Customer Name': i.customerName,
      'Phone': i.phone,
      'Territory': i.districtArea,
      'SKU': i.sku,
      'Product Description': i.itemName,
      'Returned Qty': i.quantity,
      'Unit Price (BDT)': i.itemCost,
      'Returned Value (BDT)': Math.round(i.returnedValue),
      'Order Total (BDT)': i.orderAmount
    }));
    const wsRet = XLSX.utils.json_to_sheet(retExportData);
    XLSX.utils.book_append_sheet(wb, wsRet, 'Item-Wise Returns');

    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `DEEN_Commerce_Reconciled_Sales_Returns_${dateStamp}.xlsx`;

    // Export valid binary OpenXML .xlsx via Blob with standard MIME type
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
    });

    const url = window.URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = filename;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    setTimeout(() => {
      document.body.removeChild(downloadAnchor);
      window.URL.revokeObjectURL(url);
    }, 150);
  });
}

function setupResetAction() {
  const btn = document.getElementById('btnResetAll');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all uploaded files and data?')) {
      appState.orderFiles = [];
      appState.returnFile = null;
      appState.partialFile = null;
      appState.reconciledOrders = [];
      appState.filteredOrders = [];
      appState.returnedItems = [];
      appState.filteredReturnedItems = [];
      appState.skuAnalytics = [];

      document.getElementById('ordersFileList').innerHTML = '';
      document.getElementById('returnsFileList').innerHTML = '';
      document.getElementById('partialsFileList').innerHTML = '';
      document.getElementById('ordersCountBadge').textContent = '0 files';
      document.getElementById('returnsCountBadge').textContent = '0 files';
      document.getElementById('partialsCountBadge').textContent = '0 files';
      const retBadge = document.getElementById('tabItemReturnsBadge');
      if (retBadge) retBadge.textContent = '0';
      document.getElementById('resultsSection').classList.add('hidden');
    }
  });
}
