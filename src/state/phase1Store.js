/**
 * 階段一：Model 3 中控屏 — 集中式狀態管理與 localStorage 嚴格驗證庫
 * -----------------------------------------------------------------------------
 * 核心職責：
 * 1. 集中管理階段一所有狀態（3D 視角、前備箱/尾箱/充電口、空調與 3D 出風方向、
 *    前排座椅調節、OSM 導航互動層、5 首虛構音樂與佇列、12 大官方手冊設置分類）。
 * 2. 嚴格實作 `localStorage` 持久化與讀取時之類型與數值範圍驗證（偏好、座椅位置、演示鑰匙）。
 * 3. 嚴格實作設置項之「依賴禁用與原因提示 (Dependency Rules)」。
 * 4. 嚴格實作「臨時模式（洗車模式、屏幕清潔模式、牽引模式）」覆蓋與退出後恢復原偏好。
 */

import { DEFAULT_VEHICLE_CONFIG_ID, getVehicleConfig } from '../config/vehicleConfigs.js';

export const STORAGE_KEY = 'tesla_model3_phase1_state_v1';

// 5 首原創虛構車載曲目（100% 獨立創作名稱與配色，無版權爭議）
export const FICTIONAL_TRACKS = [
  {
    id: 'm1',
    title: '夜行首都高 C1',
    artist: '新東京合成器樂團',
    album: '電驅地平線 · 第一章',
    durationSec: 218,
    coverColors: ['#1e293b', '#3b82f6', '#93c5fd'],
    accent: '#3b82f6'
  },
  {
    id: 'm2',
    title: '代代木晨霧光譜',
    artist: '星野光學室內樂',
    album: '靜音巡航曲集',
    durationSec: 245,
    coverColors: ['#134e4a', '#14b8a6', '#99f6e4'],
    accent: '#14b8a6'
  },
  {
    id: 'm3',
    title: '六本木天際線脈動',
    artist: '極光電子四重奏',
    album: '都市夜航紀實',
    durationSec: 196,
    coverColors: ['#312e81', '#6366f1', '#c7d2fe'],
    accent: '#6366f1'
  },
  {
    id: 'm4',
    title: '箱根山道回生制動',
    artist: '蘆之湖原聲實驗室',
    album: '山嵐與電流',
    durationSec: 262,
    coverColors: ['#3f2e21', '#f59e0b', '#fde68a'],
    accent: '#f59e0b'
  },
  {
    id: 'm5',
    title: '東京灣岸零時星軌',
    artist: '深海頻率合成組',
    album: '跨海大橋夜曲',
    durationSec: 230,
    coverColors: ['#0f172a', '#0ea5e9', '#bae6fd'],
    accent: '#0ea5e9'
  }
];

// 新宿與東京都心導航地點與超級充電站資料庫（對應 OSM 底圖座標 0~1000）
export const NAVIGATION_POIS = [
  {
    id: 'poi-roppongi',
    name: '東京六本木新城 V3 超級充電站',
    category: 'supercharger',
    address: '港區六本木 6-10-1',
    mapX: 685,
    mapY: 745,
    distanceKm: 4.8,
    powerKw: 250,
    availableStalls: 6,
    totalStalls: 8,
    routes: {
      fastest: { id: 'fastest', label: '最快路線 (經首都高 4 號線)', durationMin: 14, distanceKm: 4.8, arrivalSoc: 80, points: [[340, 380], [420, 410], [510, 520], [595, 650], [685, 745]] },
      eco: { id: 'eco', label: '節能路線 (經外苑東通)', durationMin: 17, distanceKm: 4.4, arrivalSoc: 81, points: [[340, 380], [465, 395], [560, 490], [630, 610], [685, 745]] },
      notoll: { id: 'notoll', label: '免收費地面幹道 (經青山通)', durationMin: 19, distanceKm: 5.1, arrivalSoc: 80, points: [[340, 380], [360, 510], [450, 630], [575, 705], [685, 745]] }
    }
  },
  {
    id: 'poi-shibuya',
    name: '澀谷 Stream 超級充電站',
    category: 'supercharger',
    address: '澀谷區澀谷 3-21-3',
    mapX: 430,
    mapY: 810,
    distanceKm: 3.9,
    powerKw: 250,
    availableStalls: 4,
    totalStalls: 6,
    routes: {
      fastest: { id: 'fastest', label: '最快路線 (經明治通)', durationMin: 12, distanceKm: 3.9, arrivalSoc: 80, points: [[340, 380], [385, 490], [410, 630], [430, 810]] },
      eco: { id: 'eco', label: '節能路線 (經代代木公園西側)', durationMin: 15, distanceKm: 3.7, arrivalSoc: 81, points: [[340, 380], [310, 530], [355, 690], [430, 810]] },
      notoll: { id: 'notoll', label: '景觀路線 (經表參道)', durationMin: 16, distanceKm: 4.3, arrivalSoc: 80, points: [[340, 380], [440, 520], [470, 670], [430, 810]] }
    }
  },
  {
    id: 'poi-marunouchi',
    name: '東京丸之內信託大廈 V3 超充站',
    category: 'supercharger',
    address: '千代田區丸之內 1-8-3',
    mapX: 865,
    mapY: 435,
    distanceKm: 7.2,
    powerKw: 250,
    availableStalls: 7,
    totalStalls: 10,
    routes: {
      fastest: { id: 'fastest', label: '最快路線 (經甲州街道與內堀通)', durationMin: 18, distanceKm: 7.2, arrivalSoc: 79, points: [[340, 380], [490, 415], [640, 430], [760, 420], [865, 435]] },
      eco: { id: 'eco', label: '節能路線 (經靖國通)', durationMin: 21, distanceKm: 6.9, arrivalSoc: 80, points: [[340, 380], [480, 330], [650, 340], [785, 375], [865, 435]] },
      notoll: { id: 'notoll', label: '皇居外苑景觀路線', durationMin: 23, distanceKm: 7.6, arrivalSoc: 79, points: [[340, 380], [455, 480], [610, 525], [755, 495], [865, 435]] }
    }
  },
  {
    id: 'poi-daikanyama',
    name: '代官山 T-SITE 目的地充電站',
    category: 'supercharger',
    address: '澀谷區猿樂町 17-5',
    mapX: 375,
    mapY: 895,
    distanceKm: 4.9,
    powerKw: 150,
    availableStalls: 3,
    totalStalls: 4,
    routes: {
      fastest: { id: 'fastest', label: '最快路線 (經山手通)', durationMin: 15, distanceKm: 4.9, arrivalSoc: 80, points: [[340, 380], [295, 540], [320, 720], [375, 895]] },
      eco: { id: 'eco', label: '節能路線 (經明治通)', durationMin: 17, distanceKm: 4.6, arrivalSoc: 81, points: [[340, 380], [385, 530], [405, 730], [375, 895]] },
      notoll: { id: 'notoll', label: '免收費替代路線', durationMin: 19, distanceKm: 5.2, arrivalSoc: 80, points: [[340, 380], [350, 600], [345, 780], [375, 895]] }
    }
  },
  {
    id: 'poi-meiji',
    name: '明治神宮外苑銀杏並木',
    category: 'landmark',
    address: '港區北青山 2-1',
    mapX: 555,
    mapY: 545,
    distanceKm: 2.8,
    powerKw: 0,
    availableStalls: 0,
    totalStalls: 0,
    routes: {
      fastest: { id: 'fastest', label: '最快路線 (經甲州街道)', durationMin: 9, distanceKm: 2.8, arrivalSoc: 81, points: [[340, 380], [435, 435], [505, 490], [555, 545]] },
      eco: { id: 'eco', label: '節能路線 (經千駄谷)', durationMin: 11, distanceKm: 2.6, arrivalSoc: 81, points: [[340, 380], [395, 480], [480, 525], [555, 545]] },
      notoll: { id: 'notoll', label: '外苑環狀路線', durationMin: 12, distanceKm: 3.1, arrivalSoc: 81, points: [[340, 380], [475, 390], [545, 455], [555, 545]] }
    }
  },
  {
    id: 'poi-kokyo',
    name: '皇居外苑 · 楠公停車場',
    category: 'landmark',
    address: '千代田區皇居外苑 1-1',
    mapX: 790,
    mapY: 455,
    distanceKm: 6.1,
    powerKw: 0,
    availableStalls: 0,
    totalStalls: 0,
    routes: {
      fastest: { id: 'fastest', label: '最快路線 (經新宿通)', durationMin: 16, distanceKm: 6.1, arrivalSoc: 80, points: [[340, 380], [490, 405], [645, 425], [790, 455]] },
      eco: { id: 'eco', label: '節能路線 (經內堀通)', durationMin: 18, distanceKm: 5.9, arrivalSoc: 80, points: [[340, 380], [480, 355], [660, 380], [790, 455]] },
      notoll: { id: 'notoll', label: '免收費幹線', durationMin: 20, distanceKm: 6.4, arrivalSoc: 79, points: [[340, 380], [450, 475], [620, 490], [790, 455]] }
    }
  }
];

// 數值與型別驗證輔助函式
function clampNum(val, min, max, fallback) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

function validEnum(val, allowed, fallback) {
  return allowed.includes(val) ? val : fallback;
}

function validBool(val, fallback) {
  return typeof val === 'boolean' ? val : fallback;
}

export function createDefaultState() {
  return {
    configId: DEFAULT_VEHICLE_CONFIG_ID,

    // 階段一：車輛保持駐停，不模擬行駛
    vehicle: {
      gear: 'P',
      speedKmh: 0,
      socPercent: 82,
      ratedRangeKm: 468,
      locked: false,
      odometerKm: 14826,
      insideTempC: 21.5,
      outsideTempC: 18.0,
      frunkOpen: false,
      trunkOpen: false,
      chargePortOpen: false,
      chargePortUnlocked: false,
      gloveboxOpen: false,
      mirrorsFolded: false,
      windowsLocked: false,
      childLockMode: 'off', // 'off' | 'left' | 'right' | 'both'
      wipersMode: 'auto', // 'off' | 'I' | 'II' | 'III' | 'auto'
      parkBrake: true
    },

    // 左側 3D 車輛視圖狀態（收合俯視 vs 展開低角度前 3/4 視角）
    camera3D: {
      expanded: false, // false = 收合俯視 (Top-Down), true = 展開低角度前 3/4 視角
      yawDeg: 36,
      pitchDeg: 18,
      defaultYawDeg: 36,
      defaultPitchDeg: 18,
      isDragging: false,
      lastInteractAt: 0,
      inactivityRemainingSec: 0,
      wheelZoomBlockedCount: 0
    },

    // 底部空調抽屜與 3D 氣流控制
    climate: {
      drawerOpen: false,
      subView: 'climate', // 'climate' | 'seats'
      power: true,
      driverTempC: 21.0,
      passengerTempC: 21.5,
      syncTemp: true,
      fanSpeed: 5, // 1..10
      autoMode: true,
      acEnabled: true,
      recirculate: true,
      frontDefrost: false,
      rearDefrost: false,
      campKeepMode: 'off', // 'off' | 'keep' | 'dog' | 'camp'
      steeringWheelHeat: 0, // 0 | 1 | 2
      // 3D 座艙可拖動出風方向正規化座標 (0.15~0.85)
      ventLeft: { x: 0.32, y: 0.48 },
      ventRight: { x: 0.68, y: 0.48 }
    },

    // 前排座椅位置與加熱（持久化於 localStorage）
    seats: {
      activeSide: 'driver', // 'driver' | 'passenger'
      driver: {
        foreAftMm: 0, // -50 ~ +50 mm
        reclineDeg: 24, // 15° ~ 45°
        heightMm: 0, // -20 ~ +20 mm
        heatLevel: 1 // 0..3
      },
      passenger: {
        foreAftMm: 6,
        reclineDeg: 26,
        heightMm: 0,
        heatLevel: 0
      }
    },

    // 導航與 OSM 底圖互動層（駐停演示）
    navigation: {
      egoX: 340, // 新宿都廳前駐停座標
      egoY: 380,
      panX: 0,
      panY: 0,
      zoom: 1.0, // 0.75 ~ 1.85
      searchQuery: '',
      showSuperchargers: true,
      showTrafficLayer: true,
      selectedPoiId: 'poi-roppongi',
      selectedRouteId: 'fastest', // 'fastest' | 'eco' | 'notoll'
      routeCompareOpen: false,
      demoGuidanceActive: false,
      routeLoading: false
    },

    // 音樂播放（緊湊卡片與地圖疊層播放窗同步）
    media: {
      playerWindowExpanded: false,
      volumePopoverOpen: false,
      playing: true,
      trackIndex: 0,
      progressSec: 68,
      volume: 65, // 0..100
      muted: false,
      favorites: ['m1', 'm3'],
      queue: [0, 1, 2, 3, 4]
    },

    // 12 大官方手冊設置分類狀態與偏好（持久化於 localStorage）
    settings: {
      drawerOpen: false,
      activeCategory: 'controls', // 'controls'|'dynamics'|'charging'|'autopilot'|'locks'|'lights'|'display'|'trips'|'schedule'|'safety'|'service'|'software'
      activeDialog: null, // null | 'mirrors' | 'steering' | 'releaseNotes' | 'factoryReset' | 'powerOff'

      // 動態 / 踏板與轉向
      accelMode: 'standard', // 'chill' | 'standard'
      steeringWeight: 'standard', // 'comfort' | 'standard' | 'sport'
      stoppingMode: 'hold', // 'creep' | 'roll' | 'hold'
      slipStart: false,

      // 充電
      chargeLimitPercent: 80, // 50..100
      chargeCurrentAmps: 32, // 5..48

      // 自動輔助駕駛
      cruiseFollowDistance: 3, // 1..7
      autosteerEnabled: true,
      navigateOnAutopilot: true,
      autoLaneChange: true,
      greenLightChime: true,
      speedLimitOffsetKmh: 0, // -10..+10
      blindSpotCamera: true,
      laneDepartureAvoidance: 'assist', // 'off' | 'warn' | 'assist'
      forwardCollisionWarning: 'medium', // 'off' | 'late' | 'medium' | 'early'
      autoEmergencyBraking: true,

      // 車鎖与演示鑰匙
      walkAwayLock: true,
      excludeHomeWalkAway: false,
      driveAutoLock: true,
      unlockOnPark: true,
      driverDoorUnlockMode: false,
      lockConfirmationSound: true,
      closeWindowsOnLock: true,
      keysList: [
        { id: 'k1', name: '車主的 iPhone 16 Pro', type: '手機鑰匙', active: true },
        { id: 'k2', name: 'Model 3 NFC 鑰匙卡 A', type: 'NFC 卡片', active: true },
        { id: 'k3', name: 'Model 3 備用鑰匙卡 B', type: 'NFC 卡片', active: false }
      ],

      // 車燈
      headlightsMode: 'auto', // 'off' | 'parking' | 'on' | 'auto'
      autoHighBeam: true,
      frontFogLights: false,
      domeLightsMode: 'auto', // 'off' | 'on' | 'auto'
      steeringWheelLights: true,
      headlightsAfterExit: true,

      // 顯示
      appearanceTheme: 'night', // 'day' | 'night' | 'auto'
      brightnessPercent: 85, // 20..100
      autoBrightness: true,
      touchscreenChime: true,
      energyDisplayMode: 'percent', // 'percent' | 'distance'
      timeFormat: '24h', // '12h' | '24h'
      textSize: 'standard', // 'standard' | 'large'

      // 行程
      trips: {
        currentDriveKm: 0.0,
        currentDriveMin: 0,
        currentDriveWhKm: 146,
        sinceChargeKm: 64.2,
        sinceChargeWhKm: 148,
        tripAKm: 382.5,
        tripAWhKm: 151,
        tripBKm: 1240.8,
        tripBWhKm: 154
      },

      // 日程與預約
      scheduledDepartureEnabled: true,
      scheduledDepartureTime: '08:00', // '07:30' | '08:00' | '08:30' | '09:00'
      preconditionCabin: true,
      weekdaysOnlySchedule: true,
      offPeakChargingEnabled: true,
      offPeakEndTime: '06:00', // '05:00' | '06:00' | '07:00'

      // 安全與保障
      sentryMode: true,
      dashcamMode: 'auto', // 'off' | 'manual' | 'auto'
      valetMode: false,
      speedLimitMode: false,
      maxSpeedLimitKmh: 120, // 80..145
      pinToDrive: false,
      gloveboxPinEnabled: false,
      cabinOverheatProtection: 'on', // 'off' | 'no_ac' | 'on'

      // 維護與服務 + 臨時模式
      tiresBar: { fl: 2.90, fr: 2.90, rl: 2.92, rr: 2.90 },
      wiperServiceMode: false,
      jackMode: false,
      carWashMode: false,
      towMode: false,
      screenCleanMode: false,

      // 軟件
      softwareVersion: '2024.38.6 (FSD 12.5.4)',
      updatePreference: 'advanced', // 'standard' | 'advanced'
      checkingForUpdate: false,
      lastUpdateCheckText: '今日 16:00 已檢查：目前為最新版本'
    },

    // 臨時模式覆蓋前之原始偏好快照（退出臨時模式時精確還原）
    tempSnapshots: {
      carWash: null,
      tow: null,
      screenClean: null
    },

    // 最近一次 localStorage 驗證報告（供自動化測試與行為對照表檢驗）
    storageValidationReport: {
      loadedFromStorage: false,
      sanitizedFields: [],
      lastSavedAt: null
    },

    toast: null
  };
}

/**
 * 嚴格驗證並合併從 localStorage 讀取的資料
 * 任何型別錯誤、NaN 或超出合理範圍的數值均會被攔截並記錄於 `sanitizedFields`
 */
export function validateAndHydrateState(baseState, rawObj) {
  const sanitized = [];
  if (!rawObj || typeof rawObj !== 'object') {
    return { state: baseState, sanitizedFields: ['root_not_object'] };
  }

  // 1. 驗證前排座椅位置与靠背角度
  if (rawObj.seats && typeof rawObj.seats === 'object') {
    for (const side of ['driver', 'passenger']) {
      const src = rawObj.seats[side];
      if (src && typeof src === 'object') {
        const def = baseState.seats[side];
        if (typeof src.foreAftMm !== 'number' || src.foreAftMm < -50 || src.foreAftMm > 50) {
          sanitized.push(`seats.${side}.foreAftMm`);
        }
        def.foreAftMm = clampNum(src.foreAftMm, -50, 50, def.foreAftMm);

        if (typeof src.reclineDeg !== 'number' || src.reclineDeg < 15 || src.reclineDeg > 45) {
          sanitized.push(`seats.${side}.reclineDeg`);
        }
        def.reclineDeg = clampNum(src.reclineDeg, 15, 45, def.reclineDeg);

        if (typeof src.heightMm !== 'number' || src.heightMm < -20 || src.heightMm > 20) {
          sanitized.push(`seats.${side}.heightMm`);
        }
        def.heightMm = clampNum(src.heightMm, -20, 20, def.heightMm);

        def.heatLevel = clampNum(src.heatLevel, 0, 3, def.heatLevel);
      }
    }
  }

  // 2. 驗證空調偏好
  if (rawObj.climate && typeof rawObj.climate === 'object') {
    const c = rawObj.climate;
    if (c.driverTempC !== undefined) {
      if (typeof c.driverTempC !== 'number' || c.driverTempC < 15 || c.driverTempC > 28) {
        sanitized.push('climate.driverTempC');
      }
      baseState.climate.driverTempC = clampNum(c.driverTempC, 15, 28, baseState.climate.driverTempC);
    }
    if (c.passengerTempC !== undefined) {
      if (typeof c.passengerTempC !== 'number' || c.passengerTempC < 15 || c.passengerTempC > 28) {
        sanitized.push('climate.passengerTempC');
      }
      baseState.climate.passengerTempC = clampNum(c.passengerTempC, 15, 28, baseState.climate.passengerTempC);
    }
    if (c.fanSpeed !== undefined) {
      if (typeof c.fanSpeed !== 'number' || c.fanSpeed < 1 || c.fanSpeed > 10) {
        sanitized.push('climate.fanSpeed');
      }
      baseState.climate.fanSpeed = Math.round(clampNum(c.fanSpeed, 1, 10, baseState.climate.fanSpeed));
    }
  }

  // 3. 驗證設置偏好與演示鑰匙列表
  if (rawObj.settings && typeof rawObj.settings === 'object') {
    const s = rawObj.settings;
    const dst = baseState.settings;

    if (s.accelMode !== undefined) {
      if (!['chill', 'standard'].includes(s.accelMode)) sanitized.push('settings.accelMode');
      dst.accelMode = validEnum(s.accelMode, ['chill', 'standard'], dst.accelMode);
    }
    if (s.steeringWeight !== undefined) {
      if (!['comfort', 'standard', 'sport'].includes(s.steeringWeight)) sanitized.push('settings.steeringWeight');
      dst.steeringWeight = validEnum(s.steeringWeight, ['comfort', 'standard', 'sport'], dst.steeringWeight);
    }
    if (s.stoppingMode !== undefined) {
      if (!['creep', 'roll', 'hold'].includes(s.stoppingMode)) sanitized.push('settings.stoppingMode');
      dst.stoppingMode = validEnum(s.stoppingMode, ['creep', 'roll', 'hold'], dst.stoppingMode);
    }
    if (s.chargeLimitPercent !== undefined) {
      if (typeof s.chargeLimitPercent !== 'number' || s.chargeLimitPercent < 50 || s.chargeLimitPercent > 100) {
        sanitized.push('settings.chargeLimitPercent');
      }
      dst.chargeLimitPercent = Math.round(clampNum(s.chargeLimitPercent, 50, 100, dst.chargeLimitPercent));
    }
    if (s.brightnessPercent !== undefined) {
      if (typeof s.brightnessPercent !== 'number' || s.brightnessPercent < 20 || s.brightnessPercent > 100) {
        sanitized.push('settings.brightnessPercent');
      }
      dst.brightnessPercent = Math.round(clampNum(s.brightnessPercent, 20, 100, dst.brightnessPercent));
    }
    if (s.appearanceTheme !== undefined) {
      if (!['day', 'night', 'auto'].includes(s.appearanceTheme)) sanitized.push('settings.appearanceTheme');
      dst.appearanceTheme = validEnum(s.appearanceTheme, ['day', 'night', 'auto'], dst.appearanceTheme);
    }
    if (s.autosteerEnabled !== undefined) dst.autosteerEnabled = validBool(s.autosteerEnabled, dst.autosteerEnabled);
    if (s.walkAwayLock !== undefined) dst.walkAwayLock = validBool(s.walkAwayLock, dst.walkAwayLock);
    if (s.headlightsMode !== undefined) {
      dst.headlightsMode = validEnum(s.headlightsMode, ['off', 'parking', 'on', 'auto'], dst.headlightsMode);
    }

    // 驗證演示鑰匙陣列
    if (s.keysList !== undefined) {
      if (!Array.isArray(s.keysList) || s.keysList.length === 0) {
        sanitized.push('settings.keysList');
      } else {
        const validKeys = s.keysList
          .filter((k) => k && typeof k === 'object' && typeof k.id === 'string' && typeof k.name === 'string' && k.name.trim().length > 0)
          .map((k) => ({
            id: String(k.id).slice(0, 24),
            name: String(k.name).trim().slice(0, 32),
            type: validEnum(k.type, ['手機鑰匙', 'NFC 卡片', '智慧手錶'], 'NFC 卡片'),
            active: Boolean(k.active)
          }));
        if (validKeys.length > 0) {
          dst.keysList = validKeys;
        } else {
          sanitized.push('settings.keysList_items');
        }
      }
    }
  }

  // 4. 驗證音樂收藏列表
  if (rawObj.media && Array.isArray(rawObj.media.favorites)) {
    const allowedTrackIds = FICTIONAL_TRACKS.map((t) => t.id);
    baseState.media.favorites = rawObj.media.favorites.filter((id) => allowedTrackIds.includes(id));
  }

  return { state: baseState, sanitizedFields: sanitized };
}

export class Phase1Store {
  constructor() {
    this.state = createDefaultState();
    this.listeners = new Set();
    this.loadFromLocalStorage();
  }

  getState() {
    return this.state;
  }

  getVehicleConfig() {
    return getVehicleConfig(this.state.configId);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(changedTags = ['all']) {
    for (const fn of this.listeners) {
      fn(this.state, changedTags);
    }
  }

  update(mutator, tags = ['ui']) {
    mutator(this.state);
    this.enforceDependencyInvariants();
    this.saveToLocalStorage();
    this.notify(tags);
  }

  /**
   * 當主開關關閉時，強制同步子依賴狀態的一致性
   */
  enforceDependencyInvariants() {
    const s = this.state;
    // 1. 大燈設為「關閉」時，前霧燈與自動遠光不能保持啟用
    if (s.settings.headlightsMode === 'off') {
      s.settings.frontFogLights = false;
      s.settings.autoHighBeam = false;
    }
    // 2. 自動輔助轉向關閉時，自動輔助導航駕駛與自動變道關閉
    if (!s.settings.autosteerEnabled) {
      s.settings.navigateOnAutopilot = false;
      s.settings.autoLaneChange = false;
    }
    // 3. 充電口關閉時，充電口解鎖狀態重設
    if (!s.vehicle.chargePortOpen) {
      s.vehicle.chargePortUnlocked = false;
    }
    // 4. 限速模式開啟時，加速模式強制為「舒適 (chill)」
    if (s.settings.speedLimitMode) {
      s.settings.accelMode = 'chill';
    }
  }

  /**
   * 查詢指定設置項或控制項是否因依賴關係或臨時模式而被禁用，並回傳明確原因字串
   */
  getControlDependency(controlId) {
    const s = this.state;

    // 洗車模式啟用時的聯鎖禁用
    if (s.settings.carWashMode) {
      if (['wipersMode', 'chargePortOpen', 'frunkOpen', 'trunkOpen', 'walkAwayLock'].includes(controlId)) {
        return {
          disabled: true,
          reason: '洗車模式啟用中：已自動關閉雨刮、鎖定備箱/充電口並停用離車上鎖'
        };
      }
    }

    switch (controlId) {
      case 'frontFogLights':
        if (s.settings.headlightsMode === 'off') {
          return { disabled: true, reason: '需先開啟「近光燈」或「自動大燈」才可啟用前霧燈' };
        }
        break;
      case 'autoHighBeam':
        if (s.settings.headlightsMode === 'off' || s.settings.headlightsMode === 'parking') {
          return { disabled: true, reason: '需將大燈設為「開啟」或「自動」才可使用自動遠光燈' };
        }
        break;
      case 'navigateOnAutopilot':
      case 'autoLaneChange':
        if (!s.settings.autosteerEnabled) {
          return { disabled: true, reason: '需先開啟「自動輔助轉向 (Autosteer)」才可啟用此進階功能' };
        }
        break;
      case 'unlockChargePort':
        if (!s.vehicle.chargePortOpen) {
          return { disabled: true, reason: '充電口蓋目前已關閉，需先開啟充電口蓋才可解鎖充電口' };
        }
        break;
      case 'excludeHomeWalkAway':
      case 'closeWindowsOnLock':
        if (!s.settings.walkAwayLock) {
          return { disabled: true, reason: '需先開啟「離車後自動上鎖」才可配置此關聯選項' };
        }
        break;
      case 'accelMode':
        if (s.settings.speedLimitMode) {
          return { disabled: true, reason: '限速模式啟用中：加速模式已強制鎖定為「舒適」' };
        }
        break;
      case 'maxSpeedLimitKmh':
        if (!s.settings.speedLimitMode) {
          return { disabled: true, reason: '需先啟用「限速模式」才可調整最高限速設定值' };
        }
        break;
      case 'preconditionCabin':
      case 'weekdaysOnlySchedule':
        if (!s.settings.scheduledDepartureEnabled) {
          return { disabled: true, reason: '需先開啟「預約出發」排程才可配置預熱與週期選項' };
        }
        break;
      case 'offPeakEndTime':
        if (!s.settings.offPeakChargingEnabled) {
          return { disabled: true, reason: '需先開啟「離峰充電」排程才可設定離峰結束時間' };
        }
        break;
      case 'climateFanAndVents':
        if (!s.climate.power) {
          return { disabled: true, reason: '空調系統電源已關閉，請先點擊「空調電源」開啟系統' };
        }
        break;
      default:
        break;
    }
    return { disabled: false, reason: '' };
  }

  /**
   * 切換臨時模式（洗車模式、牽引模式、屏幕清潔模式）
   * 啟用時保存原偏好快照並執行覆蓋；退出時精確恢復原偏好！
   */
  toggleTemporaryMode(modeKey) {
    const s = this.state;

    if (modeKey === 'carWashMode') {
      const next = !s.settings.carWashMode;
      if (next) {
        s.tempSnapshots.carWash = {
          wipersMode: s.vehicle.wipersMode,
          walkAwayLock: s.settings.walkAwayLock,
          chargePortOpen: s.vehicle.chargePortOpen,
          recirculate: s.climate.recirculate,
          mirrorsFolded: s.vehicle.mirrorsFolded,
          windowsLocked: s.vehicle.windowsLocked
        };
        s.settings.carWashMode = true;
        s.vehicle.wipersMode = 'off';
        s.settings.walkAwayLock = false;
        s.vehicle.chargePortOpen = false;
        s.climate.recirculate = true;
        s.vehicle.mirrorsFolded = true;
        s.vehicle.windowsLocked = true;
        this.showToast('已進入洗車模式：已升起車窗、關閉雨刮、開啟空調內循環並停用離車自動上鎖');
      } else {
        s.settings.carWashMode = false;
        const snap = s.tempSnapshots.carWash;
        if (snap) {
          s.vehicle.wipersMode = snap.wipersMode;
          s.settings.walkAwayLock = snap.walkAwayLock;
          s.vehicle.chargePortOpen = snap.chargePortOpen;
          s.climate.recirculate = snap.recirculate;
          s.vehicle.mirrorsFolded = snap.mirrorsFolded;
          s.vehicle.windowsLocked = snap.windowsLocked;
          s.tempSnapshots.carWash = null;
        }
        this.showToast('已退出洗車模式：已完整恢復您原有的雨刮、車鎖與空調偏好');
      }
      this.saveToLocalStorage();
      this.notify(['temp-mode', 'ui']);
      return;
    }

    if (modeKey === 'towMode') {
      const next = !s.settings.towMode;
      if (next) {
        s.tempSnapshots.tow = {
          parkBrake: s.vehicle.parkBrake,
          stoppingMode: s.settings.stoppingMode
        };
        s.settings.towMode = true;
        s.vehicle.parkBrake = false;
        s.settings.stoppingMode = 'roll';
        this.showToast('已開啟牽引模式：電子手煞車已解除，車輛保持自由滑行狀態');
      } else {
        s.settings.towMode = false;
        const snap = s.tempSnapshots.tow;
        if (snap) {
          s.vehicle.parkBrake = snap.parkBrake;
          s.settings.stoppingMode = snap.stoppingMode;
          s.tempSnapshots.tow = null;
        } else {
          s.vehicle.parkBrake = true;
          s.settings.stoppingMode = 'hold';
        }
        this.showToast('已退出牽引模式：電子手煞車與保持模式已恢復');
      }
      this.saveToLocalStorage();
      this.notify(['temp-mode', 'ui']);
      return;
    }

    if (modeKey === 'screenCleanMode') {
      const next = !s.settings.screenCleanMode;
      if (next) {
        s.tempSnapshots.screenClean = {
          settingsDrawerOpen: s.settings.drawerOpen,
          climateDrawerOpen: s.climate.drawerOpen
        };
        s.settings.screenCleanMode = true;
      } else {
        s.settings.screenCleanMode = false;
        const snap = s.tempSnapshots.screenClean;
        if (snap) {
          s.settings.drawerOpen = snap.settingsDrawerOpen;
          s.climate.drawerOpen = snap.climateDrawerOpen;
          s.tempSnapshots.screenClean = null;
        }
        this.showToast('已退出屏幕清潔模式');
      }
      this.notify(['screen-clean', 'ui']);
    }
  }

  loadFromLocalStorage() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const { sanitizedFields } = validateAndHydrateState(this.state, parsed);
      this.state.storageValidationReport = {
        loadedFromStorage: true,
        sanitizedFields,
        lastSavedAt: parsed._savedAt || null
      };
      this.enforceDependencyInvariants();
    } catch (err) {
      this.state.storageValidationReport = {
        loadedFromStorage: false,
        sanitizedFields: ['json_parse_error'],
        lastSavedAt: null
      };
    }
  }

  saveToLocalStorage() {
    try {
      const payload = {
        _savedAt: new Date().toISOString(),
        seats: this.state.seats,
        climate: {
          driverTempC: this.state.climate.driverTempC,
          passengerTempC: this.state.climate.passengerTempC,
          fanSpeed: this.state.climate.fanSpeed
        },
        settings: {
          accelMode: this.state.settings.accelMode,
          steeringWeight: this.state.settings.steeringWeight,
          stoppingMode: this.state.settings.stoppingMode,
          chargeLimitPercent: this.state.settings.chargeLimitPercent,
          brightnessPercent: this.state.settings.brightnessPercent,
          appearanceTheme: this.state.settings.appearanceTheme,
          autosteerEnabled: this.state.settings.autosteerEnabled,
          walkAwayLock: this.state.settings.walkAwayLock,
          headlightsMode: this.state.settings.headlightsMode,
          keysList: this.state.settings.keysList
        },
        media: {
          favorites: this.state.media.favorites
        }
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      this.state.storageValidationReport.lastSavedAt = payload._savedAt;
    } catch (_e) {
      // 忽略私密瀏覽配額限制
    }
  }

  showToast(message) {
    this.state.toast = { message, id: Date.now() };
    this.notify(['toast']);
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.state.toast = null;
      this.notify(['toast']);
    }, 3200);
  }
}

export const phase1Store = new Phase1Store();
