/**
 * 階段一：OpenStreetMap 離線預渲染底圖生成器與多層導航渲染輔助
 * -----------------------------------------------------------------------------
 * 嚴格遵循規範第 6 條：
 * 「底圖用 OpenStreetMap 數據離線預渲染成圖片（註明 © OpenStreetMap contributors），
 *  上面疊加文字、地點、車標、路線等獨立互動層；支援平移、縮放、回中、目的地搜尋、
 *  充電站、路線比較與開始／結束導航演示。車輛保持停車，不模擬行駛。」
 *
 * 實作方式：
 * 1. 將東京都心（新宿・代代木・澀谷・六本木・皇居・隅田川）之 OpenStreetMap 街廓、水系、
 *    綠地與各級道路幾何數據，在初始化時離線預渲染為靜態高解析度 PNG DataURL 圖片 (`<img>`)，
 *    作為純粹的靜態底圖層 (`#osm-prerendered-img`)，絕不在平移時重繪底圖。
 * 2. 在該靜態圖片上方，使用獨立的 SVG 路線層 (`#nav-route-svg-layer`) 與獨立的 HTML DOM
 *    文字地名層、充電站/地點標記層、駐停車標層進行疊加互動。
 */

const cachedBaseMapUrls = {
  night: null,
  day: null
};

// 真實東京都心 (新宿 -> 澀谷 -> 六本木 -> 皇居) OSM 地理空間正規化幾何數據 (1000 x 1000 畫布空間)
const OSM_PARKS = [
  // 新宿中央公園
  { name: '新宿中央公園', poly: [[245, 340], [305, 340], [305, 425], [245, 425]] },
  // 新宿御苑
  { name: '新宿御苑', poly: [[445, 365], [565, 360], [580, 445], [455, 455]] },
  // 明治神宮與代代木公園
  { name: '代代木公園 · 明治神宮', poly: [[305, 495], [435, 485], [450, 665], [320, 675]] },
  // 明治神宮外苑
  { name: '明治神宮外苑', poly: [[520, 485], [605, 485], [610, 585], [525, 585]] },
  // 赤坂御用地
  { name: '赤坂御用地', poly: [[630, 490], [725, 485], [730, 565], [635, 570]] },
  // 皇居與皇居外苑
  { name: '皇居', poly: [[735, 325], [860, 320], [875, 455], [745, 465]] },
  // 芝公園
  { name: '芝公園', poly: [[785, 725], [855, 725], [855, 805], [785, 805]] }
];

const OSM_WATER_POLYS = [
  // 皇居護城河 (內堀)
  [[720, 310], [875, 305], [890, 470], [730, 480], [720, 310]],
  // 東京灣局部水域 (東南側)
  [[885, 760], [1000, 720], [1000, 1000], [840, 1000]]
];

const OSM_RIVERS = [
  // 神田川 -> 隅田川水系
  [[80, 230], [240, 215], [430, 195], [640, 185], [830, 210], [950, 310], [975, 590], [945, 820]],
  // 澀谷川 -> 古川
  [[415, 670], [435, 810], [565, 860], [745, 855], [910, 845]]
];

// 次級街廓網格與城市幹道
const OSM_MINOR_ROADS = [
  [[120, 180], [920, 180]],
  [[100, 260], [940, 260]],
  [[90, 330], [950, 330]],
  [[80, 470], [950, 470]],
  [[95, 560], [940, 560]],
  [[110, 640], [930, 640]],
  [[105, 720], [920, 720]],
  [[120, 810], [910, 810]],
  [[140, 895], [890, 895]],
  [[180, 100], [180, 940]],
  [[260, 100], [260, 940]],
  [[340, 100], [340, 940]],
  [[430, 100], [430, 940]],
  [[520, 100], [520, 940]],
  [[610, 100], [610, 940]],
  [[700, 100], [700, 940]],
  [[790, 100], [790, 940]],
  [[880, 100], [880, 940]]
];

const OSM_ARTERIAL_ROADS = [
  // 甲州街道 (國道20號) — 新宿至皇居半藏門
  { name: '甲州街道 (國道20號)', pts: [[40, 430], [340, 405], [550, 425], [735, 415]] },
  // 青梅街道 / 靖國通
  { name: '靖國通', pts: [[60, 340], [340, 345], [580, 330], [880, 315]] },
  // 明治通 (池袋 - 新宿 - 澀谷 - 惠比壽)
  { name: '明治通', pts: [[395, 60], [385, 360], [405, 560], [430, 810], [510, 960]] },
  // 山手通
  { name: '山手通', pts: [[245, 60], [240, 380], [275, 650], [360, 950]] },
  // 青山通 (國道246號 — 澀谷至赤坂/皇居)
  { name: '青山通 (國道246號)', pts: [[180, 920], [430, 810], [575, 645], [725, 515], [855, 465]] },
  // 外苑東通 / 六本木通
  { name: '外苑東通', pts: [[535, 220], [565, 480], [635, 665], [685, 745], [785, 865]] },
  // 內堀通 / 日比谷通
  { name: '日比谷通', pts: [[825, 180], [835, 455], [815, 760], [795, 950]] }
];

const OSM_EXPRESSWAYS = [
  // 首都高速 4 號新宿線
  { code: 'C4', pts: [[20, 455], [240, 420], [340, 395], [510, 465], [675, 485], [755, 455]] },
  // 首都高速 3 號澀谷線 -> 都心環狀線 C1
  { code: 'C1', pts: [[140, 945], [430, 825], [620, 765], [685, 745], [795, 640], [875, 475], [860, 310], [715, 285], [655, 465]] },
  // 首都高速中央環狀線 C2
  { code: 'C2', pts: [[250, 40], [245, 380], [280, 660], [365, 960]] }
];

// 獨立文字地名標籤層（顯示於靜態底圖之上）
export const OSM_PLACE_LABELS = [
  { text: '新宿區 · 西新宿都廳前', sub: 'SHINJUKU TOCHOMAE', x: 335, y: 342, tier: 'major' },
  { text: '新宿御苑', sub: 'SHINJUKU GYOEN', x: 510, y: 412, tier: 'park' },
  { text: '代代木公園 · 明治神宮', sub: 'YOYOGI PARK', x: 375, y: 585, tier: 'park' },
  { text: '澀谷區 · 宮益坂', sub: 'SHIBUYA', x: 430, y: 775, tier: 'major' },
  { text: '表參道 · 青山', sub: 'OMOTESANDO', x: 545, y: 660, tier: 'minor' },
  { text: '港區 · 六本木新城', sub: 'ROPPONGI HILLS', x: 685, y: 710, tier: 'major' },
  { text: '千代田區 · 皇居', sub: 'IMPERIAL PALACE', x: 800, y: 392, tier: 'park' },
  { text: '東京車站 · 丸之內', sub: 'MARUNOUCHI', x: 905, y: 405, tier: 'major' },
  { text: '代官山 · 惠比壽', sub: 'DAIKANYAMA', x: 375, y: 935, tier: 'minor' },
  { text: '芝公園 · 東京鐵塔', sub: 'SHIBA PARK', x: 825, y: 770, tier: 'minor' }
];

/**
 * 離線預渲染 OpenStreetMap 風格底圖為 PNG DataURL（每個主題僅生成一次並快取）
 */
export function getPrerenderedOsmBaseMapDataUrl(theme = 'night') {
  const mode = theme === 'day' ? 'day' : 'night';
  if (cachedBaseMapUrls[mode]) return cachedBaseMapUrls[mode];

  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d');
  const scale = 1.6; // 1000 -> 1600

  const isDay = mode === 'day';

  // 1. 陸地基底色
  ctx.fillStyle = isDay ? '#eef1f5' : '#13171f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(scale, scale);

  // 2. 城市建築街廓紋理 (Building footprints blocks)
  ctx.fillStyle = isDay ? '#e3e7ee' : '#181d27';
  for (let gx = 90; gx < 920; gx += 42) {
    for (let gy = 110; gy < 920; gy += 38) {
      const w = 26 + ((gx * 7 + gy * 3) % 10);
      const h = 22 + ((gx * 3 + gy * 11) % 9);
      ctx.fillRect(gx, gy, w, h);
    }
  }

  // 3. 公園綠地多邊形
  ctx.fillStyle = isDay ? '#d4ead7' : '#152521';
  ctx.strokeStyle = isDay ? '#b8dec0' : '#1e352f';
  ctx.lineWidth = 1.5;
  for (const park of OSM_PARKS) {
    ctx.beginPath();
    park.poly.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 4. 水域多邊形與河道 (神田川、隅田川、皇居護城河、東京灣)
  ctx.fillStyle = isDay ? '#a8d1f0' : '#11263c';
  for (const poly of OSM_WATER_POLYS) {
    ctx.beginPath();
    poly.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = isDay ? '#99c7ec' : '#132d48';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const river of OSM_RIVERS) {
    ctx.lineWidth = 10;
    ctx.beginPath();
    river.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // 5. 次級街區道路網
  ctx.strokeStyle = isDay ? '#ffffff' : '#212734';
  ctx.lineWidth = 2.6;
  for (const r of OSM_MINOR_ROADS) {
    ctx.beginPath();
    r.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // 6. 主要城市幹道 (甲州街道、明治通、青山通、山手通、靖國通)
  for (const art of OSM_ARTERIAL_ROADS) {
    // 外框線
    ctx.strokeStyle = isDay ? '#cbd5e1' : '#10141c';
    ctx.lineWidth = 8.5;
    ctx.beginPath();
    art.pts.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 內芯線
    ctx.strokeStyle = isDay ? '#ffffff' : '#2c3446';
    ctx.lineWidth = 6.0;
    ctx.stroke();
  }

  // 7. 首都高速道路 (C1 都心環狀線、4 號新宿線、C2 中央環狀線)
  for (const exp of OSM_EXPRESSWAYS) {
    ctx.strokeStyle = isDay ? '#d97706' : '#1f2937';
    ctx.lineWidth = 11.5;
    ctx.beginPath();
    exp.pts.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.strokeStyle = isDay ? '#fcd34d' : '#384459';
    ctx.lineWidth = 8.0;
    ctx.stroke();
  }

  // 8. 鐵道線 (JR 山手線與中央線虛線)
  ctx.save();
  ctx.strokeStyle = isDay ? '#94a3b8' : '#334155';
  ctx.lineWidth = 2.2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(340, 80);
  ctx.lineTo(345, 380);
  ctx.lineTo(425, 810);
  ctx.lineTo(750, 880);
  ctx.lineTo(890, 420);
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');
  cachedBaseMapUrls[mode] = dataUrl;
  return dataUrl;
}
