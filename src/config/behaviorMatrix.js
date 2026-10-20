/**
 * 階段一：Model 3 中控屏 — 行為與官方手冊對照表 (Behavior & Reference Matrix)
 * -----------------------------------------------------------------------------
 * 嚴格遵循規範：
 * 1. 每個功能與設置項均標明《Tesla Model 3 車主手冊 (2017–2023 中文版)》對應章節，
 *    或開源結構參考 (RyanZeeee/Tesla-UI-prototype、teslaui.com)。
 * 2. 無官方手冊或參考依據之功能一律刪除；所有代碼與視覺素材 100% 獨立撰寫。
 * 3. 記錄每項功能的依賴禁用規則、臨時模式覆蓋邏輯、自動化測試截圖檔名與驗收結果。
 */

export const PHASE1_REFERENCE_SOURCES = [
  {
    id: 'manual-m3',
    title: 'Tesla Model 3 車主手冊 (2017–2023 中文版)',
    url: 'https://www.tesla.com/ownersmanual/model3/zh_tw/',
    usage: '核心功能定義、12 大設置分類結構、空調與除霜邏輯、臨時模式（洗車/牽引/屏幕清潔）與安全依賴聯鎖規則依據。'
  },
  {
    id: 'ref-ryanzeeee',
    title: 'RyanZeeee / Tesla-UI-prototype',
    url: 'https://github.com/RyanZeeee/Tesla-UI-prototype',
    usage: '僅學習中控屏左車右圖分欄、收合俯視與展開低角度三四分之一視角、底欄 Dock 抽屜結構；未複製任何程式碼或素材。'
  },
  {
    id: 'ref-teslaui',
    title: 'teslaui.com 車機介面結構研究',
    url: 'https://www.teslaui.com/',
    usage: '僅參考車門/備箱/充電口指向線排布、緊湊音樂卡與地圖疊層播放窗同步結構；全部組件與樣式均獨立重寫。'
  },
  {
    id: 'ref-osm',
    title: 'OpenStreetMap 開放街圖數據',
    url: 'https://www.openstreetmap.org/copyright',
    usage: '導航底圖離線預渲染道路、水系、綠地與街廓數據來源（界面常駐標註 © OpenStreetMap contributors）。'
  },
  {
    id: 'ref-sketchfab',
    title: 'Tesla Model 3 3D GLB 模型 (作者：Ameer Studio · CC-BY-4.0)',
    url: 'https://sketchfab.com/3d-models/tesla-model-3-055238c528d24585a351d52de685d79d',
    usage: '左側 3D 車輛視圖真實載入之 GLB 模型資產。'
  }
];

export const PHASE1_BEHAVIOR_MATRIX = [
  // 一、基礎佈局與 3D 車輛視圖
  {
    id: 'P1-01',
    category: '1. 畫布與整體結構',
    feature: '固定 1920×1200 設計畫布等比縮放 + 左車右圖 + 底部常駐 Dock',
    reference: '《Model 3 車主手冊》「觸控螢幕總覽」；teslaui.com 結構',
    ruleOrBehavior: '固定 1920×1200 畫布隨任意視窗等比縮放不重排；Dock 含車控入口、左溫控、空調入口、應用圖標、右溫控、音量。',
    implemented: true,
    screenshot: 'p1_01_main_collapsed_topdown.png',
    status: '已達成'
  },
  {
    id: 'P1-02',
    category: '2. 3D 車輛視圖與視角控制',
    feature: '收合時正俯視、展開時低角度前方 3/4 視角；僅展開可旋轉、5 秒回正、雙擊重置、禁滾輪縮放',
    reference: 'RyanZeeee/Tesla-UI-prototype 視角行為；《Model 3 車主手冊》「主畫面車輛視圖」',
    ruleOrBehavior: '收合時固定正俯視且禁止拖動旋轉；展開時切換為低角度前 3/4 視角，支援滑鼠拖動與方向鍵旋轉，5 秒無操作自動平滑回正，雙擊重置，全程禁用滾輪縮放。',
    implemented: true,
    screenshot: 'p1_02_expanded_34_view_and_rotate.png',
    status: '已達成'
  },
  {
    id: 'P1-03',
    category: '3. 前備箱、尾箱與充電口控制',
    feature: '車身指向線 + 開/關控制與真實開合動畫；收合時前備箱/尾箱在右側，充電口在左側',
    reference: '《Model 3 車主手冊》「前備箱、後備箱與充電口蓋」；teslaui.com 指向線佈局',
    ruleOrBehavior: '收合俯視時：充電口控制位於模型左側，前備箱與尾箱控制位於模型右側，均帶實時指向線連至車身部位，點擊觸發 3D 艙蓋開合動畫。',
    implemented: true,
    screenshot: 'p1_03_trunks_chargeport_open.png',
    status: '已達成'
  },

  // 二、空調與座椅
  {
    id: 'P1-04',
    category: '4. 空調底部抽屜',
    feature: '底部上滑抽屜、3D 座艙氣流動畫、可拖動出風方向、風量檔位 1-10、雙區溫度、空調電源、前後除霜開關',
    reference: '《Model 3 車主手冊》「恆溫控制 (Climate Controls)」',
    ruleOrBehavior: '從 Dock 上方滑出抽屜（300ms ease-out）；可直接在 3D 座艙畫布上拖動左右出風焦點改變氣流方向；前後除霜具備按下態與啟用態；空調電源關閉時禁用風量與出風拖動並顯示原因。',
    implemented: true,
    screenshot: 'p1_04_climate_drawer_airflow.png',
    status: '已達成'
  },
  {
    id: 'P1-05',
    category: '5. 前排座椅視圖',
    feature: '前排座椅視圖，可調前後位置、座墊高度與靠背角度，位置保存在 localStorage',
    reference: '《Model 3 車主手冊》「前排座椅調整與駕駛員設定檔」',
    ruleOrBehavior: '圖像化顯示前排座椅滑軌前後（-50~+50mm）與靠背傾角（15°~45°），調整即時渲染並寫入 localStorage（重整後保持並驗證數值範圍）。',
    implemented: true,
    screenshot: 'p1_05_seat_adjustment_view.png',
    status: '已達成'
  },

  // 三、導航與音樂
  {
    id: 'P1-06',
    category: '6. 導航地圖與路線比較',
    feature: 'OpenStreetMap 離線預渲染底圖 + 文字/地點/充電站/車標/路線獨立互動層 + 平移/縮放/回中/搜尋/路線比較/導航演示（保持停車）',
    reference: '《Model 3 車主手冊》「地圖與導航」；© OpenStreetMap contributors',
    ruleOrBehavior: '底圖使用預渲染之真實新宿區域 OSM 圖片並標註版權；上方疊加獨立 SVG/DOM 路線與地標層；支援拖動平移、縮放、回中、搜尋、超充站篩選、三條路線比較與導航演示（車輛保持 P 擋駐停不模擬行駛）。',
    implemented: true,
    screenshot: 'p1_06_navigation_route_compare.png',
    status: '已達成'
  },
  {
    id: 'P1-07',
    category: '7. 音樂卡片與疊層播放窗',
    feature: '緊湊音樂卡片與地圖疊層獨立播放窗雙向同步；5 首虛構曲目、封面、進度、上下首、收藏、佇列；點擊音量展開滑桿與靜音',
    reference: '《Model 3 車主手冊》「媒體與音訊」；RyanZeeee/Tesla-UI-prototype 媒體窗結構',
    ruleOrBehavior: '左下緊湊卡片與展開之獨立播放窗（疊於地圖上）共享播放進度、曲目、收藏與佇列；Dock 右下音量按鈕點擊展開滑桿與靜音開關。',
    implemented: true,
    screenshot: 'p1_07_music_player_and_volume.png',
    status: '已達成'
  },

  // 四、車輛設置（12 分類逐項對照官方手冊 + 依賴禁用 + 臨時模式 + localStorage 驗證）
  {
    id: 'P1-08-CTRL',
    category: '8. 設置 — 控制 (Controls)',
    feature: '車燈快捷、雨刮檔位、後視鏡折疊/調節對話框、方向盤調節對話框、車窗鎖、手套箱開啟',
    reference: '《Model 3 車主手冊》「控制 (Controls) 與快速控制」',
    ruleOrBehavior: '包含分段選擇、開關與後視鏡/方向盤調節對話框；開啟洗車模式時，雨刮器與車窗控制自動鎖定並顯示「洗車模式啟用中」原因。',
    implemented: true,
    screenshot: 'p1_08_settings_controls.png',
    status: '已達成'
  },
  {
    id: 'P1-08-DYN',
    category: '8. 設置 — 動態 / 踏板與轉向 (Pedals & Steering)',
    feature: '加速模式（舒適/標準）、轉向模式（舒適/標準/運動）、停止模式（緩行/轉動/保持）、濕滑路面脫困輔助',
    reference: '《Model 3 車主手冊》「踏板與轉向 (Pedals & Steering)」',
    ruleOrBehavior: '雙電機全輪驅動版提供「舒適 / 標準」加速與三段轉向手感；開啟「限速模式」時加速模式強制鎖定為「舒適」並禁用切換（顯示依賴原因）。',
    implemented: true,
    screenshot: 'p1_09_settings_dynamics.png',
    status: '已達成'
  },
  {
    id: 'P1-08-CHG',
    category: '8. 設置 — 充電 (Charging)',
    feature: '充電上限滑桿 (50%–100%)、充電電流調節 (5A–48A)、開啟/解鎖充電口、太陽能與超充計費資訊',
    reference: '《Model 3 車主手冊》「充電說明与充電設置」',
    ruleOrBehavior: '依賴規則：「解鎖充電口」僅在充電口蓋已開啟時可用；充電口關閉時呈現禁用態並顯示「需先開啟充電口蓋才可解鎖充電口」。',
    implemented: true,
    screenshot: 'p1_10_settings_charging.png',
    status: '已達成'
  },
  {
    id: 'P1-08-AP',
    category: '8. 設置 — 自動輔助駕駛 (Autopilot)',
    feature: '主動巡航跟車距離 (1–7 檔)、自動輔助轉向、自動輔助導航駕駛 (NoA)、自動變道、綠燈提示音、限速偏移、盲區鏡頭、車道偏離輔助、前撞預警',
    reference: '《Model 3 車主手冊》「Autopilot 自動輔助駕駛」',
    ruleOrBehavior: '依賴規則：當「自動輔助轉向」關閉時，「自動輔助導航駕駛 (NoA)」與「打燈自動變道」自動禁用並顯示原因「需先啟用自動輔助轉向」。',
    implemented: true,
    screenshot: 'p1_11_settings_autopilot_deps.png',
    status: '已達成'
  },
  {
    id: 'P1-08-LOCK',
    category: '8. 設置 — 車鎖 (Locks)',
    feature: '演示鑰匙清單（新增/啟停，持久化於 localStorage）、離車自動上鎖、行駛自動落鎖、P 擋自動解鎖、僅解鎖駕駛側、鎖車提示音、鎖車自動升窗、後排兒童鎖',
    reference: '《Model 3 車主手冊》「鑰匙與車門上鎖」',
    ruleOrBehavior: '依賴規則：當「離車自動上鎖」關閉時，「鎖車自動升窗」與「家庭地址排除自動上鎖」禁用並顯示原因。',
    implemented: true,
    screenshot: 'p1_12_settings_locks.png',
    status: '已達成'
  },
  {
    id: 'P1-08-LIGHT',
    category: '8. 設置 — 車燈 (Lights)',
    feature: '大燈模式（關閉/示廓燈/開啟/自動）、自動遠光燈、前霧燈、車頂閱讀燈、方向盤按鍵背光、離車大燈延時照明',
    reference: '《Model 3 車主手冊》「車內外車燈控制」',
    ruleOrBehavior: '依賴規則：當大燈模式設為「關閉」時，「前霧燈」與「自動遠光燈」自動禁用並顯示原因「需先開啟近光燈或自動大燈」。',
    implemented: true,
    screenshot: 'p1_13_settings_lights_deps.png',
    status: '已達成'
  },
  {
    id: 'P1-08-DISP',
    category: '8. 設置 — 顯示 (Display)',
    feature: '外觀主題（日間淺色/夜間深色/自動）、亮度滑桿、自動亮度調整、屏幕清潔模式入口、觸控音效、電量顯示方式（百分比/里程）、時間格式、字體大小',
    reference: '《Model 3 車主手冊》「顯示設定」',
    ruleOrBehavior: '調整手動亮度滑桿時自動關閉「自動亮度」或顯示覆蓋提示；支援日間白底與夜間深灰黑主題即時切換。',
    implemented: true,
    screenshot: 'p1_14_settings_display_day_mode.png',
    status: '已達成'
  },
  {
    id: 'P1-08-TRIP',
    category: '8. 設置 — 行程 (Trips)',
    feature: '當前行程、自上次充電後、行程 A、行程 B（里程、時間、平均能耗）、總里程表、重置行程按鈕',
    reference: '《Model 3 車主手冊》「行程資訊 (Trip Information)」',
    ruleOrBehavior: '提供行程 A / B 卡片顯示與獨立重置操作，重置後數據寫入狀態庫並給予視覺回饋。',
    implemented: true,
    screenshot: 'p1_15_settings_trips.png',
    status: '已達成'
  },
  {
    id: 'P1-08-SCHED',
    category: '8. 設置 — 日程與預約出發 (Schedule)',
    feature: '預約出發開關與時間設定、座艙預調恆溫、離峰充電開關、離峰結束時間、僅工作日執行',
    reference: '《Model 3 車主手冊》「預約充電與預計出發」',
    ruleOrBehavior: '依賴規則：當「預約出發」關閉時，「出發前座艙恆溫預調」與「僅工作日執行」禁用並顯示原因；「離峰充電」關閉時「離峰結束時間」禁用。',
    implemented: true,
    screenshot: 'p1_16_settings_schedule.png',
    status: '已達成'
  },
  {
    id: 'P1-08-SAFE',
    category: '8. 設置 — 安全與保障 (Safety)',
    feature: '哨兵模式、行車記錄儀自動錄影、代客模式、限速模式與最高限速滑桿、PIN 碼啟動、手套箱 PIN 碼、車廂過熱保護、電源關閉對話框',
    reference: '《Model 3 車主手冊》「安全與保障 (Safety & Security)」',
    ruleOrBehavior: '依賴規則：「最高限速設定滑桿」僅在「限速模式」開啟時可用；「車廂過熱保護無 A/C 模式」依賴車廂過熱保護主開關。',
    implemented: true,
    screenshot: 'p1_17_settings_safety.png',
    status: '已達成'
  },
  {
    id: 'P1-08-SRV',
    category: '8. 設置 — 服務与臨時模式 (Service)',
    feature: '四輪胎壓 (TPMS)、洗車模式（臨時覆蓋與恢復）、牽引模式（臨時覆蓋與恢復）、雨刮維護模式、千斤頂模式、車主手冊、恢復出廠預設對話框',
    reference: '《Model 3 車主手冊》「維護與服務 (Service) / 洗車模式 / 牽引說明」',
    ruleOrBehavior: '臨時模式測試：開啟「洗車模式」自動關閉雨刮、關閉充電口、停用離車上鎖並開啟空調內循環；關閉「洗車模式」後完整恢復使用者原本的各項偏好設定。',
    implemented: true,
    screenshot: 'p1_18_settings_service_carwash_override.png',
    status: '已達成'
  },
  {
    id: 'P1-08-SW',
    category: '8. 設置 — 軟件 (Software)',
    feature: '車輛型號與 VIN 資訊、車載電腦規格、當前軟件版本、發行說明對話框、軟件更新偏好（標準/進階）、檢查更新載入回饋',
    reference: '《Model 3 車主手冊》「軟件更新 (Software Updates)」',
    ruleOrBehavior: '顯示與實際載入模型一致的 Model 3 車型資訊；點擊「檢查更新」展示載入動畫態（Loading state），點擊「發行說明」開啟具焦點管理的對話框。',
    implemented: true,
    screenshot: 'p1_19_settings_software.png',
    status: '已達成'
  },

  // 五、屏幕清潔模式、鍵盤焦點與響應式等比縮放
  {
    id: 'P1-09',
    category: '9. 屏幕清潔模式與鍵盤焦點管理',
    feature: '全屏覆蓋屏蔽底層操作、按鈕或 Esc 退出；所有彈窗具鍵盤焦點管理',
    reference: '《Model 3 車主手冊》「觸控螢幕清潔模式」；WAI-ARIA Dialog Focus 規範',
    ruleOrBehavior: '開啟後覆蓋 1920×1200 全畫面並攔截底層點擊；支援按 Esc 或點擊/長按退出按鈕恢復；所有對話框開啟時自動聚焦首個可交互控件並支援 Esc 關閉。',
    implemented: true,
    screenshot: 'p1_20_screen_clean_mode.png',
    status: '已達成'
  },
  {
    id: 'P1-10',
    category: '10. 固定畫布等比縮放與無跑版驗證',
    feature: '1920×1200 固定畫布在任意窗口尺寸（如 1280×800、1440×900、960×640）下等比縮放不重排',
    reference: '階段一規範第 4 條：每個終端使用固定設計畫布，按窗口等比縮放，不重排',
    ruleOrBehavior: '透過 ResizeObserver 計算 min(windowWidth/1920, windowHeight/1200) 等比縮放，任何窗口大小下佈局與字級比例恆定不跑版。',
    implemented: true,
    screenshot: 'p1_21_responsive_scale_test.png',
    status: '已達成'
  }
];
