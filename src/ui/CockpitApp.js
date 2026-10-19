/**
 * TESLA MODEL 3 (2021+ REFRESH) — FIVE-SCREEN COCKPIT HMI & 3D INTERIOR OVERVIEW CONTROLLER
 * 質感與真實度大改重點：
 * 1. 對標車型改為 2021+ Tesla Model 3：17 吋橫屏 (2200:1300，支援向駕駛側傾斜)、方向盤後 8:3 橫條儀錶盤（僅顯示車速/擋位/報警/轉向燈/限速/輔助駕駛/實時能耗曲線，地圖與控制全數置於中控）。
 * 2. 座艙總覽重做為真實 3D 座艙：含擋風玻璃（透視車外真實 3D 道路）、左右 A 柱、橫貫式儀錶台、方向盤與後方 8:3 儀錶盤罩、座椅、車門內飾板；HUD 為擋風玻璃上的無框透明疊加層；手機為真實 3D 鈦金屬邊框+玻璃反光+靈動島模型，可拿起放大全屏；鏡頭預設為駕駛位視角並支援拖拽軌道旋轉。
 * 3. 去網頁化視覺語言：移除大面積藍色填充按鈕與滿屏邊框膠囊按鈕，改用中性深灰/純白與 1.75px 線性大圖標+短標籤；中控「車門/前備箱/尾箱/充電口」改為緊湊圖標按鈕列，絕不與音樂卡重疊；副駕屏音量控件與歌名完整顯示且與主屏聯動。
 * 4. 狀態與導航邏輯 100% 一致：非 P 擋行駛時強制「未上鎖」且不顯示哨兵；停車上鎖時速度為 0；導航轉向圖標與文字方向、目的地、距離、剩餘時間五端完全同步。
 */

import { icon } from './icons.js?v=35';
import { PAINT_PRESETS } from '../engine/SceneEngine.js?v=35';
import { DESTINATIONS_CATALOG } from '../state/vehicleStore.js?v=35';
import { renderDesignDocModal, renderAcceptanceChecklistModal } from './DesignDocModal.js?v=35';

export class CockpitApp {
  constructor(rootEl, store, sceneEngine, mapMediaEngine) {
    this.root = rootEl;
    this.store = store;
    this.sceneEngine = sceneEngine;
    this.mapMediaEngine = mapMediaEngine;
    this.domRefs = {};
    this.drawerOpen = false;
    this.glbLoadProgress = null;
    this.glbLoaded = false;

    // 座艙總覽 3D 軌道鏡頭（預設為駕駛位微偏視角：yaw 3deg, pitch -2deg）
    this.cockpitOrbit = {
      yaw: 2.5,
      pitch: -1.5,
      dragging: false,
      preset: 'driver'
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('tesla-glb-progress', (e) => {
        this.glbLoadProgress = e.detail?.percent || 0;
        const percent = this.glbLoadProgress;
        const barFill = document.getElementById('glb-progress-fill');
        if (barFill) barFill.style.width = `${percent}%`;
        const textEl = document.getElementById('glb-progress-text');
        if (textEl) textEl.textContent = `Model 3 3D 載入中 ${percent}%`;
        const headerText = document.getElementById('header-glb-text');
        if (headerText) headerText.textContent = `3D 載入 ${percent}%`;
      });

      window.addEventListener('tesla-glb-loaded', () => {
        this.glbLoaded = true;
        const overlay = document.getElementById('center-model-loading-overlay');
        if (overlay) {
          overlay.classList.add('is-loaded');
          setTimeout(() => {
            if (overlay) overlay.style.display = 'none';
          }, 400);
        }
        const headerBadge = document.getElementById('header-glb-status');
        const headerText = document.getElementById('header-glb-text');
        if (headerBadge) headerBadge.classList.add('is-ready');
        if (headerText) headerText.textContent = '3D 孿生就緒';
      });
    }

    this.mountShell();
    this.syncThemeAndBrightness(this.store.getState());
    this.registerCanvases();
    this.bindGlobalEvents();
    // 已移除座艙整頁拖拽旋轉

    this.renderAllUILayers();
    this.updateLiveTelemetryDOM();

    this.store.subscribe((state, changedPaths) => {
      this.syncThemeAndBrightness(state);
      if (changedPaths.length === 1 && changedPaths[0] === 'telemetry') {
        this.updateLiveTelemetryDOM();
      } else if (changedPaths.length === 1 && changedPaths[0] === 'system.toast') {
        this.renderToastOnly(state);
      } else if (changedPaths.length === 1 && changedPaths[0] === 'slider-live') {
        this.updateLiveTelemetryDOM();
        this.updateSliderLiveDOM(state);
      } else if (changedPaths.length === 1 && changedPaths[0] === 'nav-search-live') {
        this.updateSearchResultsDOM(state);
      } else {
        this.renderAllUILayers();
        this.updateLiveTelemetryDOM();
      }
    });
  }

  getControlStateAttrs(controlId, isEnabledActive = false, naturalDisabled = false, disabledReason = '') {
    const s = this.store.getState();
    const override = s.system.controlStateOverride;
    const isLoading = Boolean(s.system.loadingControls[controlId]) || override === 'loading';
    const isDisabled = naturalDisabled || override === 'disabled';
    const isForcedActive = override === 'active';

    const classes = ['ctrl-btn'];
    if (isEnabledActive) classes.push('is-selected');
    if (isForcedActive) classes.push('is-pressed');
    if (isLoading) classes.push('is-loading');
    if (isDisabled) classes.push('is-disabled');

    const titleAttr = isDisabled && disabledReason ? `title="${disabledReason}"` : '';
    const disabledAttr = isDisabled ? 'aria-disabled="true"' : '';

    return {
      className: classes.join(' '),
      isLoading,
      isDisabled,
      attrs: `${titleAttr} ${disabledAttr}`
    };
  }

  mountShell() {
    const s = this.store.getState();
    document.documentElement.setAttribute('data-theme', s.environment.timeOfDay);
    const focused = s.system.focusedScreen || 'overview';
    const tilt = s.environment.centerTilt || 'driver';

    this.root.innerHTML = `
      <div class="cockpit-shell" id="cockpit-shell" data-view="${focused}" data-drawer="closed" data-tilt="${tilt}">
        <header class="cockpit-topbar">
          <div class="topbar-brand">
            <span class="tesla-wordmark">MODEL 3</span>
            <span class="topbar-divider"></span>
            <span class="topbar-title">智能座艙五端 HMI (含概念儀錶/副駕屏)</span>
            <span class="disclaimer-pill">概念設計 · CC-BY Ameer Studio</span>
          </div>

          <nav class="view-switcher" aria-label="五端視角切換">
            <button class="view-tab ${focused === 'overview' ? 'is-active' : ''}" data-view-target="overview">${icon('grid', 'tab-icon')}<span>3D 座艙總覽</span></button>
            <button class="view-tab ${focused === 'mobile' ? 'is-active' : ''}" data-view-target="mobile">${icon('phone', 'tab-icon')}<span>手機 App</span></button>
            <button class="view-tab ${focused === 'center' ? 'is-active' : ''}" data-view-target="center">${icon('tiltScreen', 'tab-icon')}<span>15.4" 中控屏</span></button>
            <button class="view-tab ${focused === 'passenger' ? 'is-active' : ''}" data-view-target="passenger">${icon('video', 'tab-icon')}<span>副駕娛樂屏</span></button>
            <button class="view-tab ${focused === 'cluster' ? 'is-active' : ''}" data-view-target="cluster">${icon('steering', 'tab-icon')}<span>8:3 儀錶盤</span></button>
            <button class="view-tab ${focused === 'hud' ? 'is-active' : ''}" data-view-target="hud">${icon('navigation', 'tab-icon')}<span>擋風玻璃 HUD</span></button>
          </nav>

          <div class="topbar-actions">
            
            <div id="header-glb-status" class="header-glb-badge ${this.glbLoaded ? 'is-ready' : ''}">
              <span class="status-dot"></span>
              <span id="header-glb-text">${this.glbLoaded ? '3D 孿生就緒' : '3D 載入中'}</span>
            </div>
            <div class="fps-badge">
              <span class="fps-dot"></span>
              <span id="live-fps">60</span> FPS
            </div>
            <button class="action-pill-btn" data-action="open-design-doc">
              ${icon('doc', 'inline-icon')}<span>文檔</span>
            </button>
            <button class="action-pill-btn" data-action="open-checklist-modal">
              ${icon('checkCircle', 'inline-icon')}<span>自檢</span>
            </button>
            <button class="action-pill-btn drawer-toggle-btn" id="drawer-toggle-btn" data-action="toggle-demo-drawer">
              ${icon('settings', 'inline-icon')}<span id="drawer-toggle-label">聯動面板</span>
            </button>
          </div>
        </header>

        <main class="cockpit-main" id="cockpit-main-viewport">
          <!-- 真實 3D Model 3 座艙總覽舞台 (支援拖拽軌道旋轉，預設為駕駛位視角) -->
          <div class="screens-stage" id="screens-stage">

            <!-- 3D 座艙內飾結構層：A 柱、車門內飾板、前擋風玻璃外真實 3D 道路、橫貫式儀錶台與雙前座 -->
            <div class="cockpit-3d-cabin" id="cockpit-3d-cabin">

              <!-- 車門內飾板 (Door Interior Trim Panels) -->
              <div class="cabin-door-trim door-trim-left" aria-hidden="true">
                <div class="door-wood-inlay"></div>
                <div class="door-armrest"></div>
                <div class="door-ambient-strip"></div>
              </div>
              <div class="cabin-door-trim door-trim-right" aria-hidden="true">
                <div class="door-wood-inlay"></div>
                <div class="door-armrest"></div>
                <div class="door-ambient-strip"></div>
              </div>

              <!-- 上層：前擋風玻璃與左右 A 柱（擋風玻璃外即為真實 3D 道路，HUD 為擋風玻璃上的無框透明疊加層） -->
              <div class="cockpit-windshield-zone">
                <div class="cabin-a-pillar pillar-left" aria-hidden="true">
                  <div class="pillar-tweeter"></div>
                </div>
                <div class="cabin-a-pillar pillar-right" aria-hidden="true">
                  <div class="pillar-tweeter"></div>
                </div>

                <!-- 擋風玻璃外的真實 3D 道路畫布 -->
                <div class="windshield-road-backdrop">
                  <canvas id="canvas-windshield-3d" class="windshield-road-canvas"></canvas>
                  <div class="windshield-optical-tint"></div>
                </div>

                <!-- 端點 5：HUD（擋風玻璃上的無框透明光學疊加層，直接疊在真實 3D 道路上，不是單獨的方框） -->
                <section class="screen-unit unit-hud" data-screen-id="hud">
                  <div class="hud-windshield-tag">
                    <span>AR-HUD 擋風玻璃光學投影</span>
                    <button class="focus-toggle-btn" data-view-target="hud" title="放大檢視擋風玻璃 HUD">${icon('expand')}</button>
                  </div>
                  <div class="hud-frameless-projection" title="AR-HUD 擋風玻璃光學投影">
                    <canvas id="canvas-hud-3d" class="screen-3d-canvas hud-canvas"></canvas>
                    <div id="hud-ui-layer" class="hud-ui-layer"></div>
                  </div>
                </section>
              </div>

              <!-- 下層：2021+ Model 3 橫貫式儀錶台（方向盤後 8:3 儀錶盤 + 17 吋可傾斜中控橫屏 + 副駕娛樂屏） -->
              <div class="cockpit-dashboard-wing">
                <div class="dash-top-hood" aria-hidden="true"></div>
                <div class="dash-air-wave-slot" aria-hidden="true"></div>
                <div class="dash-wood-decor" aria-hidden="true"></div>

                <div class="dashboard-screens-row">
                  <!-- 左側駕駛艙位：方向盤正後方內嵌 8:3 橫條儀錶盤 + 方向盤前景 -->
                  <div class="driver-cockpit-bay">
                    <section class="screen-unit unit-cluster" data-screen-id="cluster">
                      <div class="screen-unit-label">
                        <span>8:3 駕駛儀錶盤</span>
                        <button class="focus-toggle-btn" data-view-target="cluster" title="放大檢視 8:3 儀錶盤">${icon('expand')}</button>
                      </div>
                      <div class="cluster-binnacle-hood">
                        <div class="physical-bezel bezel-cluster">
                          <div class="screen-glass-glare"></div>
                          <div class="screen-vignette"></div>
                          <canvas id="canvas-cluster-3d" class="screen-3d-canvas cluster-canvas"></canvas>
                          <div id="cluster-ui-layer" class="cluster-ui-layer"></div>
                        </div>
                      </div>
                    </section>

                    <!-- 真實立體方向盤 / Yoke 結構（位於 8:3 儀錶盤正前方下緣，絕不遮擋儀錶文字） -->
                    <div class="cockpit-steering-wheel" id="cockpit-steering-wheel" aria-hidden="true">
                      <svg class="steering-wheel-svg" viewBox="0 0 420 148" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="yokeLeatherGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#383f4d"/>
                            <stop offset="28%" stop-color="#222731"/>
                            <stop offset="75%" stop-color="#13161c"/>
                            <stop offset="100%" stop-color="#090b0e"/>
                          </linearGradient>
                          <linearGradient id="yokeSideGripGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stop-color="#434b5c"/>
                            <stop offset="45%" stop-color="#1f242d"/>
                            <stop offset="100%" stop-color="#0f1217"/>
                          </linearGradient>
                          <radialGradient id="airbagBossGrad" cx="50%" cy="32%" r="68%">
                            <stop offset="0%" stop-color="#323846"/>
                            <stop offset="58%" stop-color="#1a1e26"/>
                            <stop offset="100%" stop-color="#0d0f14"/>
                          </radialGradient>
                          <linearGradient id="satinSilverTrim" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stop-color="#647084"/>
                            <stop offset="50%" stop-color="#cbd5e1"/>
                            <stop offset="100%" stop-color="#647084"/>
                          </linearGradient>
                        </defs>
                        <!-- 轉向柱護罩底座 (Steering Column Shroud) -->
                        <path d="M 156 96 L 264 96 L 282 148 L 138 148 Z" fill="#0c0e13" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
                        <!-- Yoke 外圈與底部平底橫樑 (Open-Top Yoke Rim) -->
                        <path d="M 34 18 C 24 18, 16 28, 14 48 C 11 78, 14 110, 26 126 C 38 140, 72 144, 128 144 L 292 144 C 348 144, 382 140, 394 126 C 406 110, 409 78, 406 48 C 404 28, 396 18, 386 18 C 374 18, 366 28, 364 46 C 361 72, 358 96, 346 108 C 336 116, 304 118, 268 118 L 152 118 C 116 118, 84 116, 74 108 C 62 96, 59 72, 56 46 C 54 28, 46 18, 34 18 Z" fill="url(#yokeLeatherGrad)" stroke="rgba(255,255,255,0.20)" stroke-width="1.5"/>
                        <!-- 左右人體工學打孔真皮握把高光 -->
                        <path d="M 22 32 C 18 58, 20 96, 30 116" stroke="rgba(255,255,255,0.22)" stroke-width="2.2" stroke-linecap="round"/>
                        <path d="M 398 32 C 402 58, 400 96, 390 116" stroke="rgba(255,255,255,0.22)" stroke-width="2.2" stroke-linecap="round"/>
                        <!-- 內側法式雙縫線細節 -->
                        <path d="M 52 50 C 55 76, 60 98, 72 108 L 348 108 C 360 98, 365 76, 368 50" stroke="rgba(203,213,225,0.22)" stroke-width="1" stroke-dasharray="3 3"/>
                        <!-- 左右三維運動輻條與拉絲鋁飾條 -->
                        <path d="M 52 72 L 146 66 L 146 106 L 58 112 Z" fill="#181c24" stroke="rgba(255,255,255,0.12)" stroke-width="1.2"/>
                        <path d="M 368 72 L 274 66 L 274 106 L 362 112 Z" fill="#181c24" stroke="rgba(255,255,255,0.12)" stroke-width="1.2"/>
                        <path d="M 56 76 L 142 70" stroke="url(#satinSilverTrim)" stroke-width="2.4" stroke-linecap="round"/>
                        <path d="M 364 76 L 278 70" stroke="url(#satinSilverTrim)" stroke-width="2.4" stroke-linecap="round"/>
                        <!-- 左側金屬滾輪與觸控區 -->
                        <rect x="74" y="78" width="44" height="22" rx="6" fill="#101319" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
                        <rect x="86" y="83" width="20" height="12" rx="4" fill="#242a35" stroke="#94a3b8" stroke-width="1.2"/>
                        <line x1="90" y1="87" x2="102" y2="87" stroke="#e2e8f0" stroke-width="1.2"/>
                        <line x1="90" y1="91" x2="102" y2="91" stroke="#94a3b8" stroke-width="1"/>
                        <!-- 右側金屬滾輪與觸控區 -->
                        <rect x="302" y="78" width="44" height="22" rx="6" fill="#101319" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
                        <rect x="314" y="83" width="20" height="12" rx="4" fill="#242a35" stroke="#94a3b8" stroke-width="1.2"/>
                        <line x1="318" y1="87" x2="330" y2="87" stroke="#e2e8f0" stroke-width="1.2"/>
                        <line x1="318" y1="91" x2="330" y2="91" stroke="#94a3b8" stroke-width="1"/>
                        <!-- 中央立體六邊形安全氣囊蓋與 Tesla T 金屬徽標 -->
                        <path d="M 148 56 C 148 44, 272 44, 272 56 L 264 114 C 262 126, 158 126, 156 114 Z" fill="url(#airbagBossGrad)" stroke="rgba(255,255,255,0.18)" stroke-width="1.4"/>
                        <path d="M 192 70 Q 210 66 228 70" stroke="#e2e8f0" stroke-width="2.4" stroke-linecap="round"/>
                        <path d="M 195 75 Q 210 72 225 75 L 210 77 Z" fill="#cbd5e1"/>
                        <path d="M 210 74 L 210 100" stroke="#e2e8f0" stroke-width="2.6" stroke-linecap="round"/>
                      </svg>
                    </div>
                  </div>

                  <!-- 中央：Model 3 15.4 吋懸浮橫屏 (比例 16:10，支援向駕駛側傾斜) -->
                  <section class="screen-unit unit-center" data-screen-id="center">
                    <div class="screen-unit-label">
                      <span>15.4" 中控橫屏 (16:10 · <em id="tilt-status-label">向駕駛傾斜</em>)</span>
                      <div class="unit-label-actions">
                        <button class="tilt-quick-btn" data-action="cycle-center-tilt" title="切換 15.4 吋中控屏左右傾斜角度">${icon('tiltScreen')}<span>傾斜</span></button>
                        <button class="focus-toggle-btn" data-view-target="center" title="放大檢視 15.4 吋中控屏">${icon('expand')}</button>
                      </div>
                    </div>
                    <div class="center-tilt-pivot" id="center-tilt-pivot" data-tilt="${tilt}">
                      <div class="physical-bezel bezel-center">
                        <div class="screen-glass-glare"></div>
                        <div class="screen-vignette"></div>
                        <div class="center-screen-grid">
                          <div class="center-left-pane">
                            <canvas id="canvas-center-3d" class="screen-3d-canvas center-3d-canvas"></canvas>
                            <div id="center-left-overlay" class="center-left-overlay"></div>
                            <div id="center-model-loading-overlay" class="model-loading-overlay ${this.glbLoaded ? 'is-loaded' : ''}">
                              <div class="model-loading-content">
                                <div class="model-loading-title">Model 3 3D 數位孿生</div>
                                <div class="model-loading-progress-bar">
                                  <div id="glb-progress-fill" class="progress-fill" style="width: ${this.glbLoaded ? 100 : (this.glbLoadProgress || 0)}%"></div>
                                </div>
                                <div id="glb-progress-text" class="model-loading-status">${this.glbLoaded ? '就緒' : '載入中...'}</div>
                              </div>
                            </div>
                          </div>

                          <div class="center-right-pane">
                            <canvas id="canvas-center-map" class="center-map-canvas"></canvas>
                            <div id="center-right-overlay" class="center-right-overlay"></div>
                          </div>

                          <div id="center-modal-layer" class="center-modal-layer" data-action="close-center-modal"></div>
                          <footer id="center-dock-layer" class="center-dock-bar"></footer>
                        </div>
                      </div>
                    </div>
                  </section>

                  <!-- 右側：副駕娛樂屏 (概念設計，音樂/真實短片/街機，音量與主屏同步) -->
                  <section class="screen-unit unit-passenger" data-screen-id="passenger">
                    <div class="screen-unit-label">
                      <span>副駕娛樂屏 (概念設計)</span>
                      <button class="focus-toggle-btn" data-view-target="passenger" title="放大檢視副駕娛樂屏">${icon('expand')}</button>
                    </div>
                    <div class="physical-bezel bezel-passenger">
                      <div class="screen-glass-glare"></div>
                      <div class="screen-vignette"></div>
                      <div class="passenger-screen-inner">
                        <div id="passenger-header-layer" class="passenger-header-layer"></div>
                        <div id="passenger-main-columns" class="passenger-main-columns">
                          <div class="passenger-left-col">
                            <div class="passenger-stage-wrap">
                              <canvas id="canvas-passenger-visual" class="passenger-visual-canvas"></canvas>
                              <div class="passenger-stage-badge" id="passenger-stage-badge">
                                <span class="stage-rec-dot"></span>
                                <span id="passenger-stage-badge-text">MASTER · FLAC 24-BIT</span>
                              </div>
                            </div>
                            <div id="passenger-controls-layer" class="passenger-controls-layer"></div>
                          </div>
                          <div id="passenger-playlist-layer" class="passenger-playlist-layer"></div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <!-- 座艙前景：駕駛座與副駕跑車桶椅肩部與中控扶手台 (3D Seats & Center Console) -->
              <div class="cockpit-foreground-seats" aria-hidden="true">
                <div class="cabin-seat seat-driver">
                  <div class="seat-headrest"></div>
                  <div class="seat-bolster"></div>
                </div>
                <div class="cabin-center-console">
                  <div class="console-wireless-pad"></div>
                  <div class="console-cupholders"></div>
                </div>
                <div class="cabin-seat seat-passenger">
                  <div class="seat-headrest"></div>
                  <div class="seat-bolster"></div>
                </div>
              </div>
            </div>

            <!-- 端點 1：真實 3D 手機模型（鈦金屬邊框、玻璃反光、靈動島、Home 指示條，可拿起放大到全屏） -->
            <section class="screen-unit unit-mobile" data-screen-id="mobile">
              <div class="screen-unit-label">
                <span>iOS 手機車聯網</span>
                <button class="pickup-phone-btn" data-view-target="mobile" title="拿起手機放大至全屏檢視">
                  ${icon('expand')}<span id="pickup-phone-label">${focused === 'mobile' ? '放回座艙' : '拿起全屏'}</span>
                </button>
              </div>
              <div class="physical-iphone-frame">
                <div class="iphone-side-button btn-vol-up"></div>
                <div class="iphone-side-button btn-vol-down"></div>
                <div class="iphone-side-button btn-power"></div>
                <div class="iphone-dynamic-island">
                  <span class="island-sensor"></span>
                  <span class="island-camera"></span>
                </div>
                <div class="screen-glass-glare"></div>
                <div class="screen-vignette"></div>
                <div class="mobile-screen-inner">
                  <div class="mobile-statusbar">
                    <span class="mobile-time">23:53</span>
                    <div class="mobile-status-icons">
                      <span>5G</span>
                      ${icon('wifi', 'status-mini-icon')}
                      ${icon('battery', 'status-mini-icon')}
                    </div>
                  </div>
                  <div class="mobile-3d-viewport" id="mobile-3d-container">
                    <canvas id="canvas-mobile-3d" class="screen-3d-canvas mobile-canvas"></canvas>
                    <div id="mobile-viewport-badges" class="mobile-viewport-badges"></div>
                  </div>
                  <div id="mobile-ui-layer" class="mobile-ui-layer"></div>
                  <div class="iphone-home-bar"></div>
                </div>
              </div>
            </section>
          </div>

          <!-- 右側可收合側欄：現場演示聯動控制面板 -->
          <aside class="demo-control-sidebar" id="demo-control-sidebar" aria-label="現場演示聯動控制面板">
            <button class="drawer-edge-handle" data-action="toggle-demo-drawer" title="展開/收合控制面板">
              ${icon('chevronLeft', 'handle-chevron')}
              <span>聯動面板</span>
            </button>
            <div class="demo-sidebar-inner">
              <div class="demo-sidebar-header">
                <div>
                  <div class="demo-kicker">MODEL 3 STATE CONTROLLER</div>
                  <h2 class="demo-title">五端同步聯動控制</h2>
                </div>
                <button class="ctrl-btn icon-only" data-action="toggle-demo-drawer" aria-label="收合控制面板">
                  ${icon('close')}
                </button>
              </div>
              <div id="demo-panel-body" class="demo-panel-body"></div>
            </div>
          </aside>
        </main>

        <footer class="cockpit-footer">
          <div class="footer-left">
            <strong>車型：Tesla Model 3</strong> · 單一 Three.js 3D 座艙總覽（15.4" 中控橫屏 + 概念增設 8:3 儀錶盤與副駕娛樂屏 3D 網格 + 擋風玻璃 AR-HUD）
          </div>
          <div class="footer-right">
            <span>3D 模型與來源：<a href="https://sketchfab.com/3d-models/tesla-2018-model-3-5ef9b845aaf44203b6d04e2c677e444f" target="_blank" rel="noopener noreferrer">Tesla Sedans by Ameer Studio (Sketchfab, CC-BY 4.0)</a> · 座艙 3D 結構與程序化短片自繪</span>
          </div>
        </footer>

        <div id="global-toast" class="global-toast" aria-live="polite"></div>
        <div id="modal-portal"></div>
      </div>
    `;
  }

  registerCanvases() {
    this.sceneEngine.registerCanvas('mobile', document.getElementById('canvas-mobile-3d'));
    this.sceneEngine.registerCanvas('center', document.getElementById('canvas-center-3d'));
    this.sceneEngine.registerCanvas('cluster', document.getElementById('canvas-cluster-3d'));
    this.sceneEngine.registerCanvas('hud', document.getElementById('canvas-hud-3d'));
    this.sceneEngine.registerCanvas('windshield', document.getElementById('canvas-windshield-3d'));

    this.mapMediaEngine.registerMapCanvas(document.getElementById('canvas-center-map'));
    this.mapMediaEngine.registerMediaCanvas(document.getElementById('canvas-passenger-visual'));
  }

  /**
   * 綁定座艙總覽 3D 軌道旋轉鏡頭（支援滑鼠拖拽旋轉座艙視角，並保持預設為駕駛位視角）
   */
  bindCockpitOrbitEvents() {
    const stage = document.getElementById('screens-stage');
    if (!stage) return;

    let startX = 0;
    let startY = 0;

    stage.addEventListener('pointerdown', (e) => {
      if (this.store.getState().system.focusedScreen !== 'overview') return;
      // 若點擊在各屏幕內部互動控件或畫布上，不攔截其點擊事件
      if (e.target.closest('button, input, .center-screen-grid, .passenger-screen-inner, .physical-iphone-frame')) {
        return;
      }
      this.cockpitOrbit.dragging = true;
      startX = e.clientX;
      startY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.cockpitOrbit.dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;
      this.cockpitOrbit.yaw = Math.max(-14, Math.min(14, this.cockpitOrbit.yaw + dx * 0.08));
      this.cockpitOrbit.pitch = Math.max(-8, Math.min(8, this.cockpitOrbit.pitch - dy * 0.06));
      this.applyCockpitOrbitTransform();
    });

    window.addEventListener('pointerup', () => {
      this.cockpitOrbit.dragging = false;
    });

    this.applyCockpitOrbitTransform();
  }

  applyCockpitOrbitTransform() {
    const cabin = document.getElementById('cockpit-3d-cabin');
    if (cabin) {
      cabin.style.setProperty('--cabin-yaw', `${this.cockpitOrbit.yaw.toFixed(2)}deg`);
      cabin.style.setProperty('--cabin-pitch', `${this.cockpitOrbit.pitch.toFixed(2)}deg`);
    }
    if (this.sceneEngine && typeof this.sceneEngine.setCockpitOrbit === 'function') {
      this.sceneEngine.setCockpitOrbit(this.cockpitOrbit.yaw, this.cockpitOrbit.pitch);
    }
  }

  syncThemeAndBrightness(state) {
    const theme = state.environment.timeOfDay;
    if (document.documentElement.getAttribute('data-theme') !== theme) {
      document.documentElement.setAttribute('data-theme', theme);
    }
    const shell = document.getElementById('cockpit-shell');
    const tilt = state.environment.centerTilt || 'driver';
    if (shell) {
      shell.setAttribute('data-view', state.system.focusedScreen);
      shell.setAttribute('data-drawer', this.drawerOpen ? 'open' : 'closed');
      shell.setAttribute('data-tilt', tilt);
      shell.style.setProperty('--screen-brightness', (state.environment.screenBrightness / 100).toFixed(2));
    }
    const pivot = document.getElementById('center-tilt-pivot');
    if (pivot) {
      pivot.setAttribute('data-tilt', tilt);
    }
    const tiltLbl = document.getElementById('tilt-status-label');
    if (tiltLbl) {
      const tiltMap = { driver: '向駕駛傾斜', center: '居中平視', passenger: '向副駕傾斜' };
      tiltLbl.textContent = tiltMap[tilt] || '向駕駛傾斜';
    }
    const pickupBtn = document.getElementById('pickup-phone-label');
    if (pickupBtn) {
      pickupBtn.textContent = state.system.focusedScreen === 'mobile' ? '放回座艙' : '拿起全屏';
    }
    document.querySelectorAll('.view-switcher .view-tab').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.viewTarget === state.system.focusedScreen);
    });
  }

  renderAllUILayers() {
    const s = this.store.getState();
    this.syncThemeAndBrightness(s);

    const layers = [
      ['MobileUI', () => this.renderMobileUI(s)],
      ['CenterLeftOverlay', () => this.renderCenterLeftOverlay(s)],
      ['CenterRightOverlay', () => this.renderCenterRightOverlay(s)],
      ['CenterModalLayer', () => this.renderCenterModalLayer(s)],
      ['CenterDock', () => this.renderCenterDock(s)],
      ['PassengerUI', () => this.renderPassengerUI(s)],
      ['ClusterUI', () => this.renderClusterUI(s)],
      ['HudUI', () => this.renderHudUI(s)],
      ['DemoControlPanel', () => this.renderDemoControlPanel(s)],
      ['ToastAndModals', () => this.renderToastAndModals(s)]
    ];
    for (const [name, fn] of layers) {
      try {
        fn();
      } catch (err) {
        console.error(`[CockpitApp] Error rendering ${name}:`, err);
      }
    }
    this.cacheTelemetryNodes();

    // 註冊動態生成的子畫布（手機定位地圖、儀錶盤能耗曲線、中控 360 相機、空調俯視圖、充電曲線、語音聲波）
    const mobMapEl = document.getElementById('canvas-mobile-map');
    if (mobMapEl) this.mapMediaEngine.registerMobileMapCanvas(mobMapEl);

    const energyEl = document.getElementById('canvas-cluster-energy');
    if (energyEl) this.mapMediaEngine.registerClusterEnergyCanvas(energyEl);

    const cam360El = document.getElementById('canvas-center-360');
    if (cam360El) {
      this.mapMediaEngine.registerCamera360Canvas(cam360El);
      if (typeof this.sceneEngine.registerCamera360Canvas === 'function') {
        this.sceneEngine.registerCamera360Canvas(cam360El);
      }
    }

    const climateCabinEl = document.getElementById('canvas-climate-cabin');
    if (climateCabinEl && typeof this.mapMediaEngine.registerClimateCabinCanvas === 'function') {
      this.mapMediaEngine.registerClimateCabinCanvas(climateCabinEl);
    }

    const chargingCurveEl = document.getElementById('canvas-charging-curve');
    if (chargingCurveEl && typeof this.mapMediaEngine.registerChargingCurveCanvas === 'function') {
      this.mapMediaEngine.registerChargingCurveCanvas(chargingCurveEl);
    }

    const voiceWaveEl = document.getElementById('canvas-voice-wave');
    if (voiceWaveEl && typeof this.mapMediaEngine.registerVoiceWaveCanvas === 'function') {
      this.mapMediaEngine.registerVoiceWaveCanvas(voiceWaveEl);
    }
  }

  /**
   * 1. 手機 App (iOS 原生規範：安全區、狀態欄、靈動島、Home 指示條、原生轉場；非 P 擋強制「未上鎖」且不顯示哨兵)
   * 補齊功能：車輛定位地圖、發送目的地到車、行程記錄、預約出發、鑰匙管理、安全與哨兵設置、軟件更新、服務預約
   */
  renderMobileUI(s) {
    const container = document.getElementById('mobile-ui-layer');
    const badgeContainer = document.getElementById('mobile-viewport-badges');
    if (!container) return;

    const rangeKm = this.store.getEstimatedRangeKm();
    const page = s.system.mobileActivePage || 'home';
    const hasOpen = this.store.hasOpenDoorOrTrunk();
    const isParked = s.gear === 'P';

    // 嚴格遵守狀態一致性：非 P 擋行駛時必須顯示「未上鎖」且絕不顯示哨兵膠囊
    if (badgeContainer) {
      const lockText = s.locked ? '已上鎖' : '未上鎖';
      const sentryPillHtml = `<button class="mob-vp-pill ${s.sentryMode && isParked ? 'is-active' : ''}" data-action="toggle-sentry">${isParked ? `哨兵 ${s.sentryMode ? '開啟' : '關閉'}` : '哨兵 待命'}</button>`;

      badgeContainer.innerHTML = `
        <button class="mob-vp-pill ${!s.locked ? 'is-active' : ''}" data-action="toggle-lock" data-live="mob-lock-pill">${lockText}</button>
        ${sentryPillHtml}
        <button class="mob-vp-pill ${s.climate.power ? 'is-active' : ''}" data-action="mobile-climate-quick">車內 ${s.climate.cabinTemp.toFixed(0)}°C</button>
      `;
    }

    const lockCtrl = this.getControlStateAttrs('mob-lock', !s.locked);
    const climateCtrl = this.getControlStateAttrs('mob-precond', s.climate.preconditioning || s.climate.power);
    const frunkQuickCtrl = this.getControlStateAttrs('mob-q-frunk', s.doors.frunk);
    const trunkQuickCtrl = this.getControlStateAttrs('mob-q-trunk', s.doors.trunk);
    const findCtrl = this.getControlStateAttrs('mob-find', s.findMyCarActive);

    let subPageHtml = '';

    if (page === 'home') {
      subPageHtml = `
        <div class="mobile-page page-fade-in">
          <div class="mobile-quick-row">
            <button class="${lockCtrl.className} mobile-circle-btn" data-action="toggle-lock" ${lockCtrl.attrs}>
              ${lockCtrl.isLoading ? icon('spinner') : icon(s.locked ? 'lock' : 'unlock')}
              <span data-live="mob-lock-btn-txt">${s.locked ? '已上鎖' : '未上鎖'}</span>
            </button>
            <button class="${climateCtrl.className} mobile-circle-btn" data-action="toggle-precondition" ${climateCtrl.attrs}>
              ${climateCtrl.isLoading ? icon('spinner') : icon('fan')}
              <span>${s.climate.driverTemp.toFixed(0)}°C</span>
            </button>
            <button class="${frunkQuickCtrl.className} mobile-circle-btn" data-action="toggle-door" data-part="frunk" ${frunkQuickCtrl.attrs}>
              ${frunkQuickCtrl.isLoading ? icon('spinner') : icon('frunk')}
              <span>前備箱</span>
            </button>
            <button class="${trunkQuickCtrl.className} mobile-circle-btn" data-action="toggle-door" data-part="trunk" ${trunkQuickCtrl.attrs}>
              ${trunkQuickCtrl.isLoading ? icon('spinner') : icon('trunk')}
              <span>尾箱</span>
            </button>
            <button class="${findCtrl.className} mobile-circle-btn" data-action="find-my-car" ${findCtrl.attrs}>
              ${findCtrl.isLoading ? icon('spinner') : icon('horn')}
              <span>尋車</span>
            </button>
          </div>

          <div class="mobile-menu-list">
            <button class="mobile-menu-item" data-action="mobile-nav" data-page="location">
              <div class="menu-item-left">
                ${icon('mapPin')}
                <div>
                  <div class="menu-item-title">定位地圖與發送目的地</div>
                  <div class="menu-item-sub">前往 ${s.navigation.destinationName} · 剩餘 <span data-live="mob-rem-km">${s.navigation.remainingKm.toFixed(1)}</span> km</div>
                </div>
              </div>
              ${icon('chevronRight', 'menu-chevron')}
            </button>

            <button class="mobile-menu-item" data-action="mobile-nav" data-page="controls">
              <div class="menu-item-left">
                ${icon('key')}
                <div>
                  <div class="menu-item-title">車控、鑰匙與安全設置</div>
                  <div class="menu-item-sub">${s.locked ? '已上鎖' : '未上鎖'} · ${(Array.isArray(s.keys) ? s.keys : (s.keys?.list || [])).length} 把車鑰匙 · ${isParked ? (s.sentryMode ? '哨兵開啟' : '哨兵待命') : '行駛中'}</div>
                </div>
              </div>
              ${icon('chevronRight', 'menu-chevron')}
            </button>

            <button class="mobile-menu-item" data-action="mobile-nav" data-page="climate">
              <div class="menu-item-left">
                ${icon('calendar')}
                <div>
                  <div class="menu-item-title">溫控與預約出發</div>
                  <div class="menu-item-sub">車內 ${s.climate.cabinTemp.toFixed(0)}°C · 預約 ${s.climate.scheduledDeparture.time} ${s.climate.scheduledDeparture.enabled ? '已啟用' : '關閉'}</div>
                </div>
              </div>
              ${icon('chevronRight', 'menu-chevron')}
            </button>

            <button class="mobile-menu-item" data-action="mobile-nav" data-page="charging">
              <div class="menu-item-left">
                ${icon('bolt')}
                <div>
                  <div class="menu-item-title">充電與行程能耗記錄</div>
                  <div class="menu-item-sub">上限 ${s.charging.limitSoc}% · 近次能耗 ${s.trips.recent[0].avgWhKm} Wh/km</div>
                </div>
              </div>
              ${icon('chevronRight', 'menu-chevron')}
            </button>

            <button class="mobile-menu-item" data-action="mobile-nav" data-page="service">
              <div class="menu-item-left">
                ${icon('wrench')}
                <div>
                  <div class="menu-item-title">軟件更新與服務預約</div>
                  <div class="menu-item-sub">系統 ${s.software?.currentVersion || "v12.8"} · 預約保養</div>
                </div>
              </div>
              ${icon('chevronRight', 'menu-chevron')}
            </button>
          </div>
        </div>
      `;
    } else if (page === 'location') {
      subPageHtml = `
        <div class="mobile-page page-slide-in">
          <div class="mobile-subpage-header">
            <button class="ctrl-btn subpage-back-btn" data-action="mobile-nav" data-page="home">${icon('chevronLeft')}<span>返回</span></button>
            <span class="subpage-title">車輛定位與發送目的地</span>
          </div>
          <div class="mobile-map-box">
            <canvas id="canvas-mobile-map" class="mobile-location-canvas"></canvas>
            <div class="mobile-map-caption" data-action="trigger-nav-voice" style="cursor:pointer;" title="點擊播報當前導航路線">
              <span>${s.navigation.destinationName}</span>
              <span><strong data-live="mob-map-dist">${s.navigation.remainingKm.toFixed(1)}</strong> km · <strong data-live="mob-map-eta">${s.navigation.etaMinutes}</strong> 分</span>
            </div>
          </div>
          <div class="mobile-send-dest-list">
            <div class="sub-section-label">點擊一鍵發送目的地至車機導航</div>
            ${(Array.isArray(DESTINATIONS_CATALOG) ? DESTINATIONS_CATALOG : Object.values(DESTINATIONS_CATALOG || {})).slice(0, 4).map((d) => `
              <button class="ctrl-btn send-dest-row ${s.navigation.destinationId === d.id ? 'is-selected' : ''}" data-action="send-dest-to-car" data-id="${d.id}">
                <div class="send-dest-info">
                  ${icon('mapPin')}
                  <div>
                    <div class="send-dest-name">${d.name}</div>
                    <div class="send-dest-meta">${d.distKm} km · 預計 ${d.etaMin} 分 · 空閒 ${d.available}/${d.total}</div>
                  </div>
                </div>
                <span class="send-action-tag">${icon('send')}<span>發送</span></span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    } else if (page === 'controls') {
      subPageHtml = `
        <div class="mobile-page page-slide-in">
          <div class="mobile-subpage-header">
            <button class="ctrl-btn subpage-back-btn" data-action="mobile-nav" data-page="home">${icon('chevronLeft')}<span>返回</span></button>
            <span class="subpage-title">車控、鑰匙與安全</span>
          </div>
          <div class="mobile-doors-grid">
            <button class="ctrl-btn door-tile-btn ${s.doors.frunk ? 'is-selected' : ''}" data-action="toggle-door" data-part="frunk">
              ${icon('frunk')}<span>前備箱 · ${s.doors.frunk ? '開' : '關'}</span>
            </button>
            <button class="ctrl-btn door-tile-btn ${s.doors.trunk ? 'is-selected' : ''}" data-action="toggle-door" data-part="trunk">
              ${icon('trunk')}<span>尾箱 · ${s.doors.trunk ? '開' : '關'}</span>
            </button>
            <button class="ctrl-btn door-tile-btn ${s.doors.fl ? 'is-selected' : ''}" data-action="toggle-door" data-part="fl">
              ${icon('door')}<span>左前門 · ${s.doors.fl ? '開' : '關'}</span>
            </button>
            <button class="ctrl-btn door-tile-btn ${s.doors.fr ? 'is-selected' : ''}" data-action="toggle-door" data-part="fr">
              ${icon('door')}<span>右前門 · ${s.doors.fr ? '開' : '關'}</span>
            </button>
            <button class="ctrl-btn door-tile-btn ${s.doors.chargePort ? 'is-selected' : ''}" data-action="toggle-door" data-part="chargePort">
              ${icon('chargePort')}<span>充電口 · ${s.doors.chargePort ? '開' : '關'}</span>
            </button>
            <button class="ctrl-btn door-tile-btn ${!s.locked ? 'is-selected' : ''}" data-action="toggle-lock">
              ${icon(s.locked ? 'lock' : 'unlock')}<span>車鎖 · ${s.locked ? '已上鎖' : '未上鎖'}</span>
            </button>
          </div>

          <div class="sub-section-label">安全與哨兵設置</div>
          <div class="mobile-security-row">
            <button class="ctrl-btn ${s.sentryMode && isParked ? 'is-selected' : ''}" data-action="toggle-sentry">
              ${icon('shield')}<span>${isParked ? `哨兵：${s.sentryMode ? '開啟' : '關閉'}` : '行駛中哨兵休眠'}</span>
            </button>
            <button class="ctrl-btn ${s.valetMode ? 'is-selected' : ''}" data-action="toggle-valet">
              ${icon('key')}<span>代客：${s.valetMode ? '開啟' : '關閉'}</span>
            </button>
            <button class="ctrl-btn ${s.speedLimitMode ? 'is-selected' : ''}" data-action="toggle-speed-limit-mode">
              ${icon('steering')}<span>限速模式</span>
            </button>
            <button class="ctrl-btn ${s.pinToDrive ? 'is-selected' : ''}" data-action="toggle-pin-drive">
              ${icon('lock')}<span>PIN 碼駕駛</span>
            </button>
          </div>

          <div class="sub-section-label">數位車鑰匙管理 (${(Array.isArray(s.keys) ? s.keys : (s.keys?.list || [])).length})</div>
          <div class="mobile-key-list">
            ${(Array.isArray(s.keys) ? s.keys : (s.keys?.list || [])).map((k) => `
              <div class="mobile-key-row">
                <div class="key-row-left">
                  ${icon('key')}
                  <div>
                    <div class="key-name">${k.name}</div>
                    <div class="key-meta">${k.role} · ${k.status}</div>
                  </div>
                </div>
                <button class="ctrl-btn key-toggle-pill ${k.active ? 'is-selected' : ''}" data-action="toggle-key-active" data-id="${k.id}">
                  ${k.active ? '啟用中' : '已停用'}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else if (page === 'climate') {
      const cMode = s.climate.mode || 'off';
      const sched = s.climate.scheduledDeparture;
      subPageHtml = `
        <div class="mobile-page page-slide-in">
          <div class="mobile-subpage-header">
            <button class="ctrl-btn subpage-back-btn" data-action="mobile-nav" data-page="home">${icon('chevronLeft')}<span>返回</span></button>
            <span class="subpage-title">溫控與預約出發</span>
          </div>
          <div class="mobile-climate-box">
            <div class="mobile-temp-stepper">
              <button class="ctrl-btn temp-step-btn" data-action="temp-step" data-zone="driver" data-delta="-0.5">-</button>
              <div class="mobile-temp-readout">
                <span class="temp-big">${s.climate.driverTemp.toFixed(1)}°C</span>
                <span class="temp-sub">車內 ${s.climate.cabinTemp.toFixed(0)}°C · 車外 ${s.climate.exteriorTemp.toFixed(0)}°C</span>
              </div>
              <button class="ctrl-btn temp-step-btn" data-action="temp-step" data-zone="driver" data-delta="0.5">+</button>
            </div>
            <div class="mobile-mode-pills">
              <button class="ctrl-btn ${cMode === 'keep' ? 'is-selected' : ''}" data-action="set-climate-mode" data-mode="keep">恆溫</button>
              <button class="ctrl-btn ${cMode === 'dog' ? 'is-selected' : ''}" data-action="set-climate-mode" data-mode="dog">寵物</button>
              <button class="ctrl-btn ${cMode === 'camp' ? 'is-selected' : ''}" data-action="set-climate-mode" data-mode="camp">露營</button>
            </div>
            <div class="mobile-climate-actions">
              <button class="ctrl-btn ${s.climate.power ? 'is-selected' : ''}" data-action="toggle-climate-power">
                ${icon('fan')}<span>${s.climate.power ? '空調開啟' : '空調關閉'}</span>
              </button>
              <button class="ctrl-btn ${s.climate.defrostFront ? 'is-selected' : ''}" data-action="toggle-defrost-front">
                ${icon('wiper')}<span>前擋除霜</span>
              </button>
            </div>

            <div class="sub-section-label">預約出發 (Scheduled Departure)</div>
            <div class="scheduled-departure-card">
              <div class="sched-row">
                <div>
                  <div class="sched-time">${sched.time} 準時出發</div>
                  <div class="sched-desc">自動預熱電池與座艙 · 離峰充電優先</div>
                </div>
                <button class="ctrl-btn ${sched.enabled ? 'is-selected' : ''}" data-action="toggle-scheduled-departure">
                  ${sched.enabled ? '已啟用' : '已關閉'}
                </button>
              </div>
              <div class="sched-sub-toggles">
                <button class="ctrl-btn ${sched.preconditionCabin ? 'is-selected' : ''}" data-action="toggle-sched-cabin">預調溫</button>
                <button class="ctrl-btn ${sched.offPeakCharging ? 'is-selected' : ''}" data-action="toggle-sched-offpeak">離峰充電</button>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (page === 'charging') {
      subPageHtml = `
        <div class="mobile-page page-slide-in">
          <div class="mobile-subpage-header">
            <button class="ctrl-btn subpage-back-btn" data-action="mobile-nav" data-page="home">${icon('chevronLeft')}<span>返回</span></button>
            <span class="subpage-title">充電與行程記錄</span>
          </div>
          <div class="mobile-charging-card">
            <div class="charging-status-row">
              <div>
                <div class="charging-state-label">${s.charging.active ? `超充進行中 · ${s.charging.powerKw} kW` : '未開始充電'}</div>
                <div class="charging-sub-info">上限 <span data-live="charge-limit-txt">${s.charging.limitSoc}</span>% · 預估續航 ${rangeKm} km</div>
              </div>
              <div style="display:flex;gap:4px;">
                <button class="ctrl-btn ${s.doors.chargePort ? 'is-selected' : ''}" data-action="toggle-door" data-part="chargePort">
                  ${icon('chargePort')}<span>${s.doors.chargePort ? '口已開' : '充電口'}</span>
                </button>
                <button class="ctrl-btn ${s.charging.active ? 'is-selected' : ''}" data-action="toggle-charging">
                  ${icon('bolt')}<span>${s.charging.active ? '停止' : '超充'}</span>
                </button>
              </div>
            </div>
            <input type="range" min="50" max="100" step="5" value="${s.charging.limitSoc}" data-action="set-charge-limit" style="width:100%;margin:4px 0;" />
            <div class="charge-preset-row">
              <button class="ctrl-btn ${s.charging.limitSoc === 80 ? 'is-selected' : ''}" data-action="set-charge-preset" data-limit="80">80% 日常</button>
              <button class="ctrl-btn ${s.charging.limitSoc === 90 ? 'is-selected' : ''}" data-action="set-charge-preset" data-limit="90">90% 推薦</button>
              <button class="ctrl-btn ${s.charging.limitSoc === 100 ? 'is-selected' : ''}" data-action="set-charge-preset" data-limit="100">100% 長途</button>
            </div>

            <div class="sub-section-label">近期行程能耗記錄 (點擊載入導航 · 總里程 ${s.trips.odometerKm} km)</div>
            <div class="charging-history-list">
              ${s.trips.recent.map((tr, idx) => `
                <button class="ctrl-btn history-row" data-action="replay-trip" data-idx="${idx}" style="width:100%;justify-content:space-between;text-align:left;">
                  <div>
                    <div class="history-loc">${tr.title}</div>
                    <div class="history-meta">${tr.date} · ${tr.distKm} km · ${tr.durationMin} 分鐘</div>
                  </div>
                  <div class="history-right">
                    <span class="history-kwh">${tr.avgWhKm} Wh/km</span>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else if (page === 'service') {
      const sw = s.software;
      const srv = s.service;
      subPageHtml = `
        <div class="mobile-page page-slide-in">
          <div class="mobile-subpage-header">
            <button class="ctrl-btn subpage-back-btn" data-action="mobile-nav" data-page="home">${icon('chevronLeft')}<span>返回</span></button>
            <span class="subpage-title">軟件更新與服務預約</span>
          </div>
          <div class="mobile-service-box">
            <div class="software-card">
              <div class="sw-head">
                <div>
                  <div class="sw-ver">當前版本 ${sw.currentVersion}</div>
                  <div class="sw-avail">可用更新：<strong>${sw.availableVersion}</strong></div>
                </div>
                <button class="ctrl-btn ${sw.updating ? 'is-selected' : ''}" data-action="trigger-software-update">
                  ${icon('update')}<span>${sw.updating ? `安裝中 ${sw.progress}%` : '立即更新'}</span>
                </button>
              </div>
              <div class="sw-notes">${sw.releaseNotes.join(' · ')}</div>
            </div>

            <div class="sub-section-label">服務中心預約 (${srv.centerName})</div>
            <div class="service-booking-card">
              <div class="srv-status-line">
                <span>${srv.appointmentDate}</span>
                <span class="srv-badge">${srv.status}</span>
              </div>
              <div class="srv-items-list">
                ${srv.items.map((it) => `
                  <button class="ctrl-btn srv-item-btn ${it.selected ? 'is-selected' : ''}" data-action="toggle-service-item" data-id="${it.id}">
                    <span>${it.name}</span>
                    <span>${it.estimate}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const mob3dContainer = document.getElementById('mobile-3d-container');
    if (mob3dContainer) {
      mob3dContainer.classList.toggle('is-subpage-collapsed', page !== 'home');
    }

    const headerSummaryHtml = page === 'home' ? `
      <div class="mobile-header-summary">
        <div class="mobile-car-title-row">
          <div data-action="mobile-nav" data-page="controls" style="cursor:pointer;" title="點擊進入車控與安全設置">
            <h3 class="mobile-car-name">Model 3</h3>
            <div class="mobile-car-status">
              <span data-live="mob-drive-state">${s.displaySpeed > 1 ? `${Math.round(s.displaySpeed)} km/h · ${s.gear} 擋 · 未上鎖` : `已駐停 (${s.gear} 擋) · ${s.locked ? '已上鎖' : '未上鎖'}`}</span>
            </div>
          </div>
          <div class="mobile-battery-block" data-action="mobile-nav" data-page="charging" style="cursor:pointer;" title="點擊進入充電管理">
            <div class="mobile-soc-row">
              <span class="mobile-soc-val" data-live="soc">${Math.round(s.displaySoc)}%</span>
              <span class="mobile-range-val" data-live="range">${rangeKm} km</span>
            </div>
          </div>
        </div>
        <div class="mobile-battery-bar-wrap" data-action="mobile-nav" data-page="charging" style="cursor:pointer;" title="點擊管理充電上限">
          <div class="mobile-battery-bar-fill" data-live="mob-soc-bar" style="width:${Math.round(s.displaySoc)}%"></div>
          <div class="mobile-battery-limit-tick" data-live="mob-limit-tick" style="left:${s.charging.limitSoc}%"></div>
        </div>
      </div>
    ` : `
      <div class="mobile-compact-summary-bar">
        <div class="mcs-left" data-action="mobile-nav" data-page="home" style="cursor:pointer;" title="返回首頁">
          <strong class="mcs-model">Model 3</strong>
          <span class="mcs-divider">·</span>
          <span class="mcs-state" data-live="mob-drive-state">${s.displaySpeed > 1 ? `${Math.round(s.displaySpeed)} km/h · ${s.gear} 擋` : `${s.gear} 擋 · ${s.locked ? '已上鎖' : '未上鎖'}`}</span>
        </div>
        <div class="mcs-right">
          <span class="mcs-temp">${s.climate.cabinTemp.toFixed(0)}°C</span>
          <span class="mcs-soc" data-live="soc">${Math.round(s.displaySoc)}%</span>
          <span class="mcs-range" data-live="range">(${rangeKm}km)</span>
        </div>
      </div>
    `;

    container.innerHTML = `
      ${headerSummaryHtml}
      ${subPageHtml}
      <nav class="mobile-bottom-tabs" aria-label="手機功能分頁">
        <button class="mobile-tab-btn ${page === 'home' ? 'is-active' : ''}" data-action="mobile-nav" data-page="home">${icon('grid')}<span>首頁</span></button>
        <button class="mobile-tab-btn ${page === 'location' ? 'is-active' : ''}" data-action="mobile-nav" data-page="location">${icon('mapPin')}<span>定位</span></button>
        <button class="mobile-tab-btn ${page === 'controls' ? 'is-active' : ''} ${hasOpen ? 'has-dot' : ''}" data-action="mobile-nav" data-page="controls">${icon('key')}<span>車控</span></button>
        <button class="mobile-tab-btn ${page === 'climate' ? 'is-active' : ''}" data-action="mobile-nav" data-page="climate">${icon('fan')}<span>溫控</span></button>
        <button class="mobile-tab-btn ${page === 'charging' ? 'is-active' : ''}" data-action="mobile-nav" data-page="charging">${icon('bolt')}<span>充電</span></button>
        <button class="mobile-tab-btn ${page === 'service' ? 'is-active' : ''}" data-action="mobile-nav" data-page="service">${icon('wrench')}<span>服務</span></button>
      </nav>
    `;
  }

  /**
   * 2. 中控駕駛屏 (17 吋 2200:1300 橫屏) — 左側 ADAS 視圖與緊湊圖標按鈕列（車門/前備箱/尾箱/充電口絕不與音樂卡重疊）
   */
  renderCenterLeftOverlay(s) {
    const container = document.getElementById('center-left-overlay');
    if (!container) return;

    const rangeKm = this.store.getEstimatedRangeKm();
    const activeTrack = s.media.tracks[s.media.trackIndex] || s.media.tracks[0];

    const doorFlBtn = this.getControlStateAttrs('cnt-fl', s.doors.fl);
    const frunkBtn = this.getControlStateAttrs('cnt-frunk', s.doors.frunk);
    const trunkBtn = this.getControlStateAttrs('cnt-trunk', s.doors.trunk);
    const portBtn = this.getControlStateAttrs('cnt-port', s.doors.chargePort);
    const lockBtn = this.getControlStateAttrs('cnt-lock', !s.locked);

    const leftTurnOn = (s.lights.turnSignal === 'left' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;
    const rightTurnOn = (s.lights.turnSignal === 'right' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;
    const leadDistInt = Math.round(s.driveMode.displayLeadDistanceM);

    container.innerHTML = `
      <div class="center-gear-strip" role="group" aria-label="擋位切換">
        ${['P', 'R', 'N', 'D'].map((g) => {
          const gCtrl = this.getControlStateAttrs(`gear-${g}`, s.gear === g, s.charging.active && g !== 'P', '充電中鎖定於 P 擋');
          return `
            <button class="${gCtrl.className} gear-pill ${s.gear === g ? 'is-active-gear' : ''}" data-action="set-gear" data-gear="${g}" ${gCtrl.attrs}>
              ${gCtrl.isLoading ? icon('spinner') : g}
            </button>
          `;
        }).join('')}
      </div>

      <div class="center-driving-hud">
        <div class="center-top-status">
          <button class="${lockBtn.className} status-icon-btn" data-action="toggle-lock" title="${s.locked ? '已上鎖' : '未上鎖'}">
            ${lockBtn.isLoading ? icon('spinner') : icon(s.locked ? 'lock' : 'unlock')}
            <span class="status-lock-txt" data-live="center-lock-txt">${s.locked ? '已上鎖' : '未上鎖'}</span>
          </button>
          <button class="status-pill-btn battery-text" data-action="open-center-modal" data-modal="charging" title="點擊打開充電管理">
            <strong data-live="center-soc">${Math.round(s.displaySoc)}%</strong><span class="center-range-ext"> · <span data-live="center-range">${rangeKm}</span> km</span>
          </button>
          <div class="center-telltale-row">
            <button class="turn-arrow-badge ${leftTurnOn ? 'is-blinking' : ''}" data-action="set-turn-signal" data-dir="left" data-live="center-turn-left" title="切換左轉向燈">◀</button>
            <button class="beam-badge ${s.lights.highBeam ? 'is-high' : (s.lights.lowBeam ? 'is-low' : '')}" data-action="cycle-light-beam" title="點擊切換車燈模式">
              ${s.lights.highBeam ? '遠光' : (s.lights.lowBeam ? '近光' : '燈關')}
            </button>
            <button class="turn-arrow-badge ${rightTurnOn ? 'is-blinking' : ''}" data-action="set-turn-signal" data-dir="right" data-live="center-turn-right" title="切換右轉向燈">▶</button>
          </div>
          <button class="status-pill-btn status-clock" data-action="open-center-modal" data-modal="settings" data-tab="schedule" title="點擊開啟預約出發日程">23:53</button>
        </div>

        <div class="center-power-meter">
          <div class="power-bar-regen" data-live="center-regen-bar" style="width:0%"></div>
          <div class="power-bar-drive" data-live="center-drive-bar" style="width:12%"></div>
        </div>

        <div class="center-speed-row">
          <div class="speed-display-block">
            <div class="center-speed-num" data-live="center-speed" data-action="toggle-cruise-demo" style="cursor:pointer;" title="點擊切換巡航車速">${Math.round(s.displaySpeed)}</div>
            <div class="center-speed-unit" data-action="cycle-follow-dist" style="cursor:pointer;" title="點擊調整跟車距離檔位">km/h · 前車 <strong data-live="center-lead-dist">${leadDistInt}</strong> m</div>
          </div>

          <div class="adas-badges-col">
            <button class="speed-limit-sign" data-action="sync-speed-limit" title="點擊切換道路限速並同步巡航設定">${s.driveMode.speedLimit}</button>
            <button class="autopilot-badge ${s.driveMode.autopilot ? 'is-on' : ''}" data-action="toggle-autopilot" title="切換自動輔助轉向">
              ${icon('steering')}
              <span>${s.driveMode.autopilot ? `${s.driveMode.setSpeed}` : '手動'}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 底部固定雙層區：上方為「車門 / 前備箱 / 尾箱 / 充電口」緊湊圖標按鈕列，下方為獨立音樂卡，結構分離絕不重疊 -->
      <div class="center-bottom-dock-stack">
        <div class="center-compact-icon-row" role="group" aria-label="車門與前備箱尾箱充電口緊湊圖標列">
          <button class="${doorFlBtn.className} compact-icon-btn ${s.doors.fl ? 'is-selected' : ''}" data-action="toggle-door" data-part="fl" ${doorFlBtn.attrs}>
            ${icon('door')}
            <span>車門</span>
          </button>
          <button class="${frunkBtn.className} compact-icon-btn ${s.doors.frunk ? 'is-selected' : ''}" data-action="toggle-door" data-part="frunk" ${frunkBtn.attrs}>
            ${icon('frunk')}
            <span>前備箱</span>
          </button>
          <button class="${trunkBtn.className} compact-icon-btn ${s.doors.trunk ? 'is-selected' : ''}" data-action="toggle-door" data-part="trunk" ${trunkBtn.attrs}>
            ${icon('trunk')}
            <span>尾箱</span>
          </button>
          <button class="${portBtn.className} compact-icon-btn ${s.doors.chargePort ? 'is-selected' : ''}" data-action="toggle-door" data-part="chargePort" ${portBtn.attrs}>
            ${icon('chargePort')}
            <span>充電口</span>
          </button>
        </div>

        <div class="center-mini-media-card">
          <div class="mini-media-info" data-action="cycle-media-source" style="cursor:pointer;" title="點擊切換音訊來源 (音樂 / 劇院短片)">
            <div class="mini-album-dot" style="background:${s.media.activeTab === 'video' ? '#1e3a8a' : ((activeTrack.palette && activeTrack.palette[0]) || '#1e293b')}">
              ${icon(s.media.activeTab === 'video' ? 'video' : 'music')}
            </div>
            <div class="mini-track-text">
              <div class="mini-track-title">${s.media.activeTab === 'video' ? (s.media.videos[s.media.videoIndex]?.title || activeTrack.title) : activeTrack.title}</div>
              <div class="mini-track-artist">${s.media.activeTab === 'video' ? (s.media.videos[s.media.videoIndex]?.channel || activeTrack.artist) : activeTrack.artist}</div>
            </div>
          </div>
          <div class="mini-media-btns">
            <button class="ctrl-btn icon-only" data-action="${s.media.activeTab === 'video' ? 'video-prev' : 'media-prev'}" aria-label="上一首">${icon('prev')}</button>
            <button class="ctrl-btn icon-only ${(s.media.activeTab === 'video' ? s.media.videoPlaying : s.media.playing) ? 'is-selected' : ''}" data-action="${s.media.activeTab === 'video' ? 'toggle-video-play' : 'media-toggle'}" aria-label="播放/暫停">
              ${icon((s.media.activeTab === 'video' ? s.media.videoPlaying : s.media.playing) ? 'pause' : 'play')}
            </button>
            <button class="ctrl-btn icon-only" data-action="${s.media.activeTab === 'video' ? 'video-next' : 'media-next'}" aria-label="下一首">${icon('next')}</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 中控右側地圖浮層：轉向圖標與文字方向 100% 同步 + 目的地搜尋 + 路線選擇（最快 / 節能 / 景觀）
   */
  renderCenterRightOverlay(s) {
    const container = document.getElementById('center-right-overlay');
    if (!container) return;

    const nav = s.navigation;
    const turnIconName = this.store.getTurnIconName();
    const turnDirLabel = this.store.getTurnDirectionLabel();

    container.innerHTML = `
      <div class="center-nav-card">
        <!-- 頂部搜尋與路線選擇觸發列 -->
        <div class="nav-search-trigger-row">
          <button class="ctrl-btn nav-search-bar-btn" data-action="open-center-modal" data-modal="search">
            ${icon('search')}
            <span>${nav.destinationName}</span>
          </button>
          <button class="ctrl-btn nav-route-opt-btn ${nav.routeSelectorOpen ? 'is-selected' : ''}" data-action="toggle-route-selector" title="切換路線偏好">
            ${icon('navigation')}
            <span>${nav.selectedRouteOption === 'eco' ? '節能' : (nav.selectedRouteOption === 'scenic' ? '景觀' : '最快')}</span>
          </button>
        </div>

        ${nav.routeSelectorOpen ? `
          <div class="nav-route-options-bar">
            ${(Array.isArray(nav.routeOptions) ? nav.routeOptions : []).map((ro) => `
              <button class="ctrl-btn route-opt-chip ${nav.selectedRouteOption === ro.id ? 'is-selected' : ''}" data-action="select-route-option" data-opt="${ro.id}">
                <span>${ro.label}</span>
                <small>${ro.tag}</small>
              </button>
            `).join('')}
          </div>
        ` : ''}

        <!-- 轉向圖標與方向文字 100% 一致（點擊可觸發語音導航播報） -->
        <div class="nav-maneuver-row" data-action="trigger-nav-voice" style="cursor:pointer;" title="點擊播報路口導航語音">
          <div class="nav-turn-icon-box" data-live="center-turn-icon">
            ${icon(turnIconName)}
          </div>
          <div class="nav-maneuver-text">
            <div class="nav-turn-dist">
              <strong data-live="center-turn-dir">${turnDirLabel}</strong> · <span data-live="center-turn-dist">${Math.round(nav.nextTurnDistanceM)}</span> m
            </div>
            <div class="nav-turn-street" data-live="center-turn-street">${nav.nextTurnStreet}</div>
          </div>
        </div>

        <div class="nav-trip-summary">
          <div class="nav-stat" data-action="toggle-route-selector" style="cursor:pointer;" title="點擊展開路線偏好">
            <span class="nav-stat-val"><span data-live="center-eta">${nav.etaMinutes}</span> 分</span>
            <span class="nav-stat-label">剩餘時間</span>
          </div>
          <div class="nav-stat" data-action="toggle-route-selector" style="cursor:pointer;" title="點擊展開路線偏好">
            <span class="nav-stat-val"><span data-live="center-rem-km">${nav.remainingKm.toFixed(1)}</span> km</span>
            <span class="nav-stat-label">剩餘距離</span>
          </div>
          <div class="nav-stat" data-action="open-center-modal" data-modal="charging" style="cursor:pointer;" title="點擊檢視充電管理">
            <span class="nav-stat-val">${nav.arrivalSoc}%</span>
            <span class="nav-stat-label">抵達電量</span>
          </div>
        </div>

        <div class="nav-dest-chips">
          ${(Array.isArray(DESTINATIONS_CATALOG) ? DESTINATIONS_CATALOG : Object.values(DESTINATIONS_CATALOG || {})).slice(0, 4).map((d) => `
            <button class="nav-dest-chip ${nav.destinationId === d.id ? 'is-active' : ''}" data-action="select-destination" data-id="${d.id}">
              ${d.name.replace('超充站', '')}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="center-map-toolbar">
        <button class="ctrl-btn map-tool-btn ${nav.trafficLayer ? 'is-selected' : ''}" data-action="toggle-map-traffic" title="路況圖層">
          <span>路況</span>
        </button>
        <button class="ctrl-btn map-tool-btn ${nav.superchargerLayer ? 'is-selected' : ''}" data-action="toggle-map-sc" title="超充站圖層">
          <span>超充</span>
        </button>
        <button class="ctrl-btn map-tool-btn" data-action="map-zoom" data-delta="0.15" title="放大地圖">+</button>
        <button class="ctrl-btn map-tool-btn" data-action="map-zoom" data-delta="-0.15" title="縮小地圖">-</button>
        <button class="ctrl-btn map-tool-btn" data-action="reset-map-view" title="地圖回中">
          <span>回中</span>
        </button>
      </div>
    `;
  }

  /**
   * 中控屏彈出模態層：
   * 支援：1. 完整 7 大設置頁（顯示、燈光、鎖車、輔助駕駛、安全、日程、服務）
   *       2. 應用列表 (Apps)
   *       3. 目的地搜尋與路線選擇 (Search)
   *       4. 充電頁 (Charging)
   *       5. 360 度環視相機 (Camera360)
   *       6. 電話與藍牙 (Phone)
   *       7. 語音控制 (Voice)
   *       8. 雙溫區空調 (Climate)
   */
  renderCenterModalLayer(s) {
    const container = document.getElementById('center-modal-layer');
    if (!container) return;

    const modal = s.system.centerActiveModal;
    if (!modal) {
      container.innerHTML = '';
      container.classList.remove('is-open');
      return;
    }

    container.classList.add('is-open');

    // 1. 應用中心（全屏頁：真正的獨立車載應用格 + 右側即時應用工作台，不重複底部 Dock 項目）
    if (modal === 'apps') {
      const activeApp = s.appsCenter?.activeSubApp || 'energy';
      const appItems = [
        { id: 'music', iconName: 'music', label: '音樂廳', desc: 'Hi-Res 無損串流 · 10 首精選母帶', badge: '24-Bit' },
        { id: 'theater', iconName: 'video', label: '劇院影片', desc: '4K HDR 車載劇院 · 9 部紀錄短片', badge: '4K HDR' },
        { id: 'arcade', iconName: 'gamepad', label: '街機遊戲', desc: '首都高 C1 賽車 · 實時碰撞計分', badge: '60 FPS' },
        { id: 'browser', iconName: 'globe', label: '車載瀏覽器', desc: '路況資訊 · 超充站點與充電網路', badge: '5G 連線' },
        { id: 'calendar', iconName: 'calendar', label: '行程日曆', desc: '今日商務行程 · 一鍵發起車機導航', badge: '4 項行程' },
        { id: 'energy', iconName: 'chart', label: '能耗分析', desc: '實時 Wh/km 曲線 · 能耗分佈與預測', badge: `${s.trips.tripAWhKm} Wh/km` },
        { id: 'dashcam', iconName: 'dashcam', label: '哨兵回放', desc: '四路環視行車記錄 · 哨兵事件回看', badge: '4 路鏡頭' },
        { id: 'toybox', iconName: 'sparkles', label: '玩具箱', desc: '浪漫壁爐 · 彩虹賽道 · 燈光秀展演', badge: '彩蛋' }
      ];

      let subAppBody = '';
      if (activeApp === 'calendar') {
        const agenda = s.appsCenter?.calendarEvents || [];
        subAppBody = `
          <div class="app-workspace-card">
            <div class="app-ws-header">
              <div>
                <h5>今日同步行程日曆 (2026年10月19日)</h5>
                <p>點擊任一行程即可直接將地點載入中控與 HUD 導航</p>
              </div>
              <span class="ws-status-pill">已同步 iPhone 日曆</span>
            </div>
            <div class="calendar-events-grid">
              ${agenda.map((ev) => `
                <div class="calendar-event-card">
                  <div class="cal-time-badge">${ev.time}</div>
                  <div class="cal-event-main">
                    <div class="cal-event-title">${ev.title}</div>
                    <div class="cal-event-loc">${icon('mapPin')}<span>${ev.loc}</span> · <small>${ev.tag}</small></div>
                  </div>
                  <button class="ctrl-btn is-selected" data-action="select-destination" data-id="${ev.destId}">
                    ${icon('navigation')}<span>導航前往</span>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else if (activeApp === 'browser') {
        const topic = s.appsCenter?.browserTopic || 'supercharger';
        subAppBody = `
          <div class="app-workspace-card">
            <div class="browser-toolbar">
              <div class="browser-url-bar">
                ${icon('globe')}
                <span>https://portal.tesla.co.jp/model3/${topic}</span>
              </div>
              <div class="segmented-group">
                <button class="ctrl-btn ${topic === 'supercharger' ? 'is-selected' : ''}" data-action="set-browser-topic" data-topic="supercharger">東京超充網路</button>
                <button class="ctrl-btn ${topic === 'traffic' ? 'is-selected' : ''}" data-action="set-browser-topic" data-topic="traffic">首都高即時路況</button>
                <button class="ctrl-btn ${topic === 'manual' ? 'is-selected' : ''}" data-action="set-browser-topic" data-topic="manual">Model 3 車主手冊</button>
              </div>
            </div>
            <div class="browser-content-grid">
              <div class="browser-info-tile">
                <h6>六本木ヒルズ V4 超充站</h6>
                <p>距離 1.8 km · 8 座 250kW 超充樁 · 當前空閒 5/8 位，無需排隊。</p>
                <button class="ctrl-btn is-selected" data-action="select-destination" data-id="sc-roppongi">設為導航目的地</button>
              </div>
              <div class="browser-info-tile">
                <h6>首都高速都心環狀線 (C1) 路況</h6>
                <p>芝公園至谷町 JCT 路段雙向暢通，平均時速 68 km/h，無施工管制。</p>
                <button class="ctrl-btn" data-action="toggle-map-traffic">切換路況圖層</button>
              </div>
              <div class="browser-info-tile">
                <h6>Model 3 熱泵與電池預熱指南</h6>
                <p>導航前往超級充電站時，車輛會自動啟動高壓電池預熱以縮短 20% 充電時間。</p>
                <button class="ctrl-btn" data-action="open-center-modal" data-modal="charging">查看充電曲線</button>
              </div>
            </div>
          </div>
        `;
      } else if (activeApp === 'toybox') {
        const tbMode = s.appsCenter?.toyboxMode || 'campfire';
        subAppBody = `
          <div class="app-workspace-card">
            <div class="app-ws-header">
              <div>
                <h5>Tesla 玩具箱與座艙氛圍特效</h5>
                <p>切換座艙彩蛋模式，聯動空調溫度與環艙氛圍燈效</p>
              </div>
              <span class="ws-status-pill">當前特效：${tbMode === 'campfire' ? '浪漫壁爐' : (tbMode === 'rainbow' ? '彩虹賽道' : '節日燈光秀')}</span>
            </div>
            <div class="toybox-modes-grid">
              <button class="ctrl-btn toybox-card ${tbMode === 'campfire' ? 'is-selected' : ''}" data-action="set-toybox-mode" data-mode="campfire">
                <strong>浪漫壁爐模式</strong>
                <span>開啟座艙暖風與琥珀色木柴火光音效</span>
              </button>
              <button class="ctrl-btn toybox-card ${tbMode === 'rainbow' ? 'is-selected' : ''}" data-action="set-toybox-mode" data-mode="rainbow">
                <strong>彩虹車道視覺</strong>
                <span>輔助駕駛車道光毯切換為全彩光譜效果</span>
              </button>
              <button class="ctrl-btn toybox-card ${tbMode === 'lightshow' ? 'is-selected' : ''}" data-action="set-toybox-mode" data-mode="lightshow">
                <strong>車外交響燈光秀</strong>
                <span>駐停時聯動矩陣大燈、尾燈與車窗律動</span>
              </button>
            </div>
          </div>
        `;
      } else if (activeApp === 'dashcam') {
        subAppBody = `
          <div class="app-workspace-card">
            <div class="app-ws-header">
              <div>
                <h5>哨兵模式與四路行車記錄儀回放</h5>
                <p>自動保存緊急制動與駐停靠近事件，點擊可切換至 360° 實時四路鏡頭</p>
              </div>
              <button class="ctrl-btn is-selected" data-action="open-center-modal" data-modal="camera360">
                ${icon('camera')}<span>開啟 360° 實時鏡頭</span>
              </button>
            </div>
            <div class="calendar-events-grid">
              <div class="calendar-event-card">
                <div class="cal-time-badge">今日 22:14</div>
                <div class="cal-event-main">
                  <div class="cal-event-title">六本木地下停車場 · 哨兵感知記錄</div>
                  <div class="cal-event-loc">前視 + 右葉子板鏡頭 · 行人靠近自動錄影 (00:45)</div>
                </div>
                <button class="ctrl-btn" data-action="open-center-modal" data-modal="camera360">查看四路畫面</button>
              </div>
              <div class="calendar-event-card">
                <div class="cal-time-badge">今日 19:30</div>
                <div class="cal-event-main">
                  <div class="cal-event-title">首都高灣岸線 · 行車記錄片段</div>
                  <div class="cal-event-loc">四路 1080p 同步循環錄影 · 已加密儲存於隨身碟</div>
                </div>
                <button class="ctrl-btn" data-action="open-center-modal" data-modal="camera360">查看四路畫面</button>
              </div>
            </div>
          </div>
        `;
      } else {
        // 預設：能耗分析 + 媒體快捷聯動工作台
        const lastWh = s.energyHistory[s.energyHistory.length - 1] || 152;
        subAppBody = `
          <div class="app-workspace-card">
            <div class="app-ws-header">
              <div>
                <h5>Model 3 實時能耗監測與子系統分佈</h5>
                <p>過去 30 公里實時能耗波動與高壓電池分項佔比</p>
              </div>
              <span class="ws-status-pill">當前瞬時：${lastWh} Wh/km</span>
            </div>
            <div class="energy-breakdown-grid">
              <div class="energy-stat-box">
                <span>電驅動系統</span>
                <strong>74.2%</strong>
                <small>雙電機全輪驅動 · 能量回收已優化 +14%</small>
              </div>
              <div class="energy-stat-box">
                <span>雙溫區熱泵空調</span>
                <strong>12.8%</strong>
                <small>設定 ${s.climate.driverTemp.toFixed(1)}°C / ${s.climate.passengerTemp.toFixed(1)}°C · 餘熱回收中</small>
              </div>
              <div class="energy-stat-box">
                <span>低壓電子與座艙娛樂</span>
                <strong>8.4%</strong>
                <small>中控 + 副駕娛樂屏 + 15 揚聲器音響</small>
              </div>
              <div class="energy-stat-box">
                <span>電池熱管理系統</span>
                <strong>4.6%</strong>
                <small>電芯溫度 29°C · 處於最佳放電區間</small>
              </div>
            </div>
          </div>
        `;
      }

      container.innerHTML = `
        <div class="center-popover center-fullscreen-page apps-fullscreen-page" onclick="event.stopPropagation()">
          <header class="popover-header">
            <div class="popover-title-group">
              ${icon('apps')}
              <h4>Model 3 車載應用中心 (Application Launcher)</h4>
              <span class="popover-sub">獨立應用程式矩陣 · 點擊圖標切換功能或同步副駕娛樂屏</span>
            </div>
            <button class="ctrl-btn icon-only" data-action="close-center-modal">${icon('close')}</button>
          </header>
          <div class="apps-fullscreen-body">
            <div class="apps-grid-8">
              ${appItems.map((ap) => `
                <button class="ctrl-btn app-launcher-tile ${activeApp === ap.id ? 'is-selected' : ''}" data-action="open-sub-app" data-app="${ap.id}">
                  <div class="app-tile-top">
                    <div class="app-tile-icon">${icon(ap.iconName)}</div>
                    <span class="app-tile-badge">${ap.badge}</span>
                  </div>
                  <div class="app-tile-text">
                    <span class="app-tile-label">${ap.label}</span>
                    <small class="app-tile-desc">${ap.desc}</small>
                  </div>
                </button>
              `).join('')}
            </div>
            ${subAppBody}
          </div>
        </div>
      `;
      return;
    }

    // 2. 搜尋與導航路線頁（全屏頁）
    if (modal === 'search') {
      const q = (s.navigation.searchQuery || '').trim().toLowerCase();
      const catalog = Array.isArray(DESTINATIONS_CATALOG) ? DESTINATIONS_CATALOG : Object.values(DESTINATIONS_CATALOG || {});
      const filtered = catalog.filter((d) => !q || d.name.toLowerCase().includes(q) || d.area.toLowerCase().includes(q));
      container.innerHTML = `
        <div class="center-popover center-fullscreen-page search-popover" onclick="event.stopPropagation()">
          <header class="popover-header">
            <div class="popover-title-group">
              ${icon('search')}
              <h4>目的地搜尋與東京超充路線規劃</h4>
              <span class="popover-sub">當前導航：${s.navigation.destinationName} · 剩餘 ${s.navigation.remainingKm.toFixed(1)} km</span>
            </div>
            <button class="ctrl-btn icon-only" data-action="close-center-modal">${icon('close')}</button>
          </header>
          <div class="search-modal-body">
            <div class="search-input-row">
              ${icon('search')}
              <input type="text" class="center-search-input" placeholder="輸入東京超充站、商圈或地標名稱..." value="${s.navigation.searchQuery || ''}" data-action="nav-search-input" />
              <div class="route-pref-pills">
                ${(Array.isArray(s.navigation.routeOptions) ? s.navigation.routeOptions : []).map((ro) => `
                  <button class="ctrl-btn ${s.navigation.selectedRouteOption === ro.id ? 'is-selected' : ''}" data-action="select-route-option" data-opt="${ro.id}">
                    ${ro.label} (${ro.tag})
                  </button>
                `).join('')}
              </div>
            </div>
            <div class="search-results-grid">
              ${filtered.map((d) => `
                <button class="ctrl-btn search-dest-card ${s.navigation.destinationId === d.id ? 'is-selected' : ''}" data-action="select-destination" data-id="${d.id}">
                  <div class="s-dest-left">
                    ${icon('mapPin')}
                    <div>
                      <div class="s-dest-title">${d.name}</div>
                      <div class="s-dest-sub">${d.area} · 峰值 ${d.powerKw} kW · 空閒樁位 ${d.available}/${d.total}</div>
                    </div>
                  </div>
                  <div class="s-dest-right">
                    <strong>${d.distKm} km</strong>
                    <span>預計 ${d.etaMin} 分鐘</span>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      return;
    }

    // 3. 充電管理全屏頁（電量環 + 250kW 充電功率曲線 + 附近超充站列表［距離/空位/功率］+ 預計完成時間）
    if (modal === 'charging') {
      const soc = Math.round(s.displaySoc);
      const limit = s.charging.limitSoc;
      const rangeKm = this.store.getEstimatedRangeKm();
      const radius = 58;
      const circum = 2 * Math.PI * radius;
      const socOffset = circum * (1 - soc / 100);
      const limitAngle = (limit / 100) * 360 - 90;
      const limitRad = (limitAngle * Math.PI) / 180;
      const lx = 72 + Math.cos(limitRad) * radius;
      const ly = 72 + Math.sin(limitRad) * radius;

      const catalog = Array.isArray(DESTINATIONS_CATALOG) ? DESTINATIONS_CATALOG : Object.values(DESTINATIONS_CATALOG || {});
      const remainMin = Math.max(5, Math.round(Math.max(0, limit - soc) * 1.4));
      const finishHour = 23;
      const finishMin = (53 + remainMin) % 60;
      const finishDay = 53 + remainMin >= 60 ? '次日 00' : String(finishHour).padStart(2, '0');
      const finishTimeStr = `${finishDay}:${String(finishMin).padStart(2, '0')}`;

      container.innerHTML = `
        <div class="center-popover center-fullscreen-page charging-fullscreen-page" onclick="event.stopPropagation()">
          <header class="popover-header">
            <div class="popover-title-group">
              ${icon('bolt')}
              <h4>Model 3 高壓電池與超級充電管理</h4>
              <span class="popover-sub">當前電量 ${soc}% · 預估續航 ${rangeKm} km · 預計完成時間 ${finishTimeStr} (約 ${remainMin} 分鐘)</span>
            </div>
            <button class="ctrl-btn icon-only" data-action="close-center-modal">${icon('close')}</button>
          </header>

          <div class="charging-fullscreen-grid">
            <!-- 左欄：電量環 + 預計完成時間 + 充電上限與充電口控制 -->
            <div class="charging-left-panel">
              <div class="soc-ring-card">
                <div class="soc-ring-svg-wrap">
                  <svg class="soc-ring-svg" viewBox="0 0 144 144">
                    <circle cx="72" cy="72" r="${radius}" fill="none" stroke="rgba(148,163,184,0.16)" stroke-width="12" />
                    <circle cx="72" cy="72" r="${radius}" fill="none" stroke="#10b981" stroke-width="12" stroke-linecap="round"
                      stroke-dasharray="${circum.toFixed(1)}" stroke-dashoffset="${socOffset.toFixed(1)}" transform="rotate(-90 72 72)" />
                    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="5" fill="#38bdf8" stroke="#0b101b" stroke-width="2" />
                  </svg>
                  <div class="soc-ring-center">
                    <strong class="soc-ring-num">${soc}%</strong>
                    <span class="soc-ring-km">${rangeKm} km</span>
                  </div>
                </div>
                <div class="soc-ring-meta">
                  <div class="soc-meta-row"><span>充電狀態</span><strong>${s.charging.active ? `超充進行中 · ${s.charging.powerKw} kW` : '待命 · 已連接電池熱管理'}</strong></div>
                  <div class="soc-meta-row"><span>充電上限</span><strong data-live="charge-limit-txt">${limit}%</strong></div>
                  <div class="soc-meta-row"><span>預計完成時間</span><strong>${finishTimeStr} (剩餘 ${remainMin} 分鐘)</strong></div>
                  <div class="soc-meta-row"><span>電池包溫度 / 電壓</span><strong>29.4°C · 388 V</strong></div>
                </div>
              </div>

              <div class="charging-limit-card">
                <div class="settings-label">充電上限設定 (${limit}%)</div>
                <input type="range" min="50" max="100" step="5" value="${limit}" data-action="set-charge-limit" />
                <div class="segmented-group" style="margin-top:8px;">
                  <button class="ctrl-btn ${limit === 80 ? 'is-selected' : ''}" data-action="set-charge-preset" data-limit="80">80% 日常通勤</button>
                  <button class="ctrl-btn ${limit === 90 ? 'is-selected' : ''}" data-action="set-charge-preset" data-limit="90">90% 推薦上限</button>
                  <button class="ctrl-btn ${limit === 100 ? 'is-selected' : ''}" data-action="set-charge-preset" data-limit="100">100% 長途出行</button>
                </div>
                <div class="segmented-group" style="margin-top:8px;">
                  <button class="ctrl-btn ${s.doors.chargePort ? 'is-selected' : ''}" data-action="toggle-door" data-part="chargePort">
                    ${icon('chargePort')}<span>${s.doors.chargePort ? '充電口蓋已開啟' : '打開充電口蓋'}</span>
                  </button>
                  <button class="ctrl-btn ${s.charging.active ? 'is-selected' : ''}" data-action="toggle-charging">
                    ${icon('bolt')}<span>${s.charging.active ? '停止超級充電' : '開始模擬超充'}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 右欄：V3 250kW 充電功率曲線畫布 + 附近超充站列表 -->
            <div class="charging-right-panel">
              <div class="charging-curve-card">
                <canvas id="canvas-charging-curve" class="charging-curve-canvas"></canvas>
              </div>
              <div class="nearby-sc-card">
                <div class="settings-label">附近 Tesla 超級充電站列表（點擊直接導航並預熱電池）</div>
                <div class="nearby-sc-list">
                  ${catalog.map((d) => `
                    <button class="ctrl-btn nearby-sc-row ${s.navigation.destinationId === d.id ? 'is-selected' : ''}" data-action="select-destination" data-id="${d.id}">
                      <div class="sc-row-left">
                        <span class="sc-power-pill">${d.powerKw} kW</span>
                        <div>
                          <div class="sc-row-title">${d.name}</div>
                          <div class="sc-row-sub">${d.area} · 預計行駛 ${d.etaMin} 分鐘</div>
                        </div>
                      </div>
                      <div class="sc-row-right">
                        <span class="sc-stall-badge">空位 ${d.available}/${d.total}</span>
                        <strong class="sc-dist-txt">${d.distKm} km</strong>
                      </div>
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // 4. 360° 環視相機全屏頁（使用實際 3D 車身從前、後、左、右葉子板四個虛擬機位 + 右側 3D 俯視車身與障礙物距離渲染）
    if (modal === 'camera360') {
      const activeCam = s.camera360.activeView || 'surround';
      const isParked = s.gear === 'P';
      container.innerHTML = `
        <div class="center-popover center-fullscreen-page cam360-fullscreen-page" onclick="event.stopPropagation()">
          <header class="popover-header">
            <div class="popover-title-group">
              ${icon('camera')}
              <h4>Model 3 實時 3D 環視相機與超聲波視覺測距</h4>
              <span class="popover-sub">左側四路真實 3D 車身機位（前視/後視/左葉子板/右葉子板）· 右側 3D 車身俯視與障礙物距離</span>
            </div>
            <button class="ctrl-btn icon-only" data-action="close-center-modal">${icon('close')}</button>
          </header>
          <div class="cam360-fullscreen-body">
            <div class="cam360-main-stage">
              <div class="cam360-canvas-wrap">
                <canvas id="canvas-center-360" class="center-360-canvas"></canvas>
              </div>
              <div class="cam360-Quick-tabs">
                ${[
                  { id: 'surround', label: '四路 + 3D 環視同屏' },
                  { id: 'front', label: '前視廣角機位' },
                  { id: 'rear', label: '後視倒車機位' },
                  { id: 'fenderL', label: '左葉子板盲區' },
                  { id: 'fenderR', label: '右葉子板盲區' }
                ].map((c) => `
                  <button class="ctrl-btn ${activeCam === c.id ? 'is-selected' : ''}" data-action="set-cam360-view" data-view="${c.id}">
                    ${icon('camera')}<span>${c.label}</span>
                  </button>
                `).join('')}
              </div>
            </div>
            <aside class="cam360-telemetry-sidebar">
              <div class="cam-side-card">
                <h6>Tesla Vision 視覺測距數據</h6>
                <div class="cam-dist-row"><span>前方障礙物距離</span><strong class="is-safe">125 cm (安全)</strong></div>
                <div class="cam-dist-row"><span>左前側向間距</span><strong class="is-warn">64 cm (注意)</strong></div>
                <div class="cam-dist-row"><span>右前側向間距</span><strong class="is-safe">82 cm (正常)</strong></div>
                <div class="cam-dist-row"><span>後方倒車裕度</span><strong class="is-warn">48 cm (接近)</strong></div>
              </div>
              <div class="cam-side-card">
                <h6>哨兵與盲區輔助開關</h6>
                <div class="segmented-group" style="flex-direction:column;gap:6px;">
                  <button class="ctrl-btn ${s.driveMode.blindSpotCamera ? 'is-selected' : ''}" data-action="toggle-blind-spot">打方向燈自動彈出盲區鏡頭</button>
                  <button class="ctrl-btn ${s.sentryMode && isParked ? 'is-selected' : ''}" data-action="toggle-sentry">${isParked ? `哨兵模式監控 (${s.sentryMode ? '開啟' : '待命'})` : '行駛中哨兵休眠'}</button>
                  <button class="ctrl-btn ${s.driveMode.parkAssistChime !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="driveMode.parkAssistChime">泊車距離蜂鳴提示音</button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      `;
      return;
    }

    // 5. 藍牙電話全屏頁（撥號盤 + 通話中界面 + 常用聯絡人與近期通話記錄，全部採用 000-xxxx-xxxx 虛構號碼）
    if (modal === 'phone') {
      const ph = s.phone;
      const dialBuf = ph.dialBuffer || '000-8610-2049';
      const dialKeys = [
        { d: '1', sub: 'OO' }, { d: '2', sub: 'ABC' }, { d: '3', sub: 'DEF' },
        { d: '4', sub: 'GHI' }, { d: '5', sub: 'JKL' }, { d: '6', sub: 'MNO' },
        { d: '7', sub: 'PQRS' }, { d: '8', sub: 'TUV' }, { d: '9', sub: 'WXYZ' },
        { d: '*', sub: '+' }, { d: '0', sub: 'SPACE' }, { d: '#', sub: '撥號' }
      ];
      container.innerHTML = `
        <div class="center-popover center-fullscreen-page phone-fullscreen-page" onclick="event.stopPropagation()">
          <header class="popover-header">
            <div class="popover-title-group">
              ${icon('phone')}
              <h4>藍牙車載電話與通訊系統</h4>
              <span class="popover-sub">${ph.connectedDevice} · 藍牙高解析度語音已連線（虛構測試號碼格式 000-xxxx-xxxx）</span>
            </div>
            <button class="ctrl-btn icon-only" data-action="close-center-modal">${icon('close')}</button>
          </header>

          <div class="phone-fullscreen-grid">
            <!-- 左欄：數字撥號盤 (Dialpad) -->
            <div class="phone-dialpad-col">
              <div class="dialpad-screen">
                <span class="dialpad-number">${dialBuf || '請輸入號碼'}</span>
                <button class="ctrl-btn icon-only" data-action="dial-backspace" title="退格刪除">${icon('backspace')}</button>
              </div>
              <div class="dialpad-keys-grid">
                ${dialKeys.map((k) => `
                  <button class="ctrl-btn dialpad-key-btn" data-action="dial-key" data-digit="${k.d}">
                    <strong>${k.d}</strong>
                    <small>${k.sub}</small>
                  </button>
                `).join('')}
              </div>
              <button class="ctrl-btn dial-call-submit-btn is-selected" data-action="dial-call">
                ${icon('phone')}<span>撥打號碼 (${dialBuf})</span>
              </button>
            </div>

            <!-- 中欄：通話中界面 (Active Call Interface) -->
            <div class="phone-active-call-col">
              ${ph.activeCall ? `
                <div class="active-call-stage is-live">
                  <div class="call-avatar-ring">
                    ${icon('phone')}
                  </div>
                  <div class="call-status-pill">HD 語音通話進行中 · 00:48</div>
                  <h5 class="call-person-name">${ph.activeCall.name}</h5>
                  <p class="call-person-meta">${ph.activeCall.role} · ${ph.activeCall.number || '000-0000-0108'}</p>
                  <div class="call-controls-grid">
                    <button class="ctrl-btn ${s.media.muted ? 'is-selected' : ''}" data-action="toggle-mute">${icon('mic')}<span>麥克風靜音</span></button>
                    <button class="ctrl-btn is-selected" data-action="trigger-nav-voice">${icon('volume')}<span>車載免持擴音</span></button>
                  </div>
                  <button class="ctrl-btn call-hangup-btn is-danger" data-action="end-phone-call">
                    ${icon('phone')}<span>結束當前通話</span>
                  </button>
                </div>
              ` : `
                <div class="active-call-stage">
                  <div class="call-avatar-ring is-idle">
                    ${icon('phone')}
                  </div>
                  <div class="call-status-pill">線路待命中 · 點擊左側撥號或右側聯絡人發起通話</div>
                  <h5 class="call-person-name">車載雙麥克風陣列降噪已就緒</h5>
                  <p class="call-person-meta">通話期間將自動壓低中控與副駕媒體音量，確保清晰收音</p>
                  <button class="ctrl-btn is-selected" data-action="start-phone-call" data-name="${ph.contacts[0].name}" data-role="${ph.contacts[0].role}" data-number="${ph.contacts[0].number}">
                    ${icon('phone')}<span>一鍵呼叫：${ph.contacts[0].name} (${ph.contacts[0].number})</span>
                  </button>
                </div>
              `}
            </div>

            <!-- 右欄：常用聯絡人與近期通話記錄 -->
            <div class="phone-contacts-col">
              <div class="settings-label">常用聯絡人 (虛構號碼格式)</div>
              <div class="phone-list-scroll">
                ${ph.contacts.map((ct) => `
                  <button class="ctrl-btn contact-row-btn" data-action="start-phone-call" data-name="${ct.name}" data-role="${ct.role}" data-number="${ct.number}">
                    <div>
                      <div class="ct-name">${ct.name}</div>
                      <div class="ct-meta">${ct.role} · ${ct.number}</div>
                    </div>
                    ${icon('phone')}
                  </button>
                `).join('')}
              </div>

              <div class="settings-label" style="margin-top:8px;">近期通話記錄 (點擊回撥)</div>
              <div class="phone-list-scroll">
                ${ph.recentCalls.map((rc) => `
                  <button class="ctrl-btn contact-row-btn" data-action="start-phone-call" data-name="${rc.name}" data-role="${rc.type}" data-number="${rc.number}">
                    <div>
                      <div class="ct-name">${rc.name}</div>
                      <div class="ct-meta">${rc.type} · ${rc.number || '000-0000-0108'} · ${rc.duration}</div>
                    </div>
                    <span class="rc-time">${rc.time}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // 6. 車載自然語音全屏頁（聆聽中 / 識別中 / 已執行 三種狀態切換 + 實時多頻段聲波動畫畫布）
    if (modal === 'voice') {
      const vc = s.voice;
      const phase = vc.phase || (vc.listening ? 'listening' : 'executed');
      const phaseLabels = {
        listening: '狀態 1/3：正在聆聽座艙語音輸入...',
        recognizing: '狀態 2/3：神經網路語義識別中...',
        executed: '狀態 3/3：語音指令已執行完成'
      };
      container.innerHTML = `
        <div class="center-popover center-fullscreen-page voice-fullscreen-page" onclick="event.stopPropagation()">
          <header class="popover-header">
            <div class="popover-title-group">
              ${icon('mic')}
              <h4>Model 3 車載自然語音助理</h4>
              <span class="popover-sub">${phaseLabels[phase] || phaseLabels.executed}</span>
            </div>
            <button class="ctrl-btn icon-only" data-action="close-center-modal">${icon('close')}</button>
          </header>

          <div class="voice-fullscreen-body">
            <!-- 頂部：三態切換器（聆聽 / 識別 / 執行） -->
            <div class="voice-phase-switcher">
              <button class="ctrl-btn voice-phase-pill ${phase === 'listening' ? 'is-selected' : ''}" data-action="set-voice-phase" data-phase="listening">
                <span class="phase-dot is-listen"></span>
                <span>1. 聆聽中 (Listening)</span>
              </button>
              <button class="ctrl-btn voice-phase-pill ${phase === 'recognizing' ? 'is-selected' : ''}" data-action="set-voice-phase" data-phase="recognizing">
                <span class="phase-dot is-recog"></span>
                <span>2. 識別中 (Recognizing)</span>
              </button>
              <button class="ctrl-btn voice-phase-pill ${phase === 'executed' ? 'is-selected' : ''}" data-action="set-voice-phase" data-phase="executed">
                <span class="phase-dot is-exec"></span>
                <span>3. 已執行 (Executed)</span>
              </button>
            </div>

            <!-- 中央：實時聲波動畫畫布 + 語義識別對話盒 -->
            <div class="voice-wave-stage">
              <canvas id="canvas-voice-wave" class="voice-wave-canvas"></canvas>
              <div class="voice-transcript-overlay">
                <div class="voice-user-said">駕駛語音：「${vc.lastCommand}」</div>
                <div class="voice-ai-reply">車機回應：${vc.lastReply}</div>
              </div>
            </div>

            <!-- 底部：快捷語音指令集（點擊自動演示 聆聽 -> 識別 -> 執行 並聯動車控） -->
            <div class="voice-suggestions-section">
              <div class="settings-label">點擊任一語音指令測試「聆聽 → 識別 → 執行」三態聯動</div>
              <div class="voice-suggestions-grid">
                ${vc.suggestions.map((cmd, idx) => `
                  <button class="ctrl-btn voice-cmd-btn" data-action="run-voice-command" data-idx="${idx}">
                    ${icon('mic')}<span>「${cmd}」</span>
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // 7. 雙溫區熱泵空調全屏頁（車內俯視輪廓顯示出風口、風向與座椅加熱 + 雙區溫度大字顯示 + 可拖動風量滑桿）
    if (modal === 'climate') {
      const cMode = s.climate.mode || 'off';
      const vDir = s.climate.ventDirection || 'face';
      container.innerHTML = `
        <div class="center-popover center-fullscreen-page climate-fullscreen-page" onclick="event.stopPropagation()">
          <header class="popover-header">
            <div class="popover-title-group">
              ${icon('fan')}
              <h4>Model 3 雙溫區熱泵空調與座艙氣流控制</h4>
              <span class="popover-sub">車內實測 ${s.climate.cabinTemp.toFixed(1)}°C · 車外環境 ${s.climate.exteriorTemp.toFixed(1)}°C · 氣流方向：${vDir === 'face' ? '迎面直吹' : (vDir === 'split' ? '上下分流' : '足部暖風')}</span>
            </div>
            <button class="ctrl-btn icon-only" data-action="close-center-modal" aria-label="關閉空調面板">${icon('close')}</button>
          </header>

          <div class="climate-fullscreen-grid">
            <!-- 左側：車內俯視輪廓畫布（顯示出風口、動態風向氣流束、前後排五座加熱狀態） -->
            <div class="climate-cabin-visual-col">
              <div class="climate-cabin-canvas-wrap">
                <canvas id="canvas-climate-cabin" class="climate-cabin-canvas"></canvas>
              </div>
              <div class="climate-vent-dir-bar">
                <span class="vent-bar-label">出風口風向調節：</span>
                <div class="segmented-group">
                  <button class="ctrl-btn ${vDir === 'face' ? 'is-selected' : ''}" data-action="set-vent-dir" data-dir="face">迎面直吹</button>
                  <button class="ctrl-btn ${vDir === 'split' ? 'is-selected' : ''}" data-action="set-vent-dir" data-dir="split">雙向分流</button>
                  <button class="ctrl-btn ${vDir === 'feet' ? 'is-selected' : ''}" data-action="set-vent-dir" data-dir="feet">足部出風</button>
                </div>
              </div>
            </div>

            <!-- 右側：雙區大字溫度控制 + 可拖動風量滑桿 + 座椅/方向盤加熱與座艙保持模式 -->
            <div class="climate-controls-col">
              <div class="dual-zone-grid">
                <div class="zone-card">
                  <span class="zone-label">主駕溫度區</span>
                  <div class="zone-stepper">
                    <button class="ctrl-btn" data-action="temp-step" data-zone="driver" data-delta="-0.5">-</button>
                    <span class="zone-temp-val">${s.climate.driverTemp.toFixed(1)}°C</span>
                    <button class="ctrl-btn" data-action="temp-step" data-zone="driver" data-delta="0.5">+</button>
                  </div>
                  <button class="ctrl-btn ${s.climate.seatHeatLeft > 0 ? 'is-selected' : ''}" data-action="cycle-seat-heat" data-side="left">
                    ${icon('seatLeft')}<span>主駕座椅加熱 (${s.climate.seatHeatLeft} 檔)</span>
                  </button>
                </div>

                <div class="zone-card">
                  <span class="zone-label">副駕溫度區</span>
                  <div class="zone-stepper">
                    <button class="ctrl-btn" data-action="temp-step" data-zone="passenger" data-delta="-0.5">-</button>
                    <span class="zone-temp-val">${s.climate.passengerTemp.toFixed(1)}°C</span>
                    <button class="ctrl-btn" data-action="temp-step" data-zone="passenger" data-delta="0.5">+</button>
                  </div>
                  <button class="ctrl-btn ${s.climate.seatHeatRight > 0 ? 'is-selected' : ''}" data-action="cycle-seat-heat" data-side="right">
                    ${icon('seatLeft')}<span>副駕座椅加熱 (${s.climate.seatHeatRight} 檔)</span>
                  </button>
                </div>
              </div>

              <div class="fan-slider-row">
                <div class="fan-slider-head">
                  <span>無段風量等級 (可左右拖動滑桿)</span>
                  <strong>${s.climate.fanSpeed} / 10 檔</strong>
                </div>
                <input type="range" min="1" max="10" step="1" value="${s.climate.fanSpeed}" data-action="set-fan-speed" />
              </div>

              <div class="climate-toggles-grid">
                <button class="ctrl-btn ${s.climate.power ? 'is-selected' : ''}" data-action="toggle-climate-power">空調電源</button>
                <button class="ctrl-btn ${s.climate.auto ? 'is-selected' : ''}" data-action="toggle-climate-auto">自動 AUTO</button>
                <button class="ctrl-btn ${s.climate.ac ? 'is-selected' : ''}" data-action="toggle-climate-ac">A/C 壓縮機</button>
                <button class="ctrl-btn ${s.climate.sync ? 'is-selected' : ''}" data-action="toggle-climate-sync">雙區同步</button>
                <button class="ctrl-btn ${s.climate.recirculate ? 'is-selected' : ''}" data-action="toggle-recirc">車內內循環</button>
                <button class="ctrl-btn ${s.climate.bioweaponDefense ? 'is-selected' : ''}" data-action="toggle-bioweapon">HEPA 生物防禦</button>
                <button class="ctrl-btn ${s.climate.steeringWheelHeat ? 'is-selected' : ''}" data-action="toggle-wheel-heat">方向盤加熱</button>
                <button class="ctrl-btn ${(s.climate.rearLeftHeat || 0) > 0 ? 'is-selected' : ''}" data-action="cycle-rear-heat">後排座椅加熱 (${s.climate.rearLeftHeat || 0} 檔)</button>
              </div>

              <div class="climate-special-modes">
                <span class="mode-group-label">駐車座艙保持模式：</span>
                <div class="segmented-group">
                  <button class="ctrl-btn ${cMode === 'off' ? 'is-selected' : ''}" data-action="set-climate-mode" data-mode="off">標準運行</button>
                  <button class="ctrl-btn ${cMode === 'keep' ? 'is-selected' : ''}" data-action="set-climate-mode" data-mode="keep">恆溫保持</button>
                  <button class="ctrl-btn ${cMode === 'dog' ? 'is-selected' : ''}" data-action="set-climate-mode" data-mode="dog">寵物模式</button>
                  <button class="ctrl-btn ${cMode === 'camp' ? 'is-selected' : ''}" data-action="set-climate-mode" data-mode="camp">露營模式</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // 8. 車輛設置全屏頁（左側加大分類導航列 + 右側開關、滑桿、分組卡片，每個分頁 8~9 個真實可操作設置項）
    const tab = s.system.settingsTab || 'display';
    let tabBody = '';

    if (tab === 'display') {
      const tilt = s.environment.centerTilt || 'driver';
      tabBody = `
        <div class="settings-cards-grid">
          <div class="settings-section">
            <h5>1. 中控屏幕左右傾角調節</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${tilt === 'driver' ? 'is-selected' : ''}" data-action="set-center-tilt" data-tilt="driver">${icon('tiltScreen')}<span>向駕駛側傾斜</span></button>
              <button class="ctrl-btn ${tilt === 'center' ? 'is-selected' : ''}" data-action="set-center-tilt" data-tilt="center"><span>居中平視</span></button>
              <button class="ctrl-btn ${tilt === 'passenger' ? 'is-selected' : ''}" data-action="set-center-tilt" data-tilt="passenger"><span>向副駕側傾斜</span></button>
            </div>
          </div>

          <div class="settings-section">
            <h5>2. 外觀主題模式（日間淺色 / 夜間深色）</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.environment.timeOfDay === 'day' ? 'is-selected' : ''}" data-action="set-time" data-val="day">${icon('sun')}<span>日間淺色</span></button>
              <button class="ctrl-btn ${s.environment.timeOfDay === 'night' ? 'is-selected' : ''}" data-action="set-time" data-val="night">${icon('moon')}<span>夜間深色</span></button>
            </div>
          </div>

          <div class="settings-section">
            <h5>3. 屏幕背光亮度無段調節 (${s.environment.screenBrightness}%)</h5>
            <input type="range" min="40" max="100" step="1" value="${s.environment.screenBrightness}" data-action="set-brightness" />
            <div class="settings-toggle-row" style="margin-top:8px;">
              <span>4. 環境光感應自動亮度 (Auto Brightness)</span>
              <button class="ctrl-btn ${s.environment.autoBrightness !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="environment.autoBrightness">${s.environment.autoBrightness !== false ? '已開啟' : '已關閉'}</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>5. 3D 車身塗裝同步預覽</h5>
            <div class="segmented-group">
              ${Object.entries(PAINT_PRESETS).map(([key, p]) => `
                <button class="ctrl-btn ${s.paintColor === key ? 'is-selected' : ''}" data-action="set-paint" data-val="${key}">
                  ${p.name.split(' ')[0]}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="settings-section">
            <h5>6. 擋風玻璃 HUD 投影高度調節 (${s.environment.hudHeightOffset || 0})</h5>
            <input type="range" min="-5" max="5" step="1" value="${s.environment.hudHeightOffset || 0}" data-action="set-setting-range" data-path="environment.hudHeightOffset" />
            <div class="settings-toggle-row" style="margin-top:8px;">
              <span>7. 電量顯示方式切換</span>
              <button class="ctrl-btn is-selected" data-action="set-setting-enum" data-path="environment.energyDisplayUnit" data-val="${s.environment.energyDisplayUnit === 'km' ? 'percent' : 'km'}">${s.environment.energyDisplayUnit === 'km' ? '剩餘里程 (km)' : '百分比 (%)'}</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>8. 字體大小與屏幕清潔模式</h5>
            <div class="segmented-group" style="margin-bottom:8px;">
              <button class="ctrl-btn ${s.environment.textSize !== 'large' ? 'is-selected' : ''}" data-action="set-setting-enum" data-path="environment.textSize" data-val="standard">標準字體</button>
              <button class="ctrl-btn ${s.environment.textSize === 'large' ? 'is-selected' : ''}" data-action="set-setting-enum" data-path="environment.textSize" data-val="large">放大字體</button>
            </div>
            <div class="settings-toggle-row">
              <span>9. 屏幕清潔鎖定模式</span>
              <button class="ctrl-btn ${s.environment.screenCleanMode ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="environment.screenCleanMode">${s.environment.screenCleanMode ? '清潔鎖定中' : '啟動清潔模式'}</button>
            </div>
          </div>
        </div>
      `;
    } else if (tab === 'lights') {
      tabBody = `
        <div class="settings-cards-grid">
          <div class="settings-section">
            <h5>1. 外部大燈主模式</h5>
            <div class="segmented-group">
              ${[
                { k: 'off', label: '關閉' },
                { k: 'parking', label: '示廓燈' },
                { k: 'on', label: '近光燈' },
                { k: 'auto', label: '自動感應' }
              ].map((item) => `
                <button class="ctrl-btn ${s.lights.mode === item.k ? 'is-selected' : ''}" data-action="set-light-mode" data-val="${item.k}">${item.label}</button>
              `).join('')}
            </div>
          </div>

          <div class="settings-section">
            <h5>2. 遠光燈與自適應矩陣光束</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.lights.highBeam ? 'is-selected' : ''}" data-action="toggle-high-beam">遠光大燈 (${s.lights.highBeam ? '開' : '關'})</button>
              <button class="ctrl-btn ${s.lights.autoHighBeam !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="lights.autoHighBeam">自動遠光切換</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>3. 前後霧燈與雙閃警示燈</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.lights.fogFront ? 'is-selected' : ''}" data-action="toggle-fog-front">前霧燈</button>
              <button class="ctrl-btn ${s.lights.fogRear ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="lights.fogRear">後霧燈</button>
              <button class="ctrl-btn ${s.lights.hazard ? 'is-selected' : ''}" data-action="toggle-hazard">雙閃警示燈</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>4. 座艙環繞氛圍燈與亮度 (${s.lights.ambientBrightness || 80}%)</h5>
            <div class="settings-toggle-row" style="margin-bottom:8px;">
              <span>環艙 LED 氛圍燈條</span>
              <button class="ctrl-btn ${s.lights.ambient ? 'is-selected' : ''}" data-action="toggle-ambient-light">${s.lights.ambient ? '已開啟' : '已關閉'}</button>
            </div>
            <input type="range" min="10" max="100" step="5" value="${s.lights.ambientBrightness || 80}" data-action="set-setting-range" data-path="lights.ambientBrightness" />
          </div>

          <div class="settings-section">
            <h5>5. 車內頂燈與方向盤背光</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.lights.domeLight === 'off' ? 'is-selected' : ''}" data-action="set-setting-enum" data-path="lights.domeLight" data-val="off">頂燈關閉</button>
              <button class="ctrl-btn ${s.lights.domeLight !== 'off' && s.lights.domeLight !== 'on' ? 'is-selected' : ''}" data-action="set-setting-enum" data-path="lights.domeLight" data-val="auto">開門自動點亮</button>
              <button class="ctrl-btn ${s.lights.domeLight === 'on' ? 'is-selected' : ''}" data-action="set-setting-enum" data-path="lights.domeLight" data-val="on">常亮</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>6. 離車大燈延時與雨刮器檔位</h5>
            <div class="settings-toggle-row" style="margin-bottom:8px;">
              <span>鎖車後大燈延時照明 60 秒</span>
              <button class="ctrl-btn ${s.lights.headlightDelay !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="lights.headlightDelay">${s.lights.headlightDelay !== false ? '已開啟' : '已關閉'}</button>
            </div>
            <div class="segmented-group">
              ${[
                { k: 'off', label: '雨刮關' },
                { k: 'auto', label: '自動' },
                { k: 'I', label: 'I 檔' },
                { k: 'II', label: 'II 檔' },
                { k: 'III', label: 'III 檔' }
              ].map((w) => `
                <button class="ctrl-btn ${s.wipers.mode === w.k ? 'is-selected' : ''}" data-action="set-wiper-mode" data-val="${w.k}">${w.label}</button>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else if (tab === 'locks') {
      tabBody = `
        <div class="settings-cards-grid">
          <div class="settings-section">
            <h5>1. 全車中控鎖與車門開合控制 (${s.locked ? '已上鎖' : '未上鎖'})</h5>
            <div class="quick-doors-grid">
              <button class="ctrl-btn ${!s.locked ? 'is-selected' : ''}" data-action="toggle-lock">${icon(s.locked ? 'lock' : 'unlock')}<span>${s.locked ? '已上鎖' : '未上鎖'}</span></button>
              <button class="ctrl-btn ${s.doors.frunk ? 'is-selected' : ''}" data-action="toggle-door" data-part="frunk">${icon('frunk')}<span>前備箱</span></button>
              <button class="ctrl-btn ${s.doors.trunk ? 'is-selected' : ''}" data-action="toggle-door" data-part="trunk">${icon('trunk')}<span>尾箱</span></button>
              <button class="ctrl-btn ${s.doors.fl ? 'is-selected' : ''}" data-action="toggle-door" data-part="fl">${icon('door')}<span>左前門</span></button>
              <button class="ctrl-btn ${s.doors.fr ? 'is-selected' : ''}" data-action="toggle-door" data-part="fr">${icon('door')}<span>右前門</span></button>
              <button class="ctrl-btn ${s.doors.rl ? 'is-selected' : ''}" data-action="toggle-door" data-part="rl">${icon('door')}<span>左後門</span></button>
              <button class="ctrl-btn ${s.doors.rr ? 'is-selected' : ''}" data-action="toggle-door" data-part="rr">${icon('door')}<span>右後門</span></button>
              <button class="ctrl-btn ${s.doors.chargePort ? 'is-selected' : ''}" data-action="toggle-door" data-part="chargePort">${icon('chargePort')}<span>充電口</span></button>
            </div>
          </div>

          <div class="settings-section">
            <h5>2. 自動上鎖與解鎖邏輯</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.keys.walkAwayLock ? 'is-selected' : ''}" data-action="toggle-walk-away-lock">離車自動上鎖</button>
              <button class="ctrl-btn ${s.keys.driveAutoLock !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="keys.driveAutoLock">行駛自動落鎖</button>
              <button class="ctrl-btn ${s.keys.unlatchOnPark ? 'is-selected' : ''}" data-action="toggle-unlatch-park">P 擋自動解鎖</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>3. 兒童安全鎖與車窗鎖</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.keys.childLock ? 'is-selected' : ''}" data-action="toggle-child-lock">後排兒童安全鎖</button>
              <button class="ctrl-btn ${s.keys.windowLock ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="keys.windowLock">後排車窗升降鎖</button>
              <button class="ctrl-btn ${s.keys.closeWindowsOnLock !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="keys.closeWindowsOnLock">鎖車自動升窗</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>4. 鎖車提示音與後視鏡自動折疊</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.keys.lockConfirmationSound !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="keys.lockConfirmationSound">鎖車喇叭提示音</button>
              <button class="ctrl-btn ${s.keys.autoFoldMirrors !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="keys.autoFoldMirrors">鎖車自動折疊後視鏡</button>
              <button class="ctrl-btn ${s.keys.driverDoorUnlockOnly ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="keys.driverDoorUnlockOnly">僅解鎖駕駛側車門</button>
            </div>
          </div>

          <div class="settings-section" style="grid-column: span 2;">
            <h5>5. 已配對數位鑰匙與卡片管理（點擊切換啟用狀態）</h5>
            <div class="tpms-grid-4">
              ${(Array.isArray(s.keys) ? s.keys : (s.keys?.list || [])).map((k) => `
                <button class="ctrl-btn tpms-cell ${k.active ? 'is-selected' : ''}" data-action="toggle-key-active" data-id="${k.id}">
                  <span>${k.type} · ${k.active ? '已啟用' : '已停用'}</span>
                  <strong>${k.name}</strong>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else if (tab === 'autopilot') {
      tabBody = `
        <div class="settings-cards-grid">
          <div class="settings-section">
            <h5>1. 自動輔助駕駛核心功能</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.driveMode.autopilot ? 'is-selected' : ''}" data-action="toggle-autopilot">${icon('steering')}<span>自動輔助轉向 (${s.driveMode.autopilot ? '開啟' : '關閉'})</span></button>
              <button class="ctrl-btn ${s.driveMode.navigateOnAutopilot !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="driveMode.navigateOnAutopilot">自動輔助導航駕駛 (NoA)</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>2. 加速踏板模式与轉向手感</h5>
            <div class="segmented-group" style="margin-bottom:8px;">
              ${[
                { k: 'chill', label: '加速：舒適' },
                { k: 'standard', label: '加速：標準' },
                { k: 'sport', label: '加速：運動' }
              ].map((item) => `
                <button class="ctrl-btn ${s.driveMode.accel === item.k ? 'is-selected' : ''}" data-action="set-accel-mode" data-val="${item.k}">${item.label}</button>
              `).join('')}
            </div>
            <div class="segmented-group">
              ${[
                { k: 'comfort', label: '轉向：舒適' },
                { k: 'standard', label: '轉向：標準' },
                { k: 'sport', label: '轉向：運動' }
              ].map((item) => `
                <button class="ctrl-btn ${s.driveMode.steering === item.k ? 'is-selected' : ''}" data-action="set-steering-mode" data-val="${item.k}">${item.label}</button>
              `).join('')}
            </div>
          </div>

          <div class="settings-section">
            <h5>3. 自動變道與綠燈提示</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.driveMode.autoLaneChange !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="driveMode.autoLaneChange">打燈自動變道</button>
              <button class="ctrl-btn ${s.driveMode.greenLightChime !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="driveMode.greenLightChime">綠燈起步提示音</button>
              <button class="ctrl-btn ${s.driveMode.trafficLightControl !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="driveMode.trafficLightControl">紅綠燈與停車標誌識別</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>4. 車道偏離與盲區安全影像</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.driveMode.laneDepartureWarn ? 'is-selected' : ''}" data-action="toggle-ldw">車道偏離輔助修正</button>
              <button class="ctrl-btn ${s.driveMode.blindSpotCamera ? 'is-selected' : ''}" data-action="toggle-blind-spot">打燈盲區鏡頭</button>
              <button class="ctrl-btn ${s.driveMode.summonStandby !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="driveMode.summonStandby">智慧召喚待命</button>
            </div>
          </div>

          <div class="settings-section" style="grid-column: span 2;">
            <h5>5. 巡航跟車距離 (${s.driveMode.followDistance} 檔) 與限速偏移設定 (+${s.driveMode.speedLimitOffset || 0} km/h)</h5>
            <div class="segmented-group">
              ${[1, 2, 3, 4, 5, 6, 7].map((lv) => `
                <button class="ctrl-btn ${s.driveMode.followDistance === lv ? 'is-selected' : ''}" data-action="set-setting-enum" data-path="driveMode.followDistance" data-val="${lv}">跟車 ${lv} 檔</button>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else if (tab === 'safety') {
      const isParked = s.gear === 'P';
      tabBody = `
        <div class="settings-cards-grid">
          <div class="settings-section">
            <h5>1. 哨兵模式與防盜監控</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.sentryMode && isParked ? 'is-selected' : ''}" data-action="toggle-sentry">${icon('shield')}<span>${isParked ? `哨兵模式 (${s.sentryMode ? '開啟' : '關閉'})` : '行駛中哨兵自動休眠'}</span></button>
              <button class="ctrl-btn ${s.safety?.dashcamAuto !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="safety.dashcamAuto">行車記錄儀自動錄影</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>2. 駕駛權限與速度限制</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.valetMode ? 'is-selected' : ''}" data-action="toggle-valet">代客模式</button>
              <button class="ctrl-btn ${s.speedLimitMode ? 'is-selected' : ''}" data-action="toggle-speed-limit-mode">限速模式 (100km/h)</button>
              <button class="ctrl-btn ${s.pinToDrive ? 'is-selected' : ''}" data-action="toggle-pin-drive">PIN 碼啟動保護</button>
              <button class="ctrl-btn ${s.safety?.gloveboxPin ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="safety.gloveboxPin">手套箱 PIN 碼</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>3. 主動防撞與緊急制動</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.safety?.aebEnabled !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="safety.aebEnabled">自動緊急制動 (AEB)</button>
              <button class="ctrl-btn ${s.safety?.obstacleAwareAccel !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="safety.obstacleAwareAccel">障礙物感應限扭</button>
              <button class="ctrl-btn ${s.safety?.cabinOverheatProtection !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="safety.cabinOverheatProtection">車廂過熱保護 (35°C)</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>4. 四輪胎壓監測 (TPMS) 與異常模擬</h5>
            <div class="tpms-grid-4">
              <div class="tpms-cell"><span>左前</span><strong>${s.tires.fl.toFixed(2)} Bar</strong></div>
              <div class="tpms-cell"><span>右前</span><strong>${s.tires.fr.toFixed(2)} Bar</strong></div>
              <div class="tpms-cell ${s.tires.lowPressureWarning ? 'is-warn' : ''}"><span>左後</span><strong>${s.tires.lowPressureWarning ? '2.15' : s.tires.rl.toFixed(2)} Bar</strong></div>
              <div class="tpms-cell"><span>右後</span><strong>${s.tires.rr.toFixed(2)} Bar</strong></div>
            </div>
            <button class="ctrl-btn ${s.tires.lowPressureWarning ? 'is-selected' : ''}" style="margin-top:8px;" data-action="toggle-tpms-warn">
              ${icon('alertTriangle')}<span>${s.tires.lowPressureWarning ? '解除左後胎壓異常報警' : '模擬左後胎壓異常報警'}</span>
            </button>
          </div>
        </div>
      `;
    } else if (tab === 'schedule') {
      const sched = s.climate.scheduledDeparture;
      tabBody = `
        <div class="settings-cards-grid">
          <div class="settings-section">
            <h5>1. 預約出發主開關 (${sched.time})</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${sched.enabled ? 'is-selected' : ''}" data-action="toggle-scheduled-departure">${icon('calendar')}<span>預約出發 (${sched.enabled ? '已啟用' : '已關閉'})</span></button>
              <button class="ctrl-btn ${sched.time === '07:30' ? 'is-selected' : ''}" data-action="set-setting-enum" data-path="climate.scheduledDeparture.time" data-val="07:30">07:30 出發</button>
              <button class="ctrl-btn ${sched.time === '08:15' ? 'is-selected' : ''}" data-action="set-setting-enum" data-path="climate.scheduledDeparture.time" data-val="08:15">08:15 出發</button>
              <button class="ctrl-btn ${sched.time === '09:00' ? 'is-selected' : ''}" data-action="set-setting-enum" data-path="climate.scheduledDeparture.time" data-val="09:00">09:00 出發</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>2. 座艙與電池預熱排程</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${sched.preconditionCabin ? 'is-selected' : ''}" data-action="toggle-sched-cabin">出發前座艙恆溫預調</button>
              <button class="ctrl-btn ${sched.preconditionBattery !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="climate.scheduledDeparture.preconditionBattery">高壓電池預熱</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>3. 離峰充電時段與排程循環</h5>
            <div class="segmented-group" style="margin-bottom:8px;">
              <button class="ctrl-btn ${sched.offPeakCharging ? 'is-selected' : ''}" data-action="toggle-sched-offpeak">離峰電價優先充電 (${sched.offPeakEnd})</button>
              <button class="ctrl-btn ${sched.locationBased !== false ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="climate.scheduledDeparture.locationBased">僅在家庭充電樁生效</button>
            </div>
            <div class="segmented-group">
              <button class="ctrl-btn ${sched.weekdaysOnly ? 'is-selected' : ''}" data-action="toggle-sched-weekdays">僅週一至週五工作日</button>
              <button class="ctrl-btn ${!sched.weekdaysOnly ? 'is-selected' : ''}" data-action="toggle-sched-weekdays">每日循環執行</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>4. 充電最大電流限制 (${sched.maxChargeCurrentA || 48} A)</h5>
            <input type="range" min="16" max="48" step="8" value="${sched.maxChargeCurrentA || 48}" data-action="set-setting-range" data-path="climate.scheduledDeparture.maxChargeCurrentA" />
          </div>
        </div>
      `;
    } else if (tab === 'service') {
      tabBody = `
        <div class="settings-cards-grid">
          <div class="settings-section">
            <h5>1. 軟件版本與空中升級 (OTA)</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.software.updating ? 'is-selected' : ''}" data-action="trigger-software-update">
                ${icon('update')}<span>${s.software.updating ? `正在安裝 ${s.software.availableVersion} (${s.software.progress}%)` : `當前 ${s.software.currentVersion} · 升級 ${s.software.availableVersion}`}</span>
              </button>
              <button class="ctrl-btn ${s.software.Preference === 'advanced' ? 'is-selected' : ''}" data-action="set-setting-enum" data-path="software.Preference" data-val="${s.software.Preference === 'advanced' ? 'standard' : 'advanced'}">更新通道：${s.software.Preference === 'advanced' ? '搶先體驗' : '穩定版'}</button>
            </div>
          </div>

          <div class="settings-section">
            <h5>2. 維護保養與特殊服勤模式</h5>
            <div class="segmented-group">
              <button class="ctrl-btn ${s.service.wiperServiceMode ? 'is-selected' : ''}" data-action="toggle-wiper-service">雨刮器維護模式</button>
              <button class="ctrl-btn ${s.service.carWashMode ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="service.carWashMode">自動洗車模式</button>
              <button class="ctrl-btn ${s.service.jackMode ? 'is-selected' : ''}" data-action="toggle-setting-bool" data-path="service.jackMode">千斤頂更換輪胎模式</button>
              <button class="ctrl-btn ${s.service.towMode ? 'is-selected' : ''}" data-action="toggle-tow-mode">拖車自由滑行模式</button>
            </div>
          </div>

          <div class="settings-section" style="grid-column: span 2;">
            <h5>3. 里程統計、低壓電池健康度與服務預約 (點擊行程 A 可重置)</h5>
            <div class="tpms-grid-4">
              <button class="ctrl-btn tpms-cell" data-action="reset-trip-a"><span>總里程</span><strong>${s.trips.odometerKm} km</strong></button>
              <button class="ctrl-btn tpms-cell" data-action="reset-trip-a"><span>行程 A (點擊重置)</span><strong>${s.trips.tripAKm} km</strong></button>
              <button class="ctrl-btn tpms-cell" data-action="reset-trip-a"><span>平均能耗</span><strong>${s.trips.tripAWhKm} Wh/km</strong></button>
              <button class="ctrl-btn tpms-cell is-selected" data-action="toggle-service-item" data-id="srv-1"><span>16V 鋰電 / 預約</span><strong>${s.service.batteryHealth12V || '良好 (15.5V)'}</strong></button>
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="center-popover center-fullscreen-page settings-popover" onclick="event.stopPropagation()">
        <header class="popover-header">
          <div class="popover-title-group">
            ${icon('settings')}
            <h4>Model 3 車輛控制與全系統設置</h4>
            <span class="popover-sub">全屏圖形化設置中心 · 每個分頁提供 8 項以上真實車規級控制</span>
          </div>
          <button class="ctrl-btn icon-only" data-action="close-center-modal" aria-label="關閉設置面板">${icon('close')}</button>
        </header>

        <div class="settings-split-layout">
          <aside class="settings-sidebar-nav settings-sidebar-nav-large">
            <button class="settings-nav-btn ${tab === 'display' ? 'is-active' : ''}" data-action="switch-settings-tab" data-tab="display">
              ${icon('sun')}<span>顯示與畫面</span>
            </button>
            <button class="settings-nav-btn ${tab === 'lights' ? 'is-active' : ''}" data-action="switch-settings-tab" data-tab="lights">
              ${icon('bulb')}<span>車燈與雨刮</span>
            </button>
            <button class="settings-nav-btn ${tab === 'locks' ? 'is-active' : ''}" data-action="switch-settings-tab" data-tab="locks">
              ${icon('lock')}<span>車門與車鎖</span>
            </button>
            <button class="settings-nav-btn ${tab === 'autopilot' ? 'is-active' : ''}" data-action="switch-settings-tab" data-tab="autopilot">
              ${icon('steering')}<span>輔助駕駛</span>
            </button>
            <button class="settings-nav-btn ${tab === 'safety' ? 'is-active' : ''}" data-action="switch-settings-tab" data-tab="safety">
              ${icon('shield')}<span>安全與胎壓</span>
            </button>
            <button class="settings-nav-btn ${tab === 'schedule' ? 'is-active' : ''}" data-action="switch-settings-tab" data-tab="schedule">
              ${icon('calendar')}<span>預約日程</span>
            </button>
            <button class="settings-nav-btn ${tab === 'service' ? 'is-active' : ''}" data-action="switch-settings-tab" data-tab="service">
              ${icon('wrench')}<span>維護與服務</span>
            </button>
          </aside>

          <div class="settings-tab-body">
            ${tabBody}
          </div>
        </div>
      </div>
    `;
  }

  renderCenterDock(s) {
    const dock = document.getElementById('center-dock-layer');
    if (!dock) return;

    const modal = s.system.centerActiveModal;

    dock.innerHTML = `
      <button class="dock-btn ${modal === 'settings' ? 'is-active' : ''}" data-action="open-center-modal" data-modal="settings" data-tab="display">
        ${icon('carSide')}
        <span>設置</span>
      </button>

      <div class="dock-temp-group">
        <button class="dock-step-btn" data-action="temp-step" data-zone="driver" data-delta="-0.5" aria-label="降低主駕溫度">-</button>
        <button class="dock-temp-readout ${modal === 'climate' ? 'is-active' : ''}" data-action="open-center-modal" data-modal="climate">
          <span class="dock-temp-val">${s.climate.driverTemp.toFixed(1)}°</span>
        </button>
        <button class="dock-step-btn" data-action="temp-step" data-zone="driver" data-delta="0.5" aria-label="升高主駕溫度">+</button>
      </div>

      <div class="dock-app-icons">
        <button class="dock-btn ${modal === 'apps' ? 'is-active' : ''}" data-action="open-center-modal" data-modal="apps">
          ${icon('apps')}
          <span>應用</span>
        </button>
        <button class="dock-btn ${modal === 'search' ? 'is-active' : ''}" data-action="open-center-modal" data-modal="search">
          ${icon('search')}
          <span>導航</span>
        </button>
        <button class="dock-btn ${modal === 'charging' ? 'is-active' : ''}" data-action="open-center-modal" data-modal="charging">
          ${icon('bolt')}
          <span>充電</span>
        </button>
        <button class="dock-btn ${modal === 'camera360' ? 'is-active' : ''}" data-action="open-center-modal" data-modal="camera360">
          ${icon('camera')}
          <span>相機</span>
        </button>
        <button class="dock-btn ${modal === 'phone' ? 'is-active' : ''}" data-action="open-center-modal" data-modal="phone">
          ${icon('phone')}
          <span>電話</span>
        </button>
        <button class="dock-btn ${modal === 'voice' ? 'is-active' : ''}" data-action="open-center-modal" data-modal="voice">
          ${icon('mic')}
          <span>語音</span>
        </button>
      </div>

      <div class="dock-temp-group">
        <button class="dock-step-btn" data-action="temp-step" data-zone="passenger" data-delta="-0.5" aria-label="降低副駕溫度">-</button>
        <button class="dock-temp-readout" data-action="open-center-modal" data-modal="climate">
          <span class="dock-temp-val">${s.climate.passengerTemp.toFixed(1)}°</span>
        </button>
        <button class="dock-step-btn" data-action="temp-step" data-zone="passenger" data-delta="0.5" aria-label="升高副駕溫度">+</button>
      </div>

      <div class="dock-vol-group">
        <button class="dock-step-btn" data-action="vol-step" data-delta="-5" aria-label="降低音量">-</button>
        <button class="dock-vol-readout" data-action="toggle-mute">
          ${icon(s.media.muted ? 'volumeMute' : 'volume')}
          <span data-live="dock-vol-txt">${s.media.effectiveVolume}%</span>
        </button>
        <button class="dock-step-btn" data-action="vol-step" data-delta="5" aria-label="調高音量">+</button>
      </div>
    `;
  }

  /**
   * 3. 副駕娛樂屏 (概念設計：音樂 / 真正可播放的動態短片 / 街機遊戲，音量控件與歌名完整顯示且與主屏聯動，導航提示與主屏完全同步)
   */
  renderPassengerUI(s) {
    const headerEl = document.getElementById('passenger-header-layer');
    const controlsEl = document.getElementById('passenger-controls-layer');
    const playlistEl = document.getElementById('passenger-playlist-layer');
    if (!headerEl || !controlsEl || !playlistEl) return;

    const tab = s.media.activeTab;
    const track = s.media.tracks[s.media.trackIndex] || s.media.tracks[0];
    const video = s.media.videos[s.media.videoIndex] || s.media.videos[0];
    const eqMode = s.media.eqPreset || 'immersive';
    const stageBadgeEl = document.getElementById('passenger-stage-badge');
    const stageBadgeTxt = document.getElementById('passenger-stage-badge-text');
    if (stageBadgeEl) {
      stageBadgeEl.style.display = tab === 'music' ? 'inline-flex' : 'none';
    }
    if (stageBadgeTxt && tab === 'music') {
      stageBadgeTxt.textContent = `母帶音質 · ${track.code || '無損'} · 24-BIT`;
    }
    const turnDirLabel = this.store.getTurnDirectionLabel();
    const turnIconName = this.store.getTurnIconName();

    headerEl.innerHTML = `
      <div class="passenger-topbar">
        <div class="passenger-tabs" role="tablist">
          <button class="ctrl-btn pass-tab ${tab === 'music' ? 'is-selected' : ''}" data-action="set-passenger-tab" data-tab="music">
            ${icon('music')}<span>音樂</span>
          </button>
          <button class="ctrl-btn pass-tab ${tab === 'video' ? 'is-selected' : ''}" data-action="set-passenger-tab" data-tab="video">
            ${icon('video')}<span>短片</span>
          </button>
          <button class="ctrl-btn pass-tab ${tab === 'game' ? 'is-selected' : ''}" data-action="set-passenger-tab" data-tab="game">
            ${icon('gamepad')}<span>街機</span>
          </button>
        </div>

        <div class="passenger-sync-status">
          <button class="ctrl-btn nav-link-pill ${s.navigation.voiceSpeaking ? 'is-ducking' : ''}" data-action="trigger-nav-voice" title="點擊觸發導航語音播報與媒體音量自動壓低">
            ${icon(turnIconName, 'pass-nav-mini-icon')}
            <span>${s.navigation.voiceSpeaking ? `導航播報 · 音量 ${s.media.effectiveVolume}%` : `<strong data-live="pass-turn-dir">${turnDirLabel}</strong> <span data-live="pass-turn-dist">${Math.round(s.navigation.nextTurnDistanceM)}</span>m · <span data-live="pass-rem-km">${s.navigation.remainingKm.toFixed(1)}</span>km`}</span>
          </button>
        </div>
      </div>
    `;

    const fmtTime = (sec) => {
      const m = Math.floor(sec / 60);
      const r = Math.floor(sec % 60);
      return `${m}:${r < 10 ? '0' : ''}${r}`;
    };

    if (tab === 'music') {
      controlsEl.innerHTML = `
        <div class="passenger-now-playing">
          <div class="now-playing-meta">
            <div class="album-badge" style="background:${(track.palette && track.palette[0]) || '#1e293b'}">
              ${icon('music')}
            </div>
            <div class="np-meta-text">
              <div class="np-title">${track.title}</div>
              <div class="np-artist">${track.artist} · ${track.album}</div>
            </div>
          </div>

          <div class="np-progress-row">
            <span class="np-time" data-live="media-curr-time">${fmtTime(s.media.currentTime)}</span>
            <input type="range" class="np-scrubber" min="0" max="${track.duration}" value="${Math.round(s.media.currentTime)}" data-action="scrub-music" />
            <span class="np-time">${fmtTime(track.duration)}</span>
          </div>

          <div class="np-controls-row">
            <div class="np-transport">
              <button class="ctrl-btn icon-only" data-action="media-prev" aria-label="上一首">${icon('prev')}</button>
              <button class="ctrl-btn icon-only play-main-btn ${s.media.playing ? 'is-selected' : ''}" data-action="media-toggle" aria-label="播放/暫停">
                ${icon(s.media.playing ? 'pause' : 'play')}
              </button>
              <button class="ctrl-btn icon-only" data-action="media-next" aria-label="下一首">${icon('next')}</button>
            </div>

            <div class="np-eq-pills">
              <button class="ctrl-btn eq-pill-btn ${eqMode === 'immersive' ? 'is-selected' : ''}" data-action="set-eq-preset" data-eq="immersive">沉浸</button>
              <button class="ctrl-btn eq-pill-btn ${eqMode === 'studio' ? 'is-selected' : ''}" data-action="set-eq-preset" data-eq="studio">原聲</button>
              <button class="ctrl-btn eq-pill-btn ${eqMode === 'bass' ? 'is-selected' : ''}" data-action="set-eq-preset" data-eq="bass">低音</button>
            </div>

            <!-- 副駕音量控件：完整可見且與主屏 100% 同步 -->
            <div class="np-vol-wrap">
              <button class="ctrl-btn icon-only" data-action="vol-step" data-delta="-5" aria-label="降低音量">-</button>
              <button class="ctrl-btn vol-readout-pill" data-action="toggle-mute" title="點擊靜音/恢復">
                ${icon(s.media.muted ? 'volumeMute' : 'volume')}
                <span data-live="pass-vol-txt">${s.media.effectiveVolume}%</span>
              </button>
              <button class="ctrl-btn icon-only" data-action="vol-step" data-delta="5" aria-label="升高音量">+</button>
            </div>
          </div>
        </div>
      `;

      playlistEl.innerHTML = `
        <div class="passenger-playlist">
          <div class="playlist-items">
            ${s.media.tracks.map((t, idx) => `
              <button class="playlist-row ${idx === s.media.trackIndex ? 'is-current' : ''}" data-action="select-track" data-idx="${idx}">
                <span class="pl-idx">${idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</span>
                <div class="pl-text">
                  <span class="pl-name">${t.title}</span>
                  <span class="pl-sub">${t.artist}</span>
                </div>
                <span class="pl-dur">${fmtTime(t.duration)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    } else if (tab === 'video') {
      const vidElapsed = Math.round(((s.media.videoProgress || 42) / 100) * (video.duration || 312));
      controlsEl.innerHTML = `
        <div class="passenger-now-playing">
          <div class="now-playing-meta">
            <div class="album-badge">
              ${icon('video')}
            </div>
            <div class="np-meta-text">
              <div class="np-title">${video.title}</div>
              <div class="np-artist">${video.channel} · ${video.category}</div>
            </div>
          </div>

          <div class="np-progress-row">
            <span class="np-time" data-live="video-curr-time">${fmtTime(vidElapsed)}</span>
            <input type="range" class="np-scrubber" min="0" max="100" value="${Math.round(s.media.videoProgress)}" data-action="scrub-video" />
            <span class="np-time">${fmtTime(video.duration)}</span>
          </div>

          <div class="np-controls-row">
            <div class="np-transport">
              <button class="ctrl-btn icon-only" data-action="video-prev" title="上一部短片">${icon('prev')}</button>
              <button class="ctrl-btn eq-pill-btn" data-action="seek-video" data-delta="-15">-15s</button>
              <button class="ctrl-btn icon-only play-main-btn ${s.media.videoPlaying ? 'is-selected' : ''}" data-action="toggle-video-play">
                ${icon(s.media.videoPlaying ? 'pause' : 'play')}
              </button>
              <button class="ctrl-btn eq-pill-btn" data-action="seek-video" data-delta="15">+15s</button>
              <button class="ctrl-btn icon-only" data-action="video-next" title="下一部短片">${icon('next')}</button>
              <button class="ctrl-btn eq-pill-btn" data-action="cycle-video-speed">${(s.media.videoSpeed || 1).toFixed(1)}x</button>
            </div>

            <div class="np-vol-wrap">
              <button class="ctrl-btn icon-only" data-action="vol-step" data-delta="-5">-</button>
              <button class="ctrl-btn vol-readout-pill" data-action="toggle-mute">
                ${icon(s.media.muted ? 'volumeMute' : 'volume')}
                <span data-live="pass-vol-txt">${s.media.effectiveVolume}%</span>
              </button>
              <button class="ctrl-btn icon-only" data-action="vol-step" data-delta="5">+</button>
            </div>
          </div>
        </div>
      `;

      playlistEl.innerHTML = `
        <div class="passenger-playlist">
          <div class="playlist-items">
            ${s.media.videos.map((v, idx) => `
              <button class="playlist-row ${idx === s.media.videoIndex ? 'is-current' : ''}" data-action="select-video" data-idx="${idx}">
                <span class="pl-idx">0${idx + 1}</span>
                <div class="pl-text">
                  <span class="pl-name">${v.title}</span>
                  <span class="pl-sub">${v.channel}</span>
                </div>
                <span class="pl-dur">${fmtTime(v.duration)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      const stages = s.media.game.stages || [
        { code: 'C1', name: '都心環狀線 C1 · 夜間巡航', sub: 'Model 3 雙電機', dur: '1:18.4' },
        { code: 'S2', name: '澀谷穿越道 · 霓虹衝刺', sub: 'Model 3 運動版', dur: '0:54.2' },
        { code: 'B3', name: '跨海大橋 · 灣岸長直線', sub: '概念GT組別', dur: '1:32.8' },
        { code: 'R4', name: '六本木隧道 · 聲學迴廊', sub: 'Model 3 雙電機', dur: '1:05.1' },
        { code: 'D5', name: '代官山連續彎 · 乾地計時', sub: '賽道懸吊組', dur: '0:49.7' },
        { code: 'N6', name: '新宿西口高架 · 智駕領航', sub: '全電概念組', dur: '1:11.6' },
        { code: 'O7', name: '台場海濱大道 · 電能全開', sub: 'Model 3 雙電機', dur: '1:24.0' },
        { code: 'M8', name: '皇居外苑環線 · 決賽圈', sub: 'Model 3 運動版', dur: '1:15.9' }
      ];
      const curStageIdx = s.media.game.stageIndex || 0;
      const curStage = stages[curStageIdx] || stages[0];

      controlsEl.innerHTML = `
        <div class="passenger-now-playing">
          <div class="now-playing-meta">
            <div class="album-badge" style="background:${curStage.accent || '#3e6ae1'}">
              ${icon('gamepad')}
            </div>
            <div class="np-meta-text">
              <div class="np-title">${curStage.name}</div>
              <div class="np-artist">${curStage.sub} · 最佳圈速 ${curStage.dur}</div>
            </div>
          </div>
          <div class="np-controls-row">
            <div class="np-transport">
              <button class="ctrl-btn eq-pill-btn" data-action="game-lane" data-dir="-1">左道</button>
              <button class="ctrl-btn eq-pill-btn ${s.media.game.running ? 'is-selected' : ''}" data-action="game-toggle">
                ${s.media.game.running ? '暫停' : '開始'}
              </button>
              <button class="ctrl-btn eq-pill-btn" data-action="game-lane" data-dir="1">右道</button>
              <button class="ctrl-btn eq-pill-btn ${s.media.game.boostActive ? 'is-selected' : ''}" data-action="game-boost">氮氣加速</button>
            </div>
            <div class="np-vol-wrap">
              <button class="ctrl-btn icon-only" data-action="vol-step" data-delta="-5">-</button>
              <button class="ctrl-btn vol-readout-pill" data-action="toggle-mute">
                ${icon(s.media.muted ? 'volumeMute' : 'volume')}
                <span data-live="pass-vol-txt">${s.media.effectiveVolume}%</span>
              </button>
              <button class="ctrl-btn icon-only" data-action="vol-step" data-delta="5">+</button>
            </div>
          </div>
        </div>
      `;

      playlistEl.innerHTML = `
        <div class="passenger-playlist">
          <div class="playlist-items">
            ${stages.map((item, idx) => `
              <button class="playlist-row ${idx === curStageIdx ? 'is-current' : ''}" data-action="select-game-stage" data-idx="${idx}">
                <span class="pl-idx">0${idx + 1}</span>
                <div class="pl-text">
                  <span class="pl-name">${item.name}</span>
                  <span class="pl-sub">${item.sub}</span>
                </div>
                <span class="pl-dur">${item.dur}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  /**
   * 4. 儀錶盤 (方向盤後 8:3 橫條小屏)
   * 分工：只顯示駕駛必要信息（車速、擋位、報警［胎壓、車門、低電量］、轉向燈與雙閃指示、限速與輔助駕駛狀態、實時能耗曲線），導航地圖與控制放在中控。
   */
  renderClusterUI(s) {
    const container = document.getElementById('cluster-ui-layer');
    if (!container) return;

    const rangeKm = this.store.getEstimatedRangeKm();
    const hasOpen = this.store.hasOpenDoorOrTrunk();
    const leftTurnOn = (s.lights.turnSignal === 'left' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;
    const rightTurnOn = (s.lights.turnSignal === 'right' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;
    const leadDistInt = Math.round(s.driveMode.displayLeadDistanceM);
    const lowBatteryWarn = s.displaySoc <= 20;
    const lastWhKm = s.energyHistory && s.energyHistory.length ? s.energyHistory[s.energyHistory.length - 1] : 154;

    container.innerHTML = `
      <div class="cluster-centered-content">
        <!-- 左區：車速、擋位、轉向燈與雙閃、限速與輔助駕駛狀態、電量續航 -->
        <div class="cluster-left-pod">
          <div class="cluster-top-indicators">
            <button class="cluster-turn-indicator ${leftTurnOn ? 'is-on' : ''}" data-action="set-turn-signal" data-dir="left" data-live="cluster-turn-left" title="切換左轉向燈">◀</button>
            <div class="cluster-gear-row">
              ${['P', 'R', 'N', 'D'].map((g) => `<button class="cluster-gear-item ${s.gear === g ? 'is-active' : ''}" data-action="set-gear" data-gear="${g}" title="切換至 ${g} 擋">${g}</button>`).join('')}
            </div>
            <button class="cluster-turn-indicator ${rightTurnOn ? 'is-on' : ''}" data-action="set-turn-signal" data-dir="right" data-live="cluster-turn-right" title="切換右轉向燈">▶</button>
            ${s.lights.hazard ? '<button class="cluster-hazard-tag" data-action="toggle-hazard">雙閃</button>' : ''}
          </div>

          <div class="cluster-speed-and-signs">
            <div class="cluster-speed-block" data-action="toggle-cruise-demo" style="cursor:pointer;" title="點擊切換巡航車速">
              <span class="cluster-speed-val" data-live="cluster-speed">${Math.round(s.displaySpeed)}</span>
              <span class="cluster-speed-unit">km/h</span>
            </div>
            <div class="cluster-adas-signs">
              <button class="cluster-limit-circle" data-action="sync-speed-limit" title="點擊切換道路限速">${s.driveMode.speedLimit}</button>
              <button class="cluster-ap-pill ${s.driveMode.autopilot ? 'is-on' : ''}" data-action="toggle-autopilot" title="切換自動輔助轉向">
                ${icon('steering')}<span>${s.driveMode.autopilot ? `AP ${s.driveMode.setSpeed}` : '手動'}</span>
              </button>
            </div>
          </div>

          <div class="cluster-power-track">
            <div class="cluster-regen-fill" data-live="cluster-regen-bar" style="width:0%"></div>
            <div class="cluster-drive-fill" data-live="cluster-drive-bar" style="width:15%"></div>
          </div>

          <div class="cluster-meta-row" data-action="toggle-lock" style="cursor:pointer;" title="點擊切換全車鎖定狀態">
            <span data-live="cluster-soc">${Math.round(s.displaySoc)}%</span>
            <span>·</span>
            <span data-live="cluster-range">${rangeKm} km</span>
            <span>·</span>
            <span data-live="cluster-lock-state">${s.locked ? '已上鎖' : '未上鎖'}</span>
          </div>
        </div>

        <!-- 中央區：3D 車道視覺與三大行車報警指示（胎壓、車門、低電量） -->
        <div class="cluster-center-pod">
          <div class="cluster-alert-strip">
            <button class="cluster-alert-badge ${s.tires.lowPressureWarning ? 'is-active-warn' : ''}" data-action="toggle-tpms-warn" title="點擊切換胎壓報警模擬">
              ${icon('alertTriangle')}<span>${s.tires.lowPressureWarning ? '胎壓 2.15 偏低' : '胎壓 2.9'}</span>
            </button>
            <button class="cluster-alert-badge ${hasOpen ? 'is-active-warn' : ''}" data-action="toggle-door" data-part="fl" title="點擊切換車門狀態">
              ${icon('door')}<span>${hasOpen ? '車門/箱蓋開啟' : '車門已閉'}</span>
            </button>
            <button class="cluster-alert-badge ${lowBatteryWarn ? 'is-active-danger' : ''}" data-action="toggle-low-battery-demo" title="點擊模擬/恢復低電量報警">
              ${icon('battery')}<span>${lowBatteryWarn ? '低電量報警' : '電量正常'}</span>
            </button>
          </div>
          ${s.driveMode.forwardCollisionWarn ? `<div class="cluster-fcw-alert">前車距離過近 (${leadDistInt}m) · 請減速</div>` : ''}
        </div>

        <!-- 右區：實時能耗曲線 (Wh/km) + 前車距離 -->
        <div class="cluster-right-pod">
          <div class="cluster-energy-card">
            <div class="energy-card-head">
              <span>實時能耗</span>
              <strong data-live="cluster-whkm">${lastWhKm} Wh/km</strong>
            </div>
            <canvas id="canvas-cluster-energy" class="cluster-energy-canvas"></canvas>
            <div class="energy-card-foot">
              <span>前車 <strong data-live="cluster-lead-dist">${leadDistInt}</strong>m</span>
              <span>功率 <strong data-live="cluster-power-text">${Math.round(s.displayPowerKw)} kW</strong></span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 5. 抬頭顯示 HUD (擋風玻璃上的無框透明疊加層：含車道偏離提示、跟車距離色帶、貼地導航箭頭，轉向圖標與文字 100% 同步)
   */
  renderHudUI(s) {
    const container = document.getElementById('hud-ui-layer');
    if (!container) return;

    const turnIconName = this.store.getTurnIconName();
    const turnDirLabel = this.store.getTurnDirectionLabel();
    const leadDistInt = Math.round(s.driveMode.displayLeadDistanceM);
    const leftTurnOn = (s.lights.turnSignal === 'left' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;
    const rightTurnOn = (s.lights.turnSignal === 'right' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;

    // 跟車距離色帶狀態（安全綠 / 接近琥珀 / 過近紅）
    const distLevel = (s.driveMode.forwardCollisionWarn || leadDistInt < 16)
      ? 'is-danger'
      : (leadDistInt < 26 ? 'is-warn' : 'is-safe');

    const ldwVal = s.driveMode.laneDepartureWarn;
    const ldwActive = ldwVal === true || ldwVal === 'left' || ldwVal === 'right';

    container.innerHTML = `
      <div class="hud-centered-projection ${ldwActive ? 'has-ldw-warning' : ''}">
        <!-- 左右車道偏離光學警示邊帶 (Lane Departure Warning) -->
        <div class="hud-ldw-rail rail-left ${ldwActive && s.steeringAngle <= 0 ? 'is-active' : ''}"></div>
        <div class="hud-ldw-rail rail-right ${ldwActive && s.steeringAngle > 0 ? 'is-active' : ''}"></div>

        

        <!-- 底部光學投影遙測列 -->
        <div class="hud-telemetry-bar">
          <div class="hud-main-speed">
            <button class="hud-turn-sig ${leftTurnOn ? 'is-on' : ''}" data-action="set-turn-signal" data-dir="left" data-live="hud-turn-left" title="切換左轉向燈">◀</button>
            <span class="hud-speed-number" data-live="hud-speed" data-action="toggle-cruise-demo" style="cursor:pointer;" title="點擊切換巡航車速">${Math.round(s.displaySpeed)}</span>
            <span class="hud-speed-unit">km/h</span>
            <button class="hud-turn-sig ${rightTurnOn ? 'is-on' : ''}" data-action="set-turn-signal" data-dir="right" data-live="hud-turn-right" title="切換右轉向燈">▶</button>
          </div>

          <div class="hud-center-badges">
            <button class="hud-limit-circle" data-action="sync-speed-limit" title="點擊切換道路限速">${s.driveMode.speedLimit}</button>
            <button class="hud-follow-pill ${distLevel}" data-action="cycle-follow-dist" title="點擊調整跟車安全距離">
              <span>前車 <strong data-live="hud-lead-dist">${leadDistInt}</strong> m</span>
            </button>
            <button class="hud-ldw-badge ${ldwActive ? 'is-active' : ''}" data-action="toggle-ldw" title="點擊切換車道偏離警示">${ldwActive ? '車道偏離提示' : '車道保持正常'}</button>
          </div>

          <div class="hud-turn-group" data-action="trigger-nav-voice" style="cursor:pointer;" title="點擊播報路口導航語音">
            <span class="hud-turn-icon-wrap" data-live="hud-turn-icon">${icon(turnIconName, 'hud-turn-svg')}</span>
            <div>
              <div class="hud-turn-dist">
                <strong data-live="hud-turn-dir">${turnDirLabel}</strong> · <span data-live="hud-turn-dist">${Math.round(s.navigation.nextTurnDistanceM)}</span> m
              </div>
              <div class="hud-turn-street" data-live="hud-turn-street">${s.navigation.nextTurnStreet}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 現場演示五端聯動控制面板
   */
  renderDemoControlPanel(s) {
    const body = document.getElementById('demo-panel-body');
    if (!body) return;

    const tilt = s.environment.centerTilt || 'driver';

    body.innerHTML = `
      <div class="demo-group">
        <div class="demo-group-title">動力、擋位與電池 (五端同步)</div>

        <div class="demo-row">
          <span class="demo-label">擋位</span>
          <div class="demo-segmented">
            ${['P', 'R', 'N', 'D'].map((g) => `
              <button class="demo-chip ${s.gear === g ? 'is-active' : ''}" data-action="set-gear" data-gear="${g}">${g}</button>
            `).join('')}
          </div>
        </div>

        <label class="demo-slider-wrap">
          <div class="demo-slider-head">
            <span>車速</span>
            <strong><span data-live="demo-speed">${Math.round(s.displaySpeed)}</span> km/h</strong>
          </div>
          <input type="range" min="0" max="210" step="1" value="${Math.round(s.speed)}" data-action="set-speed" />
        </label>

        <label class="demo-slider-wrap">
          <div class="demo-slider-head">
            <span>電池電量</span>
            <strong><span data-live="demo-soc">${Math.round(s.displaySoc)}</span>%</strong>
          </div>
          <input type="range" min="5" max="100" step="1" value="${Math.round(s.batterySoc)}" data-action="set-soc" />
        </label>
      </div>

      <div class="demo-group">
        <div class="demo-group-title">15.4" 屏幕傾斜、光影與車漆</div>

        <div class="demo-row">
          <span class="demo-label">中控傾斜</span>
          <div class="demo-segmented">
            <button class="demo-chip ${tilt === 'driver' ? 'is-active' : ''}" data-action="set-center-tilt" data-tilt="driver">向駕駛</button>
            <button class="demo-chip ${tilt === 'center' ? 'is-active' : ''}" data-action="set-center-tilt" data-tilt="center">居中</button>
            <button class="demo-chip ${tilt === 'passenger' ? 'is-active' : ''}" data-action="set-center-tilt" data-tilt="passenger">向副駕</button>
          </div>
        </div>

        <div class="demo-row">
          <span class="demo-label">晝夜模式</span>
          <div class="demo-segmented">
            <button class="demo-chip ${s.environment.timeOfDay === 'day' ? 'is-active' : ''}" data-action="set-time" data-val="day">日間</button>
            <button class="demo-chip ${s.environment.timeOfDay === 'night' ? 'is-active' : ''}" data-action="set-time" data-val="night">夜間</button>
          </div>
        </div>

        <div class="demo-row">
          <span class="demo-label">天氣</span>
          <div class="demo-segmented">
            <button class="demo-chip ${s.environment.weather === 'clear' ? 'is-active' : ''}" data-action="set-weather" data-val="clear">晴朗</button>
            <button class="demo-chip ${s.environment.weather === 'rain' ? 'is-active' : ''}" data-action="set-weather" data-val="rain">降雨</button>
            <button class="demo-chip ${s.environment.weather === 'snow' ? 'is-active' : ''}" data-action="set-weather" data-val="snow">降雪</button>
          </div>
        </div>

        <div class="demo-row">
          <span class="demo-label">車漆顏色</span>
          <div class="demo-segmented">
            ${Object.entries(PAINT_PRESETS).map(([key, p]) => `
              <button class="demo-chip ${s.paintColor === key ? 'is-active' : ''}" data-action="set-paint" data-val="${key}">
                ${p.name.split(' ')[0]}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="demo-group">
        <div class="demo-group-title">車身開合與車燈控制</div>
        <div class="demo-btn-grid">
          <button class="demo-btn ${!s.locked ? 'is-active' : ''}" data-action="toggle-lock">
            ${s.locked ? '已上鎖 (P擋)' : '未上鎖'}
          </button>
          <button class="demo-btn ${s.doors.fl ? 'is-active' : ''}" data-action="toggle-door" data-part="fl">
            左前門：${s.doors.fl ? '開' : '關'}
          </button>
          <button class="demo-btn ${s.doors.fr ? 'is-active' : ''}" data-action="toggle-door" data-part="fr">
            右前門：${s.doors.fr ? '開' : '關'}
          </button>
          <button class="demo-btn ${s.doors.frunk ? 'is-active' : ''}" data-action="toggle-door" data-part="frunk">
            前備箱：${s.doors.frunk ? '開' : '關'}
          </button>
          <button class="demo-btn ${s.doors.trunk ? 'is-active' : ''}" data-action="toggle-door" data-part="trunk">
            尾箱：${s.doors.trunk ? '開' : '關'}
          </button>
          <button class="demo-btn ${s.doors.chargePort ? 'is-active' : ''}" data-action="toggle-door" data-part="chargePort">
            充電口：${s.doors.chargePort ? '開' : '關'}
          </button>
        </div>

        <div class="demo-btn-grid" style="margin-top:8px;">
          <button class="demo-btn ${s.lights.turnSignal === 'left' ? 'is-active' : ''}" data-action="set-turn-signal" data-dir="left">左轉向燈</button>
          <button class="demo-btn ${s.lights.turnSignal === 'right' ? 'is-active' : ''}" data-action="set-turn-signal" data-dir="right">右轉向燈</button>
          <button class="demo-btn ${s.lights.hazard ? 'is-active' : ''}" data-action="toggle-hazard">雙閃燈</button>
          <button class="demo-btn ${s.lights.highBeam ? 'is-active' : ''}" data-action="toggle-high-beam">遠光大燈</button>
        </div>
      </div>

      <div class="demo-group">
        <div class="demo-group-title">HUD 與儀錶報警模擬</div>
        <div class="demo-btn-grid">
          <button class="demo-btn ${s.tires.lowPressureWarning ? 'is-active' : ''}" data-action="toggle-tpms-warn">
            低胎壓報警
          </button>
          <button class="demo-btn ${s.driveMode.laneDepartureWarn ? 'is-active' : ''}" data-action="toggle-ldw">
            車道偏離提示
          </button>
          <button class="demo-btn ${s.navigation.voiceSpeaking ? 'is-active' : ''}" data-action="trigger-nav-voice">
            導航語音壓低
          </button>
          <button class="demo-btn ${s.charging.active ? 'is-active' : ''}" data-action="toggle-charging">
            ${s.charging.active ? '超充進行中' : '模擬超充'}
          </button>
        </div>
      </div>
    `;
  }

  renderToastOnly(s) {
    const toastEl = document.getElementById('global-toast');
    if (toastEl) {
      if (s.system.toastMessage) {
        toastEl.textContent = s.system.toastMessage;
        toastEl.className = `global-toast is-visible ${s.system.toastType || 'info'}`;
      } else {
        toastEl.className = 'global-toast';
      }
    }
  }

  renderToastAndModals(s) {
    this.renderToastOnly(s);
    const portal = document.getElementById('modal-portal');
    if (portal) {
      portal.innerHTML = renderDesignDocModal(s) + renderAcceptanceChecklistModal(s);
    }
  }

  updateSliderLiveDOM(s) {
    const fanStrong = document.querySelector('.fan-slider-row strong');
    if (fanStrong) fanStrong.textContent = s.climate.fanSpeed;

    const chargeLabels = document.querySelectorAll('.charging-ctrl-col .settings-label, [data-live="charge-limit-txt"]');
    chargeLabels.forEach((el) => {
      if (el.dataset.live === 'charge-limit-txt') {
        el.textContent = s.charging.limitSoc;
      } else if (el.textContent.includes('充電上限設定')) {
        el.textContent = `充電上限設定 (${s.charging.limitSoc}%)`;
      }
    });

    const limitTicks = document.querySelectorAll('.mobile-battery-limit-tick, .charging-bar-limit');
    limitTicks.forEach((el) => {
      el.style.left = `${s.charging.limitSoc}%`;
    });

    const brightHeaders = document.querySelectorAll('.settings-section h5');
    brightHeaders.forEach((h) => {
      if (h.textContent.includes('外觀主題與屏幕亮度')) {
        h.textContent = `外觀主題與屏幕亮度 (${s.environment.screenBrightness}%)`;
      }
    });
  }

  updateSearchResultsDOM(s) {
    const grid = document.querySelector('.search-results-grid');
    if (!grid) return;
    const q = (s.navigation.searchQuery || '').trim().toLowerCase();
    const catalog = Array.isArray(DESTINATIONS_CATALOG) ? DESTINATIONS_CATALOG : Object.values(DESTINATIONS_CATALOG || {});
    const filtered = catalog.filter((d) => !q || d.name.toLowerCase().includes(q) || d.area.toLowerCase().includes(q));
    grid.innerHTML = filtered.map((d) => `
      <button class="ctrl-btn search-dest-card ${s.navigation.destinationId === d.id ? 'is-selected' : ''}" data-action="select-destination" data-id="${d.id}">
        <div class="s-dest-left">
          ${icon('mapPin')}
          <div>
            <div class="s-dest-title">${d.name}</div>
            <div class="s-dest-sub">${d.area} · ${d.powerKw} kW · 空閒 ${d.available}/${d.total}</div>
          </div>
        </div>
        <div class="s-dest-right">
          <strong>${d.distKm} km</strong>
          <span>約 ${d.etaMin} 分</span>
        </div>
      </button>
    `).join('');
  }

  cacheTelemetryNodes() {
    this.domRefs = {
      fps: document.getElementById('live-fps'),
      mobSoc: document.querySelector('[data-live="soc"]'),
      mobRange: document.querySelector('[data-live="range"]'),
      mobSocBar: document.querySelector('[data-live="mob-soc-bar"]'),
      mobDriveState: document.querySelector('[data-live="mob-drive-state"]'),
      mobLockPill: document.querySelector('[data-live="mob-lock-pill"]'),
      mobLockBtnTxt: document.querySelector('[data-live="mob-lock-btn-txt"]'),
      mobRemKm: document.querySelector('[data-live="mob-rem-km"]'),
      mobMapDist: document.querySelector('[data-live="mob-map-dist"]'),
      mobMapEta: document.querySelector('[data-live="mob-map-eta"]'),
      centerSpeed: document.querySelector('[data-live="center-speed"]'),
      centerLeadDist: document.querySelector('[data-live="center-lead-dist"]'),
      centerSoc: document.querySelector('[data-live="center-soc"]'),
      centerRange: document.querySelector('[data-live="center-range"]'),
      centerLockTxt: document.querySelector('[data-live="center-lock-txt"]'),
      centerRegenBar: document.querySelector('[data-live="center-regen-bar"]'),
      centerDriveBar: document.querySelector('[data-live="center-drive-bar"]'),
      centerTurnDist: document.querySelector('[data-live="center-turn-dist"]'),
      centerTurnDir: document.querySelector('[data-live="center-turn-dir"]'),
      centerTurnStreet: document.querySelector('[data-live="center-turn-street"]'),
      centerEta: document.querySelector('[data-live="center-eta"]'),
      centerRemKm: document.querySelector('[data-live="center-rem-km"]'),
      centerTurnLeft: document.querySelector('[data-live="center-turn-left"]'),
      centerTurnRight: document.querySelector('[data-live="center-turn-right"]'),
      dockVolTxt: document.querySelector('[data-live="dock-vol-txt"]'),
      passTurnDist: document.querySelector('[data-live="pass-turn-dist"]'),
      passTurnDir: document.querySelector('[data-live="pass-turn-dir"]'),
      passRemKm: document.querySelector('[data-live="pass-rem-km"]'),
      passVolTxt: document.querySelector('[data-live="pass-vol-txt"]'),
      clusterSpeed: document.querySelector('[data-live="cluster-speed"]'),
      clusterPowerText: document.querySelector('[data-live="cluster-power-text"]'),
      clusterRegenBar: document.querySelector('[data-live="cluster-regen-bar"]'),
      clusterDriveBar: document.querySelector('[data-live="cluster-drive-bar"]'),
      clusterSoc: document.querySelector('[data-live="cluster-soc"]'),
      clusterRange: document.querySelector('[data-live="cluster-range"]'),
      clusterLockState: document.querySelector('[data-live="cluster-lock-state"]'),
      clusterLeadDist: document.querySelector('[data-live="cluster-lead-dist"]'),
      clusterWhKm: document.querySelector('[data-live="cluster-whkm"]'),
      clusterTurnLeft: document.querySelector('[data-live="cluster-turn-left"]'),
      clusterTurnRight: document.querySelector('[data-live="cluster-turn-right"]'),
      hudSpeed: document.querySelector('[data-live="hud-speed"]'),
      hudLeadDist: document.querySelector('[data-live="hud-lead-dist"]'),
      hudTurnDist: document.querySelector('[data-live="hud-turn-dist"]'),
      hudTurnDir: document.querySelector('[data-live="hud-turn-dir"]'),
      hudTurnStreet: document.querySelector('[data-live="hud-turn-street"]'),
      hudTurnLeft: document.querySelector('[data-live="hud-turn-left"]'),
      hudTurnRight: document.querySelector('[data-live="hud-turn-right"]'),
      demoSpeed: document.querySelector('[data-live="demo-speed"]'),
      demoSoc: document.querySelector('[data-live="demo-soc"]'),
      mediaCurrTime: document.querySelector('[data-live="media-curr-time"]'),
      videoCurrTime: document.querySelector('[data-live="video-curr-time"]')
    };
  }

  updateLiveTelemetryDOM() {
    const s = this.store.getState();
    const r = this.domRefs;
    const speedInt = Math.round(s.displaySpeed);
    const socInt = Math.round(s.displaySoc);
    const rangeKm = this.store.getEstimatedRangeKm();
    const pwr = s.displayPowerKw;
    const turnDist = Math.round(s.navigation.nextTurnDistanceM);
    const leadDistInt = Math.round(s.driveMode.displayLeadDistanceM);
    const turnDirLabel = this.store.getTurnDirectionLabel();
    const lockText = s.locked ? '已上鎖' : '未上鎖';

    const leftTurnOn = (s.lights.turnSignal === 'left' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;
    const rightTurnOn = (s.lights.turnSignal === 'right' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;

    if (r.fps) r.fps.textContent = s.system.fps;
    if (r.mobSoc) r.mobSoc.textContent = `${socInt}%`;
    if (r.mobRange) r.mobRange.textContent = `${rangeKm} km`;
    if (r.mobSocBar) r.mobSocBar.style.width = `${socInt}%`;
    if (r.mobLockPill) r.mobLockPill.textContent = lockText;
    if (r.mobLockBtnTxt) r.mobLockBtnTxt.textContent = lockText;
    if (r.mobRemKm) r.mobRemKm.textContent = s.navigation.remainingKm.toFixed(1);
    if (r.mobMapDist) r.mobMapDist.textContent = s.navigation.remainingKm.toFixed(1);
    if (r.mobMapEta) r.mobMapEta.textContent = s.navigation.etaMinutes;
    if (r.mobDriveState) {
      r.mobDriveState.textContent = speedInt > 0 ? `${speedInt} km/h · ${s.gear} 擋 · 未上鎖` : `已駐停 (${s.gear} 擋) · ${lockText}`;
    }

    if (r.centerSpeed) r.centerSpeed.textContent = speedInt;
    if (r.centerLeadDist) r.centerLeadDist.textContent = leadDistInt;
    if (r.centerSoc) r.centerSoc.textContent = `${socInt}%`;
    if (r.centerRange) r.centerRange.textContent = rangeKm;
    if (r.centerLockTxt) r.centerLockTxt.textContent = lockText;
    if (r.centerTurnLeft) r.centerTurnLeft.classList.toggle('is-blinking', leftTurnOn);
    if (r.centerTurnRight) r.centerTurnRight.classList.toggle('is-blinking', rightTurnOn);

    const regenPct = pwr < 0 ? Math.min(100, Math.abs(pwr / 85) * 100) : 0;
    const drivePct = pwr > 0 ? Math.min(100, (pwr / 260) * 100) : 0;
    if (r.centerRegenBar) r.centerRegenBar.style.width = `${regenPct.toFixed(1)}%`;
    if (r.centerDriveBar) r.centerDriveBar.style.width = `${drivePct.toFixed(1)}%`;

    if (r.centerTurnDist) r.centerTurnDist.textContent = turnDist;
    if (r.centerTurnDir) r.centerTurnDir.textContent = turnDirLabel;
    if (r.centerTurnStreet) r.centerTurnStreet.textContent = s.navigation.nextTurnStreet;
    if (r.centerEta) r.centerEta.textContent = s.navigation.etaMinutes;
    if (r.centerRemKm) r.centerRemKm.textContent = s.navigation.remainingKm.toFixed(1);

    if (r.dockVolTxt) r.dockVolTxt.textContent = `${s.media.effectiveVolume}%`;
    if (r.passVolTxt) r.passVolTxt.textContent = `${s.media.effectiveVolume}%`;

    if (r.passTurnDist) r.passTurnDist.textContent = turnDist;
    if (r.passTurnDir) r.passTurnDir.textContent = turnDirLabel;
    if (r.passRemKm) r.passRemKm.textContent = s.navigation.remainingKm.toFixed(1);

    if (r.clusterSpeed) r.clusterSpeed.textContent = speedInt;
    if (r.clusterPowerText) r.clusterPowerText.textContent = `${pwr >= 0 ? '+' : ''}${Math.round(pwr)} kW`;
    if (r.clusterRegenBar) r.clusterRegenBar.style.width = `${regenPct.toFixed(1)}%`;
    if (r.clusterDriveBar) r.clusterDriveBar.style.width = `${drivePct.toFixed(1)}%`;
    if (r.clusterSoc) r.clusterSoc.textContent = `${socInt}%`;
    if (r.clusterRange) r.clusterRange.textContent = `${rangeKm} km`;
    if (r.clusterLockState) r.clusterLockState.textContent = lockText;
    if (r.clusterLeadDist) r.clusterLeadDist.textContent = leadDistInt;
    if (r.clusterWhKm && s.energyHistory && s.energyHistory.length) {
      r.clusterWhKm.textContent = `${s.energyHistory[s.energyHistory.length - 1]} Wh/km`;
    }
    if (r.clusterTurnLeft) r.clusterTurnLeft.classList.toggle('is-on', leftTurnOn);
    if (r.clusterTurnRight) r.clusterTurnRight.classList.toggle('is-on', rightTurnOn);

    if (r.hudSpeed) r.hudSpeed.textContent = speedInt;
    if (r.hudLeadDist) r.hudLeadDist.textContent = leadDistInt;
    if (r.hudBandDist) r.hudBandDist.textContent = leadDistInt;
    if (r.hudTurnDist) r.hudTurnDist.textContent = turnDist;
    if (r.hudTurnDir) r.hudTurnDir.textContent = turnDirLabel;
    if (r.hudTurnStreet) r.hudTurnStreet.textContent = s.navigation.nextTurnStreet;
    if (r.hudTurnLeft) r.hudTurnLeft.classList.toggle('is-on', leftTurnOn);
    if (r.hudTurnRight) r.hudTurnRight.classList.toggle('is-on', rightTurnOn);

    if (r.demoSpeed) r.demoSpeed.textContent = speedInt;
    if (r.demoSoc) r.demoSoc.textContent = socInt;

    if (r.mediaCurrTime) {
      const sec = s.media.currentTime;
      const m = Math.floor(sec / 60);
      const rem = Math.floor(sec % 60);
      r.mediaCurrTime.textContent = `${m}:${rem < 10 ? '0' : ''}${rem}`;
    }

    if (r.videoCurrTime) {
      const vid = s.media.videos[s.media.videoIndex] || s.media.videos[0];
      const sec = (s.media.videoProgress / 100) * (vid.duration || 312);
      const m = Math.floor(sec / 60);
      const rem = Math.floor(sec % 60);
      r.videoCurrTime.textContent = `${m}:${rem < 10 ? '0' : ''}${rem}`;
    }
  }

  bindGlobalEvents() {
    this.root.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('[data-view-target]');
      if (viewBtn) {
        const target = viewBtn.dataset.viewTarget;
        this.store.update((st) => {
          st.system.focusedScreen = st.system.focusedScreen === target && target !== 'overview' ? 'overview' : target;
        });
        return;
      }

      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;

      const action = actionEl.dataset.action;
      this.handleAction(action, actionEl);
    });

    this.root.addEventListener('input', (e) => {
      const el = e.target;
      const action = el.dataset.action;
      if (!action) return;

      if (action === 'nav-search-input') {
        this.store.update((st) => {
          st.navigation.searchQuery = el.value;
        }, true, ['nav-search-live']);
        return;
      }

      const val = parseFloat(el.value);
      if (action === 'set-speed') {
        this.store.update((st) => {
          if (val > 0 && st.gear === 'P') {
            st.gear = 'D';
            st.locked = false;
            st.sentryMode = false;
            st.doors.fl = false;
            st.doors.fr = false;
            st.doors.rl = false;
            st.doors.rr = false;
            st.doors.frunk = false;
            st.doors.trunk = false;
            st.doors.chargePort = false;
          } else if (val === 0 && st.gear === 'D') {
            st.speed = 0;
          }
          st.speed = st.speedLimitMode ? Math.min(val, 100) : val;
        }, true, ['slider-live']);
      } else if (action === 'set-soc') {
        this.store.update((st) => {
          st.batterySoc = val;
          st.displaySoc = val;
        }, true, ['slider-live']);
      } else if (action === 'set-fan-speed') {
        this.store.update((st) => {
          st.climate.fanSpeed = Math.round(val);
          st.climate.power = true;
        }, true, ['slider-live']);
      } else if (action === 'set-volume') {
        this.store.update((st) => {
          st.media.volume = Math.round(val);
          st.media.muted = false;
        }, true, ['slider-live']);
      } else if (action === 'scrub-music') {
        this.store.update((st) => {
          st.media.currentTime = val;
        }, true, ['slider-live']);
      } else if (action === 'scrub-video') {
        this.store.update((st) => {
          st.media.videoProgress = val;
        }, true, ['slider-live']);
      } else if (action === 'set-charge-limit') {
        this.store.update((st) => {
          st.charging.limitSoc = Math.round(val);
        }, true, ['slider-live']);
      } else if (action === 'set-brightness') {
        this.store.update((st) => {
          st.environment.screenBrightness = Math.round(val);
        }, true, ['slider-live']);
      } else if (action === 'set-setting-range') {
        const path = el.dataset.path || '';
        const parts = path.split('.');
        this.store.update((st) => {
          let cur = st;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]]) cur[parts[i]] = {};
            cur = cur[parts[i]];
          }
          cur[parts[parts.length - 1]] = Math.round(val);
        }, true, ['slider-live']);
      }
    });

    this.root.addEventListener('change', (e) => {
      const el = e.target;
      if (el && el.tagName === 'INPUT' && el.type === 'range') {
        this.renderAllUILayers();
        this.updateLiveTelemetryDOM();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        const s = this.store.getState();
        if (s.media.activeTab === 'game') {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.store.update((st) => {
              st.media.game.playerLane = Math.max(0, st.media.game.playerLane - 1);
            });
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.store.update((st) => {
              st.media.game.playerLane = Math.min(2, st.media.game.playerLane + 1);
            });
          } else if (e.key === ' ') {
            e.preventDefault();
            this.store.update((st) => {
              st.media.game.boostActive = !st.media.game.boostActive;
            });
          }
        }
      });
    }
  }

  handleAction(action, el) {
    const s = this.store.getState();

    switch (action) {
      case 'toggle-demo-drawer':
        this.drawerOpen = !this.drawerOpen;
        this.syncThemeAndBrightness(s);
        break;

      case 'cycle-center-tilt': {
        const order = ['driver', 'center', 'passenger'];
        const cur = s.environment.centerTilt || 'driver';
        const next = order[(order.indexOf(cur) + 1) % order.length];
        this.store.update((st) => {
          st.environment.centerTilt = next;
        });
        const names = { driver: '向駕駛側傾斜', center: '居中平視', passenger: '向副駕側傾斜' };
        this.store.showToast(`17 吋中控橫屏已調整為：${names[next]}`, 'info');
        break;
      }

      case 'set-center-tilt': {
        const tiltVal = el.dataset.tilt || 'driver';
        this.store.update((st) => {
          st.environment.centerTilt = tiltVal;
        });
        const names = { driver: '向駕駛側傾斜', center: '居中平視', passenger: '向副駕側傾斜' };
        this.store.showToast(`17 吋中控橫屏已設為：${names[tiltVal] || tiltVal}`, 'info');
        break;
      }

      case 'toggle-lock':
        this.store.triggerControlAction('mob-lock', () => {
          if (this.store.getState().gear !== 'P') {
            this.store.update((st) => {
              st.gear = 'P';
              st.speed = 0;
              st.displaySpeed = 0;
              st.driveMode.autopilot = false;
              st.doors.fl = false;
              st.doors.fr = false;
              st.doors.rl = false;
              st.doors.rr = false;
              st.doors.frunk = false;
              st.doors.trunk = false;
              st.locked = true;
            });
            this.store.showToast('已自動掛入 P 擋駐停並全車上鎖', 'info');
          } else {
            this.store.update((st) => {
              st.locked = !st.locked;
              if (st.locked) {
                st.speed = 0;
                st.displaySpeed = 0;
                st.doors.fl = false;
                st.doors.fr = false;
                st.doors.rl = false;
                st.doors.rr = false;
                st.doors.frunk = false;
                st.doors.trunk = false;
              } else {
                st.sentryMode = false;
              }
            });
            this.store.showToast(this.store.getState().locked ? '全車已上鎖 (速度 0 km/h)' : '全車已解鎖', 'info');
          }
        });
        break;

      case 'toggle-sentry':
        if (s.gear !== 'P') {
          this.store.update((st) => {
            st.gear = 'P';
            st.speed = 0;
            st.displaySpeed = 0;
            st.driveMode.autopilot = false;
            st.locked = true;
            st.sentryMode = true;
          });
          this.store.showToast('已自動掛入 P 擋駐停並開啟哨兵模式', 'info');
          return;
        }
        this.store.update((st) => {
          st.sentryMode = !st.sentryMode;
          if (st.sentryMode) st.locked = true;
        });
        this.store.showToast(this.store.getState().sentryMode ? '哨兵模式已開啟' : '哨兵模式已關閉', 'info');
        break;

      case 'toggle-valet':
        this.store.update((st) => {
          st.valetMode = !st.valetMode;
          if (st.valetMode) {
            st.driveMode.accel = 'chill';
            st.speedLimitMode = true;
            st.doors.frunk = false;
            if (st.speed > 100) st.speed = 100;
          }
        });
        this.store.showToast(this.store.getState().valetMode ? '代客模式已啟用 (加速改為舒適 · 前備箱鎖定)' : '代客模式已關閉', 'info');
        break;

      case 'toggle-speed-limit-mode':
        this.store.update((st) => {
          st.speedLimitMode = !st.speedLimitMode;
          if (st.speedLimitMode) {
            if (st.speed > 100) st.speed = 100;
            if (st.driveMode.setSpeed > 100) st.driveMode.setSpeed = 100;
          }
        });
        this.store.showToast(this.store.getState().speedLimitMode ? '限速模式已啟用 (最高車速限制 100 km/h)' : '限速模式已關閉', 'info');
        break;

      case 'toggle-pin-drive':
        this.store.update((st) => {
          st.pinToDrive = !st.pinToDrive;
        });
        this.store.showToast(this.store.getState().pinToDrive ? 'PIN 碼駕駛防護已啟用' : 'PIN 碼駕駛已關閉', 'info');
        break;

      case 'toggle-key-active': {
        const kid = el.dataset.id;
        let keyLabel = '';
        let isNowActive = false;
        this.store.update((st) => {
          const item = st.keys.list.find((k) => k.id === kid);
          if (item) {
            item.active = !item.active;
            item.status = item.active ? '已連線' : '已停用';
            keyLabel = item.name;
            isNowActive = item.active;
          }
        });
        if (keyLabel) {
          this.store.showToast(`鑰匙「${keyLabel}」${isNowActive ? '已啟用連線' : '已暫時停用'}`, 'info');
        }
        break;
      }

      case 'toggle-walk-away-lock':
        this.store.update((st) => {
          st.keys.walkAwayLock = !st.keys.walkAwayLock;
        });
        this.store.showToast(this.store.getState().keys.walkAwayLock ? '離車自動上鎖已開啟' : '離車自動上鎖已關閉', 'info');
        break;

      case 'toggle-unlatch-park':
        this.store.update((st) => {
          st.keys.unlatchOnPark = !st.keys.unlatchOnPark;
        });
        this.store.showToast(this.store.getState().keys.unlatchOnPark ? 'P 擋自動解鎖已開啟' : 'P 擋自動解鎖已關閉', 'info');
        break;

      case 'toggle-child-lock':
        this.store.update((st) => {
          st.keys.childLock = !st.keys.childLock;
        });
        this.store.showToast(this.store.getState().keys.childLock ? '後排兒童安全鎖已開啟' : '後排兒童安全鎖已關閉', 'info');
        break;

      case 'toggle-scheduled-departure':
        this.store.update((st) => {
          st.climate.scheduledDeparture.enabled = !st.climate.scheduledDeparture.enabled;
        });
        this.store.showToast(this.store.getState().climate.scheduledDeparture.enabled ? '已啟用 08:15 預約出發' : '已關閉預約出發', 'info');
        break;

      case 'toggle-sched-cabin':
        this.store.update((st) => {
          st.climate.scheduledDeparture.preconditionCabin = !st.climate.scheduledDeparture.preconditionCabin;
          if (st.climate.scheduledDeparture.preconditionCabin) st.climate.scheduledDeparture.enabled = true;
        });
        this.store.showToast(this.store.getState().climate.scheduledDeparture.preconditionCabin ? '預約座艙預調溫已開啟' : '預約座艙預調溫已關閉', 'info');
        break;

      case 'toggle-sched-offpeak':
        this.store.update((st) => {
          st.climate.scheduledDeparture.offPeakCharging = !st.climate.scheduledDeparture.offPeakCharging;
          if (st.climate.scheduledDeparture.offPeakCharging) st.climate.scheduledDeparture.enabled = true;
        });
        this.store.showToast(this.store.getState().climate.scheduledDeparture.offPeakCharging ? '離峰時段優先充電已開啟' : '離峰時段充電已關閉', 'info');
        break;

      case 'toggle-sched-weekdays':
        this.store.update((st) => {
          st.climate.scheduledDeparture.weekdaysOnly = !st.climate.scheduledDeparture.weekdaysOnly;
        });
        this.store.showToast(this.store.getState().climate.scheduledDeparture.weekdaysOnly ? '排程已設為：僅週一至週五工作日' : '排程已設為：每日循環', 'info');
        break;

      case 'trigger-software-update':
        this.store.triggerSoftwareUpdate();
        break;

      case 'toggle-service-item': {
        const sid = el.dataset.id;
        let itemName = '';
        let itemSel = false;
        this.store.update((st) => {
          const it = st.service.items.find((x) => x.id === sid) || st.service.items[0];
          if (it) {
            it.selected = !it.selected;
            itemName = it.name;
            itemSel = it.selected;
          }
          const activeCount = st.service.items.filter((x) => x.selected).length;
          st.service.status = activeCount > 0 ? `已預約 (${activeCount} 項)` : '待選擇項目';
        });
        if (itemName) {
          this.store.showToast(`${itemSel ? '已勾選保養項目' : '已取消保養項目'}：${itemName}`, 'info');
        }
        break;
      }

      case 'reset-trip-a':
        this.store.update((st) => {
          st.trips.tripAKm = 0.0;
          st.trips.tripAWhKm = 142;
        });
        this.store.showToast('行程 A 里程與平均能耗已重置歸零', 'info');
        break;

      case 'replay-trip': {
        const idx = parseInt(el.dataset.idx || '0', 10);
        const destMap = ['roppongi', 'daikanyama', 'odaiba'];
        const targetId = destMap[idx % destMap.length];
        this.store.selectDestination(targetId, true);
        this.mapMediaEngine.resetMapView();
        break;
      }

      case 'toggle-wiper-service':
        this.store.update((st) => {
          st.service.wiperServiceMode = !st.service.wiperServiceMode;
        });
        this.store.showToast(this.store.getState().service.wiperServiceMode ? '雨刮維護模式已開啟 (雨刮臂已抬升至檢修角度)' : '雨刮維護模式已關閉 (雨刮臂已歸位)', 'info');
        break;

      case 'toggle-tow-mode':
        this.store.update((st) => {
          st.service.towMode = !st.service.towMode;
          if (st.service.towMode) {
            st.gear = 'N';
            st.speed = 0;
            st.displaySpeed = 0;
            st.locked = false;
            st.sentryMode = false;
          }
        });
        this.store.showToast(this.store.getState().service.towMode ? '拖車模式已啟用 (已自動掛入 N 空擋解除駐煞)' : '拖車模式已關閉', 'info');
        break;

      case 'send-dest-to-car': {
        const destId = el.dataset.id;
        if (destId) {
          this.store.selectDestination(destId, true);
          this.mapMediaEngine.resetMapView();
        }
        break;
      }

      case 'toggle-route-selector':
        this.store.update((st) => {
          st.navigation.routeSelectorOpen = !st.navigation.routeSelectorOpen;
        });
        break;

      case 'select-route-option': {
        const opt = el.dataset.opt || 'fastest';
        let label = '';
        this.store.update((st) => {
          st.navigation.selectedRouteOption = opt;
          const curDest = DESTINATIONS_CATALOG.find((d) => d.id === st.navigation.destinationId) || DESTINATIONS_CATALOG[0];
          const ro = st.navigation.routeOptions.find((r) => r.id === opt);
          label = ro ? ro.label : opt;
          st.navigation.etaMinutes = Math.max(3, curDest.etaMin + (ro ? ro.deltaMin : 0));
          st.navigation.remainingKm = Math.max(0.8, +(curDest.distKm + (ro ? ro.deltaKm : 0)).toFixed(1));
        });
        this.store.showToast(`導航路線已切換為：${label}`, 'info');
        break;
      }

      case 'set-cam360-view': {
        const vNameMap = { surround: '環視全景', front: '前視廣角', rear: '後視超廣角', fenderL: '左葉子板盲區', fenderR: '右葉子板盲區' };
        const v = el.dataset.view || 'surround';
        this.store.update((st) => {
          st.camera360.activeView = v;
        });
        this.store.showToast(`360° 環視相機已切換至：${vNameMap[v] || v}`, 'info');
        break;
      }

      case 'start-phone-call':
        this.store.update((st) => {
          st.phone.activeCall = { name: el.dataset.name || '聯絡人', role: el.dataset.role || '行動電話' };
        });
        this.store.showToast(`正在透過車載藍牙撥號給 ${el.dataset.name}...`, 'info');
        break;

      case 'end-phone-call':
        this.store.update((st) => {
          st.phone.activeCall = null;
        });
        this.store.showToast('藍牙通話已結束', 'info');
        break;

      case 'toggle-voice-listen': {
        const nextIdx = ((this._voiceCycleIdx || 0) + 1) % s.voice.suggestions.length;
        this._voiceCycleIdx = nextIdx;
        this.handleAction('run-voice-command', { dataset: { idx: String(nextIdx) } });
        break;
      }

      case 'run-voice-command': {
        const idx = parseInt(el.dataset.idx || '0', 10);
        const cmd = s.voice.suggestions[idx] || s.voice.suggestions[0];
        this.store.update((st) => {
          st.voice.lastCommand = cmd;
          if (idx === 0) {
            st.navigation.destinationId = 'roppongi';
            st.navigation.destinationName = '六本木新城超充站';
            st.voice.lastReply = '已為您設定導航至六本木新城超充站，最快路線預計 11 分鐘。';
          } else if (idx === 1) {
            st.climate.power = true;
            st.climate.driverTemp = 21.0;
            st.climate.passengerTemp = 21.0;
            st.voice.lastReply = '已將主駕與副駕空調溫度同步調至 21.0°C。';
          } else if (idx === 2) {
            st.gear = 'P';
            st.speed = 0;
            st.displaySpeed = 0;
            st.doors.frunk = true;
            st.locked = false;
            st.voice.lastReply = '已為您駐停並開啟前備箱。';
          } else {
            st.media.activeTab = 'music';
            st.media.trackIndex = 0;
            st.media.playing = true;
            st.media.videoPlaying = false;
            st.voice.lastReply = '正在播放 Aether Synth Ensemble 之《Midnight Cyber Drive》。';
          }
        });
        this.store.showToast(`語音指令已執行：「${cmd}」`, 'info');
        break;
      }

      case 'mobile-climate-quick':
        this.store.update((st) => {
          if (st.system.mobileActivePage !== 'climate') {
            st.system.mobileActivePage = 'climate';
            st.climate.power = true;
          } else {
            st.climate.power = !st.climate.power;
          }
        });
        this.store.showToast(this.store.getState().climate.power ? `座艙恆溫運行中 (${this.store.getState().climate.driverTemp.toFixed(1)}°C)` : '座艙空調已關閉', 'info');
        break;

      case 'toggle-precondition':
        this.store.triggerControlAction('mob-precond', () => {
          this.store.update((st) => {
            st.climate.preconditioning = !st.climate.preconditioning;
            st.climate.power = st.climate.preconditioning;
          });
          this.store.showToast(this.store.getState().climate.preconditioning ? '已啟動遠程座艙恆溫預熱' : '已關閉座艙預調溫', 'info');
        });
        break;

      case 'set-climate-mode': {
        const mode = el.dataset.mode || 'off';
        const modeNames = { off: '標準空調模式', keep: '恆溫保持模式', dog: '寵物溫控模式', camp: '露營恆溫模式' };
        this.store.update((st) => {
          st.climate.mode = (st.climate.mode === mode && mode !== 'off') ? 'off' : mode;
          if (st.climate.mode !== 'off') {
            st.climate.power = true;
          }
        });
        this.store.showToast(`已切換至：${modeNames[this.store.getState().climate.mode] || mode}`, 'info');
        break;
      }

      case 'find-my-car':
        this.store.triggerFindMyCar();
        break;

      case 'toggle-door': {
        const part = el.dataset.part;
        this.store.triggerControlAction(`mob-${part}`, () => {
          this.store.toggleDoor(part);
        });
        break;
      }

      case 'mobile-nav':
        this.store.update((st) => {
          st.system.mobileActivePage = el.dataset.page || 'home';
        });
        break;

      case 'set-gear': {
        const g = el.dataset.gear;
        this.store.triggerControlAction(`gear-${g}`, () => {
          this.store.setGear(g);
        });
        break;
      }

      case 'toggle-cruise-demo':
        this.store.update((st) => {
          if (st.gear !== 'D') {
            st.gear = 'D';
            st.locked = false;
            st.sentryMode = false;
            st.doors.fl = false;
            st.doors.fr = false;
            st.doors.rl = false;
            st.doors.rr = false;
            st.doors.frunk = false;
            st.doors.trunk = false;
            st.doors.chargePort = false;
            st.speed = 68;
          } else {
            const presets = [68, 88, 108];
            const cur = Math.round(st.speed);
            const next = presets[(presets.indexOf(cur) + 1) % presets.length];
            st.speed = st.speedLimitMode ? Math.min(next, 100) : next;
          }
        });
        this.store.showToast(`巡航目標車速已設為 ${Math.round(this.store.getState().speed)} km/h`, 'info');
        break;

      case 'cycle-follow-dist': {
        let nextLvl = 3;
        let nextDist = 28;
        this.store.update((st) => {
          nextLvl = (st.driveMode.followDistanceLevel % 5) + 1;
          st.driveMode.followDistanceLevel = nextLvl;
          nextDist = 11 + nextLvl * 5.5;
          st.driveMode.leadCarDistanceM = nextDist;
          st.driveMode.displayLeadDistanceM = nextDist;
          st.driveMode.forwardCollisionWarn = nextDist < 17 && st.displaySpeed > 40;
        });
        this.store.showToast(`跟車安全距離已設為 ${nextLvl} 檔 (約 ${Math.round(nextDist)} m)`, 'info');
        break;
      }

      case 'sync-speed-limit': {
        const limits = [60, 80, 100, 120];
        let nextLim = 80;
        this.store.update((st) => {
          const curIdx = limits.indexOf(st.driveMode.speedLimit);
          nextLim = limits[(curIdx + 1) % limits.length];
          st.driveMode.speedLimit = nextLim;
          st.driveMode.setSpeed = st.speedLimitMode ? Math.min(nextLim, 100) : nextLim;
          if (st.gear === 'D' && st.driveMode.autopilot) {
            st.speed = st.driveMode.setSpeed;
          }
        });
        this.store.showToast(`道路限速與巡航設定已同步為 ${nextLim} km/h`, 'info');
        break;
      }

      case 'toggle-autopilot':
        this.store.update((st) => {
          if (st.gear !== 'D' && !st.driveMode.autopilot) {
            st.gear = 'D';
            st.locked = false;
            st.sentryMode = false;
            st.doors.fl = false;
            st.doors.fr = false;
            st.doors.rl = false;
            st.doors.rr = false;
            st.doors.frunk = false;
            st.doors.trunk = false;
            st.doors.chargePort = false;
          }
          st.driveMode.autopilot = !st.driveMode.autopilot;
          if (st.driveMode.autopilot && st.gear === 'D') {
            st.speed = st.speedLimitMode ? Math.min(st.driveMode.setSpeed || 80, 100) : (st.driveMode.setSpeed || 80);
          }
        });
        this.store.showToast(this.store.getState().driveMode.autopilot ? `自動輔助轉向已啟用 (設定車速 ${this.store.getState().driveMode.setSpeed} km/h)` : '已切換為手動駕駛', 'info');
        break;

      case 'toggle-ldw':
        this.store.update((st) => {
          st.driveMode.laneDepartureWarn = !st.driveMode.laneDepartureWarn;
        });
        this.store.showToast(this.store.getState().driveMode.laneDepartureWarn ? '已觸發 HUD 車道偏離提示' : '車道偏離提示已解除', 'warn');
        break;

      case 'toggle-blind-spot':
        this.store.update((st) => {
          st.driveMode.blindSpotCamera = !st.driveMode.blindSpotCamera;
        });
        this.store.showToast(this.store.getState().driveMode.blindSpotCamera ? '打燈盲區影像已開啟' : '打燈盲區影像已關閉', 'info');
        break;

      case 'set-paint': {
        const val = el.dataset.val;
        const pName = PAINT_PRESETS[val]?.name || val;
        this.store.update((st) => {
          st.paintColor = val;
        });
        this.store.showToast(`3D 車漆塗裝已同步為：${pName}`, 'info');
        break;
      }

      case 'temp-step': {
        const zone = el.dataset.zone;
        const delta = parseFloat(el.dataset.delta || '0.5');
        this.store.update((st) => {
          st.climate.power = true;
          if (zone === 'driver') {
            st.climate.driverTemp = Math.max(15.5, Math.min(28.5, st.climate.driverTemp + delta));
            if (st.climate.sync) st.climate.passengerTemp = st.climate.driverTemp;
          } else {
            st.climate.sync = false;
            st.climate.passengerTemp = Math.max(15.5, Math.min(28.5, st.climate.passengerTemp + delta));
          }
        });
        break;
      }

      case 'toggle-climate-power':
        this.store.update((st) => {
          st.climate.power = !st.climate.power;
          if (!st.climate.power) {
            st.climate.mode = 'off';
            st.climate.preconditioning = false;
          }
        });
        this.store.showToast(this.store.getState().climate.power ? '雙溫區熱泵空調已開啟' : '空調電源已關閉', 'info');
        break;

      case 'toggle-climate-auto':
        this.store.update((st) => {
          st.climate.auto = !st.climate.auto;
          if (st.climate.auto) st.climate.power = true;
        });
        this.store.showToast(this.store.getState().climate.auto ? '空調 AUTO 自動風量已開啟' : 'AUTO 自動模式已關閉', 'info');
        break;

      case 'toggle-climate-ac':
        this.store.update((st) => {
          st.climate.ac = !st.climate.ac;
          if (st.climate.ac) st.climate.power = true;
        });
        this.store.showToast(this.store.getState().climate.ac ? 'A/C 壓縮機製冷已開啟' : 'A/C 製冷已關閉', 'info');
        break;

      case 'toggle-climate-sync':
        this.store.update((st) => {
          st.climate.sync = !st.climate.sync;
          if (st.climate.sync) {
            st.climate.passengerTemp = st.climate.driverTemp;
            st.climate.power = true;
          }
        });
        this.store.showToast(this.store.getState().climate.sync ? `主副駕溫區已同步為 ${this.store.getState().climate.driverTemp.toFixed(1)}°C` : '主副駕獨立溫區已分離', 'info');
        break;

      case 'toggle-defrost-front':
        this.store.update((st) => {
          st.climate.defrostFront = !st.climate.defrostFront;
          if (st.climate.defrostFront) {
            st.climate.power = true;
            st.climate.fanSpeed = Math.max(st.climate.fanSpeed, 7);
          }
        });
        this.store.showToast(this.store.getState().climate.defrostFront ? '前擋風玻璃強力除霜已開啟' : '前擋除霜已關閉', 'info');
        break;

      case 'toggle-defrost-rear':
        this.store.update((st) => {
          st.climate.defrostRear = !st.climate.defrostRear;
        });
        this.store.showToast(this.store.getState().climate.defrostRear ? '後擋風玻璃與後視鏡加熱已開啟' : '後擋加熱已關閉', 'info');
        break;

      case 'cycle-seat-heat': {
        const side = el.dataset.side;
        let nextLv = 0;
        this.store.update((st) => {
          if (side === 'left') {
            st.climate.seatHeatLeft = (st.climate.seatHeatLeft + 1) % 4;
            nextLv = st.climate.seatHeatLeft;
          } else {
            st.climate.seatHeatRight = (st.climate.seatHeatRight + 1) % 4;
            nextLv = st.climate.seatHeatRight;
          }
        });
        this.store.showToast(`${side === 'left' ? '主駕' : '副駕'}座椅加熱：${nextLv === 0 ? '關閉' : nextLv + ' 檔'}`, 'info');
        break;
      }

      case 'toggle-charging':
        this.store.update((st) => {
          st.charging.active = !st.charging.active;
          if (st.charging.active) {
            st.doors.chargePort = true;
            st.gear = 'P';
            st.speed = 0;
            st.displaySpeed = 0;
            st.driveMode.autopilot = false;
          }
        });
        this.store.showToast(this.store.getState().charging.active ? '超級充電已啟動 (215 kW 直流快充中)' : '已停止超級充電', 'info');
        break;

      case 'set-charge-preset': {
        const limit = parseInt(el.dataset.limit || '90', 10);
        this.store.update((st) => {
          st.charging.limitSoc = limit;
        });
        this.store.showToast(`充電上限已設定為 ${limit}%`, 'info');
        break;
      }

      case 'open-center-modal': {
        const modal = el.dataset.modal;
        const tab = el.dataset.tab;
        this.store.update((st) => {
          if (st.system.centerActiveModal === modal && (!tab || st.system.settingsTab === tab)) {
            st.system.centerActiveModal = null;
          } else {
            st.system.centerActiveModal = modal;
            if (tab) st.system.settingsTab = tab;
          }
        });
        break;
      }

      case 'close-center-modal':
        this.store.update((st) => {
          st.system.centerActiveModal = null;
        });
        break;

      case 'switch-settings-tab':
        this.store.update((st) => {
          st.system.settingsTab = el.dataset.tab;
        });
        break;

      case 'set-accel-mode': {
        const modeMap = { chill: '舒適', standard: '標準', sport: '運動' };
        this.store.update((st) => {
          st.driveMode.accel = el.dataset.val;
        });
        this.store.showToast(`加速踏板模式已設為：${modeMap[el.dataset.val] || el.dataset.val}`, 'info');
        break;
      }

      case 'set-steering-mode': {
        const stMap = { comfort: '舒適', standard: '標準', sport: '運動' };
        this.store.update((st) => {
          st.driveMode.steering = el.dataset.val;
        });
        this.store.showToast(`轉向手感已設為：${stMap[el.dataset.val] || el.dataset.val}`, 'info');
        break;
      }

      case 'set-light-mode': {
        const lMap = { off: '關閉', parking: '示廓燈', on: '近光燈', auto: '自動 AUTO' };
        this.store.update((st) => {
          st.lights.mode = el.dataset.val;
        });
        this.store.showToast(`外部大燈已切換為：${lMap[el.dataset.val] || el.dataset.val}`, 'info');
        break;
      }

      case 'cycle-light-beam': {
        let msg = '';
        this.store.update((st) => {
          if (st.lights.mode === 'off') {
            st.lights.mode = 'on';
            st.lights.highBeam = false;
            msg = '車燈已切換至：近光燈';
          } else if (!st.lights.highBeam) {
            st.lights.mode = 'on';
            st.lights.highBeam = true;
            msg = '車燈已切換至：遠光大燈';
          } else {
            st.lights.mode = 'off';
            st.lights.highBeam = false;
            msg = '車燈已關閉';
          }
        });
        this.store.showToast(msg, 'info');
        break;
      }

      case 'toggle-high-beam':
        this.store.update((st) => {
          st.lights.highBeam = !st.lights.highBeam;
          if (st.lights.highBeam && st.lights.mode === 'off') st.lights.mode = 'on';
        });
        this.store.showToast(this.store.getState().lights.highBeam ? '遠光大燈已開啟' : '遠光大燈已關閉', 'info');
        break;

      case 'toggle-fog-front':
        this.store.update((st) => {
          st.lights.fogFront = !st.lights.fogFront;
        });
        this.store.showToast(this.store.getState().lights.fogFront ? '前霧燈已開啟' : '前霧燈已關閉', 'info');
        break;

      case 'toggle-ambient-light':
        this.store.update((st) => {
          st.lights.ambient = !st.lights.ambient;
        });
        this.store.showToast(this.store.getState().lights.ambient ? '座艙環艙氛圍燈已開啟' : '座艙氛圍燈已關閉', 'info');
        break;

      case 'toggle-hazard':
        this.store.update((st) => {
          st.lights.hazard = !st.lights.hazard;
        });
        this.store.showToast(this.store.getState().lights.hazard ? '雙閃危險警示燈已開啟' : '雙閃警示燈已關閉', 'warn');
        break;

      case 'set-turn-signal': {
        const dir = el.dataset.dir;
        this.store.update((st) => {
          st.lights.turnSignal = st.lights.turnSignal === dir ? 'off' : dir;
        });
        break;
      }

      case 'set-wiper-mode': {
        const w = el.dataset.val;
        this.store.update((st) => {
          st.wipers.mode = w;
          st.service.wiperServiceMode = false;
        });
        this.store.showToast(`雨刮器已設為：${w === 'off' ? '關閉' : (w === 'auto' ? '自動感應' : w + ' 檔')}`, 'info');
        break;
      }

      case 'select-destination': {
        const destId = el.dataset.id;
        if (destId) {
          this.mapMediaEngine.selectSuperchargerDestination(destId);
          this.store.update((st) => {
            if (st.system.centerActiveModal === 'search') st.system.centerActiveModal = null;
          });
        }
        break;
      }

      case 'map-zoom': {
        const delta = parseFloat(el.dataset.delta || '0.15');
        this.mapMediaEngine.zoomMap(delta);
        break;
      }

      case 'toggle-map-traffic':
        this.store.update((st) => {
          st.navigation.trafficLayer = !st.navigation.trafficLayer;
        });
        this.store.showToast(this.store.getState().navigation.trafficLayer ? '實時路況圖層已顯示' : '實時路況圖層已隱藏', 'info');
        break;

      case 'toggle-map-sc':
        this.store.update((st) => {
          st.navigation.superchargerLayer = !st.navigation.superchargerLayer;
        });
        this.store.showToast(this.store.getState().navigation.superchargerLayer ? '超級充電站標記已顯示' : '超級充電站標記已隱藏', 'info');
        break;

      case 'reset-map-view':
        this.mapMediaEngine.resetMapView();
        this.store.showToast('導航地圖已回中跟隨自車', 'info');
        break;

      case 'trigger-nav-voice':
        this.store.triggerNavVoicePrompt();
        break;

      case 'cycle-media-source':
        this.store.update((st) => {
          if (st.media.activeTab === 'video') {
            st.media.activeTab = 'music';
            st.media.playing = true;
            st.media.videoPlaying = false;
          } else {
            st.media.activeTab = 'video';
            st.media.videoPlaying = true;
            st.media.playing = false;
          }
        });
        this.store.showToast(this.store.getState().media.activeTab === 'video' ? '已切換至：副駕劇院 4K 短片音軌' : '已切換至：座艙無損音樂播放', 'info');
        break;

      case 'set-passenger-tab': {
        const nextTab = el.dataset.tab;
        this.store.update((st) => {
          st.media.activeTab = nextTab;
          if (nextTab === 'video') {
            st.media.videoPlaying = true;
            st.media.playing = false;
          } else if (nextTab === 'music') {
            st.media.playing = true;
            st.media.videoPlaying = false;
          } else if (nextTab === 'game') {
            st.media.game.running = true;
          }
        });
        break;
      }

      case 'set-eq-preset': {
        const eqNames = { immersive: '全景聲沉浸音場', studio: '錄音室原聲', bass: '超重低音增強' };
        const eq = el.dataset.eq || 'immersive';
        this.store.update((st) => {
          st.media.eqPreset = eq;
        });
        this.store.showToast(`座艙音場已切換為：${eqNames[eq] || eq}`, 'info');
        break;
      }

      case 'media-toggle':
        this.store.update((st) => {
          st.media.playing = !st.media.playing;
          if (st.media.playing) st.media.videoPlaying = false;
        });
        break;

      case 'media-prev':
        this.store.update((st) => {
          st.media.trackIndex = (st.media.trackIndex - 1 + st.media.tracks.length) % st.media.tracks.length;
          st.media.currentTime = 0;
          st.media.playing = true;
          st.media.videoPlaying = false;
        });
        break;

      case 'media-next':
        this.store.update((st) => {
          st.media.trackIndex = (st.media.trackIndex + 1) % st.media.tracks.length;
          st.media.currentTime = 0;
          st.media.playing = true;
          st.media.videoPlaying = false;
        });
        break;

      case 'select-track':
        this.store.update((st) => {
          st.media.trackIndex = parseInt(el.dataset.idx, 10) || 0;
          st.media.currentTime = 0;
          st.media.playing = true;
          st.media.videoPlaying = false;
        });
        break;

      case 'toggle-video-play':
        this.store.update((st) => {
          st.media.videoPlaying = !st.media.videoPlaying;
          if (st.media.videoPlaying) st.media.playing = false;
        });
        break;

      case 'video-prev':
        this.store.update((st) => {
          st.media.videoIndex = (st.media.videoIndex - 1 + st.media.videos.length) % st.media.videos.length;
          st.media.videoProgress = 0;
          st.media.videoPlaying = true;
          st.media.playing = false;
        });
        break;

      case 'video-next':
        this.store.update((st) => {
          st.media.videoIndex = (st.media.videoIndex + 1) % st.media.videos.length;
          st.media.videoProgress = 0;
          st.media.videoPlaying = true;
          st.media.playing = false;
        });
        break;

      case 'seek-video': {
        const deltaSec = parseFloat(el.dataset.delta || '15');
        this.store.update((st) => {
          const vid = st.media.videos[st.media.videoIndex] || st.media.videos[0];
          const deltaPct = (deltaSec / (vid.duration || 300)) * 100;
          st.media.videoProgress = Math.max(0, Math.min(100, st.media.videoProgress + deltaPct));
        });
        break;
      }

      case 'cycle-video-speed': {
        const speeds = [1.0, 1.25, 1.5, 2.0];
        this.store.update((st) => {
          const curr = st.media.videoSpeed || 1.0;
          st.media.videoSpeed = speeds[(speeds.indexOf(curr) + 1) % speeds.length];
        });
        this.store.showToast(`劇院倍速已設為 ${this.store.getState().media.videoSpeed.toFixed(2).replace(/\.00$/, '.0')}x`, 'info');
        break;
      }

      case 'select-video':
        this.store.update((st) => {
          st.media.videoIndex = parseInt(el.dataset.idx, 10) || 0;
          st.media.videoProgress = 12;
          st.media.videoPlaying = true;
          st.media.playing = false;
        });
        break;

      case 'select-game-stage': {
        const idx = parseInt(el.dataset.idx, 10) || 0;
        let stageName = '';
        this.store.update((st) => {
          st.media.game.stageIndex = idx;
          st.media.game.running = true;
          st.media.game.score = 0;
          const stg = st.media.game.stages && st.media.game.stages[idx];
          if (stg) stageName = stg.name;
        });
        if (stageName) {
          this.store.showToast(`已載入街機賽段：${stageName}`, 'info');
        }
        break;
      }

      case 'game-toggle':
        this.store.update((st) => {
          st.media.game.running = !st.media.game.running;
        });
        break;

      case 'game-lane': {
        const dir = parseInt(el.dataset.dir || '0', 10);
        this.store.update((st) => {
          st.media.game.playerLane = Math.max(0, Math.min(2, st.media.game.playerLane + dir));
        });
        break;
      }

      case 'game-boost':
        this.store.update((st) => {
          st.media.game.boostActive = !st.media.game.boostActive;
          if (st.media.game.boostActive) st.media.game.running = true;
        });
        this.store.showToast(this.store.getState().media.game.boostActive ? '街機賽車：氮氣加速全開！' : '氮氣加速已關閉', 'info');
        break;

      case 'vol-step': {
        const delta = parseInt(el.dataset.delta || '5', 10);
        this.store.update((st) => {
          st.media.muted = false;
          st.media.volume = Math.max(0, Math.min(100, st.media.volume + delta));
        });
        break;
      }

      case 'toggle-mute':
        this.store.update((st) => {
          st.media.muted = !st.media.muted;
        });
        this.store.showToast(this.store.getState().media.muted ? '全車音響已靜音' : `音響已恢復 (${this.store.getState().media.volume}%)`, 'info');
        break;

      case 'set-time':
        this.store.update((st) => {
          st.environment.timeOfDay = el.dataset.val;
        });
        this.store.showToast(el.dataset.val === 'day' ? '已切換至日間淺色模式' : '已切換至夜間深色模式', 'info');
        break;

      case 'set-weather': {
        const wMap = { clear: '晴朗無雲', rain: '降雨環境 (自動啟動雨刮與近光燈)', snow: '降雪環境 (自動啟動雨刮與近光燈)' };
        this.store.update((st) => {
          st.environment.weather = el.dataset.val;
        });
        this.store.showToast(`環境天氣已切換為：${wMap[el.dataset.val] || el.dataset.val}`, 'info');
        break;
      }

      case 'toggle-tpms-warn':
        this.store.update((st) => {
          st.tires.lowPressureWarning = !st.tires.lowPressureWarning;
        });
        this.store.showToast(this.store.getState().tires.lowPressureWarning ? '已觸發左後輪胎壓偏低 (2.15 Bar) 報警' : '四輪胎壓已恢復正常 (2.90 Bar)', 'warn');
        break;

      case 'toggle-low-battery-demo':
        this.store.update((st) => {
          const nextSoc = st.batterySoc <= 20 ? 82 : 15;
          st.batterySoc = nextSoc;
          st.displaySoc = nextSoc;
        });
        this.store.showToast(this.store.getState().batterySoc <= 20 ? '已模擬低電量報警狀態 (15%)' : '電池電量已恢復正常 (82%)', 'warn');
        break;

      case 'open-design-doc':
        this.store.update((st) => {
          st.system.showDesignDoc = true;
        });
        break;

      case 'close-design-doc':
        this.store.update((st) => {
          st.system.showDesignDoc = false;
        });
        break;

      case 'open-checklist-modal':
        this.store.update((st) => {
          st.system.showChecklistModal = true;
        });
        break;

      case 'close-checklist-modal':
        this.store.update((st) => {
          st.system.showChecklistModal = false;
        });
        break;

      case 'open-sub-app': {
        const appId = el.dataset.app || 'energy';
        this.store.update((st) => {
          if (!st.appsCenter) st.appsCenter = {};
          st.appsCenter.activeSubApp = appId;
          if (appId === 'music') {
            st.media.activeTab = 'music';
            st.media.playing = true;
            st.media.videoPlaying = false;
          } else if (appId === 'theater') {
            st.media.activeTab = 'video';
            st.media.videoPlaying = true;
            st.media.playing = false;
          } else if (appId === 'arcade') {
            st.media.activeTab = 'game';
            st.media.game.running = true;
          }
        });
        break;
      }

      case 'set-browser-topic': {
        const topic = el.dataset.topic || 'supercharger';
        this.store.update((st) => {
          if (!st.appsCenter) st.appsCenter = {};
          st.appsCenter.browserTopic = topic;
        });
        break;
      }

      case 'set-toybox-mode': {
        const mode = el.dataset.mode || 'campfire';
        this.store.update((st) => {
          if (!st.appsCenter) st.appsCenter = {};
          st.appsCenter.toyboxMode = mode;
          if (mode === 'campfire') {
            st.climate.power = true;
            st.climate.driverTemp = 24.5;
            st.climate.passengerTemp = 24.5;
          }
        });
        this.store.showToast(`玩具箱已切換至：${mode === 'campfire' ? '浪漫壁爐模式' : (mode === 'rainbow' ? '彩虹車道視覺' : '車外燈光秀')}`, 'info');
        break;
      }

      case 'dial-key': {
        const digit = el.dataset.digit || '';
        this.store.update((st) => {
          const cur = st.phone.dialBuffer || '';
          if (cur.length < 15) st.phone.dialBuffer = cur + digit;
        });
        break;
      }

      case 'dial-backspace': {
        this.store.update((st) => {
          const cur = st.phone.dialBuffer || '';
          st.phone.dialBuffer = cur.slice(0, -1);
        });
        break;
      }

      case 'dial-call': {
        const num = this.store.getState().phone.dialBuffer || '000-8610-2049';
        this.store.update((st) => {
          st.phone.activeCall = {
            name: `撥號通話 (${num})`,
            role: '車載藍牙直撥',
            number: num
          };
        });
        this.store.showToast(`正在撥打虛構號碼：${num}`, 'info');
        break;
      }

      case 'set-voice-phase': {
        const ph = el.dataset.phase || 'listening';
        this.store.update((st) => {
          st.voice.phase = ph;
          st.voice.listening = ph === 'listening';
          if (ph === 'listening') {
            st.voice.lastReply = '正在聆聽座艙語音輸入，請說出車控或導航指令...';
          } else if (ph === 'recognizing') {
            st.voice.lastReply = '神經網路語義解析中：「將空調調至 21 度並導航前往六本木」...';
          } else {
            st.voice.lastReply = '已將雙區空調設為 21.0°C 並更新導航路線';
          }
        });
        break;
      }

      case 'set-vent-dir': {
        const dir = el.dataset.dir || 'face';
        this.store.update((st) => {
          st.climate.ventDirection = dir;
          st.climate.power = true;
        });
        break;
      }

      case 'toggle-recirc':
        this.store.update((st) => {
          st.climate.recirculate = !st.climate.recirculate;
        });
        break;

      case 'toggle-bioweapon':
        this.store.update((st) => {
          st.climate.bioweaponDefense = !st.climate.bioweaponDefense;
          if (st.climate.bioweaponDefense) {
            st.climate.power = true;
            st.climate.fanSpeed = 10;
          }
        });
        this.store.showToast(this.store.getState().climate.bioweaponDefense ? 'HEPA 生物武器防禦正壓過濾已啟動' : 'HEPA 生物防禦已關閉', 'info');
        break;

      case 'toggle-wheel-heat':
        this.store.update((st) => {
          st.climate.steeringWheelHeat = !st.climate.steeringWheelHeat;
        });
        break;

      case 'cycle-rear-heat':
        this.store.update((st) => {
          const next = ((st.climate.rearLeftHeat || 0) + 1) % 4;
          st.climate.rearLeftHeat = next;
          st.climate.rearRightHeat = next;
        });
        break;

      case 'toggle-setting-bool': {
        const path = el.dataset.path || '';
        const parts = path.split('.');
        this.store.update((st) => {
          let cur = st;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]]) cur[parts[i]] = {};
            cur = cur[parts[i]];
          }
          const k = parts[parts.length - 1];
          cur[k] = !cur[k];
        });
        break;
      }

      case 'set-setting-enum': {
        const path = el.dataset.path || '';
        const val = el.dataset.val;
        const parts = path.split('.');
        this.store.update((st) => {
          let cur = st;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]]) cur[parts[i]] = {};
            cur = cur[parts[i]];
          }
          const k = parts[parts.length - 1];
          cur[k] = isNaN(Number(val)) ? val : Number(val);
        });
        break;
      }

      default:
        break;
    }
  }
}
