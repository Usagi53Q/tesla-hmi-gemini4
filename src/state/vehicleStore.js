/**
 * TESLA COCKPIT HMI — CENTRAL REACTIVE VEHICLE STATE STORE
 * 五端共用唯一真相數據源 (Single Source of Truth)
 * 支援：車速、擋位、電量、鎖車、車門、空調、燈光、駕駛模式、導航、娛樂、胎壓、環境與天氣
 * 內建 60fps 物理慣性平滑插值器 (Smooth Telemetry Damper) 與跨視窗 BroadcastChannel 同步
 */

const INITIAL_STATE = {
  // 1. 核心動力與行駛狀態
  speed: 68,                  // 目標車速 (km/h, 0 - 240)
  displaySpeed: 68,           // 平滑過渡後的實時顯示車速
  gear: 'D',                  // 'P' | 'R' | 'N' | 'D'
  powerKw: 24,                // 實時功率 (-85 kW 動能回收 ~ +320 kW 輸出)
  displayPowerKw: 24,         // 平滑過渡功率
  batterySoc: 82,             // 電量百分比 (0 - 100%)
  displaySoc: 82,             // 平滑過渡電量
  ratedFullRangeKm: 575,      // 滿電 WLTP 預估續航 (Model 3 Long Range)
  braking: false,             // 是否踩下剎車或減速中
  steeringAngle: 0,           // 方向盤轉角 (-450 ~ +450 deg)
  roadCurvature: 0.0,         // 當前道路彎道曲率 (-1.0 ~ 1.0)

  // 2. 車身鎖止與開合件狀態 (0 = 關閉, 1 = 開啟)
  locked: true,               // 全車上鎖狀態
  sentryMode: true,           // 哨兵模式監控狀態
  valetMode: false,           // 代客模式狀態
  findMyCarActive: false,     // 尋車閃燈鳴笛狀態
  findMyCarTimer: 0,
  paintColor: 'quicksilver',  // 'quicksilver' | 'ultrared' | 'stealthgrey' | 'pearlwhite' | 'deepblue'
  doors: {
    fl: false,                // 左前車門
    fr: false,                // 右前車門
    rl: false,                // 左後車門
    rr: false,                // 右後車門
    frunk: false,             // 前備箱 (Bonnet)
    trunk: false,             // 電動尾箱 (Boot)
    chargePort: false,        // 左後充電口蓋
  },
  doorProgress: {
    fl: 0,
    fr: 0,
    rl: 0,
    rr: 0,
    frunk: 0,
    trunk: 0,
    chargePort: 0,
  },

  // 3. 充電管理系統
  charging: {
    pluggedIn: false,
    active: false,
    limitSoc: 90,
    powerKw: 0,
    voltage: 398,
    currentAmps: 0,
    timeRemainingMin: 24,
    superchargerName: '東京六本木新城 V4 超級充電站',
    scheduledDeparture: '08:30',
    history: [
      { id: 'ch-1', date: '2026-10-14 18:20', location: '東京六本木新城 V4 超充', addedKwh: 46.8, durationMin: 22, costYen: 2150, socRange: '21% → 85%' },
      { id: 'ch-2', date: '2026-10-11 21:05', location: '代官山 T-SITE 超充站', addedKwh: 38.2, durationMin: 19, costYen: 1760, socRange: '30% → 82%' },
      { id: 'ch-3', date: '2026-10-08 09:15', location: '自宅壁掛式充電座', addedKwh: 52.4, durationMin: 340, costYen: 1420, socRange: '15% → 90%' },
      { id: 'ch-4', date: '2026-10-04 14:40', location: '御殿場 Premium Outlets 超充', addedKwh: 55.0, durationMin: 26, costYen: 2530, socRange: '12% → 88%' }
    ]
  },

  // 4. 雙溫區熱泵空調與座艙環境
  climate: {
    power: true,
    driverTemp: 21.0,
    passengerTemp: 21.5,
    sync: false,
    fanSpeed: 4,              // 1 - 10 級風量
    auto: true,
    ac: true,
    recirculate: true,
    defrostFront: false,
    defrostRear: false,
    seatHeatLeft: 1,          // 0 - 3
    seatHeatRight: 0,         // 0 - 3
    cabinTemp: 22.0,
    exteriorTemp: 17.5,
    preconditioning: false,   // 手機遠程預冷/預熱
    mode: 'off',              // 'off' | 'keep' (恆溫) | 'dog' (寵物) | 'camp' (露營)
    campMode: false,
    dogMode: false
  },

  // 5. 車燈、雨刮與後視鏡
  lights: {
    mode: 'auto',             // 'off' | 'parking' | 'on' | 'auto'
    lowBeam: true,
    highBeam: false,
    fogFront: false,
    fogRear: false,
    drl: true,
    dome: 'auto',             // 'off' | 'on' | 'auto'
    ambientLight: true,
    turnSignal: 'off',        // 'off' | 'left' | 'right'
    hazard: false,            // 雙閃警示燈
    blinkPhase: false         // 轉向燈閃爍相位 (420ms 週期)
  },
  wipers: {
    mode: 'auto',             // 'off' | '1' | '2' | '3' | '4' | 'auto'
    effectiveLevel: 0,
    washerActive: false
  },
  mirrors: {
    folded: false,
    autoFold: true,
    autoTilt: true,
    adjustingSide: 'left',    // 'left' | 'right'
    leftYaw: 0,
    leftPitch: 0,
    rightYaw: 0,
    rightPitch: 0
  },

  // 6. 駕駛模式與 Autopilot 輔助駕駛
  driveMode: {
    accel: 'standard',        // 'chill' (舒適) | 'standard' (標準) | 'sport' (運動)
    steering: 'standard',     // 'comfort' | 'standard' | 'sport'
    regen: 'standard',        // 'low' (低回收) | 'standard' (標準高回收)
    stoppingMode: 'hold',     // 'creep' | 'roll' | 'hold'
    autopilot: true,          // Autosteer 輔助轉向開啟
    tacc: true,               // 主動巡航控制
    setSpeed: 80,             // AP 巡航設定車速
    speedLimit: 80,           // 當前道路限速
    followDistanceLevel: 3,   // 跟車距離檔位 (1 - 7)
    leadCarDistanceM: 28.5,   // 前車實時距離 (m)
    displayLeadDistanceM: 28.5,
    blindSpotWarningLeft: false,
    blindSpotWarningRight: false,
    forwardCollisionWarn: false
  },

  // 7. 胎壓監測系統 (TPMS)
  tires: {
    fl: 2.90,
    fr: 2.90,
    rl: 2.92,
    rr: 2.92,
    lowPressureWarning: false
  },

  // 8. 導航與路線系統
  navigation: {
    active: true,
    destinationId: 'roppongi',
    destinationName: '東京六本木新城 V4 超級充電站',
    destinationAddress: '東京都港區六本木 6-10-1',
    etaMinutes: 14,
    remainingKm: 8.6,
    arrivalSoc: 79,
    nextTurnDistanceM: 280,
    nextTurnDirection: 'right',
    nextTurnStreet: '外苑東通り · 往青山一丁目方向',
    voiceGuidance: true,
    voiceSpeaking: false,
    trafficLayer: true,
    superchargerLayer: true,
    headingDeg: 42,
    routeProgress: 0.22
  },

  // 9. 副駕娛樂與全車音響聯動 (補足至 10 首完整無損曲目與 6 部劇院影片)
  media: {
    activeTab: 'music',
    playing: true,
    volume: 64,
    effectiveVolume: 64,
    muted: false,
    audioSoundEnabled: false,
    eqPreset: 'immersive',    // 'immersive' (沉浸環繞) | 'studio' (錄音室原聲) | 'bass' (低音增強)
    playMode: 'loop',         // 'loop' | 'shuffle' | 'single'
    trackIndex: 0,
    currentTime: 78,
    tracks: [
      {
        id: 't1',
        title: 'Midnight Cyber Drive',
        artist: 'Kavinsky & SynthWave Orchestra',
        album: 'OutRun Odyssey · 24-bit/192kHz',
        quality: 'FLAC 192kHz',
        motif: 'horizon',
        palette: ['#182238', '#0d1322', '#3e6ae1'],
        duration: 224,
        coverCode: 'OD-01',
        bpm: 118,
        lyrics: [
          'Cruising through the Tokyo expressway in silent electric torque',
          'City lights reflecting across the panoramic glass roof horizon',
          'Autopilot locked onto the glowing lane telemetry ahead',
          'Midnight pulse synchronized with dual-motor precision'
        ]
      },
      {
        id: 't2',
        title: 'Tokyo Neon Horizon',
        artist: 'M83 Electric Ensemble',
        album: 'Hurry Up, We Are Dreaming · Atmos',
        quality: 'Dolby Atmos',
        motif: 'eclipse',
        palette: ['#1e1b36', '#0e101d', '#6366f1'],
        duration: 248,
        coverCode: 'TK-02',
        bpm: 124,
        lyrics: [
          'Over the Rainbow Bridge into the shimmering bay skyline',
          'Every frequency tuned across 22 cabin speakers',
          'Zero emissions beneath the midnight metropolitan glow',
          'Chasing the horizon at sixty frames per second'
        ]
      },
      {
        id: 't3',
        title: 'Starman in Orbit',
        artist: 'David Bowie Tribute Ensemble',
        album: 'Roadster Beyond Mars · Master',
        quality: 'DSD 128',
        motif: 'orbit',
        palette: ['#1c2430', '#0c1017', '#38bdf8'],
        duration: 256,
        coverCode: 'SM-03',
        bpm: 110,
        lyrics: [
          'There is a Starman waiting in the deep orbital silence',
          'Telemetry link established with Starbase ground control',
          'Floating weightless above the blue curvature of Earth',
          'Don’t Panic printed in crisp letters on the center console'
        ]
      },
      {
        id: 't4',
        title: 'Pacific Coast Highway 1',
        artist: 'Tycho Ambient Lab',
        album: 'Awake Remastered · Spatial Audio',
        quality: 'Hi-Res 96kHz',
        motif: 'waves',
        palette: ['#162936', '#0b141c', '#2dd4bf'],
        duration: 215,
        coverCode: 'PC-04',
        bpm: 98,
        lyrics: [
          'Morning fog lifting above Big Sur coastal cliffs',
          'Regenerative braking harvesting energy on every descent',
          'Warm cabin breeze balanced by heat-pump climate control',
          'Endless ocean vistas framed by frameless door glass'
        ]
      },
      {
        id: 't5',
        title: 'Autobahn Telemetry',
        artist: 'Kraftwerk Digital Studio',
        album: 'Tour de Futur · Studio Master',
        quality: 'FLAC 192kHz',
        motif: 'grid',
        palette: ['#1f242d', '#101318', '#3e6ae1'],
        duration: 272,
        coverCode: 'AB-05',
        bpm: 128,
        lyrics: [
          'Wir fahren, fahren, fahren auf der Autobahn',
          'Aerodynamic drag coefficient 0.219 slicing the wind',
          'Real-time torque vectoring across front and rear drive units',
          'Precision engineering meets neural network software'
        ]
      },
      {
        id: 't6',
        title: 'Shibuya Rain Reflections',
        artist: 'Ryuichi Sakamoto Trio',
        album: 'Async Acoustic Session · Tokyo',
        quality: '24-bit PCM',
        motif: 'rain',
        palette: ['#1a222c', '#0d1117', '#94a3b8'],
        duration: 238,
        coverCode: 'SR-06',
        bpm: 92,
        lyrics: [
          'Raindrops tracing soft patterns across the acoustic glass',
          'Piano harmonics resonating inside the quiet cabin',
          'Shibuya crossing lights blurred through the evening mist',
          'Calm sanctuary amidst the rushing metropolis'
        ]
      },
      {
        id: 't7',
        title: 'Solaris Supercharger Lounge',
        artist: 'Brian Eno & Modular Collective',
        album: 'Music for EV Stations · Ambient',
        quality: 'Dolby Atmos',
        motif: 'prism',
        palette: ['#17253b', '#0b121e', '#60a5fa'],
        duration: 196,
        coverCode: 'SS-07',
        bpm: 88,
        lyrics: [
          'High-voltage direct current replenishing the cell array',
          'Ambient textures drifting across the reclining lounge seats',
          'Thermal management humming in quiet equilibrium',
          'Ready for the next five hundred kilometers ahead'
        ]
      },
      {
        id: 't8',
        title: 'Alpine Pass Elevation',
        artist: 'Nils Frahm Electro-Acoustic',
        album: 'All Melody Live in Berlin',
        quality: 'FLAC 96kHz',
        motif: 'peaks',
        palette: ['#1d2633', '#0e131a', '#818cf8'],
        duration: 264,
        coverCode: 'AP-08',
        bpm: 114,
        lyrics: [
          'Climbing through the snow-covered switchbacks of St. Gotthard',
          'Dual-motor traction holding every apex effortlessly',
          'Crisp mountain air filtered through HEPA protection',
          'Summit horizon opening into a sea of alpine clouds'
        ]
      },
      {
        id: 't9',
        title: 'Cybernetic Symphony No. 9',
        artist: 'Daft Punk Legacy Orchestra',
        album: 'Random Access Memories · DSD',
        quality: 'DSD 256',
        motif: 'pulse',
        palette: ['#182032', '#0a0e17', '#3e6ae1'],
        duration: 242,
        coverCode: 'CS-09',
        bpm: 120,
        lyrics: [
          'Analog warmth fused with neural network precision',
          'Sub-bass locked to the rhythm of the expressway joints',
          'Chrome reflections gliding beneath tunnel sodium lamps',
          'One more time down the bayshore route'
        ]
      },
      {
        id: 't10',
        title: 'Nocturne in Quicksilver',
        artist: 'Max Richter String Quartet',
        album: 'Sleep & Night Drive Edition',
        quality: 'Hi-Res Lossless',
        motif: 'monolith',
        palette: ['#20252e', '#0f1217', '#a5b4fc'],
        duration: 210,
        coverCode: 'NQ-10',
        bpm: 84,
        lyrics: [
          'Strings swelling gently as the city skyline fades behind',
          'Headlights carving a quiet path through the night',
          'Every instrument placed with pinpoint studio imaging',
          'Arriving home with seventy-nine percent charge remaining'
        ]
      }
    ],
    videoIndex: 0,
    videoPlaying: true,
    videoProgress: 42,
    videoSpeed: 1.0,
    videoQuality: '4K HDR',
    videos: [
      { id: 'v1', title: 'FSD V13 零接管穿越東京灣岸線實錄', channel: 'Tesla AI & Vision Lab', duration: 312, resolution: '4K HDR 60fps', codec: 'HEVC · Dolby Atmos', category: '自動駕駛實測', sceneType: 'bayshore', subtitle: '「FSD V13 端到端神經網路正透過 36Hz 全視角光子視覺，即時預測彩虹大橋匯流車道軌跡…」' },
      { id: 'v2', title: 'Cybercab 與下一代座艙光學設計解析', channel: 'Franz Design Studio', duration: 485, resolution: '4K Dolby Vision', codec: 'Dolby Vision · 48Mbps', category: '工業設計紀錄片', sceneType: 'cybercab', subtitle: '「無方向盤座艙將視聽中心完全交還給乘客，搭配 22 揚聲器主動降噪聲學穹頂…」' },
      { id: 'v3', title: '阿爾卑斯山脈冬季極寒續航挑戰', channel: 'EV Grand Tour Europe', duration: 620, resolution: '4K 60fps', codec: 'HDR10+ · Stereo', category: '極境長途實測', sceneType: 'alpine', subtitle: '「在零下 18°C 的聖哥達山口，八通閥熱泵系統持續回收電驅餘熱以維持電池最佳活性…」' },
      { id: 'v4', title: '4680 結構化電池包與 V4 超充熱管理剖析', channel: 'Powertrain Engineering', duration: 410, resolution: '4K HDR', codec: 'HEVC · 10-bit', category: '三電工程解析', sceneType: 'battery', subtitle: '「乾法電極與全極耳結構大幅降低內阻，在 350kW V4 超充峰值下保持均勻溫場…」' },
      { id: 'v5', title: 'Model 3 紐柏林北環賽道空氣動力學實測', channel: 'Tesla Track Team', duration: 358, resolution: '4K 60fps', codec: 'ProRes · 60fps', category: '賽道性能測試', sceneType: 'track', subtitle: '「高速通過大直線段時，主動式底盤擾流與賽道模式扭矩分配將側傾抑制在 0.8 度以內…」' },
      { id: 'v6', title: '東京六本木至箱根蘆之湖智駕漫遊紀實', channel: 'Japan EV Journal', duration: 540, resolution: '4K Dolby Vision', codec: 'Dolby Vision · Atmos', category: '智駕公路旅行', sceneType: 'hakone', subtitle: '「清晨從六本木ヒルズ出發，沿東名高速駛向箱根山道，全程零接管平順過彎…」' },
      { id: 'v7', title: 'Optimus Gen-3 工廠精細協作與運動控制實錄', channel: 'Tesla Bot Robotics', duration: 394, resolution: '4K HDR 60fps', codec: 'HEVC · 60fps', category: '機器人與 AI', sceneType: 'optimus', subtitle: '「22 自由度靈巧手搭載觸覺陣列感測器，實現毫米級電池分選與雙足動態平衡…」' },
      { id: 'v8', title: 'Giga Shanghai 壓鑄機與自動化產線紀錄片', channel: 'Manufacturing Insights', duration: 468, resolution: '4K UHD', codec: 'HDR10+ · Atmos', category: '超級工廠紀實', sceneType: 'gigafactory', subtitle: '「9000 噸級一體化壓鑄單元在 90 秒內完成後底板成型，焊點數量減少超過 700 個…」' },
      { id: 'v9', title: 'Sonic Studio 車載杜比全景聲母帶調音幕後', channel: 'Tesla Acoustic Lab', duration: 325, resolution: '4K Dolby Vision', codec: 'Dolby Atmos Master', category: '聲學工程特輯', sceneType: 'acoustics', subtitle: '「針對雙層夾膠玻璃座艙反射特性，每一顆高音與重低音單體均經過獨立相位校正…」' }
    ],
    game: {
      running: true,
      score: 1480,
      highScore: 4850,
      playerLane: 1,
      boostActive: false
    }
  },

  // 10. 環境光照、天氣與演示視角狀態
  environment: {
    timeOfDay: 'night',
    weather: 'clear',
    screenBrightness: 90,
    autoDayNight: true
  },

  // 11. 系統與演示控制面板專屬狀態
  system: {
    focusedScreen: 'overview',
    centerActiveModal: null,
    settingsTab: 'pedals',
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
    this.channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tesla_hmi_sync_v1') : null;

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

  triggerControlAction(controlId, actionFn, delayMs = 180) {
    if (this.state.system.controlStateOverride === 'disabled') {
      this.showToast('當前處於「禁用態 (Disabled)」演示模式，操作已鎖定', 'warn');
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
    }, 3200);
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
      s.doors.chargePort = true;
      s.charging.pluggedIn = true;
      s.charging.powerKw = 215;
      s.charging.currentAmps = 540;
    } else {
      s.charging.powerKw = 0;
      s.charging.currentAmps = 0;
    }

    if (s.gear === 'P' || s.gear === 'N') {
      s.speed = 0;
    } else if (s.gear === 'R' && s.speed > 25) {
      s.speed = 18;
    }

    if (s.climate.mode === 'dog') {
      s.climate.power = true;
      s.climate.dogMode = true;
      s.climate.campMode = false;
    } else if (s.climate.mode === 'camp') {
      s.climate.power = true;
      s.climate.campMode = true;
      s.climate.dogMode = false;
    } else if (s.climate.mode === 'keep') {
      s.climate.power = true;
      s.climate.dogMode = false;
      s.climate.campMode = false;
    } else {
      s.climate.dogMode = false;
      s.climate.campMode = false;
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
      s.wipers.effectiveLevel = parseInt(s.wipers.mode, 10) || 1;
    }

    const baseVol = s.media.muted ? 0 : s.media.volume;
    s.media.effectiveVolume = (s.navigation.voiceSpeaking && s.navigation.voiceGuidance)
      ? Math.round(baseVol * 0.32)
      : baseVol;
  }

  getEstimatedRangeKm() {
    const s = this.state;
    const modeFactor = s.driveMode.accel === 'chill' ? 1.04 : (s.driveMode.accel === 'sport' ? 0.92 : 1.0);
    return Math.round((s.displaySoc / 100) * s.ratedFullRangeKm * modeFactor);
  }

  hasOpenDoorOrTrunk() {
    const d = this.state.doors;
    return d.fl || d.fr || d.rl || d.rr || d.frunk || d.trunk || d.chargePort;
  }

  setGear(targetGear) {
    const s = this.state;
    if (s.charging.active && targetGear !== 'P') {
      this.showToast('正在超級充電中，請先停止充電並拔除充電槍再切換擋位', 'warn');
      return false;
    }
    this.update((st) => {
      const prevGear = st.gear;
      st.gear = targetGear;
      if (targetGear === 'P') {
        st.speed = 0;
        st.braking = true;
      } else if (targetGear === 'N') {
        st.speed = 0;
      } else if (targetGear === 'R') {
        st.speed = prevGear === 'R' ? st.speed : 12;
      } else if (targetGear === 'D') {
        if (st.speed === 0) st.speed = 68;
        if (st.doors.frunk || st.doors.trunk || st.doors.chargePort) {
          st.doors.frunk = false;
          st.doors.trunk = false;
          st.doors.chargePort = false;
          this.showToast('已進入 D 擋行駛，前備箱、尾箱與充電口已自動閉鎖', 'info');
        }
      }
    });
    return true;
  }

  toggleDoor(partKey) {
    const partNames = {
      fl: '左前車門',
      fr: '右前車門',
      rl: '左後車門',
      rr: '右後車門',
      frunk: '前備箱 (Frunk)',
      trunk: '電動尾箱 (Trunk)',
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
      this.showToast(`${label}已${nextVal ? '開啟 — 3D 鏡頭已自動對焦展示' : '關閉'}`, 'info');
    });
    return true;
  }

  triggerFindMyCar() {
    this.update((st) => {
      st.findMyCarActive = true;
      st.lights.hazard = true;
      st.lights.highBeam = true;
    });
    this.showToast('正在尋車：已觸發遠程閃燈與鳴笛定位信號', 'info');
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
    this.update((st) => {
      st.navigation.voiceSpeaking = true;
    });
    this.showToast(`導航語音播報：「前方 ${Math.round(this.state.navigation.nextTurnDistanceM)} 公尺請靠右行駛」— 娛樂音量已自動壓低`, 'info');
    if (this._navVoiceTimer) clearTimeout(this._navVoiceTimer);
    this._navVoiceTimer = setTimeout(() => {
      this.update((st) => {
        st.navigation.voiceSpeaking = false;
      });
    }, 3600);
  }

  startSimulationLoop() {
    const step = (now) => {
      const dt = Math.min((now - this.lastTick) / 1000, 0.1);
      this.lastTick = now;
      const s = this.state;
      let uiNeedsRefresh = false;

      const speedDiff = s.speed - s.displaySpeed;
      if (Math.abs(speedDiff) > 0.05) {
        s.displaySpeed += speedDiff * Math.min(1, dt * 6.5);
        uiNeedsRefresh = true;
      } else if (s.displaySpeed !== s.speed) {
        s.displaySpeed = s.speed;
        uiNeedsRefresh = true;
      }

      const accelFactor = s.driveMode.accel === 'sport' ? 1.45 : (s.driveMode.accel === 'chill' ? 0.68 : 1.0);
      const regenStrength = s.driveMode.regen === 'standard' ? 1.0 : 0.45;
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
        if (this.blinkAccum >= 0.42) {
          this.blinkAccum = 0;
          s.lights.blinkPhase = !s.lights.blinkPhase;
          uiNeedsRefresh = true;
        }
      } else if (s.lights.blinkPhase) {
        s.lights.blinkPhase = false;
        uiNeedsRefresh = true;
      }

      if (s.displaySpeed > 1 && s.gear === 'D') {
        const metersPerSec = s.displaySpeed / 3.6;
        if (s.navigation.active) {
          s.navigation.nextTurnDistanceM -= metersPerSec * dt * 0.65;
          s.navigation.routeProgress = (s.navigation.routeProgress + dt * 0.018 * (s.displaySpeed / 60)) % 1.0;
          if (s.navigation.nextTurnDistanceM <= 15) {
            const turns = [
              { dir: 'right', dist: 380, street: '外苑東通り · 往青山一丁目方向' },
              { dir: 'left', dist: 290, street: '青山通り (國道246號) 交叉口' },
              { dir: 'slight-right', dist: 240, street: '六本木新城 P2 超級充電專用車道' }
            ];
            this._turnIdx = ((this._turnIdx || 0) + 1) % turns.length;
            const nextT = turns[this._turnIdx];
            s.navigation.nextTurnDirection = nextT.dir;
            s.navigation.nextTurnDistanceM = nextT.dist;
            s.navigation.nextTurnStreet = nextT.street;
          }
          s.navigation.remainingKm = Math.max(0.4, s.navigation.remainingKm - (metersPerSec * dt) / 1000);
          s.navigation.etaMinutes = Math.max(1, Math.round((s.navigation.remainingKm / Math.max(35, s.displaySpeed)) * 60));
        }

        const baseFollowM = 12 + s.driveMode.followDistanceLevel * 5.5 + (s.displaySpeed * 0.14);
        s.driveMode.leadCarDistanceM = baseFollowM + Math.sin(now * 0.0016) * 3.2;
        s.driveMode.displayLeadDistanceM += (s.driveMode.leadCarDistanceM - s.driveMode.displayLeadDistanceM) * Math.min(1, dt * 4);
        s.driveMode.forwardCollisionWarn = s.driveMode.displayLeadDistanceM < 15 && s.displaySpeed > 50;

        s.roadCurvature = Math.sin(now * 0.00055) * 0.25;
        s.steeringAngle = s.roadCurvature * 38;

        this.navAccum += dt;
        if (this.navAccum >= 0.08) {
          this.navAccum = 0;
          uiNeedsRefresh = true;
        }
      } else {
        s.roadCurvature *= 0.92;
        s.steeringAngle *= 0.92;
      }

      if (s.media.playing && s.media.activeTab === 'music') {
        this._mediaAccum = (this._mediaAccum || 0) + dt;
        if (this._mediaAccum >= 0.25) {
          s.media.currentTime += this._mediaAccum;
          this._mediaAccum = 0;
          const activeTrack = s.media.tracks[s.media.trackIndex];
          if (activeTrack && s.media.currentTime >= activeTrack.duration) {
            if (s.media.playMode === 'single') {
              s.media.currentTime = 0;
            } else if (s.media.playMode === 'shuffle') {
              s.media.trackIndex = (s.media.trackIndex + 2) % s.media.tracks.length;
              s.media.currentTime = 0;
            } else {
              s.media.trackIndex = (s.media.trackIndex + 1) % s.media.tracks.length;
              s.media.currentTime = 0;
            }
          }
          uiNeedsRefresh = true;
        }
      }

      if (s.media.videoPlaying && s.media.activeTab === 'video') {
        this._videoAccum = (this._videoAccum || 0) + dt * (s.media.videoSpeed || 1.0);
        if (this._videoAccum >= 0.8) {
          const activeVideo = s.media.videos[s.media.videoIndex] || s.media.videos[0];
          const stepPct = (this._videoAccum / (activeVideo.duration || 300)) * 100;
          s.media.videoProgress = (s.media.videoProgress + stepPct) % 100;
          this._videoAccum = 0;
          uiNeedsRefresh = true;
        }
      }

      if (uiNeedsRefresh) {
        this.notify(['telemetry']);
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }
}

export const vehicleStore = new VehicleStore();
