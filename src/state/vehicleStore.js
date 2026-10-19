/**
 * TESLA MODEL 3 COCKPIT HMI — CENTRAL REACTIVE VEHICLE STATE STORE
 * 五端共用唯一真相數據源
 * 嚴格自洽邏輯：
 * 1. 非 P 擋行駛時強制未上鎖 (locked = false) 且不開啟哨兵 (sentryMode = false)
 * 2. 駐停上鎖時強制掛入 P 擋且車速歸 0 (speed = 0, displaySpeed = 0)
 * 3. 轉向方向、圖標、距離、目的地、預計時間與娛樂音量在五端同一時刻 100% 同步
 * 4. 全界面統一採用自然中文、原創中文曲目與中文歌詞、明顯虛構電話號碼 (000-xxxx-xxxx)
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
  // 0. 車型與座艙硬體配置 (如實對應實際 3D 資產 Tesla Model 3)
  modelName: 'Model 3',
  vehicleModel: 'Model 3',
  vehicleTrim: '雙電機全輪驅動長續航版',
  vin: '5YJ3E1EB9PF482910',

  // 1. 核心動力與行駛狀態 (初始為 D 擋行駛，因此 locked 必為 false、sentryMode 必為 false)
  speed: 68,
  displaySpeed: 68,
  gear: 'D',
  powerKw: 24,
  displayPowerKw: 24,
  batterySoc: 82,
  displaySoc: 82,
  ratedFullRangeKm: 614,
  braking: false,
  steeringAngle: 0,
  roadCurvature: 0.0,
  // 具備明顯起伏波峰與動能回收波谷的實時能耗序列 (Wh/km)
  energyHistory: [
    165, 204, 236, 188, 126, 84, 118, 182, 244, 216,
    148, 76, 28, -22, 64, 152, 218, 242, 190, 118,
    82, 136, 198, 234, 172, 104, 68, 132, 186, 156
  ],
  avgConsumptionWhKm: 148,

  // 2. 車身鎖止與安全防護狀態
  locked: false,
  sentryMode: false,
  sentryCameraDetect: true,
  valetMode: false,
  speedLimitMode: false,
  speedLimitMaxKmh: 110,
  pinToDrive: true,
  gloveboxPin: false,
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
    maxCurrentAmps: 48,
    powerKw: 0,
    voltage: 402,
    currentAmps: 0,
    timeRemainingMin: 18,
    superchargerName: '六本木新城超充站',
    powerCurve: [75, 165, 242, 250, 248, 215, 172, 128, 86, 48, 22],
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
    fanSpeed: 5,
    auto: true,
    ac: true,
    recirculate: true,
    ventDir: 'face-feet',
    defrostFront: false,
    defrostRear: false,
    seatHeatLeft: 2,
    seatHeatRight: 1,
    seatHeatRear: 0,
    steeringWheelHeat: true,
    overheatProtection: 'on',
    bioweaponDefense: false,
    cabinTemp: 22.0,
    exteriorTemp: 17.5,
    preconditioning: false,
    mode: 'off',
    scheduledDeparture: {
      enabled: true,
      time: '08:15',
      preconditionCabin: true,
      preheatBattery: true,
      offPeakCharging: true,
      offPeakEnd: '06:00',
      weekdaysOnly: true,
      locationAware: true
    }
  },

  // 5. 車燈與雨刮
  lights: {
    mode: 'auto',
    lowBeam: true,
    highBeam: false,
    autoHighBeam: true,
    fogFront: false,
    fogRear: false,
    drl: true,
    ambient: true,
    ambientBrightness: 80,
    wheelBacklight: true,
    headlightDelay: true,
    domeLight: 'auto',
    turnSignal: 'off',
    hazard: false,
    blinkPhase: false
  },
  wipers: {
    mode: 'auto',
    rainSensorBoost: true,
    effectiveLevel: 0
  },

  // 6. 駕駛與輔助駕駛狀態
  driveMode: {
    accel: 'standard',
    steering: 'standard',
    regen: 'standard',
    stoppingMode: 'hold',
    slipStart: false,
    autopilot: true,
    navOnAutopilot: true,
    autoLaneChange: 'confirm',
    setSpeed: 80,
    speedLimit: 80,
    followDistanceLevel: 3,
    leadCarDistanceM: 28.0,
    displayLeadDistanceM: 28.0,
    laneDepartureWarn: false,
    blindSpotCamera: true,
    blindSpotChime: true,
    forwardCollisionWarn: false,
    fcwSensitivity: 'medium',
    aebEnabled: true,
    obstacleAwareAccel: true,
    dashcamAuto: true,
    cabinRadar: true
  },

  // 7. 四輪胎壓監測
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

  // 9. 副駕娛樂與全車音響聯動 (100% 中文曲目、中文歌詞、多場景短片與真實可玩街機)
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
        title: '午夜灣岸巡航',
        artist: '極光合成器樂團',
        album: '夜行地平線',
        quality: '無損母帶',
        palette: ['#182238', '#0d1322', '#3e6ae1'],
        duration: 224,
        coverCode: '一輯',
        lyrics: [
          '靜謐電流掠過跨海大橋的夜色波光',
          '城市霓虹在全景玻璃天幕上緩緩流淌',
          '智慧領航沿著發光車道平順前行',
          '二十二顆揚聲器共鳴出溫暖的夜間音場'
        ]
      },
      {
        id: 't2',
        title: '東京天際線幻想',
        artist: '新星聲學實驗室',
        album: '都會流光',
        quality: '全景空間音訊',
        palette: ['#1e1b36', '#0e101d', '#6366f1'],
        duration: 248,
        coverCode: '二輯',
        lyrics: [
          '穿越懸索橋塔駛入閃耀的港區天際線',
          '溫暖弦樂與合成音色填滿靜謐座艙',
          '零排放的純電脈動在塔樓燈影下延伸',
          '向著都心環狀線穩定巡航'
        ]
      },
      {
        id: 't3',
        title: '星軌漫遊序曲',
        artist: '天琴室內四重奏',
        album: '平流層彼端',
        quality: '高解析母帶',
        palette: ['#1c2430', '#0c1017', '#38bdf8'],
        duration: 256,
        coverCode: '三輯',
        lyrics: [
          '失重般的分解和弦懸浮在深邃夜空',
          '遙測座標與地面導航信標精準同步',
          '地平線在擋風玻璃前方泛起微藍晨光',
          '每一道聲部都保持著沉著與平衡'
        ]
      },
      {
        id: 't4',
        title: '海岸懸崖微風',
        artist: '黑潮環境音樂三重奏',
        album: '太平洋清晨',
        quality: '無損音質',
        palette: ['#162936', '#0b141c', '#2dd4bf'],
        duration: 215,
        coverCode: '四輯',
        lyrics: [
          '晨霧在海岸公路的懸崖邊輕輕升起',
          '下坡動能回收將每一次減速化為續航',
          '熱泵恆溫系統送來清晨般的柔和微風',
          '無框車窗外展開一望無際的蔚藍海面'
        ]
      },
      {
        id: 't5',
        title: '向量動能練習曲',
        artist: '時光模組工作室',
        album: '動態平衡',
        quality: '無損母帶',
        palette: ['#1f242d', '#101318', '#3e6ae1'],
        duration: 272,
        coverCode: '五輯',
        lyrics: [
          '低風阻流線車身俐落劃開夜間氣流',
          '前後雙電機即時分配每一分扭力輸出',
          '高速巡航下的底盤維持著沉穩姿態',
          '極簡幾何線條融入每一處聲學細節'
        ]
      },
      {
        id: 't6',
        title: '雨落雙層靜音玻璃',
        artist: '微光鋼琴合奏團',
        album: '靜謐庇護所',
        quality: '高解析音質',
        palette: ['#1a222c', '#0d1117', '#94a3b8'],
        duration: 238,
        coverCode: '六輯',
        lyrics: [
          '細密雨滴在雙層夾膠玻璃上畫出柔光',
          '鋼琴泛音在寧靜的車廂內輕柔迴盪',
          '路口燈號在雨幕中化作柔和的琥珀色光斑',
          '在流動的都市中心守護一方安寧'
        ]
      },
      {
        id: 't7',
        title: '超充驛站夜曲',
        artist: '疾風電子樂團',
        album: '能量間奏',
        quality: '全景空間音訊',
        palette: ['#17253b', '#0b121e', '#60a5fa'],
        duration: 196,
        coverCode: '七輯',
        lyrics: [
          '高壓直流電正快速補充結構電池能量',
          '舒緩環境和弦伴隨斜倚座椅放鬆身心',
          '液冷熱管理迴路在靜謐中維持最佳溫場',
          '準備迎接下一段六百公里的長途旅程'
        ]
      },
      {
        id: 't8',
        title: '高山髮夾彎攀升',
        artist: '西風電聲樂團',
        album: '山口現場錄音',
        quality: '無損音質',
        palette: ['#1d2633', '#0e131a', '#818cf8'],
        duration: 264,
        coverCode: '八輯',
        lyrics: [
          '沿著白雪覆蓋的高山連續彎道穩步攀升',
          '全輪驅動系統在每個彎心牢牢抓住地面',
          '雙重過濾系統將凜冽山風化為清新空氣',
          '翻越山脊後在雲海之上豁然開朗'
        ]
      },
      {
        id: 't9',
        title: '九號諧波巡航',
        artist: '至日交響計畫',
        album: '類比與矽晶',
        quality: '高解析母帶',
        palette: ['#182032', '#0a0e17', '#3e6ae1'],
        duration: 242,
        coverCode: '九輯',
        lyrics: [
          '溫暖大提琴共鳴與純淨數位合成交織',
          '重低音律動與高架橋伸縮縫節拍相合',
          '銀灰車身滑過琥珀色的海底隧道燈帶',
          '沿著海濱高速一路向前不曾停歇'
        ]
      },
      {
        id: 't10',
        title: '流銀夜色小夜曲',
        artist: '夜曲弦樂四重奏',
        album: '深夜歸途',
        quality: '無損母帶',
        palette: ['#20252e', '#0f1217', '#a5b4fc'],
        duration: 210,
        coverCode: '十輯',
        lyrics: [
          '當繁華街區的燈火在後視鏡中漸漸遠去',
          '矩陣頭燈在夜色中鋪開一束平靜光芒',
          '每個座位都沉浸在精準平衡的立體音場',
          '帶著充裕電量安然返抵溫暖家門'
        ]
      }
    ],
    videoIndex: 0,
    videoPlaying: true,
    videoProgress: 42,
    videoSpeed: 1.0,
    videos: [
      { id: 'v1', title: '灣岸星軌：跨海大橋夜間巡航實錄', channel: '星軌影像工作室', duration: 312, resolution: '超高清畫質', category: '城市夜駕短片', scene: 'bayshore', subtitleLine: '「跨海大橋雙塔在夜色中展開，車道光軌平順延伸至海灣對岸…」' },
      { id: 'v2', title: '極地極光與冰川峽灣光學探索紀實', channel: '北歐自然影像', duration: 485, resolution: '高動態範圍', category: '自然地理紀錄', scene: 'aurora', subtitleLine: '「北極圈高空粒子流在冰原公路上方交織出流動的翠綠光幕…」' },
      { id: 'v3', title: '阿爾卑斯山脈冬季極寒穿越挑戰', channel: '高山公路紀實', duration: 620, resolution: '超高清畫質', category: '長途公路紀實', scene: 'alpine', subtitleLine: '「在零下 18°C 的高海拔山口，八通閥熱泵系統持續回收餘熱維持電池活性…」' },
      { id: 'v4', title: '高密度結構電池包熱流場微觀模擬', channel: '三電工程視覺', duration: 410, resolution: '高動態範圍', category: '工程科學視覺', scene: 'battery', subtitleLine: '「三維液冷板在 250kW 直流快充峰值下保持整包溫差小於 1.5°C…」' },
      { id: 'v5', title: 'Model 3 空氣動力學層流與風洞實測', channel: '空氣動力實驗室', duration: 358, resolution: '超高清畫質', category: '空氣動力測試', scene: 'windtunnel', subtitleLine: '「超低風阻車身配合主動式氣流導引，在高速巡航時顯著降低風噪與能耗…」' },
      { id: 'v6', title: '東京六本木至箱根蘆之湖晨霧漫遊', channel: '列島公路日誌', duration: 540, resolution: '高動態範圍', category: '公路旅行短片', scene: 'hakone', subtitleLine: '「清晨從港區出發沿高速駛向箱根山道，遠眺富士山與蘆之湖波光…」' },
      { id: 'v7', title: '仿生機械靈巧手與動態平衡控制實錄', channel: '精密運動控制中心', duration: 394, resolution: '超高清畫質', category: '精密工程短片', scene: 'robotics', subtitleLine: '「多自由度關節搭載陣列觸覺感測，實現毫米級軌跡規劃與平衡控制…」' },
      { id: 'v8', title: '座艙無界聲學穹頂與主動降噪幕後', channel: '聲學設計中心', duration: 325, resolution: '高動態範圍', category: '聲學工程特輯', scene: 'acoustics', subtitleLine: '「針對雙層夾膠玻璃反射特性，全車揚聲器單體均經過獨立相位校正…」' }
    ],
    game: {
      running: true,
      score: 1480,
      highScore: 4850,
      playerLane: 1,
      boostActive: false,
      currentSpeedKmh: 218,
      baseSpeedKmh: 210,
      combo: 3,
      collisionFlash: 0,
      pickupFlash: 0,
      lastEvent: '連續無碰撞巡航 ×3',
      stageIndex: 0,
      stages: [
        { code: '一區', name: '都心環狀線 · 夜間巡航', sub: 'Model 3 雙電機 · 實時競速', dur: '1:18.4', speedKmh: 246, sky: '#090d16', road: '#181e29', accent: '#3e6ae1' },
        { code: '二區', name: '澀谷穿越道 · 霓虹衝刺', sub: 'Model 3 運動版 · 城市峽谷賽段', dur: '0:54.2', speedKmh: 228, sky: '#140c24', road: '#1b162a', accent: '#818cf8' },
        { code: '三區', name: '跨海大橋 · 灣岸長直線', sub: '長續航組別 · 極速巡航賽段', dur: '1:32.8', speedKmh: 288, sky: '#071320', road: '#132030', accent: '#38bdf8' },
        { code: '四區', name: '六本木隧道 · 聲學迴廊', sub: 'Model 3 雙電機 · 地下高速隧道', dur: '1:05.1', speedKmh: 254, sky: '#16110c', road: '#211c17', accent: '#f59e0b' },
        { code: '五區', name: '代官山連續彎 · 乾地計時', sub: '運動懸吊組 · 複合彎道挑戰', dur: '0:49.7', speedKmh: 212, sky: '#081818', road: '#132224', accent: '#2dd4bf' },
        { code: '六區', name: '新宿西口高架 · 智駕領航', sub: '全電概念組 · 立體匝道穿越', dur: '1:11.6', speedKmh: 238, sky: '#0d1324', road: '#171f32', accent: '#60a5fa' },
        { code: '七區', name: '台場海濱大道 · 電能全開', sub: 'Model 3 雙電機 · 海濱直線衝刺', dur: '1:24.0', speedKmh: 276, sky: '#071622', road: '#142230', accent: '#34d399' },
        { code: '八區', name: '皇居外苑環線 · 決賽圈', sub: 'Model 3 運動版 · 終極排位賽', dur: '1:15.9', speedKmh: 262, sky: '#160d1c', road: '#201728', accent: '#a78bfa' }
      ]
    }
  },

  // 10. 手機 App 與中控補齊功能專屬資料
  trips: {
    odometerKm: 14820,
    tripAKm: 342.6,
    tripAWhKm: 148,
    tripBKm: 1286.4,
    tripBWhKm: 152,
    recent: [
      { id: 'tr-1', title: '丸之內 → 六本木新城', date: '今日 19:20', distKm: 18.4, durationMin: 26, avgWhKm: 148 },
      { id: 'tr-2', title: '代官山 → 港區南青山', date: '昨日 21:10', distKm: 9.2, durationMin: 17, avgWhKm: 141 },
      { id: 'tr-3', title: '東京港區 → 箱根蘆之湖', date: '10月12日', distKm: 94.6, durationMin: 82, avgWhKm: 158 }
    ]
  },
  keys: {
    walkAwayLock: true,
    unlatchOnPark: true,
    childLock: true,
    windowLock: false,
    autoFoldMirrors: true,
    lockSound: true,
    driverDoorOnly: false,
    list: [
      { id: 'k-1', name: '車主智慧手機', type: '超寬頻手機鑰匙', role: '主駕鑰匙', status: '已連線', active: true },
      { id: 'k-2', name: '車主穿戴手錶', type: '藍牙近場鑰匙', role: '隨身鑰匙', status: '已連線', active: true },
      { id: 'k-3', name: '鈦金屬實體感應卡', type: 'B 柱感應卡片', role: '備用鑰匙', status: '已啟用', active: true }
    ]
  },
  software: {
    currentVersion: '2026.36.4',
    availableVersion: '2026.40.1',
    updating: false,
    progress: 0,
    releaseNotes: [
      '中控屏幕左右傾角自動記憶功能',
      '8:3 儀錶盤能耗曲線平滑演算法',
      '360° 環視相機夜間低照度增強'
    ]
  },
  service: {
    centerName: '東京港區芝公園直營服務中心',
    appointmentDate: '2026-10-28 14:00',
    status: '已確認預約 (2 項)',
    wiperServiceMode: false,
    towMode: false,
    jackMode: false,
    carWashMode: false,
    batteryHealthPct: 98,
    updatePreference: 'advanced',
    items: [
      { id: 'srv-1', name: '四輪定位與懸吊幾何行程校準', estimate: '約 45 分鐘', selected: true },
      { id: 'srv-2', name: '高效微粒空調濾網更換', estimate: '約 20 分鐘', selected: true },
      { id: 'srv-3', name: '制動液含水量與卡鉗檢測', estimate: '約 30 分鐘', selected: false }
    ]
  },
  phone: {
    connectedDevice: '車主手機 · 藍牙高音質連線',
    dialBuffer: '000-3842-1920',
    activeCall: null,
    contacts: [
      { id: 'c-1', name: '佐藤 健太', role: '建築設計合夥人', number: '000-3842-1920' },
      { id: 'c-2', name: '高橋 葵', role: '芝公園服務顧問', number: '000-5482-7700' },
      { id: 'c-3', name: '林 雅人', role: '聲學實驗室總監', number: '000-6192-4410' },
      { id: 'c-4', name: '中村 遙', role: '工業設計總監', number: '000-7731-0852' }
    ],
    recentCalls: [
      { id: 'rc-1', name: '佐藤 健太', number: '000-3842-1920', type: '撥出電話', duration: '04:18', time: '18:05' },
      { id: 'rc-2', name: '高橋 葵', number: '000-5482-7700', type: '來電通話', duration: '02:10', time: '昨日' },
      { id: 'rc-3', name: '林 雅人', number: '000-6192-4410', type: '撥出電話', duration: '08:45', time: '週二' },
      { id: 'rc-4', name: '中村 遙', number: '000-7731-0852', type: '未接來電', duration: '00:00', time: '週一' }
    ]
  },
  camera360: {
    activeView: 'surround',
    guideLines: true,
    parkAssistChime: true
  },
  voice: {
    phase: 'listening', // 'listening' | 'recognizing' | 'executed'
    listening: true,
    lastCommand: '導航至六本木新城超充站',
    lastReply: '已為您設定導航至六本木新城超充站，最快路線預計 11 分鐘。',
    suggestions: [
      '導航至六本木新城超充站',
      '將主副駕空調溫度調至 21 度',
      '打開前備箱',
      '播放極光合成器樂團音樂',
      '開啟主駕與副駕座椅加熱',
      '切換至 360 度環視相機'
    ]
  },

  // 11. 環境光照、天氣與中控屏幕傾角狀態
  environment: {
    timeOfDay: 'night',
    weather: 'clear',
    screenBrightness: 92,
    autoBrightness: true,
    colorProfile: 'natural',
    screenCleanMode: false,
    touchBeep: true,
    energyUnit: 'whkm',
    centerTilt: 'driver'
  },

  // 12. 系統與演示控制面板專屬狀態
  system: {
    focusedScreen: 'overview',
    centerActiveModal: null,
    settingsTab: 'display',
    activeSubApp: 'music',
    browserTopic: 'traffic',
    toyboxMode: 'ambient',
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
    this.channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tesla_model_3_hmi_sync_v4') : null;

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

  triggerControlAction(controlId, actionFn) {
    if (this.state.system.controlStateOverride === 'disabled') {
      this.showToast('當前處於「禁用態」演示模式，操作已鎖定', 'warn');
      return;
    }
    delete this.state.system.loadingControls[controlId];
    actionFn();
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

  update(updater, broadcast = true, changedPaths = []) {
    if (typeof updater === 'function') {
      updater(this.state);
    } else if (updater && typeof updater === 'object') {
      this.deepMerge(this.state, updater);
    }
    this.recomputeDerivedState();
    this.notify(changedPaths);

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
      s.locked = false;
      s.sentryMode = false;
      if (s.gear === 'N') {
        s.speed = 0;
      } else if (s.gear === 'R' && s.speed > 24) {
        s.speed = 16;
      }
    } else {
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
      const mapLvl = { I: 1, II: 2, III: 3, IV: 4 };
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
    let autoClosedDoors = false;
    this.update((st) => {
      const prevGear = st.gear;
      if (st.charging.active && targetGear !== 'P') {
        st.charging.active = false;
        st.charging.pluggedIn = false;
      }
      st.gear = targetGear;
      if (targetGear === 'P') {
        st.speed = 0;
        st.displaySpeed = 0;
        st.braking = true;
        st.driveMode.autopilot = false;
      } else if (targetGear === 'N') {
        st.speed = 0;
        st.displaySpeed = 0;
        st.locked = false;
        st.sentryMode = false;
        st.driveMode.autopilot = false;
      } else if (targetGear === 'R') {
        st.locked = false;
        st.sentryMode = false;
        st.service.towMode = false;
        st.driveMode.autopilot = false;
        st.speed = prevGear === 'R' && st.speed > 0 ? st.speed : 14;
        if (st.doors.fl || st.doors.fr || st.doors.rl || st.doors.rr || st.doors.frunk || st.doors.trunk || st.doors.chargePort) {
          st.doors.fl = false;
          st.doors.fr = false;
          st.doors.rl = false;
          st.doors.rr = false;
          st.doors.frunk = false;
          st.doors.trunk = false;
          st.doors.chargePort = false;
          autoClosedDoors = true;
        }
      } else if (targetGear === 'D') {
        st.locked = false;
        st.sentryMode = false;
        st.service.towMode = false;
        if (st.speed === 0) st.speed = st.speedLimitMode ? Math.min(68, st.speedLimitMaxKmh || 110) : 68;
        if (st.doors.fl || st.doors.fr || st.doors.rl || st.doors.rr || st.doors.frunk || st.doors.trunk || st.doors.chargePort) {
          st.doors.fl = false;
          st.doors.fr = false;
          st.doors.rl = false;
          st.doors.rr = false;
          st.doors.frunk = false;
          st.doors.trunk = false;
          st.doors.chargePort = false;
          autoClosedDoors = true;
        }
      }
    });
    if (autoClosedDoors) {
      this.showToast(`已掛入 ${targetGear} 擋行駛，全車車門與艙蓋已自動閉合`, 'info');
    } else {
      const gearLabels = { P: 'P 擋駐停 (0 km/h)', R: 'R 擋倒車 (14 km/h)', N: 'N 擋空擋', D: `D 擋巡航 (${Math.round(this.state.speed)} km/h)` };
      this.showToast(`已切換至 ${gearLabels[targetGear] || targetGear}`, 'info');
    }
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
    let shiftedToPark = false;
    let nextVal = false;
    this.update((st) => {
      nextVal = !st.doors[partKey];
      st.doors[partKey] = nextVal;
      if (nextVal) {
        if (st.gear !== 'P') {
          st.gear = 'P';
          st.speed = 0;
          st.displaySpeed = 0;
          st.driveMode.autopilot = false;
          shiftedToPark = true;
        }
        if (st.locked && partKey !== 'chargePort') {
          st.locked = false;
          st.sentryMode = false;
        }
      }
      if (!nextVal && partKey === 'chargePort' && st.charging.active) {
        st.charging.active = false;
        st.charging.pluggedIn = false;
      }
    });
    const label = partNames[partKey] || partKey;
    this.showToast(
      shiftedToPark
        ? `已自動掛入 P 擋駐停並開啟${label}`
        : `${label}已${nextVal ? '開啟' : '關閉'}`,
      'info'
    );
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
    this.showToast('正在下載並安裝座艙系統更新 2026.40.1...', 'info');
    if (this._swTimer) clearInterval(this._swTimer);
    this._swTimer = setInterval(() => {
      this.update((st) => {
        st.software.progress += 25;
        if (st.software.progress >= 100) {
          st.software.progress = 100;
          st.software.updating = false;
          st.software.currentVersion = st.software.availableVersion;
          clearInterval(this._swTimer);
          this.showToast('系統已成功更新至 2026.40.1', 'info');
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
          ? (12 + Math.pow(s.displaySpeed / 34, 2.0) * 5.2 + Math.sin(now * 0.0038) * 14.5 + Math.cos(now * 0.0072) * 9.5)
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

        // 持續更新 30 點有明顯起伏的實時能耗曲線 (Wh/km)
        this.energyAccum += dt;
        if (this.energyAccum >= 0.28) {
          this.energyAccum = 0;
          const wave = Math.sin(now * 0.0042) * 58 + Math.cos(now * 0.0095) * 36;
          const instantWhKm = Math.round(Math.max(-45, Math.min(285, 136 + s.displayPowerKw * 1.45 + wave)));
          s.energyHistory.push(instantWhKm);
          if (s.energyHistory.length > 30) s.energyHistory.shift();
          uiNeedsRefresh = true;
        }
      } else {
        s.roadCurvature *= 0.92;
        s.steeringAngle *= 0.92;
        s.driveMode.forwardCollisionWarn = false;
      }

      if (s.media.playing) {
        const activeTrack = s.media.tracks[s.media.trackIndex] || s.media.tracks[0];
        s.media.currentTime += dt;
        if (s.media.currentTime >= activeTrack.duration) {
          s.media.currentTime = 0;
          s.media.trackIndex = (s.media.trackIndex + 1) % s.media.tracks.length;
          uiNeedsRefresh = true;
        }
      }

      if (s.media.videoPlaying && s.media.activeTab === 'video') {
        const activeVid = s.media.videos[s.media.videoIndex] || s.media.videos[0];
        const vidDur = activeVid.duration || 312;
        const speedMult = s.media.videoSpeed || 1.0;
        s.media.videoProgress += ((dt * speedMult) / vidDur) * 100;
        if (s.media.videoProgress >= 100) {
          s.media.videoProgress = 0;
          s.media.videoIndex = (s.media.videoIndex + 1) % s.media.videos.length;
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
