/**
 * 資料驅動車型配置 (Data-Driven Vehicle Configurations)
 * -----------------------------------------------------------------------------
 * 依據規則：
 * 1. 每個車型配置包含：車型名稱、3D 模型路徑與授權來源、中控屏尺寸與比例、
 *    是否有方向盤後儀錶盤、是否有後排屏、對應官方車主手冊連結。
 * 2. 階段一至三僅啟用 Model 3 配置，先把中控屏、狀態機與手機 App 的交互深度做到位。
 * 3. Model S (2021+ 改款) 配置結構已預留，但因本地目前僅有 Tesla Model 3 真實 GLB 模型，
 *    尚無 CC0 / CC-BY 授權之真實 Model S GLB 模型，依規則絕不用 Model 3 車身冒充，
 *    故階段一至三將 Model S 設為 `available: false` 並如實標明原因。
 */

export const VEHICLE_CONFIGS = {
  model3: {
    id: 'model3',
    name: 'Model 3',
    fullName: 'Tesla Model 3 (2017–2023)',
    trimName: '雙電機全輪驅動版',
    available: true,
    phaseNote: '階段一至三當前啟用車型',
    model3D: {
      url: './assets/models/tesla-model-3.glb',
      format: 'GLB (Three.js GLTFLoader + DRACOLoader)',
      author: 'Ameer Studio',
      sourceUrl: 'https://sketchfab.com/3d-models/tesla-model-3-055238c528d24585a351d52de685d79d',
      license: 'CC-BY-4.0'
    },
    centerScreen: {
      diagonalInch: 15.4,
      designWidth: 1920,
      designHeight: 1200,
      aspectRatioLabel: '16:10',
      supportsTilt: false
    },
    hasInstrumentCluster: false,
    hasRearScreen: false,
    hasPassengerScreen: false,
    manual: {
      title: 'Tesla Model 3 車主手冊 (2017–2023 中文版)',
      url: 'https://www.tesla.com/ownersmanual/model3/zh_tw/',
      uiReferences: [
        { name: 'RyanZeeee/Tesla-UI-prototype (僅參考功能結構，代碼完全獨立重寫)', url: 'https://github.com/RyanZeeee/Tesla-UI-prototype' },
        { name: 'teslaui.com (僅參考中控佈局與交互結構)', url: 'https://www.teslaui.com/' }
      ]
    }
  },

  models: {
    id: 'models',
    name: 'Model S',
    fullName: 'Tesla Model S (2021+ 改款)',
    trimName: 'Plaid 三電機全輪驅動版',
    available: false,
    unavailableReason: '本地目前僅有 CC-BY 授權之真实 Model 3 GLB 模型，尚無 CC0/CC-BY 之真實 Model S 3D 模型；依規則不以 Model 3 車身冒充，故暫不上線。',
    phaseNote: '階段四預留配置（待引入真實 Model S GLB 模型後啟用）',
    model3D: {
      url: null,
      format: 'GLB (待提供真實 Model S CC0/CC-BY 模型)',
      author: '待補充',
      sourceUrl: '',
      license: 'CC0 / CC-BY'
    },
    centerScreen: {
      diagonalInch: 17.0,
      designWidth: 2200,
      designHeight: 1300,
      aspectRatioLabel: '2200:1300',
      supportsTilt: true
    },
    hasInstrumentCluster: true,
    hasRearScreen: true,
    hasPassengerScreen: true,
    manual: {
      title: 'Tesla Model S 車主手冊 (2021+ 中文版)',
      url: 'https://www.tesla.com/ownersmanual/models/zh_tw/',
      uiReferences: [
        { name: 'Tesla Model S 官方車主手冊 — 儀錶板與觸控螢幕總覽', url: 'https://www.tesla.com/ownersmanual/models/zh_tw/' }
      ]
    }
  }
};

export const DEFAULT_VEHICLE_CONFIG_ID = 'model3';

export function getVehicleConfig(configId = DEFAULT_VEHICLE_CONFIG_ID) {
  const cfg = VEHICLE_CONFIGS[configId];
  if (cfg && cfg.available) return cfg;
  return VEHICLE_CONFIGS.model3;
}
