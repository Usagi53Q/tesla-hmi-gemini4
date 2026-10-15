/**
 * TESLA COCKPIT HMI — 100% OFFLINE SELF-DRAWN VECTOR NAVIGATION MAP & PASSENGER ENTERTAINMENT ENGINE
 * 精修重點：
 * 1. 導航地圖：完全移除所有外部網路瓦片與 API 依賴，畫面上絕無任何水印或錯誤提示！
 *    - 採用純自繪多層級離線向量地圖（水系、綠地、建築塊、支路街巷、次幹道、主幹道與高速路網分層繪製）
 *    - 導航路線為連續單一細線 (2.6px 單一連續藍線，無多層描邊或斷裂)
 *    - 地名標籤依縮放層級 (LOD: Tier 1 行政區 / Tier 2 商圈綠地 / Tier 3 道路與地標) 動態顯示
 *    - 自車依車速沿路線實時推進，地圖自動平滑跟車移動，並支援自由拖拽平移與滾輪/按鈕縮放
 * 2. 副駕娛樂屏：
 *    - 畫布 1:1 匹配容器真實長寬比，杜絕裁切！
 *    - 音樂模式同時完整繪製「專輯封面 + 旋轉黑膠唱片 + 1.5px 單色細線頻譜 + 同步歌詞」，完整顯示不截斷
 */

export class MapAndMediaEngine {
  constructor(store) {
    this.store = store;
    this.mapCanvas = null;
    this.mapCtx = null;
    this.mediaCanvas = null;
    this.mediaCtx = null;

    this.zoom = 14.2;
    this.targetZoom = 14.2;
    this.centerLat = 35.6765;
    this.centerLng = 139.7185;
    this.followCar = true;
    this.isPanning = false;

    this.superchargers = [
      {
        id: 'roppongi',
        name: '六本木新城 V4 超充',
        lat: 35.6604,
        lng: 139.7292,
        available: 12,
        total: 16,
        powerKw: 250,
        distKm: 5.4,
        etaMin: 11
      },
      {
        id: 'shinjuku',
        name: '新宿住友 V3 超充',
        lat: 35.6915,
        lng: 139.6910,
        available: 6,
        total: 8,
        powerKw: 250,
        distKm: 2.8,
        etaMin: 6
      },
      {
        id: 'daikanyama',
        name: '代官山 T-SITE 超充',
        lat: 35.6488,
        lng: 139.6997,
        available: 4,
        total: 6,
        powerKw: 250,
        distKm: 5.1,
        etaMin: 12
      },
      {
        id: 'marunouchi',
        name: '丸之內 V4 超充',
        lat: 35.6838,
        lng: 139.7686,
        available: 9,
        total: 12,
        powerKw: 250,
        distKm: 7.2,
        etaMin: 15
      }
    ];

    this.gpsRoutes = {
      roppongi: [
        [35.6896, 139.6921, '東京都廳前 · 新宿中央公園通り'],
        [35.6890, 139.6985, '甲州街道 (國道20號) 往四谷方向'],
        [35.6882, 139.7042, '新宿四丁目交叉口 · 明治通り'],
        [35.6838, 139.7082, '千駄ヶ谷 · 外苑西通り'],
        [35.6795, 139.7145, '國立競技場前 · 外苑東通り'],
        [35.6780, 139.7202, '信濃町站前 · 外苑東通り直行'],
        [35.6728, 139.7240, '青山一丁目交叉口 · 穿越青山通り'],
        [35.6665, 139.7268, '乃木坂隧道 · 外苑東通り'],
        [35.6628, 139.7314, '六本木交叉口 · 右轉進入六本木通り'],
        [35.6604, 139.7292, '抵達：六本木新城 P2 V4 超級充電站']
      ],
      shinjuku: [
        [35.6728, 139.7240, '青山一丁目 · 青山通り (國道246號)'],
        [35.6780, 139.7202, '信濃町 · 外苑東通り往新宿方向'],
        [35.6838, 139.7082, '千駄ヶ谷 · 明治通り北上'],
        [35.6882, 139.7042, '新宿四丁目 · 左轉進入甲州街道'],
        [35.6890, 139.6985, '新宿站南口 · 甲州街道西行'],
        [35.6895, 139.6945, '西新宿一丁目 · 右轉議事堂通り'],
        [35.6902, 139.6915, '東京都廳北交叉口'],
        [35.6915, 139.6910, '抵達：新宿住友大廈 B1 V3 超級充電站']
      ],
      daikanyama: [
        [35.6882, 139.7042, '新宿四丁目 · 明治通り南下'],
        [35.6815, 139.7050, '北參道 · 明治通り直行'],
        [35.6715, 139.7052, '神宮前交叉口 · 原宿表參道'],
        [35.6645, 139.7028, '宮下公園 · 明治通り往澀谷'],
        [35.6592, 139.7015, '澀谷站前交叉口 · 國道246號 (玉川通り)'],
        [35.6552, 139.6975, '道玄坂上 · 左轉進入舊山手通り'],
        [35.6515, 139.6988, '鉢山町 · 舊山手通り直行'],
        [35.6488, 139.6997, '抵達：代官山 T-SITE 超級充電站']
      ],
      marunouchi: [
        [35.6882, 139.7042, '新宿四丁目 · 新宿通り (國道20號) 東行'],
        [35.6875, 139.7185, '四谷三丁目 · 新宿通り直行'],
        [35.6860, 139.7302, '四谷見附交叉口 · 進入麴町大通り'],
        [35.6852, 139.7445, '半藏門交叉口 · 右轉內堀通り (皇居西側)'],
        [35.6805, 139.7465, '三宅坂 · 沿皇居櫻田濠南行'],
        [35.6775, 139.7518, '櫻田門交叉口 · 左轉內堀通り往日比谷'],
        [35.6762, 139.7598, '日比谷交叉口 · 左轉日比谷通り北上'],
        [35.6802, 139.7635, '馬場先門 · 右轉行幸通り往東京站'],
        [35.6838, 139.7686, '抵達：丸之內 Trust Tower V4 超級充電站']
      ]
    };

    this.initOfflineVectorLayers();

    this.carLat = 35.6780;
    this.carLng = 139.7202;
    this.carHeadingRad = 0;

    this.obstacles = [
      { lane: 0, z: 0.22, type: 'car' },
      { lane: 2, z: 0.54, type: 'battery' },
      { lane: 1, z: 0.82, type: 'car' }
    ];

    this.gameScroll = 0;
    this.discAngle = 0;

    this.startLoop();
  }

  /**
   * 初始化 100% 離線自繪向量地圖數據（水系、綠地、支路、建築塊、主幹道、多層級 LOD 地名標籤）
   */
  initOfflineVectorLayers() {
    // 1. 水系層 (東京灣海岸多邊形、隅田川、皇居護城河環、神田川、日本橋川、澀谷川/古川、目黑川)
    this.waterPolygons = [
      // 東京灣港區水域
      [
        [35.662, 139.762], [35.654, 139.756], [35.642, 139.752], [35.625, 139.748],
        [35.625, 139.820], [35.685, 139.820], [35.675, 139.782], [35.662, 139.762]
      ],
      // 皇居內濠水環
      [
        [35.6905, 139.7480], [35.6915, 139.7560], [35.6860, 139.7605], [35.6785, 139.7575],
        [35.6775, 139.7500], [35.6815, 139.7455], [35.6870, 139.7450]
      ]
    ];

    this.rivers = [
      // 隅田川主河道 (寬河道)
      {
        width: 18,
        pts: [[35.728, 139.802], [35.712, 139.797], [35.698, 139.790], [35.686, 139.784], [35.673, 139.776], [35.660, 139.766], [35.646, 139.758]]
      },
      // 外濠—神田川—日本橋川
      {
        width: 7,
        pts: [[35.706, 139.718], [35.702, 139.736], [35.697, 139.742], [35.688, 139.731], [35.679, 139.734], [35.671, 139.744], [35.679, 139.764], [35.684, 139.784]]
      },
      // 澀谷川—古川—東京灣
      {
        width: 6,
        pts: [[35.672, 139.706], [35.659, 139.703], [35.648, 139.713], [35.647, 139.728], [35.654, 139.746], [35.651, 139.760]]
      },
      // 目黑川
      {
        width: 5.5,
        pts: [[35.654, 139.685], [35.644, 139.699], [35.633, 139.714], [35.622, 139.742]]
      }
    ];

    // 2. 綠地公園層 (多邊形與橢圓綠地)
    this.parks = [
      { name: '皇居東御苑', lat: 35.6852, lng: 139.7528, rxKm: 0.88, ryKm: 0.96, rot: -0.15 },
      { name: '新宿御苑', lat: 35.6852, lng: 139.7100, rxKm: 0.68, ryKm: 0.44, rot: 0.12 },
      { name: '代代木公園 · 明治神宮', lat: 35.6725, lng: 139.6965, rxKm: 0.82, ryKm: 0.92, rot: -0.20 },
      { name: '赤坂御用地', lat: 35.6782, lng: 139.7285, rxKm: 0.56, ryKm: 0.42, rot: 0.08 },
      { name: '青山靈園', lat: 35.6655, lng: 139.7220, rxKm: 0.34, ryKm: 0.52, rot: 0.05 },
      { name: '芝公園', lat: 35.6560, lng: 139.7485, rxKm: 0.38, ryKm: 0.45, rot: 0.0 },
      { name: '日比谷公園', lat: 35.6738, lng: 139.7562, rxKm: 0.28, ryKm: 0.32, rot: 0.0 },
      { name: '濱離宮恩賜庭園', lat: 35.6602, lng: 139.7635, rxKm: 0.36, ryKm: 0.38, rot: 0.22 },
      { name: '新宿中央公園', lat: 35.6898, lng: 139.6895, rxKm: 0.25, ryKm: 0.34, rot: 0.0 }
    ];

    // 3. 次幹道與街區支路網 (Secondary & Local Road Network)
    this.secondaryRoads = [
      // 西新宿街廓網
      [[35.696, 139.688], [35.684, 139.688]],
      [[35.696, 139.692], [35.684, 139.692]],
      [[35.696, 139.696], [35.684, 139.696]],
      [[35.694, 139.685], [35.694, 139.708]],
      [[35.691, 139.685], [35.691, 139.708]],
      // 表參道 / 外苑西通り / 骨董通り
      [[35.688, 139.708], [35.679, 139.711], [35.669, 139.713], [35.658, 139.718], [35.648, 139.722]],
      [[35.670, 139.702], [35.666, 139.712], [35.662, 139.719]],
      [[35.662, 139.712], [35.654, 139.708], [35.646, 139.706]],
      // 六本木 / 麻布 / 赤坂支路
      [[35.675, 139.736], [35.666, 139.734], [35.655, 139.736], [35.645, 139.738]],
      [[35.660, 139.720], [35.657, 139.732], [35.655, 139.748]],
      [[35.668, 139.724], [35.669, 139.739], [35.667, 139.752]],
      [[35.674, 139.716], [35.673, 139.736], [35.671, 139.756]],
      // 丸之內 / 銀座 / 八重洲棋盤路網
      [[35.692, 139.760], [35.666, 139.760]],
      [[35.692, 139.764], [35.666, 139.764]],
      [[35.692, 139.768], [35.666, 139.768]],
      [[35.692, 139.772], [35.666, 139.772]],
      [[35.686, 139.756], [35.686, 139.778]],
      [[35.682, 139.756], [35.682, 139.778]],
      [[35.678, 139.756], [35.678, 139.778]],
      [[35.674, 139.756], [35.674, 139.778]],
      [[35.670, 139.756], [35.670, 139.778]],
      // 澀谷 / 代官山 / 惠比壽支路
      [[35.664, 139.692], [35.659, 139.701], [35.654, 139.712]],
      [[35.655, 139.690], [35.651, 139.699], [35.647, 139.710], [35.644, 139.722]],
      [[35.649, 139.692], [35.645, 139.702], [35.642, 139.715]]
    ];

    // 4. 主幹道與首都高速路網層 (Arterial Roads & Expressways)
    this.arterialRoads = [
      // 國道 246 號 (青山通り — 玉川通り)
      [[35.648, 139.682], [35.658, 139.701], [35.665, 139.712], [35.6728, 139.7240], [35.677, 139.738], [35.6775, 139.7518]],
      // 國道 20 號 (甲州街道 — 新宿通り)
      [[35.686, 139.675], [35.6890, 139.6985], [35.6882, 139.7042], [35.6875, 139.7185], [35.6860, 139.7302], [35.6852, 139.7445]],
      // 明治通り
      [[35.712, 139.707], [35.698, 139.705], [35.6882, 139.7042], [35.679, 139.706], [35.6715, 139.7052], [35.6592, 139.7015], [35.647, 139.712]],
      // 外苑東通り — 麻布通り
      [[35.702, 139.722], [35.688, 139.719], [35.6780, 139.7202], [35.6728, 139.7240], [35.6665, 139.7268], [35.6628, 139.7314], [35.654, 139.738], [35.646, 139.742]],
      // 六本木通り (都道 412 號)
      [[35.6592, 139.7015], [35.660, 139.716], [35.6628, 139.7314], [35.668, 139.744], [35.673, 139.752]],
      // 山手通り
      [[35.706, 139.684], [35.688, 139.685], [35.668, 139.688], [35.652, 139.695], [35.642, 139.706]],
      // 內堀通り / 日比谷通り / 中央通り
      [[35.695, 139.756], [35.6852, 139.7445], [35.6775, 139.7518], [35.6762, 139.7598], [35.662, 139.754], [35.650, 139.748]]
    ];

    this.expressways = [
      // 首都高都心環狀線 C1
      [[35.691, 139.756], [35.684, 139.770], [35.670, 139.768], [35.661, 139.758], [35.664, 139.738], [35.675, 139.742], [35.683, 139.745], [35.691, 139.756]],
      // 首都高 4 號新宿線
      [[35.682, 139.672], [35.687, 139.696], [35.680, 139.715], [35.681, 139.732], [35.683, 139.745]],
      // 首都高 3 號澀谷線
      [[35.646, 139.675], [35.658, 139.701], [35.661, 139.722], [35.664, 139.738]]
    ];

    // 5. 建築塊層 (Building Footprints — 沿各大商圈真實座標分佈的 160+ 座建築塊)
    this.buildingBlocks = [];
    const clusters = [
      { lat: 35.6905, lng: 139.6935, rows: 5, cols: 6, dLat: 0.0016, dLng: 0.0020, wLat: 0.0010, wLng: 0.0013 }, // 西新宿高層群
      { lat: 35.6615, lng: 139.7295, rows: 5, cols: 6, dLat: 0.0015, dLng: 0.0019, wLat: 0.0009, wLng: 0.0012 }, // 六本木新城 & 中城
      { lat: 35.6595, lng: 139.7010, rows: 5, cols: 5, dLat: 0.0015, dLng: 0.0018, wLat: 0.0009, wLng: 0.0011 }, // 澀谷中心街
      { lat: 35.6730, lng: 139.7235, rows: 4, cols: 5, dLat: 0.0016, dLng: 0.0020, wLat: 0.0009, wLng: 0.0012 }, // 青山 / 赤坂
      { lat: 35.6815, lng: 139.7655, rows: 6, cols: 5, dLat: 0.0016, dLng: 0.0019, wLat: 0.0011, wLng: 0.0013 }, // 丸之內 / 銀座整齊街廓
      { lat: 35.6495, lng: 139.7015, rows: 4, cols: 4, dLat: 0.0014, dLng: 0.0017, wLat: 0.0008, wLng: 0.0010 }, // 代官山 / 惠比壽
      { lat: 35.6675, lng: 139.7475, rows: 4, cols: 5, dLat: 0.0015, dLng: 0.0019, wLat: 0.0009, wLng: 0.0012 }  // 虎之門 / 新橋
    ];
    for (const cl of clusters) {
      for (let r = 0; r < cl.rows; r++) {
        for (let c = 0; c < cl.cols; c++) {
          const lat = cl.lat + (r - cl.rows / 2) * cl.dLat;
          const lng = cl.lng + (c - cl.cols / 2) * cl.dLng;
          this.buildingBlocks.push({
            lat,
            lng,
            wLat: cl.wLat * (0.75 + ((r * 7 + c * 13) % 5) * 0.08),
            wLng: cl.wLng * (0.75 + ((r * 11 + c * 5) % 5) * 0.08)
          });
        }
      }
    }

    // 6. 依縮放層級 (LOD) 顯示的地名與道路標籤
    this.mapLabels = [
      // Tier 1: 主要行政區 (任何縮放均顯示)
      { text: '新宿區 SHINJUKU', lat: 35.6932, lng: 139.7010, minZoom: 12.0, tier: 'major' },
      { text: '港區 · 六本木 ROPPONGI', lat: 35.6628, lng: 139.7314, minZoom: 12.0, tier: 'major' },
      { text: '澀谷區 SHIBUYA', lat: 35.6595, lng: 139.7005, minZoom: 12.0, tier: 'major' },
      { text: '千代田 · 皇居', lat: 35.6852, lng: 139.7528, minZoom: 12.0, tier: 'major' },
      { text: '丸之內 MARUNOUCHI', lat: 35.6812, lng: 139.7671, minZoom: 12.0, tier: 'major' },

      // Tier 2: 次級商圈與公園 (Zoom >= 13.8 顯示)
      { text: '表參道 OMOTESANDO', lat: 35.6665, lng: 139.7123, minZoom: 13.8, tier: 'secondary' },
      { text: '赤坂 AKASAKA', lat: 35.6735, lng: 139.7365, minZoom: 13.8, tier: 'secondary' },
      { text: '虎之門 TORANOMON', lat: 35.6675, lng: 139.7495, minZoom: 13.8, tier: 'secondary' },
      { text: '代官山 DAIKANYAMA', lat: 35.6485, lng: 139.7030, minZoom: 13.8, tier: 'secondary' },
      { text: '惠比壽 EBISU', lat: 35.6467, lng: 139.7120, minZoom: 13.8, tier: 'secondary' },
      { text: '銀座 GINZA', lat: 35.6712, lng: 139.7665, minZoom: 13.8, tier: 'secondary' },
      { text: '新宿御苑', lat: 35.6852, lng: 139.7100, minZoom: 13.8, tier: 'park' },
      { text: '代代木公園', lat: 35.6725, lng: 139.6965, minZoom: 13.8, tier: 'park' },

      // Tier 3: 道路名稱與地標 (Zoom >= 14.4 顯示)
      { text: '青山通り R246', lat: 35.6710, lng: 139.7205, minZoom: 14.4, tier: 'road' },
      { text: '外苑東通り', lat: 35.6762, lng: 139.7215, minZoom: 14.4, tier: 'road' },
      { text: '明治通り MEIJI-DORI', lat: 35.6785, lng: 139.7055, minZoom: 14.4, tier: 'road' },
      { text: '六本木通り', lat: 35.6612, lng: 139.7225, minZoom: 14.4, tier: 'road' },
      { text: '甲州街道 R20', lat: 35.6885, lng: 139.7010, minZoom: 14.4, tier: 'road' },
      { text: '首都高速都心環狀線 C1', lat: 35.6720, lng: 139.7415, minZoom: 14.4, tier: 'road' },
      { text: '國立競技場', lat: 35.6778, lng: 139.7145, minZoom: 14.5, tier: 'road' },
      { text: '東京鐵塔 TOKYO TOWER', lat: 35.6586, lng: 139.7454, minZoom: 14.4, tier: 'road' },
      { text: '東京都廳', lat: 35.6896, lng: 139.6917, minZoom: 14.5, tier: 'road' }
    ];
  }

  latLngToWorldPx(lat, lng, zoom) {
    const scale = 256 * Math.pow(2, zoom);
    const x = ((lng + 180) / 360) * scale;
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    return { x, y };
  }

  worldPxToLatLng(px, py, zoom) {
    const scale = 256 * Math.pow(2, zoom);
    const lng = (px / scale) * 360 - 180;
    const n = Math.PI - (2 * Math.PI * py) / scale;
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return { lat, lng };
  }

  latLngToScreen(lat, lng, w, h) {
    const centerPx = this.latLngToWorldPx(this.centerLat, this.centerLng, this.zoom);
    const ptPx = this.latLngToWorldPx(lat, lng, this.zoom);
    return {
      x: w * 0.54 + (ptPx.x - centerPx.x),
      y: h * 0.52 + (ptPx.y - centerPx.y)
    };
  }

  registerMapCanvas(canvasEl) {
    if (!canvasEl || this.mapCanvas === canvasEl) return;
    this.mapCanvas = canvasEl;
    this.mapCtx = canvasEl.getContext('2d');
    this.bindMapInteractions(canvasEl);
  }

  registerMediaCanvas(canvasEl) {
    if (!canvasEl) return;
    this.mediaCanvas = canvasEl;
    this.mediaCtx = canvasEl.getContext('2d');
  }

  bindMapInteractions(canvasEl) {
    let startX = 0;
    let startY = 0;
    let moved = false;

    canvasEl.addEventListener('pointerdown', (e) => {
      this.isPanning = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      canvasEl.setPointerCapture(e.pointerId);
    });

    canvasEl.addEventListener('pointermove', (e) => {
      if (!this.isPanning || !this.mapCanvas) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
        this.followCar = false;
      }
      startX = e.clientX;
      startY = e.clientY;

      const rect = this.mapCanvas.getBoundingClientRect();
      const dpr = this.mapCanvas.width / Math.max(1, rect.width);
      const centerPx = this.latLngToWorldPx(this.centerLat, this.centerLng, this.zoom);
      const nextLatLng = this.worldPxToLatLng(centerPx.x - dx * dpr, centerPx.y - dy * dpr, this.zoom);
      this.centerLat = Math.max(35.61, Math.min(35.73, nextLatLng.lat));
      this.centerLng = Math.max(139.66, Math.min(139.80, nextLatLng.lng));
    });

    const endPan = (e) => {
      if (!this.isPanning) return;
      this.isPanning = false;
      if (!moved) {
        this.handleMapClick(e);
      }
    };
    canvasEl.addEventListener('pointerup', endPan);
    canvasEl.addEventListener('pointercancel', endPan);

    canvasEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.targetZoom = Math.max(12.8, Math.min(16.2, this.targetZoom - e.deltaY * 0.0018));
    }, { passive: false });
  }

  handleMapClick(e) {
    if (!this.mapCanvas) return;
    const rect = this.mapCanvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * this.mapCanvas.width;
    const sy = ((e.clientY - rect.top) / rect.height) * this.mapCanvas.height;

    for (const sc of this.superchargers) {
      const pt = this.latLngToScreen(sc.lat, sc.lng, this.mapCanvas.width, this.mapCanvas.height);
      if (Math.hypot(sx - pt.x, sy - pt.y) < 32) {
        this.selectSuperchargerDestination(sc.id);
        break;
      }
    }
  }

  selectSuperchargerDestination(destId) {
    const sc = this.superchargers.find((c) => c.id === destId);
    if (!sc) return;
    this.followCar = true;
    this.store.update((st) => {
      st.navigation.active = true;
      st.navigation.destinationId = sc.id;
      st.navigation.destinationName = sc.name;
      st.navigation.remainingKm = sc.distKm;
      st.navigation.etaMinutes = sc.etaMin;
      st.navigation.routeProgress = 0.12;
      const route = this.gpsRoutes[sc.id] || this.gpsRoutes.roppongi;
      if (route[1]) {
        st.navigation.nextTurnStreet = route[1][2];
      }
    });
    this.store.showToast(`已切換導航目的地：${sc.name} (${sc.available}/${sc.total} 空閒)`, 'info');
  }

  resetMapView() {
    this.followCar = true;
    this.targetZoom = 14.2;
  }

  zoomMap(delta) {
    this.targetZoom = Math.max(12.8, Math.min(16.2, +(this.targetZoom + delta * 2.2).toFixed(2)));
  }

  /**
   * 100% 離線自繪分層向量導航地圖（無網路請求、無水印、無錯誤提示）
   * 分層順序：陸地底色 -> 水系 -> 綠地 -> 細支路網 -> 建築塊 -> 次幹道 -> 主幹道與高速 -> 單一連續細線路線 -> LOD 標籤 -> 超充與自車
   */
  renderNavigationMap(now, dt = 0.016) {
    const canvas = this.mapCanvas;
    if (!canvas || !canvas.isConnected) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    const w = Math.max(520, Math.round(rect.width * 1.5));
    const h = Math.max(380, Math.round(rect.height * 1.5));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = this.mapCtx;
    const s = this.store.getState();
    const isNight = s.environment.timeOfDay === 'night';

    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 8.0);
    const zoomScale = Math.pow(2, this.zoom - 14.0);

    // 計算自車沿路線的實時經緯度
    const activeRoute = this.gpsRoutes[s.navigation.destinationId] || this.gpsRoutes.roppongi;
    const prog = Math.max(0, Math.min(0.999, s.navigation.routeProgress || 0.22));
    const totalSegs = activeRoute.length - 1;
    const exactSeg = prog * totalSegs;
    const segIdx = Math.min(totalSegs - 1, Math.floor(exactSeg));
    const segT = exactSeg - segIdx;

    const wpA = activeRoute[segIdx];
    const wpB = activeRoute[segIdx + 1];
    this.carLat = wpA[0] + (wpB[0] - wpA[0]) * segT;
    this.carLng = wpA[1] + (wpB[1] - wpA[1]) * segT;

    if (wpB[2] && s.navigation.nextTurnStreet !== wpB[2]) {
      s.navigation.nextTurnStreet = wpB[2];
    }

    if (this.followCar && !this.isPanning) {
      this.centerLat += (this.carLat - this.centerLat) * Math.min(1, dt * 6.5);
      this.centerLng += (this.carLng - this.centerLng) * Math.min(1, dt * 6.5);
    }

    // 1. 陸地底色
    ctx.fillStyle = isNight ? '#13161b' : '#ebeef2';
    ctx.fillRect(0, 0, w, h);

    // 2. 水系層 (東京灣、皇居護城河、隅田川、神田川、澀谷川、目黑川)
    const waterFill = isNight ? '#0a0f17' : '#c5d7ea';
    ctx.fillStyle = waterFill;
    for (const poly of this.waterPolygons) {
      ctx.beginPath();
      poly.forEach(([lat, lng], idx) => {
        const p = this.latLngToScreen(lat, lng, w, h);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = waterFill;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const riv of this.rivers) {
      ctx.lineWidth = Math.max(2.5, riv.width * zoomScale * 0.85);
      ctx.beginPath();
      riv.pts.forEach(([lat, lng], idx) => {
        const p = this.latLngToScreen(lat, lng, w, h);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }

    // 3. 綠地層 (Parks & Green Zones)
    ctx.fillStyle = isNight ? '#151f19' : '#d4e6d8';
    for (const pk of this.parks) {
      const c = this.latLngToScreen(pk.lat, pk.lng, w, h);
      const edge = this.latLngToScreen(pk.lat + pk.ryKm * 0.009, pk.lng + pk.rxKm * 0.011, w, h);
      const rx = Math.max(6, Math.abs(edge.x - c.x));
      const ry = Math.max(6, Math.abs(edge.y - c.y));
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(pk.rot || 0);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. 細支路與街巷網層 (Local Streets Grid)
    ctx.strokeStyle = isNight ? '#191d24' : '#dfe4ec';
    ctx.lineWidth = Math.max(0.9, 1.2 * zoomScale);
    const latStep = this.zoom >= 14.5 ? 0.0022 : 0.0036;
    const lngStep = this.zoom >= 14.5 ? 0.0028 : 0.0045;
    for (let lat = 35.62; lat <= 35.72; lat += latStep) {
      const p1 = this.latLngToScreen(lat, 139.66, w, h);
      const p2 = this.latLngToScreen(lat, 139.79, w, h);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let lng = 139.66; lng <= 139.79; lng += lngStep) {
      const p1 = this.latLngToScreen(35.62, lng, w, h);
      const p2 = this.latLngToScreen(35.72, lng, w, h);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // 5. 建築塊層 (Building Footprints)
    if (this.zoom >= 13.3) {
      ctx.fillStyle = isNight ? '#1b2028' : '#d8dee6';
      ctx.strokeStyle = isNight ? '#232934' : '#c8d0dc';
      ctx.lineWidth = 0.8;
      for (const b of this.buildingBlocks) {
        const pTL = this.latLngToScreen(b.lat + b.wLat / 2, b.lng - b.wLng / 2, w, h);
        const pBR = this.latLngToScreen(b.lat - b.wLat / 2, b.lng + b.wLng / 2, w, h);
        const bw = Math.max(4, pBR.x - pTL.x);
        const bh = Math.max(4, pBR.y - pTL.y);
        if (pBR.x < 0 || pTL.x > w || pBR.y < 0 || pTL.y > h) continue;
        ctx.fillRect(pTL.x, pTL.y, bw, bh);
        ctx.strokeRect(pTL.x, pTL.y, bw, bh);
      }
    }

    // 6. 次幹道層 (Secondary Roads)
    ctx.strokeStyle = isNight ? '#222731' : '#ffffff';
    ctx.lineWidth = Math.max(1.8, 2.6 * zoomScale);
    for (const sRoad of this.secondaryRoads) {
      ctx.beginPath();
      sRoad.forEach(([lat, lng], idx) => {
        const p = this.latLngToScreen(lat, lng, w, h);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }

    // 7. 主幹道與首都高速路網層 (Arterial Roads & Expressways)
    for (const art of this.arterialRoads) {
      ctx.strokeStyle = isNight ? '#101216' : '#c4ccd8';
      ctx.lineWidth = Math.max(4.2, 5.8 * zoomScale);
      ctx.beginPath();
      art.forEach(([lat, lng], idx) => {
        const p = this.latLngToScreen(lat, lng, w, h);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      ctx.strokeStyle = isNight ? '#2b313d' : '#ffffff';
      ctx.lineWidth = Math.max(2.8, 4.0 * zoomScale);
      ctx.stroke();
    }

    for (const exp of this.expressways) {
      ctx.strokeStyle = isNight ? '#161920' : '#b2bccb';
      ctx.lineWidth = Math.max(6.0, 8.2 * zoomScale);
      ctx.beginPath();
      exp.forEach(([lat, lng], idx) => {
        const p = this.latLngToScreen(lat, lng, w, h);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      ctx.strokeStyle = isNight ? '#343b49' : '#e2e7f0';
      ctx.lineWidth = Math.max(3.8, 5.4 * zoomScale);
      ctx.stroke();
    }

    // 8. 路況緩行細線 (Traffic Layer)
    if (s.navigation.trafficLayer) {
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      const t1 = this.latLngToScreen(35.6780, 139.7202, w, h);
      const t2 = this.latLngToScreen(35.6728, 139.7240, w, h);
      ctx.moveTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.stroke();
    }

    // 9. 導航路線：嚴格採用連續單一細線 (Single Continuous Thin Line, 2.6px)
    const carScreen = this.latLngToScreen(this.carLat, this.carLng, w, h);
    const nextWpScreen = this.latLngToScreen(wpB[0], wpB[1], w, h);
    this.carHeadingRad = Math.atan2(nextWpScreen.y - carScreen.y, nextWpScreen.x - carScreen.x);

    if (s.navigation.active) {
      ctx.strokeStyle = '#3e6ae1';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      activeRoute.forEach(([lat, lng], idx) => {
        const p = this.latLngToScreen(lat, lng, w, h);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }

    // 10. 地名標籤：依縮放層級 (LOD) 動態顯示
    ctx.textAlign = 'center';
    for (const lbl of this.mapLabels) {
      if (this.zoom < lbl.minZoom) continue;
      const p = this.latLngToScreen(lbl.lat, lbl.lng, w, h);
      if (p.x < 40 || p.x > w - 40 || p.y < 24 || p.y > h - 24) continue;

      if (lbl.tier === 'major') {
        ctx.font = '600 12px Inter, sans-serif';
        ctx.fillStyle = isNight ? 'rgba(209, 213, 219, 0.78)' : 'rgba(31, 41, 55, 0.85)';
      } else if (lbl.tier === 'secondary' || lbl.tier === 'park') {
        ctx.font = '500 11px Inter, sans-serif';
        ctx.fillStyle = isNight ? 'rgba(156, 163, 175, 0.72)' : 'rgba(75, 85, 99, 0.80)';
      } else {
        ctx.font = '500 10px Inter, sans-serif';
        ctx.fillStyle = isNight ? 'rgba(138, 145, 158, 0.68)' : 'rgba(107, 114, 128, 0.78)';
      }
      ctx.fillText(lbl.text, p.x, p.y);
    }

    // 11. 超級充電站標記
    if (s.navigation.superchargerLayer) {
      for (const sc of this.superchargers) {
        const isTarget = sc.id === s.navigation.destinationId && s.navigation.active;
        const pt = this.latLngToScreen(sc.lat, sc.lng, w, h);
        if (pt.x < 20 || pt.x > w - 20 || pt.y < 20 || pt.y > h - 20) continue;

        ctx.save();
        ctx.translate(pt.x, pt.y);

        ctx.fillStyle = isTarget ? '#3e6ae1' : (isNight ? '#1f232b' : '#ffffff');
        ctx.strokeStyle = isTarget ? '#ffffff' : '#3e6ae1';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, isTarget ? 10 : 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (this.zoom >= 13.8 || isTarget) {
          ctx.font = '600 11px Inter, sans-serif';
          const label = this.zoom >= 14.4 ? `${sc.name} (${sc.available}/${sc.total})` : sc.name;
          const tw = ctx.measureText(label).width + 12;
          ctx.fillStyle = isNight ? 'rgba(18, 20, 25, 0.88)' : 'rgba(255, 255, 255, 0.92)';
          ctx.beginPath();
          ctx.roundRect(-tw / 2, 13, tw, 18, 4);
          ctx.fill();
          ctx.fillStyle = isNight ? '#e5e7eb' : '#111317';
          ctx.fillText(label, 0, 26);
        }

        ctx.restore();
      }
    }

    // 12. 自車定位游標
    ctx.save();
    ctx.translate(carScreen.x, carScreen.y);
    ctx.rotate(this.carHeadingRad + Math.PI / 2);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111317';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#3e6ae1';
    ctx.beginPath();
    ctx.moveTo(0, -7.5);
    ctx.lineTo(5.8, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * 繪製副駕娛樂屏實時動態畫面（1:1 匹配容器尺寸，唱片、專輯封面、單色細線頻譜完整顯示不截斷）
   */
  renderPassengerEntertainment(now, dt) {
    const canvas = this.mediaCanvas;
    if (!canvas || !canvas.isConnected) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(280, Math.round(rect.width * dpr));
    const ch = Math.max(120, Math.round(rect.height * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    const ctx = this.mediaCtx;
    const w = rect.width;
    const h = rect.height;
    const s = this.store.getState();
    const tab = s.media.activeTab;

    ctx.save();
    ctx.scale(dpr, dpr);

    if (tab === 'music') {
      this.renderMusicVisualizer(ctx, w, h, now, dt, s);
    } else if (tab === 'video') {
      this.renderVideoCinemaCanvas(ctx, w, h, now, dt, s);
    } else if (tab === 'game') {
      this.renderArcadeGameCanvas(ctx, w, h, now, dt, s);
    }

    ctx.restore();
  }

  /**
   * 副駕音樂：高解析度真实 CSS 像素座標繪製，左側完整呈現「正方形專輯封面 + 旋轉黑膠唱盤」，右側呈現「1.5px 單色細線頻譜 + 同步歌詞」，無任何字體變形或重疊
   */
  renderMusicVisualizer(ctx, w, h, now, dt, s) {
    const isNight = s.environment.timeOfDay === 'night';
    const track = s.media.tracks[s.media.trackIndex] || s.media.tracks[0];
    const eqMode = s.media.eqPreset || 'immersive';
    const eqBoost = eqMode === 'bass' ? 1.22 : (eqMode === 'immersive' ? 1.08 : 0.94);
    const volFactor = (s.media.effectiveVolume / 100) * (s.media.playing ? 1.0 : 0.08) * eqBoost;
    const palette = track.palette || ['#182238', '#0d1322', '#3e6ae1'];

    if (s.media.playing) {
      this.discAngle = (this.discAngle + dt * 1.15) % (Math.PI * 2);
    }

    // 與副駕屏底色無縫融合
    ctx.fillStyle = isNight ? '#111318' : '#e5e7eb';
    ctx.fillRect(0, 0, w, h);

    // 1. 左側：完整正方形專輯封套 + 右側半露旋轉黑膠唱片（嚴格計算真實像素邊界，絕不裁切）
    const padX = Math.max(12, Math.round(w * 0.03));
    const artSize = Math.min(h * 0.76, w * 0.26);
    const discR = artSize * 0.48;
    const artX = padX;
    const artY = (h - artSize) * 0.5;
    const discCx = artX + artSize * 0.88;
    const discCy = h * 0.5;

    // 1a. 旋轉黑膠唱片 (Vinyl Disc)
    ctx.save();
    ctx.translate(discCx, discCy);

    // 黑膠底盤與外緣細高光
    ctx.fillStyle = '#090b0f';
    ctx.strokeStyle = isNight ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, discR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 黑膠異向性對角扇形光澤
    for (const baseAng of [-0.55, Math.PI - 0.55]) {
      const sheenGrad = ctx.createRadialGradient(0, 0, discR * 0.22, 0, 0, discR);
      sheenGrad.addColorStop(0, 'rgba(255,255,255,0.0)');
      sheenGrad.addColorStop(0.5, 'rgba(255,255,255,0.10)');
      sheenGrad.addColorStop(1, 'rgba(255,255,255,0.01)');
      ctx.fillStyle = sheenGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, discR * 0.98, baseAng - 0.26, baseAng + 0.26);
      ctx.closePath();
      ctx.fill();
    }

    ctx.rotate(this.discAngle);

    // 同心音軌細紋
    ctx.lineWidth = 0.8;
    for (const rRatio of [0.84, 0.72, 0.60, 0.48]) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.arc(0, 0, discR * rRatio, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 黑膠中心彩標與軸孔
    ctx.fillStyle = palette[2];
    ctx.beginPath();
    ctx.arc(0, 0, discR * 0.30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(0, 0, discR * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 1b. 左側正方形專輯封面 (Album Cover Sleeve)
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 2;

    const sleeveGrad = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
    sleeveGrad.addColorStop(0, palette[0]);
    sleeveGrad.addColorStop(1, palette[1]);
    ctx.fillStyle = sleeveGrad;
    ctx.beginPath();
    ctx.roundRect(artX, artY, artSize, artSize, 8);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(artX, artY, artSize, artSize, 8);
    ctx.clip();

    // 封套內部極簡幾何藝術圖形
    const cx = artX + artSize * 0.5;
    const cy = artY + artSize * 0.46;
    const orbGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, artSize * 0.32);
    orbGrad.addColorStop(0, palette[2]);
    orbGrad.addColorStop(0.7, 'rgba(62, 106, 225, 0.20)');
    orbGrad.addColorStop(1, 'rgba(62, 106, 225, 0.0)');
    ctx.fillStyle = orbGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, artSize * 0.32, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(cx, cy, artSize * 0.20, 0, Math.PI * 2);
    ctx.stroke();

    // 封套右下角精簡代號 (僅 5 字元，絕不溢出或變形)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(track.coverCode || 'OD-01', artX + 7, artY + artSize - 7);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(artX + 0.5, artY + 0.5, artSize - 1, artSize - 1);
    ctx.restore();

    // 2. 右側：單色 1.5px 細線頻譜 + 底部清晰同步歌詞（不設 maxWidth 橫向壓縮，字體自然清晰）
    const rightStart = Math.round(discCx + discR + Math.max(14, w * 0.035));
    const rightEnd = w - padX;
    const usableW = Math.max(100, rightEnd - rightStart);
    const specMidY = h * 0.42;
    const maxBarHalfH = h * 0.25;

    ctx.strokeStyle = isNight ? 'rgba(255, 255, 255, 0.07)' : 'rgba(15, 23, 42, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rightStart, specMidY);
    ctx.lineTo(rightEnd, specMidY);
    ctx.stroke();

    const bars = 38;
    const stepX = usableW / bars;
    ctx.strokeStyle = isNight ? '#e2e8f0' : '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    for (let i = 0; i < bars; i++) {
      const normI = i / (bars - 1);
      const lowBoost = eqMode === 'bass' && normI < 0.35 ? 1.28 : 1.0;
      const windowEnv = (0.30 + 0.70 * Math.sin(normI * Math.PI)) * lowBoost;
      const n = Math.abs(Math.sin(i * 0.44 + now * 0.0054) * Math.cos(i * 0.23 - now * 0.0038));
      const halfH = Math.max(2, Math.min(maxBarHalfH, n * maxBarHalfH * volFactor * windowEnv + 2));
      const bx = rightStart + i * stepX + stepX * 0.5;
      ctx.beginPath();
      ctx.moveTo(bx, specMidY - halfH);
      ctx.lineTo(bx, specMidY + halfH);
      ctx.stroke();
    }

    // 同步歌詞（使用裁剪區域取代 fillText 第 4 參數，徹底杜絕字體被橫向擠扁）
    const lyrics = track.lyrics || ['Cruising through the expressway in silent electric torque'];
    const lyricIdx = Math.floor((s.media.currentTime / 6) % lyrics.length);
    const currentLyric = lyrics[lyricIdx];

    ctx.save();
    ctx.beginPath();
    ctx.rect(rightStart, h * 0.68, usableW, h * 0.28);
    ctx.clip();
    ctx.textAlign = 'left';
    ctx.font = '500 12px Inter, -apple-system, sans-serif';
    ctx.fillStyle = isNight ? '#cbd5e1' : '#334155';
    ctx.fillText(currentLyric, rightStart, h * 0.84);
    ctx.restore();
  }

  /**
   * 副駕劇院：真實 CSS 像素比例寬銀幕畫面，無任何重疊文字或擠扁字幕
   */
  renderVideoCinemaCanvas(ctx, w, h, now, dt, s) {
    const vidIdx = s.media.videoIndex || 0;
    const vid = s.media.videos[vidIdx] || s.media.videos[0];
    const speedMult = s.media.videoSpeed || 1.0;
    const t = s.media.videoPlaying ? (now * 0.0014 * speedMult) : 1.2;

    ctx.fillStyle = '#090b10';
    ctx.fillRect(0, 0, w, h);

    const topBarH = Math.max(20, Math.round(h * 0.12));
    const botBarH = Math.max(22, Math.round(h * 0.14));
    const viewTop = topBarH;
    const viewBot = h - botBarH;
    const viewH = viewBot - viewTop;
    const horizonY = viewTop + viewH * 0.48;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, viewTop, w, viewH);
    ctx.clip();

    // 1. 寬銀幕夜空漸層與遠景城市天際線
    const skyGrad = ctx.createLinearGradient(0, viewTop, 0, horizonY);
    skyGrad.addColorStop(0, '#080c14');
    skyGrad.addColorStop(0.65, '#111a2b');
    skyGrad.addColorStop(1, '#1d2b44');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, viewTop, w, horizonY - viewTop);

    const vpX = w * 0.5 + Math.sin(t * 0.4) * (w * 0.02);
    ctx.fillStyle = '#0c121e';
    for (let i = 0; i < 28; i++) {
      const bx = (i / 28) * w;
      const bw = (w / 28) * 0.86;
      const bh = 6 + ((i * 17) % 20) * (viewH / 140);
      ctx.fillRect(bx, horizonY - bh, bw, bh);
    }

    // 跨海大橋主塔與弧形懸索
    const tLeft = vpX - w * 0.16;
    const tRight = vpX + w * 0.16;
    const tTop = horizonY - viewH * 0.26;
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.32)';
    ctx.lineWidth = 1.5;
    for (const tx of [tLeft, tRight]) {
      ctx.beginPath();
      ctx.moveTo(tx - 4, horizonY);
      ctx.lineTo(tx - 2, tTop);
      ctx.moveTo(tx + 4, horizonY);
      ctx.lineTo(tx + 2, tTop);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(tLeft - w * 0.16, horizonY);
    ctx.quadraticCurveTo(vpX, horizonY - viewH * 0.04, tRight + w * 0.16, horizonY);
    ctx.stroke();

    // 2. 路面與車道線
    ctx.fillStyle = '#121722';
    ctx.fillRect(0, horizonY, w, viewBot - horizonY);

    const roadTopHalf = w * 0.045;
    const roadBotHalf = w * 0.42;
    ctx.fillStyle = '#171e2b';
    ctx.beginPath();
    ctx.moveTo(vpX - roadTopHalf, horizonY);
    ctx.lineTo(vpX + roadTopHalf, horizonY);
    ctx.lineTo(w * 0.5 + roadBotHalf, viewBot);
    ctx.lineTo(w * 0.5 - roadBotHalf, viewBot);
    ctx.closePath();
    ctx.fill();

    // 導航軌跡光毯
    ctx.fillStyle = 'rgba(62, 106, 225, 0.24)';
    ctx.beginPath();
    ctx.moveTo(vpX - roadTopHalf * 0.28, horizonY);
    ctx.lineTo(vpX + roadTopHalf * 0.28, horizonY);
    ctx.lineTo(w * 0.5 + roadBotHalf * 0.26, viewBot);
    ctx.lineTo(w * 0.5 - roadBotHalf * 0.26, viewBot);
    ctx.closePath();
    ctx.fill();

    for (const laneRatio of [-0.65, -0.26, 0.26, 0.65]) {
      ctx.strokeStyle = Math.abs(laneRatio) < 0.35 ? 'rgba(96, 165, 250, 0.55)' : 'rgba(226, 232, 240, 0.24)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(vpX + roadTopHalf * laneRatio, horizonY);
      ctx.lineTo(w * 0.5 + roadBotHalf * laneRatio, viewBot);
      ctx.stroke();
    }

    // 3. 前車流線輪廓與乾淨視覺框（不堆疊大號文字）
    const leadX = vpX + Math.sin(t * 0.5) * 6;
    const leadY = horizonY + viewH * 0.30;
    const carW = Math.max(28, Math.min(48, w * 0.09));
    const carH = carW * 0.60;

    ctx.save();
    ctx.translate(leadX, leadY);
    ctx.fillStyle = '#242e40';
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.roundRect(-carW * 0.48, -carH * 0.55, carW * 0.96, carH * 0.46, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#141a26';
    ctx.beginPath();
    ctx.moveTo(-carW * 0.36, -carH * 0.55);
    ctx.lineTo(-carW * 0.25, -carH * 0.92);
    ctx.lineTo(carW * 0.25, -carH * 0.92);
    ctx.lineTo(carW * 0.36, -carH * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-carW * 0.42, -carH * 0.44, carW * 0.22, 2.2);
    ctx.fillRect(carW * 0.20, -carH * 0.44, carW * 0.22, 2.2);

    ctx.strokeStyle = '#3e6ae1';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-carW * 0.56, -carH * 1.02, carW * 1.12, carH * 1.06);
    ctx.restore();

    ctx.restore();

    // 4. 頂部與底部電影遮幅（固定 11px 清晰字級，左右分開絕不碰撞重疊）
    ctx.fillStyle = '#080a0e';
    ctx.fillRect(0, 0, w, topBarH);
    ctx.fillRect(0, viewBot, w, botBarH);

    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'left';
    ctx.fillText(`${vid.resolution}`, 12, topBarH * 0.68);

    const totalSec = Math.round(((s.media.videoProgress || 42) / 100) * (vid.duration || 312));
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`00:${mm}:${ss} · ${speedMult}x`, w - 12, topBarH * 0.68);

    // 底部旁白（不加第 4 參數橫向擠壓，改用置中裁剪）
    ctx.save();
    ctx.beginPath();
    ctx.rect(12, viewBot, w - 24, botBarH);
    ctx.clip();
    ctx.textAlign = 'center';
    ctx.font = '500 11px Inter, -apple-system, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`${vid.title} · ${vid.channel}`, w * 0.5, viewBot + botBarH * 0.66);
    ctx.restore();
  }

  /**
   * 副駕街機：真實 CSS 像素比例繪製 3D 競速畫面
   */
  renderArcadeGameCanvas(ctx, w, h, now, dt, s) {
    const game = s.media.game;

    ctx.fillStyle = '#0d1017';
    ctx.fillRect(0, 0, w, h);

    const horizonY = h * 0.34;
    const roadTopW = w * 0.18;
    const roadBotW = w * 0.78;

    ctx.fillStyle = '#181e29';
    ctx.beginPath();
    ctx.moveTo(w / 2 - roadTopW / 2, horizonY);
    ctx.lineTo(w / 2 + roadTopW / 2, horizonY);
    ctx.lineTo(w / 2 + roadBotW / 2, h);
    ctx.lineTo(w / 2 - roadBotW / 2, h);
    ctx.closePath();
    ctx.fill();

    const gameSpeed = game.running ? (game.boostActive ? 0.68 : 0.38) : 0.0;
    if (game.running) {
      this.gameScroll = (this.gameScroll + gameSpeed * dt * 2.4) % 1.0;
      game.score += Math.round(dt * (game.boostActive ? 160 : 85));
      if (game.score > game.highScore) game.highScore = game.score;
    }

    for (const ratio of [-0.5, -0.166, 0.166, 0.5]) {
      ctx.strokeStyle = Math.abs(ratio) === 0.5 ? '#3e6ae1' : 'rgba(243, 244, 246, 0.30)';
      ctx.lineWidth = Math.abs(ratio) === 0.5 ? 1.8 : 1.2;
      ctx.beginPath();
      ctx.moveTo(w / 2 + roadTopW * ratio, horizonY);
      ctx.lineTo(w / 2 + roadBotW * ratio, h);
      ctx.stroke();
    }

    for (const obs of this.obstacles) {
      if (game.running) {
        obs.z += gameSpeed * dt;
        if (obs.z > 1.02) {
          obs.z = 0.04;
          obs.lane = Math.floor(Math.random() * 3);
          obs.type = Math.random() > 0.35 ? 'car' : 'battery';
        }
        if (obs.z > 0.78 && obs.z < 0.94 && obs.lane === game.playerLane) {
          if (obs.type === 'battery') {
            game.score += 300;
            obs.z = 0.03;
            obs.lane = (obs.lane + 1) % 3;
          } else {
            game.score = Math.max(0, game.score - 100);
            obs.z = 0.03;
            obs.lane = (obs.lane + 2) % 3;
          }
        }
      }

      const scale = 0.22 + obs.z * 0.78;
      const laneOffset = (obs.lane - 1) * 0.33;
      const currRoadW = roadTopW + (roadBotW - roadTopW) * obs.z;
      const ox = w / 2 + currRoadW * laneOffset;
      const oy = horizonY + (h - horizonY) * obs.z;

      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);
      if (obs.type === 'battery') {
        ctx.fillStyle = '#3e6ae1';
        ctx.beginPath();
        ctx.arc(0, -10, 10, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#283244';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.roundRect(-20, -16, 40, 14, 4);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    const playerX = w / 2 + (game.playerLane - 1) * (roadBotW * 0.28);
    const playerY = h - 10;
    ctx.save();
    ctx.translate(playerX, playerY);
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(-26, -18, 52, 15, 5);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-22, -15, 44, 3);
    ctx.restore();

    ctx.fillStyle = 'rgba(13, 17, 25, 0.82)';
    ctx.beginPath();
    ctx.roundRect(10, 8, 190, 22, 5);
    ctx.fill();
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${game.score} · HI ${game.highScore}`, 18, 23);
  }

  startLoop() {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      this.renderNavigationMap(now, dt);
      this.renderPassengerEntertainment(now, dt);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
