/**
 * TESLA MODEL S (2021+ REFRESH) COCKPIT HMI — CENTRAL REACTIVE VEHICLE STATE STORE
 * 五端共用唯一真相數據源 (Single Source of Truth)
 * 嚴格自洽邏輯：
 * 1. 非 P 擋行駛時強制未上鎖 (locked = false) 且不開啟哨兵 (sentryMode = false)
 * 2. 駐停上鎖時強制掛入 P 擋且車速歸 0 (speed = 0, displaySpeed = 0)
 * 3. 轉向方向、圖標、距離、目的地、預計時間與娛樂音量在五端同一時刻 100% 同步
 * 4. 全面採用原創虛構曲目、創作團隊與技術名稱，不含真實藝人名或 FSD/Plaid/AirPods/V4 等宣傳字樣
 */

export const DESTINATIONS_CATALOG = [
  {
    id: 'roppongi',
    name: '六本木新城超充站',
    area: '東京都港區六本木 6-10-1',
    lat: 35.6604,
    lng: 139.7292,
    available: 12,
    total: 16,
    powerKw: 250,
    distKm: 5.4,
    etaMin: 11,
    arrivalSoc: 79,
    nextTurnDistanceM: 240,
    nextTurnDirection: 'right',
    nextTurnStreet: '外苑東通り · 右轉進入六本木通り'
  },
  {
    id: 'shinjuku',
    name: '新宿住友超充站',
    area: '東京都新宿區西新宿 2-6-1',
    lat: 35.6915,
    lng: 139.6910,
    available: 6,
    total: 8,
    powerKw: 250,
    distKm: 2.8,
    etaMin: 6,
    arrivalSoc: 80,
    nextTurnDistanceM: 180,
    nextTurnDirection: 'left',
    nextTurnStreet: '新宿四丁目 · 左轉進入甲州街道'
  },
  {
    id: 'daikanyama',
    name: '代官山蔦屋超充站',
    area: '東京都澀谷區猿樂町 17-5',
    lat: 35.6488,
    lng: 139.6997,
    available: 4,
    total: 6,
    powerKw: 250,
    distKm: 5.1,
    etaMin: 12,
    arrivalSoc: 79,
    nextTurnDistanceM: 210,
    nextTurnDirection: 'left',
    nextTurnStreet: '道玄坂上 · 左轉進入舊山手通り'
  },
  {
    id: 'marunouchi',
    name: '丸之內廣場超充站',
    area: '東京都千代田區丸之內 1-8-1',
    lat: 35.6838,
    lng: 139.7686,
    available: 9,
    total: 12,
    powerKw: 250,
    distKm: 7.2,
    etaMin: 15,
    arrivalSoc: 77,
    nextTurnDistanceM: 310,
    nextTurnDirection: 'right',
    nextTurnStreet: '馬場先門 · 右轉行幸通り往東京站'
  },
  {
    id: 'shibuya',
    name: '澀谷天空塔超充站',
    area: '東京都澀谷區澀谷 2-24-12',
    lat: 35.6585,
    lng: 139.7013,
    available: 7,
    total: 10,
    powerKw: 250,
    distKm: 4.2,
    etaMin: 9,
    arrivalSoc: 80,
    nextTurnDistanceM: 195,
    nextTurnDirection: 'right',
    nextTurnStreet: '表參道交叉口 · 右轉青山通り'
  },
  {
    id: 'odaiba',
    name: '台場海濱公園超充站',
    area: '東京都港區台場 1-4-1',
    lat: 35.6295,
    lng: 139.7753,
    available: 14,
    total: 16,
    powerKw: 250,
    distKm: 11.6,
    etaMin: 18,
    arrivalSoc: 75,
    nextTurnDistanceM: 420,
    nextTurnDirection: 'right',
    nextTurnStreet: '芝浦匝道 · 右轉進入跨海大橋灣岸線'
  }
];

const INITIAL_STATE = {
  // 0. 車型與座艙硬體配置 (2021+ Tesla Model S Refresh)
  modelName: 'Model S',
  vehicleModel: 'Model S',
  vehicleTrim: '雙電機全輪驅動改款版',
  vin: '5YJSA1E59PF482910',

  // 1. 核心動力與行駛狀態 (初始為 D 擋行駛，因此 locked 必為 false、sentryMode 必為 false)
  speed: 68,
  displaySpeed: 68,
  gear: 'D',
  powerKw: 24,
  displayPowerKw: 24,
  batterySoc: 82,
  displaySoc: 82,
  ratedFullRangeKm: 652,
  braking: false,
  steeringAngle: 0,
  roadCurvature: 0.0,
  energyHistory: [
    148, 152, 160, 155, 142, 138, 145, 162, 174, 168,
    154, 140, 132, 128, 136, 149, 158, 164, 152, 144,
    139, 146, 155, 161, 150, 142, 135, 141, 148, 153
  ],
  avgConsumptionWhKm: 149,

  // 2. 車身鎖止與開合件狀態
  locked: false,
  sentryMode: false,
  valetMode: false,
  speedLimitMode: false,
  pinToDrive: true,
  findMyCarActive: false,
  paintColor: 'quicksilver',
  doors: {
    fl: false,
    fr: false,
    rl: false,
    rr: false,
    frunk: false,
    trunk: false,
    chargePort: false
  },
  doorProgress: {
    fl: 0,
    fr: 0,
    rl: 0,
    rr: 0,
    frunk: 0,
    trunk: 0,
    chargePort: 0
  },

  // 3. 充電系統
  charging: {
    pluggedIn: false,
    active: false,
    limitSoc: 90,
    powerKw: 0,
    voltage: 402,
    currentAmps: 0,
    timeRemainingMin: 22,
    superchargerName: '六本木新城超充站',
    history: [
      { id: 'ch-1', date: '10月14日 18:20', location: '六本木新城超充站', addedKwh: 52.4, durationMin: 21, socRange: '20% → 85%' },
      { id: 'ch-2', date: '10月11日 21:05', location: '代官山蔦屋超充站', addedKwh: 41.6, durationMin: 18, socRange: '28% → 82%' }
    ]
  },

  // 4. 熱泵空調與預約出發
  climate: {
    power: true,
    driverTemp: 21.0,
    passengerTemp: 21.5,
    sync: false,
    fanSpeed: 4,
    auto: true,
    ac: true,
    recirculate: true,
    defrostFront: false,
    defrostRear: false,
    seatHeatLeft: 1,
    seatHeatRight: 0,
    cabinTemp: 22.0,
    exteriorTemp: 17.5,
    preconditioning: false,
    mode: 'off',
    scheduledDeparture: {
      enabled: true,
      time: '08:15',
      preconditionCabin: true,
      offPeakCharging: true,
      offPeakEnd: '06:00',
      weekdaysOnly: true
    }
  },

  // 5. 車燈與雨刮
  lights: {
    mode: 'auto',
    lowBeam: true,
    highBeam: false,
    fogFront: false,
    fogRear: false,
    drl: true,
    ambient: true,
    turnSignal: 'off',
    hazard: false,
    blinkPhase: false
  },
  wipers: {
    mode: 'auto',
    effectiveLevel: 0
  },

  // 6. 駕駛與輔助駕駛狀態
  driveMode: {
    accel: 'standard',
    steering: 'standard',
    regen: 'standard',
    autopilot: true,
    setSpeed: 80,
    speedLimit: 80,
    followDistanceLevel: 3,
    leadCarDistanceM: 28.0,
    displayLeadDistanceM: 28.0,
    laneDepartureWarn: false,
    blindSpotCamera: true,
    forwardCollisionWarn: false
  },

  // 7. 四輪胎壓監測 (TPMS)
  tires: {
    fl: 2.90,
    fr: 2.90,
    rl: 2.92,
    rr: 2.92,
    lowPressureWarning: false
  },

  // 8. 導航與路線選擇系統
  navigation: {
    active: true,
    destinationId: 'roppongi',
    destinationName: '六本木新城超充站',
    destinationAddress: '東京都港區六本木 6-10-1',
    routeSelectorOpen: false,
    selectedRouteOption: 'fastest',
    routeOptions: [
      { id: 'fastest', label: '最快路線', tag: '推薦 · 11分', deltaMin: 0, deltaKm: 0 },
      { id: 'eco', label: '節能路線', tag: '省電 6%', deltaMin: 2, deltaKm: -0.3 },
      { id: 'scenic', label: '景觀路線', tag: '外苑林蔭', deltaMin: 4, deltaKm: 0.9 }
    ],
    searchQuery: '',
    etaMinutes: 11,
    remainingKm: 5.4,
    arrivalSoc: 79,
    nextTurnDistanceM: 240,
    nextTurnDirection: 'right',
    nextTurnStreet: '外苑東通り · 右轉進入六本木通り',
    voiceGuidance: true,
    voiceSpeaking: false,
    trafficLayer: true,
    superchargerLayer: true,
    routeProgress: 0.22
  },

  // 9. 副駕娛樂與全車音響聯動 (100% 原創虛構曲目與多場景動態短片)
  media: {
    activeTab: 'music',
    playing: true,
    volume: 64,
    effectiveVolume: 64,
    muted: false,
    eqPreset: 'immersive',
    trackIndex: 0,
    currentTime: 78,
    tracks: [
      {
        id: 't1',
        title: 'Midnight Cyber Drive',
        artist: 'Aether Synth Ensemble',
        album: 'Nocturnal Horizon',
        quality: '無損 192kHz',
        palette: ['#182238', '#0d1322', '#3e6ae1'],
        duration: 224,
        coverCode: 'NH-01',
        lyrics: [
          'Gliding along the bayshore bridge in quiet electric motion',
          'City reflections flowing across the panoramic glass canopy',
          'Adaptive cruise aligned with the illuminated lane ahead',
          'Harmonic balance tuned across the cabin acoustic array'
        ]
      },
      {
        id: 't2',
        title: 'Tokyo Skyline Reverie',
        artist: 'Nova Acoustic Lab',
        album: 'Metropolitan Light',
        quality: '全景空間音訊',
        palette: ['#1e1b36', '#0e101d', '#6366f1'],
        duration: 248,
        coverCode: 'ML-02',
        lyrics: [
          'Over the suspension bridge into the midnight skyline',
          'Warm strings and analog pads filling the silent interior',
          'Zero tailpipe emissions beneath the tower lights',
          'Steady momentum toward the central district'
        ]
      },
      {
        id: 't3',
        title: 'Orbital Horizon Drift',
        artist: 'Solaris Chamber Quartet',
        album: 'Beyond the Stratosphere',
        quality: '母帶 DSD',
        palette: ['#1c2430', '#0c1017', '#38bdf8'],
        duration: 256,
        coverCode: 'BS-03',
        lyrics: [
          'Weightless arpeggios suspended in deep orbital silence',
          'Telemetry locked with ground station coordinates',
          'Blue curvature of Earth glowing below the horizon',
          'Calm precision across every instrument channel'
        ]
      },
      {
        id: 't4',
        title: 'Coastal Cliff Breeze',
        artist: 'Kuroshio Ambient Trio',
        album: 'Pacific Morning',
        quality: '無損 96kHz',
        palette: ['#162936', '#0b141c', '#2dd4bf'],
        duration: 215,
        coverCode: 'PM-04',
        lyrics: [
          'Morning mist lifting above the coastal highway cliffs',
          'Regenerative braking harvesting energy on every descent',
          'Tri-zone heat pump maintaining a gentle cabin breeze',
          'Endless ocean views framed by frameless glass'
        ]
      },
      {
        id: 't5',
        title: 'Velocity Vector Study',
        artist: 'Chronos Modular Studio',
        album: 'Kinetic Equilibrium',
        quality: '無損 192kHz',
        palette: ['#1f242d', '#101318', '#3e6ae1'],
        duration: 272,
        coverCode: 'KE-05',
        lyrics: [
          'Aerodynamic silhouette slicing cleanly through the night air',
          'Real-time torque distribution across front and rear axles',
          'Air suspension leveling the chassis at highway speed',
          'Minimalist geometry in every acoustic transient'
        ]
      },
      {
        id: 't6',
        title: 'Rain on Acoustic Glass',
        artist: 'Lumen Piano Collective',
        album: 'Quiet Sanctuary',
        quality: '24-bit PCM',
        palette: ['#1a222c', '#0d1117', '#94a3b8'],
        duration: 238,
        coverCode: 'QS-06',
        lyrics: [
          'Raindrops tracing soft patterns across laminated glass',
          'Acoustic resonance echoing softly inside the cabin',
          'Crosswalk lights blurred through the evening drizzle',
          'Serene refuge amidst the moving city'
        ]
      },
      {
        id: 't7',
        title: 'High-Voltage Lounge',
        artist: 'Veloce Electronic Group',
        album: 'Station Interlude',
        quality: '全景空間音訊',
        palette: ['#17253b', '#0b121e', '#60a5fa'],
        duration: 196,
        coverCode: 'SI-07',
        lyrics: [
          'Direct current replenishing the structural battery pack',
          'Soft ambient chords drifting across reclined seats',
          'Thermal loop humming in quiet equilibrium',
          'Prepared for the next six hundred kilometers'
        ]
      },
      {
        id: 't8',
        title: 'Alpine Switchback Ascent',
        artist: 'Zephyr Electro-Acoustic',
        album: 'High Pass Sessions',
        quality: '無損 96kHz',
        palette: ['#1d2633', '#0e131a', '#818cf8'],
        duration: 264,
        coverCode: 'HP-08',
        lyrics: [
          'Ascending through snow-lined mountain switchbacks',
          'All-wheel traction holding every corner with composure',
          'Crisp alpine air purified through cabin filtration',
          'Summit ridge opening into a sea of clouds'
        ]
      },
      {
        id: 't9',
        title: 'Harmonic Drive No. 9',
        artist: 'Solstice Symphony Project',
        album: 'Analog & Silicon',
        quality: '母帶 DSD',
        palette: ['#182032', '#0a0e17', '#3e6ae1'],
        duration: 242,
        coverCode: 'AS-09',
        lyrics: [
          'Warm cello harmonics fused with clean digital synthesis',
          'Sub-bass aligned with the rhythm of expansion joints',
          'Silver bodywork gliding beneath amber tunnel lights',
          'Continuous motion along the coastal expressway'
        ]
      },
      {
        id: 't10',
        title: 'Quicksilver Nocturne',
        artist: 'Nocturne String Quartet',
        album: 'Late Night Return',
        quality: '無損母帶',
        palette: ['#20252e', '#0f1217', '#a5b4fc'],
        duration: 210,
        coverCode: 'LN-10',
        lyrics: [
          'Strings swelling gently as the downtown lights fade behind',
          'Matrix headlights carving a calm path through the dark',
          'Pinpoint studio imaging across every seating position',
          'Arriving home with seventy-nine percent reserve'
        ]
      }
    ],
    videoIndex: 0,
    videoPlaying: true,
    videoProgress: 42,
    videoSpeed: 1.0,
    videos: [
      { id: 'v1', title: '灣岸星軌：跨海大橋夜間巡航實錄', channel: 'Orbital Cinema Studio', duration: 312, resolution: '4K HDR 60fps', category: '城市夜駕短片', scene: 'bayshore', subtitleLine: '「跨海大橋雙塔在夜色中展開，車道光軌平順延伸至海灣對岸…」' },
      { id: 'v2', title: '極地極光與冰川峽灣光學探索紀實', channel: 'Nordic Nature Film', duration: 485, resolution: '4K HDR', category: '自然地理紀錄', scene: 'aurora', subtitleLine: '「北極圈高空粒子流在冰原公路上方交織出流動的翠綠光幕…」' },
      { id: 'v3', title: '阿爾卑斯山脈冬季極寒穿越挑戰', channel: 'Alpine Grand Tour', duration: 620, resolution: '4K 60fps', category: '長途公路紀實', scene: 'alpine', subtitleLine: '「在零下 18°C 的高海拔山口，八通閥熱泵系統持續回收餘熱維持電池活性…」' },
      { id: 'v4', title: '高密度結構電池包熱流場微觀模擬', channel: 'Energy Lab Visuals', duration: 410, resolution: '4K HDR', category: '工程科學視覺', scene: 'battery', subtitleLine: '「三維液冷板在 250kW 直流快充峰值下保持整包溫差小於 1.5°C…」' },
      { id: 'v5', title: 'Model S 空氣動力學層流與風洞實測', channel: 'Aero Dynamics Lab', duration: 358, resolution: '4K 60fps', category: '空氣動力測試', scene: 'windtunnel', subtitleLine: '「0.208 Cd 超低風阻係數配合主動式氣壓懸吊，在高速巡航時自動降低車身…」' },
      { id: 'v6', title: '東京六本木至箱根蘆之湖晨霧漫遊', channel: 'Archipelago Road Journal', duration: 540, resolution: '4K HDR', category: '公路旅行短片', scene: 'hakone', subtitleLine: '「清晨從港區出發沿高速駛向箱根山道，遠眺富士山與蘆之湖波光…」' },
      { id: 'v7', title: '仿生機械靈巧手與動態平衡控制實錄', channel: 'Kinematics Research', duration: 394, resolution: '4K 60fps', category: '精密工程短片', scene: 'robotics', subtitleLine: '「多自由度關節搭載陣列觸覺感測，實現毫米級軌跡規劃與平衡控制…」' },
      { id: 'v8', title: '座艙無界聲學穹頂與主動降噪幕後', channel: 'Acoustic Design Group', duration: 325, resolution: '4K HDR', category: '聲學工程特輯', scene: 'acoustics', subtitleLine: '「針對雙層夾膠玻璃反射特性，22 顆揚聲器單體均經過獨立相位校正…」' }
    ],
    game: {
      running: true,
      score: 1480,
      highScore: 4850,
      playerLane: 1,
      boostActive: false
    }
  },

  // 10. 手機 App 與中控補齊功能專屬資料
  trips: {
    odometerKm: 14820,
    tripAKm: 342.6,
    tripAWhKm: 151,
    recent: [
      { id: 'tr-1', title: '丸之內 → 六本木新城', date: '今日 19:20', distKm: 18.4, durationMin: 26, avgWhKm: 149 },
      { id: 'tr-2', title: '代官山 → 港區南青山', date: '昨日 21:10', distKm: 9.2, durationMin: 17, avgWhKm: 141 },
      { id: 'tr-3', title: '東京港區 → 箱根蘆之湖', date: '10月12日', distKm: 94.6, durationMin: 82, avgWhKm: 158 }
    ]
  },
  keys: {
    walkAwayLock: true,
    unlatchOnPark: true,
    childLock: true,
    list: [
      { id: 'k-1', name: '車主 iPhone 16 Pro', type: 'UWB 超寬頻', role: '主駕鑰匙', status: '已連線', active: true },
      { id: 'k-2', name: 'Apple Watch Ultra', type: '藍牙手錶', role: '隨身鑰匙', status: '已連線', active: true },
      { id: 'k-3', name: 'NFC 鈦金屬實體卡', type: 'B 柱感應卡', role: '備用鑰匙', status: '已啟用', active: true }
    ]
  },
  software: {
    currentVersion: 'v12.8.4 (2026.36)',
    availableVersion: 'v12.9.0 (2026.40)',
    updating: false,
    progress: 0,
    releaseNotes: [
      '17 吋向日葵中控屏主駕傾角記憶',
      '8:3 儀錶盤能耗曲線平滑演算法',
      '360° 環視相機夜間低照度增強'
    ]
  },
  service: {
    centerName: '東京港區芝公園直營服務中心',
    appointmentDate: '2026-10-28 14:00',
    status: '已確認預約',
    wiperServiceMode: false,
    towMode: false,
    items: [
      { id: 'srv-1', name: '四輪定位與氣壓懸吊行程校準', estimate: '約 45 分鐘', selected: true },
      { id: 'srv-2', name: 'HEPA 生物防禦空調濾網更換', estimate: '約 20 分鐘', selected: true },
      { id: 'srv-3', name: '制動液含水量與卡鉗檢測', estimate: '約 30 分鐘', selected: false }
    ]
  },
  phone: {
    connectedDevice: '車主 iPhone 16 Pro · 藍牙無損音訊',
    activeCall: null,
    contacts: [
      { id: 'c-1', name: '佐藤 健太', role: '建築設計合夥人', number: '+81 90-3842-1920' },
      { id: 'c-2', name: '高橋 葵', role: '芝公園服務顧問', number: '+81 3-5482-7700' },
      { id: 'c-3', name: '林 雅人', role: '聲學實驗室總監', number: '+81 80-6192-4410' }
    ],
    recentCalls: [
      { id: 'rc-1', name: '佐藤 健太', type: '撥出電話', duration: '04:18', time: '18:05' },
      { id: 'rc-2', name: '高橋 葵', type: '來電通話', duration: '02:10', time: '昨日' },
      { id: 'rc-3', name: '林 雅人', type: '撥出電話', duration: '08:45', time: '週二' }
    ]
  },
  camera360: {
    activeView: 'surround'
  },
  voice: {
    listening: false,
    lastCommand: '導航至六本木新城超充站',
    lastReply: '已為您設定導航至六本木新城超充站，最快路線預計 11 分鐘。',
    suggestions: [
      '導航至六本木新城超充站',
      '將主副駕空調溫度調至 21 度',
      '打開前備箱',
      '播放極光合成器樂團音樂'
    ]
  },

  // 11. 環境光照、天氣與 17 吋中控屏傾斜狀態
  environment: {
    timeOfDay: 'night',
    weather: 'clear',
    screenBrightness: 92,
    centerTilt: 'driver'
  },

  // 12. 系統與演示控制面板專屬狀態
  system: {
    focusedScreen: 'overview',
    centerActiveModal: null,
    settingsTab: 'display',
    mobileActivePage: 'home',
    controlStateOverride: 'normal',
    loadingControls: {},
    toastMessage: null,
    toastType: 'info',
    showDesignDoc: false,
    showChecklistModal: false,
    fps: 60
  }
};

class VehicleStore {
  constructor() {
    this.state = structuredClone(INITIAL_STATE);
    this.listeners = new Set();
    this.channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tesla_model_s_hmi_sync_v3') : null;

    if (this.channel) {
      this.channel.onmessage = (event) => {
        if (event.data && event.data.type === 'STATE_SYNC') {
          this.applyPatch(event.data.patch, false);
        }
      };
    }

    this.lastTick = performance.now();
    this.blinkAccum = 0;
    this.navAccum = 0;
    this.energyAccum = 0;
    this.recomputeDerivedState();
    this.startSimulationLoop();
  }

  getState() {
    return this.state;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(changedPaths = []) {
    for (const listener of this.listeners) {
      try {
        listener(this.state, changedPaths);
      } catch (err) {
        console.error('[VehicleStore] Listener error:', err);
      }
    }
  }

  triggerControlAction(controlId, actionFn, delayMs = 120) {
    if (this.state.system.controlStateOverride === 'disabled') {
      this.showToast('當前處於「禁用態」演示模式，操作已鎖定', 'warn');
      return;
    }
    this.state.system.loadingControls[controlId] = true;
    this.notify(['system.loadingControls']);
    setTimeout(() => {
      delete this.state.system.loadingControls[controlId];
      actionFn();
      this.notify(['system.loadingControls']);
    }, delayMs);
  }

  showToast(message, type = 'info') {
    this.state.system.toastMessage = message;
    this.state.system.toastType = type;
    this.notify(['system.toast']);
    if (this._toastTimeout) clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      this.state.system.toastMessage = null;
      this.notify(['system.toast']);
    }, 3000);
  }

  update(updater, broadcast = true) {
    if (typeof updater === 'function') {
      updater(this.state);
    } else if (updater && typeof updater === 'object') {
      this.deepMerge(this.state, updater);
    }
    this.recomputeDerivedState();
    this.notify();

    if (broadcast && this.channel && typeof updater === 'object') {
      this.channel.postMessage({ type: 'STATE_SYNC', patch: updater });
    }
  }

  applyPatch(patch, broadcast = false) {
    this.deepMerge(this.state, patch);
    this.recomputeDerivedState();
    this.notify();
    if (broadcast && this.channel) {
      this.channel.postMessage({ type: 'STATE_SYNC', patch });
    }
  }

  deepMerge(target, source) {
    for (const key of Object.keys(source)) {
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] &&
        typeof target[key] === 'object'
      ) {
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  recomputeDerivedState() {
    const s = this.state;

    if (s.charging.active) {
      s.gear = 'P';
      s.speed = 0;
      s.displaySpeed = 0;
      s.doors.chargePort = true;
      s.charging.pluggedIn = true;
      s.charging.powerKw = 215;
      s.charging.currentAmps = 535;
    } else {
      s.charging.powerKw = 0;
      s.charging.currentAmps = 0;
    }

    if (s.gear !== 'P') {
      // 非 P 擋行駛時強制「未上鎖」且不顯示哨兵
      s.locked = false;
      s.sentryMode = false;
      if (s.gear === 'N') {
        s.speed = 0;
      } else if (s.gear === 'R' && s.speed > 24) {
        s.speed = 16;
      }
    } else {
      // P 擋駐停時速度必為 0
      s.speed = 0;
      if (s.locked) {
        s.displaySpeed = 0;
      }
    }

    if (s.lights.mode === 'auto') {
      const needLights = s.environment.timeOfDay === 'night' || s.environment.weather === 'rain' || s.environment.weather === 'snow';
      s.lights.lowBeam = needLights;
      s.lights.drl = true;
    } else if (s.lights.mode === 'on') {
      s.lights.lowBeam = true;
      s.lights.drl = true;
    } else if (s.lights.mode === 'parking') {
      s.lights.lowBeam = false;
      s.lights.drl = true;
    } else {
      s.lights.lowBeam = false;
      s.lights.highBeam = false;
      s.lights.drl = false;
    }

    if (s.wipers.mode === 'auto') {
      if (s.environment.weather === 'rain') {
        s.wipers.effectiveLevel = 3;
      } else if (s.environment.weather === 'snow') {
        s.wipers.effectiveLevel = 2;
      } else {
        s.wipers.effectiveLevel = 0;
      }
    } else if (s.wipers.mode === 'off') {
      s.wipers.effectiveLevel = 0;
    } else {
      const mapLvl = { I: 1, II: 2, III: 3 };
      s.wipers.effectiveLevel = mapLvl[s.wipers.mode] || parseInt(s.wipers.mode, 10) || 1;
    }

    const baseVol = s.media.muted ? 0 : s.media.volume;
    s.media.effectiveVolume = (s.navigation.voiceSpeaking && s.navigation.voiceGuidance)
      ? Math.round(baseVol * 0.32)
      : baseVol;
  }

  getEstimatedRangeKm() {
    const s = this.state;
    const modeFactor = s.driveMode.accel === 'chill' ? 1.03 : (s.driveMode.accel === 'sport' ? 0.94 : 1.0);
    return Math.round((s.displaySoc / 100) * s.ratedFullRangeKm * modeFactor);
  }

  getTurnDirectionLabel() {
    const street = this.state.navigation.nextTurnStreet || '';
    if (street.includes('左轉')) return '左轉';
    if (street.includes('右轉')) return '右轉';
    const dir = this.state.navigation.nextTurnDirection;
    if (dir === 'left') return '左轉';
    return '右轉';
  }

  getTurnIconName() {
    return this.getTurnDirectionLabel() === '左轉' ? 'turnLeft' : 'turnRight';
  }

  hasOpenDoorOrTrunk() {
    const d = this.state.doors;
    return d.fl || d.fr || d.rl || d.rr || d.frunk || d.trunk || d.chargePort;
  }

  setGear(targetGear) {
    const s = this.state;
    if (s.charging.active && targetGear !== 'P') {
      this.showToast('正在快充中，請先停止充電再切換擋位', 'warn');
      return false;
    }
    this.update((st) => {
      const prevGear = st.gear;
      st.gear = targetGear;
      if (targetGear === 'P') {
        st.speed = 0;
        st.displaySpeed = 0;
        st.braking = true;
      } else if (targetGear === 'N') {
        st.speed = 0;
        st.displaySpeed = 0;
        st.locked = false;
        st.sentryMode = false;
      } else if (targetGear === 'R') {
        st.locked = false;
        st.sentryMode = false;
        st.speed = prevGear === 'R' ? st.speed : 12;
      } else if (targetGear === 'D') {
        st.locked = false;
        st.sentryMode = false;
        if (st.speed === 0) st.speed = 68;
        if (st.doors.frunk || st.doors.trunk || st.doors.chargePort) {
          st.doors.frunk = false;
          st.doors.trunk = false;
          st.doors.chargePort = false;
          this.showToast('已掛入 D 擋行駛，前備箱、尾箱與充電口已自動閉合', 'info');
        }
      }
    });
    return true;
  }

  selectDestination(destId, fromMobile = false) {
    const d = DESTINATIONS_CATALOG.find((item) => item.id === destId);
    if (!d) return;
    this.update((st) => {
      st.navigation.active = true;
      st.navigation.destinationId = d.id;
      st.navigation.destinationName = d.name;
      st.navigation.destinationAddress = d.area;
      st.navigation.etaMinutes = d.etaMin;
      st.navigation.remainingKm = d.distKm;
      st.navigation.arrivalSoc = d.arrivalSoc;
      st.navigation.nextTurnDistanceM = d.nextTurnDistanceM;
      st.navigation.nextTurnDirection = d.nextTurnDirection;
      st.navigation.nextTurnStreet = d.nextTurnStreet;
      st.navigation.routeProgress = 0.14;
    });
    this.showToast(
      fromMobile ? `已從手機發送目的地至車機：「${d.name}」` : `已切換導航目的地：「${d.name}」`,
      'info'
    );
  }

  toggleDoor(partKey) {
    const partNames = {
      fl: '左前車門',
      fr: '右前車門',
      rl: '左後車門',
      rr: '右後車門',
      frunk: '前備箱',
      trunk: '電動尾箱',
      chargePort: '充電口蓋'
    };
    this.update((st) => {
      const nextVal = !st.doors[partKey];
      st.doors[partKey] = nextVal;
      if (nextVal && st.locked && partKey !== 'chargePort') {
        st.locked = false;
      }
      if (!nextVal && partKey === 'chargePort' && st.charging.active) {
        st.charging.active = false;
        st.charging.pluggedIn = false;
      }
      const label = partNames[partKey] || partKey;
      this.showToast(`${label}已${nextVal ? '開啟' : '關閉'}`, 'info');
    });
    return true;
  }

  triggerFindMyCar() {
    this.update((st) => {
      st.findMyCarActive = true;
      st.lights.hazard = true;
      st.lights.highBeam = true;
    });
    this.showToast('遠程尋車：已觸發雙閃燈與定位提示音', 'info');
    if (this._findCarTimer) clearTimeout(this._findCarTimer);
    this._findCarTimer = setTimeout(() => {
      this.update((st) => {
        st.findMyCarActive = false;
        st.lights.hazard = false;
        st.lights.highBeam = false;
      });
    }, 4000);
  }

  triggerNavVoicePrompt() {
    const dirLabel = this.getTurnDirectionLabel();
    this.update((st) => {
      st.navigation.voiceSpeaking = true;
    });
    this.showToast(`導航播報：「前方 ${Math.round(this.state.navigation.nextTurnDistanceM)} 公尺請${dirLabel}」— 媒體音量已自動壓低`, 'info');
    if (this._navVoiceTimer) clearTimeout(this._navVoiceTimer);
    this._navVoiceTimer = setTimeout(() => {
      this.update((st) => {
        st.navigation.voiceSpeaking = false;
      });
    }, 3400);
  }

  triggerSoftwareUpdate() {
    if (this.state.software.updating) return;
    this.update((st) => {
      st.software.updating = true;
      st.software.progress = 15;
    });
    this.showToast('正在下載並安裝座艙系統更新 v12.9.0...', 'info');
    if (this._swTimer) clearInterval(this._swTimer);
    this._swTimer = setInterval(() => {
      this.update((st) => {
        st.software.progress += 25;
        if (st.software.progress >= 100) {
          st.software.progress = 100;
          st.software.updating = false;
          st.software.currentVersion = st.software.availableVersion;
          clearInterval(this._swTimer);
          this.showToast('系統已成功更新至 v12.9.0 (2026.40)', 'info');
        }
      });
    }, 450);
  }

  startSimulationLoop() {
    const step = (now) => {
      const dt = Math.min((now - this.lastTick) / 1000, 0.1);
      this.lastTick = now;
      const s = this.state;
      let uiNeedsRefresh = false;

      if (s.gear === 'P' || s.gear === 'N') {
        s.speed = 0;
        s.displaySpeed = 0;
      } else {
        const speedDiff = s.speed - s.displaySpeed;
        if (Math.abs(speedDiff) > 0.05) {
          s.displaySpeed += speedDiff * Math.min(1, dt * 6.5);
          uiNeedsRefresh = true;
        } else if (s.displaySpeed !== s.speed) {
          s.displaySpeed = s.speed;
          uiNeedsRefresh = true;
        }
      }

      const accelFactor = s.driveMode.accel === 'sport' ? 1.45 : (s.driveMode.accel === 'chill' ? 0.68 : 1.0);
      const regenStrength = s.driveMode.regen === 'standard' ? 1.0 : 0.45;
      const speedDiff = s.speed - s.displaySpeed;
      if (s.gear === 'P' || s.gear === 'N') {
        s.powerKw = s.climate.power ? 1.5 : 0.3;
        s.braking = s.gear === 'P';
      } else if (speedDiff < -1.2) {
        s.powerKw = Math.max(-85, speedDiff * 5.2 * regenStrength);
        s.braking = speedDiff < -3.0 || s.displaySpeed < 2;
      } else if (speedDiff > 1.2) {
        s.powerKw = Math.min(320, (18 + s.displaySpeed * 0.35 + speedDiff * 7.8) * accelFactor);
        s.braking = false;
      } else {
        const cruiseKw = s.displaySpeed > 0.5
          ? (6 + Math.pow(s.displaySpeed / 36, 2.1) * 4.5 + Math.sin(now * 0.002) * 2.2)
          : 0.8;
        s.powerKw = cruiseKw;
        s.braking = s.displaySpeed < 0.5;
      }

      const powerDiff = s.powerKw - s.displayPowerKw;
      if (Math.abs(powerDiff) > 0.1) {
        s.displayPowerKw += powerDiff * Math.min(1, dt * 8.0);
        uiNeedsRefresh = true;
      }

      if (s.charging.active && s.batterySoc < s.charging.limitSoc) {
        s.batterySoc = Math.min(s.charging.limitSoc, s.batterySoc + dt * 0.35);
      }
      const socDiff = s.batterySoc - s.displaySoc;
      if (Math.abs(socDiff) > 0.02) {
        s.displaySoc += socDiff * Math.min(1, dt * 5.0);
        uiNeedsRefresh = true;
      } else {
        s.displaySoc = s.batterySoc;
      }

      for (const key of Object.keys(s.doors)) {
        const target = s.doors[key] ? 1.0 : 0.0;
        const curr = s.doorProgress[key];
        if (Math.abs(target - curr) > 0.002) {
          s.doorProgress[key] += (target - curr) * Math.min(1, dt * 8.5);
          if (Math.abs(target - s.doorProgress[key]) < 0.005) {
            s.doorProgress[key] = target;
          }
        }
      }

      const turnActive = s.lights.turnSignal !== 'off' || s.lights.hazard || s.findMyCarActive;
      if (turnActive) {
        this.blinkAccum += dt;
        if (this.blinkAccum >= 0.38) {
          this.blinkAccum = 0;
          s.lights.blinkPhase = !s.lights.blinkPhase;
          uiNeedsRefresh = true;
        }
      } else if (s.lights.blinkPhase) {
        s.lights.blinkPhase = false;
        uiNeedsRefresh = true;
      }

      if (s.displaySpeed > 1 && s.gear === 'D') {
        s.roadCurvature = Math.sin(now * 0.00045) * 0.32;
        s.steeringAngle = s.roadCurvature * 38;

        const mps = s.displaySpeed / 3.6;
        s.navigation.nextTurnDistanceM -= mps * dt * 0.45;
        if (s.navigation.nextTurnDistanceM <= 15) {
          s.navigation.nextTurnDistanceM = 280;
          s.navigation.routeProgress = (s.navigation.routeProgress + 0.14) % 0.92;
        }
        s.navigation.remainingKm = Math.max(0.4, s.navigation.remainingKm - (mps * dt) / 1000);

        const targetLeadDist = 14 + s.driveMode.followDistanceLevel * 4.5 + Math.sin(now * 0.0012) * 3.5;
        s.driveMode.displayLeadDistanceM += (targetLeadDist - s.driveMode.displayLeadDistanceM) * Math.min(1, dt * 3.0);
        s.driveMode.forwardCollisionWarn = s.driveMode.displayLeadDistanceM < 15.5 && s.displaySpeed > 45;

        // 持續更新 30 點實時能耗曲線 (Wh/km)
        this.energyAccum += dt;
        if (this.energyAccum >= 0.45) {
          this.energyAccum = 0;
          const instantWhKm = Math.round(Math.max(-55, Math.min(310, 138 + s.displayPowerKw * 1.45)));
          s.energyHistory.push(instantWhKm);
          if (s.energyHistory.length > 30) s.energyHistory.shift();
          uiNeedsRefresh = true;
        }
      } else {
        s.roadCurvature *= 0.92;
        s.steeringAngle *= 0.92;
        s.driveMode.forwardCollisionWarn = false;
      }

      if (s.media.playing && s.media.activeTab === 'music') {
        const activeTrack = s.media.tracks[s.media.trackIndex] || s.media.tracks[0];
        s.media.currentTime += dt;
        if (s.media.currentTime >= activeTrack.duration) {
          s.media.currentTime = 0;
          s.media.trackIndex = (s.media.trackIndex + 1) % s.media.tracks.length;
          uiNeedsRefresh = true;
        }
      }

      this.navAccum += dt;
      if (this.navAccum >= 0.12 || uiNeedsRefresh) {
        this.navAccum = 0;
        this.notify(['telemetry']);
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }
}

export const vehicleStore = new VehicleStore();
