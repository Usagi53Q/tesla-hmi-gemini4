/**
 * TESLA COCKPIT HMI — FIVE-SCREEN UI & TRUE COCKPIT PERSPECTIVE CONTROLLER
 * 精修重點：
 * 1. 座艙總覽改為真實座艙透視場景：擋風玻璃疊加居中小視窗 HUD、方向盤後方配置 2.85:1 儀錶盤、方向盤旁配置中控屏、副駕前方配置副駕屏、場景旁放置手機
 * 2. 手機 App 深度完善：3D 車模頂部實時狀態膠囊（車內溫度、哨兵模式、車鎖狀態）、電量與充電上限進度條、首頁 5 鍵一鍵車控（上鎖、空調、前備箱、尾箱、尋車）、恆溫/寵物/露營模式、80%/100% 充電預設
 * 3. 副駕娛樂屏深度完善：Sonic Studio（黑膠唱盤 + 單色細線頻譜 + 實時同步歌詞 + 沉浸環繞/原聲/低音音場切換）、Tesla Theater（三部 4K 多層次實時渲染影片 + 快退/快進/倍速切換）、Tesla Arcade（3D 高速公路賽車）
 * 4. 五端聯動控制面板 100% 即時視覺反饋：解除行駛中對前備箱/尾箱/充電口的點擊封鎖，並在儀錶盤、中控屏、HUD 同步顯示轉向燈閃爍、遠光燈、雙閃燈、雨雪雨刮與車門開啟狀態指示
 */

import { icon } from './icons.js?v=14';
import { PAINT_PRESETS } from '../engine/SceneEngine.js?v=14';
import { renderDesignDocModal, renderAcceptanceChecklistModal } from './DesignDocModal.js?v=14';

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

    if (typeof window !== 'undefined') {

      window.addEventListener('tesla-glb-progress', (e) => {
        this.glbLoadProgress = e.detail?.percent || 0;
        const pill = document.getElementById('glb-loading-pill');
        if (pill) {
          pill.textContent = `3D 模型 ${this.glbLoadProgress}%`;
        }
      });
      window.addEventListener('tesla-glb-loaded', () => {
        this.glbLoaded = true;
        const pill = document.getElementById('glb-loading-pill');
        if (pill) {
          pill.textContent = '高精 3D 已就緒';
          pill.className = 'mob-vp-pill is-active';
          setTimeout(() => {
            if (pill) pill.style.display = 'none';
          }, 3500);
        }
      });
    }

    this.mountShell();
    this.syncThemeAndBrightness(this.store.getState());
    this.registerCanvases();
    this.bindGlobalEvents();

    this.renderAllUILayers();
    this.updateLiveTelemetryDOM();

    this.store.subscribe((state, changedPaths) => {
      this.syncThemeAndBrightness(state);
      if (changedPaths.length === 1 && changedPaths[0] === 'telemetry') {
        this.updateLiveTelemetryDOM();
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
    this.root.innerHTML = `
      <div class="cockpit-shell" id="cockpit-shell" data-view="${focused}" data-drawer="closed">
        <header class="cockpit-topbar">
          <div class="topbar-brand">
            <span class="tesla-wordmark">TESLA</span>
            <span class="topbar-divider"></span>
            <span class="topbar-title">智能座艙 HMI 實時系統</span>
            <span class="disclaimer-pill">概念設計，非官方產品</span>
          </div>

          <nav class="view-switcher" aria-label="五端視角切換">
            <button class="view-tab ${focused === 'overview' ? 'is-active' : ''}" data-view-target="overview">${icon('grid', 'tab-icon')} 座艙透視總覽</button>
            <button class="view-tab ${focused === 'mobile' ? 'is-active' : ''}" data-view-target="mobile">1. 手機 App</button>
            <button class="view-tab ${focused === 'center' ? 'is-active' : ''}" data-view-target="center">2. 中控駕駛屏</button>
            <button class="view-tab ${focused === 'passenger' ? 'is-active' : ''}" data-view-target="passenger">3. 副駕娛樂屏</button>
            <button class="view-tab ${focused === 'cluster' ? 'is-active' : ''}" data-view-target="cluster">4. 儀錶盤</button>
            <button class="view-tab ${focused === 'hud' ? 'is-active' : ''}" data-view-target="hud">5. 抬頭顯示 HUD</button>
          </nav>

          <div class="topbar-actions">
            <div class="fps-badge" title="WebGL2 實時幀率">
              <span class="fps-dot"></span>
              <span id="live-fps">60</span> FPS
            </div>
            <button class="action-pill-btn" data-action="open-design-doc">
              ${icon('doc', 'inline-icon')} 設計文檔
            </button>
            <button class="action-pill-btn" data-action="open-checklist-modal">
              ${icon('checkCircle', 'inline-icon')} 驗收自檢
            </button>
            <button class="action-pill-btn drawer-toggle-btn" id="drawer-toggle-btn" data-action="toggle-demo-drawer">
              ${icon('settings', 'inline-icon')} <span id="drawer-toggle-label">展開控制面板</span>
            </button>
          </div>
        </header>

        <main class="cockpit-main">
          <!-- 真實座艙透視總覽舞台 (True Perspective Interior Cockpit Stage) -->
          <div class="screens-stage" id="screens-stage">
            <!-- 端點 1：手機 App（放置在座艙場景左側旁，鎖定真實 iPhone 9:19 比例） -->
            <section class="screen-unit unit-mobile" data-screen-id="mobile">
              <div class="screen-unit-label">
                <span>01 · 手機 App</span>
                <button class="focus-toggle-btn" data-view-target="mobile" title="放大檢視手機 App">${icon('expand')}</button>
              </div>
              <div class="physical-iphone-frame">
                <div class="iphone-dynamic-island">
                  <span class="island-camera"></span>
                </div>
                <div class="screen-glass-glare"></div>
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

            <!-- 座艙內部透視主艙體：前擋風玻璃疊加 HUD + 方向盤與正後方儀錶盤 + 方向盤旁中控屏 + 副駕前方娛樂屏 -->
            <div class="cockpit-cabin-frame">
              <div class="cockpit-architecture" aria-hidden="true">
                <div class="cockpit-windshield-glass">
                  <div class="windshield-pillar-left"></div>
                  <div class="windshield-pillar-right"></div>
                  <div class="windshield-horizon-line"></div>
                </div>
                <div class="cockpit-dash-wing">
                  <div class="dash-air-slot"></div>
                </div>
              </div>

              <!-- 上層：前擋風玻璃視野區（HUD 疊加於方向盤正上方擋風玻璃，無多餘外層邊框，場景提亮可辨識） -->
              <div class="cockpit-windshield-row">
                <section class="screen-unit unit-hud" data-screen-id="hud">
                  <div class="screen-unit-label">
                    <span>05 · 擋風玻璃 HUD</span>
                    <button class="focus-toggle-btn" data-view-target="hud" title="放大檢視 HUD">${icon('expand')}</button>
                  </div>
                  <div class="hud-dark-surround">
                    <div class="physical-hud-window">
                      <canvas id="canvas-hud-3d" class="screen-3d-canvas hud-canvas"></canvas>
                      <div id="hud-ui-layer" class="hud-ui-layer"></div>
                    </div>
                  </div>
                </section>
              </div>

              <!-- 下層：橫貫式儀錶台三屏透視區（左：方向盤後儀錶盤 + 方向盤前景；中：方向盤旁中控屏；右：副駕前方娛樂屏） -->
              <div class="cockpit-dashboard-row">
                <div class="driver-column-stack">
                  <!-- 端點 4：儀錶盤（嵌入於方向盤正後方，真實 2.85:1 比例，內容居中放大且自車完整不截斷） -->
                  <section class="screen-unit unit-cluster" data-screen-id="cluster">
                    <div class="screen-unit-label">
                      <span>04 · 方向盤後儀錶盤 (2.85:1)</span>
                      <button class="focus-toggle-btn" data-view-target="cluster" title="放大檢視儀錶盤">${icon('expand')}</button>
                    </div>
                    <div class="cluster-proportion-wrap">
                      <div class="physical-bezel bezel-cluster">
                        <div class="screen-glass-glare"></div>
                        <canvas id="canvas-cluster-3d" class="screen-3d-canvas cluster-canvas"></canvas>
                        <div id="cluster-ui-layer" class="cluster-ui-layer"></div>
                      </div>
                    </div>
                  </section>

                  <!-- 方向盤前景輪廓（緊貼儀錶盤下緣正前方） -->
                  <div class="cockpit-steering-assembly" aria-hidden="true">
                    <div class="steering-wheel-rim">
                      <div class="steering-spoke-left"></div>
                      <div class="steering-spoke-right"></div>
                      <div class="steering-hub"><span>T</span></div>
                    </div>
                  </div>
                </div>

                <!-- 端點 2：中控駕駛屏（位於方向盤右側中央，嚴格鎖定 1920x1200 16:10 比例） -->
                <section class="screen-unit unit-center" data-screen-id="center">
                  <div class="screen-unit-label">
                    <span>02 · 中控駕駛屏 (1920×1200)</span>
                    <button class="focus-toggle-btn" data-view-target="center" title="放大檢視中控屏">${icon('expand')}</button>
                  </div>
                  <div class="physical-bezel bezel-center">
                    <div class="screen-glass-glare"></div>
                    <div class="center-screen-grid">
                      <div class="center-left-pane">
                        <canvas id="canvas-center-3d" class="screen-3d-canvas center-3d-canvas"></canvas>
                        <div id="center-left-overlay" class="center-left-overlay"></div>
                      </div>

                      <div class="center-right-pane">
                        <canvas id="canvas-center-map" class="center-map-canvas"></canvas>
                        <div id="center-right-overlay" class="center-right-overlay"></div>
                      </div>

                      <div id="center-modal-layer" class="center-modal-layer"></div>
                      <footer id="center-dock-layer" class="center-dock-bar"></footer>
                    </div>
                  </div>
                </section>

                <!-- 端點 3：副駕娛樂屏（位於副駕正前方儀錶台，鎖定 16:10 比例，左欄視覺+控制、右欄從頂部排滿 10 首播放列表） -->
                <section class="screen-unit unit-passenger" data-screen-id="passenger">
                  <div class="screen-unit-label">
                    <span>03 · 副駕娛樂屏</span>
                    <button class="focus-toggle-btn" data-view-target="passenger" title="放大檢視副駕娛樂屏">${icon('expand')}</button>
                  </div>
                  <div class="physical-bezel bezel-passenger">
                    <div class="screen-glass-glare"></div>
                    <div class="passenger-screen-inner">
                      <div id="passenger-header-layer" class="passenger-header-layer"></div>
                      <div id="passenger-main-columns" class="passenger-main-columns">
                        <div class="passenger-left-col">
                          <div class="passenger-stage-wrap">
                            <canvas id="canvas-passenger-visual" class="passenger-visual-canvas"></canvas>
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
          </div>

          <!-- 右側可收合側欄：現場演示聯動控制面板 (Collapsible Sidebar Drawer) -->
          <aside class="demo-control-sidebar" id="demo-control-sidebar" aria-label="現場演示聯動控制面板">
            <button class="drawer-edge-handle" data-action="toggle-demo-drawer" title="展開/收合控制面板">
              ${icon('chevronLeft', 'handle-chevron')}
              <span>控制面板</span>
            </button>
            <div class="demo-sidebar-inner">
              <div class="demo-sidebar-header">
                <div>
                  <div class="demo-kicker">VEHICLE STATE CONTROLLER</div>
                  <h2 class="demo-title">五端聯動控制面板</h2>
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
            <strong>概念設計，非官方產品</strong> · Tesla 品牌新能源車五端智能座艙 HMI 實時演示系統
          </div>
          <div class="footer-right">
            <span>3D 模型：<a href="https://sketchfab.com/3d-models/tesla-2018-model-3-5ef9b845aaf44203b6d04e2c677e444f" target="_blank" rel="noopener noreferrer">Tesla 2018 Model 3 by Ameer Studio (Sketchfab, CC-BY 4.0)</a></span>
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

    this.mapMediaEngine.registerMapCanvas(document.getElementById('canvas-center-map'));
    this.mapMediaEngine.registerMediaCanvas(document.getElementById('canvas-passenger-visual'));
  }

  syncThemeAndBrightness(state) {
    const theme = state.environment.timeOfDay;
    if (document.documentElement.getAttribute('data-theme') !== theme) {
      document.documentElement.setAttribute('data-theme', theme);
    }
    const shell = document.getElementById('cockpit-shell');
    if (shell) {
      shell.setAttribute('data-view', state.system.focusedScreen);
      shell.setAttribute('data-drawer', this.drawerOpen ? 'open' : 'closed');
      shell.style.setProperty('--screen-brightness', (state.environment.screenBrightness / 100).toFixed(2));
    }
    const toggleLbl = document.getElementById('drawer-toggle-label');
    if (toggleLbl) {
      toggleLbl.textContent = this.drawerOpen ? '收合控制面板' : '展開控制面板';
    }
    document.querySelectorAll('.view-switcher .view-tab').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.viewTarget === state.system.focusedScreen);
    });
  }

  renderAllUILayers() {
    const s = this.store.getState();
    this.syncThemeAndBrightness(s);

    this.renderMobileUI(s);
    this.renderCenterLeftOverlay(s);
    this.renderCenterRightOverlay(s);
    this.renderCenterModalLayer(s);
    this.renderCenterDock(s);
    this.renderPassengerUI(s);
    this.renderClusterUI(s);
    this.renderHudUI(s);
    this.renderDemoControlPanel(s);
    this.renderToastAndModals(s);
    this.cacheTelemetryNodes();
  }

  /**
   * 1. 手機 App (完整旗艦版 Tesla App 體驗：3D 視窗實時膠囊、電量進度條、5 鍵快捷車控、恆溫/寵物/露營模式、充電預設)
   */
  renderMobileUI(s) {
    const container = document.getElementById('mobile-ui-layer');
    const badgeContainer = document.getElementById('mobile-viewport-badges');
    if (!container) return;

    const rangeKm = this.store.getEstimatedRangeKm();
    const page = s.system.mobileActivePage;
    const hasOpen = this.store.hasOpenDoorOrTrunk();

    if (badgeContainer) {
      let glbPillHtml = '';
      if (!this.glbLoaded) {
        const text = this.glbLoadProgress !== null ? `3D 模型 ${this.glbLoadProgress}%` : '3D 載入中...';
        glbPillHtml = `<span id="glb-loading-pill" class="mob-vp-pill is-loading-asset">${text}</span>`;
      }

      badgeContainer.innerHTML = `
        <span class="mob-vp-pill">${s.locked ? '已上鎖' : '已解鎖'}</span>
        <span class="mob-vp-pill ${s.sentryMode ? 'is-active' : ''}" data-action="toggle-sentry" title="點擊切換哨兵模式">
          哨兵 ${s.sentryMode ? '開啟' : '關閉'}
        </span>
        <span class="mob-vp-pill">車內 ${s.climate.cabinTemp.toFixed(0)}°C</span>
        ${glbPillHtml}
      `;
    }

    const lockCtrl = this.getControlStateAttrs('mob-lock', !s.locked);
    const climateCtrl = this.getControlStateAttrs('mob-precond', s.climate.preconditioning || s.climate.power);
    const frunkQuickCtrl = this.getControlStateAttrs('mob-q-frunk', s.doors.frunk);
    const trunkQuickCtrl = this.getControlStateAttrs('mob-q-trunk', s.doors.trunk);
    const findCtrl = this.getControlStateAttrs('mob-find', s.findMyCarActive);

    let subPageHtml = '';

    if (page === 'home') {
      const openList = [];
      if (s.doors.frunk) openList.push('前備箱');
      if (s.doors.trunk) openList.push('尾箱');
      if (s.doors.fl || s.doors.fr || s.doors.rl || s.doors.rr) openList.push('車門');
      if (s.doors.chargePort) openList.push('充電口');
      const doorSummary = openList.length > 0 ? `已開啟：${openList.join('、')}` : '全車已閉鎖 · 安全待命';

      const climateModeLabel = s.climate.mode === 'dog' ? '寵物模式運行中' : (s.climate.mode === 'camp' ? '露營模式運行中' : (s.climate.mode === 'keep' ? '車廂恆溫保持' : `設定 ${s.climate.driverTemp.toFixed(1)}°C`));

      subPageHtml = `
        <div class="mobile-page page-fade-in">
          <div class="mobile-quick-row">
            <button class="${lockCtrl.className} mobile-circle-btn" data-action="toggle-lock" ${lockCtrl.attrs}>
              ${lockCtrl.isLoading ? icon('spinner') : icon(s.locked ? 'lock' : 'unlock')}
              <span>${s.locked ? '已上鎖' : '已解鎖'}</span>
            </button>
            <button class="${climateCtrl.className} mobile-circle-btn" data-action="toggle-precondition" ${climateCtrl.attrs}>
              ${climateCtrl.isLoading ? icon('spinner') : icon('fan')}
              <span>${s.climate.driverTemp.toFixed(0)}°C</span>
            </button>
            <button class="${frunkQuickCtrl.className} mobile-circle-btn" data-action="toggle-door" data-part="frunk" ${frunkQuickCtrl.attrs}>
              ${frunkQuickCtrl.isLoading ? icon('spinner') : icon('carSide')}
              <span>${s.doors.frunk ? '前箱開' : '前備箱'}</span>
            </button>
            <button class="${trunkQuickCtrl.className} mobile-circle-btn" data-action="toggle-door" data-part="trunk" ${trunkQuickCtrl.attrs}>
              ${trunkQuickCtrl.isLoading ? icon('spinner') : icon('carTop')}
              <span>${s.doors.trunk ? '尾箱開' : '尾箱'}</span>
            </button>
            <button class="${findCtrl.className} mobile-circle-btn" data-action="find-my-car" ${findCtrl.attrs}>
              ${findCtrl.isLoading ? icon('spinner') : icon('horn')}
              <span>尋車</span>
            </button>
          </div>

          <div class="mobile-menu-list">
            <button class="mobile-menu-item" data-action="mobile-nav" data-page="controls">
              <div class="menu-item-left">
                ${icon('carTop')}
                <div>
                  <div class="menu-item-title">車門、尾箱與哨兵控制</div>
                  <div class="menu-item-sub">${doorSummary}</div>
                </div>
              </div>
              ${icon('chevronRight', 'menu-chevron')}
            </button>

            <button class="mobile-menu-item" data-action="mobile-nav" data-page="climate">
              <div class="menu-item-left">
                ${icon('fan')}
                <div>
                  <div class="menu-item-title">座艙溫控與寵物/露營</div>
                  <div class="menu-item-sub">車內 ${s.climate.cabinTemp.toFixed(0)}°C · ${climateModeLabel}</div>
                </div>
              </div>
              ${icon('chevronRight', 'menu-chevron')}
            </button>

            <button class="mobile-menu-item" data-action="mobile-nav" data-page="charging">
              <div class="menu-item-left">
                ${icon('bolt')}
                <div>
                  <div class="menu-item-title">超級充電與行程上限</div>
                  <div class="menu-item-sub">${s.charging.active ? `超充中 ${s.charging.powerKw} kW · 剩餘 ${s.charging.timeRemainingMin} 分` : `充電上限 ${s.charging.limitSoc}% · 充電口${s.doors.chargePort ? '已開' : '已關'}`}</div>
                </div>
              </div>
              ${icon('chevronRight', 'menu-chevron')}
            </button>
          </div>
        </div>
      `;
    } else if (page === 'controls') {
      const frunkC = this.getControlStateAttrs('mob-frunk', s.doors.frunk);
      const trunkC = this.getControlStateAttrs('mob-trunk', s.doors.trunk);
      const portC = this.getControlStateAttrs('mob-port-tile', s.doors.chargePort);
      const lockC = this.getControlStateAttrs('mob-lock-tile', !s.locked);
      const flC = this.getControlStateAttrs('mob-fl', s.doors.fl);
      const frC = this.getControlStateAttrs('mob-fr', s.doors.fr);
      const rlC = this.getControlStateAttrs('mob-rl', s.doors.rl);
      const rrC = this.getControlStateAttrs('mob-rr', s.doors.rr);

      subPageHtml = `
        <div class="mobile-page page-slide-in">
          <div class="mobile-subpage-header">
            <button class="ctrl-btn subpage-back-btn" data-action="mobile-nav" data-page="home">${icon('chevronLeft')} 返回</button>
            <span class="subpage-title">車身開合與安全</span>
          </div>
          <div class="mobile-doors-grid">
            <button class="${frunkC.className} door-tile-btn" data-action="toggle-door" data-part="frunk" ${frunkC.attrs}>
              <span>前備箱 · ${s.doors.frunk ? '已開' : '關閉'}</span>
            </button>
            <button class="${trunkC.className} door-tile-btn" data-action="toggle-door" data-part="trunk" ${trunkC.attrs}>
              <span>電動尾箱 · ${s.doors.trunk ? '已開' : '關閉'}</span>
            </button>
            <button class="${flC.className} door-tile-btn" data-action="toggle-door" data-part="fl" ${flC.attrs}>
              <span>左前車門 · ${s.doors.fl ? '已開' : '關閉'}</span>
            </button>
            <button class="${frC.className} door-tile-btn" data-action="toggle-door" data-part="fr" ${frC.attrs}>
              <span>右前車門 · ${s.doors.fr ? '已開' : '關閉'}</span>
            </button>
            <button class="${rlC.className} door-tile-btn" data-action="toggle-door" data-part="rl" ${rlC.attrs}>
              <span>左後車門 · ${s.doors.rl ? '已開' : '關閉'}</span>
            </button>
            <button class="${rrC.className} door-tile-btn" data-action="toggle-door" data-part="rr" ${rrC.attrs}>
              <span>右後車門 · ${s.doors.rr ? '已開' : '關閉'}</span>
            </button>
            <button class="${portC.className} door-tile-btn" data-action="toggle-door" data-part="chargePort" ${portC.attrs}>
              <span>充電口蓋 · ${s.doors.chargePort ? '已開' : '關閉'}</span>
            </button>
            <button class="${lockC.className} door-tile-btn" data-action="toggle-lock" ${lockC.attrs}>
              <span>中控車鎖 · ${s.locked ? '已鎖' : '解鎖'}</span>
            </button>
          </div>
          <div class="mobile-security-row">
            <button class="ctrl-btn ${s.sentryMode ? 'is-selected' : ''}" data-action="toggle-sentry">
              哨兵模式：${s.sentryMode ? '開啟' : '關閉'}
            </button>
            <button class="ctrl-btn ${s.valetMode ? 'is-selected' : ''}" data-action="toggle-valet">
              代客模式：${s.valetMode ? '開啟' : '關閉'}
            </button>
          </div>
        </div>
      `;
    } else if (page === 'climate') {
      const cMode = s.climate.mode || 'off';
      subPageHtml = `
        <div class="mobile-page page-slide-in">
          <div class="mobile-subpage-header">
            <button class="ctrl-btn subpage-back-btn" data-action="mobile-nav" data-page="home">${icon('chevronLeft')} 返回</button>
            <span class="subpage-title">座艙溫控與模式</span>
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
              <button class="ctrl-btn ${cMode === 'keep' ? 'is-selected' : ''}" data-action="set-climate-mode" data-mode="keep">恆溫保持</button>
              <button class="ctrl-btn ${cMode === 'dog' ? 'is-selected' : ''}" data-action="set-climate-mode" data-mode="dog">寵物模式</button>
              <button class="ctrl-btn ${cMode === 'camp' ? 'is-selected' : ''}" data-action="set-climate-mode" data-mode="camp">露營模式</button>
            </div>
            <div class="mobile-climate-actions">
              <button class="ctrl-btn ${s.climate.power ? 'is-selected' : ''}" data-action="toggle-climate-power">
                ${s.climate.power ? '空調運行中' : '開啟空調'}
              </button>
              <button class="ctrl-btn ${s.climate.defrostFront ? 'is-selected' : ''}" data-action="toggle-defrost-front">
                前擋除霜
              </button>
              <button class="ctrl-btn ${s.climate.seatHeatLeft > 0 ? 'is-selected' : ''}" data-action="cycle-seat-heat" data-side="left">
                主駕加熱 (${s.climate.seatHeatLeft})
              </button>
              <button class="ctrl-btn ${s.climate.seatHeatRight > 0 ? 'is-selected' : ''}" data-action="cycle-seat-heat" data-side="right">
                副駕加熱 (${s.climate.seatHeatRight})
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (page === 'charging') {
      subPageHtml = `
        <div class="mobile-page page-slide-in">
          <div class="mobile-subpage-header">
            <button class="ctrl-btn subpage-back-btn" data-action="mobile-nav" data-page="home">${icon('chevronLeft')} 返回</button>
            <span class="subpage-title">超充管理與記錄</span>
          </div>
          <div class="mobile-charging-card">
            <div class="charging-status-row">
              <div>
                <div class="charging-state-label">${s.charging.active ? `V4 超充中 · ${s.charging.powerKw} kW` : '未開始充電'}</div>
                <div class="charging-sub-info">${s.charging.active ? `${s.charging.voltage}V · ${s.charging.currentAmps}A` : `充電上限 ${s.charging.limitSoc}%`}</div>
              </div>
              <button class="ctrl-btn ${s.charging.active ? 'is-selected' : ''}" data-action="toggle-charging">
                ${s.charging.active ? '停止充電' : '開始超充'}
              </button>
            </div>
            <div class="charge-preset-row">
              <button class="ctrl-btn ${s.charging.limitSoc === 80 ? 'is-selected' : ''}" data-action="set-charge-preset" data-limit="80">80% 日常</button>
              <button class="ctrl-btn ${s.charging.limitSoc === 90 ? 'is-selected' : ''}" data-action="set-charge-preset" data-limit="90">90% 推薦</button>
              <button class="ctrl-btn ${s.charging.limitSoc === 100 ? 'is-selected' : ''}" data-action="set-charge-preset" data-limit="100">100% 長途</button>
            </div>
            <label class="limit-slider-label">
              <span>滑動調節上限 (${s.charging.limitSoc}%)</span>
              <input type="range" min="50" max="100" step="5" value="${s.charging.limitSoc}" data-action="set-charge-limit" />
            </label>
            <div class="charging-history-list">
              ${s.charging.history.slice(0, 2).map((item) => `
                <div class="history-row">
                  <div>
                    <div class="history-loc">${item.location}</div>
                    <div class="history-meta">${item.socRange} · ${item.durationMin} 分鐘</div>
                  </div>
                  <div class="history-right">
                    <span class="history-kwh">+${item.addedKwh} kWh</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="mobile-header-summary">
        <div class="mobile-car-title-row">
          <div>
            <h3 class="mobile-car-name">Model 3</h3>
            <div class="mobile-car-status">
              <span data-live="mob-drive-state">${s.displaySpeed > 1 ? `${Math.round(s.displaySpeed)} km/h · ${s.gear} 擋行駛` : `已駐停 (${s.gear} 擋) · 東京港區`}</span>
            </div>
          </div>
          <div class="mobile-battery-block">
            <div class="mobile-soc-row">
              <span class="mobile-soc-val" data-live="soc">${Math.round(s.displaySoc)}%</span>
              <span class="mobile-range-val" data-live="range">${rangeKm} km</span>
            </div>
          </div>
        </div>
        <div class="mobile-battery-bar-wrap" title="電池電量與充電上限 (${s.charging.limitSoc}%)">
          <div class="mobile-battery-bar-fill" data-live="mob-soc-bar" style="width:${Math.round(s.displaySoc)}%"></div>
          <div class="mobile-battery-limit-tick" style="left:${s.charging.limitSoc}%"></div>
        </div>
      </div>
      ${subPageHtml}
      <nav class="mobile-bottom-tabs" aria-label="手機功能分頁">
        <button class="mobile-tab-btn ${page === 'home' ? 'is-active' : ''}" data-action="mobile-nav" data-page="home">首頁</button>
        <button class="mobile-tab-btn ${page === 'controls' ? 'is-active' : ''} ${hasOpen ? 'has-dot' : ''}" data-action="mobile-nav" data-page="controls">車控</button>
        <button class="mobile-tab-btn ${page === 'climate' ? 'is-active' : ''}" data-action="mobile-nav" data-page="climate">空調</button>
        <button class="mobile-tab-btn ${page === 'charging' ? 'is-active' : ''}" data-action="mobile-nav" data-page="charging">充電</button>
      </nav>
    `;
  }

  /**
   * 2. 中控駕駛屏 — 左側 ADAS 視圖與極簡車控層（同步顯示轉向燈、遠光燈、車身開合快捷膠囊）
   */
  renderCenterLeftOverlay(s) {
    const container = document.getElementById('center-left-overlay');
    if (!container) return;

    const rangeKm = this.store.getEstimatedRangeKm();
    const activeTrack = s.media.tracks[s.media.trackIndex] || s.media.tracks[0];
    const hasOpen = this.store.hasOpenDoorOrTrunk();

    const doorFlBtn = this.getControlStateAttrs('cnt-fl', s.doors.fl);
    const frunkBtn = this.getControlStateAttrs('cnt-frunk', s.doors.frunk);
    const trunkBtn = this.getControlStateAttrs('cnt-trunk', s.doors.trunk);
    const portBtn = this.getControlStateAttrs('cnt-port', s.doors.chargePort);
    const lockBtn = this.getControlStateAttrs('cnt-lock', !s.locked);

    const leftTurnOn = (s.lights.turnSignal === 'left' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;
    const rightTurnOn = (s.lights.turnSignal === 'right' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;
    const leadDistInt = Math.round(s.driveMode.displayLeadDistanceM);

    let contextualBanner = '';
    if (s.gear === 'R' && !hasOpen) {
      contextualBanner = `
        <div class="center-context-pill is-reverse">
          <span>倒車雷達與軌跡輔助 · 後方 1.6m 安全</span>
        </div>
      `;
    } else if (s.lights.turnSignal !== 'off' && !hasOpen) {
      contextualBanner = `
        <div class="center-context-pill">
          <span>盲區監測已啟動 · ${s.lights.turnSignal === 'left' ? '左側' : '右側'}車道安全無來車</span>
        </div>
      `;
    }

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
          <button class="${lockBtn.className} status-icon-btn" data-action="toggle-lock" title="上鎖/解鎖">
            ${lockBtn.isLoading ? icon('spinner') : icon(s.locked ? 'lock' : 'unlock')}
          </button>
          <span class="battery-text"><strong data-live="center-soc">${Math.round(s.displaySoc)}%</strong> · <span data-live="center-range">${rangeKm}</span> km</span>
          <div class="center-telltale-row">
            <span class="turn-arrow-badge ${leftTurnOn ? 'is-blinking' : ''}" data-live="center-turn-left" title="左轉向燈">◀</span>
            <span class="beam-badge ${s.lights.highBeam ? 'is-high' : (s.lights.lowBeam ? 'is-low' : '')}" title="車燈狀態">
              ${s.lights.highBeam ? '遠光' : (s.lights.lowBeam ? '近光' : '燈關')}
            </span>
            <span class="turn-arrow-badge ${rightTurnOn ? 'is-blinking' : ''}" data-live="center-turn-right" title="右轉向燈">▶</span>
          </div>
          <span class="status-clock">23:53</span>
        </div>

        <div class="center-power-meter">
          <div class="power-bar-regen" data-live="center-regen-bar" style="width:0%"></div>
          <div class="power-bar-drive" data-live="center-drive-bar" style="width:12%"></div>
        </div>

        <div class="center-speed-row">
          <div class="speed-display-block">
            <div class="center-speed-num" data-live="center-speed">${Math.round(s.displaySpeed)}</div>
            <div class="center-speed-unit">km/h · 前車 <strong data-live="center-lead-dist">${leadDistInt}</strong> m · <span data-live="center-power">${Math.round(s.displayPowerKw)}</span> kW</div>
          </div>

          <div class="adas-badges-col">
            <div class="speed-limit-sign" title="當前道路限速">${s.driveMode.speedLimit}</div>
            <button class="autopilot-badge ${s.driveMode.autopilot ? 'is-on' : ''}" data-action="toggle-autopilot" title="切換 Autopilot">
              ${icon('steering')}
              <span>${s.driveMode.autopilot ? `${s.driveMode.setSpeed}` : '手動'}</span>
            </button>
          </div>
        </div>
      </div>

      ${contextualBanner}

      <div class="center-bottom-dock-stack">
        <div class="center-fixed-quick-bar" role="group" aria-label="車門與箱蓋固定快捷區">
          <button class="${doorFlBtn.className} quick-bar-pill" data-action="toggle-door" data-part="fl" ${doorFlBtn.attrs}>
            車門 ${s.doors.fl ? '已開' : '開啟'}
          </button>
          <button class="${frunkBtn.className} quick-bar-pill" data-action="toggle-door" data-part="frunk" ${frunkBtn.attrs}>
            前備箱 ${s.doors.frunk ? '已開' : '開啟'}
          </button>
          <button class="${trunkBtn.className} quick-bar-pill" data-action="toggle-door" data-part="trunk" ${trunkBtn.attrs}>
            尾箱 ${s.doors.trunk ? '已開' : '開啟'}
          </button>
          <button class="${portBtn.className} quick-bar-pill" data-action="toggle-door" data-part="chargePort" ${portBtn.attrs}>
            充電口 ${s.doors.chargePort ? '已開' : '開啟'}
          </button>
        </div>

        <div class="center-mini-media-card">
          <div class="mini-media-info">
            <div class="mini-album-dot">
              ${icon('music')}
            </div>
            <div class="mini-track-text">
              <div class="mini-track-title">${activeTrack.title}</div>
              <div class="mini-track-artist">${activeTrack.artist}</div>
            </div>
          </div>
          <div class="mini-media-btns">
            <button class="ctrl-btn icon-only" data-action="media-prev" aria-label="上一首">${icon('prev')}</button>
            <button class="ctrl-btn icon-only ${s.media.playing ? 'is-selected' : ''}" data-action="media-toggle" aria-label="播放/暫停">
              ${icon(s.media.playing ? 'pause' : 'play')}
            </button>
            <button class="ctrl-btn icon-only" data-action="media-next" aria-label="下一首">${icon('next')}</button>
          </div>
        </div>
      </div>
    `;
  }

  renderCenterRightOverlay(s) {
    const container = document.getElementById('center-right-overlay');
    if (!container) return;

    const nav = s.navigation;
    const turnIconName = nav.nextTurnDirection === 'left' ? 'turnLeft' : (nav.nextTurnDirection === 'slight-right' ? 'turnSlightRight' : 'turnRight');
    const destOptions = [
      { id: 'roppongi', label: '六本木 V4' },
      { id: 'shinjuku', label: '新宿 V3' },
      { id: 'daikanyama', label: '代官山' },
      { id: 'marunouchi', label: '丸之內' }
    ];

    container.innerHTML = `
      <div class="center-nav-card">
        <div class="nav-maneuver-row">
          <div class="nav-turn-icon-box">
            ${icon(turnIconName)}
          </div>
          <div class="nav-maneuver-text">
            <div class="nav-turn-dist"><span data-live="center-turn-dist">${Math.round(nav.nextTurnDistanceM)}</span> m</div>
            <div class="nav-turn-street" data-live="center-turn-street">${nav.nextTurnStreet}</div>
          </div>
        </div>

        <div class="nav-trip-summary">
          <div class="nav-stat">
            <span class="nav-stat-val"><span data-live="center-eta">${nav.etaMinutes}</span> 分</span>
            <span class="nav-stat-label">預計抵達</span>
          </div>
          <div class="nav-stat">
            <span class="nav-stat-val"><span data-live="center-rem-km">${nav.remainingKm.toFixed(1)}</span> km</span>
            <span class="nav-stat-label">剩餘里程</span>
          </div>
          <div class="nav-stat">
            <span class="nav-stat-val">${nav.arrivalSoc}%</span>
            <span class="nav-stat-label">抵達電量</span>
          </div>
        </div>

        <div class="nav-dest-chips">
          ${destOptions.map((d) => `
            <button class="nav-dest-chip ${nav.destinationId === d.id ? 'is-active' : ''}" data-action="select-destination" data-id="${d.id}">
              ${d.label}
            </button>
          `).join('')}
        </div>

        <div class="nav-destination-bar">
          <button class="ctrl-btn nav-voice-btn ${nav.voiceSpeaking ? 'is-selected' : ''}" data-action="trigger-nav-voice">
            ${icon('volume')} ${nav.voiceSpeaking ? '導航播報中' : '導航語音播報'}
          </button>
        </div>
      </div>

      <div class="center-map-toolbar">
        <button class="ctrl-btn map-tool-btn ${nav.trafficLayer ? 'is-selected' : ''}" data-action="toggle-map-traffic">
          路況
        </button>
        <button class="ctrl-btn map-tool-btn ${nav.superchargerLayer ? 'is-selected' : ''}" data-action="toggle-map-sc">
          超充
        </button>
        <button class="ctrl-btn map-tool-btn" data-action="map-zoom" data-delta="0.15" title="放大地圖檢視次級地名">+</button>
        <button class="ctrl-btn map-tool-btn" data-action="map-zoom" data-delta="-0.15" title="縮小地圖">-</button>
        <button class="ctrl-btn map-tool-btn" data-action="reset-map-view">
          回中
        </button>
      </div>
    `;
  }

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

    if (modal === 'climate') {
      const cMode = s.climate.mode || 'off';
      container.innerHTML = `
        <div class="center-popover climate-popover" onclick="event.stopPropagation()">
          <header class="popover-header">
            <div class="popover-title-group">
              ${icon('fan')}
              <h4>雙溫區熱泵空調控制</h4>
              <span class="popover-sub">車內 ${s.climate.cabinTemp.toFixed(1)}°C · 車外 ${s.climate.exteriorTemp.toFixed(1)}°C</span>
            </div>
            <button class="ctrl-btn icon-only" data-action="close-center-modal" aria-label="關閉空調面板">${icon('close')}</button>
          </header>

          <div class="climate-popover-body">
            <div class="dual-zone-grid">
              <div class="zone-card">
                <span class="zone-label">主駕溫區</span>
                <div class="zone-stepper">
                  <button class="ctrl-btn" data-action="temp-step" data-zone="driver" data-delta="-0.5">-</button>
                  <span class="zone-temp-val">${s.climate.driverTemp.toFixed(1)}°C</span>
                  <button class="ctrl-btn" data-action="temp-step" data-zone="driver" data-delta="0.5">+</button>
                </div>
                <button class="ctrl-btn ${s.climate.seatHeatLeft > 0 ? 'is-selected' : ''}" data-action="cycle-seat-heat" data-side="left">
                  ${icon('seatLeft')} 主駕座椅加熱 (${s.climate.seatHeatLeft})
                </button>
              </div>

              <div class="zone-card">
                <span class="zone-label">副駕溫區</span>
                <div class="zone-stepper">
                  <button class="ctrl-btn" data-action="temp-step" data-zone="passenger" data-delta="-0.5">-</button>
                  <span class="zone-temp-val">${s.climate.passengerTemp.toFixed(1)}°C</span>
                  <button class="ctrl-btn" data-action="temp-step" data-zone="passenger" data-delta="0.5">+</button>
                </div>
                <button class="ctrl-btn ${s.climate.seatHeatRight > 0 ? 'is-selected' : ''}" data-action="cycle-seat-heat" data-side="right">
                  ${icon('seatLeft')} 副駕座椅加熱 (${s.climate.seatHeatRight})
                </button>
              </div>
            </div>

            <div class="fan-slider-row">
              <span>風量等級：<strong>${s.climate.fanSpeed}</strong> / 10</span>
              <input type="range" min="1" max="10" step="1" value="${s.climate.fanSpeed}" data-action="set-fan-speed" />
            </div>

            <div class="climate-toggles-grid">
              <button class="ctrl-btn ${s.climate.power ? 'is-selected' : ''}" data-action="toggle-climate-power">空調電源</button>
              <button class="ctrl-btn ${s.climate.auto ? 'is-selected' : ''}" data-action="toggle-climate-auto">AUTO 恆溫</button>
              <button class="ctrl-btn ${s.climate.ac ? 'is-selected' : ''}" data-action="toggle-climate-ac">A/C 制冷</button>
              <button class="ctrl-btn ${cMode === 'keep' ? 'is-selected' : ''}" data-action="set-climate-mode" data-mode="keep">恆溫保持</button>
              <button class="ctrl-btn ${cMode === 'dog' ? 'is-selected' : ''}" data-action="set-climate-mode" data-mode="dog">寵物模式</button>
              <button class="ctrl-btn ${cMode === 'camp' ? 'is-selected' : ''}" data-action="set-climate-mode" data-mode="camp">露營模式</button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const tab = s.system.settingsTab || 'quick';
    const foldMirrorCtrl = this.getControlStateAttrs('set-mirror-fold', s.mirrors.folded);
    const frunkSetCtrl = this.getControlStateAttrs('set-frunk', s.doors.frunk);
    const trunkSetCtrl = this.getControlStateAttrs('set-trunk', s.doors.trunk);
    const portSetCtrl = this.getControlStateAttrs('set-port', s.doors.chargePort);

    let tabBody = '';
    if (tab === 'quick') {
      tabBody = `
        <div class="settings-section">
          <h5>車門、前備箱與尾箱控制</h5>
          <div class="segmented-group">
            <button class="${frunkSetCtrl.className}" data-action="toggle-door" data-part="frunk" ${frunkSetCtrl.attrs}>前備箱 · ${s.doors.frunk ? '已開' : '關閉'}</button>
            <button class="${trunkSetCtrl.className}" data-action="toggle-door" data-part="trunk" ${trunkSetCtrl.attrs}>尾箱 · ${s.doors.trunk ? '已開' : '關閉'}</button>
            <button class="${portSetCtrl.className}" data-action="toggle-door" data-part="chargePort" ${portSetCtrl.attrs}>充電口 · ${s.doors.chargePort ? '已開' : '關閉'}</button>
          </div>
          <div class="settings-btn-row">
            <button class="ctrl-btn ${!s.locked ? 'is-selected' : ''}" data-action="toggle-lock">${s.locked ? '全車已鎖' : '已解鎖'}</button>
            <button class="ctrl-btn ${s.doors.fl ? 'is-selected' : ''}" data-action="toggle-door" data-part="fl">左前門</button>
            <button class="ctrl-btn ${s.doors.fr ? 'is-selected' : ''}" data-action="toggle-door" data-part="fr">右前門</button>
            <button class="ctrl-btn ${s.doors.rl ? 'is-selected' : ''}" data-action="toggle-door" data-part="rl">左後門</button>
            <button class="ctrl-btn ${s.doors.rr ? 'is-selected' : ''}" data-action="toggle-door" data-part="rr">右後門</button>
          </div>
        </div>

        <div class="settings-section">
          <h5>顯示模式與螢幕亮度 (${s.environment.screenBrightness}%)</h5>
          <div class="segmented-group">
            <button class="ctrl-btn ${s.environment.timeOfDay === 'day' ? 'is-selected' : ''}" data-action="set-time" data-val="day">日間淺色</button>
            <button class="ctrl-btn ${s.environment.timeOfDay === 'night' ? 'is-selected' : ''}" data-action="set-time" data-val="night">夜間深灰</button>
          </div>
          <div class="fan-slider-row" style="margin-top:8px;">
            <span>亮度</span>
            <input type="range" min="45" max="100" step="1" value="${s.environment.screenBrightness}" data-action="set-brightness" />
          </div>
        </div>
      `;
    } else if (tab === 'pedals') {
      tabBody = `
        <div class="settings-section">
          <h5>加速模式</h5>
          <div class="segmented-group">
            ${[
              { k: 'chill', label: '舒適' },
              { k: 'standard', label: '標準' },
              { k: 'sport', label: '運動' }
            ].map((item) => {
              const c = this.getControlStateAttrs(`accel-${item.k}`, s.driveMode.accel === item.k);
              return `<button class="${c.className}" data-action="set-accel-mode" data-val="${item.k}" ${c.attrs}>${c.isLoading ? icon('spinner') : item.label}</button>`;
            }).join('')}
          </div>
        </div>

        <div class="settings-section">
          <h5>動能回收強度</h5>
          <div class="segmented-group">
            ${[
              { k: 'standard', label: '標準回收' },
              { k: 'low', label: '低回收' }
            ].map((item) => {
              const c = this.getControlStateAttrs(`regen-${item.k}`, s.driveMode.regen === item.k);
              return `<button class="${c.className}" data-action="set-regen-mode" data-val="${item.k}" ${c.attrs}>${c.isLoading ? icon('spinner') : item.label}</button>`;
            }).join('')}
          </div>
        </div>

        <div class="settings-section">
          <h5>轉向手感與輔助駕駛</h5>
          <div class="segmented-group">
            ${[
              { k: 'comfort', label: '舒適轉向' },
              { k: 'standard', label: '標準轉向' },
              { k: 'sport', label: '運動轉向' }
            ].map((item) => {
              const c = this.getControlStateAttrs(`steer-${item.k}`, s.driveMode.steering === item.k);
              return `<button class="${c.className}" data-action="set-steering-mode" data-val="${item.k}" ${c.attrs}>${item.label}</button>`;
            }).join('')}
          </div>
        </div>
      `;
    } else if (tab === 'lights') {
      tabBody = `
        <div class="settings-section">
          <h5>外部車燈</h5>
          <div class="segmented-group">
            ${[
              { k: 'off', label: '關閉' },
              { k: 'parking', label: '示寬燈' },
              { k: 'on', label: '近光燈' },
              { k: 'auto', label: '自動' }
            ].map((item) => {
              const c = this.getControlStateAttrs(`light-${item.k}`, s.lights.mode === item.k);
              return `<button class="${c.className}" data-action="set-light-mode" data-val="${item.k}" ${c.attrs}>${c.isLoading ? icon('spinner') : item.label}</button>`;
            }).join('')}
          </div>
          <div class="settings-btn-row">
            <button class="ctrl-btn ${s.lights.highBeam ? 'is-selected' : ''}" data-action="toggle-high-beam">遠光大燈</button>
            <button class="ctrl-btn ${s.lights.fogFront ? 'is-selected' : ''}" data-action="toggle-fog-front">前霧燈</button>
            <button class="ctrl-btn ${s.lights.hazard ? 'is-selected' : ''}" data-action="toggle-hazard">雙閃警示燈</button>
            <button class="ctrl-btn ${s.lights.turnSignal === 'left' ? 'is-selected' : ''}" data-action="set-turn-signal" data-dir="left">左轉向燈</button>
            <button class="ctrl-btn ${s.lights.turnSignal === 'right' ? 'is-selected' : ''}" data-action="set-turn-signal" data-dir="right">右轉向燈</button>
          </div>
        </div>

        <div class="settings-section">
          <h5>雨刮檔位</h5>
          <div class="segmented-group">
            ${[
              { k: 'off', label: '關' },
              { k: '1', label: 'I' },
              { k: '2', label: 'II' },
              { k: '3', label: 'III' },
              { k: '4', label: 'IIII' },
              { k: 'auto', label: '自動' }
            ].map((item) => {
              const c = this.getControlStateAttrs(`wiper-${item.k}`, s.wipers.mode === item.k);
              return `<button class="${c.className}" data-action="set-wiper-mode" data-val="${item.k}" ${c.attrs}>${item.label}</button>`;
            }).join('')}
          </div>
        </div>
      `;
    } else if (tab === 'mirrors') {
      tabBody = `
        <div class="settings-section">
          <h5>外後視鏡調節</h5>
          <div class="settings-btn-row">
            <button class="${foldMirrorCtrl.className}" data-action="toggle-mirror-fold" ${foldMirrorCtrl.attrs}>
              ${foldMirrorCtrl.isLoading ? icon('spinner') : icon('mirror')}
              ${s.mirrors.folded ? '展開後視鏡' : '折疊後視鏡'}
            </button>
            <button class="ctrl-btn ${s.mirrors.autoTilt ? 'is-selected' : ''}" data-action="toggle-mirror-autotilt">
              倒車自動下翻
            </button>
          </div>

          <div class="mirror-dpad-box">
            <div class="segmented-group" style="margin-bottom:8px;">
              <button class="ctrl-btn ${s.mirrors.adjustingSide === 'left' ? 'is-selected' : ''}" data-action="select-mirror-side" data-side="left">左鏡 (${s.mirrors.leftYaw}°, ${s.mirrors.leftPitch}°)</button>
              <button class="ctrl-btn ${s.mirrors.adjustingSide === 'right' ? 'is-selected' : ''}" data-action="select-mirror-side" data-side="right">右鏡 (${s.mirrors.rightYaw}°, ${s.mirrors.rightPitch}°)</button>
            </div>
            <div class="mirror-nudge-row">
              <button class="ctrl-btn" data-action="nudge-mirror" data-dx="-1" data-dy="0">左調</button>
              <button class="ctrl-btn" data-action="nudge-mirror" data-dx="1" data-dy="0">右調</button>
              <button class="ctrl-btn" data-action="nudge-mirror" data-dx="0" data-dy="1">上調</button>
              <button class="ctrl-btn" data-action="nudge-mirror" data-dx="0" data-dy="-1">下調</button>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h5>四輪胎壓監測 (TPMS)</h5>
          <div class="tpms-grid-4">
            <div class="tpms-cell"><span>左前</span><strong>${s.tires.fl.toFixed(2)} Bar</strong></div>
            <div class="tpms-cell"><span>右前</span><strong>${s.tires.fr.toFixed(2)} Bar</strong></div>
            <div class="tpms-cell ${s.tires.lowPressureWarning ? 'is-warn' : ''}"><span>左後</span><strong>${s.tires.lowPressureWarning ? '2.15' : s.tires.rl.toFixed(2)} Bar</strong></div>
            <div class="tpms-cell"><span>右後</span><strong>${s.tires.rr.toFixed(2)} Bar</strong></div>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="center-popover settings-popover" onclick="event.stopPropagation()">
        <header class="popover-header">
          <div class="popover-title-group">
            ${icon('settings')}
            <h4>車輛控制與設置</h4>
          </div>
          <button class="ctrl-btn icon-only" data-action="close-center-modal" aria-label="關閉設置">${icon('close')}</button>
        </header>

        <div class="settings-popover-layout">
          <nav class="settings-nav">
            <button class="settings-nav-btn ${tab === 'quick' ? 'is-active' : ''}" data-action="switch-settings-tab" data-tab="quick">
              ${icon('carSide')} 快捷車控
            </button>
            <button class="settings-nav-btn ${tab === 'pedals' ? 'is-active' : ''}" data-action="switch-settings-tab" data-tab="pedals">
              ${icon('steering')} 駕駛與回收
            </button>
            <button class="settings-nav-btn ${tab === 'lights' ? 'is-active' : ''}" data-action="switch-settings-tab" data-tab="lights">
              ${icon('headlight')} 車燈與雨刮
            </button>
            <button class="settings-nav-btn ${tab === 'mirrors' ? 'is-active' : ''}" data-action="switch-settings-tab" data-tab="mirrors">
              ${icon('mirror')} 後視鏡與胎壓
            </button>
          </nav>
          <div class="settings-content">
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
      <button class="dock-btn ${modal === 'settings' && s.system.settingsTab === 'quick' ? 'is-active' : ''}" data-action="open-center-modal" data-modal="settings" data-tab="quick">
        ${icon('carSide')}
        <span>車控</span>
      </button>

      <div class="dock-temp-group">
        <button class="dock-step-btn" data-action="temp-step" data-zone="driver" data-delta="-0.5" aria-label="降低主駕溫度">-</button>
        <button class="dock-temp-readout ${modal === 'climate' ? 'is-active' : ''}" data-action="open-center-modal" data-modal="climate">
          <span class="dock-temp-val">${s.climate.driverTemp.toFixed(1)}°</span>
        </button>
        <button class="dock-step-btn" data-action="temp-step" data-zone="driver" data-delta="0.5" aria-label="升高主駕溫度">+</button>
      </div>

      <div class="dock-app-icons">
        <button class="dock-btn ${modal === 'climate' ? 'is-active' : ''}" data-action="open-center-modal" data-modal="climate">
          ${icon('fan')}
          <span>空調</span>
        </button>
        <button class="dock-btn ${(modal === 'settings' && s.system.settingsTab === 'lights') || s.lights.highBeam || s.lights.hazard ? 'is-active' : ''}" data-action="open-center-modal" data-modal="settings" data-tab="lights">
          ${icon('headlight')}
          <span>燈光</span>
        </button>
        <button class="dock-btn ${s.wipers.effectiveLevel > 0 ? 'is-active' : ''}" data-action="open-center-modal" data-modal="settings" data-tab="lights">
          ${icon('wiper')}
          <span>雨刮</span>
        </button>
        <button class="dock-btn ${modal === 'settings' && s.system.settingsTab === 'mirrors' ? 'is-active' : ''}" data-action="open-center-modal" data-modal="settings" data-tab="mirrors">
          ${icon('mirror')}
          <span>後視鏡</span>
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
          <span>${s.media.effectiveVolume}%</span>
        </button>
        <button class="dock-step-btn" data-action="vol-step" data-delta="5" aria-label="調高音量">+</button>
      </div>
    `;
  }

  /**
   * 3. 副駕娛樂屏 (Sonic Studio 音樂黑膠與單色細線頻譜 + Tesla Theater 4K 劇院 + Tesla Arcade 街機)
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
    const turnDirLabel = s.navigation.nextTurnDirection === 'left' ? '左轉' : '右轉';

    headerEl.innerHTML = `
      <div class="passenger-topbar">
        <div class="passenger-tabs" role="tablist">
          <button class="ctrl-btn pass-tab ${tab === 'music' ? 'is-selected' : ''}" data-action="set-passenger-tab" data-tab="music">
            ${icon('music')} 音樂
          </button>
          <button class="ctrl-btn pass-tab ${tab === 'video' ? 'is-selected' : ''}" data-action="set-passenger-tab" data-tab="video">
            ${icon('video')} 劇院
          </button>
          <button class="ctrl-btn pass-tab ${tab === 'game' ? 'is-selected' : ''}" data-action="set-passenger-tab" data-tab="game">
            ${icon('gamepad')} 街機
          </button>
        </div>

        <div class="passenger-sync-status">
          <span class="nav-link-pill ${s.navigation.voiceSpeaking ? 'is-ducking' : ''}">
            ${s.navigation.voiceSpeaking ? `導航播報 · 音量 ${s.media.effectiveVolume}%` : `<span data-live="pass-turn-dir">${turnDirLabel}</span> <span data-live="pass-turn-dist">${Math.round(s.navigation.nextTurnDistanceM)}</span> m`}
          </span>
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

            <div class="np-volume-box">
              <button class="ctrl-btn icon-only" data-action="toggle-mute">${icon(s.media.muted ? 'volumeMute' : 'volume')}</button>
              <input type="range" min="0" max="100" value="${s.media.volume}" data-action="set-volume" aria-label="主副駕同步音量" />
              <span class="vol-num">${s.media.effectiveVolume}%</span>
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
      const vSpeed = s.media.videoSpeed || 1.0;
      controlsEl.innerHTML = `
        <div class="passenger-now-playing">
          <div class="now-playing-meta">
            <div class="album-badge is-cinema">
              ${icon('video')}
            </div>
            <div class="np-meta-text">
              <div class="np-title">${video.title}</div>
              <div class="np-artist">${video.channel} · ${video.resolution}</div>
            </div>
          </div>

          <div class="np-progress-row">
            <span class="np-time" data-live="video-curr-time">${fmtTime((s.media.videoProgress / 100) * video.duration)}</span>
            <input type="range" class="np-scrubber" min="0" max="100" value="${Math.round(s.media.videoProgress)}" data-action="scrub-video" />
            <span class="np-time">${fmtTime(video.duration)}</span>
          </div>

          <div class="np-controls-row">
            <div class="np-transport">
              <button class="ctrl-btn eq-pill-btn" data-action="seek-video" data-delta="-15">-15s</button>
              <button class="ctrl-btn video-play-btn ${s.media.videoPlaying ? 'is-selected' : ''}" data-action="toggle-video-play">
                ${icon(s.media.videoPlaying ? 'pause' : 'play')}
                <span>${s.media.videoPlaying ? '暫停' : '播放'}</span>
              </button>
              <button class="ctrl-btn eq-pill-btn" data-action="seek-video" data-delta="15">+15s</button>
              <button class="ctrl-btn eq-pill-btn" data-action="cycle-video-speed">${vSpeed}x</button>
            </div>

            <div class="np-volume-box">
              <button class="ctrl-btn icon-only" data-action="toggle-mute">${icon(s.media.muted ? 'volumeMute' : 'volume')}</button>
              <input type="range" min="0" max="100" value="${s.media.volume}" data-action="set-volume" />
              <span class="vol-num">${s.media.effectiveVolume}%</span>
            </div>
          </div>
        </div>
      `;

      playlistEl.innerHTML = `
        <div class="passenger-playlist">
          <div class="playlist-items">
            ${s.media.videos.map((v, idx) => `
              <button class="playlist-row ${idx === s.media.videoIndex ? 'is-current' : ''}" data-action="select-video" data-idx="${idx}">
                <span class="pl-idx">${idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</span>
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
      const g = s.media.game;
      controlsEl.innerHTML = `
        <div class="passenger-now-playing">
          <div class="now-playing-meta">
            <div class="album-badge is-cinema">
              ${icon('gamepad')}
            </div>
            <div class="np-meta-text">
              <div class="np-title">CyberRunner · 東京首都高 C1 夜間巡迴賽</div>
              <div class="np-artist">Model S Plaid 三電機矢量底盤 · 最高紀錄 ${g.highScore}</div>
            </div>
          </div>

          <div class="game-action-btns">
            <button class="ctrl-btn video-play-btn ${g.running ? 'is-selected' : ''}" data-action="game-toggle">
              ${icon(g.running ? 'pause' : 'play')}
              <span>${g.running ? '暫停' : '開始'}</span>
            </button>
            <button class="ctrl-btn eq-pill-btn" data-action="game-lane" data-dir="-1">${icon('chevronLeft')} 左車道</button>
            <button class="ctrl-btn eq-pill-btn" data-action="game-lane" data-dir="1">右車道 ${icon('chevronRight')}</button>
            <button class="ctrl-btn eq-pill-btn ${g.boostActive ? 'is-selected' : ''}" data-action="game-boost">
              Plaid 氮氣加速
            </button>
            <button class="ctrl-btn eq-pill-btn" data-action="game-reset">
              重置
            </button>
          </div>
        </div>
      `;

      const lapItems = [
        { name: 'Tokyo C1 Inner Loop · 都心環狀線', sub: 'Model S Plaid', dur: '1:18.4' },
        { name: 'Shibuya Scramble Sprint · 澀谷穿越', sub: 'Model 3 Performance', dur: '0:54.2' },
        { name: 'Rainbow Bridge Bayshore · 彩虹大橋', sub: 'Roadster Concept', dur: '1:32.8' },
        { name: 'Roppongi Hills Tunnel · 六本木隧道', sub: 'Model S Plaid', dur: '1:05.1' },
        { name: 'Daikanyama Chicane · 代官山連續彎', sub: 'Model 3 Track Pack', dur: '0:49.7' },
        { name: 'Shinjuku West Gate · 新宿副都心', sub: 'Cybercab GT', dur: '1:11.6' },
        { name: 'Odaiba Bayfront Straight · 台場海濱', sub: 'Model S Plaid', dur: '1:24.0' },
        { name: 'Marunouchi Grand Prix · 皇居外苑', sub: 'Model 3 Performance', dur: '1:15.9' },
        { name: 'Ginza Midnight Mile · 銀座中央通', sub: 'Roadster Founder', dur: '1:02.3' }
      ];
      playlistEl.innerHTML = `
        <div class="passenger-playlist">
          <div class="playlist-items">
            ${lapItems.map((item, idx) => `
              <div class="playlist-row ${idx === 0 ? 'is-current' : ''}">
                <span class="pl-idx">0${idx + 1}</span>
                <div class="pl-text">
                  <span class="pl-name">${item.name}</span>
                  <span class="pl-sub">${item.sub}</span>
                </div>
                <span class="pl-dur">${item.dur}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  /**
   * 4. 儀錶盤 (約 2.85:1 真實比例，內容居中放大、自車完整顯示不截斷、三端車速/導航距離/前車距離完全一致)
   */
  renderClusterUI(s) {
    const container = document.getElementById('cluster-ui-layer');
    if (!container) return;

    const rangeKm = this.store.getEstimatedRangeKm();
    const hasOpen = this.store.hasOpenDoorOrTrunk();
    const turnIconName = s.navigation.nextTurnDirection === 'left' ? 'turnLeft' : 'turnRight';
    const leftTurnOn = (s.lights.turnSignal === 'left' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;
    const rightTurnOn = (s.lights.turnSignal === 'right' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;
    const leadDistInt = Math.round(s.driveMode.displayLeadDistanceM);

    const openLabels = [];
    if (s.doors.frunk) openLabels.push('前備箱');
    if (s.doors.trunk) openLabels.push('尾箱');
    if (s.doors.fl || s.doors.fr || s.doors.rl || s.doors.rr) openLabels.push('車門');
    if (s.doors.chargePort) openLabels.push('充電口');

    const weatherText = s.environment.weather === 'rain' ? '降雨 · 雨刮 III' : (s.environment.weather === 'snow' ? '降雪 · 雨刮 II' : '');

    container.innerHTML = `
      <div class="cluster-centered-content">
        <!-- 左側核心車速、擋位、轉向燈與續航 -->
        <div class="cluster-left-pod">
          <div class="cluster-top-indicators">
            <span class="cluster-turn-indicator ${leftTurnOn ? 'is-on' : ''}" data-live="cluster-turn-left">◀</span>
            <div class="cluster-gear-row">
              ${['P', 'R', 'N', 'D'].map((g) => `<span class="cluster-gear-item ${s.gear === g ? 'is-active' : ''}">${g}</span>`).join('')}
            </div>
            <span class="cluster-turn-indicator ${rightTurnOn ? 'is-on' : ''}" data-live="cluster-turn-right">▶</span>
          </div>

          <div class="cluster-speed-block">
            <span class="cluster-speed-val" data-live="cluster-speed">${Math.round(s.displaySpeed)}</span>
            <span class="cluster-speed-unit">km/h</span>
          </div>

          <div class="cluster-power-track">
            <div class="cluster-regen-fill" data-live="cluster-regen-bar" style="width:0%"></div>
            <div class="cluster-drive-fill" data-live="cluster-drive-bar" style="width:15%"></div>
          </div>

          <div class="cluster-meta-row">
            <span data-live="cluster-soc">${Math.round(s.displaySoc)}%</span>
            <span>·</span>
            <span data-live="cluster-range">${rangeKm} km</span>
            <span>·</span>
            <span data-live="cluster-power-text">${Math.round(s.displayPowerKw)} kW</span>
          </div>
        </div>

        <!-- 中央 ADAS 3D 留白視覺區與頂部車燈/天氣狀態膠囊 -->
        <div class="cluster-center-pod">
          <div class="cluster-telltale-pills">
            ${s.lights.highBeam ? '<span class="cluster-telltale is-high">遠光大燈</span>' : (s.lights.lowBeam ? '<span class="cluster-telltale">近光燈</span>' : '')}
            ${s.lights.hazard ? '<span class="cluster-telltale is-warn">雙閃警示</span>' : ''}
            ${weatherText ? `<span class="cluster-telltale">${weatherText}</span>` : ''}
            ${hasOpen ? `<span class="cluster-telltale is-warn">${openLabels.join('/')}開</span>` : ''}
          </div>
          ${s.driveMode.forwardCollisionWarn ? `<div class="cluster-fcw-alert">前車過近 · 請減速</div>` : ''}
        </div>

        <!-- 右側導航、前車距離與胎壓狀態 -->
        <div class="cluster-right-pod">
          <div class="cluster-nav-pod">
            ${icon(turnIconName, 'cluster-nav-icon')}
            <div>
              <div class="cluster-nav-dist"><span data-live="cluster-turn-dist">${Math.round(s.navigation.nextTurnDistanceM)}</span> m</div>
              <div class="cluster-nav-street" data-live="cluster-turn-street">${s.navigation.nextTurnStreet}</div>
            </div>
          </div>

          <div class="cluster-tpms-pod ${s.tires.lowPressureWarning ? 'has-warning' : ''}">
            <div class="tpms-status-line">
              前車 <strong data-live="cluster-lead-dist">${leadDistInt}</strong> m · ${s.tires.lowPressureWarning ? '胎壓 2.15 Bar' : `${s.tires.fl.toFixed(1)} Bar`}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 5. 抬頭顯示 HUD (擋風玻璃場景提亮可辨識、內容放大並居中、無多餘外層邊框)
   */
  renderHudUI(s) {
    const container = document.getElementById('hud-ui-layer');
    if (!container) return;

    const turnIconName = s.navigation.nextTurnDirection === 'left' ? 'turnLeft' : 'turnRight';
    const leadDistInt = Math.round(s.driveMode.displayLeadDistanceM);
    const leftTurnOn = (s.lights.turnSignal === 'left' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;
    const rightTurnOn = (s.lights.turnSignal === 'right' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;

    container.innerHTML = `
      <div class="hud-centered-projection">
        <div class="hud-main-speed">
          <span class="hud-turn-sig ${leftTurnOn ? 'is-on' : ''}" data-live="hud-turn-left">◀</span>
          <span class="hud-speed-number" data-live="hud-speed">${Math.round(s.displaySpeed)}</span>
          <span class="hud-speed-unit">km/h</span>
          <span class="hud-turn-sig ${rightTurnOn ? 'is-on' : ''}" data-live="hud-turn-right">▶</span>
        </div>

        <div class="hud-center-badges">
          <div class="hud-limit-circle">${s.driveMode.speedLimit}</div>
          <div class="hud-lead-text">
            ${s.lights.highBeam ? '遠光 · ' : ''}前車 <strong data-live="hud-lead-dist">${leadDistInt}</strong> m
          </div>
        </div>

        <div class="hud-turn-group">
          ${icon(turnIconName, 'hud-turn-svg')}
          <div>
            <div class="hud-turn-dist"><span data-live="hud-turn-dist">${Math.round(s.navigation.nextTurnDistanceM)}</span> m</div>
            <div class="hud-turn-street" data-live="hud-turn-street">${s.navigation.nextTurnStreet}</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 現場演示五端聯動控制面板 (所有按鈕 100% 即時生效，無行駛鎖死)
   */
  renderDemoControlPanel(s) {
    const body = document.getElementById('demo-panel-body');
    if (!body) return;

    body.innerHTML = `
      <div class="demo-group">
        <div class="demo-group-title">動力、擋位與電池</div>

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
            <span>電量</span>
            <strong><span data-live="demo-soc">${Math.round(s.displaySoc)}</span>%</strong>
          </div>
          <input type="range" min="5" max="100" step="1" value="${Math.round(s.batterySoc)}" data-action="set-soc" />
        </label>
      </div>

      <div class="demo-group">
        <div class="demo-group-title">環境光照、天氣與車漆</div>

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
        <div class="demo-group-title">車身開合與車燈 (點擊即時 3D 運鏡展示)</div>
        <div class="demo-btn-grid">
          <button class="demo-btn ${!s.locked ? 'is-active' : ''}" data-action="toggle-lock">
            ${s.locked ? '全車已鎖' : '已解鎖'}
          </button>
          <button class="demo-btn ${s.doors.fl ? 'is-active' : ''}" data-action="toggle-door" data-part="fl">
            左前門：${s.doors.fl ? '開' : '關'}
          </button>
          <button class="demo-btn ${s.doors.fr ? 'is-active' : ''}" data-action="toggle-door" data-part="fr">
            右前門：${s.doors.fr ? '開' : '關'}
          </button>
          <button class="demo-btn ${s.doors.rl ? 'is-active' : ''}" data-action="toggle-door" data-part="rl">
            左後門：${s.doors.rl ? '開' : '關'}
          </button>
          <button class="demo-btn ${s.doors.rr ? 'is-active' : ''}" data-action="toggle-door" data-part="rr">
            右後門：${s.doors.rr ? '開' : '關'}
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

        <div class="demo-row" style="margin-top:8px;">
          <span class="demo-label">大燈模式</span>
          <div class="demo-segmented">
            ${[
              { k: 'off', label: '關閉' },
              { k: 'parking', label: '示寬' },
              { k: 'on', label: '近光' },
              { k: 'auto', label: '自動' }
            ].map((item) => `
              <button class="demo-chip ${s.lights.mode === item.k ? 'is-active' : ''}" data-action="set-light-mode" data-val="${item.k}">${item.label}</button>
            `).join('')}
          </div>
        </div>

        <div class="demo-btn-grid" style="margin-top:8px;">
          <button class="demo-btn ${s.lights.turnSignal === 'left' ? 'is-active' : ''}" data-action="set-turn-signal" data-dir="left">左轉向燈</button>
          <button class="demo-btn ${s.lights.turnSignal === 'right' ? 'is-active' : ''}" data-action="set-turn-signal" data-dir="right">右轉向燈</button>
          <button class="demo-btn ${s.lights.hazard ? 'is-active' : ''}" data-action="toggle-hazard">雙閃燈</button>
          <button class="demo-btn ${s.lights.highBeam ? 'is-active' : ''}" data-action="toggle-high-beam">遠光大燈</button>
        </div>
      </div>

      <div class="demo-group">
        <div class="demo-group-title">聯動與控件四態檢視</div>
        <div class="demo-btn-grid">
          <button class="demo-btn ${s.tires.lowPressureWarning ? 'is-active' : ''}" data-action="toggle-tpms-warn">
            低胎壓報警
          </button>
          <button class="demo-btn ${s.navigation.voiceSpeaking ? 'is-active' : ''}" data-action="trigger-nav-voice">
            導航語音壓低
          </button>
          <button class="demo-btn ${s.charging.active ? 'is-active' : ''}" data-action="toggle-charging">
            ${s.charging.active ? '超充進行中' : '模擬超充'}
          </button>
          <button class="demo-btn ${s.findMyCarActive ? 'is-active' : ''}" data-action="find-my-car">
            遠程尋車閃燈
          </button>
        </div>

        <div class="demo-row" style="margin-top:8px;">
          <span class="demo-label">控件四態檢視</span>
          <div class="demo-segmented">
            ${[
              { k: 'normal', label: '啟用' },
              { k: 'active', label: '按下' },
              { k: 'loading', label: '載入' },
              { k: 'disabled', label: '禁用' }
            ].map((st) => `
              <button class="demo-chip ${s.system.controlStateOverride === st.k ? 'is-active' : ''}" data-action="set-control-override" data-val="${st.k}">
                ${st.label}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderToastAndModals(s) {
    const toastEl = document.getElementById('global-toast');
    if (toastEl) {
      if (s.system.toastMessage) {
        toastEl.textContent = s.system.toastMessage;
        toastEl.className = `global-toast is-visible ${s.system.toastType || 'info'}`;
      } else {
        toastEl.className = 'global-toast';
      }
    }

    const portal = document.getElementById('modal-portal');
    if (portal) {
      portal.innerHTML = renderDesignDocModal(s) + renderAcceptanceChecklistModal(s);
    }
  }

  cacheTelemetryNodes() {
    this.domRefs = {
      fps: document.getElementById('live-fps'),
      mobSoc: document.querySelector('[data-live="soc"]'),
      mobRange: document.querySelector('[data-live="range"]'),
      mobSocBar: document.querySelector('[data-live="mob-soc-bar"]'),
      mobDriveState: document.querySelector('[data-live="mob-drive-state"]'),
      centerSpeed: document.querySelector('[data-live="center-speed"]'),
      centerLeadDist: document.querySelector('[data-live="center-lead-dist"]'),
      centerPower: document.querySelector('[data-live="center-power"]'),
      centerSoc: document.querySelector('[data-live="center-soc"]'),
      centerRange: document.querySelector('[data-live="center-range"]'),
      centerRegenBar: document.querySelector('[data-live="center-regen-bar"]'),
      centerDriveBar: document.querySelector('[data-live="center-drive-bar"]'),
      centerTurnDist: document.querySelector('[data-live="center-turn-dist"]'),
      centerTurnStreet: document.querySelector('[data-live="center-turn-street"]'),
      centerEta: document.querySelector('[data-live="center-eta"]'),
      centerRemKm: document.querySelector('[data-live="center-rem-km"]'),
      centerTurnLeft: document.querySelector('[data-live="center-turn-left"]'),
      centerTurnRight: document.querySelector('[data-live="center-turn-right"]'),
      passTurnDist: document.querySelector('[data-live="pass-turn-dist"]'),
      passTurnDir: document.querySelector('[data-live="pass-turn-dir"]'),
      clusterSpeed: document.querySelector('[data-live="cluster-speed"]'),
      clusterPowerText: document.querySelector('[data-live="cluster-power-text"]'),
      clusterRegenBar: document.querySelector('[data-live="cluster-regen-bar"]'),
      clusterDriveBar: document.querySelector('[data-live="cluster-drive-bar"]'),
      clusterSoc: document.querySelector('[data-live="cluster-soc"]'),
      clusterRange: document.querySelector('[data-live="cluster-range"]'),
      clusterLeadDist: document.querySelector('[data-live="cluster-lead-dist"]'),
      clusterTurnDist: document.querySelector('[data-live="cluster-turn-dist"]'),
      clusterTurnStreet: document.querySelector('[data-live="cluster-turn-street"]'),
      clusterTurnLeft: document.querySelector('[data-live="cluster-turn-left"]'),
      clusterTurnRight: document.querySelector('[data-live="cluster-turn-right"]'),
      hudSpeed: document.querySelector('[data-live="hud-speed"]'),
      hudLeadDist: document.querySelector('[data-live="hud-lead-dist"]'),
      hudTurnDist: document.querySelector('[data-live="hud-turn-dist"]'),
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
    const turnDirLabel = s.navigation.nextTurnDirection === 'left' ? '左轉' : '右轉';

    const leftTurnOn = (s.lights.turnSignal === 'left' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;
    const rightTurnOn = (s.lights.turnSignal === 'right' || s.lights.hazard || s.findMyCarActive) && s.lights.blinkPhase;

    if (r.fps) r.fps.textContent = s.system.fps;
    if (r.mobSoc) r.mobSoc.textContent = `${socInt}%`;
    if (r.mobRange) r.mobRange.textContent = `${rangeKm} km`;
    if (r.mobSocBar) r.mobSocBar.style.width = `${socInt}%`;
    if (r.mobDriveState) {
      r.mobDriveState.textContent = s.displaySpeed > 1 ? `${speedInt} km/h · ${s.gear} 擋行駛` : `已駐停 (${s.gear} 擋) · 東京港區`;
    }

    if (r.centerSpeed) r.centerSpeed.textContent = speedInt;
    if (r.centerLeadDist) r.centerLeadDist.textContent = leadDistInt;
    if (r.centerPower) r.centerPower.textContent = `${pwr >= 0 ? '+' : ''}${Math.round(pwr)}`;
    if (r.centerSoc) r.centerSoc.textContent = `${socInt}%`;
    if (r.centerRange) r.centerRange.textContent = rangeKm;
    if (r.centerTurnLeft) r.centerTurnLeft.classList.toggle('is-blinking', leftTurnOn);
    if (r.centerTurnRight) r.centerTurnRight.classList.toggle('is-blinking', rightTurnOn);

    const regenPct = pwr < 0 ? Math.min(100, Math.abs(pwr / 85) * 100) : 0;
    const drivePct = pwr > 0 ? Math.min(100, (pwr / 260) * 100) : 0;
    if (r.centerRegenBar) r.centerRegenBar.style.width = `${regenPct.toFixed(1)}%`;
    if (r.centerDriveBar) r.centerDriveBar.style.width = `${drivePct.toFixed(1)}%`;

    if (r.centerTurnDist) r.centerTurnDist.textContent = turnDist;
    if (r.centerTurnStreet) r.centerTurnStreet.textContent = s.navigation.nextTurnStreet;
    if (r.centerEta) r.centerEta.textContent = s.navigation.etaMinutes;
    if (r.centerRemKm) r.centerRemKm.textContent = s.navigation.remainingKm.toFixed(1);

    if (r.passTurnDist) r.passTurnDist.textContent = turnDist;
    if (r.passTurnDir) r.passTurnDir.textContent = turnDirLabel;

    if (r.clusterSpeed) r.clusterSpeed.textContent = speedInt;
    if (r.clusterPowerText) r.clusterPowerText.textContent = `${pwr >= 0 ? '+' : ''}${Math.round(pwr)} kW`;
    if (r.clusterRegenBar) r.clusterRegenBar.style.width = `${regenPct.toFixed(1)}%`;
    if (r.clusterDriveBar) r.clusterDriveBar.style.width = `${drivePct.toFixed(1)}%`;
    if (r.clusterSoc) r.clusterSoc.textContent = `${socInt}%`;
    if (r.clusterRange) r.clusterRange.textContent = `${rangeKm} km`;
    if (r.clusterLeadDist) r.clusterLeadDist.textContent = leadDistInt;
    if (r.clusterTurnDist) r.clusterTurnDist.textContent = turnDist;
    if (r.clusterTurnStreet) r.clusterTurnStreet.textContent = s.navigation.nextTurnStreet;
    if (r.clusterTurnLeft) r.clusterTurnLeft.classList.toggle('is-on', leftTurnOn);
    if (r.clusterTurnRight) r.clusterTurnRight.classList.toggle('is-on', rightTurnOn);

    if (r.hudSpeed) r.hudSpeed.textContent = speedInt;
    if (r.hudLeadDist) r.hudLeadDist.textContent = leadDistInt;
    if (r.hudTurnDist) r.hudTurnDist.textContent = turnDist;
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

      const val = parseFloat(el.value);
      if (action === 'set-speed') {
        this.store.update((st) => {
          if (val > 0 && (st.gear === 'P' || st.gear === 'N')) {
            st.gear = 'D';
          }
          st.speed = val;
        });
      } else if (action === 'set-soc') {
        this.store.update((st) => {
          st.batterySoc = val;
          st.displaySoc = val;
        });
      } else if (action === 'set-fan-speed') {
        this.store.update((st) => {
          st.climate.fanSpeed = Math.round(val);
          st.climate.power = true;
        });
      } else if (action === 'set-volume') {
        this.store.update((st) => {
          st.media.volume = Math.round(val);
          st.media.muted = false;
        });
      } else if (action === 'scrub-music') {
        this.store.update((st) => {
          st.media.currentTime = val;
        });
      } else if (action === 'scrub-video') {
        this.store.update((st) => {
          st.media.videoProgress = val;
        });
      } else if (action === 'set-charge-limit') {
        this.store.update((st) => {
          st.charging.limitSoc = Math.round(val);
        });
      } else if (action === 'set-brightness') {
        this.store.update((st) => {
          st.environment.screenBrightness = Math.round(val);
        });
      }
    });
  }

  handleAction(action, el) {
    const s = this.store.getState();

    switch (action) {
      case 'toggle-demo-drawer':
        this.drawerOpen = !this.drawerOpen;
        this.syncThemeAndBrightness(s);
        break;

      case 'toggle-lock':
        this.store.triggerControlAction('mob-lock', () => {
          this.store.update((st) => {
            st.locked = !st.locked;
          });
          this.store.showToast(this.store.getState().locked ? '全車已上鎖' : '全車已解鎖', 'info');
        });
        break;

      case 'toggle-sentry':
        this.store.update((st) => {
          st.sentryMode = !st.sentryMode;
        });
        this.store.showToast(this.store.getState().sentryMode ? '哨兵模式已開啟 · 環視鏡頭監控中' : '哨兵模式已關閉', 'info');
        break;

      case 'toggle-valet':
        this.store.update((st) => {
          st.valetMode = !st.valetMode;
        });
        this.store.showToast(this.store.getState().valetMode ? '代客模式已啟用 · 前備箱與手套箱已鎖定' : '代客模式已關閉', 'info');
        break;

      case 'toggle-precondition':
        this.store.triggerControlAction('mob-precond', () => {
          this.store.update((st) => {
            st.climate.preconditioning = !st.climate.preconditioning;
            if (st.climate.preconditioning) st.climate.power = true;
          });
          this.store.showToast(this.store.getState().climate.preconditioning ? '已啟動遠程座艙預冷/預熱' : '已關閉預冷/預熱', 'info');
        });
        break;

      case 'set-climate-mode': {
        const mode = el.dataset.mode || 'off';
        this.store.update((st) => {
          st.climate.mode = st.climate.mode === mode ? 'off' : mode;
        });
        const modeMap = { keep: '車廂恆溫保持', dog: '寵物模式 (Dog Mode)', camp: '露營模式 (Camp Mode)' };
        const activeMode = this.store.getState().climate.mode;
        this.store.showToast(activeMode === 'off' ? '已恢復標準空調模式' : `已啟動${modeMap[activeMode]}`, 'info');
        break;
      }

      case 'find-my-car':
        this.store.triggerFindMyCar();
        break;

      case 'toggle-door': {
        const part = el.dataset.part;
        this.store.triggerControlAction(`mob-${part}`, () => {
          this.store.toggleDoor(part);
        }, 120);
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
        }, 120);
        break;
      }

      case 'toggle-autopilot':
        this.store.update((st) => {
          st.driveMode.autopilot = !st.driveMode.autopilot;
        });
        this.store.showToast(this.store.getState().driveMode.autopilot ? 'Autopilot 輔助轉向已啟用' : 'Autopilot 已退出', 'info');
        break;

      case 'cycle-paint': {
        const keys = Object.keys(PAINT_PRESETS);
        const nextIdx = (keys.indexOf(s.paintColor) + 1) % keys.length;
        this.store.update((st) => {
          st.paintColor = keys[nextIdx];
        });
        break;
      }

      case 'set-paint': {
        const val = el.dataset.val;
        this.store.update((st) => {
          st.paintColor = val;
        });
        const preset = PAINT_PRESETS[val];
        if (preset) this.store.showToast(`已切換車漆：${preset.name}`, 'info');
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
            st.climate.passengerTemp = Math.max(15.5, Math.min(28.5, st.climate.passengerTemp + delta));
          }
        });
        break;
      }

      case 'toggle-climate-power':
        this.store.update((st) => {
          st.climate.power = !st.climate.power;
          if (!st.climate.power) st.climate.mode = 'off';
        });
        break;

      case 'toggle-climate-auto':
        this.store.update((st) => {
          st.climate.auto = !st.climate.auto;
          if (st.climate.auto) st.climate.power = true;
        });
        break;

      case 'toggle-climate-ac':
        this.store.update((st) => {
          st.climate.ac = !st.climate.ac;
        });
        break;

      case 'toggle-climate-sync':
        this.store.update((st) => {
          st.climate.sync = !st.climate.sync;
          if (st.climate.sync) st.climate.passengerTemp = st.climate.driverTemp;
        });
        break;

      case 'toggle-defrost-front':
        this.store.update((st) => {
          st.climate.defrostFront = !st.climate.defrostFront;
          if (st.climate.defrostFront) st.climate.power = true;
        });
        break;

      case 'toggle-defrost-rear':
        this.store.update((st) => {
          st.climate.defrostRear = !st.climate.defrostRear;
        });
        break;

      case 'cycle-seat-heat': {
        const side = el.dataset.side;
        this.store.update((st) => {
          if (side === 'left') st.climate.seatHeatLeft = (st.climate.seatHeatLeft + 1) % 4;
          else st.climate.seatHeatRight = (st.climate.seatHeatRight + 1) % 4;
        });
        break;
      }

      case 'toggle-charging':
        this.store.update((st) => {
          st.charging.active = !st.charging.active;
          if (st.charging.active) {
            st.doors.chargePort = true;
            st.gear = 'P';
            st.speed = 0;
          }
        });
        this.store.showToast(this.store.getState().charging.active ? '已連接 V4 超級充電樁 · 215kW 高速充電中' : '超級充電已停止', 'info');
        break;

      case 'set-charge-preset': {
        const limit = parseInt(el.dataset.limit || '90', 10);
        this.store.update((st) => {
          st.charging.limitSoc = limit;
        });
        this.store.showToast(`已設定充電上限為 ${limit}%`, 'info');
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
        const val = el.dataset.val;
        this.store.triggerControlAction(`accel-${val}`, () => {
          this.store.update((st) => {
            st.driveMode.accel = val;
          });
        }, 140);
        break;
      }

      case 'set-regen-mode': {
        const val = el.dataset.val;
        this.store.triggerControlAction(`regen-${val}`, () => {
          this.store.update((st) => {
            st.driveMode.regen = val;
          });
        }, 140);
        break;
      }

      case 'set-steering-mode':
        this.store.update((st) => {
          st.driveMode.steering = el.dataset.val;
        });
        break;

      case 'set-light-mode': {
        const val = el.dataset.val;
        this.store.triggerControlAction(`light-${val}`, () => {
          this.store.update((st) => {
            st.lights.mode = val;
          });
        }, 140);
        break;
      }

      case 'toggle-high-beam':
        this.store.update((st) => {
          st.lights.highBeam = !st.lights.highBeam;
          if (st.lights.highBeam && st.lights.mode === 'off') {
            st.lights.mode = 'on';
          }
        });
        this.store.showToast(this.store.getState().lights.highBeam ? '遠光大燈已開啟 — 前方路面強光束已點亮' : '遠光大燈已關閉', 'info');
        break;

      case 'toggle-fog-front':
        this.store.update((st) => {
          st.lights.fogFront = !st.lights.fogFront;
        });
        break;

      case 'toggle-hazard':
        this.store.update((st) => {
          st.lights.hazard = !st.lights.hazard;
        });
        this.store.showToast(this.store.getState().lights.hazard ? '雙閃警示燈已開啟' : '雙閃警示燈已關閉', 'info');
        break;

      case 'set-turn-signal': {
        const dir = el.dataset.dir;
        this.store.update((st) => {
          st.lights.turnSignal = st.lights.turnSignal === dir ? 'off' : dir;
        });
        const currDir = this.store.getState().lights.turnSignal;
        if (currDir !== 'off') {
          this.store.showToast(`${currDir === 'left' ? '左' : '右'}轉向燈已開啟`, 'info');
        }
        break;
      }

      case 'set-wiper-mode':
        this.store.update((st) => {
          st.wipers.mode = el.dataset.val;
        });
        break;

      case 'toggle-mirror-fold':
        this.store.triggerControlAction('set-mirror-fold', () => {
          this.store.update((st) => {
            st.mirrors.folded = !st.mirrors.folded;
          });
          this.store.showToast(this.store.getState().mirrors.folded ? '外後視鏡已折疊' : '外後視鏡已展開', 'info');
        }, 160);
        break;

      case 'toggle-mirror-autotilt':
        this.store.update((st) => {
          st.mirrors.autoTilt = !st.mirrors.autoTilt;
        });
        break;

      case 'select-mirror-side':
        this.store.update((st) => {
          st.mirrors.adjustingSide = el.dataset.side;
        });
        break;

      case 'nudge-mirror': {
        const dx = parseInt(el.dataset.dx || '0', 10);
        const dy = parseInt(el.dataset.dy || '0', 10);
        this.store.update((st) => {
          if (st.mirrors.adjustingSide === 'left') {
            st.mirrors.leftYaw = Math.max(-15, Math.min(15, st.mirrors.leftYaw + dx));
            st.mirrors.leftPitch = Math.max(-15, Math.min(15, st.mirrors.leftPitch + dy));
          } else {
            st.mirrors.rightYaw = Math.max(-15, Math.min(15, st.mirrors.rightYaw + dx));
            st.mirrors.rightPitch = Math.max(-15, Math.min(15, st.mirrors.rightPitch + dy));
          }
        });
        break;
      }

      case 'select-destination': {
        const destId = el.dataset.id;
        if (destId) {
          this.mapMediaEngine.selectSuperchargerDestination(destId);
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
        break;

      case 'toggle-map-sc':
        this.store.update((st) => {
          st.navigation.superchargerLayer = !st.navigation.superchargerLayer;
        });
        break;

      case 'reset-map-view':
        this.mapMediaEngine.resetMapView();
        this.store.showToast('地圖已回中', 'info');
        break;

      case 'trigger-nav-voice':
        this.store.triggerNavVoicePrompt();
        break;

      case 'set-passenger-tab':
        this.store.update((st) => {
          st.media.activeTab = el.dataset.tab;
        });
        break;

      case 'set-eq-preset': {
        const eq = el.dataset.eq || 'immersive';
        this.store.update((st) => {
          st.media.eqPreset = eq;
        });
        const eqNames = { immersive: '沉浸環繞 7.1.4', studio: '錄音室原聲', bass: '重低音增強' };
        this.store.showToast(`音響音場已切換：${eqNames[eq] || eq}`, 'info');
        break;
      }

      case 'media-toggle':
        this.store.update((st) => {
          st.media.playing = !st.media.playing;
        });
        break;

      case 'media-prev':
        this.store.update((st) => {
          st.media.trackIndex = (st.media.trackIndex - 1 + st.media.tracks.length) % st.media.tracks.length;
          st.media.currentTime = 0;
          st.media.playing = true;
        });
        break;

      case 'media-next':
        this.store.update((st) => {
          st.media.trackIndex = (st.media.trackIndex + 1) % st.media.tracks.length;
          st.media.currentTime = 0;
          st.media.playing = true;
        });
        break;

      case 'select-track':
        this.store.update((st) => {
          st.media.trackIndex = parseInt(el.dataset.idx, 10) || 0;
          st.media.currentTime = 0;
          st.media.playing = true;
        });
        break;

      case 'toggle-video-play':
        this.store.update((st) => {
          st.media.videoPlaying = !st.media.videoPlaying;
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
        const speeds = [1.0, 1.25, 1.5];
        this.store.update((st) => {
          const curr = st.media.videoSpeed || 1.0;
          const next = speeds[(speeds.indexOf(curr) + 1) % speeds.length];
          st.media.videoSpeed = next;
        });
        break;
      }

      case 'select-video':
        this.store.update((st) => {
          st.media.videoIndex = parseInt(el.dataset.idx, 10) || 0;
          st.media.videoPlaying = true;
        });
        break;

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
        });
        break;

      case 'game-reset':
        this.store.update((st) => {
          st.media.game.score = 0;
          st.media.game.running = true;
        });
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
        break;

      case 'set-time':
        this.store.update((st) => {
          st.environment.timeOfDay = el.dataset.val;
        });
        this.store.showToast(`已切換為${el.dataset.val === 'day' ? '日間模式' : '夜間模式'}`, 'info');
        break;

      case 'set-weather': {
        const wVal = el.dataset.val;
        this.store.update((st) => {
          st.environment.weather = wVal;
        });
        const wNames = { clear: '晴朗無雲', rain: '降雨天氣 — 自動雨刮 III 檔與路面反光已啟動', snow: '降雪天氣 — 自動雨刮 II 檔與雪花粒子已啟動' };
        this.store.showToast(wNames[wVal] || wVal, 'info');
        break;
      }

      case 'toggle-tpms-warn':
        this.store.update((st) => {
          st.tires.lowPressureWarning = !st.tires.lowPressureWarning;
        });
        this.store.showToast(this.store.getState().tires.lowPressureWarning ? '已觸發左後輪胎壓偏低報警 (2.15 Bar)' : '四輪胎壓已恢復正常 (2.90 Bar)', 'warn');
        break;

      case 'set-control-override':
        this.store.update((st) => {
          st.system.controlStateOverride = el.dataset.val;
        });
        this.store.showToast(`控件狀態檢視模式：${el.dataset.val.toUpperCase()}`, 'info');
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

      default:
        break;
    }
  }
}
