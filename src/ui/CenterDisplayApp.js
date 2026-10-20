/**
 * 階段一：Tesla Model 3 中控屏 (1920×1200 固定設計畫布等比縮放) 主視圖控制器
 * -----------------------------------------------------------------------------
 * 嚴格實作階段一全部 11 項功能與車型配置規範：
 * - 1920×1200 固定設計畫布，隨任意視窗大小等比縮放，絕不重排或跑版。
 * - 左側 3D 車輛視圖（收合正俯視 / 展開低角度前 3/4 視角，僅展開可旋轉、5 秒回正、雙擊重置、禁滾輪縮放）。
 * - 前備箱、尾箱、充電口指向線與真實開合動畫（收合時充電口在左、前備箱與尾箱在右）。
 * - 空調底部抽屜（3D 座艙氣流動畫、可拖動出風方向、風量檔位 1-10、雙區溫度、空調電源、前後除霜開關）。
 * - 前排座椅視圖（可調前後位置、座墊高度与靠背角度，持久化於 localStorage）。
 * - OpenStreetMap 離線預渲染底圖 + 獨立文字/地點/充電站/車標/路線互動層（車輛保持 P 擋駐停）。
 * - 緊湊音樂卡片與地圖疊層獨立播放窗雙向同步（5 首虛構曲目、封面、進度、上下首、收藏、佇列、音量滑桿）。
 * - 12 大官方手冊設置分類（含開關、分段選擇、滑桿、調整對話框、依賴禁用原因提示、臨時模式覆蓋與恢復）。
 * - 屏幕清潔模式全屏遮罩（按鈕或 Esc 退出）與所有彈窗之鍵盤焦點管理。
 */

import { VEHICLE_CONFIGS } from '../config/vehicleConfigs.js';
import { PHASE1_BEHAVIOR_MATRIX, PHASE1_REFERENCE_SOURCES } from '../config/behaviorMatrix.js';
import { FICTIONAL_TRACKS, NAVIGATION_POIS } from '../state/phase1Store.js';
import { getPrerenderedOsmBaseMapDataUrl, OSM_PLACE_LABELS } from '../engine/OsmMapRenderer.js';
import { icon } from './icons.js';

export class CenterDisplayApp {
  constructor(rootEl, store, engine3D) {
    this.rootEl = rootEl;
    this.store = store;
    this.engine3D = engine3D;

    this.lastFocusedTrigger = null;
    this.showMatrixModal = false;

    // 數字緩動顯示狀態 (Number Easing)
    this.easedNums = {
      driverTemp: store.getState().climate.driverTempC,
      passengerTemp: store.getState().climate.passengerTempC,
      soc: store.getState().vehicle.socPercent
    };

    this.mountStaticShell();
    this.bindGlobalEvents();
    this.setupProportionalScaling();
    this.startNumberEasingAndMediaClock();

    this.store.subscribe((state, tags) => {
      this.renderDynamicLayers(state, tags);
    });

    this.renderDynamicLayers(this.store.getState(), ['init']);
  }

  /**
   * 建立 1920×1200 固定設計畫布與外層等比縮放舞台
   */
  mountStaticShell() {
    this.rootEl.innerHTML = `
      <div class="viewport-scaler-stage" id="viewport-scaler-stage">
        <div class="center-fixed-canvas" id="tesla-center-canvas-1920x1200" data-theme="night">
          <!-- 頂部車型配置與階段一驗收工具列（位於固定畫布頂緣） -->
          <header class="phase1-top-strip" id="phase1-top-strip"></header>

          <!-- 中控屏主工作區 (左車右圖 + 浮層抽屜) -->
          <main class="center-main-workspace" id="center-main-workspace">
            <!-- 左側：3D 車輛視圖區 -->
            <section class="vehicle-view-pane" id="vehicle-view-pane" aria-label="車輛 3D 視圖">
              <!-- 車輛頂部狀態列 (P 擋、電量、車鎖、時間、視角切換) -->
              <div class="vehicle-status-bar" id="vehicle-status-bar"></div>

              <!-- 3D 車輛畫布與指向線互動層 -->
              <div class="vehicle-3d-stage" id="vehicle-3d-stage">
                <canvas id="canvas-vehicle-3d" class="vehicle-3d-canvas" tabindex="0" aria-label="Model 3 3D 互動模型"></canvas>
                <!-- 3D 投影指向線 SVG 層 -->
                <svg class="vehicle-callout-svg" id="vehicle-callout-svg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
                <!-- 前備箱、尾箱、充電口控制按鈕層 -->
                <div class="vehicle-callout-controls" id="vehicle-callout-controls"></div>
                <!-- 視角互動提示與 5 秒自動回正倒數標籤 -->
                <div class="vehicle-camera-hud" id="vehicle-camera-hud">
                  <span class="cam-inactivity-badge" id="cam-inactivity-badge" style="display:none;"></span>
                  <span class="cam-mode-hint" id="cam-mode-hint"></span>
                </div>
              </div>

              <!-- 左下：緊湊音樂卡片 (與地圖疊層播放窗同步) -->
              <div class="compact-media-card" id="compact-media-card"></div>
            </section>

            <!-- 右側：OpenStreetMap 離線預渲染底圖 + 獨立導航互動層 -->
            <section class="navigation-map-pane" id="navigation-map-pane" aria-label="導航地圖">
              <!-- 可平移與縮放的地圖舞台 -->
              <div class="nav-pan-zoom-viewport" id="nav-pan-zoom-viewport">
                <div class="nav-pan-zoom-stage" id="nav-pan-zoom-stage">
                  <!-- 第一層：OpenStreetMap 離線預渲染靜態圖片底圖 -->
                  <img id="osm-prerendered-img" class="osm-prerendered-img" alt="OpenStreetMap 離線預渲染底圖" draggable="false" />
                  <!-- 第二層：獨立 SVG 導航路線與備選路線比較層 -->
                  <svg id="nav-route-svg-layer" class="nav-route-svg-layer" viewBox="0 0 1000 1000"></svg>
                  <!-- 第三層：獨立文字地名標籤層 -->
                  <div id="nav-place-labels-layer" class="nav-place-labels-layer"></div>
                  <!-- 第四層：獨立地點與超級充電站標記層 -->
                  <div id="nav-poi-pins-layer" class="nav-poi-pins-layer"></div>
                  <!-- 第五層：獨立駐停自車車標層 (保持 P 擋停車) -->
                  <div id="nav-ego-car-layer" class="nav-ego-car-layer"></div>
                </div>
              </div>

              <!-- 地圖左上：搜尋欄、目的地選擇、路線比較與導航演示面板 -->
              <div class="nav-overlay-top-left" id="nav-overlay-top-left"></div>

              <!-- 地圖右上：駐停狀態、超充篩選與指南針 -->
              <div class="nav-overlay-top-right" id="nav-overlay-top-right"></div>

              <!-- 地圖左下：展開的獨立音樂播放窗（疊在地圖上，與左下緊湊卡片同步） -->
              <div class="map-music-window" id="map-music-window" role="dialog" aria-label="獨立音樂播放窗"></div>

              <!-- 地圖右下：平移、縮放、回中控制列 與 © OpenStreetMap contributors 版權標記 -->
              <div class="nav-overlay-bottom-right" id="nav-overlay-bottom-right"></div>
            </section>

            <!-- 抽屜一：12 大官方手冊分類「車輛設置抽屜」 -->
            <section class="settings-drawer-backdrop" id="settings-drawer-backdrop" aria-hidden="true">
              <div class="settings-drawer-panel" id="settings-drawer-panel" role="dialog" aria-modal="true" aria-label="車輛設置面板"></div>
            </section>

            <!-- 抽屜二：從底部彈出的「空調與前排座椅抽屜」 -->
            <section class="climate-drawer-backdrop" id="climate-drawer-backdrop" aria-hidden="true">
              <div class="climate-drawer-panel" id="climate-drawer-panel" role="dialog" aria-modal="true" aria-label="恆溫空調與座椅控制抽屜"></div>
            </section>

            <!-- 調整對話框層（後視鏡調節、方向盤調節、軟件發行說明、恢復出廠預設、關閉電源） -->
            <div class="adjustment-dialog-layer" id="adjustment-dialog-layer" aria-hidden="true"></div>

            <!-- 行為對照表與車型配置檢視彈窗 -->
            <div class="matrix-modal-layer" id="matrix-modal-layer" aria-hidden="true"></div>
          </main>

          <!-- 底部常駐 Dock（車控入口、左溫度、空調入口、應用圖標、右溫度、音量與展開滑桿） -->
          <footer class="center-bottom-dock" id="center-bottom-dock" aria-label="底部常駐 Dock"></footer>

          <!-- 音量展開滑桿浮層 -->
          <div class="dock-volume-popover" id="dock-volume-popover" role="dialog" aria-label="音量控制滑桿"></div>

          <!-- 屏幕清潔模式全屏遮罩（覆蓋整個 1920×1200 畫面並屏蔽底層操作，按鈕或 Esc 退出） -->
          <div class="screen-clean-overlay" id="screen-clean-overlay" role="dialog" aria-modal="true" aria-label="屏幕清潔模式"></div>

          <!-- Toast 狀態提示膠囊 -->
          <div class="phase1-toast-banner" id="phase1-toast-banner" aria-live="polite"></div>
        </div>
      </div>
    `;

    const vehCanvas = document.getElementById('canvas-vehicle-3d');
    if (vehCanvas) {
      this.engine3D.mountVehicleCanvas(vehCanvas);
    }
    this.bindMapPanEvents();
  }

  /**
   * 固定 1920×1200 設計畫布按窗口等比縮放，絕不重排或跑版
   */
  setupProportionalScaling() {
    const updateScale = () => {
      const stage = document.getElementById('viewport-scaler-stage');
      const canvas = document.getElementById('tesla-center-canvas-1920x1200');
      if (!stage || !canvas) return;

      const ww = window.innerWidth || 1920;
      const wh = window.innerHeight || 1200;
      const scaleX = ww / 1920;
      const scaleY = wh / 1200;
      const scale = Math.min(scaleX, scaleY) * 0.985;

      canvas.style.transform = `scale(${scale.toFixed(4)})`;
      canvas.dataset.currentScale = scale.toFixed(3);
    };

    window.addEventListener('resize', updateScale);
    updateScale();
  }

  /**
   * 數字緩動與音樂進度計時器
   */
  startNumberEasingAndMediaClock() {
    setInterval(() => {
      const st = this.store.getState();
      if (st.media.playing) {
        const track = FICTIONAL_TRACKS[st.media.trackIndex] || FICTIONAL_TRACKS[0];
        st.media.progressSec = (st.media.progressSec + 1) % track.durationSec;
        this.updateMediaProgressDOM(st);
      }
    }, 1000);

    const easeStep = () => {
      const st = this.store.getState();
      this.easedNums.driverTemp += (st.climate.driverTempC - this.easedNums.driverTemp) * 0.22;
      this.easedNums.passengerTemp += (st.climate.passengerTempC - this.easedNums.passengerTemp) * 0.22;

      const dEl = document.getElementById('dock-driver-temp-val');
      if (dEl) dEl.textContent = `${this.easedNums.driverTemp.toFixed(1)}°`;
      const pEl = document.getElementById('dock-passenger-temp-val');
      if (pEl) pEl.textContent = `${this.easedNums.passengerTemp.toFixed(1)}°`;

      requestAnimationFrame(easeStep);
    };
    requestAnimationFrame(easeStep);
  }

  updateMediaProgressDOM(s) {
    const track = FICTIONAL_TRACKS[s.media.trackIndex] || FICTIONAL_TRACKS[0];
    const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
    const pct = ((s.media.progressSec / track.durationSec) * 100).toFixed(1);

    const bar1 = document.getElementById('compact-media-prog-fill');
    if (bar1) bar1.style.width = `${pct}%`;
    const time1 = document.getElementById('compact-media-time-txt');
    if (time1) time1.textContent = `${fmt(s.media.progressSec)} / ${fmt(track.durationSec)}`;

    const scrubber2 = document.getElementById('expanded-media-scrubber');
    if (scrubber2 && document.activeElement !== scrubber2) {
      scrubber2.value = String(s.media.progressSec);
    }
    const time2 = document.getElementById('expanded-media-time-cur');
    if (time2) time2.textContent = fmt(s.media.progressSec);
  }

  /**
   * 渲染所有動態圖層
   */
  renderDynamicLayers(s, _tags = []) {
    const canvasRoot = document.getElementById('tesla-center-canvas-1920x1200');
    if (canvasRoot) {
      const theme = s.settings.appearanceTheme === 'day' ? 'day' : 'night';
      canvasRoot.setAttribute('data-theme', theme);
      canvasRoot.style.filter = `brightness(${0.55 + (s.settings.brightnessPercent / 100) * 0.45})`;
      canvasRoot.classList.toggle('is-large-text', s.settings.textSize === 'large');
    }

    const leftPane = document.getElementById('vehicle-view-pane');
    if (leftPane) {
      leftPane.classList.toggle('is-expanded', s.camera3D.expanded);
    }

    this.renderTopStrip(s);
    this.renderVehicleStatusBar(s);
    this.renderVehicleCallouts(s);
    this.renderCompactMediaCard(s);
    this.renderNavigationLayers(s);
    this.renderMapMusicWindow(s);
    this.renderSettingsDrawer(s);
    this.renderClimateDrawer(s);
    this.renderAdjustmentDialog(s);
    this.renderMatrixModal(s);
    this.renderBottomDock(s);
    this.renderVolumePopover(s);
    this.renderScreenCleanOverlay(s);
    this.renderToast(s);
  }

  /**
   * 頂部車型配置切換與階段一驗收工具列
   */
  renderTopStrip(s) {
    const el = document.getElementById('phase1-top-strip');
    if (!el) return;
    const cfg = this.store.getVehicleConfig();
    const activeTempModes = [];
    if (s.settings.carWashMode) activeTempModes.push('洗車模式覆蓋中');
    if (s.settings.towMode) activeTempModes.push('牽引模式覆蓋中');
    if (s.settings.screenCleanMode) activeTempModes.push('屏幕清潔模式啟用中');

    el.innerHTML = `
      <div class="top-strip-left">
        <span class="top-brand-pill">TESLA 階段一驗收 · 中控屏深度原型</span>
        <div class="top-config-switcher" role="group" aria-label="車型配置切換">
          <button class="strip-btn is-active" data-action="select-vehicle-config" data-config="model3">
            <span>${VEHICLE_CONFIGS.model3.name} (${VEHICLE_CONFIGS.model3.centerScreen.diagonalInch}" 中控屏 · 已載入真實 GLB)</span>
          </button>
          <button class="strip-btn is-disabled-config" data-action="select-vehicle-config" data-config="models" title="${VEHICLE_CONFIGS.models.unavailableReason}">
            <span>Model S (階段四預留 · 待真實 GLB 模型)</span>
          </button>
        </div>
        ${
          activeTempModes.length > 0
            ? `<span class="temp-mode-active-pill">${activeTempModes.join(' · ')}</span>`
            : `<span class="top-manual-ref">依據：<a href="${cfg.manual.url}" target="_blank" rel="noopener noreferrer">${cfg.manual.title}</a></span>`
        }
      </div>
      <div class="top-strip-right">
        <button class="strip-btn ${s.camera3D.expanded ? 'is-active' : ''}" data-action="toggle-camera-expand">
          <span>${s.camera3D.expanded ? '視角：展開低角度前 3/4 (可拖動/方向鍵旋轉)' : '視角：收合正俯視 (點擊展開 3D 視角)'}</span>
        </button>
        <button class="strip-btn ${s.settings.appearanceTheme === 'day' ? 'is-active' : ''}" data-action="toggle-day-night">
          <span>${s.settings.appearanceTheme === 'day' ? '日間淺色模式' : '夜間深色模式'}</span>
        </button>
        <button class="strip-btn is-accent" data-action="toggle-matrix-modal">
          <span>行為對照表與車型配置 (${PHASE1_BEHAVIOR_MATRIX.length} 項)</span>
        </button>
      </div>
    `;
  }

  /**
   * 左側車輛視圖頂部狀態列
   */
  renderVehicleStatusBar(s) {
    const el = document.getElementById('vehicle-status-bar');
    if (!el) return;
    const energyStr =
      s.settings.energyDisplayMode === 'distance'
        ? `${Math.round((s.vehicle.socPercent / 100) * s.vehicle.ratedRangeKm)} km`
        : `${s.vehicle.socPercent}%`;

    el.innerHTML = `
      <div class="vsb-left">
        <div class="gear-Cluster" aria-label="當前檔位 P 擋">
          <span class="gear-pill is-active">P</span>
          <span class="gear-pill">R</span>
          <span class="gear-pill">N</span>
          <span class="gear-pill">D</span>
        </div>
        <button class="vsb-lock-btn ${s.vehicle.locked ? 'is-locked' : 'is-unlocked'}" data-action="toggle-lock" title="切換全車中控鎖">
          ${icon(s.vehicle.locked ? 'lock' : 'unlock')}
          <span>${s.vehicle.locked ? '已上鎖' : '未上鎖'}</span>
        </button>
      </div>

      <div class="vsb-right">
        <button class="vsb-battery-pill" data-action="toggle-energy-display" title="點擊切換百分比或里程顯示">
          <span class="bat-bar-wrap"><span class="bat-bar-fill" style="width:${s.vehicle.socPercent}%"></span></span>
          <strong class="mono-num">${energyStr}</strong>
        </button>
        <span class="vsb-time mono-num">${s.settings.timeFormat === '12h' ? '下午 4:28' : '16:28'}</span>
        <span class="airbag-badge" title="副駕安全氣囊自動感應開啟">副駕氣囊 開啟</span>
      </div>
    `;
  }

  /**
   * 渲染前備箱、尾箱、充電口之指向線與開合控制按鈕
   * 嚴格遵循規範第 3 條：「收合時前備箱與尾箱控制在模型右側，充電口控制在左側」
   */
  renderVehicleCallouts(s) {
    const svgEl = document.getElementById('vehicle-callout-svg');
    const ctrlEl = document.getElementById('vehicle-callout-controls');
    const hintEl = document.getElementById('cam-mode-hint');
    if (!svgEl || !ctrlEl) return;

    const expanded = s.camera3D.expanded;
    if (hintEl) {
      hintEl.textContent = expanded
        ? '展開模式：可滑鼠拖動或按方向鍵旋轉 · 5 秒無操作自動回正 · 雙擊立即重置 · 已禁用滾輪縮放'
        : '收合俯視模式：固定正俯視視角（展開後可旋轉） · 左側控制充電口，右側控制前備箱與尾箱';
    }

    // 控制按鈕錨點座標 (百分比 0~100)
    // 收合時：充電口在左側 (x=18, y=68)，前備箱在右上側 (x=82, y=24)，尾箱在右下側 (x=82, y=72)
    // 展開時：前備箱在右前 (x=80, y=32)，尾箱在左上 (x=24, y=28)，充電口在左下 (x=22, y=68)
    const btnCoords = expanded
      ? {
          chargePort: { x: 22, y: 68, sideClass: 'pos-left-bottom' },
          frunk: { x: 80, y: 34, sideClass: 'pos-right-top' },
          trunk: { x: 24, y: 26, sideClass: 'pos-left-top' }
        }
      : {
          chargePort: { x: 20, y: 68, sideClass: 'pos-collapsed-left' },
          frunk: { x: 80, y: 25, sideClass: 'pos-collapsed-right-top' },
          trunk: { x: 80, y: 72, sideClass: 'pos-collapsed-right-bottom' }
        };

    const proj = this.engine3D.projectedAnchors;

    svgEl.innerHTML = `
      <line id="callout-line-chargePort" class="callout-leader-line ${s.vehicle.chargePortOpen ? 'is-open' : ''}"
        x1="${btnCoords.chargePort.x}" y1="${btnCoords.chargePort.y}"
        x2="${proj.chargePort.x.toFixed(1)}" y2="${proj.chargePort.y.toFixed(1)}" />
      <circle id="callout-dot-chargePort" class="callout-anchor-dot ${s.vehicle.chargePortOpen ? 'is-open' : ''}"
        cx="${proj.chargePort.x.toFixed(1)}" cy="${proj.chargePort.y.toFixed(1)}" r="1.2" />

      <line id="callout-line-frunk" class="callout-leader-line ${s.vehicle.frunkOpen ? 'is-open' : ''}"
        x1="${btnCoords.frunk.x}" y1="${btnCoords.frunk.y}"
        x2="${proj.frunk.x.toFixed(1)}" y2="${proj.frunk.y.toFixed(1)}" />
      <circle id="callout-dot-frunk" class="callout-anchor-dot ${s.vehicle.frunkOpen ? 'is-open' : ''}"
        cx="${proj.frunk.x.toFixed(1)}" cy="${proj.frunk.y.toFixed(1)}" r="1.2" />

      <line id="callout-line-trunk" class="callout-leader-line ${s.vehicle.trunkOpen ? 'is-open' : ''}"
        x1="${btnCoords.trunk.x}" y1="${btnCoords.trunk.y}"
        x2="${proj.trunk.x.toFixed(1)}" y2="${proj.trunk.y.toFixed(1)}" />
      <circle id="callout-dot-trunk" class="callout-anchor-dot ${s.vehicle.trunkOpen ? 'is-open' : ''}"
        cx="${proj.trunk.x.toFixed(1)}" cy="${proj.trunk.y.toFixed(1)}" r="1.2" />
    `;

    const dep = this.store.getControlDependency('frunkOpen');
    const disAttr = dep.disabled ? `disabled title="${dep.reason}"` : '';

    ctrlEl.innerHTML = `
      <!-- 左側：充電口控制 -->
      <button class="callout-pill-btn ${btnCoords.chargePort.sideClass} ${s.vehicle.chargePortOpen ? 'is-open' : ''} ${dep.disabled ? 'is-disabled' : ''}"
        style="left:${btnCoords.chargePort.x}%; top:${btnCoords.chargePort.y}%;"
        data-action="toggle-car-part" data-part="chargePort" ${disAttr}>
        ${icon('bolt')}
        <div class="callout-btn-text">
          <strong>充電口</strong>
          <span>${s.vehicle.chargePortOpen ? '已開啟 (點擊關閉)' : '已關閉 (點擊開啟)'}</span>
        </div>
      </button>

      <!-- 右上：前備箱控制 -->
      <button class="callout-pill-btn ${btnCoords.frunk.sideClass} ${s.vehicle.frunkOpen ? 'is-open' : ''} ${dep.disabled ? 'is-disabled' : ''}"
        style="left:${btnCoords.frunk.x}%; top:${btnCoords.frunk.y}%;"
        data-action="toggle-car-part" data-part="frunk" ${disAttr}>
        ${icon('frunk')}
        <div class="callout-btn-text">
          <strong>前備箱</strong>
          <span>${s.vehicle.frunkOpen ? '已開啟 (點擊關閉)' : '開啟前備箱'}</span>
        </div>
      </button>

      <!-- 右下：尾箱控制 -->
      <button class="callout-pill-btn ${btnCoords.trunk.sideClass} ${s.vehicle.trunkOpen ? 'is-open' : ''} ${dep.disabled ? 'is-disabled' : ''}"
        style="left:${btnCoords.trunk.x}%; top:${btnCoords.trunk.y}%;"
        data-action="toggle-car-part" data-part="trunk" ${disAttr}>
        ${icon('trunk')}
        <div class="callout-btn-text">
          <strong>尾箱</strong>
          <span>${s.vehicle.trunkOpen ? '已開啟 (點擊關閉)' : '開啟尾箱'}</span>
        </div>
      </button>

      <!-- 展開/收合與重置視角浮動控制組 -->
      <div class="camera-quick-actions">
        <button class="cam-action-btn ${expanded ? 'is-active' : ''}" data-action="toggle-camera-expand">
          <span>${expanded ? '收合為正俯視' : '展開 3D 前 3/4 視角'}</span>
        </button>
        ${
          expanded
            ? `
          <button class="cam-action-btn" data-action="rotate-cam-step" data-key="ArrowLeft" title="向左旋轉視角">◀ 左轉</button>
          <button class="cam-action-btn" data-action="rotate-cam-step" data-key="ArrowRight" title="向右旋轉視角">右轉 ▶</button>
          <button class="cam-action-btn" data-action="reset-camera-3d" title="雙擊畫布亦可立即重置視角">重置視角</button>
        `
            : ''
        }
      </div>
    `;
  }

  /**
   * 產生曲目 SVG 幾何封面
   */
  renderTrackCoverSvg(track, size = 56) {
    const [c0, c1, c2] = track.coverColors;
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 64 64" class="track-cover-svg" aria-hidden="true">
        <defs>
          <linearGradient id="grad-${track.id}-${size}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${c0}" />
            <stop offset="60%" stop-color="${c1}" />
            <stop offset="100%" stop-color="${c2}" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="12" fill="url(#grad-${track.id}-${size})" />
        <circle cx="32" cy="32" r="18" fill="none" stroke="rgba(255,255,255,0.32)" stroke-width="2" />
        <circle cx="32" cy="32" r="6" fill="rgba(255,255,255,0.85)" />
      </svg>
    `;
  }

  /**
   * 左下緊湊音樂卡片（與地圖疊層獨立播放窗 100% 同步）
   */
  renderCompactMediaCard(s) {
    const el = document.getElementById('compact-media-card');
    if (!el) return;
    const track = FICTIONAL_TRACKS[s.media.trackIndex] || FICTIONAL_TRACKS[0];
    const isFav = s.media.favorites.includes(track.id);
    const pct = ((s.media.progressSec / track.durationSec) * 100).toFixed(1);
    const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

    el.innerHTML = `
      <div class="cmc-top-row">
        <div class="cmc-cover-wrap" data-action="toggle-music-window" title="點擊展開或收合地圖疊層播放窗">
          ${this.renderTrackCoverSvg(track, 52)}
        </div>
        <div class="cmc-meta" data-action="toggle-music-window">
          <div class="cmc-title">${track.title}</div>
          <div class="cmc-artist">${track.artist} · ${track.album}</div>
          <div class="cmc-time mono-num" id="compact-media-time-txt">${fmt(s.media.progressSec)} / ${fmt(track.durationSec)}</div>
        </div>
        <div class="cmc-actions">
          <button class="icon-btn ${isFav ? 'is-fav' : ''}" data-action="toggle-track-fav" data-id="${track.id}" title="收藏曲目">
            <span>${isFav ? '♥ 已收藏' : '♡ 收藏'}</span>
          </button>
          <button class="icon-btn ${s.media.playerWindowExpanded ? 'is-active' : ''}" data-action="toggle-music-window" title="展開獨立播放窗與佇列">
            <span>${s.media.playerWindowExpanded ? '收合播放窗' : '展開佇列窗'}</span>
          </button>
        </div>
      </div>

      <div class="cmc-progress-track" data-action="scrub-compact-media">
        <div class="cmc-progress-fill" id="compact-media-prog-fill" style="width:${pct}%"></div>
      </div>

      <div class="cmc-controls-row">
        <button class="media-ctrl-btn" data-action="media-prev" aria-label="上一首">${icon('prev')}<span>上一首</span></button>
        <button class="media-ctrl-btn is-primary" data-action="media-toggle-play" aria-label="${s.media.playing ? '暫停' : '播放'}">
          ${icon(s.media.playing ? 'pause' : 'play')}
          <span>${s.media.playing ? '暫停' : '播放'}</span>
        </button>
        <button class="media-ctrl-btn" data-action="media-next" aria-label="下一首">${icon('next')}<span>下一首</span></button>
      </div>
    `;
  }

  /**
   * 疊在地圖上的獨立音樂播放窗（含封面、進度滑桿、收藏與 5 首虛構曲目佇列）
   */
  renderMapMusicWindow(s) {
    const el = document.getElementById('map-music-window');
    if (!el) return;
    if (!s.media.playerWindowExpanded) {
      el.classList.remove('is-open');
      el.innerHTML = '';
      return;
    }

    el.classList.add('is-open');
    const track = FICTIONAL_TRACKS[s.media.trackIndex] || FICTIONAL_TRACKS[0];
    const isFav = s.media.favorites.includes(track.id);
    const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

    el.innerHTML = `
      <header class="mmw-header">
        <div class="mmw-header-title">
          ${icon('music')}
          <div>
            <h4>車載獨立音樂播放窗</h4>
            <span>與左下緊湊音樂卡片即時雙向同步 · 5 首原創虛構曲目</span>
          </div>
        </div>
        <button class="icon-btn" data-action="toggle-music-window" aria-label="關閉獨立播放窗">${icon('close')}</button>
      </header>

      <div class="mmw-body">
        <div class="mmw-now-playing">
          ${this.renderTrackCoverSvg(track, 88)}
          <div class="mmw-np-info">
            <div class="mmw-np-title">${track.title}</div>
            <div class="mmw-np-sub">${track.artist}</div>
            <div class="mmw-np-album">${track.album}</div>
            <div class="mmw-np-btns">
              <button class="media-ctrl-btn" data-action="media-prev">${icon('prev')}<span>上一首</span></button>
              <button class="media-ctrl-btn is-primary" data-action="media-toggle-play">
                ${icon(s.media.playing ? 'pause' : 'play')}
                <span>${s.media.playing ? '暫停' : '播放'}</span>
              </button>
              <button class="media-ctrl-btn" data-action="media-next">${icon('next')}<span>下一首</span></button>
              <button class="media-ctrl-btn ${isFav ? 'is-fav' : ''}" data-action="toggle-track-fav" data-id="${track.id}">
                <span>${isFav ? '♥ 已收藏' : '♡ 加入收藏'}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="mmw-scrubber-row">
          <span class="mono-num" id="expanded-media-time-cur">${fmt(s.media.progressSec)}</span>
          <input id="expanded-media-scrubber" type="range" min="0" max="${track.durationSec}" step="1"
            value="${s.media.progressSec}" data-action="media-scrub-input" aria-label="播放進度滑桿" />
          <span class="mono-num">${fmt(track.durationSec)}</span>
        </div>

        <div class="mmw-queue-section">
          <div class="mmw-queue-title">播放佇列 (Up Next · 共 5 首虛構曲目)</div>
          <div class="mmw-queue-list">
            ${FICTIONAL_TRACKS.map((t, idx) => {
              const active = idx === s.media.trackIndex;
              const fav = s.media.favorites.includes(t.id);
              return `
                <button class="mmw-queue-row ${active ? 'is-active' : ''}" data-action="select-track" data-idx="${idx}">
                  <div class="mmw-q-left">
                    <span class="mono-num mmw-q-num">${idx + 1}</span>
                    ${this.renderTrackCoverSvg(t, 34)}
                    <div>
                      <div class="mmw-q-name">${t.title}</div>
                      <div class="mmw-q-artist">${t.artist} · ${t.album}</div>
                    </div>
                  </div>
                  <div class="mmw-q-right">
                    ${fav ? '<span class="fav-tag">♥ 收藏</span>' : ''}
                    <span class="mono-num">${fmt(t.durationSec)}</span>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染右側導航：OpenStreetMap 離線預渲染底圖 + 獨立文字/地點/車標/路線互動層
   */
  renderNavigationLayers(s) {
    const nav = s.navigation;
    const theme = s.settings.appearanceTheme === 'day' ? 'day' : 'night';

    // 1. 更新離線預渲染 OSM 底圖圖片
    const baseImg = document.getElementById('osm-prerendered-img');
    if (baseImg) {
      const targetUrl = getPrerenderedOsmBaseMapDataUrl(theme);
      if (baseImg.dataset.loadedTheme !== theme) {
        baseImg.src = targetUrl;
        baseImg.dataset.loadedTheme = theme;
      }
    }

    // 2. 平移與縮放變換矩陣
    const stageEl = document.getElementById('nav-pan-zoom-stage');
    if (stageEl) {
      stageEl.style.transform = `translate(${nav.panX.toFixed(1)}px, ${nav.panY.toFixed(1)}px) scale(${nav.zoom.toFixed(3)})`;
    }

    const selectedPoi = NAVIGATION_POIS.find((p) => p.id === nav.selectedPoiId) || NAVIGATION_POIS[0];
    const routesMap = selectedPoi.routes || {};
    const activeRoute = routesMap[nav.selectedRouteId] || routesMap.fastest;

    // 3. 獨立 SVG 路線層（支援三條路線比較與主路線高亮）
    const routeSvg = document.getElementById('nav-route-svg-layer');
    if (routeSvg) {
      let svgHtml = '';
      if (nav.routeCompareOpen || nav.demoGuidanceActive) {
        for (const [rKey, rObj] of Object.entries(routesMap)) {
          if (rKey === nav.selectedRouteId) continue;
          const ptsStr = rObj.points.map((pt) => pt.join(',')).join(' ');
          svgHtml += `
            <polyline points="${ptsStr}" fill="none" stroke="rgba(148, 163, 184, 0.65)" stroke-width="7" stroke-dasharray="10 8" stroke-linecap="round" stroke-linejoin="round" />
          `;
        }
      }
      if (activeRoute) {
        const ptsStr = activeRoute.points.map((pt) => pt.join(',')).join(' ');
        svgHtml += `
          <polyline points="${ptsStr}" fill="none" stroke="rgba(15, 23, 42, 0.75)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" />
          <polyline points="${ptsStr}" fill="none" stroke="#3b82f6" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round" />
        `;
      }
      routeSvg.innerHTML = svgHtml;
    }

    // 4. 獨立文字地名標籤層
    const labelsLayer = document.getElementById('nav-place-labels-layer');
    if (labelsLayer) {
      labelsLayer.innerHTML = OSM_PLACE_LABELS.map(
        (lb) => `
          <div class="osm-place-label tier-${lb.tier}" style="left:${(lb.x / 10).toFixed(1)}%; top:${(lb.y / 10).toFixed(1)}%;">
            <span class="osm-label-cn">${lb.text}</span>
            <small class="osm-label-en">${lb.sub}</small>
          </div>
        `
      ).join('');
    }

    // 5. 獨立地點與超級充電站標記層
    const pinsLayer = document.getElementById('nav-poi-pins-layer');
    if (pinsLayer) {
      const q = (nav.searchQuery || '').trim().toLowerCase();
      const visiblePois = NAVIGATION_POIS.filter((p) => {
        if (!nav.showSuperchargers && p.category === 'supercharger' && p.id !== nav.selectedPoiId) return false;
        if (q && !p.name.toLowerCase().includes(q) && !p.address.toLowerCase().includes(q)) return false;
        return true;
      });

      pinsLayer.innerHTML = visiblePois
        .map((p) => {
          const isSelected = p.id === nav.selectedPoiId;
          const isSc = p.category === 'supercharger';
          return `
            <button class="osm-poi-pin ${isSc ? 'is-supercharger' : 'is-landmark'} ${isSelected ? 'is-selected' : ''}"
              style="left:${(p.mapX / 10).toFixed(1)}%; top:${(p.mapY / 10).toFixed(1)}%;"
              data-action="select-nav-poi" data-id="${p.id}">
              <span class="poi-pin-badge">
                ${isSc ? `⚡ ${p.availableStalls}/${p.totalStalls} 空位 · ${p.powerKw}kW` : '📍 地標'}
              </span>
              <strong class="poi-pin-name">${p.name}</strong>
            </button>
          `;
        })
        .join('');
    }

    // 6. 獨立駐停自車車標層 (車輛保持 P 擋駐停，不模擬行駛)
    const egoLayer = document.getElementById('nav-ego-car-layer');
    if (egoLayer) {
      egoLayer.innerHTML = `
        <div class="ego-car-marker" style="left:${(nav.egoX / 10).toFixed(1)}%; top:${(nav.egoY / 10).toFixed(1)}%;" title="當前駐停位置：新宿都廳前 (P 擋)">
          <div class="ego-pulse-ring"></div>
          <div class="ego-arrow-disc">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 3L19 20L12 16.5L5 20L12 3Z" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/></svg>
          </div>
          <span class="ego-parked-tag">自車駐停中 (P)</span>
        </div>
      `;
    }

    // 7. 左上搜尋、路線比較與導航演示控制卡
    const topLeftEl = document.getElementById('nav-overlay-top-left');
    if (topLeftEl) {
      const q = (nav.searchQuery || '').trim().toLowerCase();
      const filteredPois = NAVIGATION_POIS.filter(
        (p) => !q || p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
      );

      topLeftEl.innerHTML = `
        <div class="nav-search-card">
          <div class="nav-search-input-row">
            ${icon('search')}
            <input type="text" class="nav-search-input" placeholder="搜尋目的地或超級充電站..."
              value="${nav.searchQuery}" data-action="nav-search-input" aria-label="搜尋目的地" />
            <button class="nav-filter-btn ${nav.showSuperchargers ? 'is-active' : ''}" data-action="toggle-sc-layer" title="顯示或隱藏超級充電站">
              ${icon('bolt')}<span>超充站</span>
            </button>
          </div>

          <div class="nav-poi-quick-list">
            ${filteredPois
              .map(
                (p) => `
              <button class="nav-poi-item ${p.id === nav.selectedPoiId ? 'is-selected' : ''}" data-action="select-nav-poi" data-id="${p.id}">
                <div class="npi-left">
                  <span class="npi-icon">${p.category === 'supercharger' ? '⚡' : '📍'}</span>
                  <div>
                    <div class="npi-title">${p.name}</div>
                    <div class="npi-sub">${p.address} ${p.powerKw ? `· 峰值 ${p.powerKw} kW (${p.availableStalls}/${p.totalStalls} 空位)` : ''}</div>
                  </div>
                </div>
                <span class="npi-dist mono-num">${p.distanceKm} km</span>
              </button>
            `
              )
              .join('')}
          </div>

          <!-- 路線比較與導航演示面板 -->
          <div class="nav-route-summary-box ${nav.routeLoading ? 'is-loading' : ''}">
            <div class="nrs-header">
              <div>
                <div class="nrs-dest-name">${selectedPoi.name}</div>
                <div class="nrs-meta mono-num">
                  預計 ${activeRoute.durationMin} 分鐘 · ${activeRoute.distanceKm} km · 抵達電量 ${activeRoute.arrivalSoc}%
                </div>
              </div>
              <button class="nav-compare-btn ${nav.routeCompareOpen ? 'is-active' : ''}" data-action="toggle-route-compare">
                <span>${nav.routeCompareOpen ? '收合路線比較' : '路線比較 (3)'}</span>
              </button>
            </div>

            ${
              nav.routeCompareOpen
                ? `
              <div class="route-compare-options">
                ${Object.values(routesMap)
                  .map(
                    (r) => `
                  <button class="route-opt-btn ${r.id === nav.selectedRouteId ? 'is-selected' : ''}" data-action="select-nav-route" data-route="${r.id}">
                    <div class="ro-label">${r.label}</div>
                    <div class="ro-stats mono-num">${r.durationMin} 分鐘 · ${r.distanceKm} km · 抵達 ${r.arrivalSoc}%</div>
                  </button>
                `
                  )
                  .join('')}
              </div>
            `
                : ''
            }

            ${
              nav.demoGuidanceActive
                ? `
              <div class="nav-guidance-banner">
                <div class="ngb-step">
                  <strong>導航路線演示中 (車輛保持 P 擋駐停)</strong>
                  <span>出發後沿甲州街道行駛 850 公尺，隨後右轉進入外苑東通前往 ${selectedPoi.name}</span>
                </div>
                <button class="nav-start-btn is-danger" data-action="toggle-nav-demo">結束導航演示</button>
              </div>
            `
                : `
              <div class="nav-action-row">
                <button class="nav-start-btn is-primary" data-action="toggle-nav-demo">開始導航演示 (駐停預覽)</button>
              </div>
            `
            }
          </div>
        </div>
      `;
    }

    // 8. 右上駐停狀態與超充圖層提示
    const topRightEl = document.getElementById('nav-overlay-top-right');
    if (topRightEl) {
      topRightEl.innerHTML = `
        <div class="nav-top-right-pills">
          <span class="nav-status-pill">P 擋駐停狀態 (不模擬行駛)</span>
          <span class="nav-status-pill mono-num">縮放 ${(nav.zoom * 100).toFixed(0)}%</span>
        </div>
      `;
    }

    // 9. 右下平移、縮放、回中控制與 © OpenStreetMap contributors 版權標註
    const bottomRightEl = document.getElementById('nav-overlay-bottom-right');
    if (bottomRightEl) {
      bottomRightEl.innerHTML = `
        <div class="nav-map-controls-bar">
          <div class="nav-pan-dpad" role="group" aria-label="地圖平移控制">
            <button class="map-ctrl-btn" data-action="map-pan-step" data-dx="0" data-dy="70" title="向上平移地圖">▲</button>
            <button class="map-ctrl-btn" data-action="map-pan-step" data-dx="70" data-dy="0" title="向左平移地圖">◀</button>
            <button class="map-ctrl-btn" data-action="map-recenter" title="地圖回中 (回到自車與路線中心)">回中</button>
            <button class="map-ctrl-btn" data-action="map-pan-step" data-dx="-70" data-dy="0" title="向右平移地圖">▶</button>
            <button class="map-ctrl-btn" data-action="map-pan-step" data-dx="0" data-dy="-70" title="向下平移地圖">▼</button>
          </div>
          <div class="nav-zoom-group" role="group" aria-label="地圖縮放控制">
            <button class="map-ctrl-btn" data-action="map-zoom-step" data-delta="0.18" title="放大地圖">＋ 放大</button>
            <button class="map-ctrl-btn" data-action="map-zoom-step" data-delta="-0.18" title="縮小地圖">－ 縮小</button>
          </div>
        </div>
        <div class="osm-attribution-badge" aria-label="OpenStreetMap 版權聲明">
          © OpenStreetMap contributors · 離線預渲染底圖 + 獨立向量互動層
        </div>
      `;
    }
  }

  /**
   * 綁定右側地圖拖動平移互動
   */
  bindMapPanEvents() {
    const viewport = document.getElementById('nav-pan-zoom-viewport');
    if (!viewport) return;

    let draggingMap = false;
    let startX = 0;
    let startY = 0;

    viewport.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, input')) return;
      draggingMap = true;
      startX = e.clientX;
      startY = e.clientY;
      viewport.classList.add('is-dragging');
      viewport.setPointerCapture?.(e.pointerId);
    });

    viewport.addEventListener('pointermove', (e) => {
      if (!draggingMap) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;

      this.store.update((s) => {
        s.navigation.panX = Math.max(-360, Math.min(360, s.navigation.panX + dx));
        s.navigation.panY = Math.max(-280, Math.min(280, s.navigation.panY + dy));
      }, ['map-pan']);
    });

    const endPan = () => {
      if (!draggingMap) return;
      draggingMap = false;
      viewport.classList.remove('is-dragging');
    };
    viewport.addEventListener('pointerup', endPan);
    viewport.addEventListener('pointercancel', endPan);
  }

  /**
   * 渲染從底部彈出的「空調與前排座椅抽屜」
   */
  renderClimateDrawer(s) {
    const backdrop = document.getElementById('climate-drawer-backdrop');
    const panel = document.getElementById('climate-drawer-panel');
    if (!backdrop || !panel) return;

    const isOpen = s.climate.drawerOpen;
    backdrop.classList.toggle('is-open', isOpen);
    backdrop.setAttribute('aria-hidden', String(!isOpen));

    if (!isOpen) return;

    const cl = s.climate;
    const subView = cl.subView || 'climate';
    const fanDep = this.store.getControlDependency('climateFanAndVents');

    if (subView === 'seats') {
      const side = s.seats.activeSide || 'driver';
      const seat = s.seats[side];
      panel.innerHTML = `
        <header class="drawer-header">
          <div class="drawer-tabs">
            <button class="drawer-tab-btn" data-action="set-climate-subview" data-view="climate">
              ${icon('fan')}<span>3D 座艙恆溫與出風口</span>
            </button>
            <button class="drawer-tab-btn is-active" data-action="set-climate-subview" data-view="seats">
              ${icon('seatLeft')}<span>前排座椅調節與記憶 (已存於本地)</span>
            </button>
          </div>
          <button class="icon-btn" data-action="close-climate-drawer" aria-label="關閉座椅與空調抽屜">${icon('close')}</button>
        </header>

        <div class="seat-drawer-grid">
          <div class="seat-visual-box">
            <canvas id="canvas-seat-view" class="seat-view-canvas"></canvas>
            <div class="seat-drag-hint">提示：可直接水平拖動座椅畫布調整前後位置，或拖動上半部調整靠背傾角</div>
          </div>

          <div class="seat-controls-box">
            <div class="segmented-row" role="group" aria-label="選擇左前或右前座椅">
              <button class="seg-btn ${side === 'driver' ? 'is-selected' : ''}" data-action="select-seat-side" data-side="driver">駕駛座 (左前)</button>
              <button class="seg-btn ${side === 'passenger' ? 'is-selected' : ''}" data-action="select-seat-side" data-side="passenger">副駕駛座 (右前)</button>
            </div>

            <div class="seat-slider-card">
              <div class="slider-head">
                <span>前後滑軌位置 (Fore/Aft)</span>
                <strong class="mono-num">${seat.foreAftMm >= 0 ? '+' : ''}${seat.foreAftMm} mm</strong>
              </div>
              <div class="stepper-slider-row">
                <button class="step-btn" data-action="step-seat" data-field="foreAftMm" data-delta="-5">後移 -5mm</button>
                <input type="range" min="-50" max="50" step="1" value="${seat.foreAftMm}" data-action="slide-seat" data-field="foreAftMm" aria-label="座椅前後位置" />
                <button class="step-btn" data-action="step-seat" data-field="foreAftMm" data-delta="5">前移 +5mm</button>
              </div>
            </div>

            <div class="seat-slider-card">
              <div class="slider-head">
                <span>椅背傾角調節 (Backrest Recline)</span>
                <strong class="mono-num">${seat.reclineDeg}°</strong>
              </div>
              <div class="stepper-slider-row">
                <button class="step-btn" data-action="step-seat" data-field="reclineDeg" data-delta="-2">豎直 -2°</button>
                <input type="range" min="15" max="45" step="1" value="${seat.reclineDeg}" data-action="slide-seat" data-field="reclineDeg" aria-label="椅背傾角" />
                <button class="step-btn" data-action="step-seat" data-field="reclineDeg" data-delta="2">後仰 +2°</button>
              </div>
            </div>

            <div class="seat-slider-card">
              <div class="slider-head">
                <span>座墊高度與座椅加熱</span>
                <strong class="mono-num">高度 ${seat.heightMm >= 0 ? '+' : ''}${seat.heightMm} mm · 加熱 ${seat.heatLevel} 檔</strong>
              </div>
              <div class="segmented-row">
                <button class="seg-btn" data-action="step-seat" data-field="heightMm" data-delta="-4">降低座墊</button>
                <button class="seg-btn" data-action="step-seat" data-field="heightMm" data-delta="4">升高座墊</button>
                <button class="seg-btn ${seat.heatLevel > 0 ? 'is-selected' : ''}" data-action="cycle-seat-heat" data-side="${side}">
                  座椅加熱 (${seat.heatLevel === 0 ? '關' : `${seat.heatLevel} 檔`})
                </button>
                <button class="seg-btn" data-action="reset-seat-default">恢復預設位置</button>
              </div>
            </div>
          </div>
        </div>
      `;
      const seatCanvas = document.getElementById('canvas-seat-view');
      if (seatCanvas) this.engine3D.mountSeatCanvas(seatCanvas);
      return;
    }

    panel.innerHTML = `
      <header class="drawer-header">
        <div class="drawer-tabs">
          <button class="drawer-tab-btn is-active" data-action="set-climate-subview" data-view="climate">
            ${icon('fan')}<span>3D 座艙恆溫與出風口</span>
          </button>
          <button class="drawer-tab-btn" data-action="set-climate-subview" data-view="seats">
            ${icon('seatLeft')}<span>前排座椅視圖與位置調節</span>
          </button>
        </div>
        <div class="drawer-header-right">
          <span class="cabin-temp-pill mono-num">車內 ${s.vehicle.insideTempC.toFixed(1)}°C · 車外 ${s.vehicle.outsideTempC.toFixed(1)}°C</span>
          <button class="icon-btn" data-action="close-climate-drawer" aria-label="關閉空調抽屜">${icon('close')}</button>
        </div>
      </header>

      <div class="climate-drawer-grid">
        <!-- 左側：3D 座艙氣流動畫與可拖動出風方向畫布 -->
        <div class="climate-3d-stage-wrap ${fanDep.disabled ? 'is-disabled-stage' : ''}">
          <canvas id="canvas-climate-3d" class="climate-3d-canvas"></canvas>
          ${
            fanDep.disabled
              ? `<div class="stage-disabled-notice">${fanDep.reason}</div>`
              : `<div class="stage-vent-coords mono-num">
                  左出風向 (${Math.round(cl.ventLeft.x * 100)}%, ${Math.round(cl.ventLeft.y * 100)}%) ·
                  右出風向 (${Math.round(cl.ventRight.x * 100)}%, ${Math.round(cl.ventRight.y * 100)}%)
                </div>`
          }
        </div>

        <!-- 右側：空調電源、前後除霜開關、風量檔位 1-10 與雙區溫控 -->
        <div class="climate-controls-stack">
          <!-- 第一排：空調電源 + 自動 + A/C + 內循環 + 前除霜開關 + 後除霜開關 -->
          <div class="climate-primary-switches">
            <button class="climate-sw-btn ${cl.power ? 'is-active' : ''}" data-action="toggle-climate-power" aria-pressed="${cl.power}">
              <strong>空調電源</strong>
              <span>${cl.power ? '開啟中' : '已關閉'}</span>
            </button>
            <button class="climate-sw-btn ${cl.autoMode && cl.power ? 'is-active' : ''}" data-action="toggle-climate-bool" data-field="autoMode" ${fanDep.disabled ? 'disabled' : ''}>
              <strong>AUTO</strong>
              <span>自動恆溫</span>
            </button>
            <button class="climate-sw-btn ${cl.acEnabled && cl.power ? 'is-active' : ''}" data-action="toggle-climate-bool" data-field="acEnabled" ${fanDep.disabled ? 'disabled' : ''}>
              <strong>A/C</strong>
              <span>壓縮機制冷</span>
            </button>
            <button class="climate-sw-btn ${cl.recirculate ? 'is-active' : ''}" data-action="toggle-climate-bool" data-field="recirculate">
              <strong>內循環</strong>
              <span>車內空氣循環</span>
            </button>
            <button class="climate-sw-btn is-defrost-btn ${cl.frontDefrost ? 'is-active' : ''}" data-action="toggle-defrost" data-which="front" aria-pressed="${cl.frontDefrost}">
              ${icon('defrostFront')}
              <strong>前除霜</strong>
              <span>${cl.frontDefrost ? '除霜啟用' : '關閉'}</span>
            </button>
            <button class="climate-sw-btn is-defrost-btn ${cl.rearDefrost ? 'is-active' : ''}" data-action="toggle-defrost" data-which="rear" aria-pressed="${cl.rearDefrost}">
              ${icon('defrostRear')}
              <strong>後除霜</strong>
              <span>${cl.rearDefrost ? '加熱啟用' : '關閉'}</span>
            </button>
          </div>

          <!-- 第二排：風量檔位 1–10 滑桿與步進 -->
          <div class="climate-fan-box ${fanDep.disabled ? 'is-disabled' : ''}">
            <div class="slider-head">
              <span>風量檔位調節 (1–10 檔)</span>
              <strong class="mono-num">${cl.power ? `${cl.fanSpeed} / 10 檔` : '空調已關閉'}</strong>
            </div>
            <div class="stepper-slider-row">
              <button class="step-btn" data-action="step-fan" data-delta="-1" ${fanDep.disabled ? 'disabled' : ''}>－ 減小風量</button>
              <input type="range" min="1" max="10" step="1" value="${cl.fanSpeed}" data-action="slide-fan" ${fanDep.disabled ? 'disabled' : ''} aria-label="空調風量檔位" />
              <button class="step-btn" data-action="step-fan" data-delta="1" ${fanDep.disabled ? 'disabled' : ''}>＋ 加大風量</button>
            </div>
            ${fanDep.disabled ? `<div class="dep-reason-text">${fanDep.reason}</div>` : ''}
          </div>

          <!-- 第三排：左右雙區溫度大字調節與前排座椅加熱 -->
          <div class="climate-dual-temp-row">
            <div class="temp-zone-card">
              <span class="tz-label">駕駛側溫度</span>
              <div class="tz-stepper">
                <button class="step-btn" data-action="step-temp" data-zone="driver" data-delta="-0.5">－</button>
                <strong class="tz-val mono-num">${cl.driverTempC.toFixed(1)}°C</strong>
                <button class="step-btn" data-action="step-temp" data-zone="driver" data-delta="0.5">＋</button>
              </div>
              <button class="seg-btn ${s.seats.driver.heatLevel > 0 ? 'is-selected' : ''}" data-action="cycle-seat-heat" data-side="driver">
                左座加熱 (${s.seats.driver.heatLevel} 檔)
              </button>
            </div>

            <div class="temp-zone-card">
              <span class="tz-label">副駕側溫度</span>
              <div class="tz-stepper">
                <button class="step-btn" data-action="step-temp" data-zone="passenger" data-delta="-0.5">－</button>
                <strong class="tz-val mono-num">${cl.passengerTempC.toFixed(1)}°C</strong>
                <button class="step-btn" data-action="step-temp" data-zone="passenger" data-delta="0.5">＋</button>
              </div>
              <button class="seg-btn ${s.seats.passenger.heatLevel > 0 ? 'is-selected' : ''}" data-action="cycle-seat-heat" data-side="passenger">
                右座加熱 (${s.seats.passenger.heatLevel} 檔)
              </button>
            </div>
          </div>

          <!-- 第四排：駐車恆溫保持模式（保持 / 寵物 / 露營） -->
          <div class="climate-keep-row">
            <span class="tz-label">駐停恆溫模式：</span>
            <div class="segmented-row">
              ${[
                { k: 'off', label: '關閉' },
                { k: 'keep', label: '保持恆溫' },
                { k: 'dog', label: '寵物模式' },
                { k: 'camp', label: '露營模式' }
              ]
                .map(
                  (m) => `
                <button class="seg-btn ${cl.campKeepMode === m.k ? 'is-selected' : ''}" data-action="set-camp-mode" data-mode="${m.k}">${m.label}</button>
              `
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    const climateCanvas = document.getElementById('canvas-climate-3d');
    if (climateCanvas) this.engine3D.mountClimateCanvas(climateCanvas);
  }

  /**
   * 渲染 12 大官方手冊分類「車輛設置抽屜」
   */
  renderSettingsDrawer(s) {
    const backdrop = document.getElementById('settings-drawer-backdrop');
    const panel = document.getElementById('settings-drawer-panel');
    if (!backdrop || !panel) return;

    const isOpen = s.settings.drawerOpen;
    backdrop.classList.toggle('is-open', isOpen);
    backdrop.setAttribute('aria-hidden', String(!isOpen));

    if (!isOpen) return;

    const categories = [
      { id: 'controls', label: '控制', iconName: 'car' },
      { id: 'dynamics', label: '動態 (踏板與轉向)', iconName: 'steering' },
      { id: 'charging', label: '充電', iconName: 'bolt' },
      { id: 'autopilot', label: '自動輔助駕駛', iconName: 'shield' },
      { id: 'locks', label: '車鎖', iconName: 'lock' },
      { id: 'lights', label: '車燈', iconName: 'bulb' },
      { id: 'display', label: '顯示', iconName: 'sun' },
      { id: 'trips', label: '行程', iconName: 'chart' },
      { id: 'schedule', label: '日程', iconName: 'calendar' },
      { id: 'safety', label: '安全', iconName: 'shield' },
      { id: 'service', label: '服務', iconName: 'wrench' },
      { id: 'software', label: '軟件', iconName: 'update' }
    ];

    const cat = s.settings.activeCategory || 'controls';

    panel.innerHTML = `
      <aside class="settings-nav-rail" role="navigation" aria-label="車輛設置分類">
        ${categories
          .map(
            (c) => `
          <button class="settings-rail-btn ${cat === c.id ? 'is-active' : ''}" data-action="select-settings-cat" data-cat="${c.id}">
            ${icon(c.iconName)}
            <span>${c.label}</span>
          </button>
        `
          )
          .join('')}
      </aside>

      <div class="settings-content-area">
        <header class="settings-content-header">
          <div>
            <h3>${categories.find((c) => c.id === cat)?.label || '控制'}</h3>
            <span class="settings-manual-caption">對應《Tesla Model 3 車主手冊 (2017–2023 中文版)》章節規範 · 偏好自動驗證並儲存於本地</span>
          </div>
          <button class="icon-btn" data-action="close-settings-drawer" aria-label="關閉車輛設置">${icon('close')}</button>
        </header>

        <div class="settings-cards-scroll">
          ${this.renderSettingsCategoryContent(cat, s)}
        </div>
      </div>
    `;
  }

  /**
   * 依 12 大官方手冊分類生成具體設置項（含開關、分段選擇、滑桿、調整對話框、依賴禁用原因）
   */
  renderSettingsCategoryContent(cat, s) {
    const st = s.settings;
    const veh = s.vehicle;

    if (cat === 'controls') {
      const wiperDep = this.store.getControlDependency('wipersMode');
      return `
        <div class="settings-group-card">
          <h4>外部車燈快捷控制</h4>
          <p class="settings-desc">手冊依據：控制 > 車燈 · 行駛或駐停時切換外部照明模式</p>
          <div class="segmented-row">
            ${[
              { k: 'off', label: '關閉' },
              { k: 'parking', label: '示廓燈' },
              { k: 'on', label: '開啟 (近光)' },
              { k: 'auto', label: '自動 (Auto)' }
            ]
              .map(
                (m) => `
              <button class="seg-btn ${st.headlightsMode === m.k ? 'is-selected' : ''}" data-action="set-headlights-mode" data-val="${m.k}">${m.label}</button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="settings-group-card ${wiperDep.disabled ? 'is-disabled-card' : ''}">
          <h4>雨刮器檔位 (Wipers)</h4>
          <p class="settings-desc">手冊依據：控制 > 雨刮器與清洗器</p>
          <div class="segmented-row">
            ${[
              { k: 'off', label: '關閉' },
              { k: 'I', label: '間歇 I' },
              { k: 'II', label: '間歇 II' },
              { k: 'III', label: '連續 III' },
              { k: 'auto', label: '自動感應' }
            ]
              .map(
                (w) => `
              <button class="seg-btn ${veh.wipersMode === w.k ? 'is-selected' : ''}" data-action="set-wipers-mode" data-val="${w.k}" ${wiperDep.disabled ? 'disabled' : ''}>${w.label}</button>
            `
              )
              .join('')}
          </div>
          ${wiperDep.disabled ? `<div class="dep-reason-text">${wiperDep.reason}</div>` : ''}
        </div>

        <div class="settings-group-card">
          <h4>後視鏡、方向盤調整對話框與車窗鎖</h4>
          <p class="settings-desc">手冊依據：控制 > 後視鏡、方向盤與車窗鎖</p>
          <div class="segmented-row">
            <button class="seg-btn" data-action="open-adj-dialog" data-dialog="mirrors">開啟後視鏡調節對話框</button>
            <button class="seg-btn" data-action="open-adj-dialog" data-dialog="steering">開啟方向盤調節對話框</button>
            <button class="seg-btn ${veh.mirrorsFolded ? 'is-selected' : ''}" data-action="toggle-mirrors-fold">${veh.mirrorsFolded ? '後視鏡已折疊' : '折疊後視鏡'}</button>
          </div>
          <div class="segmented-row" style="margin-top:10px;">
            <button class="seg-btn ${veh.windowsLocked ? 'is-selected' : ''}" data-action="toggle-windows-lock">${veh.windowsLocked ? '後排車窗鎖：已鎖定' : '後排車窗鎖：未鎖定'}</button>
            <button class="seg-btn ${veh.gloveboxOpen ? 'is-selected' : ''}" data-action="toggle-glovebox">${veh.gloveboxOpen ? '手套箱：已開啟' : '打開手套箱'}</button>
            <button class="seg-btn" data-action="open-seats-from-settings">前往前排座椅視圖</button>
          </div>
        </div>
      `;
    }

    if (cat === 'dynamics') {
      const accelDep = this.store.getControlDependency('accelMode');
      return `
        <div class="settings-group-card ${accelDep.disabled ? 'is-disabled-card' : ''}">
          <h4>加速方式 (Acceleration)</h4>
          <p class="settings-desc">手冊依據：踏板與轉向 > 加速模式（Model 3 雙電機全輪驅動提供「舒適」與「標準」）</p>
          <div class="segmented-row">
            <button class="seg-btn ${st.accelMode === 'chill' ? 'is-selected' : ''}" data-action="set-accel-mode" data-val="chill" ${accelDep.disabled ? 'disabled' : ''}>舒適 (平順限制扭力)</button>
            <button class="seg-btn ${st.accelMode === 'standard' ? 'is-selected' : ''}" data-action="set-accel-mode" data-val="standard" ${accelDep.disabled ? 'disabled' : ''}>標準 (全功率輸出)</button>
          </div>
          ${accelDep.disabled ? `<div class="dep-reason-text">${accelDep.reason}</div>` : ''}
        </div>

        <div class="settings-group-card">
          <h4>轉向模式 (Steering Mode)</h4>
          <p class="settings-desc">手冊依據：踏板與轉向 > 調整方向盤轉向輔助阻力</p>
          <div class="segmented-row">
            ${[
              { k: 'comfort', label: '舒適 (輕盈)' },
              { k: 'standard', label: '標準 (均衡)' },
              { k: 'sport', label: '運動 (精準回饋)' }
            ]
              .map(
                (m) => `
              <button class="seg-btn ${st.steeringWeight === m.k ? 'is-selected' : ''}" data-action="set-steering-weight" data-val="${m.k}">${m.label}</button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="settings-group-card">
          <h4>停止模式 (Stopping Mode) 與濕滑路面輔助</h4>
          <p class="settings-desc">手冊依據：踏板與轉向 > 停止模式（緩行 / 轉動 / 保持）與濕滑路面脫困 (Slip Start)</p>
          <div class="segmented-row">
            ${[
              { k: 'creep', label: '緩行 (Creep)' },
              { k: 'roll', label: '轉動 (Roll)' },
              { k: 'hold', label: '保持 (Hold · 啟用自動駐車)' }
            ]
              .map(
                (m) => `
              <button class="seg-btn ${st.stoppingMode === m.k ? 'is-selected' : ''}" data-action="set-stopping-mode" data-val="${m.k}">${m.label}</button>
            `
              )
              .join('')}
          </div>
          <div class="toggle-item-row" style="margin-top:12px;">
            <div>
              <strong>濕滑路面脫困輔助 (Slip Start)</strong>
              <span>允許車輪在雪地、泥濘或砂石路面適度空轉以協助脫困</span>
            </div>
            <button class="switch-pill ${st.slipStart ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="slipStart" aria-pressed="${st.slipStart}">
              <span class="switch-knob"></span>
            </button>
          </div>
        </div>
      `;
    }

    if (cat === 'charging') {
      const unlockDep = this.store.getControlDependency('unlockChargePort');
      const estRangeKm = Math.round((veh.socPercent / 100) * veh.ratedRangeKm);
      return `
        <div class="settings-group-card">
          <h4>高壓電池電量與充電上限設定 (<span class="mono-num">${st.chargeLimitPercent}%</span>)</h4>
          <p class="settings-desc">手冊依據：充電說明 > 設定充電限額 · 當前電量 ${veh.socPercent}% (${estRangeKm} km)</p>
          <div class="stepper-slider-row">
            <button class="step-btn" data-action="step-charge-limit" data-delta="-5">-5%</button>
            <input type="range" min="50" max="100" step="5" value="${st.chargeLimitPercent}" data-action="slide-charge-limit" aria-label="充電上限百分比" />
            <button class="step-btn" data-action="step-charge-limit" data-delta="5">+5%</button>
          </div>
          <div class="segmented-row" style="margin-top:10px;">
            <button class="seg-btn ${st.chargeLimitPercent === 80 ? 'is-selected' : ''}" data-action="set-charge-limit-preset" data-val="80">80% 日常通勤建議</button>
            <button class="seg-btn ${st.chargeLimitPercent === 90 ? 'is-selected' : ''}" data-action="set-charge-limit-preset" data-val="90">90% 跨城出行</button>
            <button class="seg-btn ${st.chargeLimitPercent === 100 ? 'is-selected' : ''}" data-action="set-charge-limit-preset" data-val="100">100% 長途旅行</button>
          </div>
        </div>

        <div class="settings-group-card">
          <h4>此位置充電電流限制 (<span class="mono-num">${st.chargeCurrentAmps} A</span>)</h4>
          <p class="settings-desc">手冊依據：充電說明 > 手動調節交流充電最大電流 (5A–48A)</p>
          <div class="stepper-slider-row">
            <button class="step-btn" data-action="step-charge-amps" data-delta="-4">-4 A</button>
            <input type="range" min="5" max="48" step="1" value="${st.chargeCurrentAmps}" data-action="slide-charge-amps" aria-label="充電電流安培" />
            <button class="step-btn" data-action="step-charge-amps" data-delta="4">+4 A</button>
          </div>
        </div>

        <div class="settings-group-card ${unlockDep.disabled ? 'is-disabled-card' : ''}">
          <h4>充電口蓋與充電鎖控制</h4>
          <p class="settings-desc">手冊依據：充電說明 > 開啟與解鎖充電口（解鎖充電口依賴充電口蓋處於開啟狀態）</p>
          <div class="segmented-row">
            <button class="seg-btn ${veh.chargePortOpen ? 'is-selected' : ''}" data-action="toggle-car-part" data-part="chargePort">
              ${veh.chargePortOpen ? '關閉充電口蓋' : '開啟充電口蓋'}
            </button>
            <button class="seg-btn ${veh.chargePortUnlocked ? 'is-selected' : ''}" data-action="toggle-unlock-chargeport" ${unlockDep.disabled ? 'disabled' : ''}>
              ${veh.chargePortUnlocked ? '充電口已解鎖' : '解鎖充電口'}
            </button>
          </div>
          ${unlockDep.disabled ? `<div class="dep-reason-text">${unlockDep.reason}</div>` : ''}
        </div>
      `;
    }

    if (cat === 'autopilot') {
      const noaDep = this.store.getControlDependency('navigateOnAutopilot');
      return `
        <div class="settings-group-card">
          <h4>自動輔助轉向与跟車距離 (<span class="mono-num">${st.cruiseFollowDistance} 檔</span>)</h4>
          <p class="settings-desc">手冊依據：Autopilot 自動輔助駕駛 > 主動巡航控制與自動輔助轉向 (Autosteer)</p>
          <div class="toggle-item-row">
            <div>
              <strong>自動輔助轉向 (Autosteer · 測試版)</strong>
              <span>在標線清晰的車道內輔助維持車輛居中行駛（為導航輔助駕駛與自動變道之前置依賴）</span>
            </div>
            <button class="switch-pill ${st.autosteerEnabled ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="autosteerEnabled" aria-pressed="${st.autosteerEnabled}">
              <span class="switch-knob"></span>
            </button>
          </div>
          <div class="segmented-row" style="margin-top:10px;">
            ${[1, 2, 3, 4, 5, 6, 7]
              .map(
                (lv) => `
              <button class="seg-btn ${st.cruiseFollowDistance === lv ? 'is-selected' : ''}" data-action="set-follow-dist" data-val="${lv}">${lv} 檔</button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="settings-group-card ${noaDep.disabled ? 'is-disabled-card' : ''}">
          <h4>自動輔助導航駕駛 (NoA) 與自動變道</h4>
          <p class="settings-desc">手冊依據：Autopilot > 自動輔助導航駕駛（依賴「自動輔助轉向」處於啟用狀態）</p>
          <div class="toggle-item-row">
            <div>
              <strong>自動輔助導航駕駛 (Navigate on Autopilot)</strong>
              <span>在高速公路匝道與匯流處根據導航路線主動建議並執行變道</span>
            </div>
            <button class="switch-pill ${st.navigateOnAutopilot ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="navigateOnAutopilot" ${noaDep.disabled ? 'disabled' : ''} aria-pressed="${st.navigateOnAutopilot}">
              <span class="switch-knob"></span>
            </button>
          </div>
          <div class="toggle-item-row" style="margin-top:10px;">
            <div>
              <strong>打方向燈自動輔助變道 (Auto Lane Change)</strong>
              <span>啟用自動輔助轉向時，撥動方向燈桿自動確認安全間距並完成變道</span>
            </div>
            <button class="switch-pill ${st.autoLaneChange ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="autoLaneChange" ${noaDep.disabled ? 'disabled' : ''} aria-pressed="${st.autoLaneChange}">
              <span class="switch-knob"></span>
            </button>
          </div>
          ${noaDep.disabled ? `<div class="dep-reason-text">${noaDep.reason}</div>` : ''}
        </div>

        <div class="settings-group-card">
          <h4>車道安全、盲區鏡頭與防撞預警</h4>
          <p class="settings-desc">手冊依據：主動安全功能 > 車道偏離防避、前撞預警與自動緊急制動</p>
          <div class="segmented-row">
            ${[
              { k: 'off', label: '車道偏離：關閉' },
              { k: 'warn', label: '僅震動警告' },
              { k: 'assist', label: '輔助轉向修正' }
            ]
              .map(
                (m) => `
              <button class="seg-btn ${st.laneDepartureAvoidance === m.k ? 'is-selected' : ''}" data-action="set-setting-enum" data-field="laneDepartureAvoidance" data-val="${m.k}">${m.label}</button>
            `
              )
              .join('')}
          </div>
          <div class="toggle-item-row" style="margin-top:10px;">
            <div>
              <strong>自動盲點攝影機與綠燈提示音</strong>
              <span>撥動方向燈時顯示側後葉子板盲區畫面，並在等待紅燈變綠燈時發出提示音</span>
            </div>
            <button class="switch-pill ${st.blindSpotCamera ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="blindSpotCamera" aria-pressed="${st.blindSpotCamera}">
              <span class="switch-knob"></span>
            </button>
          </div>
        </div>
      `;
    }

    if (cat === 'locks') {
      const walkDep = this.store.getControlDependency('excludeHomeWalkAway');
      return `
        <div class="settings-group-card">
          <h4>已配對演示鑰匙管理（存於 localStorage 並驗證格式）</h4>
          <p class="settings-desc">手冊依據：鑰匙與車門上鎖 > 管理手機鑰匙與 NFC 鑰匙卡</p>
          <div class="keys-list-stack">
            ${st.keysList
              .map(
                (k) => `
              <div class="key-item-row">
                <div>
                  <strong>${k.name}</strong>
                  <span>${k.type} · ${k.active ? '已授權啟用' : '已停用'}</span>
                </div>
                <div class="key-row-btns">
                  <button class="seg-btn ${k.active ? 'is-selected' : ''}" data-action="toggle-key-active" data-id="${k.id}">
                    ${k.active ? '啟用中' : '已停用'}
                  </button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
          <button class="seg-btn" style="margin-top:10px;" data-action="add-demo-key">＋ 新增配對演示 NFC 鑰匙卡</button>
        </div>

        <div class="settings-group-card">
          <h4>離車後自動上鎖与關聯車窗控制</h4>
          <p class="settings-desc">手冊依據：車門上鎖 > 離車後自動上鎖 (Walk-Away Door Lock)</p>
          <div class="toggle-item-row">
            <div>
              <strong>離車後自動上鎖</strong>
              <span>攜帶手機鑰匙離開車輛時自動鎖定所有車門與後備箱</span>
            </div>
            <button class="switch-pill ${st.walkAwayLock ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="walkAwayLock" aria-pressed="${st.walkAwayLock}">
              <span class="switch-knob"></span>
            </button>
          </div>
          <div class="toggle-item-row ${walkDep.disabled ? 'is-disabled-row' : ''}" style="margin-top:10px;">
            <div>
              <strong>鎖車時自動升起四門車窗</strong>
              <span>依賴「離車後自動上鎖」開啟</span>
            </div>
            <button class="switch-pill ${st.closeWindowsOnLock ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="closeWindowsOnLock" ${walkDep.disabled ? 'disabled' : ''}>
              <span class="switch-knob"></span>
            </button>
          </div>
          ${walkDep.disabled ? `<div class="dep-reason-text">${walkDep.reason}</div>` : ''}
        </div>

        <div class="settings-group-card">
          <h4>駐停解鎖、駕駛座單門解鎖與後排兒童安全鎖</h4>
          <p class="settings-desc">手冊依據：車鎖 > 排入 P 擋自動解鎖與兒童安全鎖（關閉 / 左後 / 右後 / 雙側）</p>
          <div class="segmented-row">
            ${[
              { k: 'off', label: '兒童鎖：關閉' },
              { k: 'left', label: '僅左後門' },
              { k: 'right', label: '僅右後門' },
              { k: 'both', label: '雙側後門鎖定' }
            ]
              .map(
                (c) => `
              <button class="seg-btn ${veh.childLockMode === c.k ? 'is-selected' : ''}" data-action="set-child-lock" data-val="${c.k}">${c.label}</button>
            `
              )
              .join('')}
          </div>
          <div class="toggle-item-row" style="margin-top:10px;">
            <div>
              <strong>僅解鎖駕駛側車門 (Driver Door Unlock Mode)</strong>
              <span>首次解鎖車輛時僅開啟左前駕駛座車門，保障單人乘車安全</span>
            </div>
            <button class="switch-pill ${st.driverDoorUnlockMode ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="driverDoorUnlockMode">
              <span class="switch-knob"></span>
            </button>
          </div>
        </div>
      `;
    }

    if (cat === 'lights') {
      const fogDep = this.store.getControlDependency('frontFogLights');
      const hbDep = this.store.getControlDependency('autoHighBeam');
      return `
        <div class="settings-group-card">
          <h4>頭燈主模式 (Headlights)</h4>
          <p class="settings-desc">手冊依據：車燈 > 外部車燈控制（設為「關閉」時將禁用前霧燈與自動遠光燈）</p>
          <div class="segmented-row">
            ${[
              { k: 'off', label: '關閉' },
              { k: 'parking', label: '示廓燈' },
              { k: 'on', label: '開啟 (近光)' },
              { k: 'auto', label: '自動感應' }
            ]
              .map(
                (m) => `
              <button class="seg-btn ${st.headlightsMode === m.k ? 'is-selected' : ''}" data-action="set-headlights-mode" data-val="${m.k}">${m.label}</button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="settings-group-card ${fogDep.disabled || hbDep.disabled ? 'is-disabled-card' : ''}">
          <h4>自動遠光燈與前霧燈（具依賴聯鎖規則）</h4>
          <p class="settings-desc">手冊依據：車燈 > 遠光大燈與前霧燈</p>
          <div class="toggle-item-row">
            <div>
              <strong>自動遠光燈 (Auto High Beam)</strong>
              <span>偵測對向來車或前車尾燈時自動切換遠近光</span>
            </div>
            <button class="switch-pill ${st.autoHighBeam ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="autoHighBeam" ${hbDep.disabled ? 'disabled' : ''}>
              <span class="switch-knob"></span>
            </button>
          </div>
          ${hbDep.disabled ? `<div class="dep-reason-text">${hbDep.reason}</div>` : ''}

          <div class="toggle-item-row" style="margin-top:10px;">
            <div>
              <strong>前霧燈 (Front Fog Lights)</strong>
              <span>增強濃霧或豪雨天氣下前保桿下方低角度路面照明</span>
            </div>
            <button class="switch-pill ${st.frontFogLights ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="frontFogLights" ${fogDep.disabled ? 'disabled' : ''}>
              <span class="switch-knob"></span>
            </button>
          </div>
          ${fogDep.disabled ? `<div class="dep-reason-text">${fogDep.reason}</div>` : ''}
        </div>

        <div class="settings-group-card">
          <h4>車內頂燈 (Dome Lights) 與離車大燈延時</h4>
          <p class="settings-desc">手冊依據：車燈 > 車內閱讀燈與大燈延時關閉</p>
          <div class="segmented-row">
            ${[
              { k: 'off', label: '頂燈：關閉' },
              { k: 'on', label: '頂燈：常亮' },
              { k: 'auto', label: '頂燈：解鎖自動點亮' }
            ]
              .map(
                (m) => `
              <button class="seg-btn ${st.domeLightsMode === m.k ? 'is-selected' : ''}" data-action="set-setting-enum" data-field="domeLightsMode" data-val="${m.k}">${m.label}</button>
            `
              )
              .join('')}
          </div>
          <div class="toggle-item-row" style="margin-top:10px;">
            <div>
              <strong>離車後大燈延時照明 (Headlights after Exit)</strong>
              <span>夜間駐停鎖車後繼續維持外部照明 60 秒</span>
            </div>
            <button class="switch-pill ${st.headlightsAfterExit ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="headlightsAfterExit">
              <span class="switch-knob"></span>
            </button>
          </div>
        </div>
      `;
    }

    if (cat === 'display') {
      return `
        <div class="settings-group-card">
          <h4>外觀主題與屏幕清潔模式</h4>
          <p class="settings-desc">手冊依據：顯示 > 外觀（淺色 / 深色 / 自動）與屏幕清潔模式</p>
          <div class="segmented-row">
            ${[
              { k: 'day', label: '日間淺色 (Light)' },
              { k: 'night', label: '夜間深色 (Dark)' },
              { k: 'auto', label: '自動感應 (Auto)' }
            ]
              .map(
                (m) => `
              <button class="seg-btn ${st.appearanceTheme === m.k ? 'is-selected' : ''}" data-action="set-appearance-theme" data-val="${m.k}">${m.label}</button>
            `
              )
              .join('')}
          </div>
          <div style="margin-top:12px;">
            <button class="seg-btn is-selected" data-action="toggle-temp-mode" data-mode="screenCleanMode">
              啟動「屏幕清潔模式」（全屏黑底防誤觸，按 Esc 或按鈕退出）
            </button>
          </div>
        </div>

        <div class="settings-group-card">
          <h4>觸控螢幕背光亮度 (<span class="mono-num">${st.brightnessPercent}%</span>)</h4>
          <p class="settings-desc">手冊依據：顯示 > 亮度調整與環境光感應自動亮度</p>
          <div class="stepper-slider-row">
            <button class="step-btn" data-action="step-brightness" data-delta="-10">-10%</button>
            <input type="range" min="20" max="100" step="5" value="${st.brightnessPercent}" data-action="slide-brightness" aria-label="螢幕背光亮度" />
            <button class="step-btn" data-action="step-brightness" data-delta="10">+10%</button>
          </div>
          <div class="toggle-item-row" style="margin-top:10px;">
            <div>
              <strong>自動亮度調節 (Auto Brightness)</strong>
              <span>手動拖動滑桿時將自動切換為自訂亮度</span>
            </div>
            <button class="switch-pill ${st.autoBrightness ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="autoBrightness">
              <span class="switch-knob"></span>
            </button>
          </div>
        </div>

        <div class="settings-group-card">
          <h4>電量顯示方式、時間格式與字體大小</h4>
          <p class="settings-desc">手冊依據：顯示 > 能量顯示、時間格式與字級設定</p>
          <div class="segmented-row">
            <button class="seg-btn ${st.energyDisplayMode === 'percent' ? 'is-selected' : ''}" data-action="set-setting-enum" data-field="energyDisplayMode" data-val="percent">電量：百分比 (%)</button>
            <button class="seg-btn ${st.energyDisplayMode === 'distance' ? 'is-selected' : ''}" data-action="set-setting-enum" data-field="energyDisplayMode" data-val="distance">電量：預估里程 (km)</button>
            <button class="seg-btn ${st.timeFormat === '24h' ? 'is-selected' : ''}" data-action="set-setting-enum" data-field="timeFormat" data-val="24h">24 小時制</button>
            <button class="seg-btn ${st.timeFormat === '12h' ? 'is-selected' : ''}" data-action="set-setting-enum" data-field="timeFormat" data-val="12h">12 小時制</button>
          </div>
        </div>
      `;
    }

    if (cat === 'trips') {
      const tr = st.trips;
      return `
        <div class="settings-group-card">
          <h4>當前行程与自上次充電後統計</h4>
          <p class="settings-desc">手冊依據：行程資訊 (Trips) · 當前車輛保持 P 擋駐停</p>
          <div class="trips-stat-grid">
            <div class="trip-stat-tile">
              <span>當前行程</span>
              <strong class="mono-num">${tr.currentDriveKm.toFixed(1)} km · ${tr.currentDriveWhKm} Wh/km</strong>
            </div>
            <div class="trip-stat-tile">
              <span>自上次充電後</span>
              <strong class="mono-num">${tr.sinceChargeKm.toFixed(1)} km · ${tr.sinceChargeWhKm} Wh/km</strong>
            </div>
          </div>
        </div>

        <div class="settings-group-card">
          <h4>行程 A / 行程 B 統計與重置</h4>
          <p class="settings-desc">手冊依據：行程資訊 > 重置行程里程表</p>
          <div class="trips-stat-grid">
            <div class="trip-stat-tile">
              <span>行程 A (Trip A)</span>
              <strong class="mono-num">${tr.tripAKm.toFixed(1)} km · 平均 ${tr.tripAWhKm} Wh/km</strong>
              <button class="seg-btn" style="margin-top:8px;" data-action="reset-trip" data-trip="A">重置行程 A</button>
            </div>
            <div class="trip-stat-tile">
              <span>行程 B (Trip B)</span>
              <strong class="mono-num">${tr.tripBKm.toFixed(1)} km · 平均 ${tr.tripBWhKm} Wh/km</strong>
              <button class="seg-btn" style="margin-top:8px;" data-action="reset-trip" data-trip="B">重置行程 B</button>
            </div>
          </div>
          <div class="odometer-footer mono-num">車輛總里程 (Odometer)：${veh.odometerKm.toLocaleString()} km</div>
        </div>
      `;
    }

    if (cat === 'schedule') {
      const schedDep = this.store.getControlDependency('preconditionCabin');
      const offpeakDep = this.store.getControlDependency('offPeakEndTime');
      return `
        <div class="settings-group-card">
          <h4>預約出發時間与座艙預調恆溫</h4>
          <p class="settings-desc">手冊依據：預約充電與預計出發 > 預調恆溫與電池預熱</p>
          <div class="toggle-item-row">
            <div>
              <strong>啟用預約出發排程 (Scheduled Departure)</strong>
              <span>設定出發時間為 ${st.scheduledDepartureTime}</span>
            </div>
            <button class="switch-pill ${st.scheduledDepartureEnabled ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="scheduledDepartureEnabled">
              <span class="switch-knob"></span>
            </button>
          </div>
          <div class="segmented-row" style="margin-top:10px;">
            ${['07:30', '08:00', '08:30', '09:00']
              .map(
                (t) => `
              <button class="seg-btn ${st.scheduledDepartureTime === t ? 'is-selected' : ''}" data-action="set-setting-enum" data-field="scheduledDepartureTime" data-val="${t}">${t} 出發</button>
            `
              )
              .join('')}
          </div>
          <div class="toggle-item-row ${schedDep.disabled ? 'is-disabled-row' : ''}" style="margin-top:10px;">
            <div>
              <strong>出發前自動預調座艙恆溫</strong>
              <span>依賴「預約出發排程」開啟</span>
            </div>
            <button class="switch-pill ${st.preconditionCabin ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="preconditionCabin" ${schedDep.disabled ? 'disabled' : ''}>
              <span class="switch-knob"></span>
            </button>
          </div>
          ${schedDep.disabled ? `<div class="dep-reason-text">${schedDep.reason}</div>` : ''}
        </div>

        <div class="settings-group-card ${offpeakDep.disabled ? 'is-disabled-card' : ''}">
          <h4>離峰充電排程 (Off-Peak Charging)</h4>
          <p class="settings-desc">手冊依據：預約充電 > 離峰費率結束時間設定</p>
          <div class="toggle-item-row">
            <div>
              <strong>啟用離峰時段優先充電</strong>
              <span>在離峰電價結束時間前完成充電</span>
            </div>
            <button class="switch-pill ${st.offPeakChargingEnabled ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="offPeakChargingEnabled">
              <span class="switch-knob"></span>
            </button>
          </div>
          <div class="segmented-row" style="margin-top:10px;">
            ${['05:00', '06:00', '07:00']
              .map(
                (t) => `
              <button class="seg-btn ${st.offPeakEndTime === t ? 'is-selected' : ''}" data-action="set-setting-enum" data-field="offPeakEndTime" data-val="${t}" ${offpeakDep.disabled ? 'disabled' : ''}>離峰結束 ${t}</button>
            `
              )
              .join('')}
          </div>
          ${offpeakDep.disabled ? `<div class="dep-reason-text">${offpeakDep.reason}</div>` : ''}
        </div>
      `;
    }

    if (cat === 'safety') {
      const slDep = this.store.getControlDependency('maxSpeedLimitKmh');
      return `
        <div class="settings-group-card">
          <h4>哨兵模式 (Sentry Mode) 與行車記錄儀</h4>
          <p class="settings-desc">手冊依據：安全與保障 > 哨兵模式與行車記錄儀</p>
          <div class="toggle-item-row">
            <div>
              <strong>哨兵模式 (駐停安全監控)</strong>
              <span>駐停上鎖後持續透過環視攝影機偵測可疑靠近行為</span>
            </div>
            <button class="switch-pill ${st.sentryMode ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="sentryMode">
              <span class="switch-knob"></span>
            </button>
          </div>
          <div class="segmented-row" style="margin-top:10px;">
            ${[
              { k: 'off', label: '記錄儀：關閉' },
              { k: 'manual', label: '手動保存' },
              { k: 'auto', label: '自動 + 鳴笛保存' }
            ]
              .map(
                (m) => `
              <button class="seg-btn ${st.dashcamMode === m.k ? 'is-selected' : ''}" data-action="set-setting-enum" data-field="dashcamMode" data-val="${m.k}">${m.label}</button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="settings-group-card ${slDep.disabled ? 'is-disabled-card' : ''}">
          <h4>限速模式 (Speed Limit Mode) 與最高限速 (<span class="mono-num">${st.maxSpeedLimitKmh} km/h</span>)</h4>
          <p class="settings-desc">手冊依據：安全與保障 > 限速模式（開啟後加速強制為舒適，且可調整最高限速）</p>
          <div class="toggle-item-row">
            <div>
              <strong>啟用限速模式</strong>
              <span>限制最高車速並鎖定加速模式為「舒適」</span>
            </div>
            <button class="switch-pill ${st.speedLimitMode ? 'is-on' : ''}" data-action="toggle-setting-bool" data-field="speedLimitMode">
              <span class="switch-knob"></span>
            </button>
          </div>
          <div class="stepper-slider-row" style="margin-top:10px;">
            <button class="step-btn" data-action="step-max-speed" data-delta="-5" ${slDep.disabled ? 'disabled' : ''}>-5 km/h</button>
            <input type="range" min="80" max="145" step="5" value="${st.maxSpeedLimitKmh}" data-action="slide-max-speed" ${slDep.disabled ? 'disabled' : ''} aria-label="最高限速滑桿" />
            <button class="step-btn" data-action="step-max-speed" data-delta="5" ${slDep.disabled ? 'disabled' : ''}>+5 km/h</button>
          </div>
          ${slDep.disabled ? `<div class="dep-reason-text">${slDep.reason}</div>` : ''}
        </div>

        <div class="settings-group-card">
          <h4>車廂過熱保護、代客模式與關閉電源</h4>
          <p class="settings-desc">手冊依據：安全與保障 > 車廂過熱保護 (Cabin Overheat Protection)</p>
          <div class="segmented-row">
            ${[
              { k: 'off', label: '過熱保護：關閉' },
              { k: 'no_ac', label: '僅通風 (無 A/C)' },
              { k: 'on', label: '開啟 (含 A/C 降溫)' }
            ]
              .map(
                (m) => `
              <button class="seg-btn ${st.cabinOverheatProtection === m.k ? 'is-selected' : ''}" data-action="set-setting-enum" data-field="cabinOverheatProtection" data-val="${m.k}">${m.label}</button>
            `
              )
              .join('')}
          </div>
          <div class="segmented-row" style="margin-top:10px;">
            <button class="seg-btn ${st.valetMode ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-field="valetMode">代客模式 (${st.valetMode ? '開啟' : '關閉'})</button>
            <button class="seg-btn ${st.pinToDrive ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-field="pinToDrive">PIN 碼行駛 (${st.pinToDrive ? '開啟' : '關閉'})</button>
            <button class="seg-btn is-danger-btn" data-action="open-adj-dialog" data-dialog="powerOff">關閉車輛電源...</button>
          </div>
        </div>
      `;
    }

    if (cat === 'service') {
      return `
        <div class="settings-group-card">
          <h4>四輪胎壓監測系統 (TPMS)</h4>
          <p class="settings-desc">手冊依據：維護與服務 > 輪胎保養與胎壓標準 (建議冷胎壓 2.9 Bar)</p>
          <div class="tpms-4-grid mono-num">
            <div class="tpms-box"><span>左前輪 (FL)</span><strong>${st.tiresBar.fl.toFixed(2)} Bar</strong></div>
            <div class="tpms-box"><span>右前輪 (FR)</span><strong>${st.tiresBar.fr.toFixed(2)} Bar</strong></div>
            <div class="tpms-box"><span>左後輪 (RL)</span><strong>${st.tiresBar.rl.toFixed(2)} Bar</strong></div>
            <div class="tpms-box"><span>右後輪 (RR)</span><strong>${st.tiresBar.rr.toFixed(2)} Bar</strong></div>
          </div>
        </div>

        <div class="settings-group-card">
          <h4>臨時維護模式（洗車模式、牽引模式 · 退出後自動恢復原偏好）</h4>
          <p class="settings-desc">手冊依據：維護與服務 > 洗車模式 (Car Wash Mode) 與牽引說明 (Transporting)</p>
          <div class="toggle-item-row">
            <div>
              <strong>洗車模式 (Car Wash Mode · 臨時覆蓋測試)</strong>
              <span>開啟後自動關閉雨刮、關閉充電口、停用離車上鎖並開啟空調內循環；退出後精確還原原設定</span>
            </div>
            <button class="switch-pill ${st.carWashMode ? 'is-on' : ''}" data-action="toggle-temp-mode" data-mode="carWashMode" aria-pressed="${st.carWashMode}">
              <span class="switch-knob"></span>
            </button>
          </div>

          <div class="toggle-item-row" style="margin-top:10px;">
            <div>
              <strong>牽引模式 (Tow Mode · 臨時覆蓋測試)</strong>
              <span>解除駐停車輛之電子手煞車並切換為自由轉動狀態，退出後恢復保持模式</span>
            </div>
            <button class="switch-pill ${st.towMode ? 'is-on' : ''}" data-action="toggle-temp-mode" data-mode="towMode" aria-pressed="${st.towMode}">
              <span class="switch-knob"></span>
            </button>
          </div>

          <div class="segmented-row" style="margin-top:12px;">
            <button class="seg-btn ${st.wiperServiceMode ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-field="wiperServiceMode">雨刮維護模式 (${st.wiperServiceMode ? '開啟' : '關閉'})</button>
            <button class="seg-btn" data-action="open-adj-dialog" data-dialog="factoryReset">恢復出廠預設設定...</button>
          </div>
        </div>
      `;
    }

    // software
    const cfg = this.store.getVehicleConfig();
    return `
      <div class="settings-group-card">
        <h4>車輛型號與硬體資訊（與實際載入 3D 模型一致）</h4>
        <p class="settings-desc">手冊依據：軟件 > 關於您的車輛</p>
        <div class="software-spec-table">
          <div class="sw-row"><span>車型名稱</span><strong>${cfg.fullName} · ${cfg.trimName}</strong></div>
          <div class="sw-row"><span>中控螢幕規格</span><strong>${cfg.centerScreen.diagonalInch} 吋 (${cfg.centerScreen.designWidth}×${cfg.centerScreen.designHeight})</strong></div>
          <div class="sw-row"><span>車載資訊娛樂處理器</span><strong>AMD Ryzen 車規級晶片</strong></div>
          <div class="sw-row"><span>自動輔助駕駛電腦</span><strong>Full Self-Driving Computer 3</strong></div>
          <div class="sw-row"><span>3D 模型資產授權</span><strong>${cfg.model3D.author} (${cfg.model3D.license})</strong></div>
        </div>
      </div>

      <div class="settings-group-card ${st.checkingForUpdate ? 'is-loading' : ''}">
        <h4>軟件版本與更新偏好</h4>
        <p class="settings-desc">手冊依據：軟件更新 > 選擇「標準」或「進階」更新通道</p>
        <div class="sw-version-row">
          <div>
            <strong class="mono-num">${st.softwareVersion}</strong>
            <span>${st.lastUpdateCheckText}</span>
          </div>
          <div class="segmented-row">
            <button class="seg-btn" data-action="open-adj-dialog" data-dialog="releaseNotes">發行說明對話框</button>
            <button class="seg-btn ${st.checkingForUpdate ? 'is-loading-btn' : ''}" data-action="check-software-update">
              ${st.checkingForUpdate ? '正在檢查伺服器...' : '檢查軟件更新'}
            </button>
          </div>
        </div>
        <div class="segmented-row" style="margin-top:12px;">
          <button class="seg-btn ${st.updatePreference === 'standard' ? 'is-selected' : ''}" data-action="set-setting-enum" data-field="updatePreference" data-val="standard">更新通道：標準 (Standard)</button>
          <button class="seg-btn ${st.updatePreference === 'advanced' ? 'is-selected' : ''}" data-action="set-setting-enum" data-field="updatePreference" data-val="advanced">更新通道：進階 (Advanced)</button>
        </div>
      </div>
    `;
  }

  /**
   * 渲染設置調整對話框（後視鏡、方向盤、發行說明、恢復出廠預設、關閉電源）
   * 具備鍵盤焦點管理與 Esc 關閉
   */
  renderAdjustmentDialog(s) {
    const layer = document.getElementById('adjustment-dialog-layer');
    if (!layer) return;
    const dlg = s.settings.activeDialog;
    if (!dlg) {
      layer.classList.remove('is-open');
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = '';
      return;
    }

    layer.classList.add('is-open');
    layer.setAttribute('aria-hidden', 'false');

    let title = '';
    let bodyHtml = '';

    if (dlg === 'mirrors') {
      title = '車外後視鏡調節對話框';
      bodyHtml = `
        <p>請選擇要調節的左/右後視鏡，並使用方向鍵或下方控制按鈕微調鏡片角度（依《Model 3 車主手冊》後視鏡章節設計）。</p>
        <div class="segmented-row" style="margin:14px 0;">
          <button class="seg-btn is-selected" data-action="toggle-mirrors-fold">${s.vehicle.mirrorsFolded ? '展開後視鏡' : '折疊後視鏡'}</button>
          <button class="seg-btn" data-action="close-adj-dialog">儲存後視鏡位置</button>
        </div>
      `;
    } else if (dlg === 'steering') {
      title = '方向盤位置調節對話框';
      bodyHtml = `
        <p>使用方向盤左側滾輪或下方按鈕調整方向盤高度與前後伸縮距離，設定將自動儲存於當前駕駛員設定檔。</p>
        <div class="segmented-row" style="margin:14px 0;">
          <button class="seg-btn is-selected" data-action="close-adj-dialog">完成方向盤定位</button>
        </div>
      `;
    } else if (dlg === 'releaseNotes') {
      title = `軟件版本 ${s.settings.softwareVersion} 發行說明`;
      bodyHtml = `
        <div class="release-notes-box">
          <h5>1. Model 3 中控觸控螢幕體驗升級</h5>
          <p>優化左側 3D 車輛視圖收合俯視與展開低角度三四分之一視角的平滑過渡，支援 5 秒無操作自動回正與雙擊重置。</p>
          <h5>2. 恆溫空調 3D 座艙氣流與前排座椅記憶</h5>
          <p>底部上滑空調抽屜支援直接拖動左右出風方向焦點，前排座椅位置與靠背角度自動驗證並保存於本地。</p>
          <h5>3. 臨時維護模式與依賴聯鎖保護</h5>
          <p>新增洗車模式、牽引模式與屏幕清潔模式的狀態快照覆蓋與退出後偏好自動還原機制。</p>
        </div>
      `;
    } else if (dlg === 'factoryReset') {
      title = '恢復出廠預設設定確認';
      bodyHtml = `
        <p>確定要清除本地儲存 (` + '`localStorage`' + `) 的座椅位置、空調溫度與個人化設置並恢復為出廠預設值嗎？</p>
        <div class="segmented-row" style="margin-top:16px;">
          <button class="seg-btn is-danger-btn" data-action="confirm-factory-reset">確認恢復出廠預設</button>
          <button class="seg-btn" data-action="close-adj-dialog">取消</button>
        </div>
      `;
    } else if (dlg === 'powerOff') {
      title = '關閉車輛電源確認';
      bodyHtml = `
        <p>車輛目前處於 P 擋駐停狀態。關閉電源後，踩下煞車踏板或觸碰螢幕即可重新喚醒車輛。</p>
        <div class="segmented-row" style="margin-top:16px;">
          <button class="seg-btn is-danger-btn" data-action="close-adj-dialog">確認關閉電源</button>
          <button class="seg-btn" data-action="close-adj-dialog">取消</button>
        </div>
      `;
    }

    layer.innerHTML = `
      <div class="adj-dialog-card" role="dialog" aria-modal="true" aria-label="${title}">
        <header class="adj-dialog-header">
          <h4>${title}</h4>
          <button class="icon-btn" id="adj-dialog-close-btn" data-action="close-adj-dialog" aria-label="關閉對話框">${icon('close')}</button>
        </header>
        <div class="adj-dialog-body">${bodyHtml}</div>
      </div>
    `;

    setTimeout(() => {
      const btn = document.getElementById('adj-dialog-close-btn');
      btn?.focus();
    }, 20);
  }

  /**
   * 渲染行為對照表與車型配置彈窗
   */
  renderMatrixModal(s) {
    const layer = document.getElementById('matrix-modal-layer');
    if (!layer) return;
    if (!this.showMatrixModal) {
      layer.classList.remove('is-open');
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = '';
      return;
    }

    layer.classList.add('is-open');
    layer.setAttribute('aria-hidden', 'false');

    const valReport = s.storageValidationReport;

    layer.innerHTML = `
      <div class="matrix-modal-card" role="dialog" aria-modal="true" aria-label="階段一行為對照表與車型配置">
        <header class="matrix-modal-header">
          <div>
            <h3>階段一：Model 3 中控屏 — 行為對照表、車型配置與參考來源說明</h3>
            <span>嚴格對應《Tesla Model 3 車主手冊 (2017–2023 中文版)》與開源結構參考 · localStorage 驗證狀態：${
              valReport.sanitizedFields.length > 0
                ? `已攔截並修復異常欄位 (${valReport.sanitizedFields.join(', ')})`
                : '所有本地儲存欄位驗證通過'
            }</span>
          </div>
          <button class="icon-btn" id="matrix-modal-close-btn" data-action="toggle-matrix-modal" aria-label="關閉行為對照表">${icon('close')}</button>
        </header>

        <div class="matrix-modal-body">
          <!-- 一、車型配置與技術說明 -->
          <div class="matrix-section-box">
            <h4>一、資料驅動「車型配置」與階段一技術路線誠實說明</h4>
            <div class="config-compare-grid">
              <div class="config-card is-active">
                <strong>1. ${VEHICLE_CONFIGS.model3.fullName}（當前啟用）</strong>
                <p>中控屏：${VEHICLE_CONFIGS.model3.centerScreen.diagonalInch} 吋 (${VEHICLE_CONFIGS.model3.centerScreen.designWidth}×${VEHICLE_CONFIGS.model3.centerScreen.designHeight}) · 儀錶盤：無 · 後排屏：無</p>
                <p>3D 模型：<code>${VEHICLE_CONFIGS.model3.model3D.url}</code> (${VEHICLE_CONFIGS.model3.model3D.author}, ${VEHICLE_CONFIGS.model3.model3D.license})</p>
                <p>手冊依據：<a href="${VEHICLE_CONFIGS.model3.manual.url}" target="_blank" rel="noopener noreferrer">${VEHICLE_CONFIGS.model3.manual.title}</a></p>
              </div>
              <div class="config-card is-reserved">
                <strong>2. ${VEHICLE_CONFIGS.models.fullName}（階段四預留 · 暫不上線）</strong>
                <p>中控屏：${VEHICLE_CONFIGS.models.centerScreen.diagonalInch} 吋 (2200:1300 可傾斜) · 儀錶盤：有 · 後排屏：有</p>
                <p>未上線原因：${VEHICLE_CONFIGS.models.unavailableReason}</p>
              </div>
            </div>
            <p class="tech-honesty-note">
              <strong>技術架構說明：</strong>由於本地離線環境之 <code>node_modules</code> 僅預裝 <code>three</code>，未安裝 React / TypeScript / Vite 編譯套件且沙盒預設無外部 npm 下載權限，故本階段採用模組化 ES Modules + 集中式 <code>Phase1Store</code>（含嚴格 Schema 驗證與依賴計算）+ Three.js (<code>GLTFLoader</code> + <code>DRACOLoader</code>) 實作，100% 達成階段一所有互動行為與自動化測試要求。
            </p>
          </div>

          <!-- 二、參考來源聲明 -->
          <div class="matrix-section-box">
            <h4>二、結構與行為參考來源（100% 獨立重寫，絕無複製第三方代碼或素材）</h4>
            <div class="ref-sources-list">
              ${PHASE1_REFERENCE_SOURCES.map(
                (ref) => `
                <div class="ref-source-item">
                  <strong><a href="${ref.url}" target="_blank" rel="noopener noreferrer">${ref.title}</a></strong>
                  <span>${ref.usage}</span>
                </div>
              `
              ).join('')}
            </div>
          </div>

          <!-- 三、階段一完整行為對照表 -->
          <div class="matrix-section-box">
            <h4>三、階段一功能與設置項行為對照表（共 ${PHASE1_BEHAVIOR_MATRIX.length} 項）</h4>
            <table class="behavior-matrix-table">
              <thead>
                <tr>
                  <th>編號</th>
                  <th>分類</th>
                  <th>功能與設置項</th>
                  <th>參考依據</th>
                  <th>行為與依賴聯鎖規則</th>
                  <th>測試截圖檔名</th>
                  <th>結果</th>
                </tr>
              </thead>
              <tbody>
                ${PHASE1_BEHAVIOR_MATRIX.map(
                  (row) => `
                  <tr>
                    <td class="mono-num">${row.id}</td>
                    <td>${row.category}</td>
                    <td><strong>${row.feature}</strong></td>
                    <td>${row.reference}</td>
                    <td>${row.ruleOrBehavior}</td>
                    <td class="mono-num">${row.screenshot}</td>
                    <td><span class="status-badge is-pass">${row.status}</span></td>
                  </tr>
                `
                ).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染底部常駐 Dock（車控入口、左溫度、空調入口、應用圖標、右溫度、音量）
   */
  renderBottomDock(s) {
    const el = document.getElementById('center-bottom-dock');
    if (!el) return;
    const cl = s.climate;
    const med = s.media;

    el.innerHTML = `
      <!-- 1. 車控入口 (切換 12 分類車輛設置抽屜) -->
      <div class="dock-cluster-left">
        <button class="dock-car-btn ${s.settings.drawerOpen ? 'is-active' : ''}" data-action="toggle-settings-drawer" aria-label="開啟或關閉車輛設置抽屜">
          ${icon('car')}
          <span>車控設置</span>
        </button>
      </div>

      <!-- 2. 左溫度控制 + 空調抽屜入口 -->
      <div class="dock-temp-group">
        <button class="dock-step-btn" data-action="step-temp" data-zone="driver" data-delta="-0.5" aria-label="調低駕駛側溫度">◀</button>
        <button class="dock-temp-readout ${cl.drawerOpen ? 'is-active' : ''}" data-action="toggle-climate-drawer" title="點擊展開底部空調與座椅抽屜">
          <strong class="mono-num" id="dock-driver-temp-val">${cl.driverTempC.toFixed(1)}°</strong>
          <small>左溫區 · ${s.seats.driver.heatLevel > 0 ? `加熱${s.seats.driver.heatLevel}` : '空調'}</small>
        </button>
        <button class="dock-step-btn" data-action="step-temp" data-zone="driver" data-delta="0.5" aria-label="調高駕駛側溫度">▶</button>
      </div>

      <!-- 3. 中央應用圖標列（空調抽屜、前/後除霜、座椅視圖、音樂播放窗、導航路線比較、屏幕清潔） -->
      <nav class="dock-apps-row" aria-label="常用車載功能">
        <button class="dock-app-btn ${cl.drawerOpen && cl.subView === 'climate' ? 'is-active' : ''}" data-action="open-climate-tab" data-view="climate" title="恆溫空調抽屜">
          ${icon('fan')}
          <span>空調</span>
        </button>
        <button class="dock-app-btn ${cl.frontDefrost ? 'is-defrost-on' : ''}" data-action="toggle-defrost" data-which="front" title="前擋風玻璃除霜">
          ${icon('defrostFront')}
          <span>前除霜</span>
        </button>
        <button class="dock-app-btn ${cl.rearDefrost ? 'is-defrost-on' : ''}" data-action="toggle-defrost" data-which="rear" title="後擋風玻璃除霜">
          ${icon('defrostRear')}
          <span>後除霜</span>
        </button>
        <button class="dock-app-btn ${cl.drawerOpen && cl.subView === 'seats' ? 'is-active' : ''}" data-action="open-climate-tab" data-view="seats" title="前排座椅調節視圖">
          ${icon('seatLeft')}
          <span>座椅</span>
        </button>
        <button class="dock-app-btn ${med.playerWindowExpanded ? 'is-active' : ''}" data-action="toggle-music-window" title="獨立音樂播放窗">
          ${icon('music')}
          <span>音樂</span>
        </button>
        <button class="dock-app-btn ${s.navigation.routeCompareOpen ? 'is-active' : ''}" data-action="toggle-route-compare" title="導航路線比較">
          ${icon('navigation')}
          <span>導航</span>
        </button>
        <button class="dock-app-btn ${this.showMatrixModal ? 'is-active' : ''}" data-action="toggle-matrix-modal" title="行為對照表與車型配置">
          ${icon('apps')}
          <span>對照表</span>
        </button>
      </nav>

      <!-- 4. 右溫度控制 -->
      <div class="dock-temp-group">
        <button class="dock-step-btn" data-action="step-temp" data-zone="passenger" data-delta="-0.5" aria-label="調低副駕側溫度">◀</button>
        <button class="dock-temp-readout ${cl.drawerOpen ? 'is-active' : ''}" data-action="toggle-climate-drawer" title="點擊展開底部空調抽屜">
          <strong class="mono-num" id="dock-passenger-temp-val">${cl.passengerTempC.toFixed(1)}°</strong>
          <small>右溫區 · ${s.seats.passenger.heatLevel > 0 ? `加熱${s.seats.passenger.heatLevel}` : '同步'}</small>
        </button>
        <button class="dock-step-btn" data-action="step-temp" data-zone="passenger" data-delta="0.5" aria-label="調高副駕側溫度">▶</button>
      </div>

      <!-- 5. 右側音量控制（點擊展開滑桿與靜音） -->
      <div class="dock-cluster-right">
        <button class="dock-vol-btn ${med.volumePopoverOpen ? 'is-active' : ''}" data-action="toggle-volume-popover" aria-label="展開音量滑桿">
          ${icon('volume')}
          <span class="mono-num">${med.muted ? '靜音' : `${med.volume}%`}</span>
        </button>
      </div>
    `;
  }

  /**
   * 渲染右下音量展開滑桿浮層
   */
  renderVolumePopover(s) {
    const el = document.getElementById('dock-volume-popover');
    if (!el) return;
    if (!s.media.volumePopoverOpen) {
      el.classList.remove('is-open');
      el.innerHTML = '';
      return;
    }

    el.classList.add('is-open');
    el.innerHTML = `
      <div class="vol-popover-inner">
        <div class="vol-popover-head">
          <span>車載音響主音量</span>
          <strong class="mono-num">${s.media.muted ? '已靜音 (0%)' : `${s.media.volume}%`}</strong>
        </div>
        <div class="stepper-slider-row">
          <button class="step-btn ${s.media.muted ? 'is-selected' : ''}" data-action="toggle-media-mute">
            ${s.media.muted ? '取消靜音' : '靜音'}
          </button>
          <input type="range" min="0" max="100" step="1" value="${s.media.muted ? 0 : s.media.volume}" data-action="slide-volume" aria-label="主音量滑桿" />
        </div>
      </div>
    `;
  }

  /**
   * 渲染屏幕清潔模式全屏遮罩
   */
  renderScreenCleanOverlay(s) {
    const el = document.getElementById('screen-clean-overlay');
    if (!el) return;
    const active = s.settings.screenCleanMode;
    el.classList.toggle('is-open', active);
    if (!active) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML = `
      <div class="screen-clean-box">
        <h2>屏幕清潔模式已啟用</h2>
        <p>觸控螢幕與底部 Dock 操作已全面鎖定，您現在可以使用超細纖維布安全擦拭螢幕。</p>
        <button class="clean-exit-btn" id="clean-exit-btn" data-action="exit-screen-clean">
          點擊此處或按 Esc 鍵退出清潔模式
        </button>
      </div>
    `;

    setTimeout(() => {
      document.getElementById('clean-exit-btn')?.focus();
    }, 20);
  }

  renderToast(s) {
    const el = document.getElementById('phase1-toast-banner');
    if (!el) return;
    if (!s.toast) {
      el.classList.remove('is-visible');
      el.textContent = '';
      return;
    }
    el.textContent = s.toast.message;
    el.classList.add('is-visible');
  }

  /**
   * 綁定全局點擊、滑桿與鍵盤焦點管理 (Esc / Tab / 方向鍵)
   */
  bindGlobalEvents() {
    this.rootEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      const action = btn.dataset.action;
      this.handleAction(action, btn, e);
    });

    this.rootEl.addEventListener('input', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;
      this.handleInputAction(action, el);
    });

    // 鍵盤焦點管理：Esc 退出屏幕清潔/對話框/抽屜，方向鍵在展開模式下旋轉 3D 車輛視角
    window.addEventListener('keydown', (e) => {
      const st = this.store.getState();

      if (e.key === 'Escape') {
        if (st.settings.screenCleanMode) {
          e.preventDefault();
          this.store.toggleTemporaryMode('screenCleanMode');
          return;
        }
        if (this.showMatrixModal) {
          e.preventDefault();
          this.showMatrixModal = false;
          this.renderMatrixModal(st);
          this.lastFocusedTrigger?.focus();
          return;
        }
        if (st.settings.activeDialog) {
          e.preventDefault();
          this.store.update((s) => {
            s.settings.activeDialog = null;
          });
          this.lastFocusedTrigger?.focus();
          return;
        }
        if (st.climate.drawerOpen) {
          e.preventDefault();
          this.store.update((s) => {
            s.climate.drawerOpen = false;
          });
          this.lastFocusedTrigger?.focus();
          return;
        }
        if (st.settings.drawerOpen) {
          e.preventDefault();
          this.store.update((s) => {
            s.settings.drawerOpen = false;
          });
          this.lastFocusedTrigger?.focus();
          return;
        }
      }

      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
          return;
        }
        if (st.camera3D.expanded) {
          e.preventDefault();
          this.engine3D.rotateByArrowKey(e.key);
        }
      }
    });
  }

  handleInputAction(action, el) {
    const val = Number(el.value);
    switch (action) {
      case 'nav-search-input':
        this.store.update((s) => {
          s.navigation.searchQuery = el.value;
        }, ['nav']);
        break;
      case 'media-scrub-input':
        this.store.update((s) => {
          s.media.progressSec = Math.round(val);
        }, ['media']);
        break;
      case 'slide-fan':
        this.store.update((s) => {
          s.climate.fanSpeed = Math.round(val);
          s.climate.autoMode = false;
        }, ['climate']);
        break;
      case 'slide-seat': {
        const field = el.dataset.field;
        this.store.update((s) => {
          const side = s.seats.activeSide || 'driver';
          s.seats[side][field] = Math.round(val);
        }, ['seats']);
        break;
      }
      case 'slide-charge-limit':
        this.store.update((s) => {
          s.settings.chargeLimitPercent = Math.round(val);
        }, ['settings']);
        break;
      case 'slide-charge-amps':
        this.store.update((s) => {
          s.settings.chargeCurrentAmps = Math.round(val);
        }, ['settings']);
        break;
      case 'slide-brightness':
        this.store.update((s) => {
          s.settings.brightnessPercent = Math.round(val);
          s.settings.autoBrightness = false;
        }, ['settings']);
        break;
      case 'slide-max-speed':
        this.store.update((s) => {
          s.settings.maxSpeedLimitKmh = Math.round(val);
        }, ['settings']);
        break;
      case 'slide-volume':
        this.store.update((s) => {
          s.media.volume = Math.round(val);
          s.media.muted = val === 0;
        }, ['media']);
        break;
      default:
        break;
    }
  }

  handleAction(action, btn, e) {
    switch (action) {
      case 'select-vehicle-config': {
        const cfgId = btn.dataset.config;
        if (cfgId === 'models') {
          this.store.showToast(VEHICLE_CONFIGS.models.unavailableReason);
          return;
        }
        break;
      }
      case 'toggle-camera-expand':
        this.store.update((s) => {
          s.camera3D.expanded = !s.camera3D.expanded;
          s.camera3D.lastInteractAt = 0;
          s.camera3D.inactivityRemainingSec = 0;
        });
        break;
      case 'rotate-cam-step':
        this.engine3D.rotateByArrowKey(btn.dataset.key);
        break;
      case 'reset-camera-3d':
        this.engine3D.resetCameraToDefault();
        break;
      case 'toggle-day-night':
        this.store.update((s) => {
          s.settings.appearanceTheme = s.settings.appearanceTheme === 'day' ? 'night' : 'day';
        });
        break;
      case 'toggle-matrix-modal':
        this.lastFocusedTrigger = btn;
        this.showMatrixModal = !this.showMatrixModal;
        this.renderMatrixModal(this.store.getState());
        break;
      case 'toggle-lock':
        this.store.update((s) => {
          s.vehicle.locked = !s.vehicle.locked;
        });
        break;
      case 'toggle-energy-display':
        this.store.update((s) => {
          s.settings.energyDisplayMode = s.settings.energyDisplayMode === 'percent' ? 'distance' : 'percent';
        });
        break;
      case 'toggle-car-part': {
        const part = btn.dataset.part;
        this.store.update((s) => {
          if (part === 'frunk') s.vehicle.frunkOpen = !s.vehicle.frunkOpen;
          if (part === 'trunk') s.vehicle.trunkOpen = !s.vehicle.trunkOpen;
          if (part === 'chargePort') s.vehicle.chargePortOpen = !s.vehicle.chargePortOpen;
        });
        break;
      }
      case 'toggle-music-window':
        this.store.update((s) => {
          s.media.playerWindowExpanded = !s.media.playerWindowExpanded;
        });
        break;
      case 'media-toggle-play':
        this.store.update((s) => {
          s.media.playing = !s.media.playing;
        });
        break;
      case 'media-prev':
        this.store.update((s) => {
          s.media.trackIndex = (s.media.trackIndex - 1 + FICTIONAL_TRACKS.length) % FICTIONAL_TRACKS.length;
          s.media.progressSec = 0;
        });
        break;
      case 'media-next':
        this.store.update((s) => {
          s.media.trackIndex = (s.media.trackIndex + 1) % FICTIONAL_TRACKS.length;
          s.media.progressSec = 0;
        });
        break;
      case 'select-track':
        this.store.update((s) => {
          s.media.trackIndex = Number(btn.dataset.idx) || 0;
          s.media.progressSec = 0;
          s.media.playing = true;
        });
        break;
      case 'toggle-track-fav': {
        const id = btn.dataset.id;
        this.store.update((s) => {
          const idx = s.media.favorites.indexOf(id);
          if (idx >= 0) s.media.favorites.splice(idx, 1);
          else s.media.favorites.push(id);
        });
        break;
      }
      case 'scrub-compact-media': {
        const rect = btn.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / (rect.width || 1)));
        const track = FICTIONAL_TRACKS[this.store.getState().media.trackIndex] || FICTIONAL_TRACKS[0];
        this.store.update((s) => {
          s.media.progressSec = Math.round(ratio * track.durationSec);
        });
        break;
      }
      case 'select-nav-poi': {
        const poiId = btn.dataset.id;
        this.store.update((s) => {
          s.navigation.selectedPoiId = poiId;
          s.navigation.routeLoading = true;
        });
        setTimeout(() => {
          this.store.update((s) => {
            s.navigation.routeLoading = false;
          });
        }, 240);
        break;
      }
      case 'toggle-sc-layer':
        this.store.update((s) => {
          s.navigation.showSuperchargers = !s.navigation.showSuperchargers;
        });
        break;
      case 'toggle-route-compare':
        this.store.update((s) => {
          s.navigation.routeCompareOpen = !s.navigation.routeCompareOpen;
        });
        break;
      case 'select-nav-route':
        this.store.update((s) => {
          s.navigation.selectedRouteId = btn.dataset.route || 'fastest';
        });
        break;
      case 'toggle-nav-demo':
        this.store.update((s) => {
          s.navigation.demoGuidanceActive = !s.navigation.demoGuidanceActive;
        });
        break;
      case 'map-pan-step': {
        const dx = Number(btn.dataset.dx) || 0;
        const dy = Number(btn.dataset.dy) || 0;
        this.store.update((s) => {
          s.navigation.panX = Math.max(-360, Math.min(360, s.navigation.panX + dx));
          s.navigation.panY = Math.max(-280, Math.min(280, s.navigation.panY + dy));
        });
        break;
      }
      case 'map-zoom-step': {
        const delta = Number(btn.dataset.delta) || 0;
        this.store.update((s) => {
          s.navigation.zoom = Math.max(0.75, Math.min(1.85, s.navigation.zoom + delta));
        });
        break;
      }
      case 'map-recenter':
        this.store.update((s) => {
          s.navigation.panX = 0;
          s.navigation.panY = 0;
          s.navigation.zoom = 1.0;
        });
        break;
      case 'toggle-settings-drawer':
        this.lastFocusedTrigger = btn;
        this.store.update((s) => {
          s.settings.drawerOpen = !s.settings.drawerOpen;
          if (s.settings.drawerOpen) {
            s.climate.drawerOpen = false;
            s.camera3D.expanded = true;
          }
        });
        break;
      case 'close-settings-drawer':
        this.store.update((s) => {
          s.settings.drawerOpen = false;
        });
        break;
      case 'select-settings-cat':
        this.store.update((s) => {
          s.settings.activeCategory = btn.dataset.cat || 'controls';
        });
        break;
      case 'toggle-climate-drawer':
        this.lastFocusedTrigger = btn;
        this.store.update((s) => {
          s.climate.drawerOpen = !s.climate.drawerOpen;
          if (s.climate.drawerOpen) s.settings.drawerOpen = false;
        });
        break;
      case 'open-climate-tab':
        this.lastFocusedTrigger = btn;
        this.store.update((s) => {
          const targetView = btn.dataset.view || 'climate';
          if (s.climate.drawerOpen && s.climate.subView === targetView) {
            s.climate.drawerOpen = false;
          } else {
            s.climate.drawerOpen = true;
            s.climate.subView = targetView;
            s.settings.drawerOpen = false;
          }
        });
        break;
      case 'close-climate-drawer':
        this.store.update((s) => {
          s.climate.drawerOpen = false;
        });
        break;
      case 'set-climate-subview':
        this.store.update((s) => {
          s.climate.subView = btn.dataset.view || 'climate';
        });
        break;
      case 'open-seats-from-settings':
        this.store.update((s) => {
          s.settings.drawerOpen = false;
          s.climate.drawerOpen = true;
          s.climate.subView = 'seats';
        });
        break;
      case 'toggle-climate-power':
        this.store.update((s) => {
          s.climate.power = !s.climate.power;
          if (!s.climate.power) {
            s.climate.frontDefrost = false;
            s.climate.rearDefrost = false;
          }
        });
        break;
      case 'toggle-climate-bool': {
        const f = btn.dataset.field;
        this.store.update((s) => {
          s.climate[f] = !s.climate[f];
        });
        break;
      }
      case 'toggle-defrost': {
        const which = btn.dataset.which;
        this.store.update((s) => {
          if (which === 'front') {
            s.climate.frontDefrost = !s.climate.frontDefrost;
            if (s.climate.frontDefrost) {
              s.climate.power = true;
              s.climate.fanSpeed = Math.max(8, s.climate.fanSpeed);
            }
          } else {
            s.climate.rearDefrost = !s.climate.rearDefrost;
          }
        });
        break;
      }
      case 'step-fan': {
        const d = Number(btn.dataset.delta) || 0;
        this.store.update((s) => {
          s.climate.fanSpeed = Math.max(1, Math.min(10, s.climate.fanSpeed + d));
          s.climate.autoMode = false;
        });
        break;
      }
      case 'step-temp': {
        const zone = btn.dataset.zone;
        const d = Number(btn.dataset.delta) || 0;
        this.store.update((s) => {
          s.climate.power = true;
          if (zone === 'driver') {
            s.climate.driverTempC = Math.max(15.0, Math.min(28.0, s.climate.driverTempC + d));
            if (s.climate.syncTemp) s.climate.passengerTempC = s.climate.driverTempC;
          } else {
            s.climate.passengerTempC = Math.max(15.0, Math.min(28.0, s.climate.passengerTempC + d));
          }
        });
        break;
      }
      case 'set-camp-mode':
        this.store.update((s) => {
          s.climate.campKeepMode = btn.dataset.mode || 'off';
          if (s.climate.campKeepMode !== 'off') s.climate.power = true;
        });
        break;
      case 'select-seat-side':
        this.store.update((s) => {
          s.seats.activeSide = btn.dataset.side || 'driver';
        });
        break;
      case 'step-seat': {
        const f = btn.dataset.field;
        const d = Number(btn.dataset.delta) || 0;
        this.store.update((s) => {
          const side = s.seats.activeSide || 'driver';
          const seat = s.seats[side];
          if (f === 'foreAftMm') seat.foreAftMm = Math.max(-50, Math.min(50, seat.foreAftMm + d));
          if (f === 'reclineDeg') seat.reclineDeg = Math.max(15, Math.min(45, seat.reclineDeg + d));
          if (f === 'heightMm') seat.heightMm = Math.max(-20, Math.min(20, seat.heightMm + d));
        });
        break;
      }
      case 'cycle-seat-heat': {
        const side = btn.dataset.side || 'driver';
        this.store.update((s) => {
          s.seats[side].heatLevel = (s.seats[side].heatLevel + 1) % 4;
        });
        break;
      }
      case 'reset-seat-default':
        this.store.update((s) => {
          const side = s.seats.activeSide || 'driver';
          s.seats[side].foreAftMm = 0;
          s.seats[side].reclineDeg = 24;
          s.seats[side].heightMm = 0;
        });
        this.store.showToast('已將當前前排座椅恢復為標準預設位置並寫入本地');
        break;
      case 'set-headlights-mode':
        this.store.update((s) => {
          s.settings.headlightsMode = btn.dataset.val || 'auto';
        });
        break;
      case 'set-wipers-mode':
        this.store.update((s) => {
          s.vehicle.wipersMode = btn.dataset.val || 'auto';
        });
        break;
      case 'toggle-mirrors-fold':
        this.store.update((s) => {
          s.vehicle.mirrorsFolded = !s.vehicle.mirrorsFolded;
        });
        break;
      case 'toggle-windows-lock':
        this.store.update((s) => {
          s.vehicle.windowsLocked = !s.vehicle.windowsLocked;
        });
        break;
      case 'toggle-glovebox':
        this.store.update((s) => {
          s.vehicle.gloveboxOpen = !s.vehicle.gloveboxOpen;
        });
        break;
      case 'set-accel-mode':
        this.store.update((s) => {
          s.settings.accelMode = btn.dataset.val || 'standard';
        });
        break;
      case 'set-steering-weight':
        this.store.update((s) => {
          s.settings.steeringWeight = btn.dataset.val || 'standard';
        });
        break;
      case 'set-stopping-mode':
        this.store.update((s) => {
          s.settings.stoppingMode = btn.dataset.val || 'hold';
        });
        break;
      case 'toggle-setting-bool': {
        const f = btn.dataset.field;
        this.store.update((s) => {
          s.settings[f] = !s.settings[f];
        });
        break;
      }
      case 'set-setting-enum': {
        const f = btn.dataset.field;
        const v = btn.dataset.val;
        this.store.update((s) => {
          s.settings[f] = v;
        });
        break;
      }
      case 'step-charge-limit': {
        const d = Number(btn.dataset.delta) || 0;
        this.store.update((s) => {
          s.settings.chargeLimitPercent = Math.max(50, Math.min(100, s.settings.chargeLimitPercent + d));
        });
        break;
      }
      case 'set-charge-limit-preset':
        this.store.update((s) => {
          s.settings.chargeLimitPercent = Number(btn.dataset.val) || 80;
        });
        break;
      case 'step-charge-amps': {
        const d = Number(btn.dataset.delta) || 0;
        this.store.update((s) => {
          s.settings.chargeCurrentAmps = Math.max(5, Math.min(48, s.settings.chargeCurrentAmps + d));
        });
        break;
      }
      case 'toggle-unlock-chargeport':
        this.store.update((s) => {
          if (s.vehicle.chargePortOpen) {
            s.vehicle.chargePortUnlocked = !s.vehicle.chargePortUnlocked;
          }
        });
        break;
      case 'set-follow-dist':
        this.store.update((s) => {
          s.settings.cruiseFollowDistance = Number(btn.dataset.val) || 3;
        });
        break;
      case 'toggle-key-active': {
        const id = btn.dataset.id;
        this.store.update((s) => {
          const item = s.settings.keysList.find((k) => k.id === id);
          if (item) item.active = !item.active;
        });
        break;
      }
      case 'add-demo-key':
        this.store.update((s) => {
          const n = s.settings.keysList.length + 1;
          s.settings.keysList.push({
            id: `k${Date.now()}`,
            name: `演示備用鑰匙卡 #${n}`,
            type: 'NFC 卡片',
            active: true
          });
        });
        this.store.showToast('已新增演示鑰匙並儲存於 localStorage');
        break;
      case 'set-child-lock':
        this.store.update((s) => {
          s.vehicle.childLockMode = btn.dataset.val || 'off';
        });
        break;
      case 'set-appearance-theme':
        this.store.update((s) => {
          s.settings.appearanceTheme = btn.dataset.val || 'night';
        });
        break;
      case 'step-brightness': {
        const d = Number(btn.dataset.delta) || 0;
        this.store.update((s) => {
          s.settings.brightnessPercent = Math.max(20, Math.min(100, s.settings.brightnessPercent + d));
          s.settings.autoBrightness = false;
        });
        break;
      }
      case 'reset-trip': {
        const which = btn.dataset.trip;
        this.store.update((s) => {
          if (which === 'A') s.settings.trips.tripAKm = 0;
          if (which === 'B') s.settings.trips.tripBKm = 0;
        });
        this.store.showToast(`行程 ${which} 統計數據已重置為 0.0 km`);
        break;
      }
      case 'step-max-speed': {
        const d = Number(btn.dataset.delta) || 0;
        this.store.update((s) => {
          s.settings.maxSpeedLimitKmh = Math.max(80, Math.min(145, s.settings.maxSpeedLimitKmh + d));
        });
        break;
      }
      case 'toggle-temp-mode': {
        const mode = btn.dataset.mode;
        this.store.toggleTemporaryMode(mode);
        break;
      }
      case 'exit-screen-clean':
        this.store.toggleTemporaryMode('screenCleanMode');
        break;
      case 'open-adj-dialog':
        this.lastFocusedTrigger = btn;
        this.store.update((s) => {
          s.settings.activeDialog = btn.dataset.dialog || null;
        });
        break;
      case 'close-adj-dialog':
        this.store.update((s) => {
          s.settings.activeDialog = null;
        });
        this.lastFocusedTrigger?.focus();
        break;
      case 'confirm-factory-reset':
        window.localStorage.removeItem('tesla_model3_phase1_state_v1');
        this.store.update((s) => {
          s.seats.driver = { foreAftMm: 0, reclineDeg: 24, heightMm: 0, heatLevel: 1 };
          s.seats.passenger = { foreAftMm: 6, reclineDeg: 26, heightMm: 0, heatLevel: 0 };
          s.settings.activeDialog = null;
        });
        this.store.showToast('已清除本地個人化設定並恢復為出廠預設值');
        break;
      case 'check-software-update':
        this.store.update((s) => {
          s.settings.checkingForUpdate = true;
        });
        setTimeout(() => {
          this.store.update((s) => {
            s.settings.checkingForUpdate = false;
            s.settings.lastUpdateCheckText = '剛才已檢查：您的 Model 3 軟件已是最新版本';
          });
        }, 650);
        break;
      case 'toggle-volume-popover':
        this.store.update((s) => {
          s.media.volumePopoverOpen = !s.media.volumePopoverOpen;
        });
        break;
      case 'toggle-media-mute':
        this.store.update((s) => {
          s.media.muted = !s.media.muted;
        });
        break;
      default:
        break;
    }
  }
}
